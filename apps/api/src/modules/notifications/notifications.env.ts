import { z } from 'zod';

const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

export const notificationsEnvSchema = z.object({
  NOTIFICATIONS_REMINDERS_ENABLED: booleanFlag(true),

  NOTIFICATIONS_REMINDERS_AT: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'NOTIFICATIONS_REMINDERS_AT must be HH:MM')
    .default('08:00'),

  NOTIFICATIONS_DAILY_REPORT_ENABLED: booleanFlag(true),

  NOTIFICATIONS_DAILY_REPORT_AT: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'NOTIFICATIONS_DAILY_REPORT_AT must be HH:MM')
    .default('17:00'),

  NOTIFICATIONS_BANK_PENDING_ENABLED: booleanFlag(true),
  NOTIFICATIONS_BANK_PENDING_DAYS: z.coerce.number().int().positive().max(365).default(5),

  NOTIFICATIONS_BANK_STALE_ENABLED: booleanFlag(true),
  NOTIFICATIONS_BANK_STALE_DAYS: z.coerce.number().int().positive().max(365).default(10),

  BREVO_API_KEY: z.string().optional(),

  BREVO_SENDER_EMAIL: z.string().optional(),

  BREVO_SENDER_NAME: z.string().optional(),

  BUSINESS_TIME_ZONE: z.string().min(1).default('Africa/Dakar'),
});

export type NotificationsEnv = z.infer<typeof notificationsEnvSchema>;

export const readNotificationsEnv = (source: NodeJS.ProcessEnv = process.env): NotificationsEnv => {
  const parsed = notificationsEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : notificationsEnvSchema.parse({});
};
