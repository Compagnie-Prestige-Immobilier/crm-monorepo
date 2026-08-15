import type { components } from '@crm/api-client';

import {
  apiUpload,
  asArray,
  asBoolean,
  asNullableString,
  asNumber,
  asRecord,
  asString,
} from '@/lib/api/raw';
import { toRepresentantQuery } from '@/lib/data/representants';
import type { RepresentantFilters } from '@/lib/representant-filters';

/**
 * Import de masse des représentants, en DEUX TEMPS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * La simulation n'est pas une précaution décorative.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un classeur de quatre mille lignes appliqué d'un bloc, c'est quatre mille
 * fiches dont personne ne sait lesquelles sont bonnes, et une déduplication par
 * téléphone qui rattache silencieusement des prospects à la mauvaise personne.
 * Le premier appel (`dryRun`) n'écrit rien et rend un rapport ligne à ligne ;
 * le second applique, en une seule transaction, tout ou rien.
 *
 * L'envoi passe par `apiUpload` et donc par le relais `/api/v1/*` de Next : le
 * jeton vit dans un cookie `httpOnly`, hors de portée du JavaScript de la page.
 * Le relais recopie `content-type` (frontière multipart comprise) et le corps
 * tel quel.
 */

type Schemas = components['schemas'];

export type ImportReport = Schemas['ImportReportDto'];
export type ImportRowError = Schemas['ImportRowErrorDto'];
export type ImportRowPreview = Schemas['ImportRowPreviewDto'];

/**
 * Le rapport est VALIDÉ à l'entrée, comme tout ce qui passe par `raw.ts`.
 *
 * C'est le seul écran du panel où un chiffre décide d'une écriture de masse :
 * un « 0 erreur » venu d'une réponse dont la forme a changé ferait appliquer
 * l'import les yeux fermés.
 */
function parseImportReport(value: unknown): ImportReport {
  const body = asRecord(value, 'Le rapport d’import');

  return {
    dryRun: asBoolean(body.dryRun, 'dryRun'),
    totalRows: asNumber(body.totalRows, 'totalRows'),
    valid: asNumber(body.valid, 'valid'),
    rejected: asNumber(body.rejected, 'rejected'),
    duplicates: asNumber(body.duplicates, 'duplicates'),
    created: asNumber(body.created, 'created'),
    errors: asArray(body.errors, 'errors').map((entry, index) => {
      const row = asRecord(entry, `errors[${String(index)}]`);
      return {
        line: asNumber(row.line, 'line'),
        code: asString(row.code, 'code'),
        message: asString(row.message, 'message'),
        value: asNullableString(row.value, 'value'),
      };
    }),
    preview: asArray(body.preview, 'preview').map((entry, index) => {
      const row = asRecord(entry, `preview[${String(index)}]`);
      return {
        line: asNumber(row.line, 'line'),
        fullName: asString(row.fullName, 'fullName'),
        phoneE164: asString(row.phoneE164, 'phoneE164'),
        departementName: asString(row.departementName, 'departementName'),
        iefName: asNullableString(row.iefName, 'iefName'),
        notes: asNullableString(row.notes, 'notes'),
      };
    }),
  };
}

export async function importRepresentants(file: File, dryRun: boolean): Promise<ImportReport> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload(
    `/representants/import?dryRun=${dryRun ? 'true' : 'false'}`,
    form,
    parseImportReport,
  );
}

// ─── Modèle et export ───────────────────────────────────────────────────────

/**
 * Les deux classeurs passent par le relais `/api/v1/*` et non par
 * `/api/export/*` : ce dernier existe pour les exports qui ont besoin d'un
 * `Content-Disposition` daté fabriqué côté Next et d'un contrôle de rôle
 * explicite. Ici l'API pose déjà les deux, et `useFileDownload` vérifie le
 * statut avant d'enregistrer quoi que ce soit.
 */
export const REPRESENTANTS_TEMPLATE_URL = '/api/v1/export/representants-modele.xlsx';

export const REPRESENTANTS_TEMPLATE_FILE_NAME = 'cpi-representants-modele.xlsx';

/**
 * L'export part des MÊMES critères que l'écran, par le MÊME constructeur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi `toRepresentantQuery` et non le sérialiseur d'URL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cette fonction empruntait `serializeRepresentantFilters`, qui écrit le
 * vocabulaire du NAVIGATEUR : `hasProspects=oui|non` et des dates sans heure.
 * L'API, elle, attend un booléen et des bornes horodatées. Deux conséquences,
 * toutes deux muettes, sur un fichier qui part ensuite par courriel :
 *
 *  - « aucun prospect » (`non`) était coercé en `true` côté API : le classeur
 *    contenait exactement la population inverse de celle affichée ;
 *  - `dateTo=2026-04-30` était lu comme minuit pile, donc le 30 avril entier
 *    manquait au fichier alors qu'il était à l'écran.
 *
 * Le bloc en tête de section promet « exactement ce que vous aviez sous les
 * yeux ». Un seul constructeur de requête est la seule façon de le tenir.
 *
 * La pagination est retirée : un export contient tout ce que le filtre
 * sélectionne, pas la page affichée. Le TRI est conservé : il ne restreint
 * aucune population, et l'ordre des lignes du classeur doit être celui du
 * tableau.
 */
export function buildRepresentantsExportUrl(filters: RepresentantFilters): string {
  const query = toRepresentantQuery(filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'pageSize') continue;
    params.set(key, String(value));
  }
  const rendered = params.toString();
  return rendered === ''
    ? '/api/v1/export/representants.xlsx'
    : `/api/v1/export/representants.xlsx?${rendered}`;
}

/** Nom de fichier daté, pour ne pas empiler dix `representants.xlsx`. */
export function representantsExportFileName(now = new Date()): string {
  return `cpi-representants-${now.toISOString().slice(0, 10)}.xlsx`;
}
