import { AlertTriangleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';

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
import { lignesEcrites, peutAppliquer, rapportDe, type TravailImport } from '@/lib/data/imports';
import { formatNumber } from '@/lib/format';

function pluriel(compte: number): string {
  return compte > 1 ? 's' : '';
}

function Chiffre({
  label,
  valeur,
  teinte,
}: {
  label: string;
  valeur: number;
  teinte?: 'success' | 'destructive' | 'warning';
}) {
  const couleurs = {
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
  };
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 text-[1.25rem] font-[700] tabular-nums ${teinte === undefined ? '' : couleurs[teinte]}`}
      >
        {formatNumber(valeur)}
      </dd>
    </div>
  );
}

function LignesRejetees({ travail }: { travail: TravailImport }) {
  const rapport = rapportDe(travail);
  const erreurs = rapport?.errors ?? [];
  if (erreurs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
          Lignes rejetées
        </CardTitle>
        <CardDescription>
          Le numéro renvoie à la ligne DANS le classeur, en-tête compris : il suffit de l’ouvrir et
          d’y aller.
          {rapport?.truncated === true
            ? ` Seules les ${formatNumber(rapport.maxReportedErrors)} premières sont listées.`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">Ligne</TableHead>
              <TableHead>Colonne</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {erreurs.map((erreur) => (
              <TableRow key={`${String(erreur.rowNumber)}-${erreur.code}-${erreur.column ?? ''}`}>
                <TableCell className="tabular-nums">{erreur.rowNumber}</TableCell>
                <TableCell className="text-muted-foreground">{erreur.column ?? '–'}</TableCell>
                <TableCell>{erreur.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Echec({ travail }: { travail: TravailImport }) {
  if (travail.status !== 'failed') return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.875rem] text-destructive"
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {travail.failureMsg ?? 'Le classeur n’a pas pu être lu.'}
    </p>
  );
}

/** La simulation et l'application partagent le même rapport ; seul le pied change. */
export function RapportImport({
  travail,
  application,
  onAppliquer,
  onRecommencer,
}: {
  travail: TravailImport;
  application: boolean;
  onAppliquer: () => void;
  onRecommencer: () => void;
}) {
  const applique = travail.mode === 'APPLY';
  const ecrites = lignesEcrites(travail);
  const applicable = peutAppliquer(travail);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-4">
        <Chiffre label="Lignes lues" valeur={travail.totalRows ?? travail.processedRows} />
        <Chiffre label="À créer" valeur={travail.createdRows} teinte="success" />
        <Chiffre label="À mettre à jour" valeur={travail.updatedRows} teinte="warning" />
        <Chiffre label="En erreur" valeur={travail.errorRows} teinte="destructive" />
      </dl>

      <Echec travail={travail} />

      {applique ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
        >
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 text-[0.875rem]">
            <p className="font-[600]">
              {formatNumber(ecrites)} fiche{pluriel(ecrites)} écrite{pluriel(ecrites)}.
            </p>
            <p className="mt-1 text-muted-foreground">
              Les lignes en erreur n’ont pas été écrites. Corrigez-les dans le classeur et
              redéposez-le : les doublons seront de nouveau écartés.
            </p>
          </div>
        </div>
      ) : null}

      <LignesRejetees travail={travail} />

      <div className="flex flex-wrap items-center gap-3">
        {applique ? (
          <Button type="button" onClick={onRecommencer}>
            Importer un autre fichier
          </Button>
        ) : (
          <>
            <Button type="button" disabled={application || !applicable} onClick={onAppliquer}>
              {application ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {`Écrire ${formatNumber(ecrites)} fiche${pluriel(ecrites)}`}
            </Button>
            <Button type="button" variant="ghost" disabled={application} onClick={onRecommencer}>
              Changer de fichier
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
