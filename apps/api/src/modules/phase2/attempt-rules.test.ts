import { BadRequestException } from '@nestjs/common';
import { CallOutcome, EnrollmentMethod, Phase2Status } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { CallOutcomeEffect, SYSTEM_OUTCOME_REASONS } from '../referentiels/call-outcome-rules.js';
import {
  CALLBACK_CLOCK_SKEW_TOLERANCE_MS,
  COMMENT_MAX_LENGTH,
  DUREE_ETABLISSEMENT_MAX_MOIS,
  PHASE2_STATUS_FOR_OUTCOME,
  isTerminalOutcome,
  normalizeAttempt,
  systemReasonFor,
  type AttemptReason,
} from './attempt-rules.js';

function codeOf(run: () => unknown): string {
  let leve: unknown;
  try {
    run();
  } catch (error) {
    leve = error;
  }

  expect(leve).toBeInstanceOf(BadRequestException);
  const body = (leve as BadRequestException).getResponse() as { code?: string };
  return body.code ?? '';
}

describe('isTerminalOutcome', () => {
  it('classe les six issues', () => {
    expect(isTerminalOutcome(CallOutcome.METHOD_OBTAINED)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.REFUSED)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.WRONG_NUMBER)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.UNREACHABLE)).toBe(false);
    expect(isTerminalOutcome(CallOutcome.CALLBACK)).toBe(false);
    expect(isTerminalOutcome(CallOutcome.OTHER)).toBe(false);
  });

  it('associe un statut de phase 2 à chaque issue terminale', () => {
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.METHOD_OBTAINED]).toBe(
      Phase2Status.METHOD_OBTAINED,
    );
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.REFUSED]).toBe(Phase2Status.REFUSED);
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.WRONG_NUMBER]).toBe(Phase2Status.WRONG_NUMBER);
  });
});

const APPEL = '2026-08-18T10:00:00.000Z';
const RENDEZ_VOUS = '2026-08-25T09:00:00.000Z';

describe('normalizeAttempt, méthode et issue', () => {
  it('accepte toutes les méthodes avec METHOD_OBTAINED', () => {
    for (const method of Object.values(EnrollmentMethod)) {
      const result = normalizeAttempt({
        outcome: CallOutcome.METHOD_OBTAINED,
        method,
        clientCreatedAt: APPEL,
        ...(method === EnrollmentMethod.APPOINTMENT ? { rendezVousAt: RENDEZ_VOUS } : {}),
      });
      expect(result.method).toBe(method);
      expect(result.terminal).toBe(true);
    }
  });

  it('refuse METHOD_OBTAINED sans méthode', () => {
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED }))).toBe(
      'PHASE2_METHOD_REQUIRED',
    );
    expect(
      codeOf(() => normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED, method: null })),
    ).toBe('PHASE2_METHOD_REQUIRED');
  });

  it('refuse une méthode sur toute autre issue', () => {
    for (const outcome of [
      CallOutcome.REFUSED,
      CallOutcome.WRONG_NUMBER,
      CallOutcome.UNREACHABLE,
      CallOutcome.CALLBACK,
    ]) {
      expect(codeOf(() => normalizeAttempt({ outcome, method: EnrollmentMethod.PLATFORM }))).toBe(
        'PHASE2_METHOD_NOT_ALLOWED',
      );
    }
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.OTHER,
          method: EnrollmentMethod.PHYSICAL,
          comment: 'injoignable, boîte vocale saturée',
        }),
      ),
    ).toBe('PHASE2_METHOD_NOT_ALLOWED');
  });

  it('accepte REFUSED et WRONG_NUMBER sans méthode, et les marque terminales', () => {
    for (const outcome of [CallOutcome.REFUSED, CallOutcome.WRONG_NUMBER]) {
      const result = normalizeAttempt({ outcome });
      expect(result.method).toBeNull();
      expect(result.terminal).toBe(true);
    }
  });

  it('laisse la tâche ouverte pour UNREACHABLE, CALLBACK et OTHER', () => {
    expect(normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }).terminal).toBe(false);
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK }).terminal).toBe(false);
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: 'rappelle lundi' }).terminal,
    ).toBe(false);
  });
});

describe('normalizeAttempt, date de rappel', () => {
  it('retient la date de rappel promise avec CALLBACK', () => {
    const result = normalizeAttempt({
      outcome: CallOutcome.CALLBACK,
      callbackAt: '2026-08-19T09:00:00.000Z',
      clientCreatedAt: APPEL,
    });
    expect(result.callbackAt?.toISOString()).toBe('2026-08-19T09:00:00.000Z');
  });

  it('refuse une date de rappel sur toute autre issue', () => {
    for (const outcome of [
      CallOutcome.UNREACHABLE,
      CallOutcome.REFUSED,
      CallOutcome.WRONG_NUMBER,
      CallOutcome.METHOD_OBTAINED,
    ]) {
      expect(
        codeOf(() =>
          normalizeAttempt({
            outcome,
            ...(outcome === CallOutcome.METHOD_OBTAINED
              ? { method: EnrollmentMethod.PLATFORM }
              : {}),
            callbackAt: '2026-08-19T09:00:00.000Z',
            clientCreatedAt: APPEL,
          }),
        ),
      ).toBe('PHASE2_CALLBACK_AT_NOT_ALLOWED');
    }
  });

  it('refuse une date de rappel illisible', () => {
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: 'demain matin',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_INVALID');
  });

  it('refuse un rappel antérieur à l’appel qui l’a promis', () => {
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: '2026-08-17T10:00:00.000Z',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_PAST');
  });

  it('tolère quatre minutes de dérive d’horloge, et pas six', () => {
    expect(
      normalizeAttempt({
        outcome: CallOutcome.CALLBACK,
        callbackAt: '2026-08-18T09:56:00.000Z',
        clientCreatedAt: APPEL,
      }).callbackAt?.toISOString(),
    ).toBe('2026-08-18T09:56:00.000Z');

    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: '2026-08-18T09:54:00.000Z',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_PAST');
  });

  it('reprend la dérive déjà retenue ailleurs dans le dépôt', () => {
    expect(CALLBACK_CLOCK_SKEW_TOLERANCE_MS).toBe(5 * 60_000);
  });

  it('mesure le retard sur l’HEURE DE L’APPEL, pas sur celle du serveur', () => {
    const vieuxLot = normalizeAttempt({
      outcome: CallOutcome.CALLBACK,
      callbackAt: '2020-01-02T09:00:00.000Z',
      clientCreatedAt: '2020-01-01T10:00:00.000Z',
    });
    expect(vieuxLot.callbackAt?.toISOString()).toBe('2020-01-02T09:00:00.000Z');
  });

  it('une issue CALLBACK sans date reste acceptée, sans rappel planifié', () => {
    const result = normalizeAttempt({ outcome: CallOutcome.CALLBACK, clientCreatedAt: APPEL });
    expect(result.callbackAt).toBeNull();
    expect(result.terminal).toBe(false);
  });

  it('aucune autre issue ne se voit imposer la date', () => {
    for (const outcome of [CallOutcome.UNREACHABLE, CallOutcome.REFUSED]) {
      expect(normalizeAttempt({ outcome, clientCreatedAt: APPEL }).callbackAt).toBeNull();
    }
  });
});

describe('normalizeAttempt, commentaire', () => {
  it('exige un commentaire non vide pour OTHER', () => {
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER }))).toBe(
      'PHASE2_COMMENT_REQUIRED',
    );
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER, comment: '   ' }))).toBe(
      'PHASE2_COMMENT_REQUIRED',
    );
  });

  it('rogne le commentaire et remplace le vide par null', () => {
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: '  ligne coupée  ' }).comment,
    ).toBe('ligne coupée');
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK, comment: '   ' }).comment).toBeNull();
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK }).comment).toBeNull();
  });

  it('accepte un commentaire facultatif sur les autres issues', () => {
    expect(
      normalizeAttempt({ outcome: CallOutcome.UNREACHABLE, comment: 'sonne dans le vide' }).comment,
    ).toBe('sonne dans le vide');
  });

  it('refuse un commentaire au-delà de la limite de la contrainte CHECK', () => {
    const tooLong = 'x'.repeat(COMMENT_MAX_LENGTH + 1);
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER, comment: tooLong }))).toBe(
      'PHASE2_COMMENT_TOO_LONG',
    );
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: 'x'.repeat(COMMENT_MAX_LENGTH) })
        .comment,
    ).toHaveLength(COMMENT_MAX_LENGTH);
  });
});

describe('normalizeAttempt, renseignements de conversion', () => {
  const priseDeRendezVous = (
    over: Record<string, unknown> = {},
  ): Parameters<typeof normalizeAttempt>[0] => ({
    outcome: CallOutcome.METHOD_OBTAINED,
    method: EnrollmentMethod.APPOINTMENT,
    rendezVousAt: RENDEZ_VOUS,
    clientCreatedAt: APPEL,
    ...over,
  });

  it('la prise de rendez-vous sans date est refusée', () => {
    expect(codeOf(() => normalizeAttempt(priseDeRendezVous({ rendezVousAt: undefined })))).toBe(
      'PHASE2_RENDEZ_VOUS_REQUIRED',
    );
  });

  it('une date de rendez-vous antérieure à l’appel est refusée', () => {
    expect(
      codeOf(() =>
        normalizeAttempt(priseDeRendezVous({ rendezVousAt: '2026-08-17T09:00:00.000Z' })),
      ),
    ).toBe('PHASE2_RENDEZ_VOUS_PAST');
  });

  it('la date se juge sur l’HEURE DE L’APPEL : un lot poussé trois semaines plus tard passe', () => {
    const vieuxLot = normalizeAttempt(
      priseDeRendezVous({
        clientCreatedAt: '2020-01-01T10:00:00.000Z',
        rendezVousAt: '2020-01-02T09:00:00.000Z',
      }),
    );
    expect(vieuxLot.rendezVousAt?.toISOString()).toBe('2020-01-02T09:00:00.000Z');
  });

  it('tolère la même dérive d’horloge que le rappel', () => {
    expect(
      normalizeAttempt(
        priseDeRendezVous({ rendezVousAt: '2026-08-18T09:56:00.000Z' }),
      ).rendezVousAt?.toISOString(),
    ).toBe('2026-08-18T09:56:00.000Z');

    expect(
      codeOf(() =>
        normalizeAttempt(priseDeRendezVous({ rendezVousAt: '2026-08-18T09:54:00.000Z' })),
      ),
    ).toBe('PHASE2_RENDEZ_VOUS_PAST');
  });

  it('une date illisible est refusée', () => {
    expect(codeOf(() => normalizeAttempt(priseDeRendezVous({ rendezVousAt: 'jeudi' })))).toBe(
      'PHASE2_RENDEZ_VOUS_INVALID',
    );
  });

  it('toute autre méthode refuse la date', () => {
    for (const method of [
      EnrollmentMethod.PLATFORM,
      EnrollmentMethod.PHYSICAL,
      EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING,
    ]) {
      expect(codeOf(() => normalizeAttempt(priseDeRendezVous({ method })))).toBe(
        'PHASE2_RENDEZ_VOUS_NOT_ALLOWED',
      );
    }
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.UNREACHABLE,
          rendezVousAt: RENDEZ_VOUS,
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_RENDEZ_VOUS_NOT_ALLOWED');
  });

  it('rogne l’adresse électronique et refuse ce qui n’en est pas une', () => {
    expect(normalizeAttempt(priseDeRendezVous({ email: '  awa@cpi.sn ' })).email).toBe(
      'awa@cpi.sn',
    );
    expect(normalizeAttempt(priseDeRendezVous({ email: '   ' })).email).toBeNull();
    expect(normalizeAttempt(priseDeRendezVous()).email).toBeNull();

    for (const saisie of ['awa', 'awa@', 'awa@cpi', 'a wa@cpi.sn', `${'x'.repeat(160)}@cpi.sn`]) {
      expect(codeOf(() => normalizeAttempt(priseDeRendezVous({ email: saisie })))).toBe(
        'PHASE2_EMAIL_INVALID',
      );
    }
  });

  it('borne la durée dans l’établissement sur la contrainte CHECK', () => {
    expect(
      normalizeAttempt(priseDeRendezVous({ dureeEtablissementMois: 0 })).dureeEtablissementMois,
    ).toBe(0);
    expect(
      normalizeAttempt({
        ...priseDeRendezVous(),
        dureeEtablissementMois: DUREE_ETABLISSEMENT_MAX_MOIS,
      }).dureeEtablissementMois,
    ).toBe(DUREE_ETABLISSEMENT_MAX_MOIS);

    for (const mois of [-1, DUREE_ETABLISSEMENT_MAX_MOIS + 1, 12.5]) {
      expect(
        codeOf(() => normalizeAttempt(priseDeRendezVous({ dureeEtablissementMois: mois }))),
      ).toBe('PHASE2_DUREE_ETABLISSEMENT_INVALID');
    }
  });

  it('les booléens gardent la distinction entre « non » et « question non posée »', () => {
    const posee = normalizeAttempt(
      priseDeRendezVous({ fonctionnaire: false, engagementEnCours: true }),
    );
    expect(posee.fonctionnaire).toBe(false);
    expect(posee.engagementEnCours).toBe(true);

    const muette = normalizeAttempt(priseDeRendezVous());
    expect(muette.fonctionnaire).toBeNull();
    expect(muette.engagementEnCours).toBeNull();
  });
});

describe('normalizeAttempt, motif du référentiel', () => {
  const reason = (over: Partial<AttemptReason> = {}): AttemptReason => ({
    id: 'motif-1',
    code: 'BOITE_VOCALE',
    label: 'Boîte vocale',
    effect: CallOutcomeEffect.KEEP_OPEN,
    requiresComment: false,
    requiresCallback: false,
    ...over,
  });

  it.each(SYSTEM_OUTCOME_REASONS)(
    '$code : le motif système explicite rend EXACTEMENT le même verdict que l’issue seule',
    (system) => {
      const input = {
        outcome: system.code,
        ...(system.code === CallOutcome.METHOD_OBTAINED
          ? { method: EnrollmentMethod.PLATFORM }
          : {}),
        ...(system.requiresComment ? { comment: 'motif' } : {}),
        clientCreatedAt: APPEL,
      };

      expect(normalizeAttempt(input, systemReasonFor(system.code))).toEqual(
        normalizeAttempt(input),
      );
    },
  );

  it('reporte l’identifiant du motif sur la tentative', () => {
    expect(normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }, reason()).reasonId).toBe(
      'motif-1',
    );
  });

  it('sans motif du référentiel, la tentative n’en porte aucun', () => {
    expect(normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }).reasonId).toBeNull();
  });

  it('un motif qui exige un commentaire le fait respecter', () => {
    const exigeant = reason({ requiresComment: true });

    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }, exigeant))).toBe(
      'PHASE2_COMMENT_REQUIRED',
    );
    expect(
      codeOf(() => normalizeAttempt({ outcome: CallOutcome.UNREACHABLE, comment: ' ' }, exigeant)),
    ).toBe('PHASE2_COMMENT_REQUIRED');
    expect(
      normalizeAttempt(
        { outcome: CallOutcome.UNREACHABLE, comment: 'sonne dans le vide' },
        exigeant,
      ).comment,
    ).toBe('sonne dans le vide');
  });

  it('un motif qui exige un rappel refuse la saisie sans date', () => {
    const exigeant = reason({
      effect: CallOutcomeEffect.SCHEDULE_CALLBACK,
      requiresCallback: true,
    });

    expect(
      codeOf(() =>
        normalizeAttempt({ outcome: CallOutcome.CALLBACK, clientCreatedAt: APPEL }, exigeant),
      ),
    ).toBe('PHASE2_CALLBACK_AT_REQUIRED');

    expect(
      normalizeAttempt(
        {
          outcome: CallOutcome.CALLBACK,
          callbackAt: '2026-08-19T09:00:00.000Z',
          clientCreatedAt: APPEL,
        },
        exigeant,
      ).callbackAt?.toISOString(),
    ).toBe('2026-08-19T09:00:00.000Z');
  });

  it('un motif ne peut pas ASSOUPLIR son effet : la méthode reste exigée', () => {
    const laxiste = reason({ effect: CallOutcomeEffect.CLOSE_METHOD, code: 'METHODE_PARTIELLE' });

    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED }, laxiste))).toBe(
      'PHASE2_METHOD_REQUIRED',
    );
  });

  it('la clôture et le statut de phase 2 sortent de l’EFFET du motif, PAS de l’issue', () => {
    const clot = normalizeAttempt(
      { outcome: CallOutcome.UNREACHABLE },
      reason({ effect: CallOutcomeEffect.CLOSE_REFUSED }),
    );
    expect(clot.terminal).toBe(true);
    expect(clot.phase2Status).toBe(Phase2Status.REFUSED);

    const laisse = normalizeAttempt({ outcome: CallOutcome.REFUSED }, reason());
    expect(laisse.terminal).toBe(false);
    expect(laisse.phase2Status).toBeNull();

    const ouvert = normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }, reason());
    expect(ouvert.terminal).toBe(false);
    expect(ouvert.phase2Status).toBeNull();
  });

  it('rompt sur une issue sans motif système, plutôt que de la laisser passer', () => {
    expect(() => systemReasonFor('INCONNUE' as CallOutcome)).toThrow(/motif système/);
  });
});
