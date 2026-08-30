-- Development seed: a realistic Dakar marketplace.
--
-- Idempotent — safe to re-run. Only touches rows whose ids are in the fixed
-- namespace below, so it never disturbs hand-created dev data.
--
-- The marketplace search requires status='verified' AND location IS NOT NULL,
-- and derives rating/reviewCount from reviews with status='published'. All
-- three are set here, otherwise seeded ateliers are invisible to the app.

BEGIN;

-- ── Owner accounts ────────────────────────────────────────────
-- Demo PIN for all fixed seed accounts: 1234.
INSERT INTO accounts (id, phone_e164, pin_hash, display_name, role)
VALUES
  ('a0000000-0000-4000-8000-000000000001', '+221770000001', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Mariama Sow',   'atelier_owner'),
  ('a0000000-0000-4000-8000-000000000002', '+221770000002', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Ousmane Fall',  'atelier_owner'),
  ('a0000000-0000-4000-8000-000000000003', '+221770000003', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Aïssatou Ba',   'atelier_owner'),
  ('a0000000-0000-4000-8000-000000000004', '+221770000004', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Cheikh Diagne', 'atelier_owner'),
  ('a0000000-0000-4000-8000-000000000005', '+221770000005', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Fatou Ndiaye',  'atelier_owner'),
  ('a0000000-0000-4000-8000-000000000006', '+221770000006', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Awa Camara',    'atelier_owner'),
  -- Review authors.
  ('a0000000-0000-4000-8000-0000000000f1', '+221781000001', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Client Un',    'client'),
  ('a0000000-0000-4000-8000-0000000000f2', '+221781000002', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Client Deux',  'client'),
  ('a0000000-0000-4000-8000-0000000000f3', '+221781000003', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Client Trois', 'client'),
  -- Platform administrator. `POST /auth/register` only issues 'atelier_owner'
  -- and 'client' roles, and nothing else created one, so the back-office had no
  -- account that could sign in to it and its queue could never be worked. The
  -- seed refuses to run against NODE_ENV=production (scripts/seed.mjs); a
  -- production administrator is still an explicit, reviewed INSERT.
  ('a0000000-0000-4000-8000-0000000000a1', '+221780000000', '$argon2id$v=19$m=65536,t=3,p=4$EUBTmztbq7SRHd3Uv5Q18w$ONxBmmst0WpJWSpJ2b9T1zECuJomByu3tntSpdOJ0Bo', 'Administration', 'platform_admin')
ON CONFLICT (id) DO UPDATE SET
  pin_hash = EXCLUDED.pin_hash,
  updated_at = now();

-- ── Ateliers ──────────────────────────────────────────────────
-- Coordinates are real Dakar neighbourhoods, spread across a few km so
-- distance sorting and the radius filter are actually exercised.
INSERT INTO ateliers (
  id, owner_account_id, name, description, phone_e164, whatsapp_e164,
  address_text, location, location_precision_m, status, verified_at,
  logo_url, cover_url, specialties, response_time_minutes,
  profile_completeness, accepts_new_clients, next_available_at,
  supported_languages,
  -- §2.2 : sans reseaux seedes, la section « Ses reseaux » de la fiche
  -- publique n'apparait sur aucun atelier de demonstration, donc la
  -- fonctionnalite est invisible a qui teste l'application.
  tiktok_url, instagram_url, facebook_url
)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Atelier Mariama',
   'Robes de cérémonie et tenues traditionnelles cousues main. Vingt ans de métier à la Médina.',
   '+221770000001', '+221770000001', 'Médina, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4520, 14.6800), 4326)::geography, 25,
   'verified', now() - interval '90 days',
   'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=60&w=200',
   'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=60&w=800',
   ARRAY['Robes de cérémonie','Tenues traditionnelles','Boubou','Broderie'], 25, 100, true,
   now() + interval '1 day', ARRAY['fr','wo'],
   'https://www.tiktok.com/@ateliermariama', 'https://www.instagram.com/ateliermariama', 'https://www.facebook.com/ateliermariama'),

  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'Fall Couture',
   'Costumes sur mesure et retouches rapides. Livraison dans tout Dakar.',
   '+221770000002', '+221770000002', 'Plateau, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4380, 14.6690), 4326)::geography, 25,
   'verified', now() - interval '120 days',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=60&w=200',
   'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&q=60&w=800',
   ARRAY['Costumes','Retouches','Tenue homme'], 45, 100, true,
   now(), ARRAY['fr'],
   'https://www.tiktok.com/@fallcouture', 'https://www.instagram.com/fallcouture', NULL),

  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'Aïssatou Bazin',
   'Spécialiste du bazin riche et du wax. Teinture et broderie sur commande.',
   '+221770000003', NULL, 'Grand Yoff, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4700, 14.7250), 4326)::geography, 40,
   'verified', now() - interval '60 days',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=60&w=200',
   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=60&w=800',
   ARRAY['Bazin riche','Boubou','Wax','Teinture'], 120, 85, true,
   now() + interval '4 days', ARRAY['fr','wo'],
   NULL, 'https://www.instagram.com/aissatoubazin', 'https://www.facebook.com/aissatoubazin'),

  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'Diagne & Fils',
   'Uniformes scolaires et professionnels. Commandes en gros acceptées.',
   '+221770000004', '+221770000004', 'Pikine, Dakar',
   ST_SetSRID(ST_MakePoint(-17.3900, 14.7550), 4326)::geography, 50,
   'verified', now() - interval '200 days',
   NULL,
   'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=60&w=800',
   ARRAY['Uniformes','Tenue homme','Retouches'], 240, 70, false,
   NULL, ARRAY['fr'],
   NULL, NULL, 'https://www.facebook.com/diagneetfils'),

  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005',
   'Ndiaye Sur Mesure',
   'Création sur mesure pour femme. Essayages en atelier ou à domicile.',
   '+221770000005', '+221770000005', 'Point E, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4600, 14.6930), 4326)::geography, 20,
   'verified', now() - interval '30 days',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=60&w=200',
   'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=60&w=800',
   ARRAY['Sur mesure','Tenue femme','Robes de cérémonie'], 15, 100, true,
   now(), ARRAY['fr','wo'],
   'https://www.tiktok.com/@ndiayesurmesure', 'https://www.instagram.com/ndiayesurmesure', NULL),

  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006',
   'Camara Broderie',
   'Broderie machine et main, monogrammes, finitions haut de gamme.',
   '+221770000006', NULL, 'Ouakam, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4900, 14.7150), 4326)::geography, 30,
   'verified', now() - interval '15 days',
   NULL, NULL,
   ARRAY['Broderie','Retouches'], 60, 55, true,
   now() + interval '10 days', ARRAY['fr'],
   NULL, NULL, NULL),

  -- Awaiting review, on purpose. Every other seeded atelier is already
  -- 'verified', so the admin back-office opened onto "Aucun atelier en attente"
  -- no matter what, and the approve/reject path had nothing to exercise it.
  -- Coordinates are set here because the marketplace also filters on
  -- `location IS NOT NULL`: approving a positionless atelier would verify a
  -- row that still appears in no search.
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000006',
   'Atelier Yoff Couture',
   'Nouvel atelier en attente de vérification par la plateforme.',
   '+221770000007', '+221770000007', 'Yoff, Dakar',
   ST_SetSRID(ST_MakePoint(-17.4720, 14.7480), 4326)::geography, 35,
   'pending_review', NULL,
   NULL, NULL,
   ARRAY['Sur mesure','Retouches'], NULL, 45, true,
   NULL, ARRAY['fr','wo'],
   NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  location = EXCLUDED.location,
  specialties = EXCLUDED.specialties,
  cover_url = EXCLUDED.cover_url,
  logo_url = EXCLUDED.logo_url,
  response_time_minutes = EXCLUDED.response_time_minutes,
  profile_completeness = EXCLUDED.profile_completeness,
  accepts_new_clients = EXCLUDED.accepts_new_clients,
  next_available_at = EXCLUDED.next_available_at,
  tiktok_url = EXCLUDED.tiktok_url,
  instagram_url = EXCLUDED.instagram_url,
  facebook_url = EXCLUDED.facebook_url,
  updated_at = now();

-- ── File de vérification ──────────────────────────────────────
-- The one row the back-office reads. `atelier_verifications` was written by no
-- code path at all, so the queue was empty by construction and no atelier could
-- ever leave 'draft'. `POST /operations/ateliers/:id/verification` now writes
-- these; this seed gives the back-office something to decide on before a
-- tester has created anything.
INSERT INTO atelier_verifications (
  id, atelier_id, submitted_by, id_document_ref, phone_verified_at, checklist, decision
)
VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000007',
  'a0000000-0000-4000-8000-000000000006',
  'CNI-1975-2024-000731',
  now() - interval '2 days',
  '{"piece_identite": true, "adresse_confirmee": true, "telephone_verifie": true, "annees_experience": "8"}'::jsonb,
  'pending'
)
ON CONFLICT (id) DO UPDATE SET
  decision = 'pending',
  reviewer_account_id = NULL,
  reason = NULL,
  decided_at = NULL;

-- ── Portfolio ─────────────────────────────────────────────────
INSERT INTO atelier_portfolio_items (id, atelier_id, image_url, title, garment_type, sort_order)
VALUES
  ('c0000000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=60&w=600','Robe de mariage','robe',0),
  ('c0000000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=60&w=600','Grand boubou brodé','boubou',1),
  ('c0000000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=60&w=600','Tenue de baptême','ensemble',2),

  ('c0000000-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000002','https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&q=60&w=600','Costume trois pièces','costume',0),
  ('c0000000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000002','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=60&w=600','Veste cintrée','veste',1),
  ('c0000000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000002','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=60&w=600','Chemise sur mesure','chemise',2),

  ('c0000000-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000003','https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=60&w=600','Bazin brodé','bazin',0),
  ('c0000000-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000003','https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&q=60&w=600','Ensemble wax','wax',1),

  ('c0000000-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000005','https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=60&w=600','Robe longue','robe',0),
  ('c0000000-0000-4000-8000-000000000502','b0000000-0000-4000-8000-000000000005','https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&q=60&w=600','Tailleur femme','tailleur',1),
  ('c0000000-0000-4000-8000-000000000503','b0000000-0000-4000-8000-000000000005','https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&q=60&w=600','Tenue de soirée','robe',2)
ON CONFLICT (id) DO NOTHING;

-- ── Contact events + published reviews ────────────────────────
-- A review requires a contact_event (one review per contact, enforced by a
-- unique constraint), so the pair is seeded together.
INSERT INTO contact_events (id, atelier_id, client_account_id, channel, status, completed_at)
VALUES
  ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000f1','phone','completed', now() - interval '20 days'),
  ('d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000f2','whatsapp','completed', now() - interval '15 days'),
  ('d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000f3','phone','completed', now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-0000000000f1','phone','completed', now() - interval '30 days'),
  ('d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-0000000000f2','appointment','completed', now() - interval '12 days'),
  ('d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-0000000000f3','whatsapp','completed', now() - interval '40 days'),
  ('d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-0000000000f1','appointment','completed', now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-0000000000f2','phone','completed', now() - interval '3 days'),
  ('d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-0000000000f3','phone','completed', now() - interval '60 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO reviews (id, atelier_id, contact_event_id, author_account_id, rating, body, status)
VALUES
  ('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000f1',5,'Travail impeccable, livré avant la date.','published'),
  ('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-0000000000f2',5,'Broderie magnifique, je recommande.','published'),
  ('e0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-0000000000f3',4,'Très bonne finition, un peu de retard.','published'),
  ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-0000000000f1',5,'Costume parfaitement ajusté.','published'),
  ('e0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-0000000000f2',4,'Bon rapport qualité-prix.','published'),
  ('e0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-0000000000f3',5,'Le bazin est superbe.','published'),
  ('e0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-0000000000f1',5,'Essayage à domicile très pratique.','published'),
  ('e0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-0000000000f2',4,'Belle robe, délais respectés.','published'),
  ('e0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-0000000000f3',3,'Correct pour des uniformes.','published')
ON CONFLICT (id) DO NOTHING;

COMMIT;
