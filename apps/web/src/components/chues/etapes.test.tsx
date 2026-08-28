import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ETAPES, EtapesNav, EtapesNavAuto, etapeDeSegments } from '@/components/chues/etapes';

const segments = vi.hoisted(() => ({ value: [] as string[] }));

vi.mock('next/navigation', () => ({
  useSelectedLayoutSegments: () => segments.value,
}));

/** Les trois écrans d'étape, lus À LA SOURCE : un oubli de montage rougit ici. */
const PAGES: readonly string[] = [
  '../../app/(panel)/chues/appels-representants/page.tsx',
  '../../app/(panel)/chues/prospects/nouveau/page.tsx',
  '../../app/(panel)/chues/console/page.tsx',
];

const LOADINGS: readonly string[] = [
  '../../app/(panel)/chues/appels-representants/loading.tsx',
  '../../app/(panel)/chues/prospects/nouveau/loading.tsx',
  '../../app/(panel)/chues/console/loading.tsx',
];

const COQUE = '../../app/(panel)/chues/layout.tsx';

const source = (chemin: string): string =>
  readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

const liens = (): HTMLElement[] => within(screen.getByRole('list')).getAllByRole('link');

describe('les trois étapes, montrées et cliquables', () => {
  it('porte les mots du métier, dans l’ordre du travail', () => {
    expect(ETAPES.map(({ n, titre, href }) => `${String(n)} ${titre} ${href}`)).toEqual([
      '1 Qualifier un représentant /chues/appels-representants',
      '2 Ajouter un prospect /chues/prospects/nouveau',
      '3 Convertir un prospect /chues/console',
    ]);
  });

  it('marque l’étape courante et laisse les deux autres cliquables', () => {
    render(<EtapesNav courante={2} />);

    expect(liens().map((lien) => lien.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(liens().map((lien) => lien.getAttribute('href'))).toEqual(
      ETAPES.map(({ href }) => href),
    );
  });

  it('mène de la première à la troisième d’un seul clic', () => {
    render(<EtapesNav courante={1} />);

    const troisieme = screen.getByRole('link', { name: /Convertir un prospect/u });
    expect(troisieme.getAttribute('href')).toBe('/chues/console');
    expect(troisieme.getAttribute('aria-current')).toBeNull();
  });
});

describe('le sélecteur vit dans la coque, pas dans les écrans', () => {
  it('est monté UNE fois, par le gabarit de CHUES', () => {
    expect(source(COQUE)).toContain('<EtapesNavAuto />');
    expect(PAGES.filter((chemin) => source(chemin).includes('EtapesNav'))).toEqual([]);
  });

  it('n’a laissé aucun fil d’Ariane derrière lui', () => {
    expect(PAGES.filter((chemin) => source(chemin).includes('EtapeBanner'))).toEqual([]);
  });

  it('reste visible pendant le chargement de chaque étape', () => {
    expect(LOADINGS.filter((chemin) => !source(chemin).includes('EtapeSkeleton'))).toEqual([]);
  });

  it('précharge les deux étapes voisines', () => {
    expect(source('./etapes.tsx')).toContain('prefetch');
  });
});

describe('l’étape courante, lue au segment de route', () => {
  it('reconnaît les trois écrans d’étape, et eux seuls', () => {
    expect(etapeDeSegments(['appels-representants'])).toBe(1);
    expect(etapeDeSegments(['prospects', 'nouveau'])).toBe(2);
    expect(etapeDeSegments(['console'])).toBe(3);
    expect(etapeDeSegments(['prospects'])).toBeNull();
    expect(etapeDeSegments(['representants'])).toBeNull();
    expect(etapeDeSegments([])).toBeNull();
  });

  it('marque l’étape sans rien attendre du serveur', () => {
    segments.value = ['console'];
    render(<EtapesNavAuto />);

    expect(
      screen.getByRole('link', { name: /Convertir un prospect/u }).getAttribute('aria-current'),
    ).toBe('step');
  });

  it('disparaît sur les écrans qui ne sont pas une étape', () => {
    segments.value = ['campagnes'];
    const { container } = render(<EtapesNavAuto />);

    expect(container.innerHTML).toBe('');
  });
});
