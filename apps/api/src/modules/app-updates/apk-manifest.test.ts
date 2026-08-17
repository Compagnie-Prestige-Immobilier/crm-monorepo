import { writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { HttpException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ApkError,
  assertPublishable,
  EXPECTED_PACKAGE_NAME,
  readApkIdentity,
  type ApkIdentity,
} from './apk-manifest.js';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cpi-apk-manifest-'));
});

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
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

const messageOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return (error as HttpException).message;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
};

describe('readApkIdentity', () => {
  it('lit le paquet, le versionCode et le versionName dans un APK réel', async () => {
    await expect(readApkIdentity(fixture('cpi-go-v7.apk'))).resolves.toEqual({
      packageName: 'sn.cpi.go',
      versionCode: 7,
      versionName: '1.4.2',
    });
  });

  it('lit un second APK et en rend des valeurs DIFFÉRENTES', async () => {
    await expect(readApkIdentity(fixture('cpi-go-v12.apk'))).resolves.toEqual({
      packageName: 'sn.cpi.go',
      versionCode: 12,
      versionName: '1.9.0',
    });
  });

  it('lit le paquet étranger tel qu’il est déclaré, sans le corriger', async () => {
    const identity = await readApkIdentity(fixture('autre-editeur-v99.apk'));
    expect(identity.packageName).toBe('com.autre.editeur');
    expect(identity.versionCode).toBe(99);
  });

  it('refuse un manifeste qui n’est pas de l’AXML, sans jamais deviner de version', async () => {
    expect(await codeOf(() => readApkIdentity(fixture('manifeste-illisible.apk')))).toBe(
      ApkError.UNREADABLE,
    );
  });

  it('refuse un fichier qui n’est pas une archive', async () => {
    const path = join(directory, 'pas-une-archive.apk');
    await writeFile(path, 'ceci est du texte, pas un ZIP, et certainement pas un APK');
    expect(await codeOf(() => readApkIdentity(path))).toBe(ApkError.UNREADABLE);
  });

  it('refuse un fichier absent plutôt que de lever une erreur non traitée', async () => {
    expect(await codeOf(() => readApkIdentity(join(directory, 'inexistant.apk')))).toBe(
      ApkError.UNREADABLE,
    );
  });

  it('conserve la raison technique du refus dans le message', async () => {
    const message = await messageOf(() => readApkIdentity(fixture('manifeste-illisible.apk')));
    expect(message).toContain('Invalid XML header');
  });
});

describe('assertPublishable', () => {
  const cpiGo = (versionCode: number): ApkIdentity => ({
    packageName: EXPECTED_PACKAGE_NAME,
    versionCode,
    versionName: `1.0.${String(versionCode)}`,
  });

  it('accepte une première publication, qui ne se compare à rien', () => {
    expect(() => {
      assertPublishable(cpiGo(1), null);
    }).not.toThrow();
  });

  it('accepte un versionCode strictement supérieur', () => {
    expect(() => {
      assertPublishable(cpiGo(12), 7);
    }).not.toThrow();
  });

  it('refuse un versionCode ÉGAL à celui en ligne', () => {
    expect(() => {
      assertPublishable(cpiGo(7), 7);
    }).toThrow();
  });

  it('refuse un versionCode inférieur et NOMME les deux nombres', () => {
    let message = '';
    try {
      assertPublishable(cpiGo(3), 7);
    } catch (error) {
      message = (error as HttpException).message;
    }
    expect(message).toContain('3');
    expect(message).toContain('7');
  });

  it('refuse un paquet étranger et le NOMME', () => {
    let payload: unknown;
    try {
      assertPublishable(
        { packageName: 'com.autre.editeur', versionCode: 99, versionName: '9.9.9' },
        7,
      );
    } catch (error) {
      payload = (error as HttpException).getResponse();
    }
    expect(payload).toMatchObject({ code: ApkError.FOREIGN_PACKAGE });
    expect(JSON.stringify(payload)).toContain('com.autre.editeur');
  });

  it('refuse un paquet étranger même quand sa version dépasse celle en ligne', () => {
    let payload: unknown;
    try {
      assertPublishable(
        { packageName: 'com.autre.editeur', versionCode: 9_999, versionName: '9.9.9' },
        7,
      );
    } catch (error) {
      payload = (error as HttpException).getResponse();
    }
    expect(payload).toMatchObject({ code: ApkError.FOREIGN_PACKAGE });
  });
});
