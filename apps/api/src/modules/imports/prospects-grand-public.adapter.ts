import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode, Projet, ProspectType } from '@crm/database';
import type { ModeEpargne, TypeContrat } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { tryNormalizePhone } from '../../common/phone.js';
import { normalizeKey } from '../representants/representants-import.service.js';
import type {
  ChunkOutcome,
  ImportAdapter,
  ImportColumn,
  ImportRowError,
  ImportRunContext,
  ParsedRow,
} from './import-adapter.js';
import { importCell, unresolvedImportValue } from './import-adapter.js';
import {
  ANCIENNETE_MAX_MOIS,
  DUREE_SYSTEME_MAX_MOIS,
  GRAND_PUBLIC_IMPORT_COLUMNS,
  GRAND_PUBLIC_IMPORT_HEADERS,
  GRAND_PUBLIC_MAX_ROWS,
  GRAND_PUBLIC_SHEET_LAYOUT,
  MODE_EPARGNE_CHOICES,
  NON_TOKENS,
  OUI_TOKENS,
  TYPE_CONTRAT_CHOICES,
  readModeEpargne,
  readTypeContrat,
} from './prospects-grand-public-template.js';
import { referentialKey } from './prospects-import.adapter.js';
import { referentialAmbiguous } from './prospects-import.errors.js';

const H = GRAND_PUBLIC_IMPORT_HEADERS;

export const GrandPublicImportError = {
  NOM_ABSENT: 'PROSPECT_GP_IMPORT_NOM_ABSENT',
  TELEPHONE_ILLISIBLE: 'PROSPECT_GP_IMPORT_TELEPHONE_ILLISIBLE',
  BANQUE_INCONNUE: 'PROSPECT_GP_IMPORT_BANQUE_INCONNUE',
  SYNDICAT_INCONNU: 'PROSPECT_GP_IMPORT_SYNDICAT_INCONNU',
  CANAL_INCONNU: 'PROSPECT_GP_IMPORT_CANAL_INCONNU',
  FONCTIONNAIRE_ILLISIBLE: 'PROSPECT_GP_IMPORT_FONCTIONNAIRE_ILLISIBLE',
  DUREE_ILLISIBLE: 'PROSPECT_GP_IMPORT_DUREE_ILLISIBLE',
  TYPE_CONTRAT_ILLISIBLE: 'PROSPECT_GP_IMPORT_TYPE_CONTRAT_ILLISIBLE',
  ANCIENNETE_ILLISIBLE: 'PROSPECT_GP_IMPORT_ANCIENNETE_ILLISIBLE',
  MODE_EPARGNE_ILLISIBLE: 'PROSPECT_GP_IMPORT_MODE_EPARGNE_ILLISIBLE',
  PAYS_INCONNU: 'PROSPECT_GP_IMPORT_PAYS_INCONNU',
  WHATSAPP_ILLISIBLE: 'PROSPECT_GP_IMPORT_WHATSAPP_ILLISIBLE',
  RELAIS_TELEPHONE_ILLISIBLE: 'PROSPECT_GP_IMPORT_RELAIS_TELEPHONE_ILLISIBLE',
  DOUBLON_DANS_LE_FICHIER: 'PROSPECT_GP_IMPORT_DOUBLON_DANS_LE_FICHIER',
  DEJA_EN_BASE: 'PROSPECT_GP_IMPORT_DEJA_EN_BASE',
} as const;

const PROFESSION_MAX = 120;
const EMPLOYEUR_MAX = 160;
const LIEU_MAX = 160;
const VILLE_MAX = 120;
const RELAIS_NOM_MAX = 160;
const EXISTING_LOOKUP_CHUNK = 1_000;

export interface GrandPublicImportRow {
  readonly rowNumber: number;
  readonly nom: string;
  readonly prenom: string;
  readonly phoneE164: string;
  readonly profession: string | null;
  readonly syndicatId: string | null;
  readonly banqueId: string | null;
  readonly type: ProspectType | null;
  readonly dureeSystemeMois: number | null;
  readonly canalProvenanceId: string | null;
  readonly employeurId: string | null;
  readonly employeur: string | null;
  readonly typeContrat: TypeContrat | null;
  readonly ancienneteMois: number | null;
  readonly lieuActivite: string | null;
  readonly modeEpargne: ModeEpargne | null;
  readonly paysResidenceId: string | null;
  readonly villeResidence: string | null;
  readonly whatsappE164: string | null;
  readonly relaisNom: string | null;
  readonly relaisPhoneE164: string | null;
}

type SituationCells = Omit<
  GrandPublicImportRow,
  | 'rowNumber'
  | 'nom'
  | 'prenom'
  | 'phoneE164'
  | 'profession'
  | 'syndicatId'
  | 'banqueId'
  | 'type'
  | 'dureeSystemeMois'
  | 'canalProvenanceId'
>;

/** Référentiels chargés et numéros déjà vus, LE TEMPS D'UNE EXÉCUTION. */
export interface GrandPublicImportRun {
  readonly seen: Map<string, number>;
  readonly banques: ReadonlyMap<string, string>;
  readonly banqueLabels: readonly string[];
  readonly syndicats: ReadonlyMap<string, string>;
  readonly syndicatLabels: readonly string[];
  readonly canaux: ReadonlyMap<string, string>;
  readonly canalLabels: readonly string[];
  readonly employeurs: ReadonlyMap<string, string>;
  readonly pays: ReadonlyMap<string, string>;
  readonly paysLabels: readonly string[];
}

/**
 * Import massif de prospects Grand Public.
 *
 * Le Grand Public ne passe par aucun représentant et ne relève d'aucun
 * syndicat : SEULS le nom et le téléphone sont exigés. Toute autre cellule
 * vide est une information qu'on n'a pas encore, jamais un refus.
 */
@Injectable()
export class ProspectsGrandPublicImportAdapter implements ImportAdapter<
  GrandPublicImportRow,
  GrandPublicImportRun
> {
  readonly kind = ImportKind.PROSPECTS_GRAND_PUBLIC;
  readonly maxRows = GRAND_PUBLIC_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = GRAND_PUBLIC_IMPORT_COLUMNS;
  readonly layout = GRAND_PUBLIC_SHEET_LAYOUT;

  async prepare(ctx: ImportRunContext): Promise<GrandPublicImportRun> {
    const [banques, syndicats, canaux, employeurs, pays] = await Promise.all([
      ctx.tx.banque.findMany({
        where: { isActive: true },
        select: { id: true, shortName: true },
        orderBy: [{ sortOrder: 'asc' }, { shortName: 'asc' }],
      }),
      ctx.tx.syndicat.findMany({
        where: { isActive: true },
        select: { id: true, sigle: true },
        orderBy: [{ sortOrder: 'asc' }, { sigle: 'asc' }],
      }),
      ctx.tx.canalProvenance.findMany({
        where: { isActive: true },
        select: { id: true, code: true, label: true },
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
      ctx.tx.employeur.findMany({
        where: { isActive: true },
        select: { id: true, code: true, label: true },
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
      ctx.tx.pays.findMany({
        where: { isActive: true },
        select: { id: true, code: true, label: true },
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
    ]);

    const canaux0 = new Map<string, string>();
    for (const canal of canaux) {
      // Libellés en toutes lettres : accents indifférents, contrairement aux
      // sigles de banque et de syndicat, où « BNDE » et « B.N.D.E. » peuvent
      // désigner deux entrées distinctes.
      for (const label of [canal.label, canal.code]) {
        const key = normalizeKey(label);
        if (key !== '' && !canaux0.has(key)) canaux0.set(key, canal.id);
      }
    }

    return {
      employeurs: indexByLabel(employeurs),
      pays: indexByLabel(pays),
      paysLabels: pays.map((row) => row.label),
      seen: new Map(),
      banques: indexBySigle(
        banques.map((row) => [row.shortName, row.id] as const),
        H.banque,
      ),
      banqueLabels: banques.map((row) => row.shortName),
      syndicats: indexBySigle(
        syndicats.map((row) => [row.sigle, row.id] as const),
        H.syndicat,
      ),
      syndicatLabels: syndicats.map((row) => row.sigle),
      canaux: canaux0,
      canalLabels: canaux.map((row) => row.label),
    };
  }

  parseRow(
    cells: Record<string, string>,
    rowNumber: number,
    refs: GrandPublicImportRun,
  ): ParsedRow<GrandPublicImportRow> {
    const refuse = (
      column: string,
      code: string,
      message: string,
    ): ParsedRow<GrandPublicImportRow> => ({
      ok: false,
      error: { rowNumber, column, code, message },
    });

    const nom = importCell(cells, H.nom);
    if (nom === '') {
      return refuse(
        H.nom,
        GrandPublicImportError.NOM_ABSENT,
        'Le nom de famille est obligatoire, dans sa propre colonne.',
      );
    }

    const rawPhone = importCell(cells, H.phone);
    const phoneE164 = tryNormalizePhone(rawPhone);
    if (phoneE164 === undefined) {
      return refuse(
        H.phone,
        GrandPublicImportError.TELEPHONE_ILLISIBLE,
        rawPhone === ''
          ? 'Le téléphone est obligatoire : c’est lui qui repère les doublons.'
          : `Numéro de téléphone inexploitable : « ${rawPhone} ».`,
      );
    }

    const rawBanque = importCell(cells, H.banque);
    const banqueId =
      rawBanque === '' ? null : (refs.banques.get(referentialKey(rawBanque)) ?? null);
    if (unresolvedImportValue(rawBanque, banqueId)) {
      return refuse(
        H.banque,
        GrandPublicImportError.BANQUE_INCONNUE,
        `Banque inconnue : « ${rawBanque} ». Valeurs admises : ${listValues(refs.banqueLabels)}, ou cellule vide.`,
      );
    }

    const rawSyndicat = importCell(cells, H.syndicat);
    const syndicatId =
      rawSyndicat === '' ? null : (refs.syndicats.get(referentialKey(rawSyndicat)) ?? null);
    if (unresolvedImportValue(rawSyndicat, syndicatId)) {
      return refuse(
        H.syndicat,
        GrandPublicImportError.SYNDICAT_INCONNU,
        `Syndicat inconnu : « ${rawSyndicat} ». Valeurs admises : ${listValues(refs.syndicatLabels)}, ou cellule vide.`,
      );
    }

    const rawCanal = importCell(cells, H.canal);
    const canalProvenanceId =
      rawCanal === '' ? null : (refs.canaux.get(normalizeKey(rawCanal)) ?? null);
    if (unresolvedImportValue(rawCanal, canalProvenanceId)) {
      return refuse(
        H.canal,
        GrandPublicImportError.CANAL_INCONNU,
        `Canal de provenance inconnu : « ${rawCanal} ». Valeurs admises : ${listValues(refs.canalLabels)}, ou cellule vide.`,
      );
    }

    const rawFonctionnaire = importCell(cells, H.fonctionnaire);
    const fonctionnaire = readFonctionnaire(rawFonctionnaire);
    if (fonctionnaire === 'illisible') {
      return refuse(
        H.fonctionnaire,
        GrandPublicImportError.FONCTIONNAIRE_ILLISIBLE,
        `« ${rawFonctionnaire} » ne se lit ni comme oui ni comme non. Écrivez ${listValues(OUI_TOKENS)} ou ${listValues(NON_TOKENS)}, ou laissez vide.`,
      );
    }

    const rawDuree = importCell(cells, H.dureeSysteme);
    const dureeSystemeMois = readDureeMois(rawDuree);
    if (unresolvedImportValue(rawDuree, dureeSystemeMois)) {
      return refuse(
        H.dureeSysteme,
        GrandPublicImportError.DUREE_ILLISIBLE,
        `« ${rawDuree} » n’est pas un nombre entier de mois entre 1 et ${String(DUREE_SYSTEME_MAX_MOIS)}. Écrivez 24, ou laissez vide.`,
      );
    }

    const situation = this.parseSituation(cells, rowNumber, refs);
    if (!situation.ok) return situation;

    const profession = importCell(cells, H.profession);

    return {
      ok: true,
      row: {
        rowNumber,
        nom,
        prenom: importCell(cells, H.prenom),
        phoneE164,
        profession: profession === '' ? null : profession.slice(0, PROFESSION_MAX),
        syndicatId,
        banqueId,
        // « Non » dit ce que la personne n'est PAS : il ne choisit pas entre
        // secteur privé, informel et diaspora, donc le type reste vide.
        type: fonctionnaire === 'oui' ? ProspectType.FONCTIONNAIRE : null,
        dureeSystemeMois,
        canalProvenanceId,
        ...situation.row,
      },
    };
  }

  /**
   * Les dix colonnes de situation, ajoutées en fin de modèle.
   *
   * Seul le pays refuse la ligne : il désigne une entrée de référentiel qui ne
   * se crée pas à l'import. L'employeur, lui, retombe en texte libre — c'est le
   * repli que la fiche prévoit déjà.
   */
  private parseSituation(
    cells: Record<string, string>,
    rowNumber: number,
    refs: GrandPublicImportRun,
  ): ParsedRow<SituationCells> {
    const refuse = (column: string, code: string, message: string): ParsedRow<SituationCells> => ({
      ok: false,
      error: { rowNumber, column, code, message },
    });

    const rawEmployeur = importCell(cells, H.employeur);
    const employeurId =
      rawEmployeur === '' ? null : (refs.employeurs.get(normalizeKey(rawEmployeur)) ?? null);

    const rawContrat = importCell(cells, H.typeContrat);
    const typeContrat = readTypeContrat(rawContrat);
    if (typeContrat === null) {
      return refuse(
        H.typeContrat,
        GrandPublicImportError.TYPE_CONTRAT_ILLISIBLE,
        `Type de contrat inconnu : « ${rawContrat} ». Valeurs admises : ${listValues(TYPE_CONTRAT_CHOICES)}, ou cellule vide.`,
      );
    }

    const rawAnciennete = importCell(cells, H.anciennete);
    const ancienneteMois = readAncienneteMois(rawAnciennete);
    if (unresolvedImportValue(rawAnciennete, ancienneteMois)) {
      return refuse(
        H.anciennete,
        GrandPublicImportError.ANCIENNETE_ILLISIBLE,
        `« ${rawAnciennete} » n’est pas un nombre entier de mois entre 0 et ${String(ANCIENNETE_MAX_MOIS)}. Écrivez 36, ou laissez vide.`,
      );
    }

    const rawEpargne = importCell(cells, H.modeEpargne);
    const modeEpargne = readModeEpargne(rawEpargne);
    if (modeEpargne === null) {
      return refuse(
        H.modeEpargne,
        GrandPublicImportError.MODE_EPARGNE_ILLISIBLE,
        `Mode d’épargne inconnu : « ${rawEpargne} ». Valeurs admises : ${listValues(MODE_EPARGNE_CHOICES)}, ou cellule vide.`,
      );
    }

    const rawPays = importCell(cells, H.paysResidence);
    const paysResidenceId = rawPays === '' ? null : (refs.pays.get(normalizeKey(rawPays)) ?? null);
    if (unresolvedImportValue(rawPays, paysResidenceId)) {
      return refuse(
        H.paysResidence,
        GrandPublicImportError.PAYS_INCONNU,
        `Pays de résidence inconnu : « ${rawPays} ». Nom en français ou code ISO. Valeurs admises : ${listValues(refs.paysLabels)}, ou cellule vide.`,
      );
    }

    const rawWhatsapp = importCell(cells, H.whatsapp);
    const whatsappE164 = tryNormalizePhone(rawWhatsapp) ?? null;
    if (unresolvedImportValue(rawWhatsapp, whatsappE164)) {
      return refuse(
        H.whatsapp,
        GrandPublicImportError.WHATSAPP_ILLISIBLE,
        `Numéro WhatsApp inexploitable : « ${rawWhatsapp} ». Écrivez-le avec son indicatif s’il est étranger.`,
      );
    }

    const rawRelaisPhone = importCell(cells, H.relaisPhone);
    const relaisPhoneE164 = tryNormalizePhone(rawRelaisPhone) ?? null;
    if (unresolvedImportValue(rawRelaisPhone, relaisPhoneE164)) {
      return refuse(
        H.relaisPhone,
        GrandPublicImportError.RELAIS_TELEPHONE_ILLISIBLE,
        `Téléphone du relais inexploitable : « ${rawRelaisPhone} ».`,
      );
    }

    return {
      ok: true,
      row: {
        employeurId,
        employeur: employeurId === null ? cut(rawEmployeur, EMPLOYEUR_MAX) : null,
        typeContrat: typeContrat ?? null,
        ancienneteMois,
        lieuActivite: cut(importCell(cells, H.lieuActivite), LIEU_MAX),
        modeEpargne: modeEpargne ?? null,
        paysResidenceId,
        villeResidence: cut(importCell(cells, H.villeResidence), VILLE_MAX),
        whatsappE164,
        relaisNom: cut(importCell(cells, H.relaisNom), RELAIS_NOM_MAX),
        relaisPhoneE164,
      },
    };
  }

  async writeChunk(
    rows: readonly GrandPublicImportRow[],
    ctx: ImportRunContext,
    run: GrandPublicImportRun,
  ): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, skipped: 0, errors: [] };

    const errors: ImportRowError[] = [];
    const unique: GrandPublicImportRow[] = [];

    for (const row of rows) {
      const firstSeen = run.seen.get(row.phoneE164);
      if (firstSeen !== undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          column: H.phone,
          code: GrandPublicImportError.DOUBLON_DANS_LE_FICHIER,
          message: `Ce numéro figure déjà à la ligne ${String(firstSeen)} du fichier.`,
        });
        continue;
      }
      run.seen.set(row.phoneE164, row.rowNumber);
      unique.push(row);
    }

    const existing = await this.existingProspects(
      unique.map((row) => row.phoneE164),
      ctx,
    );

    const retained: GrandPublicImportRow[] = [];
    for (const row of unique) {
      const hasGrandPublicJourney = existing.get(row.phoneE164);
      if (hasGrandPublicJourney !== true) {
        retained.push(row);
        continue;
      }
      errors.push({
        rowNumber: row.rowNumber,
        column: H.phone,
        code: GrandPublicImportError.DEJA_EN_BASE,
        message: 'Ce prospect Grand Public existe déjà en base.',
      });
    }

    if (ctx.mode === ImportMode.DRY_RUN) {
      return { created: retained.length, skipped: 0, errors };
    }

    const now = new Date();
    const newRows = retained.filter((row) => !existing.has(row.phoneE164));
    await ctx.tx.prospect.createMany({
      data: newRows.map((row) => ({
        id: uuidv7(),
        projet: Projet.GRAND_PUBLIC,
        nom: row.nom,
        prenom: row.prenom,
        phoneE164: row.phoneE164,
        profession: row.profession,
        syndicatId: row.syndicatId,
        banqueId: row.banqueId,
        representantId: null,
        type: row.type,
        dureeSystemeMois: row.dureeSystemeMois,
        canalProvenanceId: row.canalProvenanceId,
        employeurId: row.employeurId,
        employeur: row.employeur,
        typeContrat: row.typeContrat,
        ancienneteMois: row.ancienneteMois,
        lieuActivite: row.lieuActivite,
        modeEpargne: row.modeEpargne,
        paysResidenceId: row.paysResidenceId,
        villeResidence: row.villeResidence,
        whatsappE164: row.whatsappE164,
        relaisNom: row.relaisNom,
        relaisPhoneE164: row.relaisPhoneE164,
        createdById: ctx.requestedById,
        clientCreatedAt: now,
      })),
      // L'index unique partiel double le contrôle : une ligne prise pendant
      // l'import est écartée, et l'écart est COMPTÉ dans `skipped`.
      skipDuplicates: true,
    });

    const prospects = await ctx.tx.prospect.findMany({
      where: { phoneE164: { in: retained.map((row) => row.phoneE164) }, deletedAt: null },
      select: { id: true },
    });
    const journeys = await ctx.tx.prospectJourney.createMany({
      data: prospects.map((prospect) => ({
        prospectId: prospect.id,
        projet: Projet.GRAND_PUBLIC,
        consent: 'INTERESSE',
        consentAt: now,
      })),
      skipDuplicates: true,
    });

    return {
      created: journeys.count,
      skipped: retained.length - journeys.count,
      errors,
    };
  }

  private async existingProspects(
    phones: readonly string[],
    ctx: ImportRunContext,
  ): Promise<Map<string, boolean>> {
    const found = new Map<string, boolean>();

    for (let start = 0; start < phones.length; start += EXISTING_LOOKUP_CHUNK) {
      const rows = await ctx.tx.prospect.findMany({
        where: {
          phoneE164: { in: phones.slice(start, start + EXISTING_LOOKUP_CHUNK) },
          deletedAt: null,
        },
        select: {
          phoneE164: true,
          projet: true,
          journeys: { where: { projet: Projet.GRAND_PUBLIC }, select: { id: true } },
        },
      });
      for (const row of rows) {
        found.set(row.phoneE164, row.journeys.length > 0 || row.projet === Projet.GRAND_PUBLIC);
      }
    }

    return found;
  }
}

/** Libellé ou code, accents et casse indifférents : un fichier tenu à la main écrit les deux. */
function indexByLabel(
  rows: readonly { id: string; code: string; label: string }[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    for (const value of [row.label, row.code]) {
      const key = normalizeKey(value);
      if (key !== '' && !map.has(key)) map.set(key, row.id);
    }
  }
  return map;
}

const cut = (value: string, max: number): string | null =>
  value === '' ? null : value.slice(0, max);

/** « 36 » et « 36 mois » se lisent. Zéro est une vraie réponse : il vient d'être embauché. */
export function readAncienneteMois(raw: string): number | null {
  const match = /^(\d{1,4})(?:\s*mois)?$/i.exec(raw.trim());
  if (match === null) return null;

  const mois = Number(match[1]);
  return mois >= 0 && mois <= ANCIENNETE_MAX_MOIS ? mois : null;
}

function indexBySigle(
  entries: readonly (readonly [string, string])[],
  column: string,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [label, id] of entries) {
    const key = referentialKey(label);
    if (map.has(key)) throw referentialAmbiguous(column, key);
    map.set(key, id);
  }
  return map;
}

export function readFonctionnaire(raw: string): 'oui' | 'non' | 'inconnu' | 'illisible' {
  const key = normalizeKey(raw);
  if (key === '') return 'inconnu';
  if (OUI_TOKENS.includes(key)) return 'oui';
  if (NON_TOKENS.includes(key)) return 'non';
  return 'illisible';
}

/** « 24 » et « 24 mois » se lisent. « 2 ans » ne se devine pas. */
export function readDureeMois(raw: string): number | null {
  const match = /^(\d{1,4})(?:\s*mois)?$/i.exec(raw.trim());
  if (match === null) return null;

  const mois = Number(match[1]);
  return mois >= 1 && mois <= DUREE_SYSTEME_MAX_MOIS ? mois : null;
}

/** Bornées : cinquante banques rendraient le message de refus illisible. */
function listValues(values: readonly string[]): string {
  const MAX = 20;
  const shown = values.slice(0, MAX).join(', ');
  return values.length > MAX ? `${shown}, … (${String(values.length)} au total)` : shown;
}
