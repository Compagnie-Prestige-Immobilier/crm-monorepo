import { PrinterIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { FeuilleImpression } from '@/components/accueil/impression-feuille';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  basculerColonneImpression,
  COLONNES_IMPRESSION,
  COLONNES_IMPRESSION_VERROUILLEES,
  fetchVisites,
  type ColonneImpression,
  type FiltresVisite,
  type Visite,
} from '@/lib/data/visites';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

/** Le serveur plafonne une page à 200 lignes : au-delà, il faut plusieurs appels. */
const PAGE_IMPRESSION = 200;
/** Estimation d'affichage seulement : la mise en page réelle dépend du navigateur. */
const LIGNES_PAR_FEUILLE = 45;
const PLAFOND_TOTAL = 3000;

const ORIENTATIONS = [
  ['landscape', 'Paysage', 'Recommandé pour toutes les colonnes'],
  ['portrait', 'Portrait', 'Pour une liste plus étroite'],
] as const;

export type Orientation = (typeof ORIENTATIONS)[number][0];

function feuillesEnviron(lignes: number): number {
  return Math.max(1, Math.ceil(lignes / LIGNES_PAR_FEUILLE));
}

function ChoixRadio({
  nom,
  choisi,
  libelle,
  detail,
  desactive = false,
  onChoisir,
}: {
  nom: string;
  choisi: boolean;
  libelle: string;
  detail: string;
  desactive?: boolean;
  onChoisir: () => void;
}) {
  return (
    <label
      className={
        desactive
          ? 'flex cursor-not-allowed items-start gap-3 rounded-md border border-border p-3 opacity-50'
          : `flex cursor-pointer items-start gap-3 rounded-md border p-3 ${choisi ? 'border-primary bg-secondary' : 'border-border'}`
      }
    >
      <input
        type="radio"
        name={nom}
        checked={choisi}
        disabled={desactive}
        className="mt-0.5 size-4 accent-[var(--primary)]"
        onChange={onChoisir}
      />
      <span>
        <span className="block text-[0.875rem] font-[600]">{libelle}</span>
        <span className="block text-[0.75rem] text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

export function ImpressionDialog({
  open,
  onOpenChange,
  orientation,
  onOrientationChange,
  colonnes,
  onColonnesChange,
  filtres,
  aujourdhui,
  total,
  lignesAffichees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orientation: Orientation;
  onOrientationChange: (valeur: Orientation) => void;
  colonnes: ReadonlySet<ColonneImpression>;
  onColonnesChange: (colonnes: ReadonlySet<ColonneImpression>) => void;
  filtres: FiltresVisite;
  aujourdhui: string;
  total: number;
  lignesAffichees: number;
}) {
  const [portee, setPortee] = useState<'page' | 'tout'>('page');
  const [avancement, setAvancement] = useState<{ chargees: number; feuilles: number } | null>(null);
  const [toutes, setToutes] = useState<Visite[] | null>(null);
  const annuleRef = useRef(false);

  const trop = total > PLAFOND_TOTAL;

  // `window.print()` photographie le DOM déjà peint : appelé avant que React
  // n'ait commité le tableau complet, il n'imprimerait que l'écran précédent.
  useEffect(() => {
    if (toutes === null) return;
    const frame = requestAnimationFrame(() => {
      window.print();
    });
    const apres = (): void => {
      setToutes(null);
    };
    window.addEventListener('afterprint', apres);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', apres);
    };
  }, [toutes]);

  async function chargerPuisImprimer(): Promise<void> {
    annuleRef.current = false;
    const annule = (): boolean => annuleRef.current;
    const feuilles = Math.max(1, Math.ceil(total / PAGE_IMPRESSION));
    setAvancement({ chargees: 0, feuilles });

    const cumul: Visite[] = [];
    try {
      for (let page = 1; page <= feuilles && !annule(); page += 1) {
        const lot = await fetchVisites({ ...filtres, page, pageSize: PAGE_IMPRESSION }, aujourdhui);
        cumul.push(...lot.items);
        setAvancement({ chargees: page, feuilles });
      }
    } catch (error) {
      setAvancement(null);
      toastApiError(error, 'Le registre complet n’a pas pu être chargé.');
      return;
    }

    setAvancement(null);
    if (annule()) return;
    onOpenChange(false);
    setToutes(cumul);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Préparer l’impression</DialogTitle>
            <DialogDescription>
              Les filtres et la période affichés seront conservés.
            </DialogDescription>
          </DialogHeader>

          {avancement === null ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Quoi imprimer</legend>
                <ChoixRadio
                  nom="portee-impression"
                  choisi={portee === 'page'}
                  libelle="La page affichée"
                  detail={`${formatNumber(lignesAffichees)} visites, environ ${formatNumber(feuillesEnviron(lignesAffichees))} pages`}
                  onChoisir={() => {
                    setPortee('page');
                  }}
                />
                <ChoixRadio
                  nom="portee-impression"
                  choisi={portee === 'tout'}
                  desactive={trop}
                  libelle="Tout le résultat filtré"
                  detail={`${formatNumber(total)} visites, environ ${formatNumber(feuillesEnviron(total))} pages`}
                  onChoisir={() => {
                    setPortee('tout');
                  }}
                />
                {trop ? (
                  <p role="alert" className="text-[0.8125rem] text-destructive">
                    {formatNumber(total)} visites : trop pour une impression. Réduisez la période,
                    ou exportez en Excel.
                  </p>
                ) : null}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Orientation</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ORIENTATIONS.map(([valeur, libelle, detail]) => (
                    <ChoixRadio
                      key={valeur}
                      nom="orientation-impression"
                      choisi={orientation === valeur}
                      libelle={libelle}
                      detail={detail}
                      onChoisir={() => {
                        onOrientationChange(valeur);
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[0.8125rem] font-[600]">Colonnes</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {COLONNES_IMPRESSION.map((colonne) => (
                    <label
                      key={colonne}
                      className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-[0.8125rem]"
                    >
                      <input
                        type="checkbox"
                        checked={colonnes.has(colonne)}
                        disabled={COLONNES_IMPRESSION_VERROUILLEES.includes(colonne)}
                        className="size-4 accent-[var(--primary)] disabled:opacity-40"
                        onChange={() => {
                          onColonnesChange(basculerColonneImpression(colonnes, colonne));
                        }}
                      />
                      {colonne}
                    </label>
                  ))}
                </div>
              </fieldset>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (portee === 'tout') {
                      void chargerPuisImprimer();
                      return;
                    }
                    onOpenChange(false);
                    window.print();
                  }}
                >
                  <PrinterIcon aria-hidden="true" />
                  Ouvrir l’impression
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[0.875rem]" role="status">
                Chargement des visites, page {avancement.chargees} sur {avancement.feuilles}
              </p>
              <Progress value={avancement.chargees} max={avancement.feuilles} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  annuleRef.current = true;
                }}
              >
                Annuler
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toutes === null ? null : (
        <FeuilleImpression
          visites={toutes}
          colonnes={colonnes}
          filtres={filtres}
          aujourdhui={aujourdhui}
        />
      )}
    </>
  );
}
