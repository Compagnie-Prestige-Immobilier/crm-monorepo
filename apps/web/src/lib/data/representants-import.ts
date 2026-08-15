import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
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
 * L'envoi passe par le client engendré et donc par le relais `/api/v1/*` de
 * Next : le jeton vit dans un cookie `httpOnly`, hors de portée du JavaScript de
 * la page. Le relais recopie `content-type` (frontière multipart comprise) et le
 * corps tel quel.
 */

type Schemas = components['schemas'];

export type ImportReport = Schemas['ImportReportDto'];
export type ImportRowError = Schemas['ImportRowErrorDto'];
export type ImportRowPreview = Schemas['ImportRowPreviewDto'];

/**
 * Le seul appel du panel qui envoie du MULTIPART.
 *
 * `bodySerializer` rend le `FormData` tel quel, et c'est indispensable :
 * `openapi-fetch` sérialise en JSON par défaut, ce qui transformerait le
 * classeur en `{}`. Rendre le `FormData` sans le toucher laisse aussi le
 * navigateur poser lui-même l'en-tête `content-type` AVEC sa frontière ; une
 * frontière écrite à la main serait fausse une fois sur deux.
 */
export async function importRepresentants(
  file: File,
  dryRun: boolean,
  client: ApiClient = getApiClient(),
): Promise<ImportReport> {
  const form = new FormData();
  form.append('file', file);

  return unwrap(
    await client.POST('/api/v1/representants/import', {
      params: { query: { dryRun } },
      body: { file: '' },
      bodySerializer: () => form,
    }),
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
 * sélectionne, pas la page affichée.
 *
 * LE TRI EST RETIRÉ AUSSI, et ce n'est pas un choix de confort. La route
 * d'export lie `RepresentantExportQueryDto`, qui ne déclare QUE les filtres :
 * le service parcourt la table en pagination par clé sur `id`, si bien qu'un
 * `sortBy` n'y serait de toute façon pas honoré. Or la validation globale
 * tourne en `forbidNonWhitelisted` : un paramètre non déclaré ne serait pas
 * ignoré, il ferait échouer l'export en 400. Les laisser passer cassait donc
 * le téléchargement dès que l'utilisateur touchait au tri du tableau, et le
 * tri par défaut masquait la panne le reste du temps.
 *
 * Les deux exports voisins retirent déjà `sortBy` et `sortDir` pour la même
 * raison, voir `lib/data/export.ts`.
 */
export function buildRepresentantsExportUrl(filters: RepresentantFilters): string {
  const query = toRepresentantQuery(filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'pageSize' || key === 'sortBy' || key === 'sortOrder') continue;
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
