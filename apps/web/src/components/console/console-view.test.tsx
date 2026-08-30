import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleView } from '@/components/console/console-view';
import { AttemptRefused, type AttemptInput, type ConversionDraft } from '@/lib/data/console';
import type * as ConsoleData from '@/lib/data/console';
import type * as ProspectsData from '@/lib/data/prospects';
import type * as ReferenceData from '@/lib/data/reference';
import type { CallOutcome, ProspectFilters, ProspectRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';

const fetchProspects = vi.fn();
const fetchProspect = vi.fn();
const pushCallAttempt = vi.fn();
const fetchBanques = vi.fn();
const fetchSyndicats = vi.fn();
const fetchIncomeBands = vi.fn();
const toastError = vi.fn();

const BANQUES = [
  { id: 'b-1', name: 'CBAO Sénégal', shortName: 'CBAO', isActive: true, sortOrder: 1 },
  { id: 'b-2', name: 'Banque de l’Habitat', shortName: 'BHS', isActive: true, sortOrder: 2 },
];
const SYNDICATS = [
  { id: 's-1', name: 'SUDES', sigle: 'SUDES', isActive: true, sortOrder: 1 },
  { id: 's-2', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 2 },
];
const TRANCHES = [
  {
    id: 'i-1',
    code: 'T1',
    label: 'Moins de 150 000 F',
    minXof: null,
    maxXof: 150_000,
    position: 1,
    isActive: true,
  },
  {
    id: 'i-2',
    code: 'T2',
    label: '150 000 à 300 000 F',
    minXof: 150_000,
    maxXof: 300_000,
    position: 2,
    isActive: true,
  },
];

vi.mock('@/lib/data/reference', async (importOriginal) => {
  const actual = await importOriginal<typeof ReferenceData>();
  return {
    ...actual,
    fetchBanques: () => fetchBanques() as unknown,
    fetchSyndicats: () => fetchSyndicats() as unknown,
    fetchIncomeBands: () => fetchIncomeBands() as unknown,
  };
});

vi.mock('@/lib/data/prospects', async (importOriginal) => {
  const actual = await importOriginal<typeof ProspectsData>();
  return {
    ...actual,
    fetchProspects: (...args: unknown[]) => fetchProspects(...args) as unknown,
    fetchProspect: (...args: unknown[]) => fetchProspect(...args) as unknown,
  };
});

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    pushCallAttempt: (...args: unknown[]) => pushCallAttempt(...args) as unknown,
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
  fetchProspects.mockResolvedValue({
    items: [...items],
    total: items.length,
    page: 1,
    pageSize: 20,
    pageCount: 1,
  });
}

async function renderListe(
  items: readonly ProspectRow[] = [NEUVE, RAPPEL],
  projet: 'CHUES' | 'GRAND_PUBLIC' = 'CHUES',
) {
  serve(items);
  const view = renderWithQuery(<ConsoleView projet={projet} />);
  await screen.findByLabelText('Quel prospect avez-vous appelé ?');
  return view;
}

/** Ouvre la première fiche servie, comme la téléconseillère le ferait. */
async function renderConsole(items: readonly ProspectRow[] = [NEUVE, RAPPEL]) {
  const view = await renderListe(items);
  const premiere = items[0];
  if (premiere === undefined) throw new Error('renderConsole exige une fiche');
  await userEvent.click(
    await screen.findByRole('button', { name: new RegExp(`${premiere.nom} ${premiere.prenom}`) }),
  );
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

const lastFilters = (): ProspectFilters => fetchProspects.mock.calls.at(-1)?.[0] as ProspectFilters;

beforeEach(() => {
  setUrl('/chues/console');
  fetchProspects.mockReset();
  fetchProspect.mockReset();
  pushCallAttempt.mockReset();
  pushCallAttempt.mockResolvedValue(undefined);
  fetchBanques.mockReset();
  fetchBanques.mockResolvedValue(BANQUES);
  fetchSyndicats.mockReset();
  fetchSyndicats.mockResolvedValue(SYNDICATS);
  fetchIncomeBands.mockReset();
  fetchIncomeBands.mockResolvedValue(TRANCHES);
  toastError.mockClear();
  routerMock.push.mockClear();
});

describe('ConsoleView : recherche', () => {
  it('ouvre sur la recherche, sans choisir de fiche', async () => {
    await renderListe();

    expect(document.activeElement).toBe(screen.getByLabelText('Quel prospect avez-vous appelé ?'));
    expect(await screen.findByRole('button', { name: /Neuve Fiche/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rappel Fiche/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('demande au serveur les vingt dernières fiches du projet', async () => {
    await renderListe();

    expect(lastFilters()).toMatchObject({
      projet: 'CHUES',
      search: '',
      pageSize: 20,
      sortBy: 'clientCreatedAt',
      sortDir: 'desc',
    });
  });

  it('cherche côté serveur ce qui est tapé', async () => {
    await renderListe();

    await userEvent.type(screen.getByLabelText('Quel prospect avez-vous appelé ?'), 'Rappel');

    await waitFor(() => {
      expect(lastFilters().search).toBe('Rappel');
    });
  });

  it('dit qu’une fiche déjà close l’est, dans la liste', async () => {
    await renderListe([prospect({ id: 'p-9', nom: 'Close', phase2Status: 'REFUSED' })]);

    expect((await screen.findByRole('button', { name: /Close/ })).textContent).toContain('Refus');
  });

  it('propose d’ajouter un prospect quand rien ne correspond', async () => {
    await renderListe([]);

    expect(await screen.findByText('Aucun prospect pour l’instant.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ajouter un prospect' }).getAttribute('href')).toBe(
      '/chues/prospects/nouveau',
    );
  });

  it('sur le Grand Public, cherche dans ce projet et ajoute chez lui', async () => {
    await renderListe([], 'GRAND_PUBLIC');

    expect(lastFilters().projet).toBe('GRAND_PUBLIC');
    expect(
      (await screen.findByRole('link', { name: 'Ajouter un prospect' })).getAttribute('href'),
    ).toBe('/grand-public/nouveau');
  });
});

describe('ConsoleView : fiche', () => {
  it('ouvre la fiche choisie dans les résultats', async () => {
    await renderConsole([RAPPEL, NEUVE]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    expect(screen.getByText(/« rappeler lundi »/)).toBeTruthy();
  });

  it('montre le numéro en grand, sans lien d’appel', async () => {
    const { container } = await renderConsole();

    expect(screen.getByText('+221 77 123 45 67')).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('pose le contexte de l’appel sous le numéro', async () => {
    await renderConsole([NEUVE]);

    const fiche = within(screen.getByRole('region', { name: 'Fiche courante' }));
    expect(fiche.getByText(/Représentant Aminata Ndiaye/u)).toBeTruthy();
    expect(fiche.getByText('Jamais appelée.')).toBeTruthy();
  });

  it('revient à la liste après enregistrement, sans sauter sur quelqu’un', async () => {
    await renderConsole();

    await userEvent.keyboard('4');

    expect((await screen.findByRole('status')).textContent).toBe(
      'Appel enregistré pour Neuve Fiche.',
    );
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.getByLabelText('Quel prospect avez-vous appelé ?')).toBeTruthy();
  });

  it('« Revenir à la liste » abandonne la fiche sans rien consigner', async () => {
    await renderConsole();

    await userEvent.click(screen.getByRole('button', { name: 'Revenir à la liste' }));

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('ouvre la fiche demandée par les rappels, lue par son identifiant', async () => {
    setUrl('/chues/console?fiche=p-2');
    fetchProspect.mockResolvedValue(RAPPEL);
    serve([NEUVE]);
    renderWithQuery(<ConsoleView projet="CHUES" />);

    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe('Rappel Fiche');
    expect(fetchProspect).toHaveBeenCalledWith('p-2');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('le dit quand la fiche demandée ne se charge pas, et rend la recherche', async () => {
    setUrl('/chues/console?fiche=p-absente');
    fetchProspect.mockRejectedValue(new Error('404'));
    serve([NEUVE]);
    renderWithQuery(<ConsoleView projet="CHUES" />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/n’a pas pu être chargée/);
    expect(screen.getByLabelText('Quel prospect avez-vous appelé ?')).toBeTruthy();
  });
});

describe('ConsoleView : une touche, une issue', () => {
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

  /** Un enseignant CHUES dont la fiche sait déjà l'essentiel. */
  const RENSEIGNE = prospect({
    id: 'p-1',
    nom: 'Neuve',
    prenom: 'Fiche',
    profession: 'Instituteur',
    banqueId: 'b-1',
    syndicatId: 's-1',
    incomeBandId: 'i-1',
    dureeSystemeMois: 24,
  });

  /** Ce que l'appel apprend et que la fiche ne porte pas encore. */
  const completerDossier = async (): Promise<void> => {
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
  };

  const GRAND_PUBLIC = prospect({
    id: 'p-3',
    nom: 'Grand',
    prenom: 'Public',
    projet: 'GRAND_PUBLIC',
    representantId: null,
    representantName: null,
    type: 'SECTEUR_PRIVE',
    incomeBandId: 'i-2',
    paymentMode: 'ECHELONNE',
    dureeSystemeMois: 24,
  });

  it('la méthode ouvre les renseignements au lieu d’envoyer l’appel', async () => {
    await renderConsole();

    await userEvent.keyboard('1');

    expect(await screen.findByText('Phase 3 · Conversion')).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('sur CHUES, rouvre le dossier de l’enseignant, sans situation ni paiement', async () => {
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
    for (const liste of [/Syndicat/, /Banque/, /Revenu mensuel/, /Durée du système de paiement/]) {
      expect(screen.getByRole('combobox', { name: liste })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Prise de rendez-vous' })).toBeTruthy();
    expect(screen.getByLabelText(/Commentaire/)).toBeTruthy();

    expect(screen.queryByRole('group', { name: 'Situation' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /^Paiement/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Non demandé' })).toBeNull();
  });

  it('sur le Grand Public, ajoute la situation, le paiement et « non demandé »', async () => {
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');

    expect(screen.getByRole('group', { name: 'Situation' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Secteur privé' })).toHaveProperty('checked', true);
    expect(screen.getAllByRole('radio', { name: 'Non demandé' })).toHaveLength(2);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Revenu mensuel/ }).textContent).toContain(
        '150 000 à 300 000 F',
      );
    });
    expect(screen.getByRole('combobox', { name: /^Paiement/ }).textContent).toContain('Échelonné');
    expect(
      screen.getByRole('combobox', { name: /Durée du système de paiement/ }).textContent,
    ).toContain('2 ans (24 mois)');
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
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Revenu mensuel/ }).textContent).toContain(
        'Moins de 150 000 F',
      );
    });
    expect(
      screen.getByRole('combobox', { name: /Durée du système de paiement/ }).textContent,
    ).toContain('2 ans (24 mois)');
  });

  it('sur CHUES, n’enregistre pas l’adhésion tant que le dossier est incomplet', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await submit();

    expect(await screen.findByText('L’adresse électronique est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Dites s’il est fonctionnaire.')).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('envoie tout le dossier avec l’appel', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await completerDossier();
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
      incomeBandId: 'i-1',
      dureeSystemeMois: '24',
      type: null,
      paymentMode: null,
      method: 'PLATFORM',
    });
  });

  it('sur le Grand Public, laisse « non demandé » quand la question n’a pas été posée', async () => {
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastConversion()?.fonctionnaire).toBeNull();
    expect(lastConversion()?.engagementEnCours).toBeNull();
  });

  it('sur le Grand Public, envoie la situation corrigée', async () => {
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Diaspora' }));
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastConversion()).toMatchObject({
      type: 'DIASPORA',
      incomeBandId: 'i-2',
      paymentMode: 'ECHELONNE',
      dureeSystemeMois: '24',
    });
  });

  it('la prise de rendez-vous réclame sa date, et ne part pas sans elle', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('9');
    await submit();

    expect(await screen.findByText(/exige la date du rendez-vous/)).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('consigne la date du rendez-vous à l’heure de Dakar', async () => {
    await renderConsole([GRAND_PUBLIC]);

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
    await renderConsole([GRAND_PUBLIC]);

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
    await renderConsole([GRAND_PUBLIC]);

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

  it('revient à la liste une fois l’adhésion enregistrée', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await completerDossier();
    await submit();

    expect((await screen.findByRole('status')).textContent).toBe(
      'Appel enregistré pour Neuve Fiche.',
    );
    expect(screen.queryByText('Phase 3 · Conversion')).toBeNull();
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

  it('Échap vide la saisie en cours, puis seulement revient à la liste', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('brouillon');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '');
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
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

describe('ConsoleView : raccourcis annexes', () => {
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

  it('garde la carte clavier repliée, dépliable sur ?, sans ↑ ↓ ni Espace', async () => {
    await renderConsole();

    const carte = (): HTMLDetailsElement | null =>
      screen.getByText(/Carte clavier/u).closest('details');
    expect(carte()?.open).toBe(false);

    await userEvent.keyboard('?');

    expect(carte()?.open).toBe(true);
    expect(screen.getByText('Copier le numéro')).toBeTruthy();
    expect(screen.queryByText('↑ ↓')).toBeNull();
    expect(screen.queryByText('Espace')).toBeNull();
  });
});
