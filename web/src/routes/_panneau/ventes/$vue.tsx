import { createFileRoute, redirect } from '@tanstack/react-router';

import { VentesView, VUES_VENTES, type VueVentes } from '@/components/ventes/ventes-view';
import { guardPermission } from '@/lib/guard';

const VUES_SAISIE: ReadonlySet<string> = new Set<VueVentes>(['nouvelle', 'reglages']);

const estVue = (vue: string): vue is VueVentes => (VUES_VENTES as readonly string[]).includes(vue);

/** Chaque entrée de la barre a son adresse : le pas-à-pas, un onglet ou les réglages. */
export const Route = createFileRoute('/_panneau/ventes/$vue')({
  beforeLoad: ({ context, params }) => {
    guardPermission('ventes.lire')({ context });
    if (!estVue(params.vue)) throw redirect({ href: '/ventes', replace: true });
    if (VUES_SAISIE.has(params.vue)) guardPermission('ventes.gerer')({ context });
  },
  component: VuePage,
});

function VuePage() {
  const { vue } = Route.useParams();
  return <VentesView vue={estVue(vue) ? vue : 'ventes'} />;
}
