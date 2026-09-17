import { createFileRoute } from '@tanstack/react-router';

import { BankAOuvrirSkeleton, BankAOuvrirView } from '@/components/bank/bank-a-ouvrir-view';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/finance/dossiers/nouveau')({
  beforeLoad: guardPermission('banque.dossiers'),
  component: NouveauDossierPage,
  pendingComponent: BankAOuvrirSkeleton,
});

function NouveauDossierPage() {
  return <BankAOuvrirView />;
}
