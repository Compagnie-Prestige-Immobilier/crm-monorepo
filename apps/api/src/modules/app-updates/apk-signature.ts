import { X509Certificate } from 'node:crypto';
import { open } from 'node:fs/promises';

import { UnprocessableEntityException } from '@nestjs/common';

const ApkSignerError = {
  UNSIGNED: 'APK_UNSIGNED',
  MISMATCH: 'APK_SIGNER_MISMATCH',
} as const;

const apkUnsigned = (detail: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkSignerError.UNSIGNED,
    message:
      'Cet APK ne porte pas de bloc de signature v2/v3 lisible : Android ' +
      `refuserait de l’installer, et la publication est annulée. Détail technique : ${detail}`,
  });

const apkSignerMismatch = (found: string, expected: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkSignerError.MISMATCH,
    message:
      `Cet APK est signé par le certificat ${found}, or le parc porte ${expected}. ` +
      'Android refuse une mise à jour signée par une autre clé : les téléphones ' +
      'devraient désinstaller CPI GO pour l’accepter, en perdant leurs saisies ' +
      'non synchronisées. La publication est annulée.',
  });

const EOCD_SIGNATURE = 0x0605_4b50;
const EOCD_MIN_SIZE = 22;
const EOCD_SEARCH_SPAN = 65_557;
const SIGNING_BLOCK_MAGIC = 'APK Sig Block 42';
const SIGNING_BLOCK_FOOTER = 24;
const MAX_SIGNING_BLOCK_BYTES = 33_554_432;
const V2_BLOCK_ID = 0x7109_871a;
const V3_BLOCK_ID = 0xf053_68c0;

const findEocd = (tail: Buffer): number => {
  for (let index = tail.length - EOCD_MIN_SIZE; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) === EOCD_SIGNATURE) return index;
  }
  return -1;
};

/** Chaque bloc du conteneur est une valeur précédée de sa longueur sur 32 bits. */
class LengthPrefixed {
  private offset = 0;

  constructor(private readonly bytes: Buffer) {}

  next(): Buffer {
    if (this.offset + 4 > this.bytes.length) throw new RangeError('longueur tronquée');
    const length = this.bytes.readUInt32LE(this.offset);
    const start = this.offset + 4;
    if (start + length > this.bytes.length) throw new RangeError('valeur tronquée');
    this.offset = start + length;
    return this.bytes.subarray(start, start + length);
  }
}

const firstCertificate = (signers: Buffer): Buffer => {
  const signer = new LengthPrefixed(new LengthPrefixed(signers).next()).next();
  const signedData = new LengthPrefixed(signer).next();
  const fields = new LengthPrefixed(signedData);
  fields.next();
  return new LengthPrefixed(fields.next()).next();
};

const fingerprintOf = (der: Buffer): string =>
  new X509Certificate(der).fingerprint256.replaceAll(':', '').toLowerCase();

async function readSigningBlock(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, EOCD_SEARCH_SPAN);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);

    const eocd = findEocd(tail);
    if (eocd < 0) throw new RangeError('aucun en-tête de fin d’archive ZIP');

    const centralDirectory = tail.readUInt32LE(eocd + 16);
    if (centralDirectory === 0xffff_ffff) throw new RangeError('archive ZIP64 non prise en charge');
    if (centralDirectory < SIGNING_BLOCK_FOOTER) throw new RangeError('aucun bloc de signature');

    const footer = Buffer.alloc(SIGNING_BLOCK_FOOTER);
    await handle.read(footer, 0, SIGNING_BLOCK_FOOTER, centralDirectory - SIGNING_BLOCK_FOOTER);
    if (footer.subarray(8).toString('latin1') !== SIGNING_BLOCK_MAGIC) {
      throw new RangeError('aucun bloc de signature APK avant le répertoire central');
    }

    const declared = Number(footer.readBigUInt64LE(0));
    if (
      declared <= SIGNING_BLOCK_FOOTER ||
      declared > MAX_SIGNING_BLOCK_BYTES ||
      declared + 8 > centralDirectory
    ) {
      throw new RangeError('taille de bloc de signature aberrante');
    }

    const pairs = Buffer.alloc(declared - SIGNING_BLOCK_FOOTER);
    await handle.read(pairs, 0, pairs.length, centralDirectory - declared);
    return pairs;
  } finally {
    await handle.close();
  }
}

/**
 * Lit l'empreinte du certificat DÉCLARÉ par l'APK : ce n'est pas une
 * vérification cryptographique, la signature elle-même n'est pas contrôlée.
 * Elle sert à refuser une publication signée d'une autre clé que le parc.
 */
export async function readApkSignerSha256(path: string): Promise<string> {
  let pairs: Buffer;
  try {
    pairs = await readSigningBlock(path);
  } catch (error) {
    throw apkUnsigned(error instanceof Error ? error.message : String(error));
  }

  const values = new Map<number, Buffer>();
  let offset = 0;
  while (offset + 12 <= pairs.length) {
    const length = Number(pairs.readBigUInt64LE(offset));
    if (length < 4 || offset + 8 + length > pairs.length) break;
    values.set(pairs.readUInt32LE(offset + 8), pairs.subarray(offset + 12, offset + 8 + length));
    offset += 8 + length;
  }

  for (const id of [V2_BLOCK_ID, V3_BLOCK_ID]) {
    const signers = values.get(id);
    if (signers === undefined) continue;
    try {
      return fingerprintOf(firstCertificate(signers));
    } catch (error) {
      throw apkUnsigned(error instanceof Error ? error.message : String(error));
    }
  }

  throw apkUnsigned('le bloc de signature ne contient ni schéma v2 ni schéma v3');
}

export function assertExpectedSigner(found: string, expected: string): void {
  if (expected !== '' && found !== expected) throw apkSignerMismatch(found, expected);
}
