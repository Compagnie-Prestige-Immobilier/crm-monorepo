-- +goose Up

-- Un motif peut préciser un motif parent : « Intéressé » puis « Terrain ».
-- L'enfant porte l'effet du parent, jamais plus d'un niveau.
ALTER TABLE public.call_outcome_reasons
  ADD COLUMN "parentId" text REFERENCES public.call_outcome_reasons(id) ON DELETE RESTRICT;
CREATE INDEX "call_outcome_reasons_parentId_idx" ON public.call_outcome_reasons ("parentId");

-- +goose Down
DROP INDEX IF EXISTS public."call_outcome_reasons_parentId_idx";
ALTER TABLE public.call_outcome_reasons DROP COLUMN "parentId";
