'use client';

import {
  ArrowRightLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  PhoneCallIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CategorieHistorique = 'appel' | 'statut' | 'fil' | 'prospect' | 'fiche';

export interface EvenementHistorique {
  id: string;
  categorie: CategorieHistorique;
  /** ISO. L'histoire se lit du plus récent au plus ancien. */
  at: string;
  titre: string;
  resume?: string | null;
  acteur: string;
  source?: string | null;
  variant?: NonNullable<BadgeProps['variant']>;
  /** Ce que le volet montre quand on clique la ligne. */
  detail: ReactNode;
  lien?: { href: string; label: string } | null;
  action?: ReactNode;
}

const CATEGORIES: Record<
  CategorieHistorique,
  { label: string; icone: LucideIcon; teinte: string }
> = {
  appel: { label: 'Appels', icone: PhoneCallIcon, teinte: 'bg-info-surface text-info' },
  statut: {
    label: 'Statuts',
    icone: ArrowRightLeftIcon,
    teinte: 'bg-accent-surface text-accent-text',
  },
  fil: { label: 'Fil', icone: MessageSquareTextIcon, teinte: 'bg-secondary text-foreground' },
  prospect: {
    label: 'Prospects',
    icone: UserPlusIcon,
    teinte: 'bg-success-surface text-success',
  },
  fiche: { label: 'Fiche', icone: FileTextIcon, teinte: 'bg-muted text-muted-foreground' },
};

const ORDRE: readonly CategorieHistorique[] = ['appel', 'statut', 'fil', 'prospect', 'fiche'];

type Filtre = 'tout' | CategorieHistorique;

function parJour(evenements: readonly EvenementHistorique[]): [string, EvenementHistorique[]][] {
  const jours = new Map<string, EvenementHistorique[]>();
  for (const evenement of evenements) {
    const jour = evenement.at.slice(0, 10);
    const liste = jours.get(jour);
    if (liste === undefined) jours.set(jour, [evenement]);
    else liste.push(evenement);
  }
  return [...jours.entries()];
}

function heure(iso: string): string {
  return formatDateTime(iso).split(' à ')[1] ?? '';
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
  /** Le composeur du fil, posé au-dessus de la liste. */
  enTete?: ReactNode;
}) {
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  const tries = [...evenements].sort((a, b) => b.at.localeCompare(a.at));
  // Relu par identifiant : le volet suit la liste rechargée après une modification.
  const ouvert = tries.find((e) => e.id === ouvertId) ?? null;
  const visibles = filtre === 'tout' ? tries : tries.filter((e) => e.categorie === filtre);
  const jours = parJour(visibles);

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={filtre}
        onValueChange={(value) => {
          setFiltre(value as Filtre);
        }}
      >
        <TabsList aria-label="Filtrer l’histoire" className="max-w-full overflow-x-auto">
          <TabsTrigger value="tout">
            Tout
            <Compteur n={tries.length} />
          </TabsTrigger>
          {ORDRE.filter((categorie) => categories.includes(categorie)).map((categorie) => (
            <TabsTrigger key={categorie} value={categorie}>
              {CATEGORIES[categorie].label}
              <Compteur n={tries.filter((e) => e.categorie === categorie).length} />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {enTete}

      {visibles.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[0.875rem] text-muted-foreground">
          {filtre === 'tout' ? vide : (videParCategorie[filtre] ?? vide)}
        </p>
      ) : (
        <ol aria-label="Histoire" className="flex flex-col gap-5">
          {jours.map(([jour, liste]) => (
            <li key={jour}>
              <p className="eyebrow mb-2 text-muted-foreground">
                <time dateTime={jour}>{formatDate(`${jour}T00:00:00.000Z`)}</time>
              </p>
              <ol className="relative flex flex-col gap-1 before:absolute before:top-3 before:bottom-3 before:left-[1.1875rem] before:w-px before:bg-border">
                {liste.map((evenement) => (
                  <Ligne
                    key={evenement.id}
                    evenement={evenement}
                    onOpen={() => {
                      setOuvertId(evenement.id);
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
          setOuvertId(null);
        }}
      />
    </div>
  );
}

function Compteur({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
      {formatNumber(n)}
    </span>
  );
}

function Ligne({ evenement, onOpen }: { evenement: EvenementHistorique; onOpen: () => void }) {
  const categorie = CATEGORIES[evenement.categorie];
  const Icone = categorie.icone;
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors',
          'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
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
          {evenement.resume === null ||
          evenement.resume === undefined ||
          evenement.resume === '' ? null : (
            <span className="line-clamp-2 text-[0.875rem]">{evenement.resume}</span>
          )}
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

function VoletEvenement({
  evenement,
  onClose,
}: {
  evenement: EvenementHistorique | null;
  onClose: () => void;
}) {
  const categorie = evenement === null ? null : CATEGORIES[evenement.categorie];
  const Icone = categorie?.icone ?? FileTextIcon;
  return (
    <Sheet
      open={evenement !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-md">
        {evenement === null || categorie === null ? null : (
          <>
            <SheetHeader className="border-b border-border pr-14">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    categorie.teinte,
                  )}
                >
                  <Icone className="size-3.5" />
                </span>
                <span className="eyebrow text-muted-foreground">{categorie.label}</span>
              </span>
              <SheetTitle>{evenement.titre}</SheetTitle>
              <SheetDescription>
                <time dateTime={evenement.at} className="tabular-nums">
                  {formatDateTime(evenement.at)}
                </time>{' '}
                · {evenement.acteur}
                {evenement.source === null || evenement.source === undefined
                  ? ''
                  : ` · ${evenement.source}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex grow flex-col gap-4 overflow-y-auto p-4 text-[0.875rem]">
              {evenement.detail}
            </div>
            <PiedDeVolet evenement={evenement} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PiedDeVolet({ evenement }: { evenement: EvenementHistorique }) {
  const lien = evenement.lien ?? null;
  if (lien === null && evenement.action === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
      {lien === null ? null : (
        <Link href={lien.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ExternalLinkIcon aria-hidden="true" />
          {lien.label}
        </Link>
      )}
      {evenement.action}
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
