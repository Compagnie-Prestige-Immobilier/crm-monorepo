import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode } from '@crm/database';
import type { RepCallOutcome, RepresentantRelation, WhatsappStatus } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { tryNormalizePhone } from '../../common/phone.js';
import { IMPORT_COLUMNS } from '../representants/import-template.js';
import {
  normalizeKey,
  parseComplements,
  type Complements,
} from '../representants/import-fields.js';
import { chunkOf } from './imports.job.js';
import type {
  ChunkOutcome,
  ImportAdapter,
  ImportColumn,
  ImportRowError,
  ImportRunContext,
  ParsedRow,
  PrismaTransactionClient,
} from './import-adapter.js';

/**
 * L'import de masse des représentants, porté sur le moteur d'arrière-plan.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EST REPRIS À L'IDENTIQUE, ET POURQUOI IL NE FALLAIT RIEN Y TOUCHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'analyse d'une ligne, la normalisation E.164, le rapprochement des
 * référentiels sur une clé sans accent ni casse, et les TROIS FAMILLES DE
 * DOUBLONS de `representants-import.service.ts` sont justes. Elles ont été
 * éprouvées sur des classeurs réels, et chacune corrige un défaut nommé dans
 * l'en-tête de ce service. Ce chantier déplace l'EXÉCUTION, il ne rejuge pas la
 * règle.
 *
 * Rappel des trois familles, toutes sur le téléphone NORMALISÉ :
 *
 * 1. le fichier contre LUI-MÊME : deux lignes du même classeur, souvent avec
 *    deux orthographes du même nom. Détectée ici, à travers les tranches ;
 * 2. le fichier contre la BASE : la fiche existe déjà, saisie en tournée.
 *    Détectée par une lecture PAR TRANCHE, jamais par ligne ;
 * 3. la base contre elle-même, qui est impossible : l'index unique partiel
 *    `representants_phone_e164_active_key` l'interdit.
 *
 * « 77 123 45 67 » et « +221771234567 » sont le même abonné. Les compter comme
 * deux personnes est précisément l'erreur que la normalisation existe pour
 * empêcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI CHANGE : LE PLAFOND, ET LE DÉCOUPAGE DE L'ÉCRITURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le plafond passe de 5 000 à 50 000 lignes. Il ne tenait pas à une règle
 * métier mais à la lecture : `xlsx.load()` déployait le classeur entier en
 * mémoire, et le conteneur mourait avant que le contrôle du plafond ne
 * s'exécute. La lecture en flux retire cette contrainte.
 *
 * L'écriture, elle, n'est plus « tout ou rien ». C'était la promesse de
 * l'import synchrone, et elle ne survit pas à cinquante mille lignes : une
 * transaction unique de cette taille tient un verrou pendant des minutes et
 * perd la totalité du travail sur la dernière ligne. Le moteur écrit par
 * tranches de cinq cents, une transaction par tranche, et `processedRows`
 * avance DANS la même transaction — un import interrompu reprend donc
 * exactement où il s'est arrêté, sans rien recréer. C'est une garantie plus
 * forte en pratique que « tout ou rien », qui obligeait à tout recommencer.
 */

/** Le plafond, et il appartient à l'entité, pas au moteur. */
const REPRESENTANTS_MAX_ROWS = 50_000;

/** Une ligne de représentant prête à écrire. */
export interface RepresentantImportRow {
  readonly rowNumber: number;
  readonly fullName: string;
  readonly phoneE164: string;
  readonly departementId: string;
  readonly iefId: string | null;
  readonly notes: string | null;
  readonly etablissement: string | null;
  readonly relationStatus: RepresentantRelation;
  readonly whatsappStatus: WhatsappStatus;
  /** Le compte propriétaire de la fiche. `null` : celui qui a demandé l'import. */
  readonly ownerId: string | null;
  /** L'appel déjà passé, quand le fichier le date. */
  readonly appel: {
    readonly date: Date;
    readonly outcome: RepCallOutcome;
    readonly comment: string | null;
  } | null;
}

interface ReferentielRow {
  readonly id: string;
  readonly name: string;
}

interface IefRow extends ReferentielRow {
  readonly departementId: string;
}

/**
 * L'état d'UNE course, celui qui ne peut pas vivre sur l'instance.
 *
 * Référentiels et téléphones déjà vus appartiennent au fichier en cours de
 * lecture, pas à l'adaptateur, qui est un singleton. `prepare` les rend, le
 * moteur les repasse aux deux autres méthodes, et deux imports simultanés ne
 * peuvent plus se marcher dessus.
 */
export interface RepresentantImportRun {
  readonly seen: Map<string, number>;
  readonly departements: ReadonlyMap<string, ReferentielRow>;
  readonly iefs: ReadonlyMap<string, IefRow>;
  readonly users: ReadonlyMap<string, { readonly id: string }>;
}

/** Numéros interrogés en une fois lors du contrôle contre la base. */
const PHONE_LOOKUP_CHUNK = 1_000;

/**
 * La cellule d'une colonne, DÉSIGNÉE PAR SA POSITION dans le modèle.
 *
 * La clé lisible vient de `IMPORT_COLUMNS`, jamais de la ligne d'en-tête du
 * fichier : c'est la règle de `import-template.ts`, et elle tient à un fait
 * d'usage — un utilisateur renomme une colonne bien plus souvent qu'il n'en
 * déplace une.
 */
const cellAt = (cells: Record<string, string>, index: number): string => {
  const header = IMPORT_COLUMNS[index]?.header;
  return header === undefined ? '' : (cells[header] ?? '');
};

const columnAt = (index: number, fallback: string): string =>
  IMPORT_COLUMNS[index]?.header ?? fallback;

type Resolved<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ImportRowError };

function resolveFullName(fullName: string, rowNumber: number): Resolved<string> {
  if (fullName.length < 2) {
    return {
      ok: false,
      error: {
        rowNumber,
        column: columnAt(0, 'Nom complet'),
        code: 'NAME_INVALID',
        message: 'Le nom complet est obligatoire (2 caractères au minimum).',
      },
    };
  }
  return { ok: true, value: fullName };
}

function resolvePhone(phone: string, rowNumber: number): Resolved<string> {
  const phoneE164 = tryNormalizePhone(phone);
  if (!phoneE164) {
    return {
      ok: false,
      error: {
        rowNumber,
        column: columnAt(1, 'Téléphone'),
        code: 'PHONE_INVALID',
        message: 'Numéro de téléphone inexploitable.',
      },
    };
  }
  return { ok: true, value: phoneE164 };
}

function resolveDepartement(
  departement: string,
  rowNumber: number,
  refs: RepresentantImportRun,
): Resolved<ReferentielRow> {
  const departementRow = refs.departements.get(normalizeKey(departement));
  if (!departementRow) {
    return {
      ok: false,
      error: {
        rowNumber,
        column: columnAt(2, 'Département'),
        code: 'DEPARTEMENT_UNKNOWN',
        message: 'Département inconnu. Reprenez exactement un libellé de la liste déroulante.',
      },
    };
  }
  return { ok: true, value: departementRow };
}

/** Le département se DÉDUIT de l'IEF, jamais l'inverse : voir l'en-tête du fichier. */
function resolveIef(
  ief: string,
  departementRow: ReferentielRow,
  rowNumber: number,
  refs: RepresentantImportRun,
): Resolved<IefRow | null> {
  if (!ief) return { ok: true, value: null };

  const iefRow = refs.iefs.get(normalizeKey(ief)) ?? null;
  if (!iefRow) {
    return {
      ok: false,
      error: {
        rowNumber,
        column: columnAt(3, 'IEF'),
        code: 'IEF_UNKNOWN',
        message: 'IEF inconnue. Laissez la cellule vide si elle n’est pas connue.',
      },
    };
  }
  if (iefRow.departementId !== departementRow.id) {
    return {
      ok: false,
      error: {
        rowNumber,
        column: columnAt(3, 'IEF'),
        code: 'IEF_DEPARTEMENT_MISMATCH',
        message: `L’IEF « ${iefRow.name} » n’appartient pas au département « ${departementRow.name} ».`,
      },
    };
  }
  return { ok: true, value: iefRow };
}

function buildRepresentantRow(
  rowNumber: number,
  fullName: string,
  phoneE164: string,
  departementRow: ReferentielRow,
  iefRow: IefRow | null,
  notes: string,
  etablissement: string,
  complements: Complements,
): RepresentantImportRow {
  return {
    rowNumber,
    fullName: fullName.slice(0, 160),
    phoneE164,
    departementId: departementRow.id,
    iefId: iefRow?.id ?? null,
    notes: notes ? notes.slice(0, 2_000) : null,
    etablissement: etablissement ? etablissement.slice(0, 200) : null,
    ...complements,
  };
}

@Injectable()
export class RepresentantsImportAdapter implements ImportAdapter<
  RepresentantImportRow,
  RepresentantImportRun
> {
  readonly kind = ImportKind.REPRESENTANTS;
  readonly maxRows = REPRESENTANTS_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = IMPORT_COLUMNS;

  /**
   * Charge les référentiels et arme l'état de course.
   *
   * Les référentiels sont relus À CHAQUE COURSE et non mis en cache pour la vie
   * du processus : un département activé ce matin doit être accepté par l'import
   * de cet après-midi, sans redéploiement.
   */
  async prepare(ctx: ImportRunContext): Promise<RepresentantImportRun> {
    const [departements, iefs, users] = await Promise.all([
      ctx.tx.departement.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      ctx.tx.ief.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, departementId: true },
      }),
      ctx.tx.user.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, username: true, email: true, fullName: true },
      }),
    ]);

    return {
      // Identifiant, e-mail ET nom complet : le classeur terrain désigne les
      // chargés de compte par leur prénom d'usage, pas par leur identifiant.
      users: new Map(
        users.flatMap((row) => [
          [normalizeKey(row.username), row],
          [normalizeKey(row.email), row],
          [normalizeKey(row.fullName), row],
        ]),
      ),
      // REMISE À ZÉRO à chaque course, et c'est ce qui rend une reprise
      // correcte : un travail repris relit son classeur depuis `processedRows`,
      // et les téléphones vus par le travailleur mort ne sont plus là pour
      // l'aider. Les lignes déjà écrites sont retrouvées par la SECONDE famille
      // (contre la base), qui, elle, ne dépend d'aucune mémoire de course.
      seen: new Map(),
      // Indexés sur la forme NORMALISÉE (sans accent, sans casse) : un fichier
      // rempli à la main écrit « SAINT-LOUIS », « Saint Louis » et « saint
      // louis » pour le même département, et refuser les trois pour un accent
      // rendrait l'import inutilisable.
      departements: new Map(
        departements.flatMap((row) => [
          [normalizeKey(row.name), row],
          [normalizeKey(row.code), row],
        ]),
      ),
      iefs: new Map(
        iefs.flatMap((row) => [
          [normalizeKey(row.name), row],
          [normalizeKey(row.code), row],
        ]),
      ),
    };
  }

  /**
   * Analyse une ligne. Elle ne connaît que ses référentiels, jamais la base.
   *
   * Le rapprochement se fait par POSITION dans le modèle, jamais par le texte de
   * l'en-tête du fichier : un utilisateur renomme une colonne bien plus souvent
   * qu'il n'en déplace une (voir `import-template.ts`).
   */
  parseRow(
    cells: Record<string, string>,
    rowNumber: number,
    refs: RepresentantImportRun,
  ): ParsedRow<RepresentantImportRow> {
    const fullName = cellAt(cells, 0);
    const phone = cellAt(cells, 1);
    const departement = cellAt(cells, 2);
    const ief = cellAt(cells, 3);
    const notes = cellAt(cells, 4);
    const etablissement = cellAt(cells, 5);
    const complements = parseComplements(
      {
        notes,
        relation: cellAt(cells, 6),
        whatsapp: cellAt(cells, 7),
        charge: cellAt(cells, 8),
        dateAppel: cellAt(cells, 9),
        issue: cellAt(cells, 10),
      },
      refs.users,
    );
    if ('code' in complements) {
      const { rang, code, message } = complements;
      return { ok: false, error: { rowNumber, column: columnAt(rang, ''), code, message } };
    }

    const resolvedName = resolveFullName(fullName, rowNumber);
    if (!resolvedName.ok) return resolvedName;

    const resolvedPhone = resolvePhone(phone, rowNumber);
    if (!resolvedPhone.ok) return resolvedPhone;

    const departementRow = resolveDepartement(departement, rowNumber, refs);
    if (!departementRow.ok) return departementRow;

    const iefRow = resolveIef(ief, departementRow.value, rowNumber, refs);
    if (!iefRow.ok) return iefRow;

    return {
      ok: true,
      row: buildRepresentantRow(
        rowNumber,
        resolvedName.value,
        resolvedPhone.value,
        departementRow.value,
        iefRow.value,
        notes,
        etablissement,
        complements,
      ),
    };
  }

  /**
   * Écrit une tranche, DANS la transaction que le moteur lui donne.
   *
   * `created` EN SIMULATION compte les lignes qui SERAIENT créées, et non zéro.
   * C'est la valeur que l'écran attend : le premier temps de l'import répond à
   * « combien de fiches vais-je obtenir », et un rapport qui annoncerait
   * toujours zéro ne répondrait à rien. Le mode figure dans le rapport, il n'y a
   * aucune ambiguïté sur ce que le chiffre désigne.
   */
  async writeChunk(
    rows: readonly RepresentantImportRow[],
    ctx: ImportRunContext,
    run: RepresentantImportRun,
  ): Promise<ChunkOutcome> {
    const deduped = dedupWithinChunk(rows, run.seen);
    const filtered = await filterAgainstDatabase(ctx.tx, deduped.unique);
    const skipped = deduped.skipped + filtered.skipped;
    const errors = [...deduped.errors, ...filtered.errors];

    if (ctx.mode === ImportMode.DRY_RUN) {
      return { created: filtered.retained.length, skipped, errors };
    }
    if (filtered.retained.length === 0) return { created: 0, skipped, errors };

    const persisted = await persistRepresentants(ctx, filtered.retained);
    return {
      created: persisted.created,
      skipped: skipped + persisted.skipped,
      errors: [...errors, ...persisted.errors],
    };
  }
}

/**
 * PREMIÈRE FAMILLE : le fichier contre lui-même. La seconde occurrence est
 * rejetée, jamais la première : c'est celle du haut du fichier que
 * l'utilisateur reconnaît.
 */
function dedupWithinChunk(
  rows: readonly RepresentantImportRow[],
  seen: Map<string, number>,
): { unique: RepresentantImportRow[]; skipped: number; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  let skipped = 0;
  const unique: RepresentantImportRow[] = [];

  for (const row of rows) {
    const previous = seen.get(row.phoneE164);
    if (previous !== undefined) {
      skipped += 1;
      errors.push({
        rowNumber: row.rowNumber,
        column: IMPORT_COLUMNS[1]?.header ?? 'Téléphone',
        code: 'DUPLICATE_IN_FILE',
        message: `Ce numéro figure déjà à la ligne ${String(previous)} du fichier.`,
      });
      continue;
    }
    seen.set(row.phoneE164, row.rowNumber);
    unique.push(row);
  }

  return { unique, skipped, errors };
}

/** SECONDE FAMILLE : le fichier contre la base, par tranche de numéros. */
async function filterAgainstDatabase(
  tx: PrismaTransactionClient,
  unique: readonly RepresentantImportRow[],
): Promise<{ retained: RepresentantImportRow[]; skipped: number; errors: ImportRowError[] }> {
  const known = new Set<string>();
  for (const slice of chunkOf(
    unique.map((row) => row.phoneE164),
    PHONE_LOOKUP_CHUNK,
  )) {
    const found = await tx.representant.findMany({
      where: { phoneE164: { in: slice }, deletedAt: null },
      select: { phoneE164: true },
    });
    for (const row of found) known.add(row.phoneE164);
  }

  const errors: ImportRowError[] = [];
  let skipped = 0;
  const retained: RepresentantImportRow[] = [];
  for (const row of unique) {
    if (known.has(row.phoneE164)) {
      skipped += 1;
      errors.push({
        rowNumber: row.rowNumber,
        column: IMPORT_COLUMNS[1]?.header ?? 'Téléphone',
        code: 'DUPLICATE_IN_DATABASE',
        message: 'Un représentant porte déjà ce numéro en base.',
      });
      continue;
    }
    retained.push(row);
  }

  return { retained, skipped, errors };
}

async function persistRepresentants(
  ctx: ImportRunContext,
  retained: readonly RepresentantImportRow[],
): Promise<{ created: number; skipped: number; errors: ImportRowError[] }> {
  const now = new Date();
  // UUID v7 engendrés AVANT l'écriture : les appels déjà passés s'y rattachent
  // par clé étrangère, et il faut donc les connaître. L'import n'a pas de
  // client hors ligne, mais l'identifiant doit rester du même format que ceux
  // du mobile, sinon l'ordre lexicographique cesse d'être l'ordre temporel.
  const avecId = retained.map((row) => ({ row, id: uuidv7() }));

  const written = await ctx.tx.representant.createMany({
    data: avecId.map(({ row, id }) => ({
      id,
      fullName: row.fullName,
      phoneE164: row.phoneE164,
      departementId: row.departementId,
      iefId: row.iefId,
      notes: row.notes,
      etablissement: row.etablissement,
      relationStatus: row.relationStatus,
      whatsappStatus: row.whatsappStatus,
      createdById: row.ownerId ?? ctx.requestedById,
      // La saisie terrain est inconnue pour un import : on retient l'instant
      // de l'écriture, jamais une date inventée. Les statistiques d'activité
      // s'appuient dessus, une valeur fabriquée les fausserait.
      clientCreatedAt: now,
    })),
    // L'index partiel double la contrainte : une ligne qui s'y heurterait
    // malgré nos contrôles est ignorée plutôt que de faire échouer les 499
    // autres. L'ÉCART EST DIT, il n'est pas avalé, voir juste en dessous.
    skipDuplicates: true,
  });

  await writeRepresentantCallAttempts(ctx, avecId);

  if (written.count >= retained.length) {
    return { created: written.count, skipped: 0, errors: [] };
  }

  // Entre la lecture des téléphones connus et l'écriture, un commercial a pu
  // saisir la même fiche sur le terrain. La ligne disparaîtrait alors sans un
  // mot, et le rapport annoncerait plus de créations qu'il n'y a de fiches.
  const perdues = retained.length - written.count;
  return {
    created: written.count,
    skipped: perdues,
    errors: [
      {
        rowNumber: retained[0]?.rowNumber ?? 0,
        code: 'SKIPPED_ON_WRITE',
        message: `${String(perdues)} ligne(s) retenue(s) n’ont pas été écrites : leur numéro a été pris par une autre saisie pendant l’import.`,
      },
    ],
  };
}

/**
 * Les appels ne se rattachent qu'aux fiches RÉELLEMENT écrites : une ligne
 * écartée par `skipDuplicates` laisserait un appel pointant sur un identifiant
 * absent, et la clé étrangère ferait échouer toute la tranche.
 */
async function writeRepresentantCallAttempts(
  ctx: ImportRunContext,
  avecId: readonly { row: RepresentantImportRow; id: string }[],
): Promise<void> {
  const appels = avecId.flatMap(({ row, id }) =>
    row.appel === null
      ? []
      : [{ id, appel: row.appel, performedById: row.ownerId ?? ctx.requestedById }],
  );
  if (appels.length === 0) return;

  const presentes = new Set(
    (
      await ctx.tx.representant.findMany({
        where: { id: { in: appels.map(({ id }) => id) } },
        select: { id: true },
      })
    ).map((found) => found.id),
  );
  await ctx.tx.repCallAttempt.createMany({
    data: appels
      .filter(({ id }) => presentes.has(id))
      .map(({ id, appel, performedById }) => ({
        id: uuidv7(),
        representantId: id,
        performedById,
        outcome: appel.outcome,
        comment: appel.comment,
        clientCreatedAt: appel.date,
      })),
  });
}
