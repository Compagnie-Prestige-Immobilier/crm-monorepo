import type { ReactNode } from 'react';

import {
  BarresCentPourCent,
  BarresEmpilees,
  BarresHorizontales,
  BarresVerticales,
} from '@/components/tableau-de-bord/graphiques-barres';
import { CarteDeChaleur } from '@/components/tableau-de-bord/graphiques-matrice';
import { Anneau, Camembert, Rosace, Toile } from '@/components/tableau-de-bord/graphiques-parts';
import { Aire, Courbe, Escalier } from '@/components/tableau-de-bord/graphiques-series';
import { remplissage } from '@/components/tableau-de-bord/palette';
import {
  appliquerPresentation,
  donneesVides,
  type Catalogue,
  type Donnees,
  type LigneComposition,
  type Marque,
  type Presentation,
  type Scalaire,
  type Valeur,
} from '@/components/tableau-de-bord/sources';
import {
  GraphiqueVide,
  TableauEquipe,
  TableauValeurs,
  Tuile,
} from '@/components/tableau-de-bord/tableaux';
import { useChartTheme } from '@/components/tableau-de-bord/theme';

interface Contexte {
  items: readonly Valeur[];
  presentation: Presentation | undefined;
  titre: string;
  onSelect: ((index: number) => void) | undefined;
}

const RENDUS_SERIE: Partial<Record<Marque, (ctx: Contexte) => ReactNode>> = {
  'barres-horizontales': ({ items, presentation }) => (
    <BarresHorizontales items={items} presentation={presentation} />
  ),
  courbe: ({ items, presentation }) => <Courbe items={items} presentation={presentation} />,
  aire: ({ items, presentation }) => <Aire items={items} presentation={presentation} />,
  escalier: ({ items, presentation }) => <Escalier items={items} presentation={presentation} />,
  'aire-polaire': ({ items, presentation }) => <Rosace items={items} presentation={presentation} />,
  radar: ({ items, presentation }) => <Toile items={items} presentation={presentation} />,
  anneau: ({ items, presentation, onSelect }) => (
    <Anneau items={items} presentation={presentation} onSelect={onSelect} />
  ),
  camembert: ({ items, presentation, onSelect }) => (
    <Camembert items={items} presentation={presentation} onSelect={onSelect} />
  ),
  tableau: ({ items, titre }) => <TableauValeurs items={items} entete={titre} caption={titre} />,
};

function rendreScalaire(donnee: Scalaire, titre: string): ReactNode {
  return (
    <Tuile
      valeur={donnee.valeur}
      affichage={donnee.affichage}
      libelle={titre}
      detail={donnee.libelle === titre ? undefined : donnee.libelle}
    />
  );
}

/** Un diagramme circulaire PAR ligne, une seule légende, la carte grandit avec eux. */
function PetitsMultiples({
  lignes,
  marque,
  presentation,
  ouvrir,
}: {
  lignes: readonly LigneComposition[];
  marque: 'anneau' | 'camembert';
  presentation: Presentation | undefined;
  ouvrir: ((id: string) => void) | undefined;
}) {
  const theme = useChartTheme();
  const Diagramme = marque === 'anneau' ? Anneau : Camembert;
  const sansLegende = { ...presentation, legende: false };

  return (
    <div className="flex flex-col gap-3 pb-3">
      <ul
        className="flex flex-wrap gap-3 text-[0.8125rem] text-muted-foreground"
        aria-label="Légende"
      >
        {(lignes[0]?.segments ?? []).map((segment, index) => (
          <li key={segment.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: remplissage(theme, presentation?.palette, index) }}
            />
            {segment.label}
          </li>
        ))}
      </ul>
      <div className="grid auto-rows-[13rem] grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {lignes.map((ligne) => (
          <figure key={ligne.id ?? ligne.ligne} className="flex min-h-0 flex-col gap-1">
            <div className="min-h-0 flex-1">
              <Diagramme
                items={ligne.segments}
                presentation={sansLegende}
                onSelect={
                  ouvrir === undefined || ligne.id === undefined
                    ? undefined
                    : () => {
                        ouvrir(ligne.id ?? '');
                      }
                }
              />
            </div>
            <figcaption className="text-center">
              <span className="line-clamp-2 text-[0.8125rem] font-[600]">{ligne.ligne}</span>
              {ligne.detail === undefined ? null : (
                <span className="block truncate text-[0.75rem] text-muted-foreground">
                  {ligne.detail}
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function rendreComposition(
  lignes: readonly LigneComposition[],
  marque: Marque | undefined,
  titre: string,
  presentation: Presentation | undefined,
  ouvrir: ((id: string) => void) | undefined,
): ReactNode {
  if (marque === 'barres-empilees') {
    return <BarresEmpilees lignes={lignes} presentation={presentation} />;
  }
  if (marque === 'anneau' || marque === 'camembert') {
    return (
      <PetitsMultiples
        lignes={lignes}
        marque={marque}
        presentation={presentation}
        ouvrir={ouvrir}
      />
    );
  }
  if (marque === 'tableau') {
    const items = lignes[0]?.segments ?? [];
    return <TableauValeurs items={items} entete={titre} caption={titre} />;
  }
  return <BarresCentPourCent lignes={lignes} presentation={presentation} />;
}

/**
 * Le tri et le regroupement en « Autres » n'ont de sens que pour un classement :
 * réordonner une série chronologique la rendrait illisible, l'ordre y porte
 * l'information.
 */
function rendreListe(
  donnees: Extract<Donnees, { forme: 'classement' | 'serie-temporelle' | 'cyclique' }>,
  marque: Marque | undefined,
  titre: string,
  presentation: Presentation | undefined,
  ouvrir: ((id: string) => void) | undefined,
): ReactNode {
  const items =
    donnees.forme === 'classement'
      ? appliquerPresentation(donnees.donnee, presentation)
      : donnees.donnee;

  const onSelect =
    ouvrir === undefined
      ? undefined
      : (index: number): void => {
          const item = items[index];
          if (item !== undefined) ouvrir(item.id);
        };

  const rendu = marque === undefined ? undefined : RENDUS_SERIE[marque];
  if (rendu === undefined) return <BarresVerticales items={items} presentation={presentation} />;
  return rendu({ items, presentation, titre, onSelect });
}

export function rendreMarque({
  source,
  marque,
  donnees,
  presentation,
  catalogue,
  messageVide,
  ouvrir,
}: {
  source: string;
  marque: Marque | undefined;
  donnees: Donnees;
  presentation: Presentation | undefined;
  catalogue: Catalogue;
  messageVide: string;
  ouvrir?: ((id: string) => void) | undefined;
}): ReactNode {
  const titre = catalogue[source]?.label ?? source;

  if (donnees.forme === 'equipe') return <TableauEquipe donnee={donnees.donnee} caption={titre} />;
  if (donnees.forme === 'scalaire') return rendreScalaire(donnees.donnee, titre);
  if (donneesVides(donnees)) return <GraphiqueVide message={messageVide} />;
  // `tableau` comme `carte-de-chaleur` : la carte de chaleur EST un tableau,
  // colorié. Un croisement à deux axes n'a pas d'autre rendu honnête.
  if (donnees.forme === 'matrice') {
    return <CarteDeChaleur matrice={donnees.donnee} caption={titre} />;
  }
  if (donnees.forme === 'composition') {
    return rendreComposition(donnees.donnee, marque, titre, presentation, ouvrir);
  }
  return rendreListe(donnees, marque, titre, presentation, ouvrir);
}
