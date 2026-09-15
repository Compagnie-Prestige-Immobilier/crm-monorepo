-- +goose Up
ALTER TABLE public.statuts_qualification
  ADD COLUMN "parentId" text REFERENCES public.statuts_qualification("id");

-- +goose Down
ALTER TABLE public.statuts_qualification DROP COLUMN IF EXISTS "parentId";
