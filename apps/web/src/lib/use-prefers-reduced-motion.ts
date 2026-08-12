'use client';

import { useEffect, useState } from 'react';

/**
 * Le CSS de `globals.css` neutralise déjà les transitions, mais Chart.js anime
 * en JavaScript sur un `<canvas>` : aucune règle CSS ne l'atteint. Il faut donc
 * lire la préférence explicitement et couper `options.animation`.
 */
export function usePrefersReducedMotion(): boolean {
  /**
   * Initialiseur PARESSEUX, et ce n'est pas une micro-optimisation.
   *
   * Avec `useState(false)`, la préférence n'était connue qu'au premier effet.
   * Or React vide les effets passifs des ENFANTS D'ABORD : celui de
   * `react-chartjs-2`, qui CONSTRUIT le graphique — et lance donc l'animation
   * d'entrée de 220 ms —, s'exécutait avant celui qui passe `reduced` à `true`.
   * Un utilisateur ayant demandé moins d'animation voyait malgré tout les six
   * graphiques du tableau de bord s'animer à chaque chargement ; seules les
   * mises à jour suivantes étaient immobiles.
   *
   * Lue dès l'initialisation, la préférence est disponible au tout premier
   * rendu, donc avant la construction du graphique. `typeof window` garde le
   * rendu serveur, où `matchMedia` n'existe pas.
   */
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}
