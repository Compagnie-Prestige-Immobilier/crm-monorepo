import { describe, expect, it } from 'vitest';

import {
  countActiveNotificationFilters,
  defaultNotificationTab,
  emptyNotificationFilters,
  parseNotificationFilters,
  serializeNotificationFilters,
} from '@/lib/notification-filters';

describe('onglet porté par l’URL', () => {
  it('atterrit sur l’émission pour un ADMIN, sur la réception pour les autres', () => {
    expect(defaultNotificationTab(true)).toBe('historique');
    expect(defaultNotificationTab(false)).toBe('reception');
  });

  it('restitue l’onglet demandé, donc un lien collé rouvre le même écran', () => {
    expect(parseNotificationFilters({ onglet: 'gabarits' }, true).tab).toBe('gabarits');
    expect(parseNotificationFilters({ onglet: 'reception' }, true).tab).toBe('reception');
  });

  it('écarte un onglet inconnu plutôt que d’afficher un écran vide', () => {
    expect(parseNotificationFilters({ onglet: 'inconnu' }, true).tab).toBe('historique');
  });

  it('ramène un rôle non-ADMIN sur SA boîte, même si l’URL demande l’émission', () => {
    expect(parseNotificationFilters({ onglet: 'gabarits' }, false).tab).toBe('reception');
    expect(parseNotificationFilters({ onglet: 'historique' }, false).tab).toBe('reception');
    expect(parseNotificationFilters({ onglet: 'reception' }, false).tab).toBe('reception');
  });
});

describe('pagination et critères de l’historique', () => {
  it('lit la page : sans elle, la 21e notification était hors de portée', () => {
    expect(parseNotificationFilters({ page: '3' }, true).page).toBe(3);
    expect(parseNotificationFilters({ page: '0' }, true).page).toBe(1);
    expect(parseNotificationFilters({}, true).page).toBe(1);
  });

  it('lit le statut et la catégorie, et refuse une valeur hors contrat', () => {
    const filters = parseNotificationFilters({ statut: 'SCHEDULED', categorie: 'RAPPEL' }, true);
    expect(filters.status).toBe('SCHEDULED');
    expect(filters.category).toBe('RAPPEL');

    const bricole = parseNotificationFilters({ statut: 'TOUT', categorie: 'AUTRE' }, true);
    expect(bricole.status).toBeNull();
    expect(bricole.category).toBeNull();
  });

  it('pagine la boîte de réception SÉPARÉMENT de l’historique', () => {
    const filters = parseNotificationFilters({ page: '3', pageRecue: '7' }, true);
    expect(filters.page).toBe(3);
    expect(filters.inboxPage).toBe(7);
  });

  it('ne connaît que `oui` pour les non lues', () => {
    expect(parseNotificationFilters({ nonLues: 'oui' }, true).unreadOnly).toBe(true);
    expect(parseNotificationFilters({ nonLues: 'true' }, true).unreadOnly).toBe(false);
    expect(parseNotificationFilters({}, true).unreadOnly).toBe(false);
  });
});

describe('sérialisation canonique', () => {
  it('n’écrit RIEN quand tout est au défaut, pour chaque rôle', () => {
    expect(serializeNotificationFilters(emptyNotificationFilters(true), true).toString()).toBe('');
    expect(serializeNotificationFilters(emptyNotificationFilters(false), false).toString()).toBe(
      '',
    );
  });

  it('fait un aller-retour fidèle', () => {
    const filters = {
      ...emptyNotificationFilters(true),
      tab: 'gabarits' as const,
      status: 'SENT' as const,
      category: 'CAMPAGNE' as const,
      page: 4,
      inboxPage: 2,
      unreadOnly: true,
    };
    const restored = parseNotificationFilters(serializeNotificationFilters(filters, true), true);
    expect(restored).toEqual(filters);
  });
});

describe('countActiveNotificationFilters', () => {
  it('ne compte que les critères, jamais l’onglet ni la pagination', () => {
    expect(countActiveNotificationFilters(emptyNotificationFilters(true))).toBe(0);
    expect(
      countActiveNotificationFilters({
        ...emptyNotificationFilters(true),
        tab: 'gabarits',
        page: 9,
      }),
    ).toBe(0);
    expect(
      countActiveNotificationFilters({
        ...emptyNotificationFilters(true),
        status: 'SENT',
        category: 'RAPPEL',
      }),
    ).toBe(2);
  });
});
