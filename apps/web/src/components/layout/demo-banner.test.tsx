import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoBanner } from '@/components/layout/demo-banner';

describe('DemoBanner', () => {
  it('identifie clairement les données fictives', () => {
    render(<DemoBanner />);
    expect(screen.getByRole('status').textContent).toMatch(/Espace démo.*Données fictives/u);
  });
});
