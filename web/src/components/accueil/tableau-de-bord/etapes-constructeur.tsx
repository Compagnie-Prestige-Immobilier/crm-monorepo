'use client';

import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { createContext, use } from 'react';

import { renderMark } from '@/components/accueil/tableau-de-bord/grille';
import { evaluerMarques } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  mesurerDonnees,
  type Catalogue,
  type DashboardMarque,
  type DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import { ChartCard } from '@/components/dashboard/chart-card';
import { marqueTexte } from '@/components/dashboard/chart-visual';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCalculs, type Proposition } from '@/lib/data/disposition';
import { cn } from '@/lib/utils';

export type ArgsComprendre = {
  interpretation: string;
  proposition?: Proposition;
  alternatives: Proposition[];
};
export type ArgsForme = { proposition: Proposition };
export type ArgsApercu = { proposition: Proposition; marque: DashboardMarque };

export interface ContexteEtapes {
  catalogue: Catalogue;
  plage: { du: string; au: string };
  cleDonnees: readonly unknown[];
  chargerSource: (source: string) => Promise<DonneesSource | null>;
  confirmer: (etape: string, proposition: Proposition) => void;
  ajuster: (etape: string) => void;
  choisirForme: (etape: string, args: ArgsApercu) => void;
  ajouter: (etape: string, args: ArgsApercu) => void;
  recommencer: () => void;
}

export const ContexteConstructeur = createContext<ContexteEtapes | null>(null);

function useEtapes(): ContexteEtapes {
  const contexte = use(ContexteConstructeur);
  if (contexte === null) throw new Error('Étape du constructeur hors de son contexte.');
  return contexte;
}

const AUCUNE = 'Aucune donnée pour cet indicateur sur la période.';
const VIDE = 'Rien sur la période.';
const MULTI_SERIES: readonly DashboardMarque[] = [
  'barres-empilees',
  'barres-100',
  'barres-groupees',
];

async function donneesDe(
  proposition: Proposition,
  etapes: ContexteEtapes,
): Promise<{ donnees?: DonneesSource; erreur?: string }> {
  if (proposition.calcul !== undefined) {
    const [rendu] = await fetchCalculs([proposition.calcul], etapes.plage);
    if (rendu?.donnees !== undefined) return { donnees: rendu.donnees };
    return { erreur: rendu?.erreur ?? AUCUNE };
  }
  const donnees =
    proposition.source === undefined ? null : await etapes.chargerSource(proposition.source);
  return donnees === null ? { erreur: AUCUNE } : { donnees };
}

function useDonnees(proposition: Proposition) {
  const etapes = useEtapes();
  const { du, au } = etapes.plage;
  const cible = proposition.calcul ?? proposition.source ?? null;
  return useQuery({
    queryKey: ['tableau-de-bord', 'apercu', cible, du, au, ...etapes.cleDonnees],
    queryFn: () => donneesDe(proposition, etapes),
  });
}

/** Une seule série : aucune forme qui empile ou groupe plusieurs séries. */
function marquesPour(donnees: DonneesSource): DashboardMarque[] {
  const marques = evaluerMarques(donnees.forme, mesurerDonnees(donnees)).map((e) => e.marque);
  const uneSerie =
    donnees.forme !== 'composition' || donnees.donnee.every((l) => l.segments.length <= 1);
  return uneSerie ? marques.filter((marque) => !MULTI_SERIES.includes(marque)) : marques;
}

function EtatDonnees({ pending, erreur }: { pending: boolean; erreur: string | undefined }) {
  if (pending) return <Skeleton className="h-28 w-full rounded-md" />;
  return <p className="text-destructive">{erreur ?? AUCUNE}</p>;
}

export const EtapeComprendre: ToolCallMessagePartComponent<ArgsComprendre> = ({
  toolCallId,
  args,
  result,
}) => {
  const etapes = useEtapes();
  const repondu = result !== undefined;
  const { proposition, alternatives } = args;
  return (
    <div data-riche="" className="flex flex-col gap-3">
      <p>{args.interpretation}</p>
      {proposition === undefined ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={repondu}
            onClick={() => etapes.confirmer(toolCallId, proposition)}
          >
            {result === proposition.titre ? <CheckIcon aria-hidden="true" /> : null}
            Oui
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={repondu}
            onClick={() => etapes.ajuster(toolCallId)}
          >
            Ajuster
          </Button>
        </div>
      )}
      {alternatives.length === 0 ? null : (
        <div role="group" aria-label="Autres indicateurs proches" className="flex flex-wrap gap-2">
          {alternatives.map((alternative) => (
            <button
              key={alternative.source ?? alternative.titre}
              type="button"
              disabled={repondu}
              aria-pressed={result === alternative.titre}
              onClick={() => etapes.confirmer(toolCallId, alternative)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-[0.8125rem] transition-colors hover:border-primary/40 hover:bg-secondary disabled:opacity-60 aria-pressed:border-primary aria-pressed:opacity-100 motion-reduce:transition-none"
            >
              {alternative.titre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const EtapeForme: ToolCallMessagePartComponent<ArgsForme> = ({
  toolCallId,
  args,
  result,
}) => {
  const etapes = useEtapes();
  const { proposition } = args;
  const { data, isPending } = useDonnees(proposition);
  const donnees = data?.donnees;
  return (
    <div data-riche="" className="flex flex-col gap-3">
      <p>Comment l’afficher ?</p>
      {donnees === undefined ? (
        <EtatDonnees pending={isPending} erreur={data?.erreur} />
      ) : (
        <div role="group" aria-label="Formes possibles" className="grid grid-cols-2 gap-2">
          {marquesPour(donnees).map((marque) => (
            <button
              key={marque}
              type="button"
              disabled={result !== undefined}
              aria-pressed={result === marque}
              title={marqueTexte(marque).usage}
              onClick={() => etapes.choisirForme(toolCallId, { proposition, marque })}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary disabled:opacity-60 aria-pressed:border-primary aria-pressed:opacity-100 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <div aria-hidden="true" className="pointer-events-none h-28 overflow-hidden">
                {renderMark(proposition.titre, marque, donnees, undefined, VIDE)}
              </div>
              <span className="text-[0.8125rem] font-[600]">{marqueTexte(marque).nom}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const EtapeApercu: ToolCallMessagePartComponent<ArgsApercu> = ({
  toolCallId,
  args,
  result,
}) => {
  const etapes = useEtapes();
  const { data, isPending } = useDonnees(args.proposition);
  const donnees = data?.donnees;
  const repondu = result !== undefined;
  return (
    <div data-riche="" className="flex flex-col gap-3">
      <ChartCard
        title={args.proposition.titre}
        hauteur={args.marque === 'tuile' ? 'compacte' : 'normale'}
        className={cn('animate-none', repondu && 'opacity-80')}
      >
        {donnees === undefined ? (
          <EtatDonnees pending={isPending} erreur={data?.erreur} />
        ) : (
          renderMark(args.proposition.titre, args.marque, donnees, undefined, VIDE)
        )}
      </ChartCard>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={repondu || donnees === undefined}
          onClick={() => etapes.ajouter(toolCallId, args)}
        >
          {result === 'ajouter' ? <CheckIcon aria-hidden="true" /> : null}
          Ajouter au tableau de bord
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={repondu}
          onClick={() => etapes.ajuster(toolCallId)}
        >
          Ajuster
        </Button>
        <Button size="sm" variant="ghost" disabled={repondu} onClick={etapes.recommencer}>
          Recommencer
        </Button>
      </div>
    </div>
  );
};
