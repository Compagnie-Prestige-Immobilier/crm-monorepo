import { createFileRoute, redirect } from '@tanstack/react-router';

/** Les deux écrans de chiffres n'en font plus qu'un ; des notifications y pointent. */
export const Route = createFileRoute('/_panneau/$projet/tableau-de-bord')({
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/${params.projet}/statistiques` });
  },
});
