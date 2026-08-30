import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EtapeSkeleton } from '@/components/chues/etapes';

describe('les étapes CHUES sont des pages indépendantes', () => {
  it('fournit un chargement pleine largeur sans navigation partagée', () => {
    const { container } = render(<EtapeSkeleton />);
    expect(container.firstElementChild?.className).toContain('w-full');
  });
});
