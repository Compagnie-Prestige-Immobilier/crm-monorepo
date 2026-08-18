import { NotificationAudience, type Prisma, type Role } from '@crm/database';

import {
  audienceDepartementRequired,
  audienceRoleRequired,
  audienceUsersRequired,
} from './errors.js';

export interface AudienceSelector {
  readonly audience: NotificationAudience;
  readonly audienceRole?: Role | null;
  readonly audienceDepartementId?: string | null;
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

    case NotificationAudience.DEPARTEMENT: {
      if (!selector.audienceDepartementId) throw audienceDepartementRequired();
      return { ...ACTIVE_USER, departementId: selector.audienceDepartementId };
    }

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
