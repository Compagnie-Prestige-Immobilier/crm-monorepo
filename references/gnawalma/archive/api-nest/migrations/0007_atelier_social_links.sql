BEGIN;

-- Liens vers les réseaux sociaux du couturier.
--
-- Exigence §2.2 du cahier des charges : la fiche publique met en avant le
-- savoir-faire, et les réalisations d'un couturier vivent sur TikTok, Instagram
-- et Facebook bien plus que dans une galerie interne. Sans ces liens, la fiche
-- ne montre que ce qui a été téléversé dans l'application, c'est-à-dire presque
-- rien pour un artisan qui publie déjà ailleurs.
--
-- Stockés en texte et non en identifiant de compte : les trois plateformes ont
-- des formes d'URL différentes et changeantes, et un couturier colle l'adresse
-- de son profil telle qu'il la voit. La longueur est bornée pour éviter qu'un
-- champ libre serve à autre chose.
ALTER TABLE ateliers
  ADD COLUMN IF NOT EXISTS tiktok_url text
    CHECK (tiktok_url IS NULL OR char_length(tiktok_url) <= 300),
  ADD COLUMN IF NOT EXISTS instagram_url text
    CHECK (instagram_url IS NULL OR char_length(instagram_url) <= 300),
  ADD COLUMN IF NOT EXISTS facebook_url text
    CHECK (facebook_url IS NULL OR char_length(facebook_url) <= 300);

COMMIT;
