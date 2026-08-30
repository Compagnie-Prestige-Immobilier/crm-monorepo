BEGIN;

-- A review used to require a bilateral-confirmed completed service
-- (`contact_event_id` was `NOT NULL UNIQUE`) — the client and the atelier
-- both had to mark a contact as done before a review could exist. Product
-- decision: add a second, lighter path — a client can rate an atelier just
-- from visiting its profile, without a confirmed transaction behind it.
--
-- This trades away the fraud protection the bilateral gate gave for granted:
-- a visit-based review has no evidence a real service happened. `source`
-- keeps the two kinds distinguishable everywhere a review is read (list,
-- moderation queue), and both still default to 'pending' — visit-based
-- reviews get no special trust, they route through the same moderation
-- queue as before.
--
-- Service-review behaviour is unchanged: `contact_event_id` stays UNIQUE, so
-- "one review per completed contact" still holds exactly as before. The new
-- partial unique index adds the equivalent guarantee for the new path: one
-- visit-based review per (atelier, author) — it cannot stop a determined
-- multi-account abuser, only repeat spam from the same account, same as any
-- other one-review-per-identity limit in this schema.

ALTER TABLE reviews ALTER COLUMN contact_event_id DROP NOT NULL;

CREATE TYPE review_source AS ENUM ('service', 'visit');

ALTER TABLE reviews ADD COLUMN source review_source NOT NULL DEFAULT 'service';

ALTER TABLE reviews ADD CONSTRAINT reviews_source_contact_consistency
  CHECK (
    (source = 'service' AND contact_event_id IS NOT NULL)
    OR (source = 'visit' AND contact_event_id IS NULL)
  );

CREATE UNIQUE INDEX reviews_visit_one_per_client_atelier
  ON reviews (atelier_id, author_account_id)
  WHERE source = 'visit';

COMMIT;
