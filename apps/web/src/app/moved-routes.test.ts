import { describe, expect, it } from 'vitest';

import { MOVED_ROUTES, movedTarget } from '@/app/moved-routes';
import { COQUES, coqueOf, navItems } from '@/components/layout/nav-items';
import { PANEL_ROLES } from '@/lib/data/auth';

describe('anciennes adresses, d’avant le découpage en coques', () => {
  // Les notifications déjà envoyées portent l'adresse d'AVANT : aucun écran
  // déplacé ne doit avoir perdu la sienne.
  it('ramène chaque écran de CHUES et d’Admin à son adresse d’avant', () => {
    for (const role of PANEL_ROLES) {
      for (const coque of ['chues', 'admin'] as const) {
        for (const { href } of navItems(role, coque)) {
          const [, , racine = '', ...reste] = href.split('/');
          expect(movedTarget(racine, reste), href).toBe(href);
        }
      }
    }
  });

  it('range chaque destination dans une coque, jamais dans le vide', () => {
    for (const [racine, cible] of Object.entries(MOVED_ROUTES)) {
      expect(coqueOf(cible), racine).not.toBeNull();
    }
  });

  it('emporte le reste du chemin : un lien vise un dossier précis, pas la liste', () => {
    expect(movedTarget('dossiers', ['019ff658-dddd-7489-ab22-1f2ada5ef38a'])).toBe(
      '/chues/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a',
    );
    expect(movedTarget('campagnes', ['representants', 'c-1'])).toBe(
      '/chues/campagnes/representants/c-1',
    );
    expect(movedTarget('referentiels', ['issues-appel'])).toBe('/admin/referentiels/issues-appel');
  });

  it('emporte la requête, sans quoi un lien filtré revient à la liste entière', () => {
    expect(movedTarget('prospects', [], { statut: 'NOUVEAU', page: '2' })).toBe(
      '/chues/prospects?statut=NOUVEAU&page=2',
    );
    expect(movedTarget('prospects', [], { segment: ['BDD1', 'BDD2'] })).toBe(
      '/chues/prospects?segment=BDD1&segment=BDD2',
    );
    expect(movedTarget('prospects', [], { vide: undefined })).toBe('/chues/prospects');
  });

  it('ne renvoie nulle part une racine qui n’a jamais existé', () => {
    expect(movedTarget('inconnue')).toBeNull();
    expect(movedTarget('')).toBeNull();
  });

  it('ne réoriente AUCUNE racine de coque, qui se sert elle-même', () => {
    for (const coque of COQUES) {
      expect(MOVED_ROUTES[coque.path.replace('/', '')], coque.path).toBeUndefined();
    }
  });
});
