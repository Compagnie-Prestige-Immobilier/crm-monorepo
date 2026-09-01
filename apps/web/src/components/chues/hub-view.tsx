'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { callbackKeys, fetchCallbacks } from '@/lib/data/console';
import { countPendingProspects } from '@/lib/data/phase2';
import { fetchRepresentants } from '@/lib/data/representants';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { NON_QUALIFIES, SANS_PROSPECT, hubKeys } from '@/components/chues/hub-filters';

/**
 * L'écran d'ouverture du projet CHUES : trois étapes, dans l'ordre, chacune
 * avec son chiffre du jour et UN geste. Le reste de l'application se range
 * derrière.
 *
 * Téléconseil, supervision et direction y lisent le MÊME écran : les trois
 * passent eux-mêmes les appels. Les chiffres sont ceux que l'API sert à chacun.
 */
export function HubView({ prenom }: { prenom: string }) {
  const [nouveauRepresentant, setNouveauRepresentant] = useState(false);
  const nonQualifies = useQuery({
    queryKey: queryKeys.representants(NON_QUALIFIES),
    queryFn: () => fetchRepresentants(NON_QUALIFIES),
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
      <div className="flex flex-col items-start gap-2">
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
        <Button variant="outline" onClick={() => setNouveauRepresentant(true)}>
          Ajouter un représentant
        </Button>
      </div>

      <ol className="grid gap-4 md:grid-cols-3">
        <Etape
          titre="Qualifier un représentant"
          explication="Un enseignant relais accepte de transmettre les contacts de ses collègues."
          chiffre={
            <Chiffre
              pending={nonQualifies.isPending}
              failed={nonQualifies.isError}
              valeur={nonQualifies.data?.total}
              legende="pas encore qualifiés"
            />
          }
          action={<Geste href="/chues/appels-representants" label="Qualifier un représentant" />}
        />

        <Etape
          titre="Ajouter un prospect"
          explication="Le représentant a donné des noms : on les note un par un."
          chiffre={
            <Chiffre
              pending={sansProspect.isPending}
              failed={sansProspect.isError}
              valeur={sansProspect.data?.total}
              legende="ont dit oui, sans contacts notés"
            />
          }
          action={<Geste href="/chues/prospects/nouveau" label="Ajouter un prospect" />}
        />

        <Etape
          titre="Convertir un prospect"
          explication="Chaque prospect est rappelé jusqu’à son adhésion."
          chiffre={
            <Chiffre
              pending={enAttente.isPending}
              failed={enAttente.isError}
              valeur={enAttente.data}
              legende="pas encore convertis"
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
          action={<Geste href="/chues/console" label="Convertir un prospect" />}
        />
      </ol>

      <RepresentantFormDialog
        open={nouveauRepresentant}
        onOpenChange={setNouveauRepresentant}
        representant={null}
      />
    </div>
  );
}

function Etape({
  titre,
  explication,
  chiffre,
  action,
}: {
  titre: string;
  explication: string;
  chiffre: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm">
      <h2 className="font-display text-h4 font-[700] tracking-[-0.02em]">{titre}</h2>
      <p className="text-[0.875rem] text-muted-foreground">{explication}</p>
      {chiffre}
      <div className="mt-auto pt-1">{action}</div>
    </li>
  );
}

/**
 * Un compteur ne montre JAMAIS un zéro provisoire : tant que le serveur n'a
 * pas répondu, la place du chiffre reste une plaque grise, et « 0 » ne fait pas
 * fermer l'écran à celui qui en a trois cents.
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
    <Link href={href} className={buttonVariants({ variant: 'outline' })}>
      {label}
    </Link>
  );
}
