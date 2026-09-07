import { createHash } from 'node:crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const SHORT_CODE_LENGTH = 6;

const SHORT_CODE_BITS = SHORT_CODE_LENGTH * 5;

export function shortCode(id: string): string {
  const digest = createHash('sha256').update(id.trim().toLowerCase(), 'utf8').digest();

  const bits = digest.readUInt32BE(0) >>> (32 - SHORT_CODE_BITS);

  let code = '';
  for (let shift = SHORT_CODE_BITS - 5; shift >= 0; shift -= 5) {
    const character = CROCKFORD_ALPHABET[(bits >>> shift) & 0b11111];
    if (character === undefined) throw new Error('Index de code court invalide');
    code += character;
  }
  return code;
}
