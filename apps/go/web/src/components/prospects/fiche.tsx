import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import { SEGMENT_LABELS } from '@/components/campagnes/cibles';
import { LIBELLES_METHODE } from '@/components/chues/conversion-champs';
import { FicheEnTete, LienRetour, type ChiffreDeFiche } from '@/components/fiche-en-tete';
import type { EvenementHistorique } from '@/components/historique/evenement';
import { CarteHistoire, Champ, Historique } from '@/components/historique/historique';
import {
  evenementAppel,
  evenementCreation,
  evenementsDeLaFiche,
} from '@/components/prospects/fiche-evenements';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CALL_OUTCOME_LABELS, fetchProspect, PHASE2_STATUS_LABELS } from '@/lib/data/console';
import { PROSPECT_STATUT_LABELS } from '@/lib/data/grand-public';
import { fetchAppelsProspect, marquerProspectRevue, type Prospect } from '@/lib/data/prospects';
import { formatDate, formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, Role } from '@/lib/types';

const SANS_VALEUR = '–';

/** La revue du closing appartient à l'encadrement, pas à qui a converti. */
const REVISEURS: readonly Role[] = ['ADMIN', 'SUPERVISEUR', 'DIRECTION', 'CHARGE_CLIENTELE'];

function ouVide(valeur: string | null): string {
  return valeur === null || valeur === '' ? SANS_VALEUR : valeur;
}

function chiffresDe(prospect: Prospect): ChiffreDeFiche[] {
  const par = prospect.lastCallByName === null ? '' : ` · ${prospect.lastCallByName}`;
  const derniere = prospect.lastCallOutcome;
  return [
    {
      label: 'Appels consignés',
      valeur: formatNumber(prospect.callAttemptCount),
      precision:
        derniere === null
          ? 'Jamais appelé'
          : `Dernier : ${CALL_OUTCOME_LABELS[derniere as keyof typeof CALL_OUTCOME_LABELS] ?? derniere}`,
    },
    {
      label: 'Dernier appel',
      valeur: prospect.lastCallAt === null ? SANS_VALEUR : formatDate(prospect.lastCallAt),
      precision:
        prospect.lastCallAt === null ? null : `${formatDateTime(prospect.lastCallAt)}${par}`,
    },
    {
      label: 'À revoir',
      valeur: prospect.aRevoirAt === null ? 'Aucun' : formatDate(prospect.aRevoirAt),
      precision: prospect.aRevoirAt === null ? null : formatDateTime(prospect.aRevoirAt),
    },
  ];
}

function Revue({ prospect, role }: { prospect: Prospect; role: Role }) {
  const queryClient = useQueryClient();
  const revoir = useMutation({
    mutationFn: () => marquerProspectRevue(prospect.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Demande revue.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La revue n’a pas pu être enregistrée.');
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
      {REVISEURS.includes(role) ? (
        <Button
          size="sm"
          disabled={revoir.isPending}
          onClick={() => {
            revoir.mutate();
          }}
        >
          Marquer revue
        </Button>
      ) : null}
    </>
  );
}

function CarteFiche({ projet, prospect }: { projet: Projet; prospect: Prospect }) {
  const methode = prospect.enrollmentMethod;
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
              {prospect.whatsappNumber === null
                ? SANS_VALEUR
                : formatPhone(prospect.whatsappNumber)}
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
            <Champ label="Segment">
              {prospect.segment === null
                ? SANS_VALEUR
                : SEGMENT_LABELS[prospect.segment as keyof typeof SEGMENT_LABELS]}
            </Champ>
            <Champ label="Méthode d’enrôlement">
              {methode === null
                ? SANS_VALEUR
                : (LIBELLES_METHODE[methode as keyof typeof LIBELLES_METHODE] ?? methode)}
            </Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Qui s’en occupe</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Téléconseiller">{prospect.ownedByCommercialName}</Champ>
            <Champ label="Saisi le">{formatDate(prospect.clientCreatedAt)}</Champ>
            <Champ label="Représentant">{ouVide(prospect.representantName)}</Champ>
          </dl>
          {prospect.representantId === null ? null : (
            <Link
              {...lien(`/${projet}/representants/${prospect.representantId}`)}
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

export function FicheProspect({
  projet,
  prospectId,
  role,
}: {
  projet: Projet;
  prospectId: string;
  role: Role;
}) {
  const retour = `/${projet}/prospects`;

  const fiche = useQuery({
    queryKey: queryKeys.prospect(prospectId),
    queryFn: () => fetchProspect(prospectId),
  });
  const appels = useQuery({
    queryKey: [...queryKeys.prospect(prospectId), 'call-attempts'],
    queryFn: () => fetchAppelsProspect(prospectId),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <LienRetour href={retour}>Tous les prospects</LienRetour>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <LienRetour href={retour}>Tous les prospects</LienRetour>
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

  const prospect = fiche.data;
  const evenements: EvenementHistorique[] = [
    evenementCreation(projet, prospect),
    ...evenementsDeLaFiche(prospect),
    ...(appels.data ?? []).map(evenementAppel),
  ];

  return (
    <div className="flex flex-col gap-6">
      <LienRetour href={retour}>Tous les prospects</LienRetour>

      <FicheEnTete
        nom={`${prospect.prenom} ${prospect.nom}`}
        phoneE164={prospect.phoneE164}
        badges={
          <>
            <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
            <Badge variant="secondary">{PHASE2_STATUS_LABELS[prospect.phase2Status]}</Badge>
            <Revue prospect={prospect} role={role} />
          </>
        }
        chiffres={chiffresDe(prospect)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CarteHistoire
          titre="Histoire de la fiche"
          description="Chaque appel et chaque bascule, du plus récent au plus ancien. Cliquez une ligne pour tout voir."
          sources={[appels]}
        >
          <Historique
            evenements={evenements}
            categories={['appel', 'statut', 'fiche']}
            vide="Rien ne s’est encore passé sur cette fiche. Le premier appel consigné ouvre l’histoire."
            videParCategorie={{
              appel: 'Aucun appel consigné. Le premier se note depuis la console.',
              statut: 'Aucune bascule enregistrée. Ni méthode obtenue, ni revue.',
            }}
          />
        </CarteHistoire>

        <CarteFiche projet={projet} prospect={prospect} />
      </div>
    </div>
  );
}
