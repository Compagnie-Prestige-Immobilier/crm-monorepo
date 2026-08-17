-- Cinq index sur la date de l'ACTE, et non sur `createdAt`.
--
-- `createdAt` est l'heure d'ARRIVEE EN BASE. Un teleconseiller reste hors ligne
-- trois semaines : ses appels du lundi arrivent le jeudi de la synchronisation
-- et un decompte adosse a `createdAt` les compte ce jeudi-la. La journee de
-- travail se lit sur `clientCreatedAt`, releve chez le client, et la cloture
-- d'une tache sur `completedAt`.
--
-- CONCURRENTLY, DONC HORS TRANSACTION.
--
-- Un CREATE INDEX ordinaire prend un SHARE sur la table et bloque toute
-- ecriture le temps du parcours ; sur `call_attempts` et `prospects`, c'est la
-- synchronisation mobile qui s'arrete. CONCURRENTLY ne prend qu'un SHARE UPDATE
-- EXCLUSIVE, mais PostgreSQL le refuse dans un bloc de transaction. Ce fichier
-- ne contient donc QUE ces instructions et rien d'autre : aucune instruction
-- supplementaire ne doit y etre ajoutee, elle ouvrirait le bloc implicite qui
-- les ferait toutes echouer.
--
-- IF NOT EXISTS parce qu'un CREATE INDEX CONCURRENTLY interrompu laisse un
-- index INVALIDE derriere lui : le fichier doit rester rejouable. Un index
-- invalide se repere par `SELECT indexrelid::regclass FROM pg_index WHERE NOT
-- indisvalid` et se refait par un DROP INDEX puis un rejeu.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "call_attempts_performedById_clientCreatedAt_idx" ON "call_attempts" ("performedById", "clientCreatedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "rep_call_attempts_performedById_clientCreatedAt_idx" ON "rep_call_attempts" ("performedById", "clientCreatedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "prospects_createdById_clientCreatedAt_idx" ON "prospects" ("createdById", "clientCreatedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "representants_createdById_clientCreatedAt_idx" ON "representants" ("createdById", "clientCreatedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "call_tasks_assignedToId_completedAt_idx" ON "call_tasks" ("assignedToId", "completedAt");
