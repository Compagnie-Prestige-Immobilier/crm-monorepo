import { z } from 'zod';

/**
 * Contrat d'environnement des notifications.
 *
 * DÉLIBÉRÉMENT SÉPARÉ du schéma global de `src/env.ts`, pour une raison de
 * fond : ce bloc-ci ne doit JAMAIS faire échouer le démarrage.
 *
 * Le schéma global applique la règle inverse — une anomalie y arrête le
 * service, parce qu'un JWT_ACCESS_SECRET trop court est une faille et non une
 * dégradation. Ici, l'absence (ou la malformation) du compte de service
 * Firebase doit produire un mode DÉGRADÉ : l'API continue d'accepter, de
 * stocker et de mettre en file les notifications, la boîte de réception mobile
 * fonctionne, seul le push sortant n'a pas lieu — et le compositeur admin le
 * dit explicitement.
 *
 * Faire tomber l'API entière parce que Firebase n'est pas encore provisionné
 * transformerait une fonctionnalité manquante en panne totale.
 */

const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

export const notificationsEnvSchema = z.object({
  /**
   * Contenu INTÉGRAL du JSON de compte de service Firebase, tel que téléchargé
   * depuis la console. Jamais un chemin vers un fichier commité : ce document
   * porte une clé privée RSA qui signe des jetons Google.
   */
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),

  /**
   * Surcharge facultative. En temps normal l'identifiant de projet est lu dans
   * le JSON ; cette variable ne sert qu'à viser un projet distinct avec le même
   * compte de service, ce qui est rare et volontairement pénible.
   */
  FCM_PROJECT_ID: z.string().optional(),

  /** Interrupteur général des rappels programmés. */
  NOTIFICATIONS_REMINDERS_ENABLED: booleanFlag(true),

  /** Heure quotidienne des rappels, format `HH:MM` dans BUSINESS_TIME_ZONE. */
  NOTIFICATIONS_REMINDERS_AT: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'NOTIFICATIONS_REMINDERS_AT must be HH:MM')
    .default('08:00'),

  NOTIFICATIONS_UNSYNCED_ENABLED: booleanFlag(true),
  /** Ancienneté, en jours, à partir de laquelle une file locale est signalée. */
  NOTIFICATIONS_UNSYNCED_DAYS: z.coerce.number().int().positive().max(365).default(3),

  NOTIFICATIONS_OPEN_TASKS_ENABLED: booleanFlag(true),
  /** En dessous de ce nombre de tâches ouvertes, on ne dérange personne. */
  NOTIFICATIONS_OPEN_TASKS_MIN: z.coerce.number().int().positive().max(10_000).default(1),

  BUSINESS_TIME_ZONE: z.string().min(1).default('Africa/Dakar'),
});

export type NotificationsEnv = z.infer<typeof notificationsEnvSchema>;

/**
 * Lit l'environnement des notifications sans jamais lever.
 *
 * Une variable illisible retombe sur son défaut : c'est cohérent avec la règle
 * ci-dessus. Le seul cas réellement silencieux serait un JSON de compte de
 * service malformé — il est traité, et journalisé, par `FcmTransport`.
 */
export const readNotificationsEnv = (
  source: NodeJS.ProcessEnv = process.env,
): NotificationsEnv => {
  const parsed = notificationsEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : notificationsEnvSchema.parse({});
};

/** Forme utile du JSON de compte de service. Le reste du document est ignoré. */
export interface FcmServiceAccount {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly tokenUri: string;
}

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  token_uri: z.string().default('https://oauth2.googleapis.com/token'),
});

/**
 * Analyse le JSON de compte de service. Renvoie `null` — jamais une exception —
 * si la variable est absente ou inexploitable ; l'appelant en fait un mode
 * dégradé et un message de journal, pas un plantage.
 *
 * Les `\n` littéraux sont réécrits en vraies fins de ligne : c'est la forme
 * sous laquelle la clé survit à un passage par une variable d'environnement de
 * CI ou de conteneur, et l'oublier produit une erreur de signature RSA parfaite-
 * ment opaque.
 */
export const parseServiceAccount = (raw: string | undefined): FcmServiceAccount | null => {
  if (!raw?.trim()) return null;

  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = serviceAccountSchema.safeParse(document);
  if (!parsed.success) return null;

  return {
    projectId: parsed.data.project_id,
    clientEmail: parsed.data.client_email,
    privateKey: parsed.data.private_key.replace(/\\n/g, '\n'),
    tokenUri: parsed.data.token_uri,
  };
};
