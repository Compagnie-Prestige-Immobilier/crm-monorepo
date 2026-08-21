import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode, Projet, ProspectType } from '@crm/database';
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
import {
  DUREE_SYSTEME_MAX_MOIS,
  GRAND_PUBLIC_IMPORT_COLUMNS,
  GRAND_PUBLIC_IMPORT_HEADERS,
  GRAND_PUBLIC_MAX_ROWS,
  GRAND_PUBLIC_SHEET_LAYOUT,
  NON_TOKENS,
  OUI_TOKENS,
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
  DOUBLON_DANS_LE_FICHIER: 'PROSPECT_GP_IMPORT_DOUBLON_DANS_LE_FICHIER',
  DEJA_EN_BASE: 'PROSPECT_GP_IMPORT_DEJA_EN_BASE',
  NON_PREPARE: 'PROSPECT_GP_IMPORT_NON_PREPARE',
} as const;

const PROFESSION_MAX = 120;
const MAX_TRACKED_RUNS = 8;
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
}

interface Referentiels {
  readonly banques: ReadonlyMap<string, string>;
  readonly banqueLabels: readonly string[];
  readonly syndicats: ReadonlyMap<string, string>;
  readonly syndicatLabels: readonly string[];
  readonly canaux: ReadonlyMap<string, string>;
  readonly canalLabels: readonly string[];
}

interface RunState {
  readonly seen: Map<string, number>;
}

/**
 * Import massif de prospects Grand Public.
 *
 * Le Grand Public ne passe par aucun représentant et ne relève d'aucun
 * syndicat : SEULS le nom et le téléphone sont exigés. Toute autre cellule
 * vide est une information qu'on n'a pas encore, jamais un refus.
 */
@Injectable()
export class ProspectsGrandPublicImportAdapter implements ImportAdapter<GrandPublicImportRow> {
  readonly kind = ImportKind.PROSPECTS_GRAND_PUBLIC;
  readonly maxRows = GRAND_PUBLIC_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = GRAND_PUBLIC_IMPORT_COLUMNS;
  readonly layout = GRAND_PUBLIC_SHEET_LAYOUT;

  private referentiels: Referentiels | null = null;
  private readonly runs = new Map<string, RunState>();

  async prepare(ctx: ImportRunContext): Promise<void> {
    const [banques, syndicats, canaux] = await Promise.all([
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

    this.referentiels = {
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

    this.runs.set(ctx.jobId, { seen: new Map() });
    while (this.runs.size > MAX_TRACKED_RUNS) {
      const oldest = this.runs.keys().next();
      if (oldest.done === true) break;
      this.runs.delete(oldest.value);
    }
  }

  parseRow(cells: Record<string, string>, rowNumber: number): ParsedRow<GrandPublicImportRow> {
    const refs = this.referentiels;
    if (refs === null) {
      throw new Error(`${GrandPublicImportError.NON_PREPARE}: parseRow appelée avant prepare.`);
    }

    const refuse = (
      column: string,
      code: string,
      message: string,
    ): ParsedRow<GrandPublicImportRow> => ({
      ok: false,
      error: { rowNumber, column, code, message },
    });

    const nom = (cells[H.nom] ?? '').trim();
    if (nom === '') {
      return refuse(
        H.nom,
        GrandPublicImportError.NOM_ABSENT,
        'Le nom de famille est obligatoire, dans sa propre colonne.',
      );
    }

    const rawPhone = (cells[H.phone] ?? '').trim();
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

    const rawBanque = (cells[H.banque] ?? '').trim();
    const banqueId =
      rawBanque === '' ? null : (refs.banques.get(referentialKey(rawBanque)) ?? null);
    if (rawBanque !== '' && banqueId === null) {
      return refuse(
        H.banque,
        GrandPublicImportError.BANQUE_INCONNUE,
        `Banque inconnue : « ${rawBanque} ». Valeurs admises : ${listValues(refs.banqueLabels)}, ou cellule vide.`,
      );
    }

    const rawSyndicat = (cells[H.syndicat] ?? '').trim();
    const syndicatId =
      rawSyndicat === '' ? null : (refs.syndicats.get(referentialKey(rawSyndicat)) ?? null);
    if (rawSyndicat !== '' && syndicatId === null) {
      return refuse(
        H.syndicat,
        GrandPublicImportError.SYNDICAT_INCONNU,
        `Syndicat inconnu : « ${rawSyndicat} ». Valeurs admises : ${listValues(refs.syndicatLabels)}, ou cellule vide.`,
      );
    }

    const rawCanal = (cells[H.canal] ?? '').trim();
    const canalProvenanceId =
      rawCanal === '' ? null : (refs.canaux.get(normalizeKey(rawCanal)) ?? null);
    if (rawCanal !== '' && canalProvenanceId === null) {
      return refuse(
        H.canal,
        GrandPublicImportError.CANAL_INCONNU,
        `Canal de provenance inconnu : « ${rawCanal} ». Valeurs admises : ${listValues(refs.canalLabels)}, ou cellule vide.`,
      );
    }

    const rawFonctionnaire = (cells[H.fonctionnaire] ?? '').trim();
    const fonctionnaire = readFonctionnaire(rawFonctionnaire);
    if (fonctionnaire === 'illisible') {
      return refuse(
        H.fonctionnaire,
        GrandPublicImportError.FONCTIONNAIRE_ILLISIBLE,
        `« ${rawFonctionnaire} » ne se lit ni comme oui ni comme non. Écrivez ${listValues(OUI_TOKENS)} ou ${listValues(NON_TOKENS)}, ou laissez vide.`,
      );
    }

    const rawDuree = (cells[H.dureeSysteme] ?? '').trim();
    const dureeSystemeMois = readDureeMois(rawDuree);
    if (rawDuree !== '' && dureeSystemeMois === null) {
      return refuse(
        H.dureeSysteme,
        GrandPublicImportError.DUREE_ILLISIBLE,
        `« ${rawDuree} » n’est pas un nombre entier de mois entre 1 et ${String(DUREE_SYSTEME_MAX_MOIS)}. Écrivez 24, ou laissez vide.`,
      );
    }

    const profession = (cells[H.profession] ?? '').trim();

    return {
      ok: true,
      row: {
        rowNumber,
        nom,
        prenom: (cells[H.prenom] ?? '').trim(),
        phoneE164,
        profession: profession === '' ? null : profession.slice(0, PROFESSION_MAX),
        syndicatId,
        banqueId,
        // « Non » dit ce que la personne n'est PAS : il ne choisit pas entre
        // secteur privé, informel et diaspora, donc le type reste vide.
        type: fonctionnaire === 'oui' ? ProspectType.FONCTIONNAIRE : null,
        dureeSystemeMois,
        canalProvenanceId,
      },
    };
  }

  async writeChunk(
    rows: readonly GrandPublicImportRow[],
    ctx: ImportRunContext,
  ): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, skipped: 0, errors: [] };

    const state = this.runs.get(ctx.jobId) ?? { seen: new Map<string, number>() };
    this.runs.set(ctx.jobId, state);

    const errors: ImportRowError[] = [];
    const unique: GrandPublicImportRow[] = [];

    for (const row of rows) {
      const firstSeen = state.seen.get(row.phoneE164);
      if (firstSeen !== undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          column: H.phone,
          code: GrandPublicImportError.DOUBLON_DANS_LE_FICHIER,
          message: `Ce numéro figure déjà à la ligne ${String(firstSeen)} du fichier.`,
        });
        continue;
      }
      state.seen.set(row.phoneE164, row.rowNumber);
      unique.push(row);
    }

    const existing = await this.existingProspects(
      unique.map((row) => row.phoneE164),
      ctx,
    );

    const retained: GrandPublicImportRow[] = [];
    for (const row of unique) {
      const projet = existing.get(row.phoneE164);
      if (projet === undefined) {
        retained.push(row);
        continue;
      }
      errors.push({
        rowNumber: row.rowNumber,
        column: H.phone,
        code: GrandPublicImportError.DEJA_EN_BASE,
        message:
          projet === Projet.GRAND_PUBLIC
            ? 'Ce prospect Grand Public existe déjà en base.'
            : 'Ce numéro appartient déjà à une fiche CHUES. Le projet d’une fiche ne se change pas par un import.',
      });
    }

    if (ctx.mode === ImportMode.DRY_RUN) {
      return { created: retained.length, skipped: 0, errors };
    }

    const now = new Date();
    const written = await ctx.tx.prospect.createMany({
      data: retained.map((row) => ({
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
        createdById: ctx.requestedById,
        clientCreatedAt: now,
      })),
      // L'index unique partiel double le contrôle : une ligne prise pendant
      // l'import est écartée, et l'écart est COMPTÉ dans `skipped`.
      skipDuplicates: true,
    });

    return { created: written.count, skipped: retained.length - written.count, errors };
  }

  private async existingProspects(
    phones: readonly string[],
    ctx: ImportRunContext,
  ): Promise<Map<string, Projet>> {
    const found = new Map<string, Projet>();

    for (let start = 0; start < phones.length; start += EXISTING_LOOKUP_CHUNK) {
      const rows = await ctx.tx.prospect.findMany({
        where: {
          phoneE164: { in: phones.slice(start, start + EXISTING_LOOKUP_CHUNK) },
          deletedAt: null,
        },
        select: { phoneE164: true, projet: true },
      });
      for (const row of rows) found.set(row.phoneE164, row.projet);
    }

    return found;
  }
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
