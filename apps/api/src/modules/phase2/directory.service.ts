import { Injectable } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  decodeDirectoryCursor,
  encodeDirectoryCursor,
  fromMicros,
  toMicros,
  type DirectoryCursor,
} from './directory-cursor.js';
import type { DirectoryEntryDto, DirectoryPageDto, DirectoryQueryDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

/**
 * Annuaire hors ligne de la phase 2.
 *
 * Un commercial en zone sans réseau doit pouvoir consulter n'importe quel
 * numéro de la base, y compris un numéro attribué à un collègue, pour ne pas
 * rappeler quelqu'un qui a déjà donné sa méthode. D'où une réplique locale,
 * tirée par delta.
 *
 * DEUX CONTRAINTES GOUVERNENT CE FICHIER.
 *
 * 1. CONFIDENTIALITÉ. La projection est fermée à six champs et le `select`
 *    ci-dessous est la seule chose qui l'impose. Rien d'autre : pas de
 *    `include`, pas de relation, pas de `nom`. Voir `DirectoryEntryDto`.
 *
 * 2. VOLUME. 50 000 à 500 000 lignes. La pagination est un keyset sur
 *    `(updatedAt, id)`, jamais un OFFSET, dont le coût croît linéairement avec
 *    la profondeur et qui saute des lignes dès qu'une écriture s'intercale.
 *    L'index partiel `prospects_phase2_directory` est posé exactement pour ce
 *    couple, filtré sur `deletedAt IS NULL`.
 */

/**
 * Même retard de sécurité que le pull de synchronisation, et pour la même
 * raison : `updatedAt` est fixé au DÉBUT de l'écriture, la ligne ne devient
 * visible qu'au COMMIT. Une transaction longue peut donc valider une ligne dont
 * l'horodatage est déjà derrière le curseur du client, qui ne la demandera plus
 * jamais. Deux secondes laissent toute écriture en vol se valider avant
 * d'entrer dans la fenêtre de pagination.
 *
 * La constante est redéclarée plutôt qu'importée du module de synchronisation :
 * les deux paginations doivent pouvoir évoluer séparément.
 */
export const DIRECTORY_SAFETY_LAG_MS = 2_000;

export const DIRECTORY_DEFAULT_PAGE_SIZE = 2_000;

/**
 * LA projection de l'annuaire. Toute addition ici élargit ce qui est répliqué
 * sur des téléphones personnels : c'est le seul endroit à relire pour savoir ce
 * qui sort du serveur.
 */
const DIRECTORY_SELECT = {
  id: true,
  phoneE164: true,
  phase2Status: true,
  enrollmentMethod: true,
  rev: true,
  updatedAt: true,
} satisfies Prisma.ProspectSelect;

type DirectoryRow = Prisma.ProspectGetPayload<{ select: typeof DIRECTORY_SELECT }>;

const toEntry = (row: DirectoryRow): DirectoryEntryDto => ({
  prospectId: row.id,
  phoneE164: row.phoneE164,
  phase2Status: row.phase2Status,
  enrollmentMethod: row.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
});

/** Clause keyset : « strictement après (t, id) », et jamais plus récent que le seuil. */
function keyset(cursor: DirectoryCursor | undefined, safeNow: Date): Prisma.ProspectWhereInput {
  const clauses: Prisma.ProspectWhereInput[] = [{ updatedAt: { lt: safeNow } }];

  if (cursor) {
    const at = fromMicros(cursor.t);
    clauses.push({
      OR: [{ updatedAt: { gt: at } }, { AND: [{ updatedAt: at }, { id: { gt: cursor.id } }] }],
    });
  }

  return { AND: clauses };
}

@Injectable()
export class Phase2DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async pull(query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    const limit = query.limit ?? DIRECTORY_DEFAULT_PAGE_SIZE;
    const incoming = decodeDirectoryCursor(query.since);
    const serverTime = new Date();
    const safeNow = new Date(serverTime.getTime() - DIRECTORY_SAFETY_LAG_MS);

    const rows = await this.prisma.prospect.findMany({
      // `deletedAt: null` sert deux fins : il aligne la requête sur l'index
      // partiel, et il évite de répliquer des fiches supprimées. Conséquence
      // assumée : une fiche supprimée cesse simplement d'être renvoyée, sans
      // marqueur de suppression, en porter un exigerait un septième champ, et
      // la frontière à six champs prime.
      where: {
        deletedAt: null,
        ...demoScope(await this.demo.enabled()),
        ...keyset(incoming, safeNow),
      },
      select: DIRECTORY_SELECT,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const last = rows.at(-1);

    return {
      entries: rows.map(toEntry),
      // Page vide : on rend le curseur REÇU, pour que le client le rejoue tel
      // quel au prochain passage. Rendre un curseur neuf lui ferait
      // retélécharger l'annuaire entier ; rendre une chaîne vide alors qu'il
      // avait déjà progressé aurait le même effet.
      nextCursor: last
        ? encodeDirectoryCursor({ v: 1, t: toMicros(last.updatedAt), id: last.id })
        : (query.since ?? ''),
      hasMore: rows.length === limit,
      serverTime: serverTime.toISOString(),
    };
  }
}
