import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  ApercuGraphique,
  ExempleGraphique,
  texteMarque,
} from '@/components/tableau-de-bord/chart-visual';
import { evaluerMarques } from '@/components/tableau-de-bord/recommandation';
import {
  mesurerDonnees,
  type Catalogue,
  type Donnees,
  type Marque,
} from '@/components/tableau-de-bord/sources';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Apercu {
  source: string;
  marque: Marque;
  rejeu: number;
}

const SANS_MESURE = { nombreCategories: 0, nombrePoints: 0, partZero: 0 };

function CarteSource({
  source,
  catalogue,
  donnees,
  apercu,
  setApercu,
  onAjouter,
}: {
  source: string;
  catalogue: Catalogue;
  donnees: Map<string, Donnees>;
  apercu: Apercu | null;
  setApercu: (apercu: Apercu | null) => void;
  onAjouter: (source: string, marque: Marque) => void;
}) {
  const entree = catalogue[source];
  if (entree === undefined) return null;

  const donnee = donnees.get(source);
  // Sans données chargées, la mesure vaut zéro : le classement reste celui de
  // la FORME, jamais un repli muet.
  const evaluees = evaluerMarques(
    entree.forme,
    donnee === undefined ? SANS_MESURE : mesurerDonnees(donnee),
  );
  const marque = evaluees[0]?.marque ?? 'tableau';

  return (
    <article className="flex shrink-0 flex-col gap-3 rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-start gap-3">
        <ApercuGraphique marque={marque} />
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-[700] uppercase tracking-[0.08em] text-muted-foreground">
            {entree.groupe ?? 'Indicateur'}
          </p>
          <h3 className="font-display text-[1rem] font-[700] text-foreground">{entree.label}</h3>
          {entree.question === undefined ? null : (
            <p className="mt-1 text-[0.875rem] font-[600] text-foreground">{entree.question}</p>
          )}
          {entree.description === undefined ? null : (
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">{entree.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onAjouter(source, marque);
          }}
        >
          Ajouter
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setApercu({ source, marque, rejeu: (apercu?.rejeu ?? 0) + 1 });
          }}
        >
          Voir cet exemple
        </Button>
        {evaluees.slice(1).map((evaluee) => (
          <Button
            key={evaluee.marque}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setApercu({
                source,
                marque: evaluee.marque,
                rejeu: (apercu?.rejeu ?? 0) + 1,
              });
            }}
          >
            {texteMarque(evaluee.marque).nom}
          </Button>
        ))}
      </div>

      {apercu?.source === source ? (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
          <ExempleGraphique
            key={`${apercu.marque}-${String(apercu.rejeu)}`}
            marque={apercu.marque}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAjouter(source, apercu.marque);
                setApercu(null);
              }}
            >
              Ajouter cette forme
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setApercu(null);
              }}
            >
              Fermer l’exemple
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function TiroirWidgets({
  placees,
  donnees,
  catalogue,
  onAjouter,
}: {
  placees: ReadonlySet<string>;
  donnees: Map<string, Donnees>;
  catalogue: Catalogue;
  onAjouter: (source: string, marque: Marque) => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [apercu, setApercu] = useState<Apercu | null>(null);

  const disponibles = useMemo(() => {
    const besoin = recherche.trim().toLocaleLowerCase('fr');
    return Object.keys(catalogue).filter((source) => {
      if (placees.has(source)) return false;
      if (besoin === '') return true;
      const entree = catalogue[source];
      const texte = `${source} ${entree?.label ?? ''} ${entree?.question ?? ''} ${entree?.description ?? ''}`;
      return texte.toLocaleLowerCase('fr').includes(besoin);
    });
  }, [catalogue, placees, recherche]);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <PlusIcon aria-hidden="true" />
            Ajouter un graphique
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajouter un graphique</SheetTitle>
          <SheetDescription>
            Choisissez une question. La forme la plus lisible est proposée d’abord.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          <Input
            value={recherche}
            aria-label="Chercher une question ou un indicateur"
            placeholder="Chercher une question ou un indicateur"
            onChange={(evenement) => {
              setRecherche(evenement.target.value);
            }}
          />
          {disponibles.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
              {recherche === ''
                ? 'Toutes les questions sont déjà affichées.'
                : 'Aucun indicateur ne correspond à cette recherche.'}
            </p>
          ) : (
            disponibles.map((source) => (
              <CarteSource
                key={source}
                source={source}
                catalogue={catalogue}
                donnees={donnees}
                apercu={apercu}
                setApercu={setApercu}
                onAjouter={onAjouter}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
