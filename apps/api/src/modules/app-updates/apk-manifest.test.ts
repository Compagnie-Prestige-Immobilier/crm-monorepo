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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DES APK RÉELS, PAS DES DOUBLURES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les quatre fichiers de `fixtures/` sont de VRAIS APK, produits par `aapt2`
 * (Android SDK, build-tools 35). Ils pèsent moins de 700 octets chacun parce
 * qu'ils ne contiennent qu'un manifeste et une table de ressources vide :
 * aucun code, aucune image.
 *
 * C'est le seul montage qui prouve quoi que ce soit. `AndroidManifest.xml` est
 * du XML BINAIRE, et un tampon fabriqué à la main dans le test décrirait la
 * lecture qu'on IMAGINE au lieu du format qu'`aapt2` écrit réellement. Une
 * doublure de l'analyseur, elle, ne testerait plus que la doublure.
 *
 * Fichiers, et ce que chacun démontre :
 *
 *   cpi-go-v7.apk          sn.cpi.go, versionCode 7,  versionName 1.4.2
 *   cpi-go-v12.apk         sn.cpi.go, versionCode 12, versionName 1.9.0
 *   autre-editeur-v99.apk  com.autre.editeur, versionCode 99
 *   manifeste-illisible.apk  un vrai ZIP, dont AndroidManifest.xml n'est pas
 *                            de l'AXML : le cas où il faut refuser, pas deviner
 */

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cpi-apk-manifest-'));
});

/** Le code métier de l'exception, tel que le panel le lira. */
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

  /**
   * Contre-épreuve indispensable : sans elle, une implémentation qui rendrait
   * toujours `{ sn.cpi.go, 7, 1.4.2 }` passerait le test ci-dessus.
   */
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

  /**
   * LE test qui garde la règle « jamais de repli ». Un manifeste illisible doit
   * produire un refus, pas une valeur devinée.
   */
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

  /**
   * Le détail technique de la bibliothèque est CONSERVÉ dans le message :
   * « Invalid XML header » et « APK does not contain 'AndroidManifest.xml' »
   * décrivent deux problèmes différents, et sans eux l'administrateur ne peut
   * pas dire lequel il a.
   */
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

  /**
   * L'ÉGALITÉ est refusée, et c'est délibéré. Republier le même versionCode
   * remplace le fichier servi sans qu'aucun téléphone ne se mette à jour : le
   * parc reste sur l'APK précédent, mais le sha256 annoncé change, et chaque
   * appareil qui reprend un téléchargement en cours recolle des octets de deux
   * fichiers différents.
   */
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

  /**
   * Le paquet est vérifié AVANT la version : un APK étranger portant un
   * versionCode très haut ne doit pas être accepté au motif qu'il « monte ».
   */
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
