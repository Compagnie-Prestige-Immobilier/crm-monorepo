import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';

import { dureeAffichee, type Colonne } from '@/components/supervision/colonnes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  CleTri,
  Compteurs,
  Ligne,
  SensTri,
  Totaux,
  TotauxParTranche,
} from '@/lib/data/activite-agregats';
import { formatDecimal, formatNumber, formatRateOrNone, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function valeurAffichee(colonne: Colonne, valeur: number | null, decimal = false): string {
  if (colonne.taux === true) return formatRateOrNone(valeur);
  if (colonne.duree === true) return dureeAffichee(valeur);
  const nombre = valeur ?? 0;
  return decimal ? formatDecimal(nombre) : formatNumber(nombre);
}

function Cellule({
  colonne,
  valeur,
  decimal = false,
}: {
  colonne: Colonne;
  valeur: number | null;
  decimal?: boolean;
}) {
  return (
    <TableCell className={cn('text-right', valeur === null && 'text-muted-foreground')}>
      {valeurAffichee(colonne, valeur, decimal)}
    </TableCell>
  );
}

function BoutonTri({
  label,
  actif,
  sens,
  onClick,
}: {
  label: string;
  actif: boolean;
  sens: SensTri;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-inherit hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
      {!actif ? <ChevronsUpDownIcon className="size-3.5 opacity-40" aria-hidden="true" /> : null}
      {actif && sens === 'asc' ? <ArrowUpIcon className="size-3.5" aria-hidden="true" /> : null}
      {actif && sens === 'desc' ? <ArrowDownIcon className="size-3.5" aria-hidden="true" /> : null}
    </button>
  );
}

const ariaTri = (actif: boolean, sens: SensTri): 'ascending' | 'descending' | 'none' => {
  if (!actif) return 'none';
  return sens === 'asc' ? 'ascending' : 'descending';
};

function LigneTotaux({
  label,
  valeurs,
  colonnes,
  decimal = false,
}: {
  label: string;
  valeurs: Compteurs;
  colonnes: readonly Colonne[];
  decimal?: boolean;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <th scope="row" className="px-3 py-2.5 text-left font-[600]">
        {label}
      </th>
      {colonnes.map((colonne) => (
        <Cellule
          key={colonne.cle}
          colonne={colonne}
          valeur={valeurs[colonne.cle]}
          decimal={decimal}
        />
      ))}
    </TableRow>
  );
}

export function TableauActivite({
  lignes,
  totaux,
  moyennes,
  colonnes,
  cleTri,
  sens,
  onTrier,
}: {
  lignes: readonly Ligne[];
  totaux: Totaux;
  moyennes: Compteurs;
  colonnes: readonly Colonne[];
  cleTri: CleTri;
  sens: SensTri;
  onTrier: (cle: CleTri) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead aria-sort={ariaTri(cleTri === 'name', sens)}>
                <BoutonTri
                  label="Téléconseiller"
                  actif={cleTri === 'name'}
                  sens={sens}
                  onClick={() => {
                    onTrier('name');
                  }}
                />
              </TableHead>
              {colonnes.map((colonne) => (
                <TableHead
                  key={colonne.cle}
                  className="text-right"
                  aria-sort={ariaTri(cleTri === colonne.cle, sens)}
                >
                  <BoutonTri
                    label={colonne.label}
                    actif={cleTri === colonne.cle}
                    sens={sens}
                    onClick={() => {
                      onTrier(colonne.cle);
                    }}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne) => (
              <TableRow
                key={ligne.id}
                className={cn(!ligne.hasActivity && 'bg-secondary/40 text-muted-foreground')}
              >
                <th scope="row" className="px-3 py-2.5 text-left font-[400]">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-[600]">{ligne.name}</span>
                    {!ligne.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                    {!ligne.hasActivity ? <Badge variant="outline">Aucun acte</Badge> : null}
                  </span>
                </th>
                {colonnes.map((colonne) => (
                  <Cellule key={colonne.cle} colonne={colonne} valeur={ligne[colonne.cle]} />
                ))}
              </TableRow>
            ))}
            {lignes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colonnes.length + 1} className="py-8 text-center">
                  Aucun compte téléconseiller. Créez-en un depuis les comptes.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
          {lignes.length > 0 ? (
            <TableFooter>
              <LigneTotaux label="Total équipe" valeurs={totaux} colonnes={colonnes} />
              <LigneTotaux
                label="Moyenne par téléconseiller"
                valeurs={moyennes}
                colonnes={colonnes}
                decimal
              />
            </TableFooter>
          ) : null}
        </Table>
      </CardContent>
    </Card>
  );
}

export function TableauParTranche({
  tranches,
  colonnes,
  granularite,
}: {
  tranches: readonly TotauxParTranche[];
  colonnes: readonly Colonne[];
  granularite: 'day' | 'week';
}) {
  if (tranches.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <caption className="px-3 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            {granularite === 'week' ? 'Équipe, par semaine' : 'Équipe, par jour'}
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{granularite === 'week' ? 'Semaine' : 'Jour'}</TableHead>
              {colonnes.map((colonne) => (
                <TableHead key={colonne.cle} className="text-right">
                  {colonne.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tranches.map((tranche) => (
              <TableRow key={tranche.bucket}>
                <TableCell className="font-[600]">
                  {granularite === 'week'
                    ? `Semaine du ${formatShortDate(tranche.bucket)}`
                    : formatShortDate(tranche.bucket)}
                </TableCell>
                {colonnes.map((colonne) => (
                  <Cellule key={colonne.cle} colonne={colonne} valeur={tranche[colonne.cle]} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
