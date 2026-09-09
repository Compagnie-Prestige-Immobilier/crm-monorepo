-- name: GetUserByID :one
SELECT id, email, username, role, first_name, last_name, created_at, updated_at
FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT id, email, username, password_hash, role, first_name, last_name
FROM users
WHERE email = $1 LIMIT 1;

-- name: GetBankCaseByID :one
SELECT id, case_number, client_name, status, amount, created_by_id, created_at, updated_at
FROM bank_cases
WHERE id = $1 LIMIT 1;

-- name: GetNotificationTemplateByID :one
SELECT id, name, subject, body_template, created_at, updated_at
FROM notification_templates
WHERE id = $1 LIMIT 1;
