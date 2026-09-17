import { createFileRoute } from '@tanstack/react-router';

import { BankAOuvrirSkeleton, BankAOuvrirView } from '@/components/bank/bank-a-ouvrir-view';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/dossiers/nouveau')({
  beforeLoad: guardPermission('banque.dossiers'),
  component: NouveauDossierGrandPublicPage,
  pendingComponent: BankAOuvrirSkeleton,
});

function NouveauDossierGrandPublicPage() {
  return <BankAOuvrirView projet="GRAND_PUBLIC" />;
}
