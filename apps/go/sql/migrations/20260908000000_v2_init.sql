-- +goose Up
-- SQL in this section is executed when the migration is applied.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back.

DROP FUNCTION IF EXISTS set_updated_at();
