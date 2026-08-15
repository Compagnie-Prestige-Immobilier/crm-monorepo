/**
 * Mouvement : docs/design.md §7, transposé en JavaScript.
 *
 * Le CSS couvre tout ce qui est déclaratif. Restent les valeurs qu'un moteur
 * de rendu ne sait pas interpoler : le CONTENU TEXTUEL d'un compteur. Aucune
 * transition CSS n'anime « 1 204 » vers « 1 207 » ; il faut calculer les
 * valeurs intermédiaires, donc disposer des courbes du design system ici.
 *
 * Les courbes ne sont pas réécrites « à peu près » en `easeOutQuint` : ce sont
 * exactement les deux cubic-bezier du document, évaluées. Une approximation
 * ferait diverger le mouvement d'un compteur de celui de la carte qui le porte,
 * et l'œil voit très bien deux ralentissements qui ne finissent pas ensemble.
 */

/** §7 : micro-retours. */
export const DUR_1_MS = 150;
/** §7 : transitions de composant. C'est la durée d'une valeur qui change. */
export const DUR_2_MS = 220;
/** §7 : transitions d'écran. */
export const DUR_3_MS = 300;

/**
 * Évalue une courbe `cubic-bezier(x1, y1, x2, y2)` de CSS.
 *
 * Une courbe de Bézier est paramétrée par `t`, pas par `x` : `bezier(0.5)` ne
 * donne PAS la valeur à mi-parcours du temps. Il faut d'abord retrouver le `t`
 * dont l'abscisse vaut le temps écoulé, ce que fait Newton-Raphson ci-dessous -
 * c'est la méthode des navigateurs eux-mêmes.
 *
 * Sans cette inversion, `cubic-bezier(0.34, 1.56, 0.64, 1)` (le rebond) rendrait
 * une courbe sans rebond du tout.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (time: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;

  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  return (time: number): number => {
    if (time <= 0) return 0;
    if (time >= 1) return 1;

    let t = time;
    // Huit itérations suffisent largement : l'erreur résiduelle est très en
    // dessous du pixel, et la boucle tourne à chaque image.
    for (let index = 0; index < 8; index += 1) {
      const error = sampleX(t) - time;
      if (Math.abs(error) < 1e-6) break;
      const slope = slopeX(t);
      // Pente nulle : Newton diverge. On s'arrête plutôt que de partir à
      // l'infini : la valeur courante est déjà proche.
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }

    return sampleY(t);
  };
}

/** §7 : entrées et sorties. */
export const easeOut = cubicBezier(0.22, 1, 0.36, 1);

/** §7 : confirmations, rebond léger. */
export const easeSpring = cubicBezier(0.34, 1.56, 0.64, 1);

/**
 * Valeur intermédiaire d'un compteur, arrondie à l'entier.
 *
 * L'arrondi est fait ICI et non à l'affichage : un compteur qui passe par
 * 1 204,7 puis 1 205,3 afficherait deux fois « 1 205 » et sauterait une image
 * pour rien. Arrondir tôt rend la suite des valeurs monotone.
 */
export function interpolateCount(from: number, to: number, progress: number): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return Math.round(from + (to - from) * easeOut(progress));
}
