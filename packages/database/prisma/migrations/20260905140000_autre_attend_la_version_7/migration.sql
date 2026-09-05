-- Les deux statuts « Autre » exigent un motif, donc une application qui sait
-- l'exiger.
--
-- Semes en version 6, ils etaient servis aux telephones deja deployes, qui
-- ignorent `requiresComment` et les emettraient sans motif. Le serveur refuse,
-- et un refus est DEFINITIF hors ligne : l'ecran « A corriger » ne propose
-- qu'un renvoi a l'identique, jamais une reedition. La qualification serait
-- perdue.
--
-- Les sept autres statuts neufs restent en 6 : ils n'exigent rien de plus que
-- ce que le parc sait deja emettre.

UPDATE "statuts_qualification"
   SET "minPayloadVersion" = 7, "updatedAt" = CURRENT_TIMESTAMP
 WHERE "code" IN ('AUTRE_JOINT', 'AUTRE_NON_JOINT')
   AND "minPayloadVersion" < 7;
