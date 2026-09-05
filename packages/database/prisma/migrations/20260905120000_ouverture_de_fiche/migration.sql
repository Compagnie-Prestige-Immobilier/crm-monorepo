-- L'ouverture confirmee d'une fiche : ce qui la compte, la chronometre, la
-- verrouille et garde ce qui y a ete saisi.
--
-- Migration PUREMENT ADDITIVE : une table neuve, rien de touche ailleurs. La
-- version precedente de l'application l'ignore.

CREATE TABLE "ouvertures_fiche" (
    "id" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "representantId" TEXT,
    "prospectId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closingAttemptId" TEXT,
    "draft" JSONB,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ouvertures_fiche_pkey" PRIMARY KEY ("id"),
    -- Une ouverture porte sur UNE fiche, prospect ou representant. Meme patron
    -- que `device_call_detections` et `lot_export_items`.
    CONSTRAINT "ouvertures_fiche_cible_check"
      CHECK (("representantId" IS NULL) <> ("prospectId" IS NULL)),
    CONSTRAINT "ouvertures_fiche_chronometre_check"
      CHECK ("closedAt" IS NULL OR "closedAt" >= "openedAt"),
    -- Liberer, c'est fermer : une fiche liberee n'est plus verrouillee, et elle
    -- n'a pas ete qualifiee.
    CONSTRAINT "ouvertures_fiche_liberation_check"
      CHECK (
        ("releasedById" IS NULL) = ("releasedAt" IS NULL)
        AND ("releasedById" IS NULL OR ("closedAt" IS NOT NULL AND "closingAttemptId" IS NULL))
      )
);

-- Fiches ouvertes par teleconseiller et par journee de travail (EB-13), puis la
-- meme lecture toutes files confondues pour le tableau de bord : sans le second
-- index, un comptage sur une journee balaierait toute la table.
CREATE INDEX "ouvertures_fiche_openedById_openedAt_idx" ON "ouvertures_fiche"("openedById", "openedAt");
CREATE INDEX "ouvertures_fiche_openedAt_idx" ON "ouvertures_fiche"("openedAt");

-- Le brouillon a restituer et l'historique des ouvertures d'une fiche.
CREATE INDEX "ouvertures_fiche_representantId_openedAt_idx" ON "ouvertures_fiche"("representantId", "openedAt");
CREATE INDEX "ouvertures_fiche_prospectId_openedAt_idx" ON "ouvertures_fiche"("prospectId", "openedAt");

-- Curseur de synchronisation : une liberation faite en supervision redescend au
-- telephone en `orderBy: [updatedAt, id]`.
CREATE INDEX "ouvertures_fiche_updatedAt_id_idx" ON "ouvertures_fiche"("updatedAt", "id");

-- Le verrou, tenu par la base et non par l'ecran : un teleconseiller n'a jamais
-- deux fiches ouvertes a la fois, quel que soit l'appareil. Index PARTIEL, donc
-- absent de schema.prisma que Prisma ne sait pas faire porter une clause WHERE.
-- Il sert aussi la supervision : la liste des fiches restees ouvertes ne
-- compte qu'une ligne par teleconseiller actif.
CREATE UNIQUE INDEX "ouvertures_fiche_verrou_unique"
  ON "ouvertures_fiche"("openedById") WHERE "closedAt" IS NULL;

ALTER TABLE "ouvertures_fiche" ADD CONSTRAINT "ouvertures_fiche_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ouvertures_fiche" ADD CONSTRAINT "ouvertures_fiche_releasedById_fkey"
  FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ouvertures_fiche" ADD CONSTRAINT "ouvertures_fiche_representantId_fkey"
  FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ouvertures_fiche" ADD CONSTRAINT "ouvertures_fiche_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
