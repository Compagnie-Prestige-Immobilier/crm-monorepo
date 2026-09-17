import {
  AUDIENCE_LABELS,
  ROLE_LABELS,
  type NotificationAudience,
  type NotificationRow,
  type Role,
} from './types';

export interface AudienceSelection {
  audience: SendableAudience;
  audienceRole: Role | null;
  audienceUserIds: string[];
}

/** `DEPARTEMENT` reste dans l'enum pour relire les envois passés ; le serveur le refuse. */
export type SendableAudience = Exclude<NotificationAudience, 'DEPARTEMENT'>;

export const SENDABLE_AUDIENCES: SendableAudience[] = ['ALL', 'ROLE', 'USERS'];

export const EMPTY_AUDIENCE: AudienceSelection = {
  audience: 'ALL',
  audienceRole: null,
  audienceUserIds: [],
};

export function audienceProblem(selection: AudienceSelection): string | null {
  switch (selection.audience) {
    case 'ALL':
      return null;
    case 'ROLE':
      return selection.audienceRole === null ? 'Choisissez un rôle.' : null;
    case 'USERS':
      return selection.audienceUserIds.length === 0 ? 'Choisissez au moins un compte.' : null;
  }
}

export interface AudienceQuery {
  audience: SendableAudience;
  audienceRole?: Role;
  audienceUserIds?: string;
}

export function audienceQuery(selection: AudienceSelection): AudienceQuery {
  return {
    audience: selection.audience,
    ...(selection.audience === 'ROLE' && selection.audienceRole !== null
      ? { audienceRole: selection.audienceRole }
      : {}),
    ...(selection.audience === 'USERS' && selection.audienceUserIds.length > 0
      ? { audienceUserIds: selection.audienceUserIds.join(',') }
      : {}),
  };
}

export function describeAudience(
  row: Pick<NotificationRow, 'audience' | 'audienceRole' | 'audienceUserIds'>,
): string {
  switch (row.audience) {
    case 'ALL':
      return AUDIENCE_LABELS.ALL;
    case 'ROLE':
      return row.audienceRole === null
        ? AUDIENCE_LABELS.ROLE
        : (ROLE_LABELS[row.audienceRole as Role] ?? row.audienceRole);
    case 'DEPARTEMENT':
      return AUDIENCE_LABELS.DEPARTEMENT;
    case 'USERS': {
      const count = row.audienceUserIds.length;
      return count === 1 ? '1 compte choisi' : `${String(count)} comptes choisis`;
    }
  }
}

export function confirmationSentence(recipientCount: number): string {
  if (recipientCount === 0) {
    return 'Ce public ne correspond à aucun compte actif. Rien ne sera envoyé.';
  }

  const people = recipientCount === 1 ? '1 personne' : `${String(recipientCount)} personnes`;
  return `Cet envoi s’adresse à ${people}.`;
}

const ROUTE_PATTERN = /^\/[A-Za-z0-9\-._~/%?&=+:@!$'(),;[\]*]*$/;

export function routeProblem(route: string): string | null {
  const trimmed = route.trim();
  if (trimmed === '') return null;
  if (!ROUTE_PATTERN.test(trimmed)) {
    return 'Le lien doit être une route interne commençant par « / ».';
  }
  return null;
}

export const KNOWN_ROUTES: readonly { path: string; label: string }[] = [
  { path: '/', label: 'Accueil' },
  { path: '/historique', label: 'Historique' },
  { path: '/phase2', label: 'Phase 3 · Conversion' },
  { path: '/a-corriger', label: 'File de synchronisation' },
  { path: '/admin/notifications', label: 'Centre de notifications' },
  { path: '/reglages', label: 'Réglages' },
];
