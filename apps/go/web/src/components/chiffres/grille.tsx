import { decaler, deplacer } from '@/components/chiffres/chargeurs';
import type { SourceChiffre } from '@/components/chiffres/formes';
import { GrilleWidgets } from '@/components/tableau-de-bord/grille';
import type { Donnees } from '@/components/tableau-de-bord/sources';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Widget } from '@/lib/data/disposition';

/** Le corps de l'écran : squelette, écran vide, ou la grille elle-même. */
export function CorpsChiffres({
  pret,
  widgets,
  donnees,
  edition,
  catalogue,
  enRafraichissement,
  setBrouillon,
}: {
  pret: boolean;
  widgets: readonly Widget[];
  donnees: Map<string, Donnees>;
  edition: boolean;
  catalogue: Record<string, SourceChiffre>;
  enRafraichissement: boolean;
  setBrouillon: (maj: (courant: Widget[] | null) => Widget[] | null) => void;
}) {
  if (!pret) return <Skeleton className="h-64 w-full rounded-lg" />;

  if (widgets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-[0.9375rem] text-muted-foreground">
          Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.
        </CardContent>
      </Card>
    );
  }

  const modifier = (id: string, patch: Partial<Widget>): void => {
    setBrouillon(
      (courant) => courant?.map((w) => (w.id === id ? { ...w, ...patch } : w)) ?? courant,
    );
  };

  return (
    <div aria-busy={enRafraichissement}>
      <GrilleWidgets
        widgets={widgets}
        donnees={donnees}
        edition={edition}
        catalogue={catalogue}
        messageVide="Rien sur la période."
        onReordonner={(deId, versId) => {
          setBrouillon((courant) => deplacer(courant, deId, versId));
        }}
        onRetirer={(id) => {
          setBrouillon((courant) => courant?.filter((w) => w.id !== id) ?? courant);
        }}
        onDecaler={(id, sens) => {
          setBrouillon((courant) => decaler(courant, id, sens));
        }}
        onMarque={(id, marque) => {
          modifier(id, { marque });
        }}
        onTaille={(id, taille) => {
          modifier(id, { taille });
        }}
        onPresentation={(id, presentation) => {
          modifier(id, { presentation });
        }}
      />
    </div>
  );
}
