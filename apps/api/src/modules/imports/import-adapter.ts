import type { ImportKind, ImportMode, Prisma } from '@crm/database';

import type { ImportColumn } from '../representants/import-template.js';

/**
 * LE JOINT ENTRE LE MOTEUR D'IMPORT ET UNE ENTITÉ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE LE MOTEUR SAIT FAIRE, ET CE QU'IL NE SAURA JAMAIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le moteur sait ce qui ne dépend d'AUCUNE entité : créer un travail, le
 * revendiquer avec un jeton de fencing, lire un classeur EN FLUX sans jamais le
 * matérialiser, découper en tranches, ouvrir UNE transaction par tranche,
 * avancer `processedRows` dans cette même transaction, borner la liste
 * d'erreurs, écrire le rapport et l'état final.
 *
 * Il ne sait rien, en revanche, de ce qu'est une ligne : ni comment l'analyser,
 * ni ce qu'est un doublon, ni dans quelle table elle atterrit. Tout cela vit
 * dans un adaptateur, et c'est ce qui permet d'ajouter une seconde entité sans
 * rouvrir le moteur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE CONTRAT EST GELÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les adaptateurs sont écrits EN PARALLÈLE du moteur, par d'autres mains. Les
 * noms et les formes de ce fichier sont donc figés : les changer casse un
 * travail en cours ailleurs, ce qui coûte bien plus cher que la gêne
 * occasionnelle d'un contrat imparfait.
 *
 * DEUX CONSÉQUENCES ASSUMÉES DE CETTE FORME :
 *
 *  · `parseRow` ne reçoit PAS de contexte, donc elle est PURE au sens du
 *    travail en cours : elle ne peut pas connaître l'identifiant du travail, et
 *    ne peut donc porter aucun état de course. Tout ce qui dépend du fichier en
 *    train d'être lu (les téléphones déjà vus, par exemple) appartient à
 *    `writeChunk`, qui reçoit `ctx.jobId` ;
 *  · `ChunkOutcome` ne transporte pas d'aperçu des lignes retenues. Le moteur
 *    ne peut donc pas en composer un : `TRow` lui est opaque. Le rapport porte
 *    les compteurs et les erreurs bornées, pas la prévisualisation.
 */

/**
 * Le client de transaction Prisma, et rien d'autre.
 *
 * `Prisma.TransactionClient` est la forme déjà retenue partout dans le dépôt
 * (`sync.service.ts`, `demo-seeder.ts`, `purge-steps.ts`) : elle interdit
 * d'ouvrir une transaction imbriquée depuis l'intérieur d'une transaction, ce
 * qui est exactement la faute qu'un adaptateur pourrait commettre sans s'en
 * apercevoir.
 */
export type PrismaTransactionClient = Prisma.TransactionClient;

/** Réexporté ICI pour que l'adaptateur n'ait qu'un seul fichier à connaître. */
export type { ImportColumn };

/**
 * Le motif de refus d'UNE ligne.
 *
 * `rowNumber` est le numéro DANS LE FICHIER, en-tête compris : c'est ce que la
 * personne lit dans Excel. Rendre un index de tableau la ferait chercher au
 * mauvais endroit sur un fichier de cinquante mille lignes.
 */
export interface ImportRowError {
  rowNumber: number;
  column?: string;
  code: string;
  message: string;
}

/** Une ligne analysée : soit elle est prête à écrire, soit elle porte son refus. */
export type ParsedRow<T> = { ok: true; row: T } | { ok: false; error: ImportRowError };

/**
 * Ce qu'une tranche a produit.
 *
 * `created` et `skipped` sont des lignes ÉCRITES et des lignes ÉCARTÉES, pas
 * des lignes lues : la somme des trois n'a aucune raison d'égaler la taille de
 * la tranche, et le moteur ne le suppose nulle part.
 */
export interface ChunkOutcome {
  created: number;
  skipped: number;
  errors: readonly ImportRowError[];
}

/**
 * Ce que l'adaptateur sait du travail en cours.
 *
 * `tx` est LA transaction de la tranche. Écrire ailleurs que dedans (sur le
 * client global, par exemple) ferait survivre les lignes à l'annulation de la
 * tranche, et le bail perdu ne protégerait plus rien.
 */
export interface ImportRunContext {
  readonly jobId: string;
  readonly mode: ImportMode;
  readonly requestedById: string;
  readonly tx: PrismaTransactionClient;
}

/**
 * Un adaptateur d'entité.
 *
 * `maxRows` appartient à l'adaptateur et non au moteur : cinquante mille
 * représentants et cinquante mille prospects n'ont ni le même coût d'écriture
 * ni le même sens métier, et un plafond commun serait faux pour l'un des deux.
 */
export interface ImportAdapter<TRow> {
  readonly kind: ImportKind;
  readonly maxRows: number;
  readonly templateColumns: readonly ImportColumn[];
  parseRow(cells: Record<string, string>, rowNumber: number): ParsedRow<TRow>;
  prepare(ctx: ImportRunContext): Promise<void>;
  writeChunk(rows: readonly TRow[], ctx: ImportRunContext): Promise<ChunkOutcome>;
}

/**
 * Jeton d'injection de la LISTE des adaptateurs.
 *
 * Une liste et non un adaptateur : le moteur choisit par `kind`, et une entité
 * ajoutée demain entre par le module, sans que le moteur ne soit rouvert. Même
 * discipline que `BREVO_TRANSPORT`, où le câblage porte le choix plutôt qu'une
 * condition enfouie dans une méthode.
 */
export const IMPORT_ADAPTERS = Symbol('IMPORT_ADAPTERS');
