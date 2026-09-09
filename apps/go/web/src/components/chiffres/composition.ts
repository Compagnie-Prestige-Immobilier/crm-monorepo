import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { SourceChiffre } from '@/components/chiffres/formes';
import type { Marque } from '@/components/tableau-de-bord/sources';
import {
  enregistrerDisposition,
  enregistrerDispositionParDefaut,
  fetchDisposition,
  reinitialiserDisposition,
  serializeDisposition,
  type Disposition,
  type Widget,
} from '@/lib/data/disposition';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

export interface Composition {
  disposition: Disposition | undefined;
  erreurDisposition: unknown;
  refetch: () => void;
  widgets: Widget[];
  edition: boolean;
  modifie: boolean;
  enregistrementEnCours: boolean;
  reinitialisationEnCours: boolean;
  setBrouillon: (maj: (courant: Widget[] | null) => Widget[] | null) => void;
  entrer: () => void;
  quitter: () => void;
  enregistrer: () => void;
  fixerParDefaut: () => void;
  reinitialiser: () => void;
  ajouter: (source: string, marque: Marque) => void;
}

/**
 * L'écran composé : la disposition lue, le brouillon d'édition, et les trois
 * écritures que le serveur accepte. Le brouillon prime toujours sur le lu.
 */
export function useComposition(
  projet: Projet,
  catalogue: Record<string, SourceChiffre>,
): Composition {
  const queryClient = useQueryClient();
  const requete = useQuery({
    queryKey: queryKeys.disposition(projet),
    queryFn: () => fetchDisposition(projet),
  });

  const [brouillon, setBrouillon] = useState<Widget[] | null>(null);
  const [empreinte, setEmpreinte] = useState('');
  const enregistrees = requete.data?.widgets ?? [];
  const preset = requete.data?.preset;

  const invalider = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.disposition(projet) });
  };

  const enregistrement = useMutation({
    mutationFn: (widgets: Widget[]) => enregistrerDisposition(projet, widgets, preset),
    onSuccess: async () => {
      setBrouillon(null);
      await invalider();
    },
  });

  const parDefaut = useMutation({
    mutationFn: (widgets: Widget[]) => enregistrerDispositionParDefaut(projet, widgets, preset),
  });

  const reinitialisation = useMutation({
    mutationFn: () => reinitialiserDisposition(projet),
    onSuccess: invalider,
  });

  const source = brouillon ?? enregistrees;
  const widgets = source.filter((widget) => catalogue[widget.source] !== undefined);

  return {
    disposition: requete.data,
    erreurDisposition: requete.error,
    refetch: () => {
      void requete.refetch();
    },
    widgets,
    edition: brouillon !== null,
    modifie: brouillon !== null && JSON.stringify(serializeDisposition(brouillon)) !== empreinte,
    enregistrementEnCours: enregistrement.isPending,
    reinitialisationEnCours: reinitialisation.isPending,
    setBrouillon,
    entrer: () => {
      const copie = enregistrees.map((widget) => ({ ...widget }));
      setEmpreinte(JSON.stringify(serializeDisposition(copie)));
      setBrouillon(copie);
    },
    quitter: () => {
      setBrouillon(null);
    },
    enregistrer: () => {
      if (brouillon !== null) enregistrement.mutate(brouillon);
    },
    fixerParDefaut: () => {
      if (brouillon !== null) parDefaut.mutate(brouillon);
    },
    reinitialiser: () => {
      reinitialisation.mutate();
    },
    ajouter: (cle, marque) => {
      setBrouillon((courant) => [
        ...(courant ?? []),
        { id: `${cle}-${String(Date.now())}`, source: cle, marque },
      ]);
    },
  };
}
