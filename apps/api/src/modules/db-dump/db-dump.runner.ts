import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';

import { pgEnvironmentFrom } from './pg-connection.js';

export interface DumpRunner {
  run(destination: string): Promise<void>;
}

export const DUMP_RUNNER = Symbol('DUMP_RUNNER');

// `--schema=public` : le schéma `demo` porte des centaines de milliers de
// lignes engendrées, sans valeur de sauvegarde et qui doubleraient l'export.
const PG_DUMP_ARGUMENTS = [
  '--format=plain',
  '--no-owner',
  '--no-privileges',
  '--schema=public',
] as const;

const PG_DUMP_BINARY = 'pg_dump';

@Injectable()
export class PgDumpRunner implements DumpRunner {
  private readonly logger = new Logger(PgDumpRunner.name);

  constructor(private readonly databaseUrl: string) {}

  async run(destination: string): Promise<void> {
    const child = spawn(PG_DUMP_BINARY, PG_DUMP_ARGUMENTS, {
      env: { ...pgEnvironmentFrom(this.databaseUrl), PATH: process.env.PATH ?? '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 4_000) stderr += chunk.toString('utf8');
    });

    const exited = new Promise<void>((resolve, reject) => {
      child.on('error', (error: Error) => {
        reject(
          new Error(
            `pg_dump est introuvable ou n’a pas pu démarrer (${error.message}). ` +
              'Vérifiez que postgresql-client est installé dans l’image.',
          ),
        );
      });
      child.on('close', (code: number | null, signal: string | null) => {
        if (code === 0) {
          resolve();
          return;
        }
        const where = signal === null ? '' : `, signal ${signal}`;
        reject(
          new Error(`pg_dump s’est arrêté (code ${String(code)}${where}). ${stderr.trim()}`.trim()),
        );
      });
    });

    await Promise.all([
      pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(destination)),
      exited,
    ]);

    this.logger.log(`Export de la base écrit dans ${destination}.`);
  }
}
