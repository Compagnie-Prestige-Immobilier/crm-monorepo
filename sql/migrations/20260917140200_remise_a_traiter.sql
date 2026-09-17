-- +goose Up

-- La file écarte une fiche que le téléconseiller a déjà appelée. Une fiche que
-- l'encadrement remet à traiter y revient : l'appel antérieur ne compte plus.
ALTER TABLE public.prospects ADD COLUMN "remiseATraiterAt" timestamp(3) without time zone;

-- +goose Down
ALTER TABLE public.prospects DROP COLUMN "remiseATraiterAt";
