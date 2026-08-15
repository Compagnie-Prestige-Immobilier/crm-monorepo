/**
 * Les marques de démonstration PORTÉES PAR LE FICHIER, côté panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'API pose trois marques sur tout export produit en mode démonstration
 * (`apps/api/src/modules/export/demo-marking.ts`) : une ligne rouge dans le
 * classeur, les métadonnées du document, et DEUX marques hors fichier : l'en-tête
 * `X-Demo-Mode` et le suffixe `-DEMONSTRATION` du nom.
 *
 * Ces deux dernières étaient perdues sur le SEUL chemin que les utilisateurs
 * empruntent réellement. Le relais `/api/export/*` reconstruit ses en-têtes de
 * réponse et n'y recopiait pas `X-Demo-Mode` ; le nom de fichier, lui, est
 * refabriqué côté panel (`exportFileName`, `bankExportFileName`) et n'a jamais
 * porté le suffixe. Le navigateur, de son côté, enregistre le blob sous le nom
 * que lui donne `useFileDownload` : le `Content-Disposition` de l'amont ne le
 * décide pas.
 *
 * Résultat : un classeur de chiffres fictifs arrivait dans le dossier
 * Téléchargements sous le nom d'un vrai export. Il part ensuite par courriel, et
 * plus rien à l'extérieur ne dit d'où il vient : c'est précisément ce que la
 * ligne rouge, à elle seule, ne suffit pas à empêcher (un copier-coller de la
 * plage de données l'efface).
 *
 * Les valeurs sont recopiées à l'identique de l'API. Elles constituent un
 * contrat de bout en bout, pas un détail de présentation.
 */

/** En-tête posé par l'API sur toute réponse d'export ou de statistiques. */
export const DEMO_MODE_HEADER = 'X-Demo-Mode';

/** Suffixe inséré avant l'extension. Majuscules : il doit sauter aux yeux. */
export const DEMO_FILENAME_SUFFIX = '-DEMONSTRATION';

/**
 * L'en-tête dit-il « démonstration » ?
 *
 * L'API le pose TOUJOURS, `true` comme `false` : un en-tête absent est ambigu
 * (mode éteint ? version antérieure ? proxy qui filtre ?). On ne traite donc
 * comme démonstration que le `true` explicite, jamais l'absence.
 */
export function isDemoResponse(headers: Headers): boolean {
  return headers.get(DEMO_MODE_HEADER)?.trim().toLowerCase() === 'true';
}

/**
 * Insère le suffixe AVANT l'extension, jamais après.
 *
 * `cpi-prospects-2026-08-13.xlsx-DEMONSTRATION` ne s'ouvrirait plus dans Excel :
 * le marquage doit avertir, pas casser le fichier. Idempotent : deux passages
 * (relais puis navigateur) ne doublent pas le suffixe.
 */
export function withDemoSuffix(fileName: string, demoEnabled: boolean): string {
  if (!demoEnabled) return fileName;

  const dot = fileName.lastIndexOf('.');
  const stem = dot <= 0 ? fileName : fileName.slice(0, dot);
  const extension = dot <= 0 ? '' : fileName.slice(dot);

  return stem.endsWith(DEMO_FILENAME_SUFFIX)
    ? fileName
    : `${stem}${DEMO_FILENAME_SUFFIX}${extension}`;
}
