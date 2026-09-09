import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FicheEnTete, LienRetour, type ChiffreDeFiche } from '@/components/fiche-en-tete';
import type { EvenementHistorique } from '@/components/historique/evenement';
import { CarteHistoire, Historique } from '@/components/historique/historique';
import { FILTRES_VIDES } from '@/components/prospects/filtres';
import { QueryErrorState } from '@/components/query-error-state';
import {
  ComposeurFil,
  DialogueSuppressionCommentaire,
} from '@/components/representants/commentaires';
import {
  evenementAppel,
  evenementBascule,
  evenementCommentaire,
  evenementCreation,
  evenementVersion,
} from '@/components/representants/fiche-evenements';
import { CarteFiche, ProspectsApportes } from '@/components/representants/fiche-cartes';
import { PastilleRelation } from '@/components/representants/pastille-relation';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspects } from '@/lib/data/prospects';
import {
  cleCommentaires,
  fetchAppelsRepresentant,
  fetchBasculesRelation,
  fetchCommentaires,
  fetchRepresentant,
  fetchVersionsFiche,
  type CommentaireRepresentant,
  type Representant,
} from '@/lib/data/representants';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, SessionUser } from '@/lib/types';

function chiffresDe(representant: Representant): ChiffreDeFiche[] {
  return [
    {
      label: 'Prospects apportés',
      valeur: formatNumber(representant.prospectCount),
      precision: 'sur la dizaine attendue',
    },
    {
      label: 'Appels consignés',
      valeur: formatNumber(representant.callAttemptCount),
      precision:
        representant.lastCallAt === null
          ? 'Jamais appelé'
          : `Dernier le ${formatDateTime(representant.lastCallAt)}`,
    },
    {
      label: 'Prochain rappel',
      valeur:
        representant.nextCallbackAt === null ? 'Aucun' : formatDate(representant.nextCallbackAt),
      precision:
        representant.nextCallbackAt === null ? null : formatDateTime(representant.nextCallbackAt),
    },
  ];
}

export function FicheRepresentant({
  projet,
  representantId,
  utilisateur,
  peutAdministrer = false,
  lectureSeule = false,
}: {
  projet: Projet;
  representantId: string;
  utilisateur: SessionUser;
  peutAdministrer?: boolean;
  lectureSeule?: boolean;
}) {
  const [aSupprimer, setASupprimer] = useState<CommentaireRepresentant | null>(null);
  const retour = `/${projet}/representants`;

  const fiche = useQuery({
    queryKey: queryKeys.representant(representantId),
    queryFn: () => fetchRepresentant(representantId),
  });
  const appels = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'call-attempts'],
    queryFn: () => fetchAppelsRepresentant(representantId),
  });
  const bascules = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'relation-history'],
    queryFn: () => fetchBasculesRelation(representantId),
  });
  const versions = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'fiche-history'],
    queryFn: () => fetchVersionsFiche(representantId),
  });
  const fil = useQuery({
    queryKey: cleCommentaires(representantId),
    queryFn: () => fetchCommentaires(representantId),
  });
  const filtresProspects = { ...FILTRES_VIDES, representantId };
  const prospects = useQuery({
    queryKey: queryKeys.prospects(filtresProspects),
    queryFn: () => fetchProspects(filtresProspects),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <LienRetour href={retour}>Tous les représentants</LienRetour>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <LienRetour href={retour}>Tous les représentants</LienRetour>
        <QueryErrorState
          error={fiche.error}
          onRetry={() => {
            void fiche.refetch();
          }}
          fallback="Cette fiche n’a pas pu être chargée."
        />
      </div>
    );
  }

  const representant = fiche.data;
  const evenements: EvenementHistorique[] = [
    evenementCreation(representant),
    ...(versions.data ?? []).map(evenementVersion),
    ...(appels.data ?? []).map(evenementAppel),
    ...(bascules.data ?? []).map(evenementBascule),
    ...(fil.data ?? []).map((commentaire) =>
      evenementCommentaire(
        commentaire,
        peutAdministrer
          ? () => {
              setASupprimer(commentaire);
            }
          : null,
      ),
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <LienRetour href={retour}>Tous les représentants</LienRetour>

      <FicheEnTete
        nom={representant.fullName}
        complement={representant.prenom}
        phoneE164={representant.phoneE164}
        badges={
          <PastilleRelation
            status={representant.relationStatus}
            label={representant.statutQualificationLabel}
            effect={representant.statutQualificationEffect}
            lastCallOutcome={representant.lastCallOutcome}
          />
        }
        chiffres={chiffresDe(representant)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CarteHistoire
          titre="Histoire de la relation"
          description="Chaque appel, chaque version du formulaire, chaque bascule et chaque commentaire, du plus récent au plus ancien. Cliquez une ligne pour tout voir."
          sources={[appels, bascules, versions, fil]}
        >
          <Historique
            evenements={evenements}
            categories={['appel', 'statut', 'fil', 'fiche']}
            enTete={
              lectureSeule ? null : (
                <ComposeurFil representantId={representantId} auteur={utilisateur} />
              )
            }
            vide="Rien ne s’est encore passé sur cette fiche. Le premier appel consigné ouvre l’histoire."
            videParCategorie={{
              appel: 'Aucun appel consigné. Le premier se note depuis la console.',
              statut:
                'Aucune bascule enregistrée. Le statut se pose en consignant un appel, ou en modifiant la fiche.',
              fil: 'Rien dans le fil. Le premier commentaire dit d’où part la relation.',
              fiche: 'Aucune version du formulaire enregistrée depuis la mise en place du journal.',
            }}
          />
        </CarteHistoire>

        <div className="flex min-w-0 flex-col gap-6">
          <CarteFiche representant={representant} />
          <ProspectsApportes projet={projet} prospects={prospects} />
        </div>
      </div>

      <DialogueSuppressionCommentaire
        representantId={representantId}
        commentaire={aSupprimer}
        onClose={() => {
          setASupprimer(null);
        }}
      />
    </div>
  );
}
