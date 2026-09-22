'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { DetailBackLink } from '@/components/detail-back-link';
import { FicheEnTete, type ChiffreDeFiche } from '@/components/fiche-en-tete';
import { Champ } from '@/components/historique/historique';
import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
import { EtiquettesStatut } from '@/components/prospects/etiquettes-statut';
import { AffecterFiche } from '@/components/prospects/affecter-fiche';
import { MethodeFiche } from '@/components/prospects/methode-fiche';
import { RequalifierFiche } from '@/components/prospects/requalifier-fiche';
import { SuiviRendezVous, SuiviRendezVousBadges } from '@/components/prospects/suivi-rendez-vous';
import {
  HistoireDeLaFiche,
  NO_VALUE,
  ouVide,
  voitLeSegment,
} from '@/components/prospects/histoire-fiche';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import { fetchProspect, marquerProspectRevue, marquerProspectVendu } from '@/lib/data/prospects';
import { formatDate, formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  peut,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  peutRevoirUneDemande,
  peutTenirUneFiche,
  type ProspectRow,
  type Role,
  type SessionUser,
} from '@/lib/types';

export function chiffresDe(prospect: ProspectRow): ChiffreDeFiche[] {
  const dernierPar = prospect.lastCallByName === null ? '' : ` · ${prospect.lastCallByName}`;
  return [
    {
      label: 'Appels consignés',
      valeur: formatNumber(prospect.callAttemptCount),
      precision:
        prospect.lastReasonLabel === null
          ? 'Jamais appelé'
          : `Dernier : ${prospect.lastReasonLabel}`,
    },
    {
      label: 'Dernier appel',
      valeur: prospect.lastCallAt === null ? NO_VALUE : formatDate(prospect.lastCallAt),
      precision:
        prospect.lastCallAt === null ? null : `${formatDateTime(prospect.lastCallAt)}${dernierPar}`,
    },
    {
      label: 'À revoir',
      valeur: prospect.aRevoirAt === null ? 'Aucun' : formatDate(prospect.aRevoirAt),
      precision: prospect.aRevoirAt === null ? null : formatDateTime(prospect.aRevoirAt),
    },
  ];
}

/** La fiche CHUES telle que les téléconseillers l'ont remplie, et tout ce qui lui est arrivé depuis. */
export function ProspectDetailView({ prospectId, role }: { prospectId: string; role: Role }) {
  const { data: user } = useQuery(meQueryOptions);
  const fiche = useQuery({
    queryKey: queryKeys.prospect(prospectId),
    queryFn: () => fetchProspect(prospectId),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/teleconseil/prospects">Tous les prospects</DetailBackLink>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/teleconseil/prospects">Tous les prospects</DetailBackLink>
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

  const prospect: ProspectRow = fiche.data;

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/teleconseil/prospects">Tous les prospects</DetailBackLink>

      <FicheEnTete
        nom={`${prospect.prenom} ${prospect.nom}`}
        phoneE164={prospect.phoneE164}
        projet={prospect.projet}
        badges={
          <>
            <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
            <EtiquettesStatut prospect={prospect} />
            <RevueDemande prospect={prospect} user={user} />
            <SuiviRendezVousBadges prospect={prospect} />
          </>
        }
        actions={
          <>
            {peutTenirUneFiche(user) ? (
              <Link
                href={`/teleconseil/console?fiche=${encodeURIComponent(prospect.id)}`}
                className={buttonVariants({ variant: 'default' })}
              >
                <PhoneCallIcon aria-hidden="true" />
                Consigner un appel
              </Link>
            ) : null}
            <BoutonWhatsApp prospect={prospect} />
            <RequalifierFiche prospect={prospect} projet="CHUES" statut={prospect.statut} />
            <AffecterFiche
              cible="prospect"
              id={prospect.id}
              nom={`${prospect.prenom} ${prospect.nom}`}
              titulaireId={prospect.ownedByCommercialId}
            />
            <SuiviRendezVous prospect={prospect} />
            <MarquerVendu prospect={prospect} user={user} />
          </>
        }
        chiffres={chiffresDe(prospect)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <HistoireDeLaFiche prospect={prospect} role={role} />

        <div className="flex min-w-0 flex-col gap-6">
          <FicheProspect prospect={prospect} role={role} />
          <ChampsAjoutes prospect={prospect} />
        </div>
      </div>
    </div>
  );
}

function FicheProspect({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-[0.875rem]">
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Qui il est</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="WhatsApp">
              {prospect.whatsappNumber === null ? NO_VALUE : formatPhone(prospect.whatsappNumber)}
            </Champ>
            <Champ label="Profession">{ouVide(prospect.profession)}</Champ>
            <Champ label="Établissement">{ouVide(prospect.etablissement)}</Champ>
            <Champ label="Département">{ouVide(prospect.departementName)}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Banque et syndicat</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Banque">{ouVide(prospect.banqueName)}</Champ>
            <Champ label="Syndicat">{ouVide(prospect.syndicatSigle)}</Champ>
            {voitLeSegment(role) ? (
              <Champ label="Segment">
                {prospect.segment === null ? NO_VALUE : SEGMENT_LABELS[prospect.segment]}
              </Champ>
            ) : null}
            <Champ label="Méthode d’enrôlement">
              <MethodeFiche prospect={prospect} vide={NO_VALUE} />
            </Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Qui s’en occupe</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Téléconseiller">{prospect.ownedByCommercialName}</Champ>
            <Champ label="Saisi le">{formatDate(prospect.clientCreatedAt)}</Champ>
            <Champ label="Représentant">{ouVide(prospect.representantName)}</Champ>
            {prospect.remarqueImport == null ? null : (
              <Champ label="Note du classeur">{prospect.remarqueImport}</Champ>
            )}
          </dl>
          {prospect.representantId === null ? null : (
            <Link
              href={`/teleconseil/representants/${prospect.representantId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
            >
              <ExternalLinkIcon aria-hidden="true" />
              Ouvrir la fiche du représentant
            </Link>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** Les réponses aux champs que l'administrateur a ajoutés au formulaire. Sans réponse, rien. */
function ChampsAjoutes({ prospect }: { prospect: ProspectRow }) {
  const formulaire = useChampsConversion(prospect.projet);
  const renseignes = formulaire.libres.filter(
    (champ) => (prospect.champsLibres[champ.id] ?? '') !== '',
  );
  if (renseignes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Champs ajoutés</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-[0.875rem] sm:grid-cols-2">
          {renseignes.map((champ) => (
            <Champ key={champ.id} label={champ.libelle}>
              {prospect.champsLibres[champ.id]}
            </Champ>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** La revue du closing : rien tant que la demande n'est pas convertie. */
function RevueDemande({
  prospect,
  user,
}: {
  prospect: ProspectRow;
  user: SessionUser | null | undefined;
}) {
  const queryClient = useQueryClient();
  const revue = useMutation({
    mutationFn: () => marquerProspectRevue(prospect.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Demande revue.');
    },
    onError: (error) => {
      toastApiError(error, 'La revue n’a pas pu être enregistrée.');
    },
  });

  if (prospect.statut !== 'CONVERTI') return null;

  if (prospect.revueAt !== null) {
    return (
      <Badge variant="success">
        Revue le {formatDate(prospect.revueAt)}
        {prospect.revueByName === null ? '' : ` par ${prospect.revueByName}`}
      </Badge>
    );
  }

  return (
    <>
      <Badge variant="warning">Demande non revue</Badge>
      {peutRevoirUneDemande(user) ? (
        <Button
          size="sm"
          disabled={revue.isPending}
          onClick={() => {
            revue.mutate();
          }}
        >
          Marquer revue
        </Button>
      ) : null}
    </>
  );
}

/** La confirmation de la vente : rien tant que la demande n'est pas convertie. */
function MarquerVendu({
  prospect,
  user,
}: {
  prospect: ProspectRow;
  user: SessionUser | null | undefined;
}) {
  const queryClient = useQueryClient();
  const vente = useMutation({
    mutationFn: () => marquerProspectVendu(prospect.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Fiche marquée vendue.');
    },
    onError: (error) => {
      toastApiError(error, 'La fiche n’a pas pu être marquée vendue.');
    },
  });

  if (prospect.statut !== 'CONVERTI' || !peut(user, 'prospects.convertir')) return null;

  return (
    <Button
      variant="outline"
      disabled={vente.isPending}
      onClick={() => {
        vente.mutate();
      }}
    >
      Marquer vendu
    </Button>
  );
}
