'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { modifierMethodeProspect, type MethodeEncadrement } from '@/lib/data/prospects';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  ENROLLMENT_METHOD_LABELS,
  ENROLLMENT_METHOD_ORDER,
  enrollmentMethodLabel,
  peut,
  type ProspectRow,
} from '@/lib/types';

const AUCUNE = 'AUCUNE';

const CHOIX: readonly { value: MethodeEncadrement; label: string }[] = [
  { value: AUCUNE, label: 'Aucun' },
  ...ENROLLMENT_METHOD_ORDER.map((method) => ({
    value: method,
    label: ENROLLMENT_METHOD_LABELS[method],
  })),
];

/** L'encadrement corrige la méthode sans appel ; les autres la lisent. */
export function MethodeFiche({ prospect, vide }: { prospect: ProspectRow; vide: string }) {
  const { data: user } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const modification = useMutation({
    mutationFn: (methode: MethodeEncadrement) => modifierMethodeProspect(prospect.id, methode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Méthode d’enrôlement modifiée.');
    },
    onError: (error) => toastApiError(error, 'La méthode n’a pas pu être modifiée.'),
  });

  const actuelle = prospect.enrollmentMethod;
  if (!peut(user, 'prospects.superviser')) {
    return <>{actuelle === null ? vide : enrollmentMethodLabel(actuelle)}</>;
  }

  // Une méthode retirée du menu reste lisible sur la fiche qui la porte encore.
  const choix =
    actuelle === null || CHOIX.some((item) => item.value === actuelle)
      ? CHOIX
      : [
          ...CHOIX,
          { value: actuelle as MethodeEncadrement, label: enrollmentMethodLabel(actuelle) },
        ];

  return (
    <Select
      items={choix}
      value={actuelle ?? AUCUNE}
      disabled={modification.isPending}
      onValueChange={(valeur) => {
        const cible = choix.find((item) => item.value === valeur);
        if (cible !== undefined && cible.value !== (actuelle ?? AUCUNE)) {
          modification.mutate(cible.value);
        }
      }}
    >
      <SelectTrigger size="sm" aria-label="Méthode d’enrôlement" className="w-full max-w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choix.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
