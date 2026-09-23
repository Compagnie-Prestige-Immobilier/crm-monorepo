-- +goose Up
CREATE TABLE public.assistant_questions (
    "id" text PRIMARY KEY,
    "userId" text NOT NULL,
    "libelle" text NOT NULL,
    "question" text NOT NULL,
    "partagee" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT assistant_questions_libelle_longueur CHECK (length(btrim("libelle")) BETWEEN 1 AND 80),
    CONSTRAINT assistant_questions_question_longueur CHECK (length(btrim("question")) BETWEEN 1 AND 500),
    CONSTRAINT assistant_questions_user_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX assistant_questions_user_idx ON public.assistant_questions ("userId", "createdAt" DESC);

INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'assistant.utiliser')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'assistant.utiliser';
DROP TABLE public.assistant_questions;
