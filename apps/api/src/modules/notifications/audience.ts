import { NotificationAudience, type Prisma, type Role } from '@crm/database';

import {
  audienceDepartementRequired,
  audienceRoleRequired,
  audienceUsersRequired,
} from './errors.js';

/**
 * Traduction d'un public en filtre Prisma.
 *
 * ISOLÉE VOLONTAIREMENT, parce qu'elle est utilisée à DEUX endroits : l'aperçu
 * qui annonce « 412 destinataires » avant confirmation, et l'envoi qui crée les
 * lignes de livraison. Deux implémentations divergentes produiraient un
 * compteur qui ment — et « envoyer à 400 personnes » ne s'annule pas.
 */

export interface AudienceSelector {
  readonly audience: NotificationAudience;
  readonly audienceRole?: Role | null;
  readonly audienceDepartementId?: string | null;
  readonly audienceUserIds?: readonly string[] | null;
}

/**
 * Les comptes désactivés ou supprimés ne sont JAMAIS destinataires.
 *
 * Un commercial dont l'accès a été fermé ne doit pas continuer de recevoir des
 * consignes de travail sur son téléphone personnel — et le compter dans le
 * public gonflerait l'annonce de destinataires qui n'existent plus.
 */
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

/**
 * Déduplique en préservant l'ordre.
 *
 * Sans cela, un admin qui choisit deux fois le même compte dans la liste verrait
 * « 2 destinataires » pour une seule personne. La contrainte unique en base
 * rattraperait l'insertion, mais après avoir affiché le mauvais chiffre — au
 * moment précis où il décide de confirmer.
 */
export const dedupe = (ids: readonly string[]): string[] => [...new Set(ids)];

/** Découpe la forme « id,id,id » de la chaîne de requête de l'aperçu. */
export const parseUserIdList = (raw: string | undefined): string[] =>
  dedupe(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
