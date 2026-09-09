import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useDebouncedValue, useVerrouFiches } from '@/components/chues/hooks';
import { CriteresAnnuaire, DialogueOuverture, Pagination } from '@/components/chues/rep-criteres';
import { Resultats } from '@/components/chues/rep-liste';
import { Qualification } from '@/components/chues/rep-qualification';
import type { RelationRepresentant } from '@/components/representants/filtres';
import { fetchOuvertureCourante, ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import {
  fetchRepresentant,
  fetchRepresentantsAQualifier,
  type Representant,
} from '@/lib/data/representants';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** La fiche ouverte et l'ouverture qui la verrouille : les deux vont ensemble. */
interface Ouverte {
  representant: Representant;
  ouverture: OuvertureFiche;
}

/**
 * La fiche que le serveur tient encore, remise à l'écran telle quelle : au
 * montage elle répare un rechargement, sur refus d'ouverture elle dit laquelle
 * est tenue, que le serveur ne nomme pas.
 */
async function reprendreOuverte(
  reprendre: (ouverte: Ouverte) => void,
  refus: unknown = null,
): Promise<void> {
  const courante = await fetchOuvertureCourante();
  if (courante === null) {
    if (refus !== null) toastApiError(refus, 'La fiche n’a pas pu être ouverte.');
    return;
  }
  if (courante.representantId === null) {
    toast.error(
      `Vous avez ${courante.ficheNom} en main sur « Convertir un prospect ». Consignez l’appel avant d’ouvrir une fiche ici.`,
    );
    return;
  }
  const representant = await fetchRepresentant(courante.representantId).catch(() => null);
  if (representant === null) {
    toast.error(`Vous avez déjà ${courante.ficheNom} en main. Qualifiez-la avant d’en ouvrir une.`);
    return;
  }
  toast.info(`Vous aviez déjà ${courante.ficheNom} en main : la voici.`);
  reprendre({ representant, ouverture: courante });
}

/**
 * Étape 1 : qualifier un représentant, dans l'ordre et les mots de
 * l'application mobile. La qualification ne part au serveur qu'à
 * « Enregistrer », en UNE tentative : chaque réponse reste modifiable.
 */
export function RepAnnuaire() {
  const queryClient = useQueryClient();
  const verrouActif = useVerrouFiches();

  const [choisi, setChoisi] = useState<Ouverte | null>(null);
  const [aConfirmer, setAConfirmer] = useState<Representant | null>(null);
  const [search, setSearch] = useState('');
  const [relation, setRelation] = useState<RelationRepresentant | null>(null);
  const [page, setPage] = useState(1);
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const annuaire = useQuery({
    queryKey: queryKeys.representantsAQualifier({ cherche, relation, page }),
    queryFn: () =>
      fetchRepresentantsAQualifier({ search: cherche, relationStatus: relation, page }),
    enabled: choisi === null,
    placeholderData: (precedent) => precedent,
  });

  const reprendre = useCallback((ouverte: Ouverte) => {
    setAConfirmer(null);
    setChoisi(ouverte);
  }, []);

  // Le verrou vit sur le serveur, l'écran non. Sans cette reprise, un
  // rechargement laisse le téléconseiller devant l'annuaire alors que sa fiche
  // est toujours tenue.
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (repriseFaite.current) return;
    repriseFaite.current = true;
    void reprendreOuverte(reprendre);
  }, [reprendre]);

  const ouvrir = useMutation({
    mutationFn: async (ligne: Representant): Promise<Ouverte> => ({
      representant: ligne,
      ouverture: await ouvrirFiche({ representantId: ligne.id }),
    }),
    onSuccess: (ouverte) => {
      setConfirme(null);
      setAConfirmer(null);
      setChoisi(ouverte);
      queryClient.setQueryData(queryKeys.ouvertureCourante, ouverte.ouverture);
    },
    onError: (error) => {
      void reprendreOuverte(reprendre, error);
    },
  });

  if (choisi !== null) {
    return (
      <Qualification
        key={choisi.ouverture.id}
        representant={choisi.representant}
        ouverture={choisi.ouverture}
        verrouActif={verrouActif}
        onAbandon={() => {
          setChoisi(null);
        }}
        onEnregistre={(nom) => {
          setConfirme(nom);
          setChoisi(null);
          // La tentative a fermé l'ouverture : la barre supérieure lit ce cache
          // pour refuser la déconnexion, et le laisser périmé l'y enfermerait.
          queryClient.setQueryData(queryKeys.ouvertureCourante, null);
          void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {confirme === null ? null : (
        <p role="status" className="text-[0.875rem] font-[600] text-accent-text">
          Appel enregistré pour {confirme}.
        </p>
      )}

      <CriteresAnnuaire
        search={search}
        relation={relation}
        onSearch={(valeur) => {
          setSearch(valeur);
          setPage(1);
        }}
        onRelation={(valeur) => {
          setRelation(valeur);
          setPage(1);
        }}
      />

      <Resultats
        annuaire={annuaire}
        critereEnCours={cherche !== '' || relation !== null}
        onOuvrir={setAConfirmer}
      />

      <Pagination page={page} pageCount={annuaire.data?.pageCount ?? 1} onPage={setPage} />

      <DialogueOuverture
        cible={aConfirmer}
        verrouActif={verrouActif}
        pending={ouvrir.isPending}
        onFermer={() => {
          setAConfirmer(null);
        }}
        onConfirmer={ouvrir.mutate}
      />
    </div>
  );
}
