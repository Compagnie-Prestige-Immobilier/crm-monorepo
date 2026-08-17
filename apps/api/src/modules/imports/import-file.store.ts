import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export interface StoredImportFile {
  readonly storagePath: string;
  readonly bytes: number;
}

export interface ImportFileStore {
  save(jobId: string, source: NodeJS.ReadableStream, maxBytes: number): Promise<StoredImportFile>;
  remove(storagePath: string): Promise<void>;
}

export const IMPORT_FILE_STORE = Symbol('IMPORT_FILE_STORE');

export class ImportFileTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Le fichier dépasse ${String(maxBytes)} octets.`);
    this.name = 'ImportFileTooLargeError';
  }
}

export class DiskImportFileStore implements ImportFileStore {
  constructor(private readonly directory: string) {}

  async save(
    jobId: string,
    source: NodeJS.ReadableStream,
    maxBytes: number,
  ): Promise<StoredImportFile> {
    const directory = resolve(this.directory);
    await mkdir(directory, { recursive: true });

    const storagePath = join(directory, `${basename(jobId)}.xlsx`);

    let written = 0;
    const bounded = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        written += chunk.byteLength;
        if (written > maxBytes) {
          done(new ImportFileTooLargeError(maxBytes));
          return;
        }
        done(null, chunk);
      },
    });

    try {
      await pipeline(source, bounded, createWriteStream(storagePath));
    } catch (error) {
      await this.remove(storagePath);
      throw error;
    }

    return { storagePath, bytes: written };
  }

  async remove(storagePath: string): Promise<void> {
    await rm(storagePath, { force: true });
  }
}
