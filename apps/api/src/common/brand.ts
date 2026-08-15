import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Identité visuelle CPI, définie une seule fois.
 *
 * Le bordeaux vivait en double : une constante ARGB dans l'export Excel, rien
 * du tout dans le PDF. Deux documents sortis du même produit le même jour ne
 * portaient donc pas la même couleur, et personne ne pouvait dire laquelle
 * était la bonne. Les deux notations sont dérivées d'une seule valeur.
 */

/** Bordeaux CPI, notation CSS. C'est la valeur de référence. */
export const CPI_BURGUNDY = '#630210';

/** Même couleur en ARGB sans dièse : exceljs refuse la notation CSS. */
export const CPI_BURGUNDY_ARGB = `FF${CPI_BURGUNDY.slice(1).toUpperCase()}`;

/** Gris des filets et des libellés secondaires. */
export const CPI_RULE_GREY = '#c9c2c4';

/** Fond des lignes paires du tableau. Assez clair pour rester lisible imprimé. */
export const CPI_ZEBRA = '#f6f2f3';

/**
 * Logo, chargé UNE FOIS au premier accès et mémorisé.
 *
 * ─── UN LOGO ABSENT NE DOIT JAMAIS FAIRE ÉCHOUER UN TÉLÉCHARGEMENT ──────────
 *
 * L'image est un fichier de l'arbre source, embarqué dans l'image Docker par un
 * `COPY` distinct (voir infra/docker/Dockerfile.api). Un `COPY` oublié lors
 * d'une refonte du fichier de build est une erreur silencieuse : la compilation
 * passe, les tests passent, et c'est la production qui casse, sur le seul
 * document que CPI remet à l'extérieur. On renvoie donc `null` plutôt que de
 * lever, et l'en-tête retombe sur sa variante texte, qui reste présentable.
 *
 * La mémorisation porte aussi l'échec : sans elle, un fichier manquant
 * provoquerait un accès disque raté par page de chaque PDF.
 */
const LOGO_URL = new URL('../../assets/brand/cpi-logo.png', import.meta.url);

let logoCache: { buffer: Buffer | null } | null = null;

export function cpiLogo(): Buffer | null {
  logoCache ??= { buffer: readLogo() };
  return logoCache.buffer;
}

function readLogo(): Buffer | null {
  try {
    return readFileSync(fileURLToPath(LOGO_URL));
  } catch {
    return null;
  }
}

/** Réservé aux tests : force une relecture du fichier au prochain appel. */
export function resetCpiLogoCache(): void {
  logoCache = null;
}
