-- name: InsertAuditLog :exec
INSERT INTO "audit_logs" ("id", "userId", "action", "entity", "entityId", "before", "after")
VALUES ($1, $2, $3, $4, $5, $6, $7);
