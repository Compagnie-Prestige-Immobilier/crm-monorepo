import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PhoneCallIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EtatVide } from '@/components/chues/console-ui';
import { FiltreTeleconseiller } from '@/components/chues/filtre-teleconseiller';
import { ListeResponsive, type Colonne } from '@/components/chues/liste-responsive';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  annulerRappel,
  fetchRappels,
  formatCallbackAt,
  formatDelay,
  type Rappel,
  type RappelScope,
} from '@/lib/data/callbacks';
import { formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';

const PORTEES: readonly { value: RappelScope; label: string }[] = [
  { value: 'overdue', label: 'En retard' },
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'week', label: 'Cette semaine' },
];

const VIDE: Record<RappelScope, { titre: string; description: string }> = {
  overdue: { titre: 'Aucun rappel en retard', description: 'Les échéances promises sont tenues.' },
  today: {
    titre: 'Aucun rappel aujourd’hui',
    description: 'Une échéance se promet en consignant un appel.',
  },
  week: {
    titre: 'Aucun rappel cette semaine',
    description: 'Une échéance se promet en consignant un appel.',
  },
};

function Retard({ rappel, serverTime }: { rappel: Rappel; serverTime: number }) {
  if (!rappel.overdue) return <span className="text-muted-foreground">Sans objet</span>;
  return (
    <Badge variant="destructive">{formatDelay(serverTime - Date.parse(rappel.scheduledAt))}</Badge>
  );
}

/** L'heure de référence vient du SERVEUR : l'horloge du poste peut dériver. */
function colonnes(serverTime: number, peutFiltrer: boolean): Colonne<Rappel>[] {
  const base: Colonne<Rappel>[] = [
    {
      cle: 'prospect',
      entete: 'Prospect',
      titre: true,
      cellule: (rappel) => (
        <>
          <span className="font-[600] tabular-nums">{formatPhone(rappel.phoneE164)}</span>
          <span className="block text-[0.75rem] font-[400] text-muted-foreground">
            Fiche {rappel.shortCode}
          </span>
        </>
      ),
    },
    {
      cle: 'echeance',
      entete: 'Échéance',
      cellule: (rappel) => (
        <time dateTime={rappel.scheduledAt}>
          {formatCallbackAt(rappel.scheduledAt, serverTime)}
        </time>
      ),
    },
    {
      cle: 'retard',
      entete: 'Retard',
      cellule: (rappel) => <Retard rappel={rappel} serverTime={serverTime} />,
    },
    { cle: 'commentaire', entete: 'Commentaire', cellule: (rappel) => rappel.comment ?? '' },
  ];
  if (!peutFiltrer) return base;
  return [
    ...base,
    { cle: 'teleconseiller', entete: 'Téléconseiller', cellule: (rappel) => rappel.assignedToName },
  ];
}

export function RappelsView({ projet, peutFiltrer }: { projet: Projet; peutFiltrer: boolean }) {
  const queryClient = useQueryClient();
  const [portee, setPortee] = useState<RappelScope>('overdue');
  const [appeleParId, setAppeleParId] = useState<string | null>(null);
  const projetApi = PROJET_API[projet];

  const retards = useQuery({
    queryKey: queryKeys.callbacks('overdue', projetApi, appeleParId),
    queryFn: () => fetchRappels('overdue', projetApi, appeleParId),
  });

  const liste = useQuery({
    queryKey: queryKeys.callbacks(portee, projetApi, appeleParId),
    queryFn: () => fetchRappels(portee, projetApi, appeleParId),
  });

  const annuler = useMutation({
    mutationFn: (rappel: Rappel) => annulerRappel(rappel.id),
    onSuccess: () => {
      toast.success('Rappel annulé.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.callbacksRoot });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas été annulé.');
    },
  });

  const enRetard = retards.data?.items.length ?? 0;

  function actions(rappel: Rappel) {
    return (
      <>
        <Link
          to="/$projet/console"
          params={{ projet }}
          search={{ fiche: rappel.prospectId }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <PhoneCallIcon aria-hidden="true" />
          Consigner l’appel
        </Link>
        <Button
          variant="ghost"
          size="sm"
          disabled={annuler.isPending}
          onClick={() => {
            annuler.mutate(rappel);
          }}
        >
          Annuler
        </Button>
      </>
    );
  }

  function corps() {
    if (liste.isPending) return <Skeleton className="h-64" />;
    if (liste.isError) {
      return (
        <QueryErrorState
          error={liste.error}
          fallback="Les rappels n’ont pas pu être lus."
          onRetry={() => {
            void liste.refetch();
          }}
        />
      );
    }
    if (liste.data.items.length === 0) return <EtatVide {...VIDE[portee]} />;

    return (
      <ListeResponsive
        items={liste.data.items}
        colonnes={colonnes(Date.parse(liste.data.serverTime), peutFiltrer)}
        cle={(rappel) => rappel.id}
        libelle="Rappels promis"
        actions={actions}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Compteur enRetard={enRetard} lu={retards.isSuccess} />
        <FiltreTeleconseiller
          id="rappels-teleconseiller"
          label="Téléconseiller"
          placeholder="Tous les téléconseillers"
          actif={peutFiltrer}
          value={appeleParId}
          onChange={setAppeleParId}
        />
      </div>

      <Tabs
        value={portee}
        onValueChange={(valeur) => {
          setPortee(valeur as RappelScope);
        }}
        className="gap-6"
      >
        <TabsList>
          {PORTEES.map((onglet) => (
            <TabsTrigger key={onglet.value} value={onglet.value}>
              {onglet.label}
              {onglet.value === 'overdue' && enRetard > 0 ? (
                <Badge variant="destructive">{formatNumber(enRetard)}</Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {PORTEES.map((onglet) => (
          <TabsContent key={onglet.value} value={onglet.value}>
            {portee === onglet.value ? corps() : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Compteur({ enRetard, lu }: { enRetard: number; lu: boolean }) {
  if (!lu) {
    return (
      <p className="text-[0.9375rem] text-muted-foreground" role="status">
        Retards en cours de lecture.
      </p>
    );
  }
  return (
    <p className="text-[0.9375rem]" role="status">
      <span className="font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
        {formatNumber(enRetard)}
      </span>{' '}
      rappel{enRetard > 1 ? 's' : ''} en retard
    </p>
  );
}
