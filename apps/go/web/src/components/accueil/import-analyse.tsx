import { AlertTriangleIcon, CheckCircle2Icon, FileSpreadsheetIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { differences, rapportDe, type TravailRegistre } from '@/lib/data/visites-import';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

function pluriel(nombre: number): string {
  return nombre > 1 ? 's' : '';
}

function Chiffre({ label, valeur, ton }: { label: string; valeur: number; ton: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-[0.75rem] font-[600] text-muted-foreground">{label}</dt>
      <dd className={cn('text-[1.5rem] font-[700] tabular-nums', ton)}>{formatNumber(valeur)}</dd>
    </div>
  );
}

function Etat({ travail }: { travail: TravailRegistre }) {
  if (travail.status === 'failed') {
    return (
      <>
        <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        {travail.failureMsg ?? 'Le classeur n’a pas pu être lu.'}
      </>
    );
  }
  if (travail.status === 'expired') {
    return (
      <>
        <AlertTriangleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Échéance passée : redéposez le fichier pour recommencer.
      </>
    );
  }
  return (
    <>
      <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden="true" />
      Analyse terminée
      {travail.finishedAt === null ? '' : `, le ${formatDateTime(travail.finishedAt)}`}.
    </>
  );
}

function LignesRefusees({ travail }: { travail: TravailRegistre }) {
  const rapport = rapportDe(travail);
  const erreurs = rapport?.errors ?? [];
  if (rapport === null || erreurs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-[0.9375rem] font-[600]">
        <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
        Lignes refusées
      </h3>
      <p className="text-[0.8125rem] text-muted-foreground">
        {formatNumber(rapport.errorRows)} ligne{pluriel(rapport.errorRows)} refusée
        {pluriel(rapport.errorRows)}
        {rapport.truncated
          ? `, ${formatNumber(rapport.maxReportedErrors)} premières affichées.`
          : '.'}{' '}
        Le numéro est celui de la ligne dans le classeur, en-tête compris.
      </p>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Ligne</TableHead>
              <TableHead className="w-56">Colonne</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {erreurs.map((erreur, index) => (
              <TableRow key={`${String(erreur.rowNumber)}-${erreur.code}-${String(index)}`}>
                <TableCell className="tabular-nums">{erreur.rowNumber}</TableCell>
                <TableCell className="text-muted-foreground">{erreur.column ?? '–'}</TableCell>
                <TableCell>{erreur.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ImportAnalyse({
  travail,
  onRecommencer,
}: {
  travail: TravailRegistre;
  onRecommencer: () => void;
}) {
  const applique = travail.status === 'succeeded' && travail.mode === 'APPLY';
  const identique =
    travail.status === 'succeeded' && travail.mode === 'DRY_RUN' && differences(travail) === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-[1.0625rem]">
          <FileSpreadsheetIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-all">{travail.fileName}</span>
          {travail.mode === 'DRY_RUN' ? <Badge variant="outline">Simulation</Badge> : null}
        </CardTitle>
        <CardDescription>3. Analyse, déposé le {formatDateTime(travail.createdAt)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p role="status" className="flex items-center gap-2 text-[0.9375rem] tabular-nums">
          <Etat travail={travail} />
        </p>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Chiffre label="À créer" valeur={travail.createdRows} ton="text-success" />
          <Chiffre label="À corriger" valeur={travail.updatedRows} ton="text-success" />
          <Chiffre label="Inchangées" valeur={travail.skippedRows} ton="text-muted-foreground" />
          <Chiffre label="Refusées" valeur={travail.errorRows} ton="text-destructive" />
        </dl>

        {identique ? (
          <p role="status" className="text-[0.875rem] text-muted-foreground">
            Votre classeur est identique au registre. Rien à appliquer.
          </p>
        ) : null}

        {applique ? (
          <p
            role="status"
            className="rounded-md border border-border bg-secondary p-4 text-[0.875rem] font-[600]"
          >
            {formatNumber(travail.createdRows)} visite{pluriel(travail.createdRows)} créée
            {pluriel(travail.createdRows)}, {formatNumber(travail.updatedRows)} corrigée
            {pluriel(travail.updatedRows)}.
          </p>
        ) : null}

        <LignesRefusees travail={travail} />

        <div>
          <Button type="button" variant="ghost" onClick={onRecommencer}>
            Déposer un autre fichier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
