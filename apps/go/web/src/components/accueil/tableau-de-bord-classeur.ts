import type { SourceVisite } from '@/components/accueil/sources-visites';
import type { Donnees } from '@/components/tableau-de-bord/sources';
import type { Widget } from '@/lib/data/disposition';
import { formatDate, formatDateTime } from '@/lib/format';
import type { BlocTableauDeBord, ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';

/** L'onglet où chaque source se range : ce qui se lit ensemble reste ensemble. */
const GROUPES: Readonly<Record<string, string>> = {
  'par-entreprise': 'Qui vient, et pourquoi',
  'par-objet': 'Qui vient, et pourquoi',
  'par-entreprise-objet': 'Qui vient, et pourquoi',
  'visiteurs-recurrents': 'Qui vient, et pourquoi',
  'par-direction': 'Qui reçoit',
  'par-destinataire': 'Qui reçoit',
  'par-destinataire-direction': 'Qui reçoit',
  'par-jour': 'Dans le temps',
  'par-mois': 'Dans le temps',
  'par-heure': 'Dans le temps',
  'par-jour-semaine': 'Dans le temps',
  'par-heure-jour-semaine': 'Dans le temps',
  'par-objet-mois': 'Dans le temps',
  'par-agent': 'Travail de l’accueil',
  'qualite-de-saisie': 'Travail de l’accueil',
  'avec-telephone': 'Travail de l’accueil',
};

/** Le classeur suit l'écran : ses blocs sont les cartes posées, dans leur ordre. */
export function classeurDesVisites({
  widgets,
  catalogue,
  donnees,
  plage,
  periode,
}: {
  widgets: readonly Widget[];
  catalogue: Readonly<Record<string, SourceVisite>>;
  donnees: Map<string, Donnees>;
  plage: { du: string; au: string };
  periode: string;
}): ClasseurTableauDeBord {
  const blocs: BlocTableauDeBord[] = [];
  for (const widget of widgets) {
    const entree = catalogue[widget.source];
    const donnee = donnees.get(widget.id);
    if (entree === undefined || donnee === undefined) continue;
    blocs.push({
      titre: entree.label,
      question: entree.question,
      groupe: GROUPES[widget.source],
      donnees: donnee,
    });
  }

  return {
    fichier: `cpi-visites-${plage.du}-${plage.au}`,
    titre: 'Tableau de bord des visites',
    sousTitre: periode,
    reperes: [
      { libelle: 'Registre', valeur: 'Visites reçues à l’accueil' },
      { libelle: 'Période', valeur: `du ${formatDate(plage.du)} au ${formatDate(plage.au)}` },
      { libelle: 'Chiffres repris', valeur: String(blocs.length) },
      { libelle: 'Édité le', valeur: formatDateTime(new Date().toISOString()) },
    ],
    blocs,
  };
}
