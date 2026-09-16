'use client';

import { useQuery } from '@tanstack/react-query';
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
export function HubView({
  canCreateProspect,
  encadrement,
}: {
  prenom: string;
  canCreateProspect: boolean;
  /** Supervision, direction et administration lisent les rappels des téléconseillers, pas les leurs. */
  encadrement: boolean;
}) {
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

  const retards = useQuery({
    queryKey: [...callbackKeys.list('overdue', null), 'CHUES'],
    queryFn: () => fetchCallbacks('overdue', null, undefined, 'CHUES'),
    retry: false,
  });

  const enRetard = retards.data?.items.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setNouveauRepresentant(true)}>
          Ajouter un représentant
        </Button>
      </div>

      <ol className="grid gap-4 [counter-reset:etape] md:grid-cols-2 xl:grid-cols-4">
        <Etape
          titre="Fiche représentant"
          explication="Un enseignant relais accepte de transmettre les contacts de ses collègues."
          chiffre={
            <Chiffre
              pending={nonQualifies.isPending}
              failed={nonQualifies.isError}
              valeur={nonQualifies.data?.total}
              legende="pas encore qualifiés"
            />
          }
          action={
            <Geste href="/teleconseil/appels-representants" label="Appeler un représentant" />
          }
        />

        {/* Seuls l'encadrement et l'admin saisissent les prospects ; aux autres,
            une carte sans geste n'apprendrait rien. */}
        {canCreateProspect ? (
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
            action={
              <Geste
                href="/teleconseil/prospects/nouveau?projet=CHUES"
                label="Ajouter un prospect"
              />
            }
          />
        ) : null}

        <Etape
          titre="Fiche prospect"
          explication="Chaque prospect est rappelé jusqu’à son adhésion."
          chiffre={
            <Chiffre
              pending={enAttente.isPending}
              failed={enAttente.isError}
              valeur={enAttente.data}
              legende="pas encore convertis"
            />
          }
          action={<Geste href="/teleconseil/console" label="Appeler un prospect" primary />}
        />

        <Etape
          titre={encadrement ? 'Rappels des téléconseillers' : 'À rappeler'}
          explication={
            encadrement
              ? 'Ce que les téléconseillers ont promis de rappeler. Les retards se suivent ici.'
              : 'Les rappels promis et ceux que le référentiel a reprogrammés.'
          }
          chiffre={
            <Chiffre
              pending={rappels.isPending}
              failed={rappels.isError}
              valeur={rappels.data?.items.length}
              legende={encadrement ? 'dus aujourd’hui chez les téléconseillers' : 'dus aujourd’hui'}
              enRetard={enRetard}
            />
          }
          action={<Geste href="/teleconseil/rappels" label="Voir les rappels" />}
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

/** Le numéro vient du compteur CSS : une carte retirée ne laisse pas de trou. */
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
    <li className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm transition-all [counter-increment:etape] hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs font-[800] tracking-wider text-muted-foreground/60 uppercase before:content-[counter(etape,decimal-leading-zero)]">
          <span className="sr-only">Étape</span>
        </span>
      </div>
      <h2 className="font-display text-h4 font-[700] tracking-[-0.02em]">{titre}</h2>
      <p className="text-[0.875rem] text-muted-foreground">{explication}</p>
      {chiffre}
      <div className="mt-auto pt-2">{action}</div>
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
  enRetard = 0,
}: {
  pending: boolean;
  failed: boolean;
  valeur: number | undefined;
  legende: string;
  enRetard?: number;
}) {
  if (pending) return <Skeleton className="h-7 w-20" />;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.875rem] text-muted-foreground">
        <span
          aria-live="polite"
          className="font-display text-[1.5rem] font-[700] tabular-nums text-foreground"
        >
          {failed || valeur === undefined ? '–' : formatNumber(valeur)}
        </span>{' '}
        {legende}
      </p>
      {enRetard > 0 && (
        <span className="inline-flex w-fit items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
          {formatNumber(enRetard)} en retard
        </span>
      )}
    </div>
  );
}

/**
 * Un LIEN habillé en bouton, jamais un bouton : la primitive de Base UI poserait
 * `role="button"` sur le `<a>`, et l'ouverture dans un nouvel onglet, la
 * prélecture et le menu contextuel disparaîtraient avec.
 */
function Geste({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={buttonVariants({
        variant: primary ? 'default' : 'outline',
        className: 'w-full justify-center text-center',
      })}
    >
      {label}
    </Link>
  );
}
