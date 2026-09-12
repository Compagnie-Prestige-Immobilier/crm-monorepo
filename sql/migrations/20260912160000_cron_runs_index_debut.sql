-- +goose Up
-- Les lectures de l'écran filtrent sur la plage de dates seule ; l'index
-- (nom, debut) ne sert que les sous-requêtes par tâche. À trois tâches à la
-- minute la table prend environ 4 600 lignes par jour, et le balayage
-- séquentiel se compterait en secondes sur une plage d'un an.
CREATE INDEX IF NOT EXISTS cron_runs_debut_idx ON public.cron_runs ("debut");

-- +goose Down
DROP INDEX IF EXISTS public.cron_runs_debut_idx;
