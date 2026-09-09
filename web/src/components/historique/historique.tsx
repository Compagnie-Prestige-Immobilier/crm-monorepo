import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronRightIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  CATEGORIES,
  ORDRE_CATEGORIES,
  parJour,
  type CategorieHistorique,
  type EvenementHistorique,
} from '@/components/historique/evenement';
import { VoletEvenement } from '@/components/historique/volet';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type Filtre = 'tout' | CategorieHistorique;

function heure(iso: string): string {
  return formatDateTime(iso).split(' à ')[1] ?? '';
}

function Compteur({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
      {formatNumber(n)}
    </span>
  );
}

function Ligne({ evenement, onOuvrir }: { evenement: EvenementHistorique; onOuvrir: () => void }) {
  const categorie = CATEGORIES[evenement.categorie];
  const Icone = categorie.icone;
  const resume = evenement.resume ?? '';

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOuvrir}
        className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-card',
            categorie.teinte,
          )}
        >
          <Icone className="size-3.5" />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={evenement.variant ?? 'outline'}>{evenement.titre}</Badge>
            {evenement.source === null || evenement.source === undefined ? null : (
              <span className="text-[0.75rem] text-muted-foreground">{evenement.source}</span>
            )}
          </span>
          {resume === '' ? null : <span className="line-clamp-2 text-[0.875rem]">{resume}</span>}
          <span className="text-[0.75rem] text-muted-foreground">
            <time dateTime={evenement.at} className="tabular-nums">
              {heure(evenement.at)}
            </time>{' '}
            · {evenement.acteur}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground"
        />
      </button>
    </li>
  );
}

/**
 * Tout ce qui est arrivé à une fiche, dans l'ordre, sur une seule colonne :
 * chaque ligne se clique et ouvre le détail complet dans un volet.
 */
export function Historique({
  evenements,
  categories,
  vide,
  videParCategorie = {},
  enTete,
}: {
  evenements: readonly EvenementHistorique[];
  /** Les onglets, même vides : un compteur à zéro dit plus qu'un onglet absent. */
  categories: readonly CategorieHistorique[];
  vide: string;
  videParCategorie?: Partial<Record<CategorieHistorique, string>>;
  enTete?: ReactNode;
}) {
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [ouvert, setOuvert] = useState<EvenementHistorique | null>(null);

  const tries = [...evenements].sort((a, b) => b.at.localeCompare(a.at));
  const visibles = filtre === 'tout' ? tries : tries.filter((e) => e.categorie === filtre);

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={filtre}
        onValueChange={(valeur) => {
          setFiltre(valeur as Filtre);
        }}
      >
        <TabsList aria-label="Filtrer l’histoire" className="max-w-full overflow-x-auto">
          <TabsTrigger value="tout">
            Tout
            <Compteur n={tries.length} />
          </TabsTrigger>
          {ORDRE_CATEGORIES.filter((categorie) => categories.includes(categorie)).map(
            (categorie) => (
              <TabsTrigger key={categorie} value={categorie}>
                {CATEGORIES[categorie].label}
                <Compteur n={tries.filter((e) => e.categorie === categorie).length} />
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </Tabs>

      {enTete}

      {visibles.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[0.875rem] text-muted-foreground">
          {filtre === 'tout' ? vide : (videParCategorie[filtre] ?? vide)}
        </p>
      ) : (
        <ol aria-label="Histoire" className="flex flex-col gap-5">
          {parJour(visibles).map(([jour, liste]) => (
            <li key={jour}>
              <p className="eyebrow mb-2 text-muted-foreground">
                <time dateTime={jour}>{formatDate(`${jour}T00:00:00.000Z`)}</time>
              </p>
              <ol className="relative flex flex-col gap-1 before:absolute before:top-3 before:bottom-3 before:left-[1.1875rem] before:w-px before:bg-border">
                {liste.map((evenement) => (
                  <Ligne
                    key={evenement.id}
                    evenement={evenement}
                    onOuvrir={() => {
                      setOuvert(evenement);
                    }}
                  />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      <VoletEvenement
        evenement={ouvert}
        onClose={() => {
          setOuvert(null);
        }}
      />
    </div>
  );
}

/** La carte qui porte l'histoire : attend toutes ses sources, nomme la première en erreur. */
export function CarteHistoire({
  titre,
  description,
  sources,
  children,
}: {
  titre: string;
  description: string;
  sources: readonly UseQueryResult<unknown>[];
  children: ReactNode;
}) {
  const enErreur = sources.find((source) => source.isError);
  const enChargement = sources.some((source) => source.isPending);

  return (
    <Card id="appels" className="min-w-0">
      <CardHeader>
        <CardTitle>{titre}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {enErreur === undefined ? null : (
          <QueryErrorState
            error={enErreur.error}
            onRetry={() => {
              void enErreur.refetch();
            }}
            fallback="Une partie de l’histoire n’a pas pu être chargée."
          />
        )}
        {enChargement ? <Skeleton className="h-24 w-full" /> : children}
      </CardContent>
    </Card>
  );
}

/** Une paire libellé / valeur dans le volet ou la fiche. */
export function Champ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="font-[600] break-words">{children}</dd>
    </div>
  );
}
