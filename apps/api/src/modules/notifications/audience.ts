import { NotificationAudience, type Prisma, type Role } from '@crm/database';

import { audienceDepartementRetired, audienceRoleRequired, audienceUsersRequired } from './errors.js';

export interface AudienceSelector {
  readonly audience: NotificationAudience;
  readonly audienceRole?: Role | null;
  readonly audienceUserIds?: readonly string[] | null;
}

const ACTIVE_USER = { isActive: true, deletedAt: null } as const;

export const buildAudienceWhere = (selector: AudienceSelector): Prisma.UserWhereInput => {
  switch (selector.audience) {
    case NotificationAudience.ALL:
      return { ...ACTIVE_USER };

    case NotificationAudience.ROLE: {
      if (!selector.audienceRole) throw audienceRoleRequired();
      return { ...ACTIVE_USER, role: selector.audienceRole };
    }

    // Un compte n'a plus de département : la valeur ne survit que dans les envois passés.
    case NotificationAudience.DEPARTEMENT:
      throw audienceDepartementRetired();

    case NotificationAudience.USERS: {
      const ids = dedupe(selector.audienceUserIds ?? []);
      if (!ids.length) throw audienceUsersRequired();
      return { ...ACTIVE_USER, id: { in: ids } };
    }
  }
};

export const dedupe = (ids: readonly string[]): string[] => [...new Set(ids)];

export const parseUserIdList = (raw: string | undefined): string[] =>
  dedupe(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
