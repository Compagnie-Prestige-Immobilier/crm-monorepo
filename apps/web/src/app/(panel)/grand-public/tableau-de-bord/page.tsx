import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Chiffres Grand Public' };

/** Fusionné avec « Chiffres », comme du côté CHUES. */
export default function TableauDeBordGrandPublicPage(): never {
  permanentRedirect('/grand-public/statistiques');
}
