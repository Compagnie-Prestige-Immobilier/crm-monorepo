import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { EtatVide } from '@/components/chues/console-ui';
import { FiltreTeleconseiller } from '@/components/chues/filtre-teleconseiller';
import { ListeResponsive, type Colonne } from '@/components/chues/liste-responsive';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCallbackAt } from '@/lib/data/callbacks';
import {
  fetchRepresentantsSuivi,
  SUIVI_TAILLE_PAGE,
  type Representant,
  type SuiviRepresentant,
} from '@/lib/data/representants';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

const ONGLETS: readonly { value: SuiviRepresentant; label: string }[] = [
  { value: 'A_RAPPELER', label: 'À rappeler' },
  { value: 'INJOIGNABLE', label: 'Injoignables' },
];

const VIDE: Record<SuiviRepresentant, { titre: string; description: string }> = {
  A_RAPPELER: {
    titre: 'Aucun représentant à rappeler',
    description:
      'Une échéance apparaît ici dès qu’un appel en promet une, ou dès qu’un numéro resté sans réponse revient en file.',
  },
  INJOIGNABLE: {
    titre: 'Aucun représentant injoignable',
    description: 'Un appel sans réponse fait remonter la fiche ici.',
  },
};

function Quand({
  suivi,
  representant,
  now,
}: {
  suivi: SuiviRepresentant;
  representant: Representant;
  now: number;
}) {
  if (suivi === 'INJOIGNABLE') {
    const at = representant.lastCallAt;
    if (at === null) return <span className="text-muted-foreground">Inconnu</span>;
    return <time dateTime={at}>{formatDateTime(at)}</time>;
  }

  const at = representant.nextCallbackAt;
  if (at === null) return <span className="text-muted-foreground">Sans échéance</span>;

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <time dateTime={at}>{formatCallbackAt(at, now)}</time>
      {Date.parse(at) < now ? <Badge variant="destructive">En retard</Badge> : null}
      {representant.nextCallbackOrigine === null ? null : (
        <Badge variant={representant.nextCallbackOrigine === 'PROMIS' ? 'secondary' : 'outline'}>
          {representant.nextCallbackOrigine === 'PROMIS' ? 'Promis' : 'Automatique'}
        </Badge>
      )}
    </span>
  );
}

/**
 * Les représentants que l'équipe doit reprendre : le rappel promis et l'appel
 * resté sans réponse. Sans rapport avec les rappels de PROSPECTS, qui viennent
 * d'une autre table.
 */
export function SuiviView({
  projet,
  userId,
  peutFiltrer,
}: {
  projet: Projet;
  userId: string;
  peutFiltrer: boolean;
}) {
  const [suivi, setSuivi] = useState<SuiviRepresentant>('A_RAPPELER');
  const [filtreId, setFiltreId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // L'API ne borne pas cette liste au demandeur : un téléconseiller n'y voit
  // que ses propres appels parce que le client l'exige.
  const appeleParId = peutFiltrer ? filtreId : userId;

  const liste = useQuery({
    queryKey: queryKeys.representantsSuivi(suivi, appeleParId),
    queryFn: () => fetchRepresentantsSuivi(suivi, appeleParId),
    placeholderData: (precedent) => precedent,
  });

  const colonnes: Colonne<Representant>[] = [
    {
      cle: 'representant',
      entete: 'Représentant',
      titre: true,
      cellule: (representant) => (
        <>
          <Link
            to="/$projet/representants/$representantId"
            params={{ projet, representantId: representant.id }}
            className="font-[600] underline underline-offset-4"
          >
            {representant.fullName}
          </Link>
          <span className="block text-[0.75rem] font-[400] text-muted-foreground tabular-nums">
            {formatPhone(representant.phoneE164)}
          </span>
        </>
      ),
    },
    {
      cle: 'etablissement',
      entete: 'Établissement',
      cellule: (representant) => representant.etablissement ?? 'Non renseigné',
    },
    {
      cle: 'quand',
      entete: suivi === 'A_RAPPELER' ? 'Échéance' : 'Dernier appel',
      cellule: (representant) => <Quand suivi={suivi} representant={representant} now={now} />,
    },
    ...(peutFiltrer
      ? [
          {
            cle: 'appelePar',
            entete: 'Appelé par',
            cellule: (representant: Representant) => representant.lastCallByName ?? 'Inconnu',
          },
        ]
      : []),
  ];

  function corps() {
    if (liste.isError && liste.data === undefined) {
      return (
        <QueryErrorState
          error={liste.error}
          fallback="Les représentants à reprendre n’ont pas pu être lus."
          onRetry={() => {
            void liste.refetch();
          }}
        />
      );
    }
    if (liste.data === undefined) return <Skeleton className="h-64" />;
    if (liste.data.items.length === 0) return <EtatVide {...VIDE[suivi]} />;

    return (
      <div className="flex flex-col gap-3">
        {liste.data.total > liste.data.items.length ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            {formatNumber(liste.data.total)} au total, les {formatNumber(SUIVI_TAILLE_PAGE)}{' '}
            premiers sont affichés.
          </p>
        ) : null}
        <ListeResponsive
          items={liste.data.items}
          colonnes={colonnes}
          cle={(representant) => representant.id}
          libelle="Représentants à reprendre"
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            Représentants à reprendre
          </h2>
          <p className="text-[0.875rem] text-muted-foreground">
            Les rappels promis pendant la qualification, ceux que le référentiel a reprogrammés, et
            les numéros restés sans réponse.
          </p>
        </div>

        <FiltreTeleconseiller
          id="suivi-appele-par"
          label="Appelé par"
          placeholder="Tous les téléconseillers"
          actif={peutFiltrer}
          value={filtreId}
          onChange={setFiltreId}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suivi des représentants">
        {ONGLETS.map((onglet) => (
          <Button
            key={onglet.value}
            type="button"
            variant={onglet.value === suivi ? 'default' : 'outline'}
            aria-pressed={onglet.value === suivi}
            onClick={() => {
              setSuivi(onglet.value);
            }}
          >
            {onglet.label}
          </Button>
        ))}
      </div>

      {corps()}
    </section>
  );
}
