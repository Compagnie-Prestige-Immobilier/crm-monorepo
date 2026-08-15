import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';

import { pgEnvironmentFrom } from './pg-connection.js';

/**
 * Exécution de `pg_dump`.
 *
 * Isolée derrière une interface parce que c'est la SEULE partie du module qui
 * exige un vrai binaire et une vraie base. Les tests fournissent une doublure
 * et exercent tout le reste : les états, l'unicité, l'échéance, l'audit, l'avis
 * de fin, le service du fichier.
 */
export interface DumpRunner {
  /** Écrit l'export compressé à `destination`. Lève si `pg_dump` échoue. */
  run(destination: string): Promise<void>;
}

export const DUMP_RUNNER = Symbol('DUMP_RUNNER');

/**
 * Arguments de `pg_dump`, et pourquoi chacun.
 *
 * `--format=plain` : la même forme que la sauvegarde nocturne
 * (`infra/docker/backup.sh`), donc la même procédure de restauration, celle qui
 * est écrite dans `infra/README.md` : `gunzip -c … | psql`. Le format `custom`
 * serait plus riche, mais il exige `pg_restore` et une autre procédure : deux
 * formats d'export pour une même base, c'est la garantie qu'un jour on
 * restaurera avec le mauvais outil.
 *
 * `--no-owner` et `--no-privileges` : l'export doit pouvoir être rechargé dans
 * une base de travail dont le propriétaire n'est pas `crm`. Sans eux, chaque
 * `ALTER TABLE … OWNER TO crm` échoue et la restauration s'arrête au milieu.
 */
const PG_DUMP_ARGUMENTS = ['--format=plain', '--no-owner', '--no-privileges'] as const;

/**
 * Le binaire attendu dans l'image.
 *
 * Il n'y était PAS : `infra/docker/Dockerfile.api` installe de quoi compiler
 * `argon2` dans les étapes de construction, et l'étape finale n'a que Node. Le
 * paquet `postgresql-client-18` y est désormais ajouté, et sa version majeure
 * est épinglée sur celle du serveur : un `pg_dump` plus ANCIEN que le serveur
 * refuse de travailler (« aborting because of server version mismatch »), et
 * Debian 12 ne fournit d'origine que la 15.
 */
const PG_DUMP_BINARY = 'pg_dump';

@Injectable()
export class PgDumpRunner implements DumpRunner {
  private readonly logger = new Logger(PgDumpRunner.name);

  constructor(private readonly databaseUrl: string) {}

  /**
   * Lance `pg_dump` et compresse son flux de sortie.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * NI SHELL, NI TUBE SHELL
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `spawn` reçoit un TABLEAU d'arguments et n'ouvre aucun interpréteur : il
   * n'y a donc rien à échapper, et aucune valeur ne peut se transformer en
   * commande. Le tube `| gzip` est fait dans Node par `createGzip`, ce qui
   * évite d'avoir aussi à installer `gzip` dans l'image et, surtout, rend
   * l'échec du compresseur visible ici plutôt que noyé dans le code de retour
   * d'un tube shell, où seul le DERNIER maillon compte : un `pg_dump` qui
   * échoue en plein milieu d'un `pg_dump | gzip` produit un `.gz` parfaitement
   * valide, contenant un export tronqué, et le shell répond « succès ».
   *
   * `stderr` est CONSERVÉ et remonte dans le motif d'échec. C'est là que
   * `pg_dump` écrit la seule phrase utile (« server version mismatch »,
   * « permission denied »), et sans elle l'administrateur ne voit qu'un code de
   * sortie.
   */
  async run(destination: string): Promise<void> {
    const child = spawn(PG_DUMP_BINARY, PG_DUMP_ARGUMENTS, {
      env: { ...pgEnvironmentFrom(this.databaseUrl), PATH: process.env.PATH ?? '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Borné : un `pg_dump` qui se plaint de chaque ligne remplirait la
      // mémoire du processus API avec un message que personne ne lira en
      // entier.
      if (stderr.length < 4_000) stderr += chunk.toString('utf8');
    });

    const exited = new Promise<void>((resolve, reject) => {
      child.on('error', (error: Error) => {
        // ENOENT ici veut dire une chose et une seule : le binaire manque dans
        // l'image. La phrase le dit, sinon on cherche du côté de la base.
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

    // L'écriture et l'attente du code de sortie sont menées ENSEMBLE. Attendre
    // la fin du processus avant de lire son `stdout` remplirait le tampon de
    // tube du système et bloquerait `pg_dump` pour toujours, sur une base
    // dépassant quelques centaines de kilo-octets.
    await Promise.all([
      pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(destination)),
      exited,
    ]);

    this.logger.log(`Export de la base écrit dans ${destination}.`);
  }
}
