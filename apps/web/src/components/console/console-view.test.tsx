import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleView } from '@/components/console/console-view';
import {
  AttemptRefused,
  type AttemptInput,
  type Callback,
  type ConversionDraft,
} from '@/lib/data/console';
import type * as ConsoleData from '@/lib/data/console';
import type * as ReferenceData from '@/lib/data/reference';
import type { CallOutcome, ProspectRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';

const fetchConsoleQueue = vi.fn();
const fetchConsoleCampaigns = vi.fn();
const fetchCallbacks = vi.fn();
const pushCallAttempt = vi.fn();
const fetchRepScriptQueue = vi.fn();
const fetchBanques = vi.fn();
const fetchSyndicats = vi.fn();
const toastError = vi.fn();

const BANQUES = [
  { id: 'b-1', name: 'CBAO Sénégal', shortName: 'CBAO', isActive: true, sortOrder: 1 },
  { id: 'b-2', name: 'Banque de l’Habitat', shortName: 'BHS', isActive: true, sortOrder: 2 },
];
const SYNDICATS = [
  { id: 's-1', name: 'SUDES', sigle: 'SUDES', isActive: true, sortOrder: 1 },
  { id: 's-2', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 2 },
];

vi.mock('@/lib/data/reference', async (importOriginal) => {
  const actual = await importOriginal<typeof ReferenceData>();
  return {
    ...actual,
    fetchBanques: () => fetchBanques() as unknown,
    fetchSyndicats: () => fetchSyndicats() as unknown,
  };
});

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    fetchConsoleQueue: (...args: unknown[]) => fetchConsoleQueue(...args) as unknown,
    fetchConsoleCampaigns: (...args: unknown[]) => fetchConsoleCampaigns(...args) as unknown,
    fetchCallbacks: (...args: unknown[]) => fetchCallbacks(...args) as unknown,
    pushCallAttempt: (...args: unknown[]) => pushCallAttempt(...args) as unknown,
    fetchRepScriptQueue: (...args: unknown[]) => fetchRepScriptQueue(...args) as unknown,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: vi.fn(),
  },
}));

function prospect(over: Partial<ProspectRow> & { id: string }): ProspectRow {
  return {
    nom: 'Diallo',
    prenom: 'Mamadou',
    phoneE164: '+221771234567',
    rev: 1,
    statut: 'NOUVEAU',
    banqueId: 'b-1',
    banqueName: 'CBAO',
    syndicatId: 's-1',
    syndicatSigle: 'SUDES',
    representantId: 'r-9',
    representantName: 'Aminata Ndiaye',
    representantPhoneE164: '+221770000000',
    departementId: 'd-1',
    departementName: 'Dakar',
    ownedByCommercialId: 'u-1',
    ownedByCommercialName: 'Fatou Sow',
    projet: 'CHUES',
    type: null,
    profession: null,
    professionId: null,
    professionIsTeaching: null,
    incomeBandId: null,
    incomeBandLabel: null,
    paymentMode: null,
    journeys: [],
    dureeSystemeMois: null,
    canalProvenanceId: null,
    canalProvenanceLabel: null,
    segment: 'BDD1',
    phase2Status: 'PENDING',
    enrollmentMethod: null,
    enrollmentCapturedById: null,
    enrollmentCapturedByName: null,
    enrollmentCapturedAt: null,
    lastOutcome: null,
    lastComment: null,
    lastAttemptAt: null,
    origin: null,
    originLabel: null,
    clientCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

const NEUVE = prospect({ id: 'p-1', nom: 'Neuve', prenom: 'Fiche' });
const RAPPEL = prospect({
  id: 'p-2',
  nom: 'Rappel',
  prenom: 'Fiche',
  lastOutcome: 'CALLBACK',
  lastAttemptAt: '2026-07-01T00:00:00.000Z',
  lastComment: 'rappeler lundi',
});

function serve(items: readonly ProspectRow[]): void {
  fetchConsoleQueue.mockResolvedValue({ items: [...items], total: items.length });
}

async function renderConsole(items: readonly ProspectRow[] = [NEUVE, RAPPEL]) {
  serve(items);
  const view = renderWithQuery(<ConsoleView />);
  await screen.findByRole('heading', { level: 2 });
  return view;
}

function slotAt(now: Date, plusDays: number, hour: number): string {
  const at = new Date(now);
  at.setUTCDate(at.getUTCDate() + plusDays);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString();
}

const lastDraft = (): {
  outcome: CallOutcome;
  method: string | null;
  comment: string;
  callbackAt?: string | null;
  conversion?: ConversionDraft;
} => (pushCallAttempt.mock.calls.at(-1)?.[0] as AttemptInput).draft;

function scheduled(prospectId: string, scheduledAt: string, overdue: boolean): Callback {
  return {
    id: `cb-${prospectId}`,
    prospectId,
    shortCode: 'AB12CD',
    phoneE164: '+221771234567',
    scheduledAt,
    comment: null,
    assignedToId: 'u-1',
    assignedToName: 'Fatou Sow',
    campaignId: null,
    taskId: null,
    overdue,
  };
}

function serveCallbacks(items: readonly Callback[]): void {
  fetchCallbacks.mockResolvedValue({
    items: [...items],
    serverTime: new Date().toISOString(),
  });
}

beforeEach(() => {
  fetchConsoleQueue.mockClear();
  fetchCallbacks.mockReset();
  serveCallbacks([]);
  fetchConsoleCampaigns.mockReset();
  fetchConsoleCampaigns.mockResolvedValue([]);
  pushCallAttempt.mockReset();
  pushCallAttempt.mockResolvedValue(undefined);
  fetchRepScriptQueue.mockReset();
  fetchRepScriptQueue.mockResolvedValue({ items: [], total: 0 });
  fetchBanques.mockReset();
  fetchBanques.mockResolvedValue(BANQUES);
  fetchSyndicats.mockReset();
  fetchSyndicats.mockResolvedValue(SYNDICATS);
  toastError.mockClear();
});

describe('ConsoleView : file', () => {
  it('ouvre d’abord la fiche jamais appelée, avant un rappel plus ancien', async () => {
    await renderConsole([RAPPEL, NEUVE]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');
  });

  it('dit qu’une fiche « à rappeler » n’a pas d’échéance, plutôt que d’en inventer une', async () => {
    await renderConsole();

    expect(await screen.findByText(/^rappel sans échéance · \d+ j$/)).toBeTruthy();
  });

  it('remonte un rappel dont l’heure est passée avant la fiche jamais appelée', async () => {
    serveCallbacks([scheduled('p-2', new Date(Date.now() - 7_200_000).toISOString(), true)]);
    await renderConsole([NEUVE, RAPPEL]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    });
    // La fiche jamais appelée passe derrière : elle attend dans le repli.
    await userEvent.click(screen.getByText(/Suivants à appeler/u));
    expect(screen.getByRole('button', { name: /Neuve Fiche/u })).toBeTruthy();
  });

  it('ne promet une heure que pour les fiches qui en portent une', async () => {
    await renderConsole();

    await userEvent.click(screen.getByRole('button', { name: 'Pourquoi cet ordre ?' }));

    expect(await screen.findByText(/pas une date promise/)).toBeTruthy();
    expect(screen.queryByText(/Aucune échéance de rappel n’existe en base/)).toBeNull();
  });

  it('ouvre la fiche demandée par la file des rappels', async () => {
    setUrl('/chues/console?fiche=p-2');
    await renderConsole([NEUVE, RAPPEL]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('le dit quand la fiche demandée n’est pas dans la file chargée', async () => {
    setUrl('/chues/console?fiche=p-absente');
    await renderConsole([NEUVE, RAPPEL]);

    expect(screen.getByRole('alert').textContent).toMatch(/n’est pas dans cette file/);
  });

  it('montre le numéro en grand, sans lien d’appel', async () => {
    const { container } = await renderConsole();

    expect(screen.getByText('+221 77 123 45 67')).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});

describe('ConsoleView : une touche, une issue', () => {
  // Les méthodes n'y figurent plus : depuis la phase 3, elles ouvrent les
  // renseignements de conversion au lieu de partir seules.
  const immediate: readonly [string, CallOutcome, string | null][] = [
    ['4', 'UNREACHABLE', null],
    ['6', 'REFUSED', null],
    ['7', 'WRONG_NUMBER', null],
  ];

  for (const [key, outcome, method] of immediate) {
    it(`consigne ${outcome} sans confirmation sur la touche ${key}`, async () => {
      await renderConsole();

      await userEvent.keyboard(key);

      await waitFor(() => {
        expect(pushCallAttempt).toHaveBeenCalledTimes(1);
      });
      expect(lastDraft()).toMatchObject({ outcome, method });
    });
  }

  it('enchaîne seule sur la fiche suivante après consignation', async () => {
    await renderConsole();

    await userEvent.keyboard('4');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    });
    expect(screen.queryByRole('button', { name: /suivant/i })).toBeNull();
  });

  it('enchaîne sur la fiche suivante et le dit, une fois l’appel consigné', async () => {
    await renderConsole();

    await userEvent.keyboard('1');
    await userEvent.click(await screen.findByRole('button', { name: /Enregistrer l’adhésion/ }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Enregistré. Personne suivante.');
    });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
  });

  it('chaque touche est doublée d’un bouton qui porte son chiffre', async () => {
    await renderConsole();

    const fiche = within(screen.getByRole('region', { name: 'Fiche courante' }));
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(fiche.getByText(key, { selector: 'kbd' })).toBeTruthy();
    }
  });

  it('le bouton visible consigne la même issue que la touche', async () => {
    await renderConsole();

    await userEvent.click(screen.getByRole('button', { name: /Injoignable/ }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().outcome).toBe('UNREACHABLE');
  });
});

describe('ConsoleView : échéance du rappel', () => {
  it('demande quand rappeler au lieu d’envoyer aussitôt', async () => {
    await renderConsole();

    await userEvent.keyboard('5');

    expect(screen.getByText('Demain 9 h')).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('consigne l’issue et l’heure promise sur le chiffre de la puce', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    const demain = screen.getByRole('button', { name: /Demain 9 h/ });
    await userEvent.keyboard(within(demain).getByText(/^\d$/).textContent);

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().outcome).toBe('CALLBACK');
    expect(demain.textContent).toContain('demain à 09:00');
    expect(lastDraft().callbackAt).toBe(slotAt(new Date(), 1, 9));
  });

  it('la puce cliquée consigne la même échéance que son chiffre', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.click(screen.getByRole('button', { name: /Demain 15 h/ }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBe(slotAt(new Date(), 1, 15));
  });

  it('accepte une échéance saisie à la main, à l’heure de Dakar', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.type(screen.getByLabelText(/Autre échéance/), '2027-03-04T11:30');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBe('2027-03-04T11:30:00.000Z');
  });

  it('n’envoie rien tant qu’aucune échéance n’est choisie', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('{Enter}');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/échéance/));
  });

  it('Échap ramène aux issues, sans rien consigner', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Demain 9 h')).toBeNull();
    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('aucune autre issue n’emporte de date', async () => {
    await renderConsole();

    await userEvent.keyboard('4');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBeNull();
  });
});

describe('ConsoleView : phase 3 · Conversion', () => {
  const lastConversion = (): ConversionDraft | undefined => lastDraft().conversion;

  const submit = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l’adhésion/ }));
  };

  const RENSEIGNE = prospect({
    id: 'p-1',
    nom: 'Neuve',
    prenom: 'Fiche',
    profession: 'Instituteur',
    banqueId: 'b-1',
    syndicatId: 's-1',
  });

  it('la méthode ouvre les renseignements au lieu d’envoyer l’appel', async () => {
    await renderConsole();

    await userEvent.keyboard('1');

    expect(await screen.findByText('Phase 3 · Conversion')).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('demande les onze renseignements, dans l’ordre du script', async () => {
    await renderConsole();

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');

    for (const label of [
      /^Nom/,
      /^Prénom/,
      /^Téléphone/,
      /^E-mail/,
      /^Profession/,
      /Durée dans l’établissement/,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    for (const groupe of ['Fonctionnaire', 'Engagement en cours à la banque']) {
      expect(screen.getByRole('group', { name: groupe })).toBeTruthy();
    }
    for (const liste of [/Syndicat/, /Banque/]) {
      expect(screen.getByRole('combobox', { name: liste })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Prise de rendez-vous' })).toBeTruthy();
    expect(screen.getByLabelText(/Commentaire/)).toBeTruthy();
  });

  it('le téléphone se lit, il ne se corrige pas depuis un appel', async () => {
    await renderConsole();

    await userEvent.keyboard('1');

    expect(await screen.findByLabelText(/^Téléphone/)).toHaveProperty('readOnly', true);
  });

  it('s’ouvre rempli de ce que la fiche sait déjà', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');

    expect(await screen.findByLabelText(/^Nom/)).toHaveProperty('value', 'Neuve');
    expect(screen.getByLabelText(/^Prénom/)).toHaveProperty('value', 'Fiche');
    expect(screen.getByLabelText(/^Profession/)).toHaveProperty('value', 'Instituteur');
    expect(screen.getByRole('combobox', { name: /Banque/ }).textContent).toContain('CBAO');
    expect(screen.getByRole('combobox', { name: /Syndicat/ }).textContent).toContain('SUDES');
  });

  it('envoie tous les renseignements avec l’appel', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await userEvent.type(await screen.findByLabelText(/^E-mail/), 'neuve@example.sn');
    await userEvent.type(screen.getByLabelText(/Durée dans l’établissement/), '36');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Fonctionnaire' })).getByRole('radio', {
        name: 'Oui',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: /Engagement en cours/ })).getByRole('radio', {
        name: 'Non',
      }),
    );
    await userEvent.type(screen.getByLabelText(/Commentaire/), 'adhésion confirmée');
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({
      outcome: 'METHOD_OBTAINED',
      method: 'PLATFORM',
      comment: 'adhésion confirmée',
    });
    expect(lastConversion()).toMatchObject({
      nom: 'Neuve',
      prenom: 'Fiche',
      email: 'neuve@example.sn',
      profession: 'Instituteur',
      dureeEtablissementMois: '36',
      fonctionnaire: true,
      engagementEnCours: false,
      banqueId: 'b-1',
      syndicatId: 's-1',
      method: 'PLATFORM',
    });
  });

  it('laisse « non demandé » quand la question n’a pas été posée', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastConversion()?.fonctionnaire).toBeNull();
    expect(lastConversion()?.engagementEnCours).toBeNull();
  });

  it('la prise de rendez-vous réclame sa date, et ne part pas sans elle', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('9');
    await submit();

    expect(await screen.findByText(/exige la date du rendez-vous/)).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('consigne la date du rendez-vous à l’heure de Dakar', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('9');
    await userEvent.type(await screen.findByLabelText(/Date du rendez-vous/), '2027-03-04T11:30');
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().method).toBe('APPOINTMENT');
    expect(lastConversion()?.rendezVousAt).toBe('2027-03-04T11:30');
  });

  it('change de méthode sans laisser traîner la date du rendez-vous', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('9');
    await userEvent.type(await screen.findByLabelText(/Date du rendez-vous/), '2027-03-04T11:30');
    await userEvent.click(screen.getByRole('radio', { name: 'Plateforme' }));
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastConversion()?.rendezVousAt).toBe('');
  });

  it('refuse une adresse qui n’en est pas une, avant d’appeler le serveur', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await userEvent.type(await screen.findByLabelText(/^E-mail/), 'neuve');
    await submit();

    expect(await screen.findByText(/adresse électronique n’en est pas une/)).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('pose le refus du serveur sous le champ qu’il vise', async () => {
    pushCallAttempt.mockRejectedValue(
      new AttemptRefused('PHASE2_DUREE_ETABLISSEMENT_INVALID', 'Durée refusée.'),
    );
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await submit();

    const message = await screen.findByText(/mois entiers, de 0 à 600/);
    expect(
      screen.getByLabelText(/Durée dans l’établissement/).getAttribute('aria-describedby'),
    ).toContain(message.id);
  });

  it('Échap referme les renseignements sans rien consigner', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Phase 3 · Conversion')).toBeNull();
    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('rend les chiffres inertes tant que les renseignements sont ouverts', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await userEvent.keyboard('4');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(screen.getByText('Phase 3 · Conversion')).toBeTruthy();
  });
});

describe('ConsoleView : Autre et commentaire', () => {
  it('place le curseur dans le commentaire sans rien envoyer', async () => {
    await renderConsole();

    await userEvent.keyboard('8');

    expect(document.activeElement).toBe(screen.getByLabelText(/Commentaire/));
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('refuse un commentaire vide, comme le fera le serveur', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('{Enter}');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Autre/));
  });

  it('valide sur Entrée une fois le commentaire saisi', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('ligne coupée{Enter}');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({ outcome: 'OTHER', comment: 'ligne coupée' });
  });

  it('ne consigne rien quand un chiffre est tapé DANS le commentaire', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('4');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '4');
  });

  it('Échap vide la saisie en cours', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('brouillon');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '');
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });
});

describe('ConsoleView : fiche déjà close', () => {
  const CLOSE = prospect({
    id: 'p-9',
    nom: 'Close',
    prenom: 'Fiche',
    phase2Status: 'REFUSED',
    lastOutcome: 'REFUSED',
    lastAttemptAt: '2026-07-01T00:00:00.000Z',
  });

  it('passe en lecture seule, sans boutons d’issue', async () => {
    await renderConsole([CLOSE]);

    expect(screen.getByRole('status').textContent).toMatch(/déjà close/);
    expect(screen.queryByRole('button', { name: /Injoignable/ })).toBeNull();
  });

  it('ignore les touches d’issue sur une fiche close', async () => {
    await renderConsole([CLOSE]);

    await userEvent.keyboard('4');

    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('bascule en lecture seule quand le serveur annonce la clôture', async () => {
    pushCallAttempt.mockRejectedValue(
      new AttemptRefused('PHASE2_ALREADY_COMPLETED', 'La fiche est déjà close.'),
    );
    await renderConsole([NEUVE]);

    await userEvent.keyboard('4');

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/déjà close/);
    });
    expect(toastError).toHaveBeenCalledWith('La fiche est déjà close.');
  });
});

describe('ConsoleView : navigation et raccourcis annexes', () => {
  it('parcourt la file sans ouvrir la fiche, jusqu’à Espace', async () => {
    await renderConsole();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');

    await userEvent.keyboard(' ');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
  });

  it('ne remonte pas au-delà de la première fiche', async () => {
    await renderConsole();

    await userEvent.keyboard('{ArrowUp}{ArrowUp} ');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');
  });

  it('copie le numéro sur C, sans le faire retaper', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderConsole();

    await userEvent.keyboard('c');

    expect(writeText).toHaveBeenCalledWith('+221771234567');
  });

  it('ouvre la création de prospect sur le représentant courant', async () => {
    await renderConsole();

    await userEvent.keyboard('n');

    expect(routerMock.push).toHaveBeenCalledWith('/chues/prospects/nouveau?rep=r-9');
  });

  it('ouvre la fiche du représentant', async () => {
    await renderConsole();

    await userEvent.keyboard('r');

    expect(routerMock.push).toHaveBeenCalledWith('/chues/representants/r-9');
  });

  it('garde la carte clavier repliée en pied d’écran, dépliable sur ?', async () => {
    await renderConsole();

    const carte = (): HTMLDetailsElement | null =>
      screen.getByText(/Carte clavier/u).closest('details');
    expect(carte()?.open).toBe(false);

    await userEvent.keyboard('?');

    expect(carte()?.open).toBe(true);
    expect(screen.getByText('Copier le numéro')).toBeTruthy();
  });
});

describe('ConsoleView : une seule file', () => {
  it('appelle les prospects, sans jamais toucher à la file des représentants', async () => {
    await renderConsole();

    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(fetchRepScriptQueue).not.toHaveBeenCalled();
  });

  it('n’a plus de volet caché derrière M : l’écran ne change pas de nature', async () => {
    await renderConsole();

    await userEvent.keyboard('m');

    expect(screen.queryByRole('region', { name: 'File des représentants' })).toBeNull();
    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(fetchRepScriptQueue).not.toHaveBeenCalled();
  });
});

/** Rien à appeler : l'écran ne garde que ce qui décrit quelque chose de réel. */
describe('ConsoleView : file vide', () => {
  async function renderVide(): Promise<void> {
    serve([]);
    renderWithQuery(<ConsoleView />);
    await screen.findByText('Aucun prospect à appeler pour l’instant.');
  }

  it('ne propose que les deux gestes qui refont une file', async () => {
    await renderVide();

    expect(screen.getByRole('link', { name: 'Ajouter un prospect' }).getAttribute('href')).toBe(
      '/chues/prospects/nouveau',
    );
    expect(
      screen.getByRole('link', { name: 'Qualifier un représentant' }).getAttribute('href'),
    ).toBe('/chues/appels-representants');
  });

  it('ne décrit ni fiche ni file, puisqu’il n’y en a pas', async () => {
    await renderVide();

    expect(screen.queryByText(/à traiter/u)).toBeNull();
    expect(screen.queryByText('Pourquoi cet ordre ?')).toBeNull();
    expect(screen.queryByText('Dernier appel')).toBeNull();
    expect(screen.queryByText('Session')).toBeNull();
    expect(screen.queryByText('Carte clavier')).toBeNull();
    expect(screen.queryByRole('region', { name: 'File d’appel' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Contexte' })).toBeNull();
  });

  it('rend la fiche, sans rail ni compteur, dès qu’une personne attend', async () => {
    await renderConsole([NEUVE]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');
    expect(screen.queryByRole('region', { name: 'File d’appel' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Contexte' })).toBeNull();
    expect(screen.queryByText(/à traiter/u)).toBeNull();
    // Seule fiche en file : rien à replier derrière « Suivants à appeler ».
    expect(screen.queryByText(/Suivants à appeler/u)).toBeNull();
  });
});

/** Une fiche à la fois : la file et l'ordre se déroulent à la demande. */
describe('ConsoleView : une seule colonne', () => {
  it('replie les suivants derrière une ligne, avec l’ordre et la campagne', async () => {
    await renderConsole();

    const repli = screen.getByText(/Suivants à appeler/u);
    expect(repli.textContent).toBe('Suivants à appeler · 1');
    expect(repli.closest('details')?.open).toBe(false);

    await userEvent.click(repli);

    expect(repli.closest('details')?.open).toBe(true);
    expect(screen.getByRole('button', { name: 'Pourquoi cet ordre ?' })).toBeTruthy();
  });

  it('pose le contexte de l’appel sous le numéro, en lignes grises', async () => {
    await renderConsole([NEUVE]);

    const fiche = within(screen.getByRole('region', { name: 'Fiche courante' }));
    expect(fiche.getByText(/Représentant Aminata Ndiaye/u)).toBeTruthy();
    expect(fiche.getByText('Jamais appelée.')).toBeTruthy();
  });
});
