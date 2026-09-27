import { createFileRoute, redirect } from '@tanstack/react-router';

const VOLETS: Readonly<Record<string, string>> = {
  enrolement: '/admin/enrolement',
  deploiement: '/teleconseil/pole-deploiement',
  marketing: '/teleconseil/pole-marketing',
};

/** L'ancien tableau de bord admin : ses liens partagés mènent aux écrans qui le composaient. */
export const Route = createFileRoute('/_panneau/admin/tableau-de-bord')({
  beforeLoad: ({ location }) => {
    const volet = new URLSearchParams(location.searchStr).get('volet') ?? '';
    throw redirect({ href: VOLETS[volet] ?? '/teleconseil/tableau-de-bord', replace: true });
  },
});
