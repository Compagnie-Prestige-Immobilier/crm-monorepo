'use client';

import { useEffect, useRef, useState } from 'react';

import { formatNumber } from '@/lib/format';
import { DUR_2_MS, interpolateCount } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/**
 * Compteur qui GLISSE d'une valeur à l'autre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le défaut que ce composant existe pour supprimer.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sur un écran qui se rafraîchit toutes les dix secondes, un nombre qui saute
 * de 1 204 à 1 207 se lit comme un CLIGNOTEMENT : l'œil détecte le changement
 * mais pas sa nature, et il faut relire pour savoir si le chiffre a monté ou
 * descendu. Une interpolation de 220 ms (§7, `dur-2`) rend le mouvement
 * directionnel : on voit le compteur monter.
 *
 * Trois points ne sont pas négociables :
 *
 *  - `tabular-nums`, imposé par l'appelant sur la classe. Sans lui, la largeur
 *    des chiffres varie et la carte entière se décale à chaque image. C'est le
 *    « saut de mise en page » qu'on cherche justement à éviter.
 *  - `prefers-reduced-motion` : la valeur est posée d'un coup, sans image
 *    intermédiaire. La logique ne change pas, seule la durée tombe à zéro.
 *  - `aria-live` reste ABSENT. Un lecteur d'écran qui annoncerait chaque image
 *    intermédiaire lirait quarante nombres pour un seul changement. La valeur
 *    finale est dans le DOM, c'est ce qui compte.
 */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string | undefined;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  /**
   * Valeur RÉELLEMENT affichée, tenue dans une ref.
   *
   * Elle suit chaque image de l'animation. C'est ce qui permet à une nouvelle
   * valeur arrivée en cours de route de repartir d'où l'œil en est, plutôt que
   * de l'ancienne cible : sans cela, le compteur reculerait visiblement avant
   * de repartir vers le haut.
   */
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;

    if (reduced) {
      shownRef.current = value;
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / DUR_2_MS);
      const next = interpolateCount(from, value, progress);
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  return <span className={className}>{formatNumber(shown)}</span>;
}
