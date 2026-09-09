import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  enregistrerDisposition,
  enregistrerDispositionParDefaut,
  fetchDisposition,
  reinitialiserDisposition,
  type Preset,
  type Widget,
} from '@/lib/data/disposition';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** Les trois écritures de la disposition d'un écran, et sa lecture. */
export function useDispositionVisites() {
  const queryClient = useQueryClient();

  const disposition = useQuery({
    queryKey: queryKeys.disposition('visites'),
    queryFn: () => fetchDisposition('visites'),
  });

  const preset: Preset | undefined = disposition.data?.preset;

  const invalider = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.disposition('visites') });
  };

  const enregistrer = useMutation({
    mutationFn: (widgets: Widget[]) => enregistrerDisposition('visites', widgets, preset),
    onSuccess: invalider,
    onError: (error) => {
      toastApiError(error, 'La disposition n’a pas pu être enregistrée.');
    },
  });

  const parDefaut = useMutation({
    mutationFn: (widgets: Widget[]) => enregistrerDispositionParDefaut('visites', widgets, preset),
    onError: (error) => {
      toastApiError(error, 'La disposition par défaut n’a pas pu être fixée.');
    },
  });

  const reinitialiser = useMutation({
    mutationFn: () => reinitialiserDisposition('visites'),
    onSuccess: invalider,
    onError: (error) => {
      toastApiError(error, 'La disposition n’a pas pu être réinitialisée.');
    },
  });

  return { disposition, enregistrer, parDefaut, reinitialiser };
}
