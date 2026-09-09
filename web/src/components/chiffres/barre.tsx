import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { FiltresChiffres } from '@/components/chiffres/vue';
import type { SourceChiffre } from '@/components/chiffres/sources';
import { BoutonExportExcel } from '@/components/tableau-de-bord/bouton-export-excel';
import { periodeAffichee } from '@/components/tableau-de-bord/selecteur-periode';
import type { Donnees } from '@/components/tableau-de-bord/sources';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Widget } from '@/lib/data/disposition';
import { formatDate, formatDateTime } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { BlocTableauDeBord, ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';
import type { Projet } from '@/lib/types';

const TOUTE_L_EQUIPE = 'Toute l’équipe';

type Personne = { id: string; fullName: string };

/** Le nom porté par le déclencheur du sélecteur, jamais l'identifiant. */
function nomDeLEquipe(equipe: readonly Personne[], valeur: string | null): string {
  if (valeur === null || valeur === 'tous') return TOUTE_L_EQUIPE;
  return equipe.find((personne) => personne.id === valeur)?.fullName ?? TOUTE_L_EQUIPE;
}

/** Le classeur suit l'écran : ses blocs sont les cartes posées, dans leur ordre. */
function blocs(
  widgets: readonly Widget[],
  catalogue: Record<string, SourceChiffre>,
  donneesParWidget: Map<string, Donnees>,
): BlocTableauDeBord[] {
  const resultat: BlocTableauDeBord[] = [];
  for (const widget of widgets) {
    const entree = catalogue[widget.source];
    const donnee = donneesParWidget.get(widget.id);
    if (entree === undefined || donnee === undefined) continue;
    resultat.push({
      titre: entree.label,
      question: entree.question,
      groupe: entree.groupe,
      donnees: donnee,
    });
  }
  return resultat;
}

export function BarreChiffres({
  filtres,
  onFiltres,
  equipe,
  projet,
  plage,
  catalogue,
  widgets,
  donneesParWidget,
  exportPret,
  dispositionUtilisateur,
  onReinitialiser,
  reinitialisationEnCours,
  tiroir,
  edition,
}: {
  filtres: FiltresChiffres;
  onFiltres: (patch: Partial<FiltresChiffres>) => void;
  equipe: readonly Personne[];
  projet: Projet;
  plage: { du: string; au: string };
  catalogue: Record<string, SourceChiffre>;
  widgets: readonly Widget[];
  donneesParWidget: Map<string, Donnees>;
  exportPret: boolean;
  dispositionUtilisateur: boolean;
  onReinitialiser: () => void;
  reinitialisationEnCours: boolean;
  tiroir: ReactNode;
  edition: ReactNode;
}) {
  const nomProjet = projet === 'chues' ? 'CHUES' : 'Grand Public';

  function preparerClasseur(): ClasseurTableauDeBord {
    const contenu = blocs(widgets, catalogue, donneesParWidget);
    return {
      fichier: `cpi-tableau-de-bord-${projet}-${plage.du}-${plage.au}`,
      titre: `Tableau de bord ${nomProjet}`,
      sousTitre: periodeAffichee(filtres),
      reperes: [
        { libelle: 'Projet', valeur: nomProjet },
        {
          libelle: 'Période',
          valeur: `du ${formatDate(plage.du)} au ${formatDate(plage.au)}`,
        },
        { libelle: 'Téléconseiller', valeur: nomDeLEquipe(equipe, filtres.teleconseiller) },
        { libelle: 'Chiffres repris', valeur: String(contenu.length) },
        { libelle: 'Édité le', valeur: formatDateTime(new Date().toISOString()) },
      ],
      blocs: contenu,
    };
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[0.9375rem] font-[600] text-foreground" aria-live="polite">
          {periodeAffichee(filtres)}
        </p>
        {equipe.length > 0 ? (
          <Select
            items={[
              { value: 'tous', label: TOUTE_L_EQUIPE },
              ...equipe.map((personne) => ({ value: personne.id, label: personne.fullName })),
            ]}
            value={filtres.teleconseiller ?? 'tous'}
            onValueChange={(value) => {
              if (value === null) return;
              onFiltres({ teleconseiller: value === 'tous' ? null : value });
            }}
          >
            <SelectTrigger size="sm" aria-label="Téléconseiller regardé" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">{TOUTE_L_EQUIPE}</SelectItem>
              {equipe.map((personne) => (
                <SelectItem key={personne.id} value={personne.id}>
                  {personne.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Link
          {...lien(`/${projet}/rappels`)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          À rappeler
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tiroir}
        {tiroir === null ? (
          <>
            {dispositionUtilisateur ? (
              <Button
                type="button"
                variant="ghost"
                disabled={reinitialisationEnCours}
                onClick={onReinitialiser}
              >
                Revenir à l’écran par défaut
              </Button>
            ) : null}
            <BoutonExportExcel preparer={preparerClasseur} disabled={!exportPret} />
          </>
        ) : null}
        {edition}
      </div>
    </div>
  );
}
