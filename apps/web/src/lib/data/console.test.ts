import { describe, expect, it, vi } from 'vitest';

import {
  ALREADY_COMPLETED,
  AttemptRefused,
  buildAttemptBatch,
  callbackHalfHours,
  callbackSlots,
  COMMENT_MAX_LENGTH,
  conversionErrorFor,
  conversionFrom,
  fetchCallbacks,
  formatCallbackAt,
  lireBrouillon,
  formatDelay,
  pushCallAttempt,
  sortCallbacks,
  uuidV7,
  validateAttempt,
  validateConversion,
  type AttemptInput,
  type Callback,
  type ConversionDraft,
} from '@/lib/data/console';
import { prospectFixture } from '@/test/prospect-fixture';

const NOW = Date.parse('2026-08-16T12:00:00.000Z');

type QueryCall = [string, { params: { query: Record<string, unknown> } }];

const prospect = prospectFixture;

describe('validateAttempt', () => {
  it('exige une méthode sur METHOD_OBTAINED', () => {
    expect(validateAttempt({ outcome: 'METHOD_OBTAINED', method: null, comment: '' })).toMatch(
      /méthode obtenue/i,
    );
  });

  it('refuse une méthode sur toute autre issue', () => {
    expect(validateAttempt({ outcome: 'CALLBACK', method: 'PLATFORM', comment: '' })).toMatch(
      /Méthode obtenue/,
    );
  });

  it('exige un commentaire non vide sur OTHER', () => {
    expect(validateAttempt({ outcome: 'OTHER', method: null, comment: '   ' })).toMatch(/Autre/);
  });

  it('borne le commentaire à 2000 caractères', () => {
    const comment = 'a'.repeat(COMMENT_MAX_LENGTH + 1);
    expect(validateAttempt({ outcome: 'CALLBACK', method: null, comment })).toMatch(/dépasse/);
    expect(
      validateAttempt({ outcome: 'CALLBACK', method: null, comment: comment.slice(1) }),
    ).toBeNull();
  });

  it('laisse passer les combinaisons admises', () => {
    expect(
      validateAttempt({ outcome: 'METHOD_OBTAINED', method: 'PHYSICAL', comment: '' }),
    ).toBeNull();
    expect(validateAttempt({ outcome: 'UNREACHABLE', method: null, comment: '' })).toBeNull();
    expect(validateAttempt({ outcome: 'OTHER', method: null, comment: 'ligne coupée' })).toBeNull();
  });
});

describe('uuidV7', () => {
  it('produit un identifiant de version 7 et de variante RFC', () => {
    const id = uuidV7(NOW, () => 0.5);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('porte l’horodatage en tête, ce qui garde les clés ordonnées', () => {
    const early = uuidV7(NOW, () => 0.5);
    const late = uuidV7(NOW + 60_000, () => 0.5);
    expect(early < late).toBe(true);
  });
});

describe('buildAttemptBatch', () => {
  const input: AttemptInput = {
    prospectId: 'p-1',
    draft: { outcome: 'METHOD_OBTAINED', method: 'PLATFORM', comment: '  ' },
    attemptId: 'a-1',
    batchId: 'b-1',
    at: '2026-08-16T12:00:00.000Z',
  };

  it('envoie une seule opération call_attempt, en création', () => {
    const batch = buildAttemptBatch(input);

    expect(batch.clientBatchId).toBe('b-1');
    expect(batch.payloadVersion).toBe(1);
    expect(batch.operations).toHaveLength(1);
    expect(batch.operations[0]).toMatchObject({
      opId: 'a-1',
      seq: 0,
      entity: 'call_attempt',
      op: 'create',
      entityId: 'a-1',
    });
  });

  it('omet un commentaire vide plutôt que d’envoyer une chaîne blanche', () => {
    expect(buildAttemptBatch(input).operations[0]?.data).not.toHaveProperty('comment');
  });

  it('omet la méthode quand l’issue n’en porte pas', () => {
    const batch = buildAttemptBatch({
      ...input,
      draft: { outcome: 'CALLBACK', method: null, comment: 'rappeler lundi' },
    });

    expect(batch.operations[0]?.data).not.toHaveProperty('method');
    expect(batch.operations[0]?.data?.comment).toBe('rappeler lundi');
  });

  it('porte les renseignements de conversion sous les noms du contrat', () => {
    const batch = buildAttemptBatch({
      ...input,
      draft: {
        outcome: 'METHOD_OBTAINED',
        method: 'APPOINTMENT',
        comment: 'rappelé par son représentant',
        conversion: {
          ...conversion(),
          method: 'APPOINTMENT',
          rendezVousAt: '2026-09-01T10:30',
        },
      },
    });

    expect(batch.operations[0]?.data).toMatchObject({
      nom: 'Diallo',
      prenom: 'Mamadou',
      email: 'mamadou@example.sn',
      profession: 'Instituteur',
      syndicatId: 's-1',
      banqueId: 'b-1',
      type: 'FONCTIONNAIRE',
      incomeBandId: 'i-1',
      paymentMode: 'ECHELONNE',
      dureeSystemeMois: 24,
      dureeEtablissementMois: 36,
      fonctionnaire: true,
      engagementEnCours: false,
      rendezVousAt: '2026-09-01T10:30:00.000Z',
      comment: 'rappelé par son représentant',
    });
  });

  it('n’envoie ni champ vide ni question non posée', () => {
    const batch = buildAttemptBatch({
      ...input,
      draft: {
        outcome: 'METHOD_OBTAINED',
        method: 'PLATFORM',
        comment: '',
        conversion: {
          ...conversion(),
          prenom: '  ',
          email: '',
          profession: '',
          dureeEtablissementMois: '',
          fonctionnaire: null,
          engagementEnCours: null,
          syndicatId: '',
          banqueId: '',
          type: null,
          incomeBandId: '',
          paymentMode: null,
          dureeSystemeMois: '',
        },
      },
    });
    const data = batch.operations[0]?.data ?? {};

    for (const field of [
      'prenom',
      'email',
      'profession',
      'dureeEtablissementMois',
      'fonctionnaire',
      'engagementEnCours',
      'syndicatId',
      'banqueId',
      'type',
      'incomeBandId',
      'paymentMode',
      'dureeSystemeMois',
      'rendezVousAt',
    ]) {
      expect(data).not.toHaveProperty(field);
    }
    expect(data.nom).toBe('Diallo');
  });

  it('n’envoie aucun rendez-vous quand la méthode n’est pas la prise de rendez-vous', () => {
    const batch = buildAttemptBatch({
      ...input,
      draft: {
        outcome: 'METHOD_OBTAINED',
        method: 'PLATFORM',
        comment: '',
        conversion: { ...conversion(), method: 'PLATFORM', rendezVousAt: '2026-09-01T10:30' },
      },
    });

    expect(batch.operations[0]?.data).not.toHaveProperty('rendezVousAt');
  });
});

function conversion(over: Partial<ConversionDraft> = {}): ConversionDraft {
  return {
    projet: 'CHUES',
    nom: 'Diallo',
    prenom: 'Mamadou',
    email: 'mamadou@example.sn',
    profession: 'Instituteur',
    type: 'FONCTIONNAIRE',
    dureeEtablissementMois: '36',
    fonctionnaire: true,
    syndicatId: 's-1',
    banqueId: 'b-1',
    engagementEnCours: false,
    incomeBandId: 'i-1',
    paymentMode: 'ECHELONNE',
    dureeSystemeMois: '24',
    method: 'PLATFORM',
    rendezVousAt: '',
    ...over,
  };
}

describe('conversionFrom', () => {
  it('reprend ce que la fiche sait déjà, et ne devine rien du reste', () => {
    const draft = conversionFrom(
      prospect({ id: 'p-1', profession: 'Professeur', banqueId: 'b-9', syndicatId: 's-9' }),
      'APPOINTMENT',
    );

    expect(draft).toMatchObject({
      nom: 'Diallo',
      prenom: 'Mamadou',
      profession: 'Professeur',
      banqueId: 'b-9',
      syndicatId: 's-9',
      method: 'APPOINTMENT',
    });
    expect(draft.email).toBe('');
    expect(draft.fonctionnaire).toBeNull();
    expect(draft.engagementEnCours).toBeNull();
    expect(draft.rendezVousAt).toBe('');
  });
});

describe('validateConversion', () => {
  it('laisse passer un formulaire rempli comme il faut', () => {
    expect(validateConversion(conversion(), NOW)).toEqual({});
  });

  it('exige le nom', () => {
    expect(validateConversion(conversion({ nom: '  ' }), NOW).nom).toMatch(/obligatoire/i);
  });

  it('refuse une adresse qui n’en est pas une', () => {
    expect(validateConversion(conversion({ email: 'mamadou' }), NOW).email).toMatch(/adresse/i);
    expect(validateConversion(conversion({ email: 'a@b.sn' }), NOW).email).toBeUndefined();
  });

  it('borne la durée à des mois entiers de 0 à 600', () => {
    for (const mois of ['601', '-1', '12,5']) {
      expect(
        validateConversion(conversion({ dureeEtablissementMois: mois }), NOW)
          .dureeEtablissementMois,
      ).toMatch(/mois entiers/);
    }
    expect(
      validateConversion(conversion({ dureeEtablissementMois: '600' }), NOW).dureeEtablissementMois,
    ).toBeUndefined();
  });

  it('sur CHUES, l’adhésion exige le dossier complet', () => {
    const vide = conversion({
      prenom: '',
      email: '',
      profession: '',
      dureeEtablissementMois: '',
      fonctionnaire: null,
      syndicatId: '',
      banqueId: '',
      engagementEnCours: null,
      incomeBandId: '',
      dureeSystemeMois: '',
    });

    expect(Object.keys(validateConversion(vide, NOW)).sort()).toEqual(
      [
        'banqueId',
        'dureeEtablissementMois',
        'dureeSystemeMois',
        'engagementEnCours',
        'fonctionnaire',
        'incomeBandId',
        'prenom',
        'profession',
        'syndicatId',
      ].sort(),
    );
    expect(validateConversion(vide, NOW).fonctionnaire).toMatch(/fonctionnaire/);
  });

  it('l’e-mail reste facultatif, même sur CHUES', () => {
    expect(validateConversion(conversion({ email: '' }), NOW)).toEqual({});
  });

  it('exige la méthode d’enrôlement', () => {
    expect(validateConversion(conversion({ method: null }), NOW).method).toMatch(/méthode/);
  });

  it('sur le Grand Public, seul le nom est exigé', () => {
    const vide = conversion({
      projet: 'GRAND_PUBLIC',
      prenom: '',
      email: '',
      profession: '',
      dureeEtablissementMois: '',
      fonctionnaire: null,
      syndicatId: '',
      banqueId: '',
      engagementEnCours: null,
      incomeBandId: '',
      dureeSystemeMois: '',
    });

    expect(validateConversion(vide, NOW)).toEqual({});
  });

  it('borne la durée du système à des mois entiers de 1 à 300', () => {
    for (const mois of ['0', '301', '12,5']) {
      expect(
        validateConversion(conversion({ dureeSystemeMois: mois }), NOW).dureeSystemeMois,
      ).toMatch(/mois entiers/);
    }
    expect(
      validateConversion(conversion({ projet: 'GRAND_PUBLIC', dureeSystemeMois: '' }), NOW)
        .dureeSystemeMois,
    ).toBeUndefined();
  });

  it('exige la date du rendez-vous, et elle seule, sur APPOINTMENT', () => {
    const sansDate = conversion({ method: 'APPOINTMENT' });
    expect(validateConversion(sansDate, NOW).rendezVousAt).toMatch(/exige la date/);

    const passee = conversion({ method: 'APPOINTMENT', rendezVousAt: '2026-08-16T11:00' });
    expect(validateConversion(passee, NOW).rendezVousAt).toMatch(/précéder l’appel/);

    const venir = conversion({ method: 'APPOINTMENT', rendezVousAt: '2026-08-20T09:00' });
    expect(validateConversion(venir, NOW).rendezVousAt).toBeUndefined();
  });

  it('refuse une date de rendez-vous sur toute autre méthode', () => {
    const draft = conversion({ method: 'PLATFORM', rendezVousAt: '2026-08-20T09:00' });
    expect(validateConversion(draft, NOW).rendezVousAt).toMatch(/Prise de rendez-vous/);
  });
});

describe('lireBrouillon', () => {
  it('rend le commentaire ET le dossier deja saisi', () => {
    const garde = { comment: 'il est en réunion', conversion: conversion({ banqueId: 'b-7' }) };

    const repris = lireBrouillon(garde);

    expect(repris.comment).toBe('il est en réunion');
    expect(repris.conversion).toEqual(conversion({ banqueId: 'b-7' }));
  });

  it('rend un formulaire vide plutôt qu’une erreur sur un brouillon abîmé', () => {
    for (const abime of [null, undefined, 'texte', 42, [], { comment: 12 }]) {
      expect(lireBrouillon(abime)).toEqual({ comment: '', conversion: null });
    }
  });

  it('garde le commentaire quand le dossier vient d’une version antérieure', () => {
    const ancien = {
      comment: 'à rappeler lundi',
      conversion: { nom: 'Diallo', banque: 'CBAO' },
    };

    expect(lireBrouillon(ancien)).toEqual({ comment: 'à rappeler lundi', conversion: null });
  });

  it('refuse une valeur que le formulaire ne saurait pas afficher', () => {
    const inconnu = { comment: '', conversion: conversion({ method: 'TELEPATHIE' as never }) };

    expect(lireBrouillon(inconnu).conversion).toBeNull();
  });
});

describe('conversionErrorFor', () => {
  it('range chaque refus du serveur sous le champ fautif', () => {
    expect(conversionErrorFor('PHASE2_RENDEZ_VOUS_REQUIRED')?.field).toBe('rendezVousAt');
    expect(conversionErrorFor('PHASE2_RENDEZ_VOUS_NOT_ALLOWED')?.field).toBe('rendezVousAt');
    expect(conversionErrorFor('PHASE2_RENDEZ_VOUS_INVALID')?.field).toBe('rendezVousAt');
    expect(conversionErrorFor('PHASE2_RENDEZ_VOUS_PAST')?.field).toBe('rendezVousAt');
    expect(conversionErrorFor('PHASE2_EMAIL_INVALID')?.field).toBe('email');
    expect(conversionErrorFor('PHASE2_DUREE_ETABLISSEMENT_INVALID')?.field).toBe(
      'dureeEtablissementMois',
    );
  });

  it('donne un message français, jamais le code brut', () => {
    for (const code of ['PHASE2_EMAIL_INVALID', 'PHASE2_RENDEZ_VOUS_PAST']) {
      expect(conversionErrorFor(code)?.message).not.toMatch(/PHASE2_/);
    }
  });

  it('ne connaît pas les codes qui ne visent aucun champ', () => {
    expect(conversionErrorFor(ALREADY_COMPLETED)).toBeNull();
  });
});

function fakeSyncClient(result: {
  status: string;
  errorCode?: string | null;
  error?: string | null;
}) {
  const calls: { header: unknown; body: unknown }[] = [];
  const client = {
    POST: (_path: string, init: { params: { header: unknown }; body: unknown }) => {
      calls.push({ header: init.params.header, body: init.body });
      return Promise.resolve({
        data: {
          batchId: 'b-1',
          serverTime: '2026-08-16T12:00:00.000Z',
          results: [
            {
              opId: 'a-1',
              status: result.status,
              entityId: 'a-1',
              rev: 2,
              serverUpdatedAt: '2026-08-16T12:00:00.000Z',
              errorCode: result.errorCode ?? null,
              error: result.error ?? null,
            },
          ],
          nextCursor: null,
        },
        response: new Response(),
      });
    },
  };
  return { client, calls };
}

const INPUT: AttemptInput = {
  prospectId: 'p-1',
  draft: { outcome: 'UNREACHABLE', method: null, comment: '' },
  attemptId: 'a-1',
  batchId: 'b-1',
  at: '2026-08-16T12:00:00.000Z',
};

describe('pushCallAttempt', () => {
  it('répète la clé de lot dans l’en-tête d’idempotence', async () => {
    const fake = fakeSyncClient({ status: 'applied' });

    await pushCallAttempt(INPUT, fake.client as never);

    expect(fake.calls[0]?.header).toEqual({ 'Idempotency-Key': 'b-1' });
  });

  it('accepte un rejeu : la tentative était déjà enregistrée', async () => {
    const fake = fakeSyncClient({ status: 'duplicate' });
    await expect(pushCallAttempt(INPUT, fake.client as never)).resolves.toBeUndefined();
  });

  it('lève le refus du serveur, que le lot renvoie en 200', async () => {
    const fake = fakeSyncClient({
      status: 'conflict',
      errorCode: ALREADY_COMPLETED,
      error: 'La fiche est déjà close.',
    });

    await expect(pushCallAttempt(INPUT, fake.client as never)).rejects.toThrow(AttemptRefused);
    await expect(pushCallAttempt(INPUT, fake.client as never)).rejects.toMatchObject({
      code: ALREADY_COMPLETED,
      message: 'La fiche est déjà close.',
    });
  });
});

const THURSDAY = Date.parse('2026-08-13T10:00:00.000Z');

describe('callbackSlots', () => {
  it('propose six échéances, calculées sur l’horloge de Dakar', () => {
    expect(callbackSlots(THURSDAY)).toEqual([
      { key: '1', label: 'Dans 1 h', at: '2026-08-13T11:00:00.000Z' },
      { key: '2', label: 'Cet après-midi (15 h)', at: '2026-08-13T15:00:00.000Z' },
      { key: '3', label: 'Demain 9 h', at: '2026-08-14T09:00:00.000Z' },
      { key: '4', label: 'Demain 15 h', at: '2026-08-14T15:00:00.000Z' },
      { key: '5', label: 'Lundi 9 h', at: '2026-08-17T09:00:00.000Z' },
      { key: '6', label: 'Dans 3 jours', at: '2026-08-16T09:00:00.000Z' },
    ]);
  });

  it('retire une proposition déjà passée et renumérote les chiffres', () => {
    const slots = callbackSlots(Date.parse('2026-08-13T16:00:00.000Z'));

    expect(slots.map((slot) => slot.label)).not.toContain('Cet après-midi (15 h)');
    expect(slots.map((slot) => slot.key)).toEqual(['1', '2', '3', '4', '5']);
    expect(slots[0]).toEqual({ key: '1', label: 'Dans 1 h', at: '2026-08-13T17:00:00.000Z' });
  });

  it('ne propose pas deux fois la même heure', () => {
    const sunday = callbackSlots(Date.parse('2026-08-16T12:00:00.000Z'));

    expect(sunday.filter((slot) => slot.at === '2026-08-17T09:00:00.000Z')).toHaveLength(1);
    expect(sunday.map((slot) => slot.label)).not.toContain('Lundi 9 h');
  });
});

describe('callbackHalfHours', () => {
  it('couvre les demi-heures ouvrées, de 08 h 00 à 19 h 00', () => {
    const heures = callbackHalfHours(THURSDAY, '2026-08-14');

    expect(heures).toHaveLength(23);
    expect(heures[0]).toEqual({ key: '1', label: '08 h 00', at: '2026-08-14T08:00:00.000Z' });
    expect(heures[1]?.label).toBe('08 h 30');
    expect(heures.at(-1)).toEqual({ key: '23', label: '19 h 00', at: '2026-08-14T19:00:00.000Z' });
  });

  it('retire les heures déjà passées du jour même', () => {
    const heures = callbackHalfHours(THURSDAY, '2026-08-13');

    expect(heures[0]?.label).toBe('10 h 30');
    expect(heures.map((heure) => heure.label)).not.toContain('08 h 00');
  });

  it('ne propose rien sur un jour entièrement écoulé', () => {
    expect(callbackHalfHours(THURSDAY, '2026-08-12')).toEqual([]);
  });
});

describe('formatCallbackAt', () => {
  it('nomme le jour tant qu’il se compte, puis donne la date', () => {
    expect(formatCallbackAt('2026-08-16T15:00:00.000Z', NOW)).toBe('aujourd’hui à 15:00');
    expect(formatCallbackAt('2026-08-17T09:00:00.000Z', NOW)).toBe('demain à 09:00');
    expect(formatCallbackAt('2026-08-19T09:30:00.000Z', NOW)).toBe('le 19/08 à 09:30');
  });
});

describe('formatDelay', () => {
  it('choisit l’unité que le lecteur attend', () => {
    expect(formatDelay(90_000)).toBe('1 min');
    expect(formatDelay(7_200_000)).toBe('2 h');
    expect(formatDelay(3 * 86_400_000)).toBe('3 j');
  });
});

function callback(over: Partial<Callback> & { id: string }): Callback {
  return {
    prospectId: `p-${over.id}`,
    shortCode: 'AB12CD',
    phoneE164: '+221771234567',
    scheduledAt: '2026-08-16T15:00:00.000Z',
    comment: null,
    assignedToId: 'u-1',
    assignedToName: 'Fatou Sow',
    overdue: false,
    ...over,
  };
}

describe('sortCallbacks', () => {
  it('met les retards en tête, du plus ancien au plus récent', () => {
    const sorted = sortCallbacks([
      callback({ id: 'a-venir', scheduledAt: '2026-08-16T18:00:00.000Z' }),
      callback({ id: 'retard-recent', scheduledAt: '2026-08-16T11:00:00.000Z', overdue: true }),
      callback({ id: 'retard-ancien', scheduledAt: '2026-08-15T09:00:00.000Z', overdue: true }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual(['retard-ancien', 'retard-recent', 'a-venir']);
  });
});

describe('fetchCallbacks', () => {
  const answer = () => ({
    data: { items: [], serverTime: '2026-08-16T12:00:00.000Z' },
    response: new Response(),
  });

  it('n’envoie aucun téléconseiller quand la file est celle de l’appelant', async () => {
    const get = vi.fn().mockResolvedValue(answer());

    await fetchCallbacks('overdue', null, { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query.scope).toBe('overdue');
    expect(init.params.query).not.toHaveProperty('assignedToId');
  });

  it('restreint la file au téléconseiller choisi', async () => {
    const get = vi.fn().mockResolvedValue(answer());

    await fetchCallbacks('week', 'u-2', { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query.assignedToId).toBe('u-2');
  });
});

describe('échéance de rappel dans le lot', () => {
  const base: AttemptInput = {
    prospectId: 'p-1',
    draft: { outcome: 'CALLBACK', method: null, comment: '', callbackAt: null },
    attemptId: 'a-1',
    batchId: 'b-1',
    at: '2026-08-16T12:00:00.000Z',
  };

  it('joint l’échéance choisie à la tentative', () => {
    const batch = buildAttemptBatch({
      ...base,
      draft: { ...base.draft, callbackAt: '2026-08-17T09:00:00.000Z' },
    });

    expect(batch.operations[0]?.data?.callbackAt).toBe('2026-08-17T09:00:00.000Z');
  });

  it('n’envoie aucune date quand aucune n’a été choisie', () => {
    expect(buildAttemptBatch(base).operations[0]?.data).not.toHaveProperty('callbackAt');
    expect(
      buildAttemptBatch({
        ...base,
        draft: { outcome: 'UNREACHABLE', method: null, comment: '' },
      }).operations[0]?.data,
    ).not.toHaveProperty('callbackAt');
  });

  it('refuse une date sur une autre issue, comme le fera le serveur', () => {
    expect(
      validateAttempt(
        {
          outcome: 'UNREACHABLE',
          method: null,
          comment: '',
          callbackAt: '2026-08-17T09:00:00.000Z',
        },
        NOW,
      ),
    ).toMatch(/À rappeler/);
  });

  it('refuse une échéance déjà passée', () => {
    expect(
      validateAttempt(
        {
          outcome: 'CALLBACK',
          method: null,
          comment: '',
          callbackAt: '2026-08-16T11:00:00.000Z',
        },
        NOW,
      ),
    ).toMatch(/à venir/);
    expect(
      validateAttempt(
        {
          outcome: 'CALLBACK',
          method: null,
          comment: '',
          callbackAt: '2026-08-16T15:00:00.000Z',
        },
        NOW,
      ),
    ).toBeNull();
  });
});
