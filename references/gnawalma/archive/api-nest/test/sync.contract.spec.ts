import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('offline sync contract', () => {
  // The request schema moved out of the controller into the shared contracts
  // module, which is now the single definition used by both runtime validation
  // and the generated OpenAPI document. The assertions below are unchanged in
  // intent — they just follow the schema to where it lives.
  const contracts = readFileSync(
    resolve(__dirname, '../src/contracts/schemas.ts'),
    'utf8',
  );
  // Collapsed so the assertions test the contract, not the formatter's choice
  // of where to wrap a fluent chain.
  const contractsFlat = contracts.replace(/\s+/g, ' ');
  const service = readFileSync(
    resolve(__dirname, '../src/sync/sync.service.ts'),
    'utf8',
  );
  const migration = readFileSync(
    resolve(__dirname, '../migrations/0005_sync_idempotency.sql'),
    'utf8',
  );

  it('accepts bounded batches with stable operation identifiers', () => {
    expect(contractsFlat).toContain('operationId: uuid');
    expect(contractsFlat).toContain('.min(1) .max(100)');
    expect(contractsFlat).toContain("z.enum(['upsert', 'delete'])");
  });

  it('supports idempotent replay and explicit conflicts', () => {
    expect(service).toContain('requestHash');
    expect(service).toContain('replayed: true');
    expect(service).toContain("status: 'conflict'");
    expect(service).toContain('VERSION_CONFLICT');
  });

  it('tracks device cursors per atelier rather than globally', () => {
    expect(migration).toContain(
      'PRIMARY KEY (device_id, atelier_id)',
    );
    expect(service).toContain('ON CONFLICT (device_id,atelier_id)');
  });
});
