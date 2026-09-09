import {
  ArrowRightLeftIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  PhoneCallIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { BadgeProps } from '@/components/ui/badge';

export type CategorieHistorique = 'appel' | 'statut' | 'fil' | 'prospect' | 'fiche';

export interface EvenementHistorique {
  id: string;
  categorie: CategorieHistorique;
  /** ISO. L'histoire se lit du plus récent au plus ancien. */
  at: string;
  titre: string;
  resume?: string | null;
  acteur: string;
  source?: string | null;
  variant?: NonNullable<BadgeProps['variant']>;
  /** Ce que le volet montre quand on clique la ligne. */
  detail: ReactNode;
  lien?: { href: string; label: string } | null;
  action?: ReactNode;
}

export const CATEGORIES: Record<
  CategorieHistorique,
  { label: string; icone: LucideIcon; teinte: string }
> = {
  appel: { label: 'Appels', icone: PhoneCallIcon, teinte: 'bg-info-surface text-info' },
  statut: {
    label: 'Statuts',
    icone: ArrowRightLeftIcon,
    teinte: 'bg-accent-surface text-accent-text',
  },
  fil: { label: 'Fil', icone: MessageSquareTextIcon, teinte: 'bg-secondary text-foreground' },
  prospect: { label: 'Prospects', icone: UserPlusIcon, teinte: 'bg-success-surface text-success' },
  fiche: { label: 'Fiche', icone: FileTextIcon, teinte: 'bg-muted text-muted-foreground' },
};

export const ORDRE_CATEGORIES: readonly CategorieHistorique[] = [
  'appel',
  'statut',
  'fil',
  'prospect',
  'fiche',
];

export function parJour(
  evenements: readonly EvenementHistorique[],
): [string, EvenementHistorique[]][] {
  const jours = new Map<string, EvenementHistorique[]>();
  for (const evenement of evenements) {
    const jour = evenement.at.slice(0, 10);
    const liste = jours.get(jour);
    if (liste === undefined) jours.set(jour, [evenement]);
    else liste.push(evenement);
  }
  return [...jours.entries()];
}
