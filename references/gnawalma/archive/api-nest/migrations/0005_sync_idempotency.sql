BEGIN;

DELETE FROM device_sync_state WHERE atelier_id IS NULL;

ALTER TABLE device_sync_state
  ALTER COLUMN atelier_id SET NOT NULL;

ALTER TABLE device_sync_state
  DROP CONSTRAINT IF EXISTS device_sync_state_pkey;

ALTER TABLE device_sync_state
  ADD CONSTRAINT device_sync_state_pkey PRIMARY KEY (device_id, atelier_id);

CREATE TABLE sync_operations (
  operation_id uuid PRIMARY KEY,
  device_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'inventory_item')),
  entity_id uuid NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX sync_operations_device_idx
  ON sync_operations(device_id, atelier_id, created_at DESC);

CREATE INDEX sync_operations_entity_idx
  ON sync_operations(atelier_id, entity_type, entity_id, created_at DESC);

COMMIT;
