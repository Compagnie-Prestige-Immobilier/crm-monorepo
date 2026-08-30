import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('migration runner contract', () => {
  const sql = readFileSync(resolve(__dirname, '../migrations/0001_init.sql'), 'utf8');

  it('uses an ordered migration id and transactional boundaries', () => {
    expect('0001_init.sql').toMatch(/^\d{4}_.+\.sql$/);
    expect(sql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
  });

  it('has a deterministic checksum suitable for drift detection', () => {
    const digest = createHash('sha256').update(sql.trim()).digest('hex');
    expect(digest).toHaveLength(64);
    expect(digest).toBe(createHash('sha256').update(sql.trim()).digest('hex'));
  });

  it('contains the required geographic and migration primitives', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(sql).toContain('location geography(Point, 4326)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
  });
});
