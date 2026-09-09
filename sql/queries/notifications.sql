-- name: ListNotificationTemplates :many
SELECT "id", "name", "category"::text AS category, "titleTemplate", "bodyTemplate",
       "route", "variables", "isActive", "updatedAt"
FROM "notification_templates"
WHERE @include_inactive::bool OR "isActive"
ORDER BY "name" ASC;

-- name: NotificationTemplate :one
SELECT "id", "name", "category"::text AS category, "titleTemplate", "bodyTemplate",
       "route", "variables", "isActive", "updatedAt"
FROM "notification_templates"
WHERE "id" = $1;

-- name: InsertNotificationTemplate :one
INSERT INTO "notification_templates" (
  "id", "name", "category", "titleTemplate", "bodyTemplate", "route", "variables", "createdById"
) VALUES (
  @id, @name, @category, @title_template, @body_template,
  sqlc.narg('route')::text, @variables::text[], sqlc.narg('created_by_id')::text
)
RETURNING "id", "name", "category"::text AS category, "titleTemplate", "bodyTemplate",
          "route", "variables", "isActive", "updatedAt";

-- name: UpdateNotificationTemplate :one
UPDATE "notification_templates" SET
  "name" = @name,
  "category" = @category,
  "titleTemplate" = @title_template,
  "bodyTemplate" = @body_template,
  "route" = sqlc.narg('route')::text,
  "variables" = @variables::text[],
  "isActive" = @is_active
WHERE "id" = @id
RETURNING "id", "name", "category"::text AS category, "titleTemplate", "bodyTemplate",
          "route", "variables", "isActive", "updatedAt";

-- name: AudienceUserIDs :many
SELECT "id"
FROM "users"
WHERE "isActive" AND "deletedAt" IS NULL
  AND (@audience::text <> 'ROLE' OR "role"::text = @audience_role::text)
  AND (@audience::text <> 'USERS' OR "id" = ANY(@audience_user_ids::text[]))
ORDER BY "id" ASC;

-- name: InsertNotification :execrows
INSERT INTO "notifications" (
  "id", "title", "body", "category", "route", "audience", "audienceRole",
  "audienceUserIds", "status", "scheduledFor", "templateId", "createdById",
  "reminderKey", "period"
) VALUES (
  @id, @title, @body, @category, sqlc.narg('route')::text,
  @audience, sqlc.narg('audience_role'),
  @audience_user_ids::text[], @status, sqlc.narg('scheduled_for')::timestamp,
  sqlc.narg('template_id')::text, sqlc.narg('created_by_id')::text,
  sqlc.narg('reminder_key')::text, sqlc.narg('period')::text
)
ON CONFLICT DO NOTHING;

-- name: InsertNotificationDeliveries :exec
INSERT INTO "notification_deliveries" ("id", "notificationId", "userId", "status", "reminderKey", "period")
SELECT a.id, b.nid, c.uid, 'PENDING', sqlc.narg('reminder_key')::text, sqlc.narg('period')::text
FROM unnest(@ids::text[]) WITH ORDINALITY AS a(id, n)
JOIN unnest(@notification_ids::text[]) WITH ORDINALITY AS b(nid, n) USING (n)
JOIN unnest(@user_ids::text[]) WITH ORDINALITY AS c(uid, n) USING (n)
ON CONFLICT DO NOTHING;

-- name: CountNotifications :one
SELECT count(*)::int AS total
FROM "notifications"
WHERE (@status::text = '' OR "status"::text = @status::text)
  AND (@category::text = '' OR "category"::text = @category::text);

-- name: Notifications :many
SELECT n."id", n."title", n."body", n."category"::text AS category, n."route",
       n."audience"::text AS audience, COALESCE(n."audienceRole"::text, '')::text AS "audienceRole",
       n."audienceUserIds", n."status"::text AS status, n."scheduledFor", n."sentAt",
       n."cancelledAt", n."transportStatus", n."createdAt", u."fullName" AS "createdByName"
FROM "notifications" n
LEFT JOIN "users" u ON u."id" = n."createdById"
WHERE (@status::text = '' OR n."status"::text = @status::text)
  AND (@category::text = '' OR n."category"::text = @category::text)
ORDER BY n."createdAt" DESC, n."id" DESC
LIMIT @lim::bigint OFFSET @off::bigint;

-- name: NotificationByID :one
SELECT n."id", n."title", n."body", n."category"::text AS category, n."route",
       n."audience"::text AS audience, COALESCE(n."audienceRole"::text, '')::text AS "audienceRole",
       n."audienceUserIds", n."status"::text AS status, n."scheduledFor", n."sentAt",
       n."cancelledAt", n."transportStatus", n."createdAt", u."fullName" AS "createdByName"
FROM "notifications" n
LEFT JOIN "users" u ON u."id" = n."createdById"
WHERE n."id" = $1;

-- name: NotificationCounts :many
SELECT "notificationId",
       count(*)::int AS total,
       count(*) FILTER (WHERE "status" = 'PENDING')::int AS pending,
       count(*) FILTER (WHERE "status" = 'SENT')::int AS sent,
       count(*) FILTER (WHERE "status" = 'DELIVERED')::int AS delivered,
       count(*) FILTER (WHERE "status" = 'FAILED')::int AS failed,
       count(*) FILTER (WHERE "status" = 'READ')::int AS "read"
FROM "notification_deliveries"
WHERE "notificationId" = ANY(@ids::text[])
GROUP BY 1;

-- name: NotificationRecipients :many
SELECT d."userId", u."fullName", u."role"::text AS role, d."status"::text AS status,
       d."error", d."sentAt", d."readAt"
FROM "notification_deliveries" d
JOIN "users" u ON u."id" = d."userId"
WHERE d."notificationId" = $1
ORDER BY d."createdAt" ASC, d."id" ASC;

-- name: CancelNotification :execrows
UPDATE "notifications" SET "status" = 'CANCELLED', "cancelledAt" = @now
WHERE "id" = @id AND "status" = 'SCHEDULED';

-- name: InboxCounts :one
SELECT count(*) FILTER (WHERE NOT @unread_only::bool OR d."readAt" IS NULL)::int AS total,
       count(*) FILTER (WHERE d."readAt" IS NULL)::int AS unread
FROM "notification_deliveries" d
JOIN "notifications" n ON n."id" = d."notificationId"
WHERE d."userId" = @user_id AND n."status" IN ('SENDING', 'SENT');

-- name: Inbox :many
SELECT d."id", d."notificationId", n."title", n."body", n."category"::text AS category,
       n."route", d."readAt", COALESCE(n."sentAt", d."createdAt") AS "createdAt"
FROM "notification_deliveries" d
JOIN "notifications" n ON n."id" = d."notificationId"
WHERE d."userId" = @user_id AND n."status" IN ('SENDING', 'SENT')
  AND (NOT @unread_only::bool OR d."readAt" IS NULL)
ORDER BY d."createdAt" DESC, d."id" DESC
LIMIT @lim::bigint OFFSET @off::bigint;

-- name: MarkDeliveryRead :execrows
UPDATE "notification_deliveries" SET "status" = 'READ', "readAt" = @now
WHERE "notificationId" = @notification_id AND "userId" = @user_id AND "readAt" IS NULL
  AND "status" IN ('SENT', 'DELIVERED');

-- name: StampDeliveryRead :execrows
UPDATE "notification_deliveries" SET "readAt" = @now
WHERE "notificationId" = @notification_id AND "userId" = @user_id AND "readAt" IS NULL
  AND "status" IN ('PENDING', 'FAILED');

-- name: DeliveryExists :one
SELECT count(*)::int AS total
FROM "notification_deliveries"
WHERE "notificationId" = @notification_id AND "userId" = @user_id;

-- name: ClaimNotifications :exec
UPDATE "notifications" SET "status" = 'SENDING', "dispatchClaim" = @claim
WHERE "id" = ANY(@ids::text[])
  AND (("status" = 'SCHEDULED' AND "scheduledFor" <= @now)
    OR ("status" = 'SENDING' AND "dispatchClaim" IS NULL)
    OR ("status" = 'SENDING' AND "updatedAt" < @lease_expired));

-- name: NotificationsForDispatch :many
SELECT "id", "title", "body", COALESCE("route", '') AS route, "status"::text AS status,
       "scheduledFor", "createdAt", "transportStatus", "dispatchClaim"
FROM "notifications"
WHERE "id" = ANY(@ids::text[]);

-- name: DueNotifications :many
SELECT "id"
FROM "notifications"
WHERE ("status" = 'SCHEDULED' AND "scheduledFor" <= @now)
   OR ("status" = 'SENDING' AND "updatedAt" < @lease_expired)
ORDER BY "scheduledFor" ASC, "createdAt" ASC
LIMIT 50;

-- name: PendingDeliveries :many
SELECT "id", "userId", "notificationId", "error"
FROM "notification_deliveries"
WHERE "notificationId" = ANY(@ids::text[]) AND "status" = 'PENDING';

-- name: EmailTargets :many
SELECT "id", btrim("email") AS email, "fullName"
FROM "users"
WHERE "id" = ANY(@ids::text[]) AND "role" = 'COMMERCIAL' AND btrim("email") <> '';

-- name: MarkDeliveriesInboxOnly :exec
UPDATE "notification_deliveries" SET "error" = 'INBOX_ONLY'
WHERE "id" = ANY(@ids::text[]);

-- name: MarkDeliveriesSent :exec
UPDATE "notification_deliveries" SET "status" = 'SENT', "error" = NULL, "sentAt" = @now
WHERE "notificationId" = ANY(@notification_ids::text[]) AND "id" = ANY(@ids::text[])
  AND "status" = 'PENDING';

-- name: MarkDeliveriesRetry :exec
UPDATE "notification_deliveries" SET "error" = @error
WHERE "notificationId" = ANY(@notification_ids::text[]) AND "id" = ANY(@ids::text[])
  AND "status" = 'PENDING';

-- name: MarkDeliveriesFailed :exec
UPDATE "notification_deliveries" SET "status" = 'FAILED', "error" = @error, "failedAt" = @now
WHERE "notificationId" = ANY(@notification_ids::text[]) AND "id" = ANY(@ids::text[])
  AND "status" = 'PENDING';

-- name: AbandonDeliveries :exec
UPDATE "notification_deliveries"
SET "status" = 'FAILED', "error" = 'EMAIL_ABANDONED', "failedAt" = @now
WHERE "id" = ANY(@ids::text[]) AND "status" = 'PENDING'
  AND ("error" IS NULL OR "error" <> 'INBOX_ONLY');

-- name: RenewDispatchClaim :execrows
UPDATE "notifications" SET "status" = 'SENDING'
WHERE "id" = ANY(@ids::text[]) AND "status" = 'SENDING' AND "dispatchClaim" = @claim;

-- name: CloseNotifications :execrows
UPDATE "notifications"
SET "status" = 'SENT', "sentAt" = @now,
    "transportStatus" = sqlc.narg('transport_status')::text, "dispatchClaim" = NULL
WHERE "id" = ANY(@ids::text[]) AND "status" = 'SENDING' AND "dispatchClaim" = @claim
  AND NOT EXISTS (
    SELECT 1 FROM "notification_deliveries" d
    WHERE d."notificationId" = "notifications"."id" AND d."status" = 'PENDING'
      AND (d."error" IS NULL OR d."error" <> 'INBOX_ONLY')
  );

-- name: HoldNotifications :execrows
UPDATE "notifications" SET "transportStatus" = sqlc.narg('transport_status')::text
WHERE "id" = ANY(@ids::text[]) AND "status" = 'SENDING' AND "dispatchClaim" = @claim;

-- name: DueCallbacksByAssignee :many
SELECT sc."assignedToId" AS "userId", u."fullName", count(*)::int AS total
FROM "scheduled_callbacks" sc
JOIN "users" u ON u."id" = sc."assignedToId" AND u."isActive" AND u."deletedAt" IS NULL
WHERE sc."status" = 'PENDING' AND sc."scheduledAt" <= @day_end
GROUP BY 1, 2;

-- name: ActiveUsersByRoles :many
SELECT "id", "fullName"
FROM "users"
WHERE "role"::text = ANY(@roles::text[]) AND "isActive" AND "deletedAt" IS NULL;

-- name: SuperviseursActifs :many
SELECT "id", btrim("email") AS email, "fullName"
FROM "users"
WHERE "role" = 'SUPERVISEUR' AND "isActive" AND "deletedAt" IS NULL
ORDER BY "id" ASC;

-- name: NomCompletUtilisateur :one
SELECT "fullName" FROM "users" WHERE "id" = $1;

-- name: CountBankCasesPending :one
SELECT count(*)::int AS total
FROM "bank_cases" bc
JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
WHERE bc."deletedAt" IS NULL AND st."type" = 'OPEN' AND bc."createdAt" <= @cutoff;

-- name: CountBankCasesStale :one
SELECT count(*)::int AS total
FROM "bank_cases" bc
JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
WHERE bc."deletedAt" IS NULL AND st."type" = 'OPEN' AND bc."createdAt" <= @cutoff
  AND NOT EXISTS (
    SELECT 1 FROM "bank_case_transitions" t
    WHERE t."caseId" = bc."id" AND t."createdAt" > @cutoff
  );

-- name: NotificationIDsByReminderKeys :many
SELECT "id", "reminderKey"
FROM "notifications"
WHERE "reminderKey" = ANY(@keys::text[]) AND "period" = @period;

-- name: StalledReminderNotificationIDs :many
SELECT DISTINCT "notificationId"
FROM "notification_deliveries"
WHERE "reminderKey" = @reminder_key AND "userId" = ANY(@user_ids::text[])
  AND "period" = @period AND "status" = 'PENDING' AND "error" = 'EMAIL_RETRY';

-- name: DailyReportTotals :one
WITH agents AS (
  SELECT "id" FROM "users"
  WHERE "role" IN ('COMMERCIAL', 'SUPERVISEUR', 'DIRECTION') AND "deletedAt" IS NULL
)
SELECT
  (SELECT count(*) FROM "call_attempts" ca
    WHERE ca."performedById" IN (SELECT "id" FROM agents)
      AND ca."clientCreatedAt" >= @debut AND ca."clientCreatedAt" <= @fin)::int AS appels,
  (SELECT count(*) FROM "call_attempts" ca
    WHERE ca."performedById" IN (SELECT "id" FROM agents) AND ca."outcome" = 'METHOD_OBTAINED'
      AND ca."clientCreatedAt" >= @debut AND ca."clientCreatedAt" <= @fin)::int AS methodes,
  (SELECT count(*) FROM "call_attempts" ca
    WHERE ca."performedById" IN (SELECT "id" FROM agents) AND ca."outcome" = 'UNREACHABLE'
      AND ca."clientCreatedAt" >= @debut AND ca."clientCreatedAt" <= @fin)::int AS injoignables,
  (SELECT count(*) FROM "call_attempts" ca
    WHERE ca."performedById" IN (SELECT "id" FROM agents) AND ca."outcome" = 'WRONG_NUMBER'
      AND ca."clientCreatedAt" >= @debut AND ca."clientCreatedAt" <= @fin)::int AS faux_numeros,
  (SELECT count(*) FROM "prospects" p
    WHERE p."createdById" IN (SELECT "id" FROM agents) AND p."deletedAt" IS NULL
      AND p."clientCreatedAt" >= @debut AND p."clientCreatedAt" <= @fin)::int AS prospects;

-- name: DailyReportSilentAgents :many
SELECT u."fullName"
FROM "users" u
WHERE u."role" IN ('COMMERCIAL', 'SUPERVISEUR', 'DIRECTION') AND u."isActive" AND u."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "call_attempts" ca
    WHERE ca."performedById" = u."id" AND ca."clientCreatedAt" >= @debut AND ca."clientCreatedAt" <= @fin)
  AND NOT EXISTS (SELECT 1 FROM "prospects" p
    WHERE p."createdById" = u."id" AND p."deletedAt" IS NULL
      AND p."clientCreatedAt" >= @debut AND p."clientCreatedAt" <= @fin)
  AND NOT EXISTS (SELECT 1 FROM "rep_call_attempts" rca
    WHERE rca."performedById" = u."id" AND rca."clientCreatedAt" >= @debut AND rca."clientCreatedAt" <= @fin)
  AND NOT EXISTS (SELECT 1 FROM "device_call_detections" d
    WHERE d."performedById" = u."id" AND d."deviceCallAt" >= @debut AND d."deviceCallAt" <= @fin)
ORDER BY u."fullName" ASC;

-- name: CountCallbacksHonored :one
SELECT count(*)::int AS total
FROM "scheduled_callbacks"
WHERE "status" = 'DONE' AND "updatedAt" >= @debut AND "updatedAt" <= @fin;

-- name: CountCallbacksOverdue :one
SELECT count(*)::int AS total
FROM "scheduled_callbacks"
WHERE "status" = 'PENDING' AND "scheduledAt" <= @now;
