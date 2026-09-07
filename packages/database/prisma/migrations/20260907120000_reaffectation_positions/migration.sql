-- EB-16 : la trace d'une reaffectation ne portait qu'un compte. Sans les
-- positions, impossible d'imprimer au destinataire les seules fiches recues
-- apres son programme papier.
ALTER TABLE "lot_export_reaffectations"
  ADD COLUMN "positions" INTEGER[] NOT NULL DEFAULT '{}';
