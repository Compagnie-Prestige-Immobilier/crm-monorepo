BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE account_role AS ENUM ('platform_admin', 'atelier_owner', 'atelier_manager', 'client');
CREATE TYPE atelier_status AS ENUM ('draft', 'pending_review', 'verified', 'suspended', 'rejected');
CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'card', 'other');
CREATE TYPE contact_channel AS ENUM ('phone', 'whatsapp', 'sms', 'appointment');
CREATE TYPE contact_status AS ENUM ('created', 'accepted', 'declined', 'completed', 'disputed', 'cancelled');
CREATE TYPE review_status AS ENUM ('pending', 'published', 'hidden', 'rejected');

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text UNIQUE,
  email citext UNIQUE,
  pin_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  role account_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  failed_login_count smallint NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone_e164 IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  user_agent text,
  ip inet,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_account_active_idx ON sessions(account_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE ateliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES accounts(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  description text,
  phone_e164 text NOT NULL,
  whatsapp_e164 text,
  address_text text,
  location geography(Point, 4326),
  location_precision_m integer NOT NULL DEFAULT 0 CHECK (location_precision_m >= 0),
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  supported_languages text[] NOT NULL DEFAULT ARRAY['fr'],
  status atelier_status NOT NULL DEFAULT 'draft',
  verified_at timestamptz,
  suspended_reason text,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ateliers_location_idx ON ateliers USING gist(location);
CREATE INDEX ateliers_status_idx ON ateliers(status);

CREATE TABLE atelier_memberships (
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role account_role NOT NULL CHECK (role IN ('atelier_owner', 'atelier_manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atelier_id, account_id)
);

CREATE TABLE atelier_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES accounts(id),
  id_document_ref text NOT NULL,
  phone_verified_at timestamptz,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_account_id uuid REFERENCES accounts(id),
  decision text CHECK (decision IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 160),
  phone_e164 text,
  email citext,
  notes text,
  deleted_at timestamptz,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_atelier_active_idx ON clients(atelier_id) WHERE deleted_at IS NULL;

CREATE TABLE beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  notes text,
  deleted_at timestamptz,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE measurement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  beneficiary_id uuid REFERENCES beneficiaries(id) ON DELETE CASCADE,
  values_cm jsonb NOT NULL,
  recorded_by uuid REFERENCES accounts(id),
  supersedes_id uuid REFERENCES measurement_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((client_id IS NOT NULL)::integer + (beneficiary_id IS NOT NULL)::integer = 1)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),
  public_reference text NOT NULL,
  status order_status NOT NULL DEFAULT 'draft',
  total_cfa bigint NOT NULL CHECK (total_cfa >= 0),
  paid_cfa bigint NOT NULL DEFAULT 0 CHECK (paid_cfa >= 0),
  due_at timestamptz,
  notes text,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_cfa <= total_cfa),
  UNIQUE (atelier_id, public_reference)
);
CREATE INDEX orders_atelier_status_idx ON orders(atelier_id, status, due_at);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  beneficiary_id uuid REFERENCES beneficiaries(id),
  measurement_version_id uuid REFERENCES measurement_versions(id),
  garment_type text NOT NULL,
  unit_price_cfa bigint NOT NULL CHECK (unit_price_cfa >= 0),
  status order_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  amount_cfa bigint NOT NULL CHECK (amount_cfa > 0),
  method payment_method NOT NULL,
  note text,
  received_by uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, idempotency_key)
);

CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fabric', 'notion', 'supply')),
  name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unit',
  cost_cfa bigint CHECK (cost_cfa >= 0),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_sync_state (
  device_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  atelier_id uuid REFERENCES ateliers(id) ON DELETE CASCADE,
  cursor bigint NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE change_log (
  sequence bigserial PRIMARY KEY,
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  version bigint NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_log_sync_idx ON change_log(atelier_id, sequence);

CREATE TABLE contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  client_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  channel contact_channel NOT NULL,
  status contact_status NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  contact_event_id uuid NOT NULL UNIQUE REFERENCES contact_events(id) ON DELETE RESTRICT,
  author_account_id uuid NOT NULL REFERENCES accounts(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (char_length(body) <= 2000),
  status review_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  actor_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  atelier_id uuid REFERENCES ateliers(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); NEW.version = NEW.version + 1; RETURN NEW; END $$;
CREATE TRIGGER clients_touch BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER beneficiaries_touch BEFORE UPDATE ON beneficiaries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER orders_touch BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER inventory_touch BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER ateliers_touch BEFORE UPDATE ON ateliers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
