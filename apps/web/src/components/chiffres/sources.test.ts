import { describe, expect, it } from 'vitest';

import { catalogueDe } from '@/components/chiffres/sources';
import type { ChiffresActivite, ChiffresCampagnes } from '@/lib/data/chiffres';
import type { ComptageOuvertures } from '@/lib/data/ouvertures';
import type { Role } from '@/lib/types';

const CARTES_ENROLEMENT = [
  'enrolement-inscriptions',
  'enrolement-taux-rapprochement',
  'enrolement-taux-conversion',
  'enrolement-par-jour',
  'enrolement-par-etape',
  'enrolement-par-teleconseiller',
] as const;

const catalogue = (role: Role, chues: boolean): Record<string, unknown> =>
  catalogueDe({ chues, voitLesMontants: role === 'ADMIN' || role === 'DIRECTION', role });

const AUTRES: readonly Role[] = [
  'DIRECTION',
  'SUPERVISEUR',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'ACCUEIL',
];

describe('les cartes d’enrôlement ne se proposent qu’à la cellule pilotage', () => {
  it.each([true, false])('l’ADMIN les trouve sur les deux écrans (chues=%s)', (chues) => {
    const trouvees = catalogue('ADMIN', chues);
    for (const carte of CARTES_ENROLEMENT) {
      expect(trouvees[carte], carte).toBeDefined();
    }
  });

  it.each(AUTRES)('un compte %s n’en voit AUCUNE', (role) => {
    for (const chues of [true, false]) {
      const trouvees = catalogue(role, chues);
      for (const carte of CARTES_ENROLEMENT) {
        expect(trouvees[carte], `${role}/${String(chues)}/${carte}`).toBeUndefined();
      }
    }
  });

  it('laisse le reste du catalogue intact pour la direction', () => {
    const direction = catalogue('DIRECTION', true);
    expect(direction['adhesions']).toBeDefined();
    expect(direction['par-teleconseiller']).toBeDefined();
  });
});

const chues = catalogueDe({ chues: true, voitLesMontants: false, role: 'SUPERVISEUR' });

const ouverture = (
  nom: string,
  ouvertures: number,
  qualifiees: number,
  dureeMoyenneSecondes: number | null,
): ComptageOuvertures => ({
  openedById: nom,
  openedByName: nom,
  jour: '2026-09-01',
  ouvertures,
  qualifiees,
  liberees: 0,
  dureeMoyenneSecondes,
});

describe('les cartes du lot 2', () => {
  it('lit le taux de qualification sur les fiches ouvertes, « Sans objet » sans ouverture', () => {
    const carte = chues['taux-de-qualification'];
    expect(
      carte?.extraire({ ouvertures: [ouverture('Awa', 10, 8, 60), ouverture('Ba', 10, 7, 60)] }),
    ).toMatchObject({
      donnee: { valeur: 75, affichage: '75,0 %', libelle: '15 qualifiées sur 20 fiches ouvertes' },
    });
    expect(carte?.extraire({ ouvertures: [] })).toMatchObject({
      donnee: { affichage: 'Sans objet' },
    });
  });

  // Deux journées de volumes très différents : la moyenne des moyennes dirait
  // 150 s, ce que personne n'a passé sur une fiche.
  it('pondère la durée moyenne sur la fiche par les fiches qualifiées', () => {
    const carte = chues['duree-moyenne-sur-la-fiche'];
    expect(
      carte?.extraire({ ouvertures: [ouverture('Awa', 9, 9, 100), ouverture('Ba', 1, 1, 200)] }),
    ).toMatchObject({ donnee: { valeur: 110, affichage: '2 min' } });
    expect(carte?.extraire({ ouvertures: [ouverture('Awa', 3, 0, null)] })).toMatchObject({
      donnee: { affichage: 'Sans objet' },
    });
  });

  it('range les statuts dans leur famille', () => {
    const statut = (code: string, famille: 'JOINT' | 'NON_JOINT', count: number) => ({
      id: code,
      code,
      label: code,
      isActive: true,
      famille,
      count,
    });
    const activite = {
      repQualificationStatuses: {
        total: 7,
        items: [
          statut('ACCEPTE', 'JOINT', 4),
          statut('MESSAGERIE', 'NON_JOINT', 3),
          statut('DECEDE', 'JOINT', 0),
        ],
      },
    } as unknown as ChiffresActivite;

    expect(chues['statuts-par-famille']?.extraire({ activite })).toEqual({
      forme: 'composition',
      donnee: [
        { ligne: 'Joint', segments: [{ id: 'ACCEPTE', label: 'ACCEPTE', value: 4 }] },
        { ligne: 'Non joint', segments: [{ id: 'MESSAGERIE', label: 'MESSAGERIE', value: 3 }] },
      ],
    });
  });

  it('fait une part par campagne pour le taux d’exploitation', () => {
    const campagne = (id: string, name: string, prevues: number, traitees: number) => ({
      id,
      name,
      cible: 'REPRESENTANTS' as const,
      createdAt: '2026-09-01T08:00:00.000Z',
      prevues,
      appelees: traitees,
      traitees,
      contactRate: null,
      exploitationRate: null,
      parTeleconseiller: [],
    });
    const campagnes: ChiffresCampagnes = {
      items: [campagne('a', 'Dakar', 50, 30), campagne('b', 'Thiès', 20, 5)],
      totals: { prevues: 70, appelees: 35, traitees: 35, contactRate: 50, exploitationRate: 50 },
    };

    expect(chues['taux-d-exploitation']?.extraire({ campagnes })).toEqual({
      forme: 'classement',
      donnee: [
        { id: 'a', label: 'Dakar', value: 30 },
        { id: 'b', label: 'Thiès', value: 5 },
      ],
    });
    expect(chues['taux-d-exploitation']?.lien?.('a')).toBe('/chues/campagnes/a');
    expect(chues['exploitation-par-campagne']?.extraire({ campagnes })).toMatchObject({
      donnee: [{ ligne: 'Dakar', segments: [{ value: 30 }, { value: 20 }] }, { ligne: 'Thiès' }],
    });
    expect(chues['taux-de-contact']?.extraire({ campagnes })).toMatchObject({
      donnee: { valeur: 50, affichage: '50,0 %', libelle: '35 appelées sur 70 fiches prévues' },
    });
  });
});
