import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HttpException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';

import { ApkSignerError, assertExpectedSigner, readApkSignerSha256 } from './apk-signature.js';
import { AUTRE_SIGNER, FIXTURE_SIGNER } from './fake-release-store.js';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cpi-apk-signature-'));
});

const codeOf = async (run: () => unknown): Promise<string> => {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const payload: unknown = (error as HttpException).getResponse();
    return typeof payload === 'object' && payload !== null && 'code' in payload
      ? String(payload.code)
      : '';
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
};

/**
 * Les empreintes attendues viennent de
 * `apksigner verify --min-sdk-version 24 --print-certs <apk>` (build-tools 35).
 * Les fixtures sont signées v2+v3 par deux clés jetables engendrées au keytool.
 */
describe('readApkSignerSha256', () => {
  it('lit l’empreinte du certificat signataire d’un APK', async () => {
    await expect(readApkSignerSha256(fixture('cpi-go-v7.apk'))).resolves.toBe(FIXTURE_SIGNER);
  });

  it('rend la MÊME empreinte pour un autre APK de la même clé', async () => {
    await expect(readApkSignerSha256(fixture('cpi-go-v12.apk'))).resolves.toBe(FIXTURE_SIGNER);
  });

  it('rend une empreinte DIFFÉRENTE pour un APK d’une autre clé', async () => {
    const autre = await readApkSignerSha256(fixture('cpi-go-v12-autre-cle.apk'));

    expect(autre).toBe(AUTRE_SIGNER);
    expect(autre).not.toBe(FIXTURE_SIGNER);
  });

  it('refuse un APK sans bloc de signature plutôt que de rendre une empreinte vide', async () => {
    expect(await codeOf(() => readApkSignerSha256(fixture('cpi-go-v7-non-signe.apk')))).toBe(
      ApkSignerError.UNSIGNED,
    );
  });

  it('refuse un fichier qui n’est pas une archive', async () => {
    const path = join(directory, 'pas-une-archive.apk');
    await writeFile(path, 'ceci est du texte, pas un ZIP, et certainement pas un APK');

    expect(await codeOf(() => readApkSignerSha256(path))).toBe(ApkSignerError.UNSIGNED);
  });

  it('refuse un bloc de signature TRONQUÉ, sans lire à côté', async () => {
    const signe = await readFile(fixture('cpi-go-v7.apk'));
    const path = join(directory, 'tronque.apk');
    // Le pied de bloc annonce une taille que le fichier ne porte plus.
    await writeFile(path, Buffer.concat([signe.subarray(0, 3_000), signe.subarray(4_500)]));

    expect(await codeOf(() => readApkSignerSha256(path))).toBe(ApkSignerError.UNSIGNED);
  });

  it('refuse un fichier absent', async () => {
    expect(await codeOf(() => readApkSignerSha256(join(directory, 'inexistant.apk')))).toBe(
      ApkSignerError.UNSIGNED,
    );
  });
});

describe('assertExpectedSigner', () => {
  it('accepte quand aucune référence n’est connue', () => {
    expect(() => {
      assertExpectedSigner(FIXTURE_SIGNER, '');
    }).not.toThrow();
  });

  it('accepte l’empreinte attendue', () => {
    expect(() => {
      assertExpectedSigner(FIXTURE_SIGNER, FIXTURE_SIGNER);
    }).not.toThrow();
  });

  it('refuse une autre clé et NOMME les deux empreintes', async () => {
    expect(
      await codeOf(() => {
        assertExpectedSigner(AUTRE_SIGNER, FIXTURE_SIGNER);
      }),
    ).toBe(ApkSignerError.MISMATCH);

    let message = '';
    try {
      assertExpectedSigner(AUTRE_SIGNER, FIXTURE_SIGNER);
    } catch (error) {
      message = (error as HttpException).message;
    }
    expect(message).toContain(AUTRE_SIGNER);
    expect(message).toContain(FIXTURE_SIGNER);
  });
});
