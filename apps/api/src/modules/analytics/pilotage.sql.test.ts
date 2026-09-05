import { StatutQualificationEffect } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { brancheDe, outcomeOf } from '../referentiels/statuts-qualification.service.js';
import { REP_JOINT_OUTCOMES, REP_LIVE_OUTCOMES } from './pilotage.sql.js';

const estJoint = (effect: StatutQualificationEffect): boolean =>
  brancheDe(effect).includes(StatutQualificationEffect.REACHED);

describe('la famille jointe du référentiel commande le compteur du pilotage', () => {
  it.each(Object.values(StatutQualificationEffect))(
    '%s est compté joint si et seulement si le référentiel le range là',
    (effect) => {
      expect(REP_JOINT_OUTCOMES.sql.includes(`'${outcomeOf(effect)}'`)).toBe(estJoint(effect));
    },
  );

  it('ne compte joint aucune issue que le terrain ne sait plus saisir', () => {
    for (const outcome of REP_JOINT_OUTCOMES.sql.match(/[A-Z_]{4,}/gu) ?? []) {
      expect(REP_LIVE_OUTCOMES.sql, outcome).toContain(`'${outcome}'`);
    }
  });
});
