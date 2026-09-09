import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CopyIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { FILTRES_VIDES } from '@/components/representants/filtres';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRappels } from '@/lib/data/callbacks';
import { fetchPageProspects } from '@/lib/data/grand-public';
import { fetchRepresentants } from '@/lib/data/representants';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/** Les représentants dont la relation n'a pas encore été tranchée. */
const NON_QUALIFIES = { ...FILTRES_VIDES, relationStatus: 'INCONNU' as const, pageSize: 1 };

/** Ceux qui ont accepté sans qu'un seul contact ait été noté derrière. */
const SANS_PROSPECT = {
  ...FILTRES_VIDES,
  relationStatus: 'AMBASSADEUR' as const,
  hasProspects: false,
  pageSize: 1,
};

const EN_ATTENTE = {
  projet: 'CHUES',
  phase2Status: 'PENDING',
  page: 1,
  pageSize: 1,
} as const;

/**
 * L'écran d'ouverture du projet CHUES : trois étapes, dans l'ordre, chacune
 * avec son chiffre du jour et UN geste. Le reste de l'application se range
 * derrière.
 */
export function HubVue({ prenom, jetonPublic }: { prenom: string; jetonPublic: string }) {
  const nonQualifies = useQuery({
    queryKey: queryKeys.representants({ ...NON_QUALIFIES }),
    queryFn: () => fetchRepresentants(NON_QUALIFIES),
  });

  const sansProspect = useQuery({
    queryKey: queryKeys.representants({ ...SANS_PROSPECT }),
    queryFn: () => fetchRepresentants(SANS_PROSPECT),
  });

  const enAttente = useQuery({
    queryKey: queryKeys.prospects({ ...EN_ATTENTE }),
    queryFn: () => fetchPageProspects(EN_ATTENTE),
  });

  const rappels = useQuery({
    queryKey: ['rappels', 'today', 'CHUES'],
    queryFn: () => fetchRappels('today', 'CHUES', null),
    retry: false,
  });

  const retards = useQuery({
    queryKey: ['rappels', 'overdue', 'CHUES'],
    queryFn: () => fetchRappels('overdue', 'CHUES', null),
    retry: false,
  });

  const enRetard = retards.data?.items.length ?? 0;
  const lien = `${globalThis.location.origin}/demande/${jetonPublic}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        {/* `alt` VIDE : le titre suit dans le même `h1`, et un texte de
            remplacement identique le ferait annoncer deux fois. */}
        <h1 className="flex items-center gap-3 font-display text-h1 font-[800]">
          <img
            src="/brand/chues-logo.png"
            alt=""
            width={395}
            height={193}
            className="h-10 w-auto"
          />
          Projet CHUES
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Bonjour {prenom}. Trois étapes, dans l’ordre, puis ce qui revient.
        </p>
        <Link
          to="/$projet/representants"
          params={{ projet: 'chues' }}
          className={buttonVariants({ variant: 'outline' })}
        >
          Voir les représentants
        </Link>
      </div>

      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Etape
          titre="Qualifier un représentant"
          explication="Un enseignant relais accepte de transmettre les contacts de ses collègues."
          chiffre={
            <Chiffre
              enAttente={nonQualifies.isPending}
              echoue={nonQualifies.isError}
              valeur={nonQualifies.data?.total}
              legende="pas encore qualifiés"
            />
          }
          geste={<Geste vers="/$projet/appels-representants" label="Qualifier un représentant" />}
        />

        <Etape
          titre="Ajouter un prospect"
          explication="Le représentant a donné des noms : on les note un par un."
          chiffre={
            <Chiffre
              enAttente={sansProspect.isPending}
              echoue={sansProspect.isError}
              valeur={sansProspect.data?.total}
              legende="ont dit oui, sans contacts notés"
            />
          }
          geste={<Geste vers="/$projet/prospects/nouveau" label="Ajouter un prospect" />}
        />

        <Etape
          titre="Convertir un prospect"
          explication="Chaque prospect est rappelé jusqu’à son adhésion."
          chiffre={
            <Chiffre
              enAttente={enAttente.isPending}
              echoue={enAttente.isError}
              valeur={enAttente.data?.total}
              legende="pas encore convertis"
            />
          }
          geste={<Geste vers="/$projet/console" label="Convertir un prospect" />}
        />

        <Etape
          titre="À rappeler"
          explication="Les rappels promis et ceux que le référentiel a reprogrammés."
          chiffre={
            <Chiffre
              enAttente={rappels.isPending}
              echoue={rappels.isError}
              valeur={rappels.data?.items.length}
              legende="dus aujourd’hui"
              suite={
                retards.isPending || retards.isError
                  ? null
                  : ` · ${formatNumber(enRetard)} en retard`
              }
            />
          }
          geste={<Geste vers="/$projet/rappels" label="Voir les rappels" />}
        />
      </ol>

      <LienFormulairePublic lien={lien} />
    </div>
  );
}

function Etape({
  titre,
  explication,
  chiffre,
  geste,
}: {
  titre: string;
  explication: string;
  chiffre: ReactNode;
  geste: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm">
      <h2 className="font-display text-h4 font-[700] tracking-[-0.02em]">{titre}</h2>
      <p className="text-[0.875rem] text-muted-foreground">{explication}</p>
      {chiffre}
      <div className="mt-auto pt-1">{geste}</div>
    </li>
  );
}

/**
 * Un compteur ne montre JAMAIS un zéro provisoire : tant que le serveur n'a pas
 * répondu, la place du chiffre reste une plaque grise.
 */
function Chiffre({
  enAttente,
  echoue,
  valeur,
  legende,
  suite = null,
}: {
  enAttente: boolean;
  echoue: boolean;
  valeur: number | undefined;
  legende: string;
  suite?: string | null;
}) {
  if (enAttente) return <Skeleton className="h-7 w-20" />;

  return (
    <p className="text-[0.875rem] text-muted-foreground">
      <span aria-live="polite" className="font-display text-[1.5rem] font-[700]">
        {echoue || valeur === undefined ? '–' : formatNumber(valeur)}
      </span>{' '}
      {legende}
      {suite}
    </p>
  );
}

/**
 * Un LIEN habillé en bouton, jamais un bouton : l'ouverture dans un nouvel
 * onglet, la prélecture et le menu contextuel disparaîtraient avec.
 */
function Geste({
  vers,
  label,
}: {
  vers:
    | '/$projet/appels-representants'
    | '/$projet/prospects/nouveau'
    | '/$projet/console'
    | '/$projet/rappels';
  label: string;
}) {
  return (
    <Link to={vers} params={{ projet: 'chues' }} className={buttonVariants({ variant: 'outline' })}>
      {label}
    </Link>
  );
}

/**
 * Le lien du formulaire public, propre au compte qui le partage : la fiche
 * reçue lui revient, et l'avis d'arrivée aussi.
 */
function LienFormulairePublic({ lien }: { lien: string }) {
  function copier(): void {
    if (!('clipboard' in navigator)) {
      toast.error('Copie indisponible dans ce navigateur.');
      return;
    }
    navigator.clipboard.writeText(lien).then(
      () => {
        toast.success('Lien copié.');
      },
      () => {
        toast.error('Copie refusée par le navigateur.');
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulaire public</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input readOnly value={lien} aria-label="Lien du formulaire public" className="font-mono" />
        <Button type="button" variant="outline" onClick={copier} className="shrink-0">
          <CopyIcon className="size-4" aria-hidden="true" />
          Copier le lien
        </Button>
      </CardContent>
    </Card>
  );
}
