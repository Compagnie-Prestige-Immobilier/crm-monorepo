import { z } from 'zod';

/**
 * Contrat d'environnement des notifications.
 *
 * DÉLIBÉRÉMENT SÉPARÉ du schéma global de `src/env.ts`, pour une raison de
 * fond : ce bloc-ci ne doit JAMAIS faire échouer le démarrage.
 *
 * Le schéma global applique la règle inverse, une anomalie y arrête le
 * service, parce qu'un JWT_ACCESS_SECRET trop court est une faille et non une
 * dégradation. Ici, l'absence de la clé Brevo doit produire un mode DÉGRADÉ :
 * l'API continue d'accepter, de stocker et de mettre en file les notifications,
 * la boîte de réception mobile fonctionne, seul l'e-mail sortant n'a pas lieu,
 * et le compositeur admin le dit explicitement.
 *
 * Faire tomber l'API entière parce qu'un compte Brevo n'est pas encore
 * provisionné transformerait une fonctionnalité manquante en panne totale.
 */

const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

export const notificationsEnvSchema = z.object({
  /** Interrupteur général des rappels programmés. */
  NOTIFICATIONS_REMINDERS_ENABLED: booleanFlag(true),

  /** Heure quotidienne des rappels, format `HH:MM` dans BUSINESS_TIME_ZONE. */
  NOTIFICATIONS_REMINDERS_AT: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'NOTIFICATIONS_REMINDERS_AT must be HH:MM')
    .default('08:00'),

  NOTIFICATIONS_OPEN_TASKS_ENABLED: booleanFlag(true),
  /** En dessous de ce nombre de tâches ouvertes, on ne dérange personne. */
  NOTIFICATIONS_OPEN_TASKS_MIN: z.coerce.number().int().positive().max(10_000).default(1),

  NOTIFICATIONS_BANK_PENDING_ENABLED: booleanFlag(true),
  /**
   * Ancienneté, en jours, d'un dossier encore à une étape OPEN. Cinq jours par
   * défaut : en dessous, le rappel arriverait pendant le délai de traitement
   * normal de la banque et deviendrait un bruit de fond qu'on apprend à ignorer.
   */
  NOTIFICATIONS_BANK_PENDING_DAYS: z.coerce.number().int().positive().max(365).default(5),

  NOTIFICATIONS_BANK_STALE_ENABLED: booleanFlag(true),
  /**
   * Silence, en jours, sans la moindre transition. Le seuil est plus haut que
   * celui des dossiers en attente parce que le signal est différent : là une
   * lenteur, ici un dossier que plus personne ne touche.
   */
  NOTIFICATIONS_BANK_STALE_DAYS: z.coerce.number().int().positive().max(365).default(10),

  /**
   * Clé de l'API transactionnelle Brevo.
   *
   * ABSENTE PAR DÉFAUT, et c'est un mode de fonctionnement valide : sans elle
   * le transport e-mail répond `NOT_CONFIGURED` et la boîte de réception
   * continue seule. Comme partout dans ce fichier, rien ici ne doit faire
   * échouer le démarrage.
   */
  BREVO_API_KEY: z.string().optional(),

  /**
   * Adresse d'expédition. Brevo refuse tout message sans expéditeur, et exige
   * que le domaine soit vérifié dans le compte : une adresse quelconque part
   * en spam, ou ne part pas du tout.
   */
  BREVO_SENDER_EMAIL: z.string().optional(),

  /** Nom affiché de l'expéditeur. Retombe sur « CPI GO » quand il manque. */
  BREVO_SENDER_NAME: z.string().optional(),

  BUSINESS_TIME_ZONE: z.string().min(1).default('Africa/Dakar'),
});

export type NotificationsEnv = z.infer<typeof notificationsEnvSchema>;

/**
 * Lit l'environnement des notifications sans jamais lever.
 *
 * Une variable illisible retombe sur son défaut : c'est cohérent avec la règle
 * ci-dessus.
 */
export const readNotificationsEnv = (source: NodeJS.ProcessEnv = process.env): NotificationsEnv => {
  const parsed = notificationsEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : notificationsEnvSchema.parse({});
};
