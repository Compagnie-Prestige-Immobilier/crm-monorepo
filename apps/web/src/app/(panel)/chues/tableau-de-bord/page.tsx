import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Chiffres' };

/**
 * Les deux écrans de chiffres n'en font plus qu'un. La route reste : des
 * notifications enregistrées en base y pointent encore.
 */
export default function TableauDeBordChuesPage(): never {
  permanentRedirect('/chues/statistiques');
}
