import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  REGLAGES_HONORES,
  type DashboardMarque,
} from '@/components/accueil/tableau-de-bord/sources';
import {
  ChartDemo,
  ChartPreview,
  ChoixGraphique,
  MARQUE_TEXTES,
  marquePhrase,
  marquePourKind,
} from '@/components/dashboard/chart-visual';

const MARQUES = Object.keys(REGLAGES_HONORES) as DashboardMarque[];
const JARGON = ['série temporelle', 'cardinalité', 'distribution', 'scalaire', 'matrice'];

function dessin(marque: DashboardMarque): SVGSVGElement {
  const { container } = render(<ChartPreview marque={marque} />);
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error(`aucun aperçu pour ${marque}`);
  return svg;
}

describe('ChartPreview', () => {
  it.each(MARQUES)('%s a un aperçu dessiné et animé', (marque) => {
    const svg = dessin(marque);
    expect(svg.querySelectorAll('rect, circle, path, polygon, text').length).toBeGreaterThan(1);
    expect(svg.querySelectorAll('.cpi-piece').length).toBeGreaterThan(0);
  });

  it('chaque marque a son propre dessin', () => {
    const dessins = MARQUES.map((marque) => dessin(marque).innerHTML);
    expect(new Set(dessins).size).toBe(MARQUES.length);
  });

  it('l’aperçu est décoratif', () => {
    const { container } = render(<ChartPreview marque="anneau" />);
    expect(
      container.querySelector('[data-slot="chart-preview"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('l’animation est neutralisée sous prefers-reduced-motion', () => {
    render(<ChartPreview marque="courbe" />);
    const css = Array.from(document.querySelectorAll('style'))
      .map((noeud) => noeud.textContent ?? '')
      .join('');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.cpi-piece { animation: none; }');
  });

  it('affiche un exemple agrandi pour comprendre la forme choisie', () => {
    render(<ChartDemo marque="barres-horizontales" />);
    expect(screen.getByRole('img', { name: 'Exemple visuel : Barres couchées' })).toBeTruthy();
    expect(screen.getByText('Comparer qui fait le plus, noms longs lisibles')).toBeTruthy();
  });
});

describe('MARQUE_TEXTES', () => {
  it.each(MARQUES)('%s a un nom simple et une phrase courte', (marque) => {
    const texte = MARQUE_TEXTES[marque];
    expect(texte.nom.length).toBeGreaterThan(2);
    expect(texte.usage.length).toBeLessThan(60);
    for (const mot of JARGON) {
      expect(texte.usage.toLowerCase()).not.toContain(mot);
    }
  });

  it('marquePourKind couvre les quatre familles de l’organisateur partagé', () => {
    expect(marquePourKind('trend')).toBe('courbe');
    expect(marquePourKind('rank')).toBe('barres-horizontales');
    expect(marquePourKind('share')).toBe('anneau');
    expect(marquePourKind('category')).toBe('tableau');
  });

  it('marquePhrase nomme la marque avant son usage', () => {
    expect(marquePhrase('anneau')).toBe('Anneau : voir la part de chacun dans le total');
  });
});

describe('ChoixGraphique', () => {
  it('le nom accessible porte la marque, son usage et le conseil', () => {
    render(
      <ChoixGraphique
        marque="anneau"
        titre="Anneau"
        phrase={MARQUE_TEXTES.anneau.usage}
        conseille
        raison="La part se lit mieux que la hauteur."
        onSelect={vi.fn<() => void>()}
      />,
    );

    const bouton = screen.getByRole('button');
    const nom = bouton.textContent ?? '';
    expect(nom).toContain('Anneau');
    expect(nom).toContain('Voir la part de chacun dans le total');
    expect(nom).toContain('Conseillé ici');
    expect(nom).toContain('La part se lit mieux que la hauteur.');
  });

  it('la sélection est annoncée et marquée autrement que par la couleur', () => {
    const choix = (selectionne: boolean) => (
      <ChoixGraphique
        marque="courbe"
        titre="Courbe"
        phrase={MARQUE_TEXTES.courbe.usage}
        selectionne={selectionne}
        onSelect={vi.fn<() => void>()}
      />
    );
    const { rerender } = render(choix(true));
    const marque = screen.getByRole('button', { pressed: true }).querySelectorAll('svg').length;

    rerender(choix(false));
    const nu = screen.getByRole('button', { pressed: false }).querySelectorAll('svg').length;

    expect(marque).toBeGreaterThan(nu);
  });

  it('le clic choisit la marque', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<() => void>();
    render(
      <ChoixGraphique
        marque="tableau"
        titre="Tableau"
        phrase={MARQUE_TEXTES.tableau.usage}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Tableau/u }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
