import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore } from './fake-release-store.js';

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
  it('AppUpdateDto.notes est une chaîne nullable, et non un objet vide', () => {
    const notes = schema('AppUpdateDto').properties?.notes;

    expect(notes).toBeDefined();
    expect(notes?.type).toBe('string');
    expect(notes?.nullable).toBe(true);
  });

  it('AppUpdateDto.notes reste une propriété obligatoire', () => {
    expect(schema('AppUpdateDto').required ?? []).toContain('notes');
  });

  it('aucune propriété du module ne sort sans type ni $ref', () => {
    let vues = 0;
    for (const [property, definition] of Object.entries(schema('AppUpdateDto').properties ?? {})) {
      vues += 1;
      expect(
        definition.type !== undefined || definition.$ref !== undefined,
        `AppUpdateDto.${property} : schéma sans type ni $ref`,
      ).toBe(true);
    }
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
