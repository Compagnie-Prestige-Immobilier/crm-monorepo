import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CPI_BURGUNDY = '#630210';

export const CPI_BURGUNDY_ARGB = `FF${CPI_BURGUNDY.slice(1).toUpperCase()}`;

export const CPI_RULE_GREY = '#c9c2c4';

export const CPI_ZEBRA = '#f6f2f3';

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
