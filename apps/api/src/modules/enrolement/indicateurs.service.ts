import { Injectable } from '@nestjs/common';
import { EnrollmentMethod, Prisma, Projet } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { days, rate } from '../analytics/pilotage.sql.js';
import { ENROLLMENT_METHOD_LABELS } from '../prospects/phase2-labels.js';
import type {
  DelaiMedianDto,
  EnrolementIndicateursDto,
  RepartitionDto,
  SerieJourDto,
} from './dto.js';

export interface PeriodeIndicateurs {
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

/** Grand Public numérote son dossier de 0 à 5 ; CHUES n'a pas d'étape chiffrée. */
const ETAPES_GRAND_PUBLIC: Readonly<Record<number, string>> = {
  0: 'Étape 0 · Inscription',
  1: 'Étape 1 · Dossier constitué',
  2: 'Étape 2 · Dépôt en banque',
  3: 'Étape 3 · Accord bancaire',
  4: 'Étape 4 · Signature',
  5: 'Étape 5 · Terminé',
};

const libelleEtape = (etape: number | null, statut: string): string =>
  etape === null ? statut : (ETAPES_GRAND_PUBLIC[etape] ?? `Étape ${String(etape)}`);

@Injectable()
export class EnrolementIndicateursService {
  constructor(private readonly prisma: PrismaService) {}

  async indicateurs(
    projet: Projet,
    periode: PeriodeIndicateurs,
  ): Promise<EnrolementIndicateursDto> {
    const filtres = conditions(periode);

    const [
      totaux,
      parJour,
      parEtape,
      delais,
      parTeleconseiller,
      parCampagne,
      parMethode,
      conversion,
    ] = await Promise.all([
      this.totaux(projet, filtres),
      this.parJour(projet, filtres),
      this.parEtape(projet, filtres),
      this.delais(projet, filtres),
      this.parTeleconseiller(projet, filtres),
      this.parCampagne(projet, filtres),
      this.parMethode(projet, filtres),
      this.conversion(projet, filtres),
    ]);

    return {
      projet,
      inscriptions: totaux.inscriptions,
      rapprochees: totaux.rapprochees,
      tauxConversion: rate(conversion.inscrits, conversion.convertis),
      tauxRapprochement: rate(totaux.rapprochees, totaux.inscriptions),
      parJour,
      parEtape,
      delais,
      parTeleconseiller,
      parCampagne,
      parMethode,
    };
  }

  private async totaux(
    projet: Projet,
    filtres: Prisma.Sql,
  ): Promise<{ inscriptions: number; rapprochees: number }> {
    const lignes = await this.prisma.$queryRaw<{ inscriptions: number; rapprochees: number }[]>`
      SELECT COUNT(*)::int AS inscriptions,
             COUNT(*) FILTER (WHERE i."prospectId" IS NOT NULL)::int AS rapprochees
      FROM "inscriptions_plateforme" i
      WHERE i."projet" = ${projet}::"Projet" AND ${filtres}
    `;
    return lignes[0] ?? { inscriptions: 0, rapprochees: 0 };
  }

  private async parJour(projet: Projet, filtres: Prisma.Sql): Promise<SerieJourDto[]> {
    const lignes = await this.prisma.$queryRaw<{ jour: Date; inscriptions: number }[]>`
      SELECT date_trunc('day', i."inscriteLe") AS jour, COUNT(*)::int AS inscriptions
      FROM "inscriptions_plateforme" i
      WHERE i."projet" = ${projet}::"Projet" AND i."inscriteLe" IS NOT NULL AND ${filtres}
      GROUP BY 1
      ORDER BY 1
    `;
    return lignes.map((ligne) => ({
      jour: ligne.jour.toISOString().slice(0, 10),
      inscriptions: ligne.inscriptions,
    }));
  }

  private async parEtape(projet: Projet, filtres: Prisma.Sql): Promise<RepartitionDto[]> {
    const lignes = await this.prisma.$queryRaw<
      { etape: number | null; statut: string; inscriptions: number }[]
    >`
      SELECT i."etapeDistante" AS etape, i."statutDistant" AS statut, COUNT(*)::int AS inscriptions
      FROM "inscriptions_plateforme" i
      WHERE i."projet" = ${projet}::"Projet" AND ${filtres}
      GROUP BY 1, 2
      ORDER BY 1 NULLS FIRST, 3 DESC
    `;
    return lignes.map((ligne) => ({
      id: ligne.etape === null ? ligne.statut : String(ligne.etape),
      label: libelleEtape(ligne.etape, ligne.statut),
      inscriptions: ligne.inscriptions,
    }));
  }

  private async delais(projet: Projet, filtres: Prisma.Sql): Promise<DelaiMedianDto[]> {
    const lignes = await this.prisma.$queryRaw<
      { m1: number | null; n1: number; m2: number | null; n2: number }[]
    >`
      SELECT ${median(Prisma.sql`i."inscriteLe"`, Prisma.sql`i."soumiseLe"`)} AS m1,
             ${echantillon(Prisma.sql`i."inscriteLe"`, Prisma.sql`i."soumiseLe"`)} AS n1,
             ${median(Prisma.sql`i."soumiseLe"`, Prisma.sql`i."decideeLe"`)} AS m2,
             ${echantillon(Prisma.sql`i."soumiseLe"`, Prisma.sql`i."decideeLe"`)} AS n2
      FROM "inscriptions_plateforme" i
      WHERE i."projet" = ${projet}::"Projet" AND ${filtres}
    `;
    const ligne = lignes[0];
    return [
      {
        leg: 'INSCRIPTION_TO_SOUMISSION',
        label: 'Inscription vers dossier soumis',
        medianDays: ligne?.n1 ? days(ligne.m1) : null,
        sample: ligne?.n1 ?? 0,
      },
      {
        leg: 'SOUMISSION_TO_DECISION',
        label: 'Dossier soumis vers décision',
        medianDays: ligne?.n2 ? days(ligne.m2) : null,
        sample: ligne?.n2 ?? 0,
      },
    ];
  }

  /**
   * Le téléconseiller qui a OBTENU la méthode d'enrôlement, à défaut celui qui
   * a saisi la fiche : c'est son appel qui a mené le prospect sur la plateforme.
   */
  private async parTeleconseiller(projet: Projet, filtres: Prisma.Sql): Promise<RepartitionDto[]> {
    const lignes = await this.prisma.$queryRaw<
      { id: string; label: string; inscriptions: number }[]
    >`
      SELECT u."id", u."fullName" AS label, COUNT(*)::int AS inscriptions
      FROM "inscriptions_plateforme" i
      INNER JOIN "prospects" p ON p."id" = i."prospectId"
      INNER JOIN "users" u ON u."id" = COALESCE(p."enrollmentCapturedById", p."createdById")
      WHERE i."projet" = ${projet}::"Projet" AND ${filtres}
      GROUP BY 1, 2
      ORDER BY 3 DESC, 2 ASC
    `;
    return lignes;
  }

  private async parCampagne(projet: Projet, filtres: Prisma.Sql): Promise<RepartitionDto[]> {
    const lignes = await this.prisma.$queryRaw<
      { id: string; label: string; inscriptions: number }[]
    >`
      SELECT l."id", l."name" AS label, COUNT(DISTINCT i."id")::int AS inscriptions
      FROM "inscriptions_plateforme" i
      INNER JOIN "lot_export_items" li ON li."prospectId" = i."prospectId"
      INNER JOIN "lots_export" l ON l."id" = li."lotId"
      WHERE i."projet" = ${projet}::"Projet" AND l."projet" = ${projet}::"Projet" AND ${filtres}
      GROUP BY 1, 2
      ORDER BY 3 DESC, 2 ASC
    `;
    return lignes;
  }

  private async parMethode(projet: Projet, filtres: Prisma.Sql): Promise<RepartitionDto[]> {
    const lignes = await this.prisma.$queryRaw<
      { methode: EnrollmentMethod; inscriptions: number }[]
    >`
      SELECT p."enrollmentMethod" AS methode, COUNT(*)::int AS inscriptions
      FROM "inscriptions_plateforme" i
      INNER JOIN "prospects" p ON p."id" = i."prospectId"
      WHERE i."projet" = ${projet}::"Projet" AND p."enrollmentMethod" IS NOT NULL AND ${filtres}
      GROUP BY 1
      ORDER BY 2 DESC
    `;
    return lignes.map((ligne) => ({
      id: ligne.methode,
      label: ENROLLMENT_METHOD_LABELS[ligne.methode],
      inscriptions: ligne.inscriptions,
    }));
  }

  /**
   * Combien de prospects convertis se retrouvent inscrits sur la plateforme.
   * Le dénominateur est le prospect converti, pas l'inscription : la période
   * borne donc la CONVERSION, jamais l'inscription.
   */
  private async conversion(
    projet: Projet,
    _filtres: Prisma.Sql,
  ): Promise<{ convertis: number; inscrits: number }> {
    const lignes = await this.prisma.$queryRaw<{ convertis: number; inscrits: number }[]>`
      SELECT COUNT(*)::int AS convertis,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM "inscriptions_plateforme" i
               WHERE i."prospectId" = p."id"
                 AND i."projet" = ${projet}::"Projet"
                 AND i."disparueLe" IS NULL
             ))::int AS inscrits
      FROM "prospects" p
      WHERE p."projet" = ${projet}::"Projet"
        AND p."deletedAt" IS NULL
        AND p."phase2Status" = 'METHOD_OBTAINED'
    `;
    return lignes[0] ?? { convertis: 0, inscrits: 0 };
  }
}

/** Une inscription disparue de la plateforme ne compte plus dans aucun chiffre. */
function conditions(periode: PeriodeIndicateurs): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`i."disparueLe" IS NULL`];
  if (periode.dateFrom !== undefined) {
    clauses.push(Prisma.sql`i."inscriteLe" >= ${inclusiveDateFrom(periode.dateFrom)}`);
  }
  if (periode.dateTo !== undefined) {
    clauses.push(Prisma.sql`i."inscriteLe" <= ${inclusiveDateTo(periode.dateTo)}`);
  }
  return Prisma.join(clauses, ' AND ');
}

/** Médiane et non moyenne : un dossier oublié six mois déplacerait la moyenne de plusieurs semaines. */
const utilisable = (de: Prisma.Sql, a: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`${de} IS NOT NULL AND ${a} IS NOT NULL AND ${a} >= ${de}`;

const median = (de: Prisma.Sql, a: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (${a} - ${de})) / 86400.0
  ) FILTER (WHERE ${utilisable(de, a)})::float8`;

const echantillon = (de: Prisma.Sql, a: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`COUNT(*) FILTER (WHERE ${utilisable(de, a)})::int`;
