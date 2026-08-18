import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DEMO_EXEMPTIONS_SENTENCE } from '../decorators/demo-writable.decorator.js';

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
      'DEUX CODES TRANSVERSES méritent d’être traités une fois pour toutes côté ' +
      'client. Ils sortent tous deux en 409 sur TOUTE requête POST, PATCH, PUT ou ' +
      'DELETE, ne dépendent d’aucune opération en particulier, et leur `message` ' +
      'est déjà rédigé pour être affiché tel quel : ' +
      '`DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ; ' +
      '`DEMO_MODE_STATE_UNKNOWN` quand le serveur n’arrive pas à lire l’état de ce ' +
      'mode et refuse d’écrire une ligne dont il ne saurait pas dire si elle est ' +
      'réelle. Le second N’ANNONCE PAS une démonstration en cours : il invite à ' +
      'réessayer, et non à faire éteindre un interrupteur. Ces routes-là, et ' +
      `elles seules, n’émettent JAMAIS ces codes : ${DEMO_EXEMPTIONS_SENTENCE}.`,
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
