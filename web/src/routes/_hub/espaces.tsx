import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  BadgeIcon,
  CircleDotIcon,
  CompassIcon,
  Grid2X2Icon,
  LockIcon,
  MoveUpRightIcon,
  PanelTopIcon,
  ScanLineIcon,
  SlashIcon,
  WavesIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { COQUE_ICONS } from '@/components/espaces/coque-icons';
import {
  type Coque,
  type CoqueEntry,
  coqueHomePath,
  coquesForRole,
} from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_hub/espaces')({
  component: EspacesPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6"
      role="status"
      aria-label="Chargement des espaces"
    >
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="size-40 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function Cercle({ coque, allowed, choisi }: { coque: Coque; allowed: boolean; choisi: boolean }) {
  const Icon = COQUE_ICONS[coque];
  return (
    <span className="relative grid size-44 place-items-center">
      <span
        className={cn(
          'relative grid size-36 place-items-center rounded-full border border-border/80 bg-card text-primary-text shadow-elev-sm transition-all duration-(--dur-2) ease-(--ease-out-cpi)',
          allowed &&
            'group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:shadow-elev-md',
          choisi && 'scale-125 border-primary shadow-elev-lg duration-500 ease-(--ease-spring)',
        )}
      >
        <Icon className="cpi-space-icon size-16" strokeWidth={1.5} aria-hidden="true" />
        <LockIcon
          className={cn(
            'absolute right-2 bottom-2 size-6 rounded-full bg-card p-1 text-muted-foreground',
            allowed && 'hidden',
          )}
          aria-label="Réservé à d’autres profils"
        />
      </span>
    </span>
  );
}

type Etat = 'repos' | 'choisi' | 'ecarte';

const SIGNATURES = [
  { nom: 'Trait', icone: SlashIcon },
  { nom: 'Sceau', icone: CircleDotIcon },
  { nom: 'Trame', icone: Grid2X2Icon },
  { nom: 'Élan', icone: MoveUpRightIcon },
  { nom: 'Ondes', icone: WavesIcon },
  { nom: 'Sillage', icone: ScanLineIcon },
  { nom: 'Repère', icone: CompassIcon },
  { nom: 'Cadre', icone: PanelTopIcon },
  { nom: 'Sceau', icone: BadgeIcon },
  { nom: 'Épure', icone: null },
] as const;

export function SignatureCpi({
  variante,
  onChange,
}: {
  variante: number;
  onChange: (index: number) => void;
}) {
  const signature = SIGNATURES[variante] ?? SIGNATURES[0];
  const Icon = signature.icone;

  return (
    <div className="relative -mx-4 -mt-8 overflow-hidden border-b border-border/80 bg-card md:-mx-6 md:-mt-12">
      <div
        className={cn(
          'relative flex min-h-20 items-center justify-between overflow-hidden px-6 py-4 md:min-h-24 md:px-12',
          `signature-${String(variante + 1)}`,
        )}
      >
        <div className="relative z-10 flex items-center gap-4">
          <img src="/brand/cpi-header.webp" alt="CPI" className="h-8 w-auto object-contain" />
          <span className="h-7 w-px bg-white/30" />
          <span className="font-display text-sm font-semibold tracking-[0.18em] text-white/90">
            CPI GO
          </span>
        </div>
        <div className="relative z-10 hidden items-center gap-3 text-right sm:flex">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/60">
            Votre environnement
          </span>
          {Icon ? (
            <Icon aria-hidden="true" className="size-5 text-white/85" strokeWidth={1.5} />
          ) : (
            <span className="size-2 rounded-full bg-white/80" />
          )}
        </div>
      </div>
      <div className="signature-switcher relative flex items-center gap-1 overflow-x-auto border-t border-border/70 bg-background/70 px-3 py-1.5">
        <span className="mr-2 shrink-0 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Style
        </span>
        {SIGNATURES.map((option, index) => {
          const OptionIcon = option.icone;
          return (
            <button
              key={option.nom}
              type="button"
              aria-label={`Choisir le style ${option.nom}`}
              aria-pressed={index === variante}
              onClick={() => onChange(index)}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                index === variante &&
                  'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
              )}
            >
              {OptionIcon ? (
                <OptionIcon aria-hidden="true" className="size-4" strokeWidth={1.7} />
              ) : (
                <span className="size-2 rounded-full bg-current" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function etat(ouverture: Coque | null, coque: Coque): Etat {
  if (ouverture === null) return 'repos';
  return ouverture === coque ? 'choisi' : 'ecarte';
}

function Pastille({
  entry,
  allowed,
  index,
  href,
  etat: phase,
  onOuvrir,
}: {
  entry: CoqueEntry;
  allowed: boolean;
  index: number;
  href: string;
  etat: Etat;
  onOuvrir: (coque: Coque) => void;
}) {
  const choisi = phase === 'choisi';
  const classe = cn(
    'animate-rise group flex flex-col items-center gap-5 text-center transition-all duration-500 ease-(--ease-out-cpi) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
    !allowed && 'pointer-events-none opacity-50',
    phase !== 'repos' && 'pointer-events-none',
    phase === 'ecarte' && 'scale-90 opacity-0 blur-[2px]',
  );

  const corps = (
    <>
      <Cercle coque={entry.id} allowed={allowed} choisi={choisi} />
      <span
        className={cn(
          'flex flex-col items-center gap-1.5 transition-opacity duration-300',
          choisi && 'opacity-0',
        )}
      >
        <span className="font-display text-h2 font-[700] tracking-[-0.02em]">{entry.label}</span>
        <span
          aria-hidden="true"
          className="h-0.5 w-0 bg-primary/40 transition-all duration-(--dur-2) group-hover:w-14"
        />
        <span className="max-w-56 text-small text-balance text-muted-foreground">
          {entry.description}
        </span>
      </span>
    </>
  );

  if (!allowed) {
    return <div className={classe}>{corps}</div>;
  }

  return (
    <Link
      href={href}
      style={{ animationDelay: `${String(index * 60)}ms` }}
      className={classe}
      onClick={(evenement) => {
        if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return;
        evenement.preventDefault();
        onOuvrir(entry.id);
      }}
    >
      {corps}
    </Link>
  );
}

/** La page `(hub)/espaces` de la v1. */
function EspacesPage() {
  const { user } = Route.useRouteContext();
  const tuiles = coquesForRole(user);
  const router = useRouter();
  const [ouverture, setOuverture] = useState<Coque | null>(null);
  const requestedReturn = useSearchParams().get('retour');
  // `//evil.com` commence par « / » et est pourtant une URL absolue : le même
  // motif qu'à la connexion refuse la double barre et l'antislash.
  const returnPath =
    typeof requestedReturn === 'string' &&
    /^\/(?!\/)[^\\]*$/.test(requestedReturn) &&
    !requestedReturn.startsWith('/espaces')
      ? requestedReturn
      : null;

  // La navigation attend la fin de l'ouverture : le routeur démonte la page
  // sans jouer d'animation de sortie.
  const ouvrir = (coque: Coque) => {
    const cible = coqueHomePath(user, coque);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push(cible);
      return;
    }
    setOuverture(coque);
    window.setTimeout(() => {
      router.push(cible);
    }, 420);
  };

  return (
    <div className="flex w-full flex-col gap-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-start gap-8 pb-10 pt-2 lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-display font-[800]">
            {returnPath === null ? 'Choisissez un espace' : 'Changer d’espace'}
          </h1>
          {returnPath === null ? null : (
            <Button
              render={<Link href={returnPath} />}
              variant="outline"
              className="border-foreground/30 bg-card"
            >
              <ArrowLeftIcon aria-hidden="true" />
              Retour
            </Button>
          )}
        </div>

        <ul className="relative grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
          {tuiles.map(({ entry, allowed }, index) => (
            <li key={entry.id} className="flex justify-center">
              <Pastille
                entry={entry}
                allowed={allowed}
                index={index}
                href={coqueHomePath(user, entry.id)}
                etat={etat(ouverture, entry.id)}
                onOuvrir={ouvrir}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
