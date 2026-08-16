import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

/**
 * Le dépôt des classeurs téléversés.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE FICHIER SUR LE DISQUE, JAMAIS DANS LA BASE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ImportJob.storagePath` porte un CHEMIN, et le schéma dit pourquoi : cent
 * cinquante mille lignes en `bytea` entreraient dans chaque sauvegarde de la
 * base et dans chaque export intégral, pour un fichier dont la durée de vie
 * utile se compte en heures.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUCUNE PART DU NOM NE VIENT DE L'UTILISATEUR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le nom sur le disque est DÉRIVÉ DE L'IDENTIFIANT DU TRAVAIL, un UUID engendré
 * par le serveur. Le nom d'origine du fichier est conservé en base pour être
 * réaffiché, et n'est JAMAIS joint à un chemin : un classeur nommé
 * `../../../etc/passwd.xlsx` téléversé par un administrateur écrirait sinon là
 * où son nom le dit. C'est la doctrine déjà écrite pour le téléchargement des
 * exports de base, et elle vaut ici pour l'écriture.
 *
 * Injecté par JETON, comme le transport Brevo : écrire sur un disque est un
 * effet, et le moteur doit rester exerçable sans volume.
 */

export interface StoredImportFile {
  readonly storagePath: string;
  readonly bytes: number;
}

export interface ImportFileStore {
  /** Écrit le flux téléversé, en refusant AU FLUX au-delà de `maxBytes`. */
  save(jobId: string, source: NodeJS.ReadableStream, maxBytes: number): Promise<StoredImportFile>;
  /** Détruit le fichier. Ne lève pas s'il a déjà disparu. */
  remove(storagePath: string): Promise<void>;
}

export const IMPORT_FILE_STORE = Symbol('IMPORT_FILE_STORE');

/** Le flux dépasse le plafond. Levée AVANT que le reste ne soit écrit. */
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

    // `basename` sur un UUID est redondant, et c'est exactement pour cela qu'il
    // reste : le jour où quelqu'un fera passer autre chose qu'un identifiant
    // engendré par le serveur, le chemin ne sortira toujours pas du répertoire.
    const storagePath = join(directory, `${basename(jobId)}.xlsx`);

    let written = 0;
    const bounded = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        written += chunk.byteLength;
        // LE REFUS EST POSÉ SUR LE FLUX, pas après coup. Comparer la taille une
        // fois le fichier écrit ferait du plafond un moyen de remplir le volume
        // plutôt qu'une protection contre cela.
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
      // Le fichier PARTIEL part avec l'échec : un `.xlsx` tronqué est
      // indiscernable d'un classeur valide pour qui le trouve sur le volume, et
      // rien en base ne le nommerait plus.
      await this.remove(storagePath);
      throw error;
    }

    return { storagePath, bytes: written };
  }

  async remove(storagePath: string): Promise<void> {
    await rm(storagePath, { force: true });
  }
}
