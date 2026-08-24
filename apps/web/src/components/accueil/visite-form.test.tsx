import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as VisitesModule from '@/lib/data/visites';
import { renderWithQuery } from '@/test/render-query';
import { routerMock } from '@/test/router-mock';

const createVisite = vi.hoisted(() => vi.fn());
const updateVisite = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/visites', async () => {
  const actual = await vi.importActual<typeof VisitesModule>('@/lib/data/visites');
  return {
    ...actual,
    createVisite: (input: unknown) => createVisite(input) as unknown,
    updateVisite: (id: unknown, input: unknown) => updateVisite(id, input) as unknown,
  };
});

const { VisiteForm } = await import('@/components/accueil/visite-form');

const item = (id: string, code: string, label: string) => ({
  id,
  code,
  label,
  isActive: true,
  isSystem: true,
  sortOrder: 100,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const referentiels = {
  entreprises: [item('e-cpi', 'CPI', 'CPI'), item('e-sa', 'SANTARGILE', 'SANTARGILE')],
  directions: [item('d-com', 'COMMERCIALE', 'COMMERCIALE'), item('d-rdc', 'RDC_CPI', 'RDC CPI')],
  destinataires: [item('x-ndoye', 'NDOYE', 'MME. NDOYE (RESP. COMM.)')],
  objets: [
    item('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN'),
    item('o-info', 'DEMANDE_INFOS', "DEMANDE D'INFORMATIONS"),
  ],
};

const ref = (id: string, code: string, label: string) => ({ id, code, label });

const visite = (over: Partial<VisitesModule.Visite> = {}): VisitesModule.Visite => ({
  id: 'v-1',
  reference: 'V-2026-000412',
  date: '2026-08-19',
  time: '09:35',
  visitorName: 'Awa Ndiaye',
  phone: '77 123 45 67',
  phoneE164: '+221771234567',
  entreprise: ref('e-cpi', 'CPI', 'CPI'),
  objet: ref('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN'),
  direction: ref('d-com', 'COMMERCIALE', 'COMMERCIALE'),
  destinataire: ref('x-ndoye', 'NDOYE', 'MME. NDOYE (RESP. COMM.)'),
  comment: null,
  createdById: 'u-1',
  createdAt: '2026-08-19T09:35:00.000Z',
  ...over,
});

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

async function fillMinimum(name: string): Promise<void> {
  await userEvent.setup().type(screen.getByRole('textbox', { name: /PRENOM ET NOMS/u }), name);
  await choose('ENTREPRISE', 'CPI');
  await choose('OBJET VISITE', 'ACHAT TERRAIN');
}

beforeEach(() => {
  createVisite.mockReset();
  updateVisite.mockReset();
  createVisite.mockResolvedValue(visite());
  updateVisite.mockResolvedValue(visite({ visitorName: 'Awa Ndiaye Sow' }));
});

describe('saisie d’une visite', () => {
  it('nomme chaque champ comme la colonne du classeur', () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    for (const colonne of [
      'DATE VISITE',
      'HEURE VISITE',
      'PRENOM ET NOMS',
      'TELEPHONES',
      'ENTREPRISE',
      'DIRECTION',
      'DESTINATAIRES',
      'OBJET VISITE',
      'COMMENTAIRES / NOTES',
    ]) {
      expect(screen.getAllByText(new RegExp(colonne, 'u')).length, colonne).toBeGreaterThan(0);
    }
  });

  it('pré-remplit la date et l’heure à maintenant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T09:35:00.000Z'));
    try {
      renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'DATE VISITE' }).textContent).toContain('19 août');
      expect(screen.getByLabelText(/HEURE VISITE/u)).toHaveProperty('value', '09:35');
    } finally {
      vi.useRealTimers();
    }
  });

  it('enregistre sans numéro : le téléphone est facultatif', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await fillMinimum('Awa Ndiaye');
    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    await waitFor(() => {
      expect(createVisite).toHaveBeenCalledWith(
        expect.objectContaining({ visitorName: 'Awa Ndiaye' }),
      );
    });
    expect(createVisite.mock.calls[0]?.[0]).not.toHaveProperty('phone');
  });

  it('enchaîne la visite suivante sans recharger : nom vidé, focus rendu', async () => {
    const onSaved = vi.fn();
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={onSaved} />);

    await fillMinimum('Awa Ndiaye');
    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    const nom = screen.getByRole('textbox', { name: /PRENOM ET NOMS/u });
    await waitFor(() => {
      expect(nom).toHaveProperty('value', '');
    });
    expect(onSaved).toHaveBeenCalled();
    expect(document.activeElement).toBe(nom);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('garde l’ENTREPRISE, qui ne change pas d’un visiteur au suivant, et relâche le reste', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await fillMinimum('Awa Ndiaye');
    await choose('DESTINATAIRES', 'NDOYE');
    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /OBJET VISITE/u }).textContent).not.toContain(
        'ACHAT TERRAIN',
      );
    });
    expect(screen.getByRole('combobox', { name: /ENTREPRISE/u }).textContent).toContain('CPI');
    expect(screen.getByRole('combobox', { name: /DESTINATAIRES/u }).textContent).not.toContain(
      'NDOYE',
    );
  });

  it('n’exige ni DIRECTION ni DESTINATAIRES, que le registre laisse vides', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await fillMinimum('Awa Ndiaye');
    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    await waitFor(() => {
      expect(createVisite).toHaveBeenCalled();
    });
    const input = createVisite.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).not.toHaveProperty('directionId');
    expect(input).not.toHaveProperty('destinataireId');
  });

  // `xl:grid-cols-4` se déclenche sur la largeur de l'écran, pas celle du
  // dialogue plafonné à `max-w-4xl` : quatre colonnes y tronquaient chaque
  // valeur choisie au libellé long.
  it('garde le libellé long choisi entier, sans grille à quatre colonnes', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await choose('DESTINATAIRES', 'MME. NDOYE');

    const champ = screen.getByRole('combobox', { name: /DESTINATAIRES/u });
    expect(champ.textContent).toContain('MME. NDOYE (RESP. COMM.)');
    expect(champ.closest('div.grid')?.className).not.toContain('xl:grid-cols-4');
  });

  it('refuse une ligne incomplète et signale chaque champ qui manque', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    expect(createVisite).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });
});

describe('correction d’une ligne du registre', () => {
  it('part des valeurs déjà enregistrées', () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} visite={visite()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /PRENOM ET NOMS/u })).toHaveProperty(
      'value',
      'Awa Ndiaye',
    );
    expect(screen.getByRole('combobox', { name: /OBJET VISITE/u }).textContent).toContain(
      'ACHAT TERRAIN',
    );
  });

  // L'API refuse de déplacer une ligne d'un jour à l'autre.
  it('montre la date sans la proposer à la correction', () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} visite={visite()} onSaved={vi.fn()} />);

    expect(screen.getByText('19 août 2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'DATE VISITE' })).toBeNull();
  });

  it('laisse vide l’heure d’une ligne dont l’heure n’a pas été relevée', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T16:20:00.000Z'));
    try {
      renderWithQuery(
        <VisiteForm
          referentiels={referentiels}
          visite={visite({ time: null })}
          onSaved={vi.fn()}
        />,
      );

      expect(screen.getByLabelText(/HEURE VISITE/u)).toHaveProperty('value', '');
    } finally {
      vi.useRealTimers();
    }
  });

  // Une entrée désactivée disparaît du référentiel servi : le champ montrerait
  // un choix vide là où la ligne en porte un.
  it('montre encore l’entreprise retirée des listes depuis la saisie', () => {
    renderWithQuery(
      <VisiteForm
        referentiels={{ ...referentiels, entreprises: [] }}
        visite={visite()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: /ENTREPRISE/u }).textContent).toContain('CPI');
  });

  it('corrige la ligne existante au lieu d’en créer une seconde', async () => {
    const onSaved = vi.fn();
    renderWithQuery(<VisiteForm referentiels={referentiels} visite={visite()} onSaved={onSaved} />);

    const user = userEvent.setup();
    const nom = screen.getByRole('textbox', { name: /PRENOM ET NOMS/u });
    await user.clear(nom);
    await user.type(nom, 'Awa Ndiaye Sow');
    await user.click(screen.getByRole('button', { name: /Enregistrer la correction/u }));

    await waitFor(() => {
      expect(updateVisite).toHaveBeenCalledWith(
        'v-1',
        expect.objectContaining({ visitorName: 'Awa Ndiaye Sow' }),
      );
    });
    expect(updateVisite.mock.calls[0]?.[1]).not.toHaveProperty('date');
    expect(createVisite).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  // L'API exige deux caractères ; le formulaire ne testait que « non vide ».
  // Un nom d'une lettre partait, revenait en 400, et rien ne disait lequel.
  it('refuse un nom d’une seule lettre, EN NOMMANT le champ', async () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    await fillMinimum('A');
    await userEvent.setup().click(screen.getByRole('button', { name: /Enregistrer la visite/u }));

    expect(await screen.findByText('Au moins deux caractères.')).toBeTruthy();
    expect(createVisite).not.toHaveBeenCalled();
  });

  it('borne le téléphone et le commentaire comme l’API', () => {
    renderWithQuery(<VisiteForm referentiels={referentiels} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/TELEPHONES/u).getAttribute('maxlength')).toBe('40');
    expect(screen.getByLabelText(/COMMENTAIRES/u).getAttribute('maxlength')).toBe('2000');
    expect(screen.getByRole('textbox', { name: /PRENOM ET NOMS/u }).getAttribute('maxlength')).toBe(
      '160',
    );
  });
});
