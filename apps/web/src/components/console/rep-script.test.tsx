import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ETAPES } from '@/components/chues/etapes';
import { RepScript } from '@/components/console/rep-script';
import { navTitle } from '@/components/layout/nav-items';
import type * as ConsoleData from '@/lib/data/console';
import type * as ReferenceData from '@/lib/data/reference';
import type * as RepresentantsData from '@/lib/data/representants';
import type { ScriptedRepresentant } from '@/lib/data/representants';
import { REP_CALL_OUTCOME_LABELS } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';

const pushRepCallAttempt = vi.fn();
const fetchRepresentants = vi.fn();
const fetchReferenceData = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    pushRepCallAttempt: (...args: unknown[]) => pushRepCallAttempt(...args) as unknown,
  };
});

vi.mock('@/lib/data/reference', async (importOriginal) => {
  const actual = await importOriginal<typeof ReferenceData>();
  return { ...actual, fetchReferenceData: (...args: unknown[]) => fetchReferenceData(...args) };
});

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return { ...actual, fetchRepresentants: (...args: unknown[]) => fetchRepresentants(...args) };
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

const PREMIER = rep({ id: 'r-1', fullName: 'Aminata Ndiaye' });
const SECOND = rep({
  id: 'r-2',
  fullName: 'Ousmane Fall',
  phoneE164: '+221770000002',
  clientCreatedAt: '2026-02-01T00:00:00.000Z',
});

/** Une fiche que personne n'a confiée : elle ne s'atteint que par l'annuaire. */
const HORS_LISTE = rep({ id: 'r-9', fullName: 'Bineta Diop', phoneE164: '+221779876543' });

const page = (items: readonly ScriptedRepresentant[]) => ({
  items: [...items],
  total: items.length,
  page: 1,
  pageSize: 20,
  pageCount: 1,
});

async function renderListe(file: readonly ScriptedRepresentant[] = [PREMIER, SECOND]) {
  fetchRepresentants.mockResolvedValue(page(file));
  const view = renderWithQuery(<RepScript />);
  await screen.findByLabelText('Qui avez-vous appelé ?');
  return view;
}

/** Ouvre la qualification de quelqu'un : la liste n'apparaît qu'à la recherche. */
async function choisir(nom: RegExp): Promise<void> {
  await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'a');
  await userEvent.click(await screen.findByRole('button', { name: nom }));
}

const repondre = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: label }));
};

/** Répond à UNE question, désignée par sa légende, quand plusieurs Oui/Non coexistent. */
const repondreA = async (legende: string, label: string): Promise<void> => {
  const fieldset = screen.getByText(legende).closest('fieldset') as HTMLElement;
  await userEvent.click(within(fieldset).getByRole('button', { name: label }));
};

/** Parcourt les questions 1 à 5 du script joignable, jusqu'à l'ambassadeur. */
const parcoursJoignable = async (ambassadeur: 'Oui' | 'Non'): Promise<void> => {
  await repondre('Joignable');
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
  fetchRepresentants.mockResolvedValue(page([HORS_LISTE]));
  fetchReferenceData.mockReset();
  fetchReferenceData.mockResolvedValue({
    syndicats: [{ id: 'snd-saes', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 1 }],
  });
  toastError.mockClear();
  toastSuccess.mockClear();
});

describe('RepScript : rien n’est choisi d’office', () => {
  it('ouvre sur la seule barre de recherche, sans liste ni fiche', async () => {
    await renderListe();

    expect(screen.getByLabelText('Qui avez-vous appelé ?')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByText(/Comment s’est passé l’appel/u)).toBeNull();
    // Aucune liste tant qu'on n'a pas cherché.
    expect(screen.queryByRole('button', { name: /Aminata Ndiaye/u })).toBeNull();
  });

  it('n’ouvre la fiche et les questions qu’après un choix', async () => {
    await renderListe();

    await choisir(/Aminata Ndiaye/u);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Aminata Ndiaye');
    expect(screen.getByText('Comment s’est passé l’appel ?')).toBeTruthy();
  });

  it('ne montre des résultats qu’une fois une recherche saisie', async () => {
    await renderListe([HORS_LISTE]);

    expect(screen.queryByRole('button', { name: /Bineta Diop/u })).toBeNull();

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), 'Bineta');

    expect(await screen.findByRole('button', { name: /Bineta Diop/u })).toBeTruthy();
  });

  it('cherche par numéro, espaces compris, et laisse le serveur comparer', async () => {
    await renderListe([]);

    await userEvent.type(screen.getByLabelText('Qui avez-vous appelé ?'), '77 987 65 43');

    await waitFor(
      () => {
        expect(fetchRepresentants.mock.calls.at(-1)?.[0]).toMatchObject({
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
    await repondre('Injoignable');
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

    await repondre('Injoignable');

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
    await repondre('Injoignable');
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
    await repondre('Injoignable');
    await userEvent.type(screen.getByLabelText('Commentaire'), 'Sonne dans le vide');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ comment: 'Sonne dans le vide' });
  });
});

describe('RepScript : « À rappeler » propose un calendrier', () => {
  it('offre les créneaux du mobile et « Choisir une date »', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await repondre('À rappeler');

    expect(screen.getByText('Quand rappeler ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Demain 9 h' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Choisir une date/u })).toBeTruthy();
  });

  it('ouvre un calendrier puis les demi-heures du jour retenu', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);
    await repondre('À rappeler');

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
    await repondre('À rappeler');

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
describe('RepScript : le rappel facultatif d’un joignable', () => {
  it('propose une échéance sans jamais l’exiger', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');

    expect(screen.getByText('Le rappeler plus tard ? (facultatif)')).toBeTruthy();
    expect(screen.queryByText('Choisissez quand rappeler')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(false);
  });

  it('envoie l’échéance avec l’issue REACHED, pas CALLBACK', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await parcoursJoignable('Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    await repondre('Demain 9 h');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(dernierEnvoi()).toMatchObject({ outcome: 'REACHED', relationStatus: 'AMBASSADEUR' });
    expect(typeof dernierEnvoi()['callbackAt']).toBe('string');
  });

  it('ne propose rien après un injoignable', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    await repondre('Injoignable');

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

describe('RepScript : trois issues, comme le mobile', () => {
  it('ne propose que Joignable, À rappeler et Injoignable', async () => {
    await renderListe();
    await choisir(/Aminata Ndiaye/u);

    const question = screen.getByText('Comment s’est passé l’appel ?').closest('fieldset');
    expect(
      within(question as HTMLElement)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent),
    ).toEqual(['Joignable', 'À rappeler', 'Injoignable']);
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
