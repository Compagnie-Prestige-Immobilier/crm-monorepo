import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(__dirname, '../migrations/0001_init.sql'), 'utf8');

describe('payment persistence contract', () => {
  it('enforces a per-order idempotency key at the database boundary', () => {
    expect(migration).toContain('UNIQUE (order_id, idempotency_key)');
  });

  it('records payments as a constrained FCFA integer amount', () => {
    expect(migration).toContain('amount_cfa bigint NOT NULL CHECK (amount_cfa > 0)');
    expect(migration).toContain('total_cfa bigint NOT NULL CHECK (total_cfa >= 0)');
    expect(migration).toContain('CHECK (paid_cfa <= total_cfa)');
  });
});
