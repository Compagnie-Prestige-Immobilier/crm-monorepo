import { createHash } from 'node:crypto';

/**
 * Identifiant court et STABLE dérivé d'un UUID.
 *
 * Pourquoi il existe : le programme d'appels imprimé ne peut porter aucun nom
 * (voir `programme-pdf.ts`), et un UUID v7 complet est illisible au téléphone,
 * un commercial qui doit rapprocher une ligne papier d'une ligne d'écran ne va
 * pas épeler 36 caractères. Six caractères se lisent d'un coup d'œil.
 *
 * L'alphabet est celui de Crockford (base 32) : ni I, ni L, ni O, ni U. Les
 * trois premiers disparaissent parce qu'ils se confondent avec 1 et 0 sur un
 * document photocopié ; le U disparaît pour éviter de fabriquer des mots
 * malheureux. Le code est toujours en MAJUSCULES.
 *
 * Il est dérivé par HACHAGE et non par troncature de l'UUID : deux UUID v7
 * créés dans la même milliseconde partagent leurs premiers caractères, donc une
 * troncature du préfixe collerait le même code à des prospects saisis à la
 * suite, exactement le cas le plus fréquent. Le hachage répartit uniformément.
 *
 * PORTÉE DE LA GARANTIE. Six caractères = 30 bits, soit ~1,07 milliard de
 * valeurs. C'est un CONFORT DE LECTURE, pas une clé : sur une campagne de
 * plusieurs centaines de milliers de lignes, une collision finit par arriver
 * (paradoxe des anniversaires). L'identité d'une ligne reste le couple
 * (numéro d'ordre, téléphone) imprimé à côté ; le code ne sert qu'à retrouver
 * la ligne vite. `hasShortCodeCollision` permet de le vérifier explicitement là
 * où c'est utile, plutôt que de le supposer.
 */

/** Alphabet Crockford base 32 : ni I, ni L, ni O, ni U. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const SHORT_CODE_LENGTH = 6;

/** Nombre de bits réellement encodés : 6 caractères × 5 bits. */
export const SHORT_CODE_BITS = SHORT_CODE_LENGTH * 5;

/**
 * Code court, déterministe, d'un identifiant. La casse et les espaces de
 * l'entrée sont normalisés pour qu'un même UUID écrit différemment donne le
 * même code.
 */
export function shortCode(id: string): string {
  const digest = createHash('sha256').update(id.trim().toLowerCase(), 'utf8').digest();

  // 32 bits lus, 30 conservés : on garde les bits de POIDS FORT, ceux du
  // condensat, plutôt que d'en tronquer la fin, les deux se valent pour
  // SHA-256, mais ce choix reste explicite si l'on change de fonction.
  const bits = digest.readUInt32BE(0) >>> (32 - SHORT_CODE_BITS);

  let code = '';
  for (let shift = SHORT_CODE_BITS - 5; shift >= 0; shift -= 5) {
    const character = CROCKFORD_ALPHABET[(bits >>> shift) & 0b11111];
    if (character === undefined) throw new Error('Index de code court invalide');
    code += character;
  }
  return code;
}

/**
 * Vrai si deux identifiants du lot partagent un code. À appeler quand la
 * lisibilité doit être garantie sur un tirage précis, jamais pour en déduire
 * une unicité générale, qui n'existe pas à 30 bits.
 */
export function hasShortCodeCollision(ids: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    const code = shortCode(id);
    if (seen.has(code)) return true;
    seen.add(code);
  }
  return false;
}
