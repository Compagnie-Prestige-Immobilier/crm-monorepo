import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DEMO_EXEMPTIONS_SENTENCE } from '../decorators/demo-writable.decorator.js';

/**
 * La forme UNIQUE d'une réponse d'erreur de cette API.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CET OBJET EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sur 119 opérations, AUCUNE réponse d'erreur ne portait de schéma. Les
 * déclarations `@ApiResponse` ne transportaient qu'une phrase en français, si
 * bien que le contrat publiait, pour chaque 4xx, un corps vide. Les deux
 * clients générés en tiraient la seule conclusion possible : `unknown`. Chacun
 * a donc écrit à la main son propre décodeur d'erreur, et les deux ont dû
 * deviner.
 *
 * Deviner était d'autant plus nécessaire que le serveur émettait QUATRE formes
 * différentes selon le chemin emprunté :
 *
 *   1. le filtre Prisma          `{ statusCode, code, message, target?, requestId? }`
 *   2. une exception métier      `{ code, message, ... }`        sans `statusCode`
 *   3. une exception à message   `{ statusCode, message, error }` sans `code`
 *   4. la validation d'entrée    `{ statusCode, message: [...], error }` message TABLEAU
 *
 * Un client qui lisait `body.code` marchait sur 1 et 2 et rendait `undefined`
 * sur 3 et 4. Un client qui lisait `body.message` recevait tantôt une phrase,
 * tantôt un tableau de phrases, et affichait `[object Object]`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EST GARANTI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `statusCode`, `code` et `message` sont TOUJOURS présents, quelle que soit
 * l'origine de l'erreur. La normalisation est faite en un seul endroit, le
 * filtre global, et non répétée dans chaque service : un service continue de
 * lever ses exceptions typées comme avant, c'est le filtre qui complète.
 *
 * `code` est la clé sur laquelle un client DÉCIDE (afficher tel message,
 * proposer telle action, réessayer ou non). `message` est du texte destiné à
 * un humain, en français, et peut changer sans préavis : aucun client ne doit
 * s'en servir pour brancher.
 *
 * `details` remplace le `message: string[]` de la validation. Le champ
 * `message` reste ainsi une chaîne dans TOUS les cas, ce qui était la
 * principale source de code défensif côté client.
 *
 * Les erreurs métier ajoutent librement leurs propres champs (le dossier en
 * conflit, la révision courante, le statut bloquant). Ils ne sont pas
 * énumérés ici : les documenter tous ferait de ce schéma une union illisible,
 * et le contrat resterait faux dès la première erreur ajoutée.
 */
export class ApiErrorDto {
  @ApiProperty({
    type: Number,
    example: 409,
    description: 'Le code HTTP, répété dans le corps pour que le corps se suffise à lui même.',
  })
  statusCode!: number;

  @ApiProperty({
    type: String,
    example: 'BANK_CASE_NOT_FOUND',
    description:
      'Clé stable et machinable de l’erreur. C’est SUR ELLE qu’un client branche, ' +
      'jamais sur `message`. Les codes métier sont énumérés dans la description de ' +
      'chaque opération ; les codes génériques dérivent du statut HTTP ' +
      '(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, ' +
      'UNPROCESSABLE_ENTITY, VALIDATION_FAILED, INTERNAL_SERVER_ERROR). ' +
      'UN CODE TRANSVERSE mérite d’être traité une fois pour toutes côté client : ' +
      '`DEMO_MODE_READ_ONLY`, rendu en 409 sur TOUTE requête POST, PATCH, PUT ou ' +
      'DELETE tant que le mode démonstration est actif. Il ne dépend d’aucune ' +
      'opération en particulier, il décrit l’état de la plateforme, et son ' +
      '`message` est déjà rédigé pour être affiché tel quel. Ces routes-là, et ' +
      `elles seules, n’émettent JAMAIS ce code : ${DEMO_EXEMPTIONS_SENTENCE}.`,
  })
  code!: string;

  @ApiProperty({
    type: String,
    example: 'Dossier bancaire introuvable.',
    description:
      'Message en français, destiné à être lu par un humain. Toujours une CHAÎNE, ' +
      'jamais un tableau. Susceptible de changer sans préavis.',
  })
  message!: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Détail par champ, renseigné pour les refus de validation d’entrée. Reprend ' +
      'ce que la validation mettait auparavant dans `message` sous forme de tableau.',
    example: ['search must be shorter than or equal to 120 characters'],
  })
  details?: string[];

  @ApiPropertyOptional({
    type: String,
    description:
      'Identifiant de la requête, repris de l’en tête `x-request-id` quand il est ' +
      'fourni. C’est la seule valeur à citer dans un signalement d’incident.',
  })
  requestId?: string;
}
