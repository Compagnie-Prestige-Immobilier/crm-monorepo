import { createFileRoute } from '@tanstack/react-router';

import { BankAOuvrirSkeleton, BankAOuvrirView } from '@/components/bank/bank-a-ouvrir-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/dossiers/nouveau')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: NouveauDossierGrandPublicPage,
  pendingComponent: BankAOuvrirSkeleton,
});

function NouveauDossierGrandPublicPage() {
  return <BankAOuvrirView projet="GRAND_PUBLIC" />;
}
