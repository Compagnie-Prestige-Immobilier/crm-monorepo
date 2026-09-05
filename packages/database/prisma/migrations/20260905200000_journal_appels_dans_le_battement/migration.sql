-- EB-37 : l'appareil declare si la lecture du journal d'appels est accordee.
-- Nul tant qu'il ne le dit pas : « inconnu » n'est pas « refuse ».
ALTER TABLE "agent_heartbeats" ADD COLUMN "journalAppelsAutorise" BOOLEAN;
