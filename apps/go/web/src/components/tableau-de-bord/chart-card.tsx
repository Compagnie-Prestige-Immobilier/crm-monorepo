import { InfoIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** `libre` : la carte grandit avec son contenu, chaque diagramme y a sa boîte. */
const HAUTEURS = {
  compacte: 'min-h-20',
  normale: 'h-64',
  haute: 'h-80',
  libre: 'min-h-40',
} as const;

export type HauteurCarte = keyof typeof HAUTEURS;

function Aide({ titre, description }: { titre: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`À propos de ${titre}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <InfoIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-3">
        <p className="text-[0.8125rem] font-[700] text-foreground">{titre}</p>
        <p className="mt-1 text-[0.8125rem] leading-[1.55] text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Le canevas de Chart.js porte `role="img"` sans nom accessible. Le canevas
 * n'apparaît qu'une fois les données arrivées : l'observateur couvre les deux
 * ordres d'arrivée.
 */
function useCanevasPresentation(region: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const hote = region.current;
    if (hote === null) return;

    const neutraliser = (): void => {
      for (const canevas of hote.querySelectorAll('canvas')) {
        canevas.setAttribute('role', 'presentation');
      }
    };

    neutraliser();
    const observateur = new MutationObserver(neutraliser);
    observateur.observe(hote, { childList: true, subtree: true });
    return () => {
      observateur.disconnect();
    };
  }, [region]);
}

export function ChartCard({
  titre,
  aide,
  hauteur = 'normale',
  actions,
  children,
}: {
  titre: string;
  aide?: string | undefined;
  hauteur?: HauteurCarte;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const region = useRef<HTMLDivElement>(null);
  useCanevasPresentation(region);

  return (
    <Card className="h-full animate-rise">
      <CardHeader className={actions === undefined ? undefined : 'flex-row items-start gap-3'}>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-1.5">
            {titre}
            {aide === undefined ? null : <Aide titre={titre} description={aide} />}
          </CardTitle>
        </div>
        {actions}
      </CardHeader>
      {/* Hauteur fixe : Chart.js mesure son conteneur, et un parent
          auto-dimensionné produit une boucle de redimensionnement. */}
      <div
        ref={region}
        className={cn('px-5 pb-1', HAUTEURS[hauteur])}
        role="group"
        aria-label={`${titre}, graphique`}
      >
        {children}
      </div>
    </Card>
  );
}
