import type { SourceVisite } from '@/components/accueil/sources-visites';
import { classeurDesVisites } from '@/components/accueil/tableau-de-bord-classeur';
import { BarreEdition } from '@/components/tableau-de-bord/barre-edition';
import { BoutonExportExcel } from '@/components/tableau-de-bord/bouton-export-excel';
import type { FiltresPeriode } from '@/components/tableau-de-bord/selecteur-periode';
import { periodeAffichee } from '@/components/tableau-de-bord/selecteur-periode';
import type { Donnees, Marque } from '@/components/tableau-de-bord/sources';
import { TiroirWidgets } from '@/components/tableau-de-bord/tiroir-widgets';
import { Button } from '@/components/ui/button';
import type { Widget } from '@/lib/data/disposition';

export interface BarreTableauDeBordProps {
  edition: boolean;
  modifie: boolean;
  enregistrement: boolean;
  estAdmin: boolean;
  pret: boolean;
  dispositionUtilisateur: boolean;
  reinitialisation: boolean;
  widgets: readonly Widget[];
  catalogue: Readonly<Record<string, SourceVisite>>;
  parSource: Map<string, Donnees>;
  parWidget: Map<string, Donnees>;
  filtres: FiltresPeriode;
  plage: { du: string; au: string };
  onAjouter: (source: string, marque: Marque) => void;
  onReinitialiser: () => void;
  onEntrer: () => void;
  onEnregistrer: () => void;
  onQuitter: () => void;
  onParDefaut: () => void;
}

export function BarreTableauDeBord({
  edition,
  modifie,
  enregistrement,
  estAdmin,
  pret,
  dispositionUtilisateur,
  reinitialisation,
  widgets,
  catalogue,
  parSource,
  parWidget,
  filtres,
  plage,
  onAjouter,
  onReinitialiser,
  onEntrer,
  onEnregistrer,
  onQuitter,
  onParDefaut,
}: BarreTableauDeBordProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {edition ? (
        <TiroirWidgets
          placees={new Set(widgets.map((widget) => widget.source))}
          donnees={parSource}
          catalogue={catalogue}
          onAjouter={onAjouter}
        />
      ) : (
        <>
          {dispositionUtilisateur ? (
            <Button
              type="button"
              variant="ghost"
              disabled={reinitialisation}
              onClick={onReinitialiser}
            >
              Revenir à la disposition par défaut
            </Button>
          ) : null}
          <BoutonExportExcel
            disabled={!pret || widgets.length === 0}
            preparer={() =>
              classeurDesVisites({
                widgets,
                catalogue,
                donnees: parWidget,
                plage,
                periode: periodeAffichee(filtres),
              })
            }
          />
        </>
      )}
      <BarreEdition
        edition={edition}
        modifie={modifie}
        enCours={enregistrement}
        estAdmin={estAdmin}
        onEntrer={onEntrer}
        onEnregistrer={onEnregistrer}
        onQuitter={onQuitter}
        onParDefaut={onParDefaut}
      />
    </div>
  );
}
