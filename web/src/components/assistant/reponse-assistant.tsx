'use client';

import { ResponsiveBar } from '@nivo/bar';
import { DownloadIcon } from 'lucide-react';

import { useNivo } from '@/components/exploitation/nivo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { csvRows, downloadCsv } from '@/lib/csv';
import { type ReponseAssistant } from '@/lib/data/assistant';

const TITRES: Record<string, string> = {
  appels: 'Appels',
  conversions_par_canal: 'Conversions par canal',
  prevision_conversions: 'Prévision des conversions',
};

function exporter(reponse: ReponseAssistant): void {
  const tableau = reponse.resultat?.tableau;
  if (tableau === undefined) return;
  downloadCsv(
    csvRows([tableau.colonnes, ...tableau.lignes]),
    `assistant-${reponse.outil}-${reponse.du}-${reponse.au}.csv`,
  );
}

function Graphique({
  serie,
  mesure,
}: {
  serie: { libelle: string; valeur: number }[];
  mesure: string;
}) {
  const { couleurs, nivo, animate } = useNivo();
  const epais = serie.length <= 12;
  return (
    <div className="h-64">
      <ResponsiveBar
        data={serie.map((point) => ({ libelle: point.libelle, valeur: point.valeur }))}
        keys={['valeur']}
        indexBy="libelle"
        role="img"
        ariaLabel={mesure}
        margin={{ top: 8, right: 8, bottom: 64, left: 56 }}
        padding={epais ? 0.3 : 0.1}
        colors={[couleurs[0] ?? '#630210']}
        theme={nivo}
        animate={animate}
        enableLabel={false}
        axisLeft={{ legend: mesure, legendOffset: -48, legendPosition: 'middle' }}
        axisBottom={{ tickRotation: serie.length > 6 ? -40 : 0 }}
      />
    </div>
  );
}

export function ReponseCard({ reponse }: { reponse: ReponseAssistant }) {
  const resultat = reponse.resultat;
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {resultat === undefined ? null : (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {TITRES[reponse.outil] ?? reponse.outil}
                {reponse.du === '' ? '' : ` · du ${reponse.du} au ${reponse.au}`}
              </p>
            )}
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground">{reponse.texte}</p>
          </div>
          {resultat === undefined ? null : (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exporter(reponse);
                }}
                className="gap-1.5"
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
                Export CSV
              </Button>
            </div>
          )}
        </div>

        {resultat !== undefined && resultat.serie.length > 0 ? (
          <Graphique serie={resultat.serie} mesure={resultat.mesure} />
        ) : null}

        {resultat === undefined ? null : (
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {resultat.tableau.colonnes.map((colonne) => (
                    <TableHead key={colonne}>{colonne}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultat.tableau.lignes.map((ligne, index) => (
                  <TableRow key={`${ligne[0] ?? ''}-${String(index)}`}>
                    {ligne.map((cellule, colonne) => (
                      <TableCell key={`${resultat.tableau.colonnes[colonne] ?? ''}`}>
                        {cellule}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Chiffres lus dans la base. Lecture écrite par {reponse.reponduPar}.
        </p>
      </CardContent>
    </Card>
  );
}
