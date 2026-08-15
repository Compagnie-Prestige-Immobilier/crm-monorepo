import { z } from 'zod';

/**
 * Domaine du champ `t` des curseurs keyset, exprimé en MICROsecondes.
 *
 * Partagé par le pull de synchronisation (`modules/sync/cursor.ts`) et par
 * l'annuaire hors ligne (`modules/phase2/directory-cursor.ts`). Les deux
 * FORMATS de curseur restent délibérément distincts ; seule la définition de
 * « un horodatage recevable » est commune, et elle vit ici plutôt que dans
 * l'un des deux modules pour ne pas créer de dépendance de l'un vers l'autre.
 *
 * POURQUOI `Number.isFinite` NE SUFFIT PAS.
 *
 * `1e300` est fini. Converti en date, il donne `new Date(1e297)`, soit un
 * `Invalid Date`, que Prisma refuse avec une `PrismaClientValidationError`.
 * Cette erreur-là n'a PAS de code `P####` : le filtre d'exceptions ne la
 * reconnaît pas comme une erreur Prisma connue, elle ressort en 500 au lieu du
 * 400 documenté. Or le client hors ligne ne réessaie pas un 400 mais réessaie
 * un 500 : il repart indéfiniment sur le même curseur empoisonné, et sa
 * synchronisation ne redémarre plus jamais.
 *
 * La borne réellement contraignante est `.int()` : en zod 4 il refuse tout ce
 * qui dépasse `Number.MAX_SAFE_INTEGER`, soit ~9,0e15 µs, c'est-à-dire une
 * date de l'an 2255, très en deçà du plafond d'une `Date` JavaScript. La borne
 * haute explicite documente ce plafond (8,64e15 ms, donc 8,64e18 µs) et
 * survivra à un assouplissement futur de `.int()`.
 */
export const MAX_CURSOR_MICROS = 8.64e18;

const microsSchema = z.number().int().min(0).max(MAX_CURSOR_MICROS);

/** `true` si `t` produit une `Date` valide, donc acceptable par Prisma. */
export const isValidCursorMicros = (t: unknown): t is number => microsSchema.safeParse(t).success;
