-- +goose Up
ALTER TABLE public.assistant_questions ADD COLUMN "epinglee" boolean DEFAULT false NOT NULL;

-- +goose Down
ALTER TABLE public.assistant_questions DROP COLUMN "epinglee";
