import type { ApiClient } from '@crm/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ETAPES } from '@/components/chues/etapes';
import { HubView } from '@/components/chues/hub-view';
import { RepScript } from '@/components/console/rep-script';
import { navTitle } from '@/components/layout/nav-items';
import type * as ConsoleData from '@/lib/data/console';
import type * as Phase2Data from '@/lib/data/phase2';
import type * as ReferenceData from '@/lib/data/reference';
import type * as RepresentantsData from '@/lib/data/representants';
import type { ScriptedRepresentant } from '@/lib/data/representants';
import type * as StatutsData from '@/lib/data/statuts-qualification';
import type { StatutQualification } from '@/lib/data/statuts-qualification';
import { REP_CALL_OUTCOME_LABELS } from '@/lib/types';
import type { RepresentantFilters } from '@/lib/representant-filters';
import { renderWithQuery } from '@/test/render-query';

const pushRepCallAttempt = vi.fn();
const fetchRepresentants = vi.fn();
const fetchRepresentantsAQualifier = vi.fn();
const fetchReferenceData = vi.fn();
const fetchStatutsQualification = vi.fn();
const countPendingProspects = vi.fn();
const fetchCallbacks = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    pushRepCallAttempt: (...args: unknown[]) => pushRepCallAttempt(...args) as unknown,
    fetchCallbacks: (...args: unknown[]) => fetchCallbacks(...args) as unknown,
  };
});

vi.mock('@/lib/data/phase2', async (importOriginal) => {
  const actual = await importOriginal<typeof Phase2Data>();
  return {
    ...actual,
    countPendingProspects: (...args: unknown[]) => countPendingProspects(...args) as unknown,
  };
});

vi.mock('@/lib/data/reference', async (importOriginal) => {
  const actual = await importOriginal<typeof ReferenceData>();
  return { ...actual, fetchReferenceData: (...args: unknown[]) => fetchReferenceData(...args) };
});

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return {
    ...actual,
    fetchRepresentants: (...args: unknown[]) => fetchRepresentants(...args),
    fetchRepresentantsAQualifier: (...args: unknown[]) => fetchRepresentantsAQualifier(...args),
  };
});

vi.mock('@/lib/data/statuts-qualification', async (importOriginal) => {
  const actual = await importOriginal<typeof StatutsData>();
  return { ...actual, fetchStatutsQualification: () => fetchStatutsQualification() as unknown };
});

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: (message: string) => {
      toastSuccess(message);
    },
  },
}));

function rep(over: Partial<ScriptedRepresentant> & { id: string }): ScriptedRepresentant {
  return {
    fullName: 'Aminata Ndiaye',
    phoneE164: '+221771234567',
    notes: null,
    rev: 1,
    departementId: 'd-1',
    departementName: 'Dakar',
    iefId: null,
    iefName: null,
    createdById: 'u-1',
    createdByName: 'Fatou Sow',
    clientCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    prospectCount: 0,
    relationStatus: 'INCONNU',
    whatsappStatus: 'NON_DEMANDE',
    whatsappE164: null,
    whatsappNumber: null,
    profession: null,
    prenom: null,
    etablissement: null,
    syndicat: null,
    connaitUES: null,
    contacte: null,
    lastCallOutcome: null,
    lastCallAt: null,
    lastCallById: null,
    lastCallByName: null,
    nextCallbackAt: null,
    ...over,
  };
}

function statut(over: Partial<StatutQualification> & { id: string }): StatutQualification {
  return {
    code: 'INTERESSE',
    label: 'Intéressé',
    effect: 'REACHED',
    requiresCallback: false,
    priorite: 'NORMALE',
    relationStatus: null,
    isActive: true,
    isSystem: true,
    minPayloadVersion: 6,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const STATUTS: StatutQualification[] = [
  statut({ id: 's-1' }),
  statut({ id: 's-2', code: 'NON_INTERESSE', label: 'Non intéressé', effect: 'REFUSED' }),
  statut({
    id: 's-3',
    code: 'A_RAPPELER',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresCallback: true,
  }),
  statut({ id: 's-4', code: 'PAS_DE_REPONSE', label: 'Pas de réponse', effect: 'UNREACHABLE' }),
];

const PREMIER = rep({ id: 'r-1', fullName: 'Aminata Ndiaye' });
const SECOND = rep({
  id: 'r-2',
  fullName: 'Ousmane Fall',
  phoneE164: '+221770000002',
  clientCreatedAt: '2026-02-01T00:00:00.000Z',
});

/** Une fiche que personne n'a confiée : elle ne s'atteint que par l'annuaire. */
const HORS_LISTE = rep({ id: 'r-9', fullName: 'Bineta Diop', phoneE164: '+221779876543' });

type PageMeta = Partial<{ total: number; page: number; pageCount: number }>;

const page = (items: readonly ScriptedRepresentant[], meta: PageMeta = {}) => ({
  items: [...items],
  total: items.length,
  page: 1,
  pageSize: 10,
  pageCount: 1,
  ...meta,
});

async function renderListe(
  file: readonly ScriptedRepresentant[] = [PREMIER, SECOND],
  meta: PageMeta = {},
) {
  fetchRepresentants.mockResolvedValue(page(file, meta));
  fetchRepresentantsAQualifier.mockResolvedValue(page(file, meta));
  const view = renderWithQuery(<RepScript />);
  await screen.findByLabelText('Qui avez-vous appelé ?');
  return view;
}

/** Ouvre la qualification de quelqu'un : la liste est là dès l'ouverture. */
async function choisir(nom: RegExp): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: nom }));
}

const relationDemandee = (): unknown =>
  (fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined)
    ?.relationStatus;

const choisirRelation = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Relation' }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};

const repondre = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: label }));
};

/** Répond à UNE question, désignée par sa légende, quand plusieurs Oui/Non coexistent. */
const repondreA = async (legende: string, label: string): Promise<void> => {
  const fieldset = screen.getByText(legende).closest('fieldset') as HTMLElement;
  await userEvent.click(within(fieldset).getByRole('button', { name: label }));
};

const choisirStatut = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: /Statut de qualification/u }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};

const injoindre = async (): Promise<void> => {
  await repondre('Injoignable');
  await choisirStatut('Pas de réponse');
};

/** Parcourt les questions 1 à 5 du script joignable, jusqu'à l'ambassadeur. */
const parcoursJoignable = async (
  ambassadeur: 'Oui' | 'Non',
  statutLabel = ambassadeur === 'Oui' ? 'Intéressé' : 'Non intéressé',
): Promise<void> => {
  await repondre('Joignable');
  await choisirStatut(statutLabel);
  await repondreA('L’établissement de la fiche est-il confirmé ?', 'Oui');
  await repondreA('A-t-il déjà été contacté ?', 'Oui');
  await repondreA('Connaît-il l’UES ?', 'Oui');
  await repondreA('Est-il représentant CPI CHUES ?', ambassadeur);
};

const dernierEnvoi = (): Record<string, unknown> => {
  const body = pushRepCallAttempt.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
  if (body === undefined) throw new Error('Aucune tentative envoyée.');
  return body;
};

beforeEach(() => {
  pushRepCallAttempt.mockReset();
  pushRepCallAttempt.mockResolvedValue({
    status: 'applied',
    attemptId: 'a-1',
    suggestion: null,
  });
  fetchRepresentants.mockReset();
  fetchRepresentantsAQualifier.mockReset();
  fetchRepresentants.mockResolvedValue(page([HORS_LISTE]));
  fetchStatutsQualification.mockReset();
  fetchStatutsQualification.mockResolvedValue(STATUTS);
  fetchReferenceData.mockReset();
  fetchReferenceData.mockResolvedValue({
    syndicats: [{ id: 'snd-saes', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 1 }],
  });
  toastError.mockClear();
  toastSuccess.mockClear();
});

describe('RepScript : rien n’est choisi d’office', () => {
  it('ouvre sur ses fiches, sans rien avoir cherché ni ouvert', async () => {
    await renderListe();

    expect(screen.getByLabelText('Qui avez-vous appelé ?')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByText(/Comment s’est passé l’appel/u)).toBeNull();
    expect(await screen.findByRole('button', { name: /Aminata Ndiaye/u })).toBeTruthy();
    expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({ search: '' });
  });

  it('n’ouvre la fiche et les questions qu’après un choix', async () => {
    await renderListe();

    await choisir(/Aminata Ndiaye/u);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Aminata Ndiaye');
    expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
  });

  it('porte la recherche saisie jusqu’au serveur', async () => {
    await renderListe([HORS_LISTE]);

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'Bineta');

    expect(await screen.findByRole('button', { name: /Bineta Diop/u })).toBeTruthy();
    await waitFor(
      () => {
        expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({
          search: 'Bineta',
        });
      },
      { timeout: 3000 },
    );
  });

  it('cherche par numéro, espaces compris, et laisse le serveur comparer', async () => {
    await renderListe([]);

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), '77 987 65 43');

    await waitFor(
      () => {
        expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({
          search: '77 987 65 43',
        });
      },
      { timeout: 3000 },
    );
  });
});

describe('RepScript : les questions restent, et on peut revenir', () => {
  it('garde la question et sa réponse quand la suivante s’ajoute', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await repondre('Joignable');

    expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Joignable' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByText('Est-il représentant CPI CHUES ?')).toBeTruthy();
  });

  it('laisse changer une réponse déjà donnée', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await repondre('Joignable');
    await repondre('Injoignable');

    expect(screen.getByRole('button', { name: 'Injoignable' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByText('Est-il représentant CPI CHUES ?')).toBeNull();
  });

  it('revient à la liste sans rien envoyer', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await repondre('Injoignable');

    await userEvent.click(screen.getByRole('button', { name: /Revenir à la liste/u }));

    expect(screen.getByLabelText('Qui avez-vous appelé ?')).toBeTruthy();
    expect(pushRepCallAttempt).not.toHaveBeenCalled();
  });

  it('revient d’une étape à l’autre par « Étape précédente »', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await injoindre();
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Étape précédente/u }));

    expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Injoignable' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('RepScript : une seule tentative, à la fin', () => {
  async function enregistrer(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  }

  it('consigne l’engagement avec le canal WhatsApp, en un seul envoi', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    await enregistrer();

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({
      representantId: 'r-1',
      outcome: 'REACHED',
      relationStatus: 'AMBASSADEUR',
      whatsappStatus: 'MEME_NUMERO',
      etablissementConfirme: true,
      contacte: true,
      connaitUES: true,
    });
    expect(dernierEnvoi()).not.toHaveProperty('numeroConfirme');
  });

  it('envoie le NOM du syndicat choisi, pas son identifiant', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await userEvent.click(screen.getByRole('combobox', { name: /Syndicat/u }));
    await userEvent.click(await screen.findByRole('option', { name: /SAES/u }));
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    await enregistrer();

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ syndicat: 'SAES' });
  });

  it('ne demande plus si le numéro est confirmé', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');

    expect(screen.queryByText('Son numéro est-il confirmé ?')).toBeNull();
    expect(screen.getByText('A-t-il WhatsApp sur ce numéro ?')).toBeTruthy();
  });

  it('consigne le refus et la personne proposée ensemble', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Non');
    await userEvent.type(screen.getByLabelText('Son numéro'), '77 111 22 33');
    await userEvent.type(screen.getByLabelText('Son nom et prénom'), 'Modou Sarr');
    await enregistrer();

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({
      outcome: 'REFUSED',
      relationStatus: 'REFUS',
      suggestedPhone: '77 111 22 33',
      suggestedName: 'Modou Sarr',
    });
  });

  it('fait passer Injoignable par la même mécanique, avec confirmation', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await injoindre();

    // Aucun envoi tant que l'écran de récapitulation n'a pas été validé.
    expect(pushRepCallAttempt).not.toHaveBeenCalled();

    await enregistrer();

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ outcome: 'UNREACHABLE' });
    expect(toastSuccess).toHaveBeenCalledWith('Appel enregistré pour Aminata Ndiaye.');
  });

  it('revient à la liste après enregistrement, sans sauter sur quelqu’un', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await injoindre();
    await enregistrer();

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Appel enregistré pour Aminata Ndiaye.');
    });
    expect(screen.getByLabelText('Qui avez-vous appelé ?')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('joint le commentaire saisi à la qualification', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await injoindre();
    await userEvent.type(screen.getByLabelText('Commentaire'), 'Sonne dans le vide');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ comment: 'Sonne dans le vide' });
  });
});

describe('RepScript : le statut « À rappeler » propose un calendrier', () => {
  it('offre les créneaux du mobile et « Choisir une date »', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await repondre('Joignable');
    await choisirStatut('À rappeler');

    expect(screen.getByText('Quand rappeler ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Demain 9 h' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Choisir une date/u })).toBeTruthy();
  });

  it('ouvre un calendrier puis les demi-heures du jour retenu', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await repondre('Joignable');
    await choisirStatut('À rappeler');

    await userEvent.click(screen.getByRole('button', { name: /Choisir une date/u }));

    const jour = screen.getByLabelText('Quel jour ?');
    expect(jour.getAttribute('type')).toBe('date');

    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await userEvent.type(jour, demain);

    expect(await screen.findByText('À quelle heure ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: '08 h 00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '19 h 00' })).toBeTruthy();
  });

  it('exige l’échéance et l’envoie dans « callbackAt »', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await parcoursJoignable('Non', 'À rappeler');

    expect(screen.getByText('Choisissez quand rappeler')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);

    await repondre('Demain 9 h');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ outcome: 'CALLBACK' });
    expect(typeof dernierEnvoi()['callbackAt']).toBe('string');
  });
});

/** Il a décroché, il a répondu, et il demande quand même à être rappelé. */
/** L'échéance appartient au statut qui la réclame, à lui seul. */
describe('RepScript : l’échéance suit le statut, pas le résultat', () => {
  it('ne la propose pas sur un joignable dont le statut ne l’exige pas', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();
    expect(screen.queryByText(/Le rappeler plus tard/u)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(false);
  });

  it('n’envoie aucune échéance sur une issue qui ne planifie pas de rappel', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ outcome: 'REACHED', relationStatus: 'AMBASSADEUR' });
    expect(dernierEnvoi()['callbackAt']).toBeUndefined();
  });

  it('ne propose rien après un injoignable', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await injoindre();

    expect(screen.queryByText(/Le rappeler plus tard/u)).toBeNull();
    expect(screen.queryByText('Quand rappeler ?')).toBeNull();
  });
});

/** Toute relation DÉJÀ TRANCHÉE alerte : l'acceptation comme le refus. */
describe('RepScript : la garde des relations déjà tranchées', () => {
  const ACCEPTE = rep({ id: 'r-7', fullName: 'Bineta Diop', relationStatus: 'AMBASSADEUR' });
  const REFUS = rep({ id: 'r-8', fullName: 'Cheikh Sow', relationStatus: 'REFUS' });

  it('demande AVANT tout, sans montrer ni fiche ni question', async () => {
    await renderListe([ACCEPTE]);
    await choisir(/Bineta Diop/u);

    const boite = await screen.findByRole('dialog');
    expect(boite.textContent).toContain(
      'Cette personne a déjà accepté d’être représentant CPI CHUES.',
    );
    expect(boite.textContent).toContain('Voulez-vous quand même consigner un nouvel appel ?');

    // Le seul titre à l'écran est celui de la boîte : ni le nom, ni le numéro.
    expect(screen.queryByRole('heading', { name: 'Bineta Diop' })).toBeNull();
    expect(screen.queryByText('Comment s’est passé l’appel ?')).toBeNull();
    expect(screen.queryByText('+221 77 123 45 67')).toBeNull();
  });

  it('nomme le refus plutôt que l’acceptation quand c’est un refus', async () => {
    await renderListe([REFUS]);
    await choisir(/Cheikh Sow/u);

    const boite = await screen.findByRole('dialog');
    expect(boite.textContent).toContain('Cette personne a déjà refusé.');
    expect(boite.textContent).not.toContain('a déjà accepté');
    expect(boite.textContent).toContain('Voulez-vous quand même consigner un nouvel appel ?');
    expect(screen.queryByText('Comment s’est passé l’appel ?')).toBeNull();
  });

  it('découvre la fiche une fois la question tranchée, dans les deux cas', async () => {
    await renderListe([ACCEPTE]);
    await choisir(/Bineta Diop/u);
    await userEvent.click(await screen.findByRole('button', { name: 'Continuer' }));

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Bineta Diop');
    expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
  });

  it('renvoie à la liste si l’on renonce', async () => {
    await renderListe([REFUS]);
    await choisir(/Cheikh Sow/u);
    await userEvent.click(await screen.findByRole('button', { name: /Revenir à la liste/u }));

    expect(screen.getByLabelText('Qui avez-vous appelé ?')).toBeTruthy();
    expect(pushRepCallAttempt).not.toHaveBeenCalled();
  });

  it('n’avertit sur AUCUNE relation encore ouverte', async () => {
    const alertes: string[] = [];

    for (const statut of ['INCONNU', 'CONTACTE'] as const) {
      const { unmount } = await renderListe([
        rep({ id: `r-${statut}`, fullName: 'Aminata Ndiaye', relationStatus: statut }),
      ]);
      await choisir(/Aminata Ndiaye/u);

      if (screen.queryByRole('dialog') !== null) alertes.push(statut);
      expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
      unmount();
    }

    expect(alertes).toEqual([]);
  });
});

describe('RepScript : deux issues, le reste se dit au statut', () => {
  it('ne propose que Joignable et Injoignable', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    const question = screen.getByText('Comment s’est passé l’appel ?').closest('fieldset');
    expect(
      within(question as HTMLElement)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent),
    ).toEqual(['Joignable', 'Injoignable']);
  });

  it('sort « Corriger la fiche » des réponses, sans la perdre', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    const question = screen.getByText('Comment s’est passé l’appel ?').closest('fieldset');
    expect(
      within(question as HTMLElement).queryByRole('button', { name: /Corriger la fiche/u }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: /Corriger la fiche/u })).toBeTruthy();
  });

  it('garde « Mauvais numéro » lisible sur les appels déjà consignés', () => {
    expect(REP_CALL_OUTCOME_LABELS.WRONG_NUMBER).toBe('Mauvais numéro');
  });
});

describe('RepScript : la personne proposée se saisit dans n’importe quel ordre', () => {
  async function refuser(): Promise<void> {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await parcoursJoignable('Non');
  }

  it('laisse les trois champs actifs d’emblée', async () => {
    await refuser();

    expect(screen.getByLabelText('Son nom et prénom').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Sa remarque').hasAttribute('disabled')).toBe(false);
  });

  it('retient l’enregistrement tant que le numéro manque, et le dit', async () => {
    await refuser();

    await userEvent.type(screen.getByLabelText('Son nom et prénom'), 'Modou Sarr');

    expect(screen.getByText('Écrivez le numéro de la personne proposée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('n’efface rien : le nom saisi avant le numéro part avec lui', async () => {
    await refuser();

    await userEvent.type(screen.getByLabelText('Son nom et prénom'), 'Modou Sarr');
    await userEvent.type(screen.getByLabelText('Son numéro'), '77 111 22 33');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({
      suggestedPhone: '77 111 22 33',
      suggestedName: 'Modou Sarr',
    });
  });
});

describe('RepScript : l’écran d’appel ne montre que le nom et le numéro', () => {
  it('ne porte ni profession, ni WhatsApp, ni prospects apportés', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    expect(screen.queryByText(/Profession :/u)).toBeNull();
    expect(screen.queryByText(/WhatsApp :/u)).toBeNull();
    expect(screen.queryByText(/prospect apporté/u)).toBeNull();
    expect(screen.getByText('+221 77 123 45 67')).toBeTruthy();
  });

  it('est l’étape 1, sur sa propre route', () => {
    expect(ETAPES[0]).toMatchObject({
      n: 1,
      titre: 'Qualifier un représentant',
      href: '/chues/appels-representants',
    });
    expect(navTitle('COMMERCIAL', '/chues/appels-representants')).toBe('Qualifier un représentant');
  });
});

describe('RepScript : l’écran d’ouverture recompte après une qualification', () => {
  const compteur = (total: number) => ({ items: [], total, page: 1, pageSize: 1, pageCount: 1 });

  it('redemande le nombre de non qualifiés une fois l’appel enregistré', async () => {
    let nonQualifies = 15;
    fetchRepresentants.mockImplementation((filters: RepresentantFilters) => {
      if (filters.relationStatus === 'INCONNU') return Promise.resolve(compteur(nonQualifies));
      if (filters.relationStatus === 'AMBASSADEUR') return Promise.resolve(compteur(3));
      return Promise.resolve(page([PREMIER]));
    });
    fetchRepresentantsAQualifier.mockResolvedValue(page([PREMIER]));
    countPendingProspects.mockResolvedValue(310);
    fetchCallbacks.mockResolvedValue({ items: [], serverTime: '2026-09-01T09:00:00.000Z' });

    renderWithQuery(
      <>
        <HubView prenom="Fatou" />
        <RepScript />
      </>,
    );
    expect(await screen.findByText('15')).toBeTruthy();

    await choisir(/Aminata Ndiaye/u);
    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    nonQualifies = 14;
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(screen.getByText('14')).toBeTruthy();
    });
  });
});

/**
 * L'écran d'appel ne montre QUE ce que la personne doit appeler. La portée est
 * demandée au serveur, pas filtrée ici : un tri côté client laisserait passer
 * les numéros par la requête.
 */
describe('RepScript : ce que l’écran d’appel a le droit d’appeler', () => {
  it('demande au serveur ses propres fiches, pas l’annuaire entier', async () => {
    await renderListe();

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'Aminata');

    await waitFor(
      () => {
        expect(fetchRepresentantsAQualifier).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
    expect(fetchRepresentants).not.toHaveBeenCalled();
  });

  it('dit d’où vient le vide, au lieu de laisser croire à une base vide', async () => {
    await renderListe([]);

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'Personne');

    expect(await screen.findByText(/vos fiches/u)).toBeTruthy();
  });
});

describe('RepScript : filtrer et parcourir ses fiches', () => {
  const DIX = Array.from({ length: 10 }, (_, rang) =>
    rep({ id: `r-p${rang}`, fullName: `Fiche ${rang}` }),
  );

  it('demande au serveur le statut de relation choisi, et en montre le libellé', async () => {
    await renderListe();

    await choisirRelation('Refus');

    expect(screen.getByRole('combobox', { name: 'Relation' }).textContent).toContain('Refus');
    await waitFor(() => {
      expect(relationDemandee()).toEqual(['REFUS']);
    });
  });

  it('range sous « Contacté » tout ce qui a été contacté, acceptés et refus compris', async () => {
    await renderListe();

    await choisirRelation('Contacté');

    await waitFor(() => {
      expect(relationDemandee()).toEqual(['CONTACTE', 'AMBASSADEUR', 'REFUS']);
    });
  });

  it('ne demande que les acceptés sous « A accepté »', async () => {
    await renderListe();

    await choisirRelation('A accepté');

    await waitFor(() => {
      expect(relationDemandee()).toEqual(['AMBASSADEUR']);
    });
  });

  it('revient à « Tous » sans statut demandé', async () => {
    await renderListe();

    await choisirRelation('Refus');
    await choisirRelation('Tous');

    await waitFor(() => {
      expect(relationDemandee()).toBeNull();
    });
  });

  it('demande la page suivante au serveur, sans découper la liste ici', async () => {
    await renderListe(DIX, { total: 24, pageCount: 3 });

    expect(await screen.findByText('1 / 3')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Fiche \d/u })).toHaveLength(10);

    await userEvent.click(screen.getByRole('button', { name: /Page suivante/u }));

    expect(screen.getByText('2 / 3')).toBeTruthy();
    await waitFor(() => {
      expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 });
    });
  });

  it('revient à la première page quand la recherche change', async () => {
    await renderListe(DIX, { total: 24, pageCount: 3 });
    await userEvent.click(await screen.findByRole('button', { name: /Page suivante/u }));

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'Ndiaye');

    expect(screen.getByText('1 / 3')).toBeTruthy();
    await waitFor(
      () => {
        expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({
          search: 'Ndiaye',
          page: 1,
        });
      },
      { timeout: 3000 },
    );
  });

  it('revient à la première page quand le statut change', async () => {
    await renderListe(DIX, { total: 24, pageCount: 3 });
    await userEvent.click(await screen.findByRole('button', { name: /Page suivante/u }));

    await choisirRelation('Refus');

    expect(screen.getByText('1 / 3')).toBeTruthy();
    await waitFor(() => {
      expect(fetchRepresentantsAQualifier.mock.calls.at(-1)?.[0]).toMatchObject({
        relationStatus: ['REFUS'],
        page: 1,
      });
    });
  });

  it('demande dix lignes de ses propres fiches, page et statut compris', async () => {
    const actual = await vi.importActual<typeof RepresentantsData>('@/lib/data/representants');
    const GET = vi.fn().mockResolvedValue({
      data: { items: [], meta: { total: 0, page: 2, pageSize: 10, pageCount: 3 } },
      response: new Response(null, { status: 200 }),
    });

    await actual.fetchRepresentantsAQualifier({ search: 'a', relationStatus: ['REFUS'], page: 2 }, {
      GET,
    } as unknown as ApiClient);

    expect(GET.mock.calls[0]?.[1]).toMatchObject({
      params: {
        query: { mesFiches: true, search: 'a', relationStatus: 'REFUS', page: 2, pageSize: 10 },
      },
    });
  });

  it('porte plusieurs états dans un seul paramètre, séparés par des virgules', async () => {
    const actual = await vi.importActual<typeof RepresentantsData>('@/lib/data/representants');
    const GET = vi.fn().mockResolvedValue({
      data: { items: [], meta: { total: 0, page: 1, pageSize: 10, pageCount: 1 } },
      response: new Response(null, { status: 200 }),
    });

    await actual.fetchRepresentantsAQualifier(
      { search: '', relationStatus: ['CONTACTE', 'AMBASSADEUR', 'REFUS'], page: 1 },
      { GET } as unknown as ApiClient,
    );

    expect(GET.mock.calls[0]?.[1]).toMatchObject({
      params: { query: { relationStatus: 'CONTACTE,AMBASSADEUR,REFUS' } },
    });
  });
});
