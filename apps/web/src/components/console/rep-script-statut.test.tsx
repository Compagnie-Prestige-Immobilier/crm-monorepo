import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { outcomeDuStatut, RepScript } from '@/components/console/rep-script';
import type * as ConsoleData from '@/lib/data/console';
import type * as ReferenceData from '@/lib/data/reference';
import type * as RepresentantsData from '@/lib/data/representants';
import type { ScriptedRepresentant } from '@/lib/data/representants';
import type * as OuverturesData from '@/lib/data/ouvertures';
import type * as StatutsData from '@/lib/data/statuts-qualification';
import type { StatutQualification } from '@/lib/data/statuts-qualification';
import { renderWithQuery } from '@/test/render-query';

const pushRepCallAttempt = vi.fn();
const fetchRepresentant = vi.fn();
const fetchRepresentants = vi.fn();
const fetchRepresentantsAQualifier = vi.fn();
const fetchReferenceData = vi.fn();
const fetchStatutsQualification = vi.fn();
const ouvrirFiche = vi.fn();
const fetchOuvertureCourante = vi.fn();

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
  return {
    ...actual,
    fetchRepresentant: (...args: unknown[]) => fetchRepresentant(...args),
    fetchRepresentants: (...args: unknown[]) => fetchRepresentants(...args),
    fetchRepresentantsAQualifier: (...args: unknown[]) => fetchRepresentantsAQualifier(...args),
  };
});

vi.mock('@/lib/data/ouvertures', async (importOriginal) => {
  const actual = await importOriginal<typeof OuverturesData>();
  return {
    ...actual,
    ouvrirFiche: (...args: unknown[]) => ouvrirFiche(...args) as unknown,
    fetchOuvertureCourante: () => fetchOuvertureCourante() as unknown,
  };
});

vi.mock('@/lib/data/statuts-qualification', async (importOriginal) => {
  const actual = await importOriginal<typeof StatutsData>();
  return { ...actual, fetchStatutsQualification: () => fetchStatutsQualification() as unknown };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

function statut(over: Partial<StatutQualification> & { id: string }): StatutQualification {
  return {
    code: 'ACCEPTE',
    label: 'Accepté',
    effect: 'REACHED',
    requiresCallback: false,
    requiresComment: false,
    priorite: 'NORMALE',
    relationStatus: null,
    retryAfterMinutes: null,
    isActive: true,
    isSystem: true,
    minPayloadVersion: 6,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const STATUTS: StatutQualification[] = [
  statut({ id: 's-1' }),
  statut({ id: 's-2', code: 'REFUSE', label: 'Refusé', effect: 'REFUSED' }),
  statut({
    id: 's-3',
    code: 'A_RAPPELER',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresCallback: true,
  }),
  statut({
    id: 's-4',
    code: 'PAS_DE_REPONSE',
    label: 'Pas de réponse',
    effect: 'UNREACHABLE',
    retryAfterMinutes: 180,
  }),
  statut({ id: 's-5', code: 'FAUX_NUMERO', label: 'Faux numéro', effect: 'WRONG_NUMBER' }),
  statut({
    id: 's-6',
    code: 'INJOIGNABLE_DEFINITIF',
    label: 'Injoignable définitif',
    effect: 'UNREACHABLE',
  }),
  statut({ id: 's-7', code: 'DECEDE', label: 'Décédé', effect: 'REFUSED' }),
  statut({
    id: 's-8',
    code: 'AUTRE_JOINT',
    label: 'Autre joint',
    effect: 'REACHED',
    requiresComment: true,
  }),
  statut({
    id: 's-9',
    code: 'AUTRE_NON_JOINT',
    label: 'Autre non joint',
    effect: 'UNREACHABLE',
    requiresComment: true,
  }),
];

const REPRESENTANT: ScriptedRepresentant = {
  id: 'r-1',
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
  statutQualificationId: null,
  statutQualificationLabel: null,
  statutQualificationEffect: null,
  callAttemptCount: 0,
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
  nextCallbackOrigine: null,
};

const ouverture = (over: Partial<OuverturesData.OuvertureFiche> = {}) => ({
  id: 'ouv-1',
  openedById: 'u-1',
  openedByName: 'Fatou Sow',
  representantId: 'r-1',
  prospectId: null,
  ficheNom: 'Aminata Ndiaye',
  openedAt: new Date().toISOString(),
  firstInputAt: null,
  closedAt: null,
  dureeSecondes: null,
  closingAttemptId: null,
  draft: null,
  releasedByName: null,
  releasedAt: null,
  ...over,
});

async function ouvrirQualification(): Promise<void> {
  renderWithQuery(<RepScript />);
  await userEvent.type(await screen.findByLabelText('Qui avez-vous appelé ?'), 'a');
  await userEvent.click(await screen.findByRole('button', { name: /Aminata Ndiaye/u }));
  await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }));
  await screen.findByText(/Étape 1 sur 2/u);
}

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

beforeEach(() => {
  pushRepCallAttempt.mockReset();
  pushRepCallAttempt.mockResolvedValue({ status: 'applied', attemptId: 'a-1', suggestion: null });
  fetchRepresentant.mockReset();
  fetchRepresentants.mockReset();
  fetchRepresentantsAQualifier.mockReset();
  const page = {
    items: [REPRESENTANT],
    total: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
  };
  fetchRepresentants.mockResolvedValue(page);
  fetchRepresentantsAQualifier.mockResolvedValue(page);
  fetchReferenceData.mockReset();
  fetchReferenceData.mockResolvedValue({ syndicats: [] });
  fetchStatutsQualification.mockReset();
  fetchStatutsQualification.mockResolvedValue(STATUTS);
  ouvrirFiche.mockReset();
  ouvrirFiche.mockResolvedValue(ouverture());
  fetchOuvertureCourante.mockReset();
  fetchOuvertureCourante.mockResolvedValue(null);
});

describe('l’issue se dérive de l’effet du statut', () => {
  it('couvre les cinq effets du référentiel', () => {
    expect(outcomeDuStatut('REACHED')).toBe('REACHED');
    expect(outcomeDuStatut('REFUSED')).toBe('REFUSED');
    expect(outcomeDuStatut('SCHEDULE_CALLBACK')).toBe('CALLBACK');
    expect(outcomeDuStatut('UNREACHABLE')).toBe('UNREACHABLE');
    expect(outcomeDuStatut('WRONG_NUMBER')).toBe('WRONG_NUMBER');
  });
});

describe('le sélecteur de statut', () => {
  it('n’apparaît qu’une fois le résultat choisi', async () => {
    await ouvrirQualification();

    expect(screen.queryByRole('combobox', { name: /Statut de qualification/u })).toBeNull();

    await repondre('Injoignable');

    expect(await screen.findByRole('combobox', { name: /Statut de qualification/u })).toBeTruthy();
  });

  it('ne propose que les statuts de la branche jointe', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await userEvent.click(
      await screen.findByRole('combobox', { name: /Statut de qualification/u }),
    );

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Accepté',
      'Refusé',
      'À rappeler',
      'Faux numéro',
      'Décédé',
      'Autre',
    ]);
  });

  it('ne propose que les statuts de la branche non aboutie', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await userEvent.click(
      await screen.findByRole('combobox', { name: /Statut de qualification/u }),
    );

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Pas de réponse',
      'Injoignable définitif',
      'Autre',
    ]);
  });
});

describe('ce que le déclencheur affiche', () => {
  it('montre le LIBELLÉ du statut retenu, jamais son identifiant', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Décédé');

    const declencheur = screen.getByRole('combobox', { name: /Statut de qualification/u });

    expect(declencheur.textContent).toContain('Décédé');
    // L'identifiant est un UUID : le lire à l'écran ne dit rien à personne.
    expect(declencheur.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/u);
  });
});

describe('la date de rappel suit le statut, pas le résultat', () => {
  it('n’est exigée que par le statut qui la réclame', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Décédé');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();

    await choisirStatut('À rappeler');

    expect(screen.getByText('Quand rappeler ?')).toBeTruthy();
  });

  it('retient l’enregistrement tant que la date manque, et le dit', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('À rappeler');
    await repondreA('L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondreA('A-t-il déjà été contacté ?', 'Oui');
    await repondreA('Connaît-il l’UES ?', 'Oui');
    await repondreA('Souhaite-t-il être représentant CHUES ?', 'Non');

    expect(screen.getByText('Choisissez quand rappeler')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('ne s’ouvre pas sur un statut non abouti qui ne se retente jamais', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Injoignable définitif');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();
    expect(screen.queryByText(/Le rappeler plus tard/u)).toBeNull();
  });

  // Un numéro qui n'a pas répondu se retente : le réessai arrive préréglé au
  // délai du statut et part avec l'appel, sans rien demander de plus.
  it('propose d’office le réessai que le statut porte', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Pas de réponse');

    expect(screen.getByText('Quand rappeler ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    const envoye = pushRepCallAttempt.mock.calls[0]?.[0] as { outcome: string; callbackAt: string };
    expect(envoye.outcome).toBe('UNREACHABLE');
    const delai = (new Date(envoye.callbackAt).getTime() - Date.now()) / 60_000;
    expect(delai).toBeGreaterThan(175);
    expect(delai).toBeLessThanOrEqual(180);
  });
});

describe('l’enregistrement attend le statut', () => {
  it('bloque et le dit tant qu’aucun statut n’est retenu', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');

    expect(await screen.findByText('Choisissez un statut de qualification')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  // Un faux numéro est joint : la fiche est traitée, et le script qui suppose
  // qu'on parle à la bonne personne n'a plus rien à demander.
  it('envoie le statut retenu et l’issue qu’il dérive, script vierge', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Faux numéro');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'WRONG_NUMBER',
      statutQualificationId: 's-5',
    });
  });
});

describe('l’effet du statut décide si le script est exigé', () => {
  it('laisse « À rappeler » enregistrer sans une seule réponse du script', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('À rappeler');
    await repondre('Demain 9 h');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    const envoi = pushRepCallAttempt.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi).toMatchObject({ outcome: 'CALLBACK', statutQualificationId: 's-3' });
    expect(envoi['etablissementConfirme']).toBeUndefined();
    expect(envoi['contacte']).toBeUndefined();
    expect(envoi['connaitUES']).toBeUndefined();
    expect(typeof envoi['callbackAt']).toBe('string');
  });

  it('exige quand même la date de rappel, script vierge ou non', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('À rappeler');

    expect(screen.getByText('Choisissez quand rappeler')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('garde les questions du script affichées, facultatives et répondables', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Décédé');

    expect(screen.getByText('L’établissement de la fiche est-il confirmé ?')).toBeTruthy();

    await repondreA('A-t-il déjà été contacté ?', 'Oui');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({ contacte: true });
  });

  it('laisse un statut d’effet REFUSED enregistrer sans réponse ni date', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Décédé');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    const envoi = pushRepCallAttempt.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi).toMatchObject({ outcome: 'REFUSED', statutQualificationId: 's-7' });
    expect(envoi['callbackAt']).toBeUndefined();
  });

  it('n’envoie aucune relation quand la question CHUES reste sans réponse', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Décédé');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    const envoi = pushRepCallAttempt.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi['relationStatus']).toBeUndefined();
  });

  it('exige le script jusqu’à l’UES sous un statut d’effet REACHED', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Autre');

    expect(screen.getByText('Dites si l’établissement est confirmé')).toBeTruthy();

    await repondreA('L’établissement de la fiche est-il confirmé ?', 'Oui');

    expect(screen.getByText('Dites s’il a déjà été contacté')).toBeTruthy();

    await repondreA('A-t-il déjà été contacté ?', 'Oui');

    expect(screen.getByText('Dites s’il connaît l’UES')).toBeTruthy();
  });

  it('ouvre sur le script, dont la dernière réponse pose le statut', async () => {
    await ouvrirQualification();
    await repondre('Joignable');

    expect(screen.getByText('Dites si l’établissement est confirmé')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });
});

/** EB-02 : la question pose le statut ; il ne se choisit plus à part. */
describe('la question « Souhaite-t-il être représentant CHUES ? »', () => {
  const scriptJusquAuSouhait = async (): Promise<void> => {
    await ouvrirQualification();
    await repondre('Joignable');
    await repondreA('L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondreA('A-t-il déjà été contacté ?', 'Oui');
    await repondreA('Connaît-il l’UES ?', 'Oui');
  };

  it('retient l’enregistrement tant qu’elle est sans réponse, et le dit', async () => {
    await scriptJusquAuSouhait();

    expect(screen.getByText('Dites s’il souhaite être représentant CHUES')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('pose « Accepté » et rattache sur un oui', async () => {
    await scriptJusquAuSouhait();
    await repondreA('Souhaite-t-il être représentant CHUES ?', 'Oui');
    await repondreA('A-t-il WhatsApp sur ce numéro ?', 'Oui');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'REACHED',
      statutQualificationId: 's-1',
      relationStatus: 'AMBASSADEUR',
    });
  });

  // Le serveur refuse une relation qui contredit le statut pose
  // (REP_RELATION_STATUT_MISMATCH) : choisir le statut dans la liste doit donc
  // repondre a la question, jamais la laisser diverger.
  it('répond à la question quand le statut se choisit dans la liste', async () => {
    await scriptJusquAuSouhait();
    await choisirStatut('Refusé');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'REFUSED',
      statutQualificationId: 's-2',
      relationStatus: 'REFUS',
    });
  });

  it('pose « Refusé » sur un non', async () => {
    await scriptJusquAuSouhait();
    await repondreA('Souhaite-t-il être représentant CHUES ?', 'Non');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'REFUSED',
      statutQualificationId: 's-2',
      relationStatus: 'REFUS',
    });
  });

  it('laisse un autre statut de la branche jointe l’emporter', async () => {
    await scriptJusquAuSouhait();
    await repondreA('Souhaite-t-il être représentant CHUES ?', 'Non');
    await choisirStatut('À rappeler');
    await repondre('Demain 9 h');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'CALLBACK',
      statutQualificationId: 's-3',
      relationStatus: 'REFUS',
    });
  });
});

/** EB-04 : « Autre » ne dit rien tant que le motif n'est pas écrit. */
describe('le statut qui exige un motif', () => {
  it('retient l’enregistrement tant que le motif est vide, et le dit', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Autre');

    expect(screen.getByLabelText('Motif')).toBeTruthy();
    expect(screen.getByText('Écrivez le motif')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('met le curseur sur le motif, sans quoi l’obligation ne se voit pas', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Autre');

    expect(document.activeElement).toBe(screen.getByLabelText('Motif'));
  });

  it('envoie le motif écrit avec la tentative', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Autre');
    await userEvent.type(screen.getByLabelText('Motif'), 'Ligne coupée deux fois');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      statutQualificationId: 's-9',
      comment: 'Ligne coupée deux fois',
    });
  });

  it('n’exige rien d’un statut qui ne réclame pas de motif', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Injoignable définitif');

    expect(screen.getByLabelText('Commentaire')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(false);
  });
});
