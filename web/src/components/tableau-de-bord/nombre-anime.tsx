import { useEffect, useRef, useState } from 'react';

import { useMouvementReduit } from '@/components/tableau-de-bord/theme';
import { formatNumber } from '@/lib/format';

/** Assez long pour qu'on voie le nombre rouler, assez court pour ne pas mentir sur sa fraîcheur. */
const DUREE_MS = 700;

export function NombreAnime({
  valeur,
  format = formatNumber,
  className,
}: {
  valeur: number;
  format?: (valeur: number) => string;
  className?: string | undefined;
}) {
  const reduit = useMouvementReduit();
  const [anime, setAnime] = useState(valeur);
  const afficheRef = useRef(valeur);

  useEffect(() => {
    const depart = afficheRef.current;
    if (reduit || depart === valeur) return;

    let frame = 0;
    const debut = performance.now();
    const pas = (maintenant: number): void => {
      const avance = Math.min(1, (maintenant - debut) / DUREE_MS);
      const adouci = 1 - (1 - avance) ** 3;
      const suivant = Math.round(depart + (valeur - depart) * adouci);
      afficheRef.current = suivant;
      setAnime(suivant);
      if (avance < 1) frame = requestAnimationFrame(pas);
    };

    frame = requestAnimationFrame(pas);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [valeur, reduit]);

  return <span className={className}>{format(reduit ? valeur : anime)}</span>;
}
