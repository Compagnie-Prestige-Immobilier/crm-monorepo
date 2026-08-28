'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { callbackKeys, fetchCallbacks } from '@/lib/data/console';
import { countPendingProspects } from '@/lib/data/phase2';
import { fetchRepresentants } from '@/lib/data/representants';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { A_APPELER, SANS_PROSPECT, hubKeys } from '@/components/chues/hub-filters';

/**
 * L'écran d'ouverture du projet CHUES : trois étapes, dans l'ordre, chacune
 * avec son chiffre du jour et UN geste. Le reste de l'application se range
 * derrière.
 */
export function HubView({ prenom, readOnly }: { prenom: string; readOnly: boolean }) {
  const aAppeler = useQuery({
    queryKey: queryKeys.representants(A_APPELER),
    queryFn: () => fetchRepresentants(A_APPELER),
  });

  const sansProspect = useQuery({
    queryKey: queryKeys.representants(SANS_PROSPECT),
    queryFn: () => fetchRepresentants(SANS_PROSPECT),
  });

  const enAttente = useQuery({
    queryKey: hubKeys.prospectsEnAttente,
    queryFn: () => countPendingProspects('ALL', 'CHUES'),
  });

  const rappels = useQuery({
    queryKey: [...callbackKeys.list('today', null), 'CHUES'],
    queryFn: () => fetchCallbacks('today', null, undefined, 'CHUES'),
    retry: false,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* `alt` VIDE : le titre suit dans le même `h1`, et un texte de
            remplacement identique le ferait annoncer deux fois. */}
        <h1 className="flex items-center gap-3 font-display text-h1 font-[800]">
          <Image
            src="/brand/chues-logo.png"
            alt=""
            width={395}
            height={193}
            priority
            className="h-10 w-auto"
          />
          Projet CHUES
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Bonjour {prenom}. Trois étapes, dans l’ordre.
        </p>
      </div>

      <ol className="grid gap-4 md:grid-cols-3">
        <Etape
          n={1}
          titre="Appeler les représentants"
          explication="On appelle un enseignant représentant pour qu’il accepte de donner les contacts de ses collègues."
          chiffre={
            <Chiffre
              pending={aAppeler.isPending}
              failed={aAppeler.isError}
              valeur={aAppeler.data?.total}
              legende="pas encore appelés"
            />
          }
          action={
            readOnly ? (
              <Lien
                href="/chues/representants?relationStatus=INCONNU"
                label="Voir les représentants"
              />
            ) : (
              <Geste href="/chues/appels-representants" label="Commencer les appels" />
            )
          }
        />

        <Etape
          n={2}
          titre="Noter les prospects"
          explication="Le représentant a donné des noms : on les note un par un."
          chiffre={
            <Chiffre
              pending={sansProspect.isPending}
              failed={sansProspect.isError}
              valeur={sansProspect.data?.total}
              legende="ont dit oui, sans contacts notés"
            />
          }
          action={
            readOnly ? (
              <Lien
                href="/chues/representants?relationStatus=AMBASSADEUR&hasProspects=non"
                label="Voir les représentants sans prospect"
              />
            ) : (
              <Geste href="/chues/prospects/nouveau" label="Noter un prospect" />
            )
          }
        />

        <Etape
          n={3}
          titre="Appeler les prospects"
          explication="On appelle chaque prospect pour obtenir son adhésion."
          chiffre={
            <Chiffre
              pending={enAttente.isPending}
              failed={enAttente.isError}
              valeur={enAttente.data}
              legende="en attente d’appel"
              suite={
                // Le nombre de rappels dus n'a pas de sens sans le nombre en
                // attente : il ne s'affiche donc pas avant lui.
                rappels.isPending || rappels.isError
                  ? null
                  : ` · ${formatNumber(rappels.data.items.length)} rappel${
                      rappels.data.items.length > 1 ? 's' : ''
                    } dus`
              }
            />
          }
          action={
            readOnly ? (
              <Lien
                href="/chues/prospects?phase2Status=PENDING"
                label="Voir les prospects en attente"
              />
            ) : (
              <Geste href="/chues/console" label="Commencer les appels" />
            )
          }
        />
      </ol>
    </div>
  );
}

function Etape({
  n,
  titre,
  explication,
  chiffre,
  action,
}: {
  n: number;
  titre: string;
  explication: string;
  chiffre: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-surface font-display text-[1.125rem] font-[800] text-accent-text"
      >
        {n}
      </span>
      <h2 className="font-display text-h4 font-[700] tracking-[-0.02em]">
        <span className="sr-only">Étape {n} sur 3 : </span>
        {titre}
      </h2>
      <p className="text-[0.875rem] text-muted-foreground">{explication}</p>
      {chiffre}
      <div className="mt-auto pt-1">{action}</div>
    </li>
  );
}

/**
 * Un compteur ne montre JAMAIS un zéro provisoire : tant que le serveur n'a
 * pas répondu, la place du chiffre reste une plaque grise, et « 0 à appeler »
 * ne fait pas fermer l'écran à celui qui en a trois cents.
 */
function Chiffre({
  pending,
  failed,
  valeur,
  legende,
  suite = null,
}: {
  pending: boolean;
  failed: boolean;
  valeur: number | undefined;
  legende: string;
  suite?: string | null;
}) {
  if (pending) return <Skeleton className="h-7 w-20" />;

  return (
    <p className="text-[0.875rem] text-muted-foreground">
      <span aria-live="polite" className="font-display text-[1.5rem] font-[700] tabular-nums">
        {failed || valeur === undefined ? '–' : formatNumber(valeur)}
      </span>{' '}
      {legende}
      {suite}
    </p>
  );
}

/**
 * Un LIEN habillé en bouton, jamais un bouton : la primitive de Base UI poserait
 * `role="button"` sur le `<a>`, et l'ouverture dans un nouvel onglet, la
 * prélecture et le menu contextuel disparaîtraient avec.
 */
function Geste({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonVariants()}>
      {label}
    </Link>
  );
}

function Lien({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: 'outline' })}>
      {label}
    </Link>
  );
}
