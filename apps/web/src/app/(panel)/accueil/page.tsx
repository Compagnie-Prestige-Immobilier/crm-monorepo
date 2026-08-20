import type { Metadata } from 'next';

import { RegistreView } from '@/components/accueil/registre-view';

export const metadata: Metadata = { title: 'Registre des visites' };

export default function AccueilPage() {
  return <RegistreView />;
}
