import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

const marketplace = read('src/marketplace/marketplace.service.ts');
const operations = read('src/operations/operations.service.ts');
const openapi = JSON.parse(read('openapi.json')) as {
  paths: Record<string, Record<string, unknown>>;
};

/**
 * The chain that has to hold for a client to be able to reach an atelier at
 * all: an atelier is created, submitted, approved, and only then listed.
 *
 * Every link existed except the second. Nothing wrote `atelier_verifications`,
 * so the back-office queue was empty by construction, no atelier could leave
 * 'draft', and `GET /marketplace/ateliers` — which lists verified ateliers only
 * — returned nothing whatever the tester did. Each assertion below fails if one
 * of those links is removed again.
 */
describe('marketplace publication chain', () => {
  it('lists only verified ateliers that carry a position', () => {
    expect(marketplace).toContain("a.status='verified'");
    expect(marketplace).toContain('a.location IS NOT NULL');
  });

  it('exposes a route that publishes an atelier and queues it for review', () => {
    expect(
      openapi.paths['/operations/ateliers/{atelierId}/verification'],
    ).toHaveProperty('post');
    expect(operations).toContain('INSERT INTO atelier_verifications');
    // D-010: verification is automatic, the admin review is remote. Publishing
    // only on the administrator's decision made every client's marketplace
    // depend on that account existing and being staffed.
    expect(operations).toContain(
      "UPDATE ateliers SET status='verified', verified_at=now()",
    );
  });

  it('refuses to submit an atelier the marketplace could never list', () => {
    // Approving a positionless atelier would produce a verified row that still
    // appears in no search — a silent failure one step further down the line.
    expect(operations).toContain('has_location');
  });

  it('lets an atelier correct its position after creation', () => {
    // Creation used to be the only write, so every atelier created before the
    // wizard asked for a zone was stranded without coordinates.
    expect(openapi.paths['/operations/ateliers/{atelierId}']).toHaveProperty(
      'patch',
    );
  });

  it('gives the receiving atelier a way to read its client requests', () => {
    // Without this, `contact_events` has one reader, the bilateral confirmation
    // can never reach its second half, and no review can ever be written.
    expect(
      openapi.paths['/operations/ateliers/{atelierId}/contacts'],
    ).toHaveProperty('get');
    expect(operations).toContain('FROM contact_events c');
  });

  it('stores atelier phone numbers in the E.164 form the column claims', () => {
    expect(operations).toContain('normalizePhone(input.phone)');
  });
});

/**
 * Client mistakes must not read as server failures.
 *
 * Each of these produced a 500 and the message "Le service rencontre un
 * problème temporaire" — which tells the reader to wait and retry an operation
 * that could never succeed, and tells the operator to look for an outage that
 * does not exist.
 */
describe('client errors are reported as client errors', () => {
  const controller = read('src/marketplace/marketplace.controller.ts');
  const admin = read('src/admin/admin.controller.ts');
  const filter = read('src/common/problem-details.filter.ts');

  it('parses search pagination with the published schema, not Number()', () => {
    // `Number('abc')` is NaN, every clamp comparison against it is false, and
    // `LIMIT NaN` is a database error: one malformed query string crashed the
    // public search endpoint.
    expect(controller).toContain('marketplaceSearchQuery.parse(query)');
    expect(controller).toContain('pageQuery.parse(query)');
    // Matched against the assignments themselves rather than the file as a
    // whole — the explanation above quotes the old expression.
    expect(controller).not.toMatch(/limit:\s*Math\./);
    expect(controller).not.toMatch(/radiusMeters:\s*Math\./);
  });

  it('parses every path identifier before it reaches SQL', () => {
    for (const source of [controller, admin]) {
      expect(source).toContain('uuid.parse(id)');
    }
  });

  it('validates request bodies with the published schemas', () => {
    // These were re-declared inline, so the contract and the server stated the
    // same rule twice and could drift apart.
    expect(controller).toContain('createContactRequest.parse(body)');
    expect(controller).toContain('confirmContactRequest.parse(body)');
    expect(controller).toContain('createReviewRequest.parse(body)');
  });

  it('maps unique, foreign key, check and cast violations to 4xx', () => {
    expect(filter).toContain("case '23505'");
    expect(filter).toContain("case '23503'");
    expect(filter).toContain("case '23514'");
    expect(filter).toContain("case '22P02'");
  });

  it('refuses a second review of the same service with a stated reason', () => {
    expect(marketplace).toContain(
      'A review has already been left for this service',
    );
  });
});
