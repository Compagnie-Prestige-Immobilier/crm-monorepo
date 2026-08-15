import {
  apiFetch,
  asArray,
  asBoolean,
  asNullableString,
  asNumber,
  asRecord,
  asString,
} from '@/lib/api/raw';
import type { Role } from '@/lib/types';

/**
 * Purge de la base et supervision des comptes : `GET|POST /admin/purge`,
 * `GET /admin/supervision`. Premier administrateur et ADMIN, respectivement.
 *
 * Toute la logique de décision vit ICI, en fonctions pures, pour qu'elle soit
 * éprouvable sans navigateur. Les écrans ne font que la rendre.
 */

// ─── Purge ───────────────────────────────────────────────────────────────────

export const PURGE_DOMAIN_KEYS = [
  'teleconseillers',
  'finances',
  'representants',
  'prospects',
  'campagnes',
  'fileAppels',
  'tentatives',
  'dossiers',
  'notifications',
  'synchronisation',
  'journal',
  'referentiels',
] as const;

export type PurgeDomainKey = (typeof PURGE_DOMAIN_KEYS)[number];

export interface PurgeDomain {
  key: PurgeDomainKey;
  label: string;
  hint: string;
  /** Domaines entraînés par celui-ci, clés étrangères obligent. */
  requires: PurgeDomainKey[];
  rows: number;
}

export interface PurgeCatalog {
  /** Le compte courant est-il le premier administrateur ? */
  allowed: boolean;
  /** Identifiant à ressaisir. Vide quand la commande est fermée au compte. */
  confirmationHint: string;
  domains: PurgeDomain[];
}

export interface PurgeResult {
  deleted: { key: PurgeDomainKey; label: string; rows: number }[];
  total: number;
  purgedAt: string;
}

function isPurgeDomainKey(value: string): value is PurgeDomainKey {
  return (PURGE_DOMAIN_KEYS as readonly string[]).includes(value);
}

function parseDomainKey(value: unknown, where: string): PurgeDomainKey {
  const key = asString(value, where);
  if (!isPurgeDomainKey(key)) throw new Error(`${where} : domaine inconnu (${key})`);
  return key;
}

function parseCatalog(value: unknown): PurgeCatalog {
  const root = asRecord(value, 'catalogue de purge');
  return {
    allowed: asBoolean(root.allowed, 'allowed'),
    confirmationHint: asString(root.confirmationHint, 'confirmationHint'),
    domains: asArray(root.domains, 'domains').map((entry, index) => {
      const domain = asRecord(entry, `domains[${String(index)}]`);
      return {
        key: parseDomainKey(domain.key, `domains[${String(index)}].key`),
        label: asString(domain.label, 'label'),
        hint: asString(domain.hint, 'hint'),
        requires: asArray(domain.requires, 'requires').map((required, position) =>
          parseDomainKey(required, `requires[${String(position)}]`),
        ),
        rows: asNumber(domain.rows, 'rows'),
      };
    }),
  };
}

function parsePurgeResult(value: unknown): PurgeResult {
  const root = asRecord(value, 'résultat de purge');
  return {
    deleted: asArray(root.deleted, 'deleted').map((entry, index) => {
      const line = asRecord(entry, `deleted[${String(index)}]`);
      return {
        key: parseDomainKey(line.key, `deleted[${String(index)}].key`),
        label: asString(line.label, 'label'),
        rows: asNumber(line.rows, 'rows'),
      };
    }),
    total: asNumber(root.total, 'total'),
    purgedAt: asString(root.purgedAt, 'purgedAt'),
  };
}

export function fetchPurgeCatalog(): Promise<PurgeCatalog> {
  return apiFetch('/admin/purge', parseCatalog);
}

export function runPurge(input: {
  domains: PurgeDomainKey[];
  confirmation: string;
}): Promise<PurgeResult> {
  return apiFetch('/admin/purge', parsePurgeResult, { method: 'POST', body: input });
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
 */
export function expandSelection(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): PurgeDomainKey[] {
  const byKey = new Map(domains.map((domain) => [domain.key, domain]));
  const resolved = new Set<PurgeDomainKey>();
  const pending = [...selected];

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
  const chosen = new Set(selected);
  return expandSelection(selected, domains).filter((key) => !chosen.has(key));
}

/** Lignes que la sélection étendue emporterait aujourd'hui. */
export function selectionRows(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): number {
  const expanded = new Set(expandSelection(selected, domains));
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

export type PresenceState = 'ONLINE' | 'RECENT' | 'AWAY';

export interface SupervisedUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  departementName: string | null;
  presence: PresenceState;
  hasLiveSession: boolean;
  sessionCount: number;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  lastSyncAt: string | null;
  lastWriteAt: string | null;
}

export interface Supervision {
  /** Horloge du SERVEUR. Les écarts se calculent contre elle, jamais contre
   *  celle du poste : une horloge locale en avance produirait des activités
   *  « dans le futur ». */
  observedAt: string;
  onlineWindowMinutes: number;
  teleconseillers: SupervisedUser[];
  finances: SupervisedUser[];
  counts: { online: number; recent: number; away: number };
}

const PRESENCE_STATES = ['ONLINE', 'RECENT', 'AWAY'] as const satisfies readonly PresenceState[];

/**
 * Les rôles du CONTRAT, et non un tableau de chaînes.
 *
 * `readonly string[]` acceptait n'importe quoi : la liste pouvait dériver du
 * contrat sans que rien ne le signale. Typée `readonly Role[]`, elle est
 * vérifiée par le compilateur, et `ROLE_LABELS` ci-contre casse déjà le build si
 * un rôle est ajouté sans libellé.
 */
const ROLES = ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE'] as const satisfies readonly Role[];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Une valeur inconnue DÉGRADE la ligne ; elle ne fait pas tomber l'écran.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces deux contrôles LEVAIENT. Comme `parseSupervision` analyse la réponse
 * entière d'un bloc, un seul compte portant un rôle que le panel ne connaît pas
 * encore : un rôle livré côté API avant que le panel ne soit redéployé -
 * emportait la Supervision TOUT ENTIÈRE. L'écran qui sert à savoir qui est en
 * ligne devenait le premier à disparaître, précisément le jour d'une mise en
 * production.
 *
 * On replie donc sur une valeur sûre plutôt que de refuser la page :
 *  - une présence inconnue vaut `AWAY`, l'état le moins affirmatif : dire
 *    « inactif » de quelqu'un qui est peut-être connecté induit moins en erreur
 *    que l'inverse ;
 *  - un rôle inconnu vaut `COMMERCIAL`, le rôle par défaut du terrain. La ligne
 *    reste listée, nommée, avec sa dernière activité : c'est cette information
 *    que l'écran doit rendre, pas la taxonomie des rôles.
 *
 * Les champs STRUCTURANTS (identifiant, nom, dates) continuent, eux, de lever :
 * une ligne sans identifiant n'est pas une ligne dégradée, c'est une réponse
 * dont la forme a changé.
 */
function parseSupervisedUser(value: unknown, where: string): SupervisedUser {
  const row = asRecord(value, where);
  const presence = asString(row.presence, `${where}.presence`);
  const role = asString(row.role, `${where}.role`);

  return {
    id: asString(row.id, `${where}.id`),
    fullName: asString(row.fullName, `${where}.fullName`),
    username: asString(row.username, `${where}.username`),
    email: asString(row.email, `${where}.email`),
    role: knownRole(role),
    isActive: asBoolean(row.isActive, `${where}.isActive`),
    departementName: asNullableString(row.departementName, `${where}.departementName`),
    presence: knownPresence(presence),
    hasLiveSession: asBoolean(row.hasLiveSession, `${where}.hasLiveSession`),
    sessionCount: asNumber(row.sessionCount, `${where}.sessionCount`),
    lastSeenAt: asNullableString(row.lastSeenAt, `${where}.lastSeenAt`),
    lastLoginAt: asNullableString(row.lastLoginAt, `${where}.lastLoginAt`),
    lastSyncAt: asNullableString(row.lastSyncAt, `${where}.lastSyncAt`),
    lastWriteAt: asNullableString(row.lastWriteAt, `${where}.lastWriteAt`),
  };
}

/** Repli explicite, plutôt qu'un `as` qui mentirait au compilateur. */
export function knownRole(value: string): Role {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : 'COMMERCIAL';
}

export function knownPresence(value: string): PresenceState {
  return (PRESENCE_STATES as readonly string[]).includes(value) ? (value as PresenceState) : 'AWAY';
}

function parseSupervision(value: unknown): Supervision {
  const root = asRecord(value, 'supervision');
  const counts = asRecord(root.counts, 'counts');
  return {
    observedAt: asString(root.observedAt, 'observedAt'),
    onlineWindowMinutes: asNumber(root.onlineWindowMinutes, 'onlineWindowMinutes'),
    teleconseillers: asArray(root.teleconseillers, 'teleconseillers').map((entry, index) =>
      parseSupervisedUser(entry, `teleconseillers[${String(index)}]`),
    ),
    finances: asArray(root.finances, 'finances').map((entry, index) =>
      parseSupervisedUser(entry, `finances[${String(index)}]`),
    ),
    counts: {
      online: asNumber(counts.online, 'counts.online'),
      recent: asNumber(counts.recent, 'counts.recent'),
      away: asNumber(counts.away, 'counts.away'),
    },
  };
}

export function fetchSupervision(): Promise<Supervision> {
  return apiFetch('/admin/supervision', parseSupervision);
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
