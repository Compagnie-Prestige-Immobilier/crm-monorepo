-- +goose Up

-- Une attribution opérationnelle ne peut pas rester portée par un compte
-- inactif. Les appels déjà enregistrés restent inchangés.
UPDATE public.lot_export_items i
SET "assigneeId" = NULL
FROM public.users u
WHERE u."id" = i."assigneeId"
  AND (NOT u."isActive" OR u."deletedAt" IS NOT NULL);

UPDATE public.lots_export l
SET "filters" = jsonb_set(
    l."filters",
    '{distribution,teleconseillerIds}',
    COALESCE((
        SELECT jsonb_agg(to_jsonb(e.value) ORDER BY e.ordinality)
        FROM jsonb_array_elements_text(
            l."filters"->'distribution'->'teleconseillerIds'
        ) WITH ORDINALITY AS e(value, ordinality)
        WHERE EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u."id" = e.value
              AND u."isActive"
              AND u."deletedAt" IS NULL
        )
    ), '[]'::jsonb)
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
        l."filters"->'distribution'->'teleconseillerIds'
    ) AS e(value)
    WHERE EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u."id" = e.value
          AND (NOT u."isActive" OR u."deletedAt" IS NOT NULL)
    )
);

-- +goose Down
-- Les attributions historiques supprimées ne se recréent pas.
