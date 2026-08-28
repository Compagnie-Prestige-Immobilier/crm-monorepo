-- Le moteur de composition sert désormais plusieurs écrans (registre des
-- visites, chiffres CHUES, chiffres Grand Public) : la clé primaire passe de
-- `userId` à `(userId, ecran)`. Les lignes existantes décrivent toutes le
-- registre, d'où le défaut 'visites'.
SET LOCAL lock_timeout = '3s';

ALTER TABLE "visite_dashboard_layouts" RENAME TO "dashboard_layouts";
ALTER TABLE "dashboard_layouts" RENAME CONSTRAINT "visite_dashboard_layouts_pkey" TO "dashboard_layouts_pkey";
ALTER TABLE "dashboard_layouts" RENAME CONSTRAINT "visite_dashboard_layouts_userId_fkey" TO "dashboard_layouts_userId_fkey";

ALTER TABLE "dashboard_layouts" ADD COLUMN "ecran" TEXT NOT NULL DEFAULT 'visites';

ALTER TABLE "dashboard_layouts" DROP CONSTRAINT "dashboard_layouts_pkey";
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("userId", "ecran");

-- Le défaut n'a servi qu'à la reprise : une écriture nomme toujours son écran.
ALTER TABLE "dashboard_layouts" ALTER COLUMN "ecran" DROP DEFAULT;
