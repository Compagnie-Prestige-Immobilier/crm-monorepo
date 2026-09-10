import { createFileRoute } from '@tanstack/react-router';

import { BankAOuvrirSkeleton, BankAOuvrirView } from '@/components/bank/bank-a-ouvrir-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/dossiers/nouveau')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: NouveauDossierPage,
  pendingComponent: BankAOuvrirSkeleton,
});

function NouveauDossierPage() {
  return <BankAOuvrirView projet="CHUES" />;
}
