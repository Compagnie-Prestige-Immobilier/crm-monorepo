import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import type { Choisies } from '@/components/accueil/import-revue';
import {
  appliquerRegistre,
  choisirLignesRegistre,
  deposerRegistre,
  differences,
  fetchRevueRegistre,
  fetchTravailRegistre,
  TAILLE_MAX_OCTETS,
  type ChangementRegistre,
  type TravailRegistre,
} from '@/lib/data/visites-import';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function pas(choisies: Choisies, kind: ChangementRegistre['kind'], delta: number): Choisies {
  if (kind === 'CREATE') return { ...choisies, creations: choisies.creations + delta };
  return { ...choisies, corrections: choisies.corrections + delta };
}

const AUCUNE: Choisies = { creations: 0, corrections: 0 };

function empreinteDe(travail: TravailRegistre | undefined): string {
  if (travail === undefined) return '';
  return `${travail.id}:${travail.updatedAt}`;
}

function rapportDuServeur(travail: TravailRegistre | undefined): Choisies {
  if (travail === undefined) return AUCUNE;
  return { creations: travail.createdRows, corrections: travail.updatedRows };
}

function estEnRevue(travail: TravailRegistre | undefined): boolean {
  if (travail === undefined || travail.status !== 'succeeded') return false;
  return travail.mode === 'DRY_RUN' && differences(travail) > 0;
}

/**
 * Le serveur pré-coche tout à la détection : le compteur repart de son rapport,
 * ajusté pendant le rendu à l'arrivée d'un nouveau dépôt.
 */
function useChoisies(travail: TravailRegistre | undefined) {
  const [choisies, setChoisies] = useState<Choisies>(AUCUNE);
  const [connu, setConnu] = useState('');
  const empreinte = empreinteDe(travail);

  if (empreinte !== connu) {
    setConnu(empreinte);
    setChoisies(rapportDuServeur(travail));
  }

  return { choisies, setChoisies };
}

/** Dépôt, revue et application d'un classeur de registre, d'un seul tenant. */
export function useImportRegistre() {
  const queryClient = useQueryClient();
  const [travailId, setTravailId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const cle = travailId ?? '';

  const travailQuery = useQuery({
    queryKey: queryKeys.visitesImport(cle),
    queryFn: () => fetchTravailRegistre(cle),
    enabled: travailId !== null,
  });

  const travail = travailQuery.data;
  const enRevue = estEnRevue(travail);
  const { choisies, setChoisies } = useChoisies(travail);

  const revueQuery = useQuery({
    queryKey: queryKeys.visitesImportRevue(cle, page),
    queryFn: () => fetchRevueRegistre(cle, page),
    enabled: travailId !== null && enRevue,
    placeholderData: keepPreviousData,
  });

  const rafraichirRevue = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.visitesImportRevue(cle, page) });
  };

  const deposer = useMutation({
    mutationFn: (fichier: File) => deposerRegistre(fichier),
    onSuccess: (cree) => {
      queryClient.setQueryData(queryKeys.visitesImport(cree.id), cree);
      setTravailId(cree.id);
      setPage(1);
    },
    onError: (error) => {
      toastApiError(error, 'Le classeur n’a pas pu être déposé.');
    },
  });

  const basculer = useMutation({
    mutationFn: (cible: { changement: ChangementRegistre; choisie: boolean }) =>
      choisirLignesRegistre(cle, [cible.changement.id], cible.choisie),
    onMutate: (cible) => {
      setChoisies((courant) => pas(courant, cible.changement.kind, cible.choisie ? 1 : -1));
    },
    onError: (error, cible) => {
      setChoisies((courant) => pas(courant, cible.changement.kind, cible.choisie ? -1 : 1));
      toastApiError(error, 'La sélection n’a pas pu être enregistrée.');
    },
    onSettled: rafraichirRevue,
  });

  // Le serveur n'a pas de raccourci « tout » : une page unique liste les
  // identifiants, puis une seule requête les coche.
  const toutCocher = useMutation({
    mutationFn: async (choisie: boolean) => {
      if (travail === undefined) return;
      const tout = await fetchRevueRegistre(travail.id, 1, Math.max(1, differences(travail)));
      const ids = tout.items.map((item) => item.id);
      await choisirLignesRegistre(travail.id, ids, choisie);
    },
    onSuccess: (_vide, choisie) => {
      setChoisies(choisie ? rapportDuServeur(travail) : AUCUNE);
      rafraichirRevue();
    },
    onError: (error) => {
      toastApiError(error, 'La sélection n’a pas pu être enregistrée.');
    },
  });

  const appliquer = useMutation({
    mutationFn: (id: string) => appliquerRegistre(id),
    onSuccess: (applique) => {
      queryClient.setQueryData(queryKeys.visitesImport(applique.id), applique);
      void queryClient.invalidateQueries({ queryKey: queryKeys.visitesRoot });
      toast.success('Import appliqué au registre.');
    },
    onError: (error) => {
      toastApiError(error, 'L’import n’a pas pu être appliqué.');
    },
  });

  function accepter(candidat: File | null): void {
    if (candidat === null) return;
    if (candidat.size > TAILLE_MAX_OCTETS) {
      toast.error('Fichier trop volumineux : 25 Mo au maximum.');
      return;
    }
    deposer.mutate(candidat);
  }

  return {
    travail,
    travailQuery,
    revueQuery,
    enRevue,
    choisies,
    page,
    setPage,
    deposer,
    basculer,
    toutCocher,
    appliquer,
    accepter,
    recommencer: () => {
      setTravailId(null);
      setPage(1);
    },
  };
}
