import { inflateSync } from 'node:zlib';

/**
 * Extraction du texte d'un PDF produit par pdfkit, outil de TEST uniquement.
 *
 * Il existe pour qu'une règle de confidentialité soit VÉRIFIÉE et non
 * seulement affirmée : « aucun nom de prospect n'apparaît sur le programme »
 * n'a de valeur que si un test relit réellement le document produit.
 *
 * Il lit la sortie de PRODUCTION, compressée : décompresser plutôt que de
 * régénérer un PDF non compressé pour le test, sinon le test validerait un
 * document que personne ne télécharge jamais.
 *
 * L'analyse est volontairement rudimentaire, pdfkit émet ses chaînes en
 * hexadécimal dans des opérateurs `TJ`, avec les polices standard encodées en
 * WinAnsi. Ce n'est pas un analyseur PDF général et cela n'a pas à l'être.
 */

/** Écarts WinAnsi (0x80–0x9F) qui ne coïncident pas avec Latin-1. */
const WIN_ANSI_HIGH: Readonly<Record<number, string>> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};

const decodeWinAnsi = (bytes: Buffer): string =>
  [...bytes].map((byte) => WIN_ANSI_HIGH[byte] ?? String.fromCharCode(byte)).join('');

/** Concatène le contenu décompressé de tous les flux du document. */
function contentStreams(pdf: Buffer): string {
  let decoded = '';
  let cursor = 0;

  for (;;) {
    const open = pdf.indexOf('stream', cursor);
    if (open === -1) break;
    let start = open + 'stream'.length;
    if (pdf[start] === 0x0d) start += 1;
    if (pdf[start] === 0x0a) start += 1;

    const close = pdf.indexOf('endstream', start);
    if (close === -1) break;

    const body = pdf.subarray(start, close);
    try {
      decoded += `${inflateSync(body).toString('latin1')}\n`;
    } catch {
      // Flux non compressé (polices embarquées, métadonnées) : on l'ajoute
      // brut plutôt que de le perdre.
      decoded += `${body.toString('latin1')}\n`;
    }
    cursor = close + 'endstream'.length;
  }

  return decoded;
}

/**
 * Texte visible du document, dans l'ordre où il a été écrit.
 *
 * Les chaînes sont séparées par `\n` : un test d'ordre peut donc chercher des
 * indices de position, et un test d'absence peut chercher une sous-chaîne sans
 * risquer de la voir apparaître par recollement de deux fragments voisins.
 */
export function extractPdfText(pdf: Buffer): string {
  const content = contentStreams(pdf);
  const lines: string[] = [];

  // Un opérateur `TJ` porte un TABLEAU : pdfkit y intercale des ajustements de
  // crénage, si bien qu'un seul mot arrive découpé en plusieurs morceaux
  // (`[<50726f>-25<6772616d6d65>] TJ`). Les morceaux d'un même opérateur sont
  // recollés SANS séparateur, sans quoi « Programme » deviendrait illisible et
  // un test de présence échouerait à tort. Les opérateurs successifs, eux, sont
  // séparés : deux libellés voisins ne doivent jamais fabriquer un mot qui
  // n'existe pas et faire échouer à tort un test d'absence.
  for (const operator of content.matchAll(
    /(?:\[((?:[^[\]]|\\.)*)\]\s*TJ)|(?:(\((?:\\.|[^\\()])*\))\s*Tj)/g,
  )) {
    const payload = operator[1] ?? operator[2] ?? '';
    let line = '';

    for (const literal of payload.matchAll(/<([0-9a-fA-F]*)>|\(((?:\\.|[^\\()])*)\)/g)) {
      const hex = literal[1];
      if (hex !== undefined) {
        if (hex.length === 0 || hex.length % 2 !== 0) continue;
        line += decodeWinAnsi(Buffer.from(hex, 'hex'));
      } else {
        line += (literal[2] ?? '').replace(/\\([()\\])/g, '$1');
      }
    }

    if (line !== '') lines.push(line);
  }

  return lines.join('\n');
}
