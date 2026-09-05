-- « Mauvais numero » compte desormais comme un appel abouti (EB-03).
--
-- Les taux ne lisent pas cette colonne, ils passent par une constante SQL. Elle
-- est en revanche affichee dans l'administration des referentiels et redescend
-- au telephone : laissee a `false`, elle contredirait a l'ecran ce que le
-- calcul fait deja.
--
-- Le seed pose la meme valeur ; cet UPDATE existe pour les bases deja semees,
-- ou le seed ne repasse pas.

UPDATE "call_outcome_reasons"
   SET "countsAsReached" = true, "updatedAt" = CURRENT_TIMESTAMP
 WHERE "code" = 'WRONG_NUMBER'
   AND "countsAsReached" = false;
