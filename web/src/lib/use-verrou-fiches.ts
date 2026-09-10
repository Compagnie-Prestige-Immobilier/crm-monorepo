'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchParametresChues } from '@/lib/data/parametres-chues';
import { queryKeys } from '@/lib/query-keys';

/** Actif par défaut : tant que le réglage n'a pas répondu, le comportement historique tient. */
export function useVerrouFiches(): boolean {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });
  return parametres.data?.verrouFiches ?? true;
}
