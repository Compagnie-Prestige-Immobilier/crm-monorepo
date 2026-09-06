import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Statuts de qualification' };

/**
 * Les statuts sont devenus un onglet des listes de référence. La route reste :
 * elle a été partagée avant le déplacement.
 */
export default function StatutsQualificationPage(): never {
  permanentRedirect('/admin/referentiels?onglet=statutsQualification');
}
