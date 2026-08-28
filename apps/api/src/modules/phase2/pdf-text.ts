import { inflateSync } from 'node:zlib';

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
      decoded += `${body.toString('latin1')}\n`;
    }
    cursor = close + 'endstream'.length;
  }

  return decoded;
}

export function extractPdfText(pdf: Buffer): string {
  const content = contentStreams(pdf);
  const lines: string[] = [];

  for (const operator of content.matchAll(
    /(?:\[((?:[^[\]]|\\.)*)\]\s*TJ)|(?:(\((?:\\.|[^\\()])*\))\s*Tj)/g,
  )) {
    const payload = operator[1] ?? operator[2] ?? '';
    let line = '';

    for (const literal of payload.matchAll(/<([0-9a-fA-F]*)>|\(((?:\\.|[^\\()])*)\)/g))
      line += decodeLiteral(literal);

    if (line !== '') lines.push(line);
  }

  return lines.join('\n');
}

function decodeLiteral(literal: RegExpExecArray): string {
  const hex = literal[1];
  if (hex === undefined) return (literal[2] ?? '').replace(/\\([()\\])/g, '$1');
  if (hex.length === 0 || hex.length % 2 !== 0) return '';
  return decodeWinAnsi(Buffer.from(hex, 'hex'));
}
