-- Lot 4. Deux ajouts, aucune suppression : cette migration se rembobine sans
-- toucher a la base, la version precedente ignore ce qu'elle ne connait pas.

-- « Etablissement » a la creation d'un prospect, facultatif. En clair et non en
-- referentiel : la variete des ecoles, cliniques et casernes n'en supporterait
-- pas un, et une liste fermee ferait saisir « autre » partout.
ALTER TABLE "prospects" ADD COLUMN "etablissement" TEXT;

-- « Vocal ou messagerie electronique » ne disait pas par quel canal le prospect
-- recoit les consignes, or le teleconseiller doit lui lire soit l'adresse CHUES
-- soit le numero WhatsApp. Les deux canaux se separent donc.
--
-- Ajout seul : la reprise des lignes existantes est dans la migration suivante,
-- PostgreSQL refusant d'employer une valeur d'enumeration dans la transaction
-- qui la cree.
ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'WHATSAPP';
