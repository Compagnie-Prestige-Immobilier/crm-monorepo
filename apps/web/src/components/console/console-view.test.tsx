import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleView } from '@/components/console/console-view';
import { AttemptRefused, type AttemptInput, type ConversionDraft } from '@/lib/data/console';
import type * as ConsoleData from '@/lib/data/console';
import type * as OuverturesData from '@/lib/data/ouvertures';
import type * as ProspectsData from '@/lib/data/prospects';
import type * as ReferenceData from '@/lib/data/reference';
import type { CallOutcome, ProspectFilters, ProspectRow } from '@/lib/types';
import { prospectFixture } from '@/test/prospect-fixture';
import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';

const fetchProspects = vi.fn();
const fetchProspect = vi.fn();
const pushCallAttempt = vi.fn();
const fetchBanques = vi.fn();
const fetchSyndicats = vi.fn();
const fetchIncomeBands = vi.fn();
const ouvrirFiche = vi.fn();
const fetchOuvertureCourante = vi.fn();
const enregistrerBrouillon = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

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

vi.mock('@/lib/data/ouvertures', async (importOriginal) => {
  const actual = await importOriginal<typeof OuverturesData>();
  return {
    ...actual,
    ouvrirFiche: (...args: unknown[]) => ouvrirFiche(...args) as unknown,
    fetchOuvertureCourante: () => fetchOuvertureCourante() as unknown,
    enregistrerBrouillon: (...args: unknown[]) => enregistrerBrouillon(...args) as unknown,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    info: (message: string) => {
      toastInfo(message);
    },
    success: vi.fn(),
  },
}));

function prospect(over: Partial<ProspectRow> & { id: string }): ProspectRow {
  return prospectFixture({ representantId: 'r-9', ...over });
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

/** Désigne une fiche dans la liste, sans confirmer son ouverture. */
async function viser(row: ProspectRow): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: new RegExp(`${row.nom} ${row.prenom}`) }),
  );
}

/** Ouvre la première fiche servie, confirmation comprise (EB-07). */
async function renderConsole(items: readonly ProspectRow[] = [NEUVE, RAPPEL]) {
  const view = await renderListe(items);
  const premiere = items[0];
  if (premiere === undefined) throw new Error('renderConsole exige une fiche');
  await viser(premiere);
  if (premiere.phase2Status === 'PENDING') {
    await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }));
  }
  await screen.findByRole('heading', { level: 2 });
  return view;
}

const ouverture = (over: Partial<OuverturesData.OuvertureFiche> = {}) => ({
  id: 'ouv-1',
  openedById: 'u-1',
  openedByName: 'Fatou Sow',
  representantId: null,
  prospectId: 'p-1',
  ficheNom: 'Neuve Fiche',
  openedAt: new Date().toISOString(),
  closedAt: null,
  dureeSecondes: null,
  closingAttemptId: null,
  draft: null,
  releasedByName: null,
  releasedAt: null,
  ...over,
});

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
} => (pushCallAttempt.mock.calls.at(-1) as [AttemptInput])[0].draft;

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
  ouvrirFiche.mockReset();
  ouvrirFiche.mockImplementation((input: { prospectId: string }) =>
    Promise.resolve(ouverture({ prospectId: input.prospectId })),
  );
  fetchOuvertureCourante.mockReset();
  fetchOuvertureCourante.mockResolvedValue(null);
  enregistrerBrouillon.mockReset();
  enregistrerBrouillon.mockResolvedValue(ouverture());
  toastError.mockClear();
  toastInfo.mockClear();
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

  it('demande d’abord si la personne était joignable, rien d’autre', async () => {
    await renderConsole([NEUVE]);

    const fiche = within(screen.getByRole('region', { name: 'Fiche courante' }));
    expect(fiche.getByRole('group', { name: 'Comment s’est passé l’appel ?' })).toBeTruthy();
    for (const label of ['Joignable', 'À rappeler', 'Injoignable', 'Mauvais numéro', 'Autre']) {
      expect(fiche.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(fiche.queryByRole('button', { name: /Plateforme/ })).toBeNull();
    expect(fiche.queryByRole('button', { name: /Prise de rendez-vous/ })).toBeNull();
  });

  it('revient à la liste après enregistrement, sans sauter sur quelqu’un', async () => {
    await renderConsole();

    await userEvent.keyboard('3');

    expect((await screen.findByRole('status')).textContent).toBe(
      'Appel enregistré pour Neuve Fiche.',
    );
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.getByLabelText('Quel prospect avez-vous appelé ?')).toBeTruthy();
  });

  it('ne propose plus de revenir à la liste tant que rien n’est consigné', async () => {
    await renderConsole();

    expect(screen.queryByRole('button', { name: 'Revenir à la liste' })).toBeNull();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('ouvre la fiche demandée par les rappels, lue par son identifiant', async () => {
    setUrl('/chues/console?fiche=p-2');
    fetchProspect.mockResolvedValue(RAPPEL);
    serve([NEUVE]);
    renderWithQuery(<ConsoleView projet="CHUES" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }));

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
  const immediate: readonly [string, CallOutcome][] = [
    ['3', 'UNREACHABLE'],
    ['4', 'WRONG_NUMBER'],
  ];

  for (const [key, outcome] of immediate) {
    it(`consigne ${outcome} sans confirmation sur la touche ${key}`, async () => {
      await renderConsole();

      await userEvent.keyboard(key);

      await waitFor(() => {
        expect(pushCallAttempt).toHaveBeenCalledTimes(1);
      });
      expect(lastDraft()).toMatchObject({ outcome, method: null });
    });
  }

  it('chaque touche est doublée d’un bouton qui porte son chiffre', async () => {
    await renderConsole();

    const fiche = within(screen.getByRole('region', { name: 'Fiche courante' }));
    for (const key of ['1', '2', '3', '4', '5']) {
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

    await userEvent.keyboard('2');

    expect(screen.getByText('Demain 9 h')).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('consigne l’issue et l’heure promise sur le chiffre de la puce', async () => {
    await renderConsole();

    await userEvent.keyboard('2');
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

    await userEvent.keyboard('2');
    await userEvent.click(screen.getByRole('button', { name: /Demain 15 h/ }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBe(slotAt(new Date(), 1, 15));
  });

  it('accepte une échéance saisie à la main, à l’heure de Dakar', async () => {
    await renderConsole();

    await userEvent.keyboard('2');
    await userEvent.type(screen.getByLabelText(/Autre échéance/), '2027-03-04T11:30');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBe('2027-03-04T11:30:00.000Z');
  });

  it('n’envoie rien tant qu’aucune échéance n’est choisie', async () => {
    await renderConsole();

    await userEvent.keyboard('2');
    await userEvent.keyboard('{Enter}');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/échéance/));
  });

  it('Échap ramène aux issues, sans rien consigner', async () => {
    await renderConsole();

    await userEvent.keyboard('2');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Demain 9 h')).toBeNull();
    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('aucune autre issue n’emporte de date', async () => {
    await renderConsole();

    await userEvent.keyboard('3');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().callbackAt).toBeNull();
  });
});

describe('ConsoleView : joignable, le dossier', () => {
  const lastConversion = (): ConversionDraft | undefined => lastDraft().conversion;

  const submit = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l’adhésion/ }));
  };

  const choisirMethode = async (nom: string): Promise<void> => {
    await userEvent.click(await screen.findByRole('radio', { name: nom }));
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
    await userEvent.type(await screen.findByLabelText(/Durée dans l’établissement/), '36');
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
    await choisirMethode('Plateforme');
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

  it('« Joignable » ouvre le dossier au lieu d’envoyer l’appel', async () => {
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
    expect(screen.getByRole('button', { name: 'Il refuse' })).toBeTruthy();
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

  it('s’ouvre rempli de ce que la fiche sait déjà, sans méthode choisie d’office', async () => {
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
    for (const radio of screen.getAllByRole('radio', {
      name: /Plateforme|Physique|rendez-vous|Vocal/,
    })) {
      expect(radio).toHaveProperty('checked', false);
    }
  });

  it('sur CHUES, n’enregistre pas l’adhésion tant que le dossier est incomplet', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await submit();

    expect(await screen.findByText('Dites s’il est fonctionnaire.')).toBeTruthy();
    expect(screen.getByText('Choisissez la méthode d’enrôlement.')).toBeTruthy();
    expect(screen.queryByText(/adresse électronique est obligatoire/)).toBeNull();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('envoie tout le dossier avec l’appel, e-mail compris quand il est donné', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await completerDossier();
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'neuve@example.sn');
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

  it('enregistre l’adhésion sans e-mail', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await completerDossier();
    await submit();

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastConversion()?.email).toBe('');
  });

  it('« Il refuse » consigne le refus depuis le dossier, sans rien exiger', async () => {
    await renderConsole([NEUVE]);

    await userEvent.keyboard('1');
    await userEvent.click(await screen.findByRole('button', { name: 'Il refuse' }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({ outcome: 'REFUSED', method: null });
    expect(lastDraft().conversion).toBeUndefined();
  });

  it('sur le Grand Public, laisse « non demandé » quand la question n’a pas été posée', async () => {
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await choisirMethode('Plateforme');
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
    await choisirMethode('Plateforme');
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
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await choisirMethode('Prise de rendez-vous');
    await submit();

    expect(await screen.findByText(/exige la date du rendez-vous/)).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('consigne la date du rendez-vous à l’heure de Dakar', async () => {
    await renderConsole([GRAND_PUBLIC]);

    await userEvent.keyboard('1');
    await choisirMethode('Prise de rendez-vous');
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

    await userEvent.keyboard('1');
    await choisirMethode('Prise de rendez-vous');
    await userEvent.type(await screen.findByLabelText(/Date du rendez-vous/), '2027-03-04T11:30');
    await choisirMethode('Plateforme');
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
    await choisirMethode('Plateforme');
    await submit();

    const message = await screen.findByText(/mois entiers, de 0 à 600/);
    expect(
      screen.getByLabelText(/Durée dans l’établissement/).getAttribute('aria-describedby'),
    ).toContain(message.id);
  });

  it('Échap referme le dossier sans rien consigner', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Phase 3 · Conversion')).toBeNull();
    expect(screen.getByRole('button', { name: /Injoignable/ })).toBeTruthy();
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('rend les chiffres inertes tant que le dossier est ouvert', async () => {
    await renderConsole([RENSEIGNE]);

    await userEvent.keyboard('1');
    await screen.findByText('Phase 3 · Conversion');
    await userEvent.keyboard('3');

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

    await userEvent.keyboard('5');

    expect(document.activeElement).toBe(screen.getByLabelText(/Commentaire/));
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('refuse un commentaire vide, comme le fera le serveur', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('{Enter}');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Autre/));
  });

  it('valide sur Entrée une fois le commentaire saisi', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('ligne coupée{Enter}');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({ outcome: 'OTHER', comment: 'ligne coupée' });
  });

  it('ne consigne rien quand un chiffre est tapé DANS le commentaire', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('3');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '3');
  });

  it('Échap vide la saisie en cours, mais ne rend pas la fiche ouverte', async () => {
    await renderConsole();

    await userEvent.keyboard('5');
    await userEvent.keyboard('brouillon');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '');
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    expect(toastError.mock.calls.at(-1)?.[0]).toBe(
      'Consignez l’appel avant de quitter cette fiche.',
    );
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

    await userEvent.keyboard('3');

    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('bascule en lecture seule quand le serveur annonce la clôture', async () => {
    pushCallAttempt.mockRejectedValue(
      new AttemptRefused('PHASE2_ALREADY_COMPLETED', 'La fiche est déjà close.'),
    );
    await renderConsole([NEUVE]);

    await userEvent.keyboard('3');

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/déjà close/);
    });
    expect(toastError).toHaveBeenCalledWith('La fiche est déjà close.');
  });
});

describe('ConsoleView : raccourcis annexes', () => {
  const CONSULTEE = prospect({
    id: 'p-7',
    nom: 'Consultee',
    prenom: 'Fiche',
    phase2Status: 'REFUSED',
  });

  it('copie le numéro sur C, sans le faire retaper', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderConsole();

    await userEvent.keyboard('c');

    expect(writeText).toHaveBeenCalledWith('+221771234567');
  });

  it('ouvre la création de prospect sur le représentant courant', async () => {
    await renderConsole([CONSULTEE]);

    await userEvent.keyboard('n');

    expect(routerMock.push).toHaveBeenCalledWith('/chues/prospects/nouveau?rep=r-9');
  });

  it('ouvre la fiche du représentant', async () => {
    await renderConsole([CONSULTEE]);

    await userEvent.keyboard('r');

    expect(routerMock.push).toHaveBeenCalledWith('/chues/representants/r-9');
  });

  // EB-08 : le verrou ne tient que s'il tient AUSSI les navigations lancées par
  // le code, qu'aucun écouteur de clic ni de popstate ne voit passer.
  it('retient N et R tant que la fiche ouverte n’a pas d’issue', async () => {
    await renderConsole();

    await userEvent.keyboard('n');
    await userEvent.keyboard('r');

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenLastCalledWith('Consignez l’appel avant de quitter cette fiche.');
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

/** EB-07 à EB-10 : on confirme, on est tenu, le temps se voit, rien ne se perd. */
describe('ConsoleView : l’ouverture confirmée d’une fiche', () => {
  it('demande confirmation en nommant la fiche, et n’ouvre rien avant', async () => {
    await renderListe([NEUVE]);
    await viser(NEUVE);

    const boite = await screen.findByRole('dialog');
    expect(boite.textContent).toContain('Ouvrir la fiche de Neuve Fiche ?');
    expect(boite.textContent).toContain('Vous ne pourrez pas la quitter sans la qualifier.');
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(ouvrirFiche).not.toHaveBeenCalled();
  });

  it('renonce sans rien enregistrer', async () => {
    await renderListe([NEUVE]);
    await viser(NEUVE);
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(ouvrirFiche).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quel prospect avez-vous appelé ?')).toBeTruthy();
  });

  it('enregistre l’ouverture, puis montre le chronomètre', async () => {
    await renderConsole([NEUVE]);

    expect(ouvrirFiche.mock.calls[0]?.[0]).toMatchObject({ prospectId: 'p-1' });
    expect(screen.getByText(/Fiche ouverte depuis/u).textContent).toMatch(/\d\d:\d\d/u);
  });

  it('ferme l’ouverture avec la tentative : c’est ce qui arrête le chronomètre', async () => {
    await renderConsole([NEUVE]);

    await userEvent.keyboard('3');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({ ouvertureId: 'ouv-1' });
  });

  // Next.js n'expose aucune API de blocage : le clic sur un lien est l'une des
  // trois seules prises, avec la fermeture de l'onglet et le retour arrière.
  it('retient un clic vers un autre écran tant que rien n’est consigné', async () => {
    await renderConsole([NEUVE]);
    renderWithQuery(
      <Link href="/chues/rappels" data-testid="ailleurs">
        Rappels
      </Link>,
    );

    await userEvent.click(screen.getByTestId('ailleurs'));

    expect(toastError.mock.calls.at(-1)?.[0]).toBe(
      'Consignez l’appel avant de quitter cette fiche.',
    );
  });

  // Le serveur refuse la seconde ouverture sans dire laquelle est tenue : sans
  // ce rattrapage, le téléconseiller reste devant un refus qu'il ne peut pas lever.
  it('rouvre la fiche déjà en main quand le verrou du serveur refuse', async () => {
    ouvrirFiche.mockRejectedValue(new Error('OUVERTURE_FICHE_DEJA_OUVERTE'));
    fetchOuvertureCourante.mockResolvedValue(
      ouverture({ id: 'ouv-9', prospectId: 'p-2', ficheNom: 'Rappel Fiche' }),
    );
    fetchProspect.mockResolvedValue(RAPPEL);

    await renderConsole([NEUVE]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    expect(toastInfo.mock.calls.at(-1)?.[0]).toContain('Rappel Fiche');
  });

  // EB-10 : le brouillon part AVANT la tentative, qui referme l'ouverture.
  it('conserve les réponses saisies quand la personne demande à être rappelée', async () => {
    await renderConsole([NEUVE]);

    await userEvent.keyboard('2');
    await userEvent.type(screen.getByLabelText(/Commentaire/u), 'il est en réunion');
    await userEvent.click(screen.getByRole('button', { name: /Demain 9 h/u }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(enregistrerBrouillon).toHaveBeenCalledWith('ouv-1', { comment: 'il est en réunion' });
  });

  it('rouvre le formulaire sur ce que le brouillon avait gardé', async () => {
    ouvrirFiche.mockRejectedValue(new Error('OUVERTURE_FICHE_DEJA_OUVERTE'));
    fetchOuvertureCourante.mockResolvedValue(
      ouverture({ ficheNom: 'Neuve Fiche', draft: { comment: 'il est en réunion' } }),
    );
    fetchProspect.mockResolvedValue(NEUVE);

    await renderConsole([NEUVE]);

    expect(screen.getByLabelText(/Commentaire/u)).toHaveProperty('value', 'il est en réunion');
  });

  // EB-07 : la consultation d'une fiche close ne compte pas, et l'ouvrir sous
  // verrou y enfermerait quelqu'un qui ne peut plus rien y consigner.
  it('n’ouvre ni ne verrouille une fiche déjà close', async () => {
    const close = prospect({ id: 'p-8', nom: 'Close', prenom: 'Fiche', phase2Status: 'REFUSED' });
    await renderConsole([close]);

    expect(ouvrirFiche).not.toHaveBeenCalled();
    expect(screen.queryByText(/Fiche ouverte depuis/u)).toBeNull();
    expect(screen.getByRole('button', { name: 'Revenir à la liste' })).toBeTruthy();
  });
});
