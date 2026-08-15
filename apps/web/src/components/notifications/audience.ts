import {
  AUDIENCE_LABELS,
  ROLE_LABELS,
  type NotificationAudience,
  type NotificationRow,
  type Role,
} from './types';

/**
 * Description du public, et validation AVANT toute requête.
 *
 * Fonctions pures, isolées des composants : ce sont elles qui décident si le
 * bouton « Envoyer » est actionnable, et cette décision doit être testable sans
 * monter d'arbre React.
 */

export interface AudienceSelection {
  audience: NotificationAudience;
  audienceRole: Role | null;
  audienceDepartementId: string | null;
  audienceUserIds: string[];
}

export const EMPTY_AUDIENCE: AudienceSelection = {
  audience: 'ALL',
  audienceRole: null,
  audienceDepartementId: null,
  audienceUserIds: [],
};

/**
 * Le public est-il complètement décrit ?
 *
 * Renvoie le message à afficher, ou `null` si tout est bon. Un booléen nu
 * obligerait l'interface à réinventer la raison du refus, et elle finirait par
 * dire « formulaire invalide » sans dire quoi corriger.
 */
export function audienceProblem(selection: AudienceSelection): string | null {
  switch (selection.audience) {
    case 'ALL':
      return null;
    case 'ROLE':
      return selection.audienceRole === null ? 'Choisissez un rôle.' : null;
    case 'DEPARTEMENT':
      return selection.audienceDepartementId === null ? 'Choisissez un département.' : null;
    case 'USERS':
      return selection.audienceUserIds.length === 0 ? 'Choisissez au moins un compte.' : null;
  }
}

/** Paramètres de requête de l'aperçu. Doit refléter exactement l'envoi. */
export function audienceQuery(selection: AudienceSelection): Record<string, string> {
  const query: Record<string, string> = { audience: selection.audience };
  if (selection.audience === 'ROLE' && selection.audienceRole !== null) {
    query.audienceRole = selection.audienceRole;
  }
  if (selection.audience === 'DEPARTEMENT' && selection.audienceDepartementId !== null) {
    query.audienceDepartementId = selection.audienceDepartementId;
  }
  if (selection.audience === 'USERS' && selection.audienceUserIds.length > 0) {
    query.audienceUserIds = selection.audienceUserIds.join(',');
  }
  return query;
}

/**
 * Phrase décrivant le public d'un envoi passé, pour la colonne du tableau.
 *
 * Les noms de département et de compte ne sont pas résolus ici : la ligne
 * d'historique n'a pas à déclencher une requête par cellule. Le détail les
 * nomme.
 */
export function describeAudience(
  row: Pick<NotificationRow, 'audience' | 'audienceRole' | 'audienceUserIds'>,
  departementName?: string,
): string {
  switch (row.audience) {
    case 'ALL':
      return AUDIENCE_LABELS.ALL;
    case 'ROLE':
      return row.audienceRole === null ? AUDIENCE_LABELS.ROLE : ROLE_LABELS[row.audienceRole];
    case 'DEPARTEMENT':
      return departementName === undefined
        ? AUDIENCE_LABELS.DEPARTEMENT
        : `Département ${departementName}`;
    case 'USERS': {
      const count = row.audienceUserIds.length;
      return count === 1 ? '1 compte choisi' : `${String(count)} comptes choisis`;
    }
  }
}

/**
 * Phrase de confirmation avant envoi.
 *
 * Elle nomme le NOMBRE, parce que c'est la seule information qui rend la
 * confirmation utile : « Confirmer l'envoi ? » sans chiffre ne protège de rien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Elle ne distingue plus « joignables » et « visés », parce que l'API non plus.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La phrase annonçait « 120 d'entre elles n'ont aucun appareil enregistré »,
 * héritage d'un envoi par push mobile qui n'existe plus. `AudiencePreviewDto` ne
 * rend qu'un `recipientCount`, et le dit explicitement : tous les comptes visés
 * liront la notification dans l'application. Garder la nuance revenait à
 * calculer un manque sur un `undefined`, donc à annoncer que TOUS les
 * destinataires étaient injoignables.
 */
export function confirmationSentence(recipientCount: number): string {
  if (recipientCount === 0) {
    return 'Ce public ne correspond à aucun compte actif. Rien ne sera envoyé.';
  }

  const people = recipientCount === 1 ? '1 personne' : `${String(recipientCount)} personnes`;
  return `Cet envoi s’adresse à ${people}.`;
}

/**
 * Le lien profond est-il une route interne acceptable ?
 *
 * Miroir de `ROUTE_PATTERN` côté API. Le refuser ici évite un aller-retour pour
 * une faute de frappe, mais la vérité reste le serveur : une validation
 * cliente seule n'est jamais une validation.
 */
const ROUTE_PATTERN = /^\/[A-Za-z0-9\-._~/%?&=+:@!$'(),;[\]*]*$/;

export function routeProblem(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  if (!ROUTE_PATTERN.test(trimmed)) {
    return 'Le lien doit être une route interne commençant par « / ».';
  }
  return null;
}

/** Routes que le mobile sait ouvrir. Proposées en raccourci dans le compositeur. */
export const KNOWN_ROUTES: readonly { path: string; label: string }[] = [
  { path: '/', label: 'Accueil' },
  { path: '/historique', label: 'Historique' },
  { path: '/phase2', label: 'Phase 2 : saisie des méthodes' },
  { path: '/a-corriger', label: 'File de synchronisation' },
  { path: '/notifications', label: 'Centre de notifications' },
  { path: '/reglages', label: 'Réglages' },
];
