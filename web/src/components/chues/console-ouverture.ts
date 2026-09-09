import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { fetchProspect, type Prospect } from '@/lib/data/console';
import { fetchOuvertureCourante, ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** La fiche et l'ouverture qui la verrouille. Nulle quand la fiche est close. */
export interface Ouverte {
  prospect: Prospect;
  ouverture: OuvertureFiche | null;
}

const aQualifier = (prospect: Prospect): boolean => prospect.phase2Status === 'PENDING';

/**
 * La fiche que le serveur tient encore, remise à l'écran telle quelle : au
 * montage elle répare un rechargement, sur refus d'ouverture elle dit laquelle
 * est tenue, que le serveur ne nomme pas.
 */
async function reprendreOuverte(
  reprendre: (prise: Ouverte) => void,
  refus: unknown,
): Promise<void> {
  const courante = await fetchOuvertureCourante();
  if (courante === null) {
    if (refus !== null) toastApiError(refus, 'La fiche n’a pas pu être ouverte.');
    return;
  }
  if (courante.prospectId === null) {
    toast.error(
      `Vous avez ${courante.ficheNom} en main sur « Qualifier un représentant ». Qualifiez-la avant d’ouvrir une fiche ici.`,
    );
    return;
  }
  const prospect = await fetchProspect(courante.prospectId).catch(() => null);
  if (prospect === null) {
    toast.error(`Vous avez déjà ${courante.ficheNom} en main. Qualifiez-la avant d’en ouvrir une.`);
    return;
  }
  toast.info(`Vous aviez déjà ${courante.ficheNom} en main : la voici.`);
  reprendre({ prospect, ouverture: courante });
}

interface FicheDuLien {
  readonly cible: Prospect | null;
  readonly close: Prospect | null;
}

/** Ce que `?fiche=` a rendu : à qualifier d'un côté, close de l'autre. */
function ficheDuLien(demandee: string | null, lue: Prospect | undefined): FicheDuLien {
  if (demandee === null || lue === undefined) return { cible: null, close: null };
  if (aQualifier(lue)) return { cible: lue, close: null };
  return { cible: null, close: lue };
}

export interface FicheEnMain {
  readonly consultee: Ouverte | null;
  readonly aConfirmer: Prospect | null;
  readonly lienEnCours: boolean;
  readonly lienEnEchec: boolean;
  readonly ouvertureEnCours: boolean;
  readonly annuaireActif: boolean;
  readonly choisir: (prospect: Prospect) => void;
  readonly confirmer: (prospect: Prospect) => void;
  readonly abandonner: () => void;
  readonly revenir: () => void;
}

/**
 * Qui l'appelant a en main : la fiche visée par `?fiche=`, celle qu'il vient de
 * choisir, ou celle que le serveur tenait encore avant le rechargement.
 */
export function useFicheEnMain(fiche: string | null): FicheEnMain {
  const queryClient = useQueryClient();

  const [ouverte, setOuverte] = useState<Ouverte | null>(null);
  const [vise, setVise] = useState<Prospect | null>(null);
  const [demandee, setDemandee] = useState<string | null>(fiche);

  const attendue = demandee ?? '';
  const parLien = useQuery({
    queryKey: queryKeys.prospect(attendue),
    queryFn: () => fetchProspect(attendue),
    enabled: demandee !== null,
    retry: false,
  });

  const venue = ficheDuLien(demandee, parLien.data);

  const revenir = useCallback(() => {
    setOuverte(null);
    setVise(null);
    setDemandee(null);
  }, []);

  const reprendre = useCallback((prise: Ouverte) => {
    setVise(null);
    setDemandee(null);
    setOuverte(prise);
  }, []);

  // Le verrou vit sur le serveur, l'écran non : sans cette reprise, un
  // rechargement laisse l'appelant devant l'annuaire alors que sa fiche est tenue.
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (repriseFaite.current) return;
    repriseFaite.current = true;
    void reprendreOuverte(reprendre, null);
  }, [reprendre]);

  const ouvrir = useMutation({
    mutationFn: async (ligne: Prospect): Promise<Ouverte> => ({
      prospect: ligne,
      ouverture: await ouvrirFiche({ prospectId: ligne.id }),
    }),
    onSuccess: (prise) => {
      reprendre(prise);
      queryClient.setQueryData(queryKeys.ouvertureCourante, prise.ouverture);
    },
    onError: (error) => {
      void reprendreOuverte(reprendre, error);
    },
  });

  const aConfirmer = vise ?? venue.cible;
  // Une fiche close ne peut plus recevoir de statut : l'ouvrir sous verrou y
  // enfermerait l'appelant. Elle se consulte, elle ne se compte pas.
  const consultee =
    ouverte ?? (venue.close === null ? null : { prospect: venue.close, ouverture: null });

  const choisir = useCallback((prospect: Prospect) => {
    if (aQualifier(prospect)) setVise(prospect);
    else setOuverte({ prospect, ouverture: null });
  }, []);

  const abandonner = useCallback(() => {
    setVise(null);
    setDemandee(null);
  }, []);

  const parLienActif = demandee !== null;

  return {
    consultee,
    aConfirmer,
    lienEnCours: parLienActif && parLien.isPending,
    lienEnEchec: parLienActif && parLien.isError,
    ouvertureEnCours: ouvrir.isPending,
    annuaireActif: consultee === null && aConfirmer === null,
    choisir,
    confirmer: ouvrir.mutate,
    abandonner,
    revenir,
  };
}
