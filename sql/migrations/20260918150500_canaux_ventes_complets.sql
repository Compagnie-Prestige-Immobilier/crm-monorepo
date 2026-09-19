-- +goose Up

INSERT INTO public.ventes_canaux ("libelle", "ordre")
VALUES
    ('SPONTANNE', 5),
    ('MARKETING', 6),
    ('BDD DEPLOIEMENT', 7)
ON CONFLICT ("libelle") DO NOTHING;

-- +goose Down

DELETE FROM public.ventes_canaux
WHERE "libelle" IN ('SPONTANNE', 'MARKETING', 'BDD DEPLOIEMENT');
