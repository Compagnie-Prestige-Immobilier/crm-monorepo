'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheckIcon,
  HandshakeIcon,
  HeartIcon,
  PhoneCallIcon,
  PhoneIncomingIcon,
  WalletIcon,
} from 'lucide-react';

import { Kpi } from '@/components/bank/bank-kpi';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPipelineContacts, type PipelineContacts } from '@/lib/data/prospects';
import { formatNumber } from '@/lib/format';
import type { Projet } from '@/lib/types';

const ETAPES: readonly {
  cle: keyof PipelineContacts;
  label: string;
  icon: typeof PhoneCallIcon;
}[] = [
  { cle: 'appelees', label: 'Appelées', icon: PhoneCallIcon },
  { cle: 'joignables', label: 'Joignables', icon: PhoneIncomingIcon },
  { cle: 'interessees', label: 'Intéressées', icon: HeartIcon },
  { cle: 'methodes', label: 'Méthode obtenue', icon: BadgeCheckIcon },
  { cle: 'converties', label: 'Converties', icon: HandshakeIcon },
  { cle: 'vendues', label: 'Vendues', icon: WalletIcon },
];

const part = (valeur: number, total: number): string =>
  total === 0 ? '' : `${String(Math.round((valeur / total) * 100))} % des appelées`;

/** Le parcours du téléconseiller sur ses contacts, de l'appel à la vente. */
export function PipelineContactsBande({
  appelePar,
  projet,
  masquee,
}: {
  appelePar: string;
  projet: Projet | null;
  /** L'onglet Représentants n'a pas de parcours de vente. */
  masquee: boolean;
}) {
  const pipeline = useQuery({
    queryKey: ['mes-contacts', 'pipeline', appelePar, projet],
    queryFn: () => fetchPipelineContacts(appelePar, projet),
    placeholderData: (previous) => previous,
    enabled: !masquee,
  });
  const data = pipeline.data;
  if (masquee) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {ETAPES.map((etape, index) =>
        data === undefined ? (
          <Skeleton key={etape.cle} className="h-24" />
        ) : (
          <Kpi
            key={etape.cle}
            index={index}
            label={etape.label}
            value={formatNumber(data[etape.cle])}
            hint={
              etape.cle === 'appelees' ? 'depuis le début' : part(data[etape.cle], data.appelees)
            }
            icon={etape.icon}
          />
        ),
      )}
    </div>
  );
}
