import { describe, expect, it } from 'vitest';

import {
  REGLAGES_HONORES,
  catalogueVisitesDe,
  reglagesHonores,
} from '@/components/accueil/tableau-de-bord/sources';

describe('reglagesHonores', () => {
  it('ne rend aucun réglage inerte : tableau, carte de chaleur et tuile n’honorent rien', () => {
    expect(reglagesHonores('tableau')).toEqual({ palette: false, valeurs: false, legende: false });
    expect(reglagesHonores('carte-de-chaleur')).toEqual({
      palette: false,
      valeurs: false,
      legende: false,
    });
    expect(reglagesHonores('tuile')).toEqual({ palette: false, valeurs: false, legende: false });
  });

  it('les barres honorent la palette et les valeurs, pas la légende à elles seules', () => {
    expect(reglagesHonores('barres-verticales')).toEqual({
      palette: true,
      valeurs: true,
      legende: false,
    });
    expect(reglagesHonores('barres-horizontales')).toEqual({
      palette: true,
      valeurs: true,
      legende: false,
    });
  });

  it('un anneau honore la légende mais pas les valeurs, qui n’ont pas de barre où se poser', () => {
    expect(reglagesHonores('anneau')).toEqual({ palette: true, valeurs: false, legende: true });
    expect(reglagesHonores('camembert')).toEqual({ palette: true, valeurs: false, legende: true });
  });

  it('une composition empilée honore les trois réglages', () => {
    expect(reglagesHonores('barres-empilees')).toEqual({
      palette: true,
      valeurs: true,
      legende: true,
    });
  });

  it('sans marque, aucun réglage n’est honoré', () => {
    expect(reglagesHonores(undefined)).toEqual({ palette: false, valeurs: false, legende: false });
  });

  it('couvre les vingt marques du catalogue', () => {
    expect(Object.keys(REGLAGES_HONORES)).toHaveLength(20);
  });
});

describe('catalogueVisitesDe', () => {
  it('réserve les indicateurs internes au registre à sa direction', () => {
    const accueil = catalogueVisitesDe('ACCUEIL');
    expect(accueil['par-direction']).toBeUndefined();
    expect(accueil['par-agent']).toBeUndefined();
    expect(accueil['par-objet']).toBeDefined();
  });
});
