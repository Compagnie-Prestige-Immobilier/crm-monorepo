import { ProspectStatut, RepresentantRelation, SuggestionStatus } from '@crm/database';
import { describe, expect, it } from 'vitest';

import {
  PROSPECT_STATUT_TRANSITIONS,
  REPRESENTANT_RELATION_TRANSITIONS,
  SUGGESTION_STATUS_TRANSITIONS,
  assertTransition,
  isLegalTransition,
} from './transitions.js';

describe('statut du prospect', () => {
  it('CONVERTI est terminal', () => {
    for (const to of Object.values(ProspectStatut)) {
      if (to === ProspectStatut.CONVERTI) continue;
      expect(isLegalTransition(PROSPECT_STATUT_TRANSITIONS, ProspectStatut.CONVERTI, to)).toBe(
        false,
      );
    }
  });

  /// Une fiche perdue se retravaille : c'est le geste le plus courant après une
  /// relance, et l'interdire figerait un abandon de bonne foi.
  it('PERDU se reprend, mais ne saute pas directement à CONVERTI', () => {
    expect(
      isLegalTransition(PROSPECT_STATUT_TRANSITIONS, ProspectStatut.PERDU, ProspectStatut.CONTACTE),
    ).toBe(true);
    expect(
      isLegalTransition(PROSPECT_STATUT_TRANSITIONS, ProspectStatut.PERDU, ProspectStatut.CONVERTI),
    ).toBe(false);
  });

  it('réécrire le même statut est toujours permis : c’est un rejeu, pas une transition', () => {
    for (const statut of Object.values(ProspectStatut)) {
      expect(isLegalTransition(PROSPECT_STATUT_TRANSITIONS, statut, statut)).toBe(true);
    }
  });
});

describe('relation du représentant', () => {
  /// Le RANG ne baisse jamais, mais rien n'est figé à rang égal.
  it('un ambassadeur qui cesse redevient un refus, et réciproquement', () => {
    expect(
      isLegalTransition(
        REPRESENTANT_RELATION_TRANSITIONS,
        RepresentantRelation.AMBASSADEUR,
        RepresentantRelation.REFUS,
      ),
    ).toBe(true);
    expect(
      isLegalTransition(
        REPRESENTANT_RELATION_TRANSITIONS,
        RepresentantRelation.REFUS,
        RepresentantRelation.AMBASSADEUR,
      ),
    ).toBe(true);
  });

  it('personne ne redevient INCONNU, ni « simplement contacté » après avoir tranché', () => {
    for (const from of Object.values(RepresentantRelation)) {
      if (from === RepresentantRelation.INCONNU) continue;
      expect(
        isLegalTransition(REPRESENTANT_RELATION_TRANSITIONS, from, RepresentantRelation.INCONNU),
      ).toBe(false);
    }
    for (const from of [RepresentantRelation.AMBASSADEUR, RepresentantRelation.REFUS]) {
      expect(
        isLegalTransition(REPRESENTANT_RELATION_TRANSITIONS, from, RepresentantRelation.CONTACTE),
      ).toBe(false);
    }
  });
});

describe('numéro suggéré', () => {
  it('une piste soldée ne revient pas à appeler', () => {
    for (const from of [SuggestionStatus.APPELE, SuggestionStatus.ABANDONNE]) {
      expect(
        isLegalTransition(SUGGESTION_STATUS_TRANSITIONS, from, SuggestionStatus.A_APPELER),
      ).toBe(false);
    }
  });
});

describe('la garde', () => {
  it('refuse en nommant les deux états', () => {
    expect(() => {
      assertTransition(
        PROSPECT_STATUT_TRANSITIONS,
        ProspectStatut.CONVERTI,
        ProspectStatut.NOUVEAU,
        { code: 'X', label: 'Statut' },
      );
    }).toThrow(/CONVERTI.*NOUVEAU/s);
  });

  /// Sans cette porte, une conversion enregistrée par erreur ne serait plus
  /// jamais rattrapable autrement qu'en SQL direct.
  it('laisse passer un ADMIN qui corrige depuis un état terminal', () => {
    expect(() => {
      assertTransition(PROSPECT_STATUT_TRANSITIONS, ProspectStatut.CONVERTI, ProspectStatut.PERDU, {
        code: 'X',
        label: 'Statut',
        bypass: true,
      });
    }).not.toThrow();
  });
});
