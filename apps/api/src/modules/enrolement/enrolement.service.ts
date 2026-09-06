import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Projet } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { isOpenApiGeneration } from '../../env.js';
import {
  FREQUENCE_DEFAUT_MINUTES,
  FREQUENCE_MAX_MINUTES,
  FREQUENCE_MIN_MINUTES,
  type DernierTirageDto,
  type EnrolementReglagesDto,
  type InscriptionPlateformeDetailDto,
  type InscriptionPlateformeDto,
  type InscriptionsPageDto,
  type InscriptionsQueryDto,
  type TirageDto,
  type UpdateEnrolementReglagesDto,
} from './dto.js';
import {
  JetonPlateformeRevoque,
  PlateformeNonConfiguree,
  lirePlateforme,
  type ConfigPlateforme,
  type InscriptionDistante,
} from './plateformes.js';
import { choisirProspect, indexerProspects, type CandidatProspect } from './rapprochement.js';

export const ENROLEMENT_CONFIG = 'ENROLEMENT_CONFIG';

export type ConfigEnrolement = Readonly<Record<Projet, ConfigPlateforme>>;

const cleReglages = (projet: Projet): string => `enrolement.${projet}`;

interface ReglagesStockes {
  frequenceMinutes: number;
  repriseDepuis: string | null;
  dernierTirage: DernierTirageDto | null;
}

const REGLAGES_USINE: ReglagesStockes = {
  frequenceMinutes: FREQUENCE_DEFAUT_MINUTES,
  repriseDepuis: null,
  dernierTirage: null,
};

function lireReglages(valeur: string | undefined): ReglagesStockes {
  if (valeur === undefined) return { ...REGLAGES_USINE };
  try {
    const brut = JSON.parse(valeur) as Partial<ReglagesStockes>;
    const frequence = Number(brut.frequenceMinutes);
    return {
      frequenceMinutes:
        Number.isInteger(frequence) &&
        frequence >= FREQUENCE_MIN_MINUTES &&
        frequence <= FREQUENCE_MAX_MINUTES
          ? frequence
          : FREQUENCE_DEFAUT_MINUTES,
      repriseDepuis: typeof brut.repriseDepuis === 'string' ? brut.repriseDepuis : null,
      // `disparues` est arrivé après : un réglage écrit avant ne le porte pas.
      dernierTirage:
        brut.dernierTirage === undefined || brut.dernierTirage === null
          ? null
          : Object.assign(brut.dernierTirage, { disparues: brut.dernierTirage.disparues ?? 0 }),
    };
  } catch {
    return { ...REGLAGES_USINE };
  }
}

type LigneInscription = {
  id: string;
  projet: Projet;
  identifiantDistant: string;
  nom: string;
  prenom: string;
  phoneE164: string | null;
  email: string | null;
  statutDistant: string;
  etapeDistante: number | null;
  inscriteLe: Date | null;
  soumiseLe: Date | null;
  decideeLe: Date | null;
  disparueLe: Date | null;
  prospectId: string | null;
  dernierTirageAt: Date;
};

const versDto = (ligne: LigneInscription): InscriptionPlateformeDto => ({
  id: ligne.id,
  projet: ligne.projet,
  identifiantDistant: ligne.identifiantDistant,
  nom: ligne.nom,
  prenom: ligne.prenom,
  phoneE164: ligne.phoneE164,
  email: ligne.email,
  statutDistant: ligne.statutDistant,
  etapeDistante: ligne.etapeDistante,
  inscriteLe: ligne.inscriteLe?.toISOString() ?? null,
  soumiseLe: ligne.soumiseLe?.toISOString() ?? null,
  decideeLe: ligne.decideeLe?.toISOString() ?? null,
  disparueLe: ligne.disparueLe?.toISOString() ?? null,
  prospectId: ligne.prospectId,
  dernierTirageAt: ligne.dernierTirageAt.toISOString(),
});

@Injectable()
export class EnrolementService {
  private readonly logger = new Logger(EnrolementService.name);

  /**
   * ponytail: un verrou de processus, pas de bail en base. Le déploiement tient
   * en un conteneur d'API ; à plusieurs, deux tirages simultanés resteraient
   * sans effet de bord (la clé `projet + identifiantDistant` est idempotente)
   * mais liraient la plateforme deux fois. Passer par `app_settings` comme
   * `db-dump` le jour où l'API sera répliquée.
   */
  private readonly enCours = new Set<Projet>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENROLEMENT_CONFIG) private readonly config: ConfigEnrolement,
  ) {}

  // ── Réglages ──────────────────────────────────────────────────────────────

  async reglages(projet: Projet): Promise<EnrolementReglagesDto> {
    const ligne = await this.prisma.appSetting.findUnique({ where: { key: cleReglages(projet) } });
    const stockes = lireReglages(ligne?.value);
    return {
      projet,
      frequenceMinutes: stockes.frequenceMinutes,
      repriseDepuis: stockes.repriseDepuis,
      configuree: this.configuree(projet),
      dernierTirage: stockes.dernierTirage,
      updatedAt: ligne?.updatedAt.toISOString() ?? null,
    };
  }

  async majReglages(
    projet: Projet,
    actorId: string,
    body: UpdateEnrolementReglagesDto,
  ): Promise<EnrolementReglagesDto> {
    const courant = await this.reglages(projet);
    const suivants: ReglagesStockes = {
      frequenceMinutes: body.frequenceMinutes ?? courant.frequenceMinutes,
      repriseDepuis: normaliserReprise(body.repriseDepuis, courant.repriseDepuis),
      dernierTirage: courant.dernierTirage,
    };
    await this.ecrireReglages(projet, suivants, actorId);
    return this.reglages(projet);
  }

  private async ecrireReglages(
    projet: Projet,
    reglages: ReglagesStockes,
    actorId: string | null,
  ): Promise<void> {
    const key = cleReglages(projet);
    const value = JSON.stringify(reglages);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value, ...(actorId === null ? {} : { updatedById: actorId }) },
      update: { value, ...(actorId === null ? {} : { updatedById: actorId }) },
    });
  }

  private configuree(projet: Projet): boolean {
    const config = this.config[projet];
    return config.url.trim() !== '' && config.token.trim() !== '';
  }

  // ── Tirage ────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE, { name: 'cpi.enrolement.tirage' })
  async tirageDu(now: Date = new Date()): Promise<void> {
    if (isOpenApiGeneration()) return;

    for (const projet of [Projet.CHUES, Projet.GRAND_PUBLIC]) {
      if (!this.configuree(projet)) continue;
      const reglages = await this.reglages(projet);
      if (!estEchu(reglages, now)) continue;
      await this.tirer(projet);
    }
  }

  async tirer(projet: Projet): Promise<TirageDto> {
    if (this.enCours.has(projet)) {
      return {
        projet,
        dureeMs: 0,
        lus: 0,
        crees: 0,
        misAJour: 0,
        rapproches: 0,
        disparues: 0,
        erreur: 'Un tirage est déjà en cours.',
      };
    }
    this.enCours.add(projet);

    const debut = Date.now();
    let lus = 0;
    let crees = 0;
    let misAJour = 0;
    let rapproches = 0;
    let disparues = 0;
    let erreur: string | null = null;

    try {
      const reglages = await this.reglages(projet);
      const lignes = await lirePlateforme(projet, this.config[projet]);
      const retenues = filtrerDepuis(lignes, reglages.repriseDepuis);
      lus = retenues.length;

      const index = indexerProspects(await this.candidats(projet, retenues));
      const connus = new Set(
        (
          await this.prisma.inscriptionPlateforme.findMany({
            where: { projet },
            select: { identifiantDistant: true },
          })
        ).map((ligne) => ligne.identifiantDistant),
      );

      const dernierTirageAt = new Date();
      for (const ligne of retenues) {
        const prospectId = choisirProspect(projet, ligne.phoneE164, ligne.email, index);
        if (prospectId !== null) rapproches += 1;
        if (connus.has(ligne.identifiantDistant)) misAJour += 1;
        else crees += 1;
        await this.deposer(projet, ligne, prospectId, dernierTirageAt);
      }

      disparues = await this.marquerDisparues(
        projet,
        new Set(retenues.map((ligne) => ligne.identifiantDistant)),
        connus.size,
        reglages.repriseDepuis,
        dernierTirageAt,
      );

      await this.consigner(projet, {
        termineLe: new Date().toISOString(),
        dureeMs: Date.now() - debut,
        lus,
        crees,
        misAJour,
        rapproches,
        disparues,
        erreur: null,
      });
      this.logger.log(
        `Tirage ${projet} : ${String(lus)} lus, ${String(crees)} créés, ${String(misAJour)} mis à jour, ${String(rapproches)} rapprochés, ${String(disparues)} disparus en ${String(Date.now() - debut)} ms`,
      );
    } catch (cause) {
      erreur = messageDErreur(cause);
      this.logger.error(`Tirage ${projet} interrompu : ${erreur}`);
      await this.consigner(projet, {
        termineLe: new Date().toISOString(),
        dureeMs: Date.now() - debut,
        lus,
        crees,
        misAJour,
        rapproches,
        disparues,
        erreur,
      });
    } finally {
      this.enCours.delete(projet);
    }

    return {
      projet,
      dureeMs: Date.now() - debut,
      lus,
      crees,
      misAJour,
      rapproches,
      disparues,
      erreur,
    };
  }

  /**
   * Ce qu'un tirage complet ne rend plus est marqué, jamais supprimé. Une
   * reprise datée n'en rend qu'une tranche, et une plateforme vide face à une
   * table pleine est une panne d'en face : dans ces deux cas, ne rien marquer.
   */
  private async marquerDisparues(
    projet: Projet,
    vus: ReadonlySet<string>,
    connus: number,
    repriseDepuis: string | null,
    quand: Date,
  ): Promise<number> {
    if (repriseDepuis !== null) return 0;
    if (vus.size === 0 && connus > 0) {
      this.logger.warn(
        `Tirage ${projet} : la plateforme ne rend plus rien alors que le CRM porte ${String(connus)} inscriptions. Aucune n'est marquée disparue.`,
      );
      return 0;
    }

    // ponytail: le `notIn` porte tous les identifiants lus. Quelques milliers
    // tiennent dans la requête ; au-delà, marquer par date de dernier tirage.
    const { count } = await this.prisma.inscriptionPlateforme.updateMany({
      where: { projet, disparueLe: null, identifiantDistant: { notIn: [...vus] } },
      data: { disparueLe: quand },
    });
    return count;
  }

  /**
   * ponytail: une écriture par ligne. La plateforme CHUES rend quelques
   * milliers de comptes ; passer à `createMany` + `updateMany` le jour où le
   * tirage dépassera la minute.
   */
  private async deposer(
    projet: Projet,
    ligne: InscriptionDistante,
    prospectId: string | null,
    dernierTirageAt: Date,
  ): Promise<void> {
    const commun = {
      nom: ligne.nom,
      prenom: ligne.prenom,
      phoneE164: ligne.phoneE164,
      email: ligne.email,
      statutDistant: ligne.statutDistant,
      etapeDistante: ligne.etapeDistante,
      inscriteLe: ligne.inscriteLe,
      soumiseLe: ligne.soumiseLe,
      decideeLe: ligne.decideeLe,
      // La plateforme la rend de nouveau : la marque de disparition tombe.
      disparueLe: null,
      prospectId,
      chargeUtile: (ligne.chargeUtile ?? {}) as Prisma.InputJsonValue,
      dernierTirageAt,
    };

    await this.prisma.inscriptionPlateforme.upsert({
      where: {
        projet_identifiantDistant: { projet, identifiantDistant: ligne.identifiantDistant },
      },
      create: { projet, identifiantDistant: ligne.identifiantDistant, ...commun },
      update: commun,
    });
  }

  private async consigner(projet: Projet, tirage: DernierTirageDto): Promise<void> {
    const courant = await this.reglages(projet);
    await this.ecrireReglages(
      projet,
      {
        frequenceMinutes: courant.frequenceMinutes,
        repriseDepuis: courant.repriseDepuis,
        dernierTirage: tirage,
      },
      null,
    );
  }

  /** Les prospects du MÊME projet que le lot de lignes peut reconnaître. */
  private async candidats(
    projet: Projet,
    lignes: readonly InscriptionDistante[],
  ): Promise<CandidatProspect[]> {
    const telephones = [
      ...new Set(lignes.flatMap((ligne) => (ligne.phoneE164 === null ? [] : [ligne.phoneE164]))),
    ];
    const emails = [
      ...new Set(
        lignes.flatMap((ligne) => (ligne.email === null ? [] : [ligne.email.trim().toLowerCase()])),
      ),
    ].filter((email) => email !== '');

    const parIdentifiant = new Map<string, CandidatProspect>();

    if (telephones.length > 0) {
      const trouves = await this.prisma.prospect.findMany({
        where: {
          projet,
          deletedAt: null,
          OR: [{ phoneE164: { in: telephones } }, { whatsappE164: { in: telephones } }],
        },
        select: {
          id: true,
          projet: true,
          phoneE164: true,
          whatsappE164: true,
          clientCreatedAt: true,
        },
      });
      for (const prospect of trouves) {
        parIdentifiant.set(prospect.id, { ...prospect, emails: [] });
      }
    }

    if (emails.length > 0) {
      // `Prospect` ne porte pas d'e-mail : la conversion l'écrit sur la
      // tentative d'appel. Requête brute parce que `in` de Prisma n'accepte pas
      // `mode: 'insensitive'`.
      const lignesEmail = await this.prisma.$queryRaw<
        {
          id: string;
          projet: Projet;
          phoneE164: string;
          whatsappE164: string | null;
          clientCreatedAt: Date;
          email: string;
        }[]
      >`
        SELECT DISTINCT p."id", p."projet", p."phoneE164", p."whatsappE164",
               p."clientCreatedAt", LOWER(ca."email") AS email
        FROM "call_attempts" ca
        INNER JOIN "prospects" p ON p."id" = ca."prospectId"
        WHERE p."projet" = ${projet}::"Projet"
          AND p."deletedAt" IS NULL
          AND ca."email" IS NOT NULL
          AND LOWER(ca."email") IN (${Prisma.join(emails)})
      `;

      for (const ligne of lignesEmail) {
        const deja = parIdentifiant.get(ligne.id);
        if (deja === undefined) {
          parIdentifiant.set(ligne.id, {
            id: ligne.id,
            projet: ligne.projet,
            phoneE164: ligne.phoneE164,
            whatsappE164: ligne.whatsappE164,
            clientCreatedAt: ligne.clientCreatedAt,
            emails: [ligne.email],
          });
        } else {
          parIdentifiant.set(ligne.id, { ...deja, emails: [...deja.emails, ligne.email] });
        }
      }
    }

    return [...parIdentifiant.values()];
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async lister(projet: Projet, query: InscriptionsQueryDto): Promise<InscriptionsPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.InscriptionPlateformeWhereInput = {
      projet,
      ...(query.statut === undefined ? {} : { statutDistant: query.statut }),
      ...(query.inclureDisparues === true ? {} : { disparueLe: null }),
      ...filtreRapproche(query.rapproche),
      ...bornesInscription(query),
      ...(query.search === undefined || query.search.trim() === ''
        ? {}
        : {
            OR: [
              { nom: { contains: query.search, mode: 'insensitive' } },
              { prenom: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phoneE164: { contains: query.search } },
            ],
          }),
    };

    const [total, lignes] = await Promise.all([
      this.prisma.inscriptionPlateforme.count({ where }),
      this.prisma.inscriptionPlateforme.findMany({
        where,
        orderBy: [{ inscriteLe: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: lignes.map(versDto),
      meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async detail(projet: Projet, id: string): Promise<InscriptionPlateformeDetailDto> {
    const ligne = await this.prisma.inscriptionPlateforme.findFirst({ where: { id, projet } });
    if (ligne === null) {
      throw new NotFoundException({
        code: 'INSCRIPTION_INTROUVABLE',
        message: 'Cette inscription n’existe pas pour ce projet.',
      });
    }
    return Object.assign(versDto(ligne), { chargeUtile: ligne.chargeUtile });
  }

  // ── Effacement ────────────────────────────────────────────────────────────

  /**
   * Le miroir se vide sans conséquence : le tirage suivant relit la plateforme
   * en entier. Vider puis tirer est la façon de vérifier que le CRM montre bien
   * ce que la plateforme porte aujourd'hui.
   */
  async purger(projet: Projet): Promise<number> {
    const { count } = await this.prisma.inscriptionPlateforme.deleteMany({ where: { projet } });
    this.logger.warn(`Miroir ${projet} vidé : ${String(count)} inscriptions supprimées.`);
    return count;
  }

  async supprimer(projet: Projet, id: string): Promise<number> {
    const { count } = await this.prisma.inscriptionPlateforme.deleteMany({ where: { id, projet } });
    if (count === 0) {
      throw new NotFoundException({
        code: 'INSCRIPTION_INTROUVABLE',
        message: 'Cette inscription n’existe pas pour ce projet.',
      });
    }
    return count;
  }
}

function filtreRapproche(rapproche: boolean | undefined): Prisma.InscriptionPlateformeWhereInput {
  if (rapproche === undefined) return {};
  return rapproche ? { prospectId: { not: null } } : { prospectId: null };
}

function bornesInscription(query: InscriptionsQueryDto): Prisma.InscriptionPlateformeWhereInput {
  const from = query.dateFrom === undefined ? undefined : inclusiveDateFrom(query.dateFrom);
  const to = query.dateTo === undefined ? undefined : inclusiveDateTo(query.dateTo);
  if (from === undefined && to === undefined) return {};
  return {
    inscriteLe: {
      ...(from === undefined ? {} : { gte: from }),
      ...(to === undefined ? {} : { lte: to }),
    },
  };
}

/** Chaîne vide : reprendre tout l'historique. Absente : ne rien changer. */
function normaliserReprise(valeur: string | undefined, courant: string | null): string | null {
  if (valeur === undefined) return courant;
  if (valeur.trim() === '') return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? courant : date.toISOString();
}

function filtrerDepuis(
  lignes: readonly InscriptionDistante[],
  repriseDepuis: string | null,
): InscriptionDistante[] {
  if (repriseDepuis === null) return [...lignes];
  const borne = new Date(repriseDepuis);
  if (Number.isNaN(borne.getTime())) return [...lignes];
  // Une ligne sans date d'inscription est GARDÉE : l'écarter ferait disparaître
  // de l'écran une inscription réelle pour une donnée manquante en face.
  return lignes.filter((ligne) => ligne.inscriteLe === null || ligne.inscriteLe >= borne);
}

function estEchu(reglages: EnrolementReglagesDto, now: Date): boolean {
  const dernier = reglages.dernierTirage;
  if (dernier === null) return true;
  const termine = new Date(dernier.termineLe).getTime();
  if (Number.isNaN(termine)) return true;
  return now.getTime() - termine >= reglages.frequenceMinutes * 60_000;
}

function messageDErreur(cause: unknown): string {
  if (cause instanceof JetonPlateformeRevoque) return cause.message;
  if (cause instanceof PlateformeNonConfiguree) return cause.message;
  return cause instanceof Error ? cause.message : String(cause);
}
