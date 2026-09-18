'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';

import {
  ABSENT,
  Case,
  Champs,
  Grille,
  Liste,
  champsPlats,
  libelleOnglet,
  ongletsChargeUtile,
} from '@/components/enrolement/charge-utile';
import { QueryErrorState } from '@/components/query-error-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchInscriptionDetail, type InscriptionDetail, type Projet } from '@/lib/data/enrolement';
import { formatDateTime, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const CRM = 'crm';
const PLATEFORME = 'plateforme';

function texte(valeur: string | null, format?: (v: string) => string): string {
  if (valeur === null || valeur === '') return ABSENT;
  return format === undefined ? valeur : format(valeur);
}

function ficheProspect(projet: Projet, id: string): string {
  return `/teleconseil/prospects/${id}`;
}

function Normalise({
  detail,
  libelles,
}: {
  detail: InscriptionDetail;
  libelles: Map<string, string>;
}) {
  return (
    <Grille>
      <Case cle="Nom">{texte(detail.nom)}</Case>
      <Case cle="Prénom">{texte(detail.prenom)}</Case>
      <Case cle="Téléphone">
        {detail.phoneE164 === null ? ABSENT : formatPhone(detail.phoneE164)}
      </Case>
      <Case cle="Courriel">{texte(detail.email)}</Case>
      <Case cle="Statut">{libelles.get(detail.statutDistant) ?? detail.statutDistant}</Case>
      <Case cle="Motif négatif">{texte(detail.motifNegatif)}</Case>
      <Case cle="Étape">{detail.etapeDistante ?? ABSENT}</Case>
      <Case cle="Inscription">{texte(detail.inscriteLe, formatDateTime)}</Case>
      <Case cle="Dossier soumis">{texte(detail.soumiseLe, formatDateTime)}</Case>
      <Case cle="Décision">{texte(detail.decideeLe, formatDateTime)}</Case>
      <Case cle="Retirée de la plateforme">{texte(detail.disparueLe, formatDateTime)}</Case>
      <Case cle="Prospect du CRM">
        {detail.prospectId === null ? (
          'Non rapproché'
        ) : (
          <Link
            href={ficheProspect(detail.projet, detail.prospectId)}
            className="underline underline-offset-4"
          >
            Ouvrir la fiche
          </Link>
        )}
      </Case>
      <Case cle="Dernier tirage">{formatDateTime(detail.dernierTirageAt)}</Case>
      <Case cle="Projet">{detail.projet}</Case>
      <Case cle="Identifiant sur la plateforme">{detail.identifiantDistant}</Case>
      <Case cle="Identifiant dans le CRM">{detail.id}</Case>
    </Grille>
  );
}

function contenuOnglet(charge: unknown, cle: string): unknown {
  if (typeof charge !== 'object' || charge === null) return null;
  return (charge as Record<string, unknown>)[cle];
}

/** Un onglet par bloc de la charge utile : le dossier se parcourt, il ne se déroule pas. */
function Onglets({
  detail,
  libelles,
}: {
  detail: InscriptionDetail;
  libelles: Map<string, string>;
}) {
  const blocs = ongletsChargeUtile(detail.chargeUtile);

  return (
    <Tabs defaultValue={CRM}>
      <TabsList>
        <TabsTrigger value={CRM}>Inscription</TabsTrigger>
        <TabsTrigger value={PLATEFORME}>Plateforme</TabsTrigger>
        {blocs.map((bloc) => (
          <TabsTrigger key={bloc.cle} value={bloc.cle}>
            {libelleOnglet(bloc.cle, bloc.compte)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={CRM}>
        <Normalise detail={detail} libelles={libelles} />
      </TabsContent>

      <TabsContent value={PLATEFORME}>
        <Champs valeur={champsPlats(detail.chargeUtile)} />
      </TabsContent>

      {blocs.map((bloc) => {
        const valeur = contenuOnglet(detail.chargeUtile, bloc.cle);
        return (
          <TabsContent key={bloc.cle} value={bloc.cle}>
            {Array.isArray(valeur) ? <Liste elements={valeur} /> : <Champs valeur={valeur} />}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function Corps({
  etat,
  libelles,
}: {
  etat: UseQueryResult<InscriptionDetail>;
  libelles: Map<string, string>;
}) {
  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => void etat.refetch()}
        fallback="Le détail de cette inscription n’a pas pu être chargé."
      />
    );
  }
  if (etat.data === undefined) return <Skeleton className="h-64 w-full rounded-md" />;

  return <Onglets detail={etat.data} libelles={libelles} />;
}

export function DetailInscription({
  projet,
  id,
  libelles,
  onClose,
}: {
  projet: Projet;
  id: string | null;
  libelles: Map<string, string>;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: queryKeys.enrolementInscription(projet, id ?? ''),
    queryFn: () => fetchInscriptionDetail(projet, id ?? ''),
    enabled: id !== null,
  });

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {detail.data === undefined
              ? 'Inscription'
              : `${detail.data.prenom} ${detail.data.nom}`.trim()}
          </DialogTitle>
          <DialogDescription>
            Lecture seule. Rien de ce qui est affiché ici n’est écrit sur la plateforme.
          </DialogDescription>
        </DialogHeader>

        <Corps etat={detail} libelles={libelles} />
      </DialogContent>
    </Dialog>
  );
}
