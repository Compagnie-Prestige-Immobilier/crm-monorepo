import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore } from './fake-release-store.js';

/**
 * Contrat publié par le module, relu tel que les générateurs le verront.
 *
 * Des clients TypeScript et Dart sont engendrés à partir de ce document. La
 * faute visée ici est invisible à la relecture : une propriété déclarée
 * `@ApiProperty()` sans `type` explicite alors que son type TypeScript est une
 * UNION (`string | null`). La métadonnée `design:type` émise par le compilateur
 * réduit l'union à `Object`, le schéma sort sans `type` ni `$ref`, et le
 * générateur produit `Record<string, never>` en TypeScript et `Object?` en
 * Dart. Le champ devient inutilisable sans transtypage manuel, alors que rien
 * n'a jamais échoué côté serveur.
 *
 * Le document est construit ICI, à partir des décorateurs, plutôt que lu dans
 * `openapi.json` : la régénération du fichier publié est une étape séparée, et
 * un test qui lirait un fichier périmé validerait l'ancien contrat.
 */

let document: ReturnType<typeof SwaggerModule.createDocument>;
let app: NestFastifyApplication;

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  process.env.APK_RELEASE_DIR = await mkdtemp(join(tmpdir(), 'cpi-contract-'));

  app = await createAppUpdatesApp(new FakeReleaseStore());
  document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('contrat').setVersion('1.0.0').build(),
  );
});

afterAll(async () => {
  await app.close();
});

interface Schema {
  type?: string;
  nullable?: boolean;
  $ref?: string;
  required?: string[];
  properties?: Record<string, Schema>;
}

const schema = (name: string): Schema => {
  const found = (document.components?.schemas as Record<string, Schema> | undefined)?.[name];
  expect(found, `schéma ${name} absent du document`).toBeDefined();
  return found as Schema;
};

describe('contrat app-updates', () => {
  /**
   * `notes` est le champ qui régressait : `string | null` sans `type` explicite.
   */
  it('AppUpdateDto.notes est une chaîne nullable, et non un objet vide', () => {
    const notes = schema('AppUpdateDto').properties?.notes;

    expect(notes).toBeDefined();
    expect(notes?.type).toBe('string');
    expect(notes?.nullable).toBe(true);
  });

  /**
   * Nullable n'est pas optionnel : le serveur envoie TOUJOURS la clé, avec
   * `null` faute de note. Déclarée optionnelle, elle ferait engendrer côté Dart
   * un champ absent là où arrive un `null`.
   */
  it('AppUpdateDto.notes reste une propriété obligatoire', () => {
    expect(schema('AppUpdateDto').required ?? []).toContain('notes');
  });

  /**
   * Le vrai garde-fou : AUCUNE propriété du module ne doit sortir sans type.
   * Sans ce balayage, la même faute reviendrait au premier champ ajouté.
   */
  it('aucune propriété du module ne sort sans type ni $ref', () => {
    let vues = 0;
    // `AppUpdateUploadDto` n'apparaît PAS dans les composants : le corps
    // multipart de la publication est décrit par un schéma écrit à la main dans
    // le contrôleur. Seul le DTO de réponse est engendré, donc balayé ici.
    for (const [property, definition] of Object.entries(schema('AppUpdateDto').properties ?? {})) {
      vues += 1;
      expect(
        definition.type !== undefined || definition.$ref !== undefined,
        `AppUpdateDto.${property} : schéma sans type ni $ref`,
      ).toBe(true);
    }
    // Garde-fou : si le schéma cessait d'être produit, la boucle passerait à
    // vide et ne prouverait plus rien.
    expect(vues).toBe(10);
  });

  it('les opérations gardent leurs operationId, sur lesquels les clients sont engendrés', () => {
    const paths = document.paths as Record<string, Record<string, { operationId?: string }>>;
    expect(paths['/api/v1/app-updates/android/current']?.get?.operationId).toBe('getAndroidUpdate');
    expect(paths['/api/v1/app-updates/android/download']?.get?.operationId).toBe(
      'downloadAndroidUpdate',
    );
    expect(paths['/api/v1/app-updates/android']?.post?.operationId).toBe('uploadAndroidUpdate');
  });
});
