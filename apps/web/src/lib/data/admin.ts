import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Role } from '@/lib/types';

/**
 * Purge de la base et supervision des comptes : `GET|POST /admin/purge`,
 * `GET /admin/supervision`. Premier administrateur et ADMIN, respectivement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Les formes viennent du CONTRAT, plus d'une liste tenue à la main.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce module redéclarait `PurgeDomainKey` en douze clés et refusait tout ce qui
 * n'y figurait pas (« domaine inconnu »). Le contrat en compte QUATORZE : les
 * campagnes représentants et les demandes clients s'y sont ajoutées. L'écran de
 * purge tombait donc entièrement sur un catalogue parfaitement valide, et
 * l'administrateur voyait un écran d'erreur là où il fallait décocher deux
 * cases. C'est exactement ce que produit une déclaration parallèle d'un contrat
 * déjà typé : elle ne protège de rien et elle dérive.
 *
 * Toute la logique de DÉCISION reste ici, en fonctions pures, pour qu'elle soit
 * éprouvable sans navigateur. Les écrans ne font que la rendre.
 */
type Schemas = components['schemas'];

// ─── Purge ───────────────────────────────────────────────────────────────────

export type PurgeDomainKey = Schemas['PurgeDomainKey'];
export type PurgeDomain = Schemas['PurgeDomainDto'];
export type PurgeCatalog = Schemas['PurgeCatalogDto'];
export type PurgeResult = Schemas['PurgeResultDto'];

export async function fetchPurgeCatalog(client: ApiClient = getApiClient()): Promise<PurgeCatalog> {
  return unwrap(await client.GET('/api/v1/admin/purge'));
}

export async function runPurge(
  input: Schemas['PurgeRequestDto'],
  client: ApiClient = getApiClient(),
): Promise<PurgeResult> {
  return unwrap(await client.POST('/api/v1/admin/purge', { body: input }));
}

// ─── Sélection ───────────────────────────────────────────────────────────────

/**
 * Ferme une sélection sur ses dépendances, transitivement.
 *
 * L'écran affiche cette fermeture AVANT la validation. Une case qui s'allume
 * toute seule au moment de la suppression se vit comme une dérive, et à raison :
 * l'administrateur croit retirer les représentants et découvre, après coup,
 * qu'il a aussi perdu les dossiers bancaires.
 *
 * Le serveur refait le même calcul de son côté. Ce n'est pas une redondance
 * inutile : ici c'est de l'affichage, là-bas c'est la garantie.
 *
 * L'ensemble intermédiaire est un `Set<string>` et non un `Set<PurgeDomainKey>` :
 * le contrat déclare `requires` en `string[]`, et le forcer au type énuméré
 * mentirait au compilateur sur une valeur venue du réseau. La liste RENDUE, elle,
 * est filtrée depuis le catalogue, donc typée sans conversion.
 */
export function expandSelection(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): PurgeDomainKey[] {
  const byKey = new Map<string, PurgeDomain>(domains.map((domain) => [domain.key, domain]));
  const resolved = new Set<string>();
  const pending: string[] = [...selected];

  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || resolved.has(key)) continue;
    resolved.add(key);
    pending.push(...(byKey.get(key)?.requires ?? []));
  }

  // Trié dans l'ordre du catalogue : deux sélections équivalentes doivent
  // produire le même récapitulatif, quel que soit l'ordre des clics.
  return domains.map((domain) => domain.key).filter((key) => resolved.has(key));
}

/** Domaines entraînés par la sélection sans avoir été cochés. */
export function impliedDomains(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): PurgeDomainKey[] {
  const chosen = new Set<string>(selected);
  return expandSelection(selected, domains).filter((key) => !chosen.has(key));
}

/** Lignes que la sélection étendue emporterait aujourd'hui. */
export function selectionRows(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): number {
  const expanded = new Set<string>(expandSelection(selected, domains));
  return domains
    .filter((domain) => expanded.has(domain.key))
    .reduce((sum, domain) => sum + domain.rows, 0);
}

/**
 * La purge peut-elle partir ?
 *
 * QUATRE conditions, et aucune n'est superflue :
 *  - le compte est le premier administrateur ;
 *  - au moins un domaine est coché ;
 *  - l'identifiant a été ressaisi à l'identique ;
 *  - aucun appel n'est déjà en cours : sans quoi un double-clic envoie deux
 *    purges, et la seconde échoue bruyamment au moment où la première réussit.
 */
export function canSubmitPurge(input: {
  catalog: PurgeCatalog;
  selected: readonly PurgeDomainKey[];
  confirmation: string;
  pending: boolean;
}): boolean {
  if (input.pending) return false;
  if (!input.catalog.allowed) return false;
  if (input.selected.length === 0) return false;
  return matchesHint(input.confirmation, input.catalog.confirmationHint);
}

/**
 * Comparaison de la ressaisie. Insensible à la casse et aux espaces de bord,
 * comme la connexion : c'est le GESTE de ressaisie qui porte la confirmation,
 * pas sa mise en forme. Le serveur applique exactement la même règle.
 */
export function matchesHint(typed: string, hint: string): boolean {
  const normalized = typed.trim().toLocaleLowerCase();
  if (normalized === '') return false;
  return normalized === hint.trim().toLocaleLowerCase();
}

// ─── Supervision ─────────────────────────────────────────────────────────────

export type PresenceState = Schemas['PresenceState'];
export type SupervisedUser = Schemas['SupervisedUserDto'];
export type Supervision = Schemas['SupervisionDto'];

export async function fetchSupervision(client: ApiClient = getApiClient()): Promise<Supervision> {
  return unwrap(await client.GET('/api/v1/admin/supervision'));
}

const PRESENCE_STATES = ['ONLINE', 'RECENT', 'AWAY'] as const satisfies readonly PresenceState[];

/**
 * Les rôles du CONTRAT, et non un tableau de chaînes.
 *
 * `readonly string[]` acceptait n'importe quoi : la liste pouvait dériver du
 * contrat sans que rien ne le signale. Typée `readonly Role[]`, elle est
 * vérifiée par le compilateur, et `ROLE_LABELS` casse déjà le build si un rôle
 * est ajouté sans libellé.
 */
const ROLES = ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE'] as const satisfies readonly Role[];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Une valeur inconnue DÉGRADE la ligne ; elle ne fait pas tomber l'écran.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces deux replis sont appliqués À L'AFFICHAGE, dans `supervision-view.tsx`, et
 * non plus dans un validateur d'entrée. Le déplacement change le mode de panne
 * mais garde la protection, et c'est le point : le typage engendré décrit ce que
 * l'API PROMET, il ne contraint rien au moment de l'exécution. Un rôle livré
 * côté API avant que le panel ne soit redéployé arrive donc bel et bien dans la
 * page, où `Record<PresenceState, …>` rendrait `undefined` et casserait le rendu
 * de la ligne.
 *
 * On replie sur une valeur sûre plutôt que de perdre la page :
 *  - une présence inconnue vaut `AWAY`, l'état le moins affirmatif : dire
 *    « inactif » de quelqu'un qui est peut-être connecté induit moins en erreur
 *    que l'inverse ;
 *  - un rôle inconnu vaut `COMMERCIAL`, le rôle par défaut du terrain. La ligne
 *    reste listée, nommée, avec sa dernière activité : c'est cette information
 *    que l'écran doit rendre, pas la taxonomie des rôles.
 */
export function knownRole(value: string): Role {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : 'COMMERCIAL';
}

export function knownPresence(value: string): PresenceState {
  return (PRESENCE_STATES as readonly string[]).includes(value) ? (value as PresenceState) : 'AWAY';
}

/** Libellés d'état. Un état se nomme, il ne se raconte pas. */
export const PRESENCE_LABELS: Record<PresenceState, string> = {
  ONLINE: 'Connecté',
  RECENT: 'Récent',
  AWAY: 'Inactif',
};

/**
 * Écart en minutes entre une trace et l'horloge du serveur.
 *
 * `null` quand la trace n'existe pas, et négatif ramené à zéro : une horloge
 * d'appareil en avance ne doit pas produire « dans 3 minutes ».
 */
export function minutesSince(iso: string | null, observedAt: string): number | null {
  if (iso === null) return null;
  const seen = Date.parse(iso);
  const now = Date.parse(observedAt);
  if (Number.isNaN(seen) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - seen) / 60_000));
}

/**
 * Écart lisible, en français, sans mode d'emploi : « 4 min », « 3 h », « 2 j ».
 *
 * Les unités changent aux seuils où le chiffre cesse d'être parlant : personne
 * ne lit « 2 880 min » comme « deux jours ».
 */
export function formatElapsed(minutes: number | null): string {
  if (minutes === null) return 'Jamais';
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h`;
  const days = Math.floor(hours / 24);
  return `${String(days)} j`;
}
