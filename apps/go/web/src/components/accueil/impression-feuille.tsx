import type { ReactNode } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  COLONNES_IMPRESSION,
  COLONNES_VISITE,
  maintenantDakar,
  type ColonneImpression,
  type FiltresVisite,
  type Visite,
} from '@/lib/data/visites';
import { formatDate, formatNumber } from '@/lib/format';

export interface ColonneRegistre {
  colonne: ColonneImpression;
  className?: string;
  rendu: (visite: Visite) => ReactNode;
}

/** Le classeur, colonne à colonne, dans l'ordre où l'accueil le lit et l'imprime. */
export const COLONNES_REGISTRE: readonly ColonneRegistre[] = [
  {
    colonne: 'N° REGISTRE',
    className: 'font-[600] whitespace-nowrap',
    rendu: (visite) => visite.reference,
  },
  {
    colonne: COLONNES_VISITE.date,
    className: 'whitespace-nowrap',
    rendu: (visite) => formatDate(visite.date),
  },
  {
    colonne: COLONNES_VISITE.time,
    className: 'whitespace-nowrap',
    rendu: (visite) => visite.time ?? '',
  },
  {
    colonne: COLONNES_VISITE.visitorName,
    className: 'font-[600]',
    rendu: (visite) => visite.visitorName,
  },
  {
    colonne: COLONNES_VISITE.phone,
    className: 'whitespace-nowrap',
    rendu: (visite) => visite.phone ?? '',
  },
  { colonne: COLONNES_VISITE.entreprise, rendu: (visite) => visite.entreprise.label },
  { colonne: COLONNES_VISITE.direction, rendu: (visite) => visite.direction?.label ?? '' },
  { colonne: COLONNES_VISITE.destinataire, rendu: (visite) => visite.destinataire?.label ?? '' },
  { colonne: COLONNES_VISITE.objet, rendu: (visite) => visite.objet.label },
  {
    colonne: COLONNES_VISITE.comment,
    className: 'max-w-[20rem]',
    rendu: (visite) => visite.comment ?? '',
  },
];

function periodeTexte(filtres: FiltresVisite, aujourdhui: string): string {
  if (filtres.dateFrom !== null && filtres.dateTo !== null) {
    return `Du ${formatDate(filtres.dateFrom)} au ${formatDate(filtres.dateTo)}`;
  }
  if (filtres.dateFrom !== null) return `À partir du ${formatDate(filtres.dateFrom)}`;
  if (filtres.dateTo !== null) return `Jusqu’au ${formatDate(filtres.dateTo)}`;
  if (filtres.toutePeriode) return 'Tout le registre';
  return `Le ${formatDate(aujourdhui)}`;
}

/**
 * Masquée à l'écran, imprimée seule : fermer le dialogue avant `window.print()`
 * démonterait un tableau posé à l'intérieur.
 */
export function FeuilleImpression({
  visites,
  colonnes,
  filtres,
  aujourdhui,
}: {
  visites: readonly Visite[];
  colonnes: ReadonlySet<ColonneImpression>;
  filtres: FiltresVisite;
  aujourdhui: string;
}) {
  const retenues = COLONNES_REGISTRE.filter((entree) => colonnes.has(entree.colonne));

  return (
    <div className="hidden print:block">
      <p className="mb-1 font-[700]">Registre des visites : {periodeTexte(filtres, aujourdhui)}</p>
      <p className="mb-3 text-[0.75rem]">
        {formatNumber(visites.length)} visites, imprimé le {formatDate(maintenantDakar().date)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {COLONNES_IMPRESSION.filter((colonne) => colonnes.has(colonne)).map((colonne) => (
              <TableHead key={colonne}>{colonne}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visites.map((visite) => (
            <TableRow key={visite.id}>
              {retenues.map((entree) => (
                <TableCell key={entree.colonne} className={entree.className}>
                  {entree.rendu(visite)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
