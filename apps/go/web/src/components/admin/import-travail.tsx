import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
} from 'lucide-react';

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
import {
  importEnCours,
  lignesEcrites,
  LIBELLES_GENRE,
  peutAppliquer,
  rapportDe,
  type TravailImport,
} from '@/lib/data/imports';
import { formatDateTime, formatNumber } from '@/lib/format';

function libelleEtat(travail: TravailImport): string {
  if (travail.status === 'queued') return 'En file d’attente';
  if (travail.status === 'running') {
    return travail.mode === 'APPLY' ? 'Application en cours' : 'Simulation en cours';
  }
  if (travail.status === 'succeeded') {
    return travail.mode === 'APPLY' ? 'Appliqué' : 'Simulation terminée';
  }
  if (travail.status === 'failed') return 'Échec';
  return 'Échu';
}

/** `expired` prend la teinte neutre : le classeur a passé son échéance, rien n'a échoué. */
function teinteEtat(travail: TravailImport): 'default' | 'secondary' | 'success' | 'destructive' {
  if (travail.status === 'succeeded') return 'success';
  if (travail.status === 'failed') return 'destructive';
  if (travail.status === 'expired') return 'secondary';
  return 'default';
}

/*
 * `totalRows` reste nul tant que le serveur n'a pas lu l'en-tête, et peut le
 * rester : `<dimension>` est facultatif dans le format xlsx. Un pourcentage
 * calculé dessus afficherait 0 % sur un import sain.
 */
function libelleAvancement(travail: TravailImport): string {
  if (travail.totalRows === null) {
    return travail.status === 'queued' ? 'En file d’attente.' : 'Lecture du fichier…';
  }
  return `${formatNumber(travail.processedRows)} / ${formatNumber(travail.totalRows)} lignes traitées`;
}

/** Le bouton porte le chiffre : « Appliquer » ne se relit pas, « Créer 12 480 lignes » si. */
export function libelleApplication(travail: TravailImport): string {
  if (travail.updatedRows === 0) return `Créer ${formatNumber(travail.createdRows)} lignes`;
  return `Appliquer ${formatNumber(travail.createdRows)} créations et ${formatNumber(
    travail.updatedRows,
  )} corrections`;
}

function EtatTerminal({ travail }: { travail: TravailImport }) {
  if (travail.status === 'succeeded') {
    return (
      <>
        <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden="true" />
        {formatNumber(travail.processedRows)} lignes traitées
        {travail.finishedAt === null ? '' : `, terminé le ${formatDateTime(travail.finishedAt)}`}.
      </>
    );
  }
  if (travail.status === 'expired') {
    return (
      <>
        <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Échéance passée : le classeur et le rapport ont été détruits. Redéposez le fichier.
      </>
    );
  }
  return (
    <>
      <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      {travail.failureMsg ?? 'Le travail a échoué.'}
    </>
  );
}

function Compteur({ label, valeur, ton }: { label: string; valeur: number; ton?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className={`font-display text-[1.5rem] font-[800] tabular-nums ${ton ?? ''}`}>
        {formatNumber(valeur)}
      </dd>
    </div>
  );
}

function LignesRefusees({ travail }: { travail: TravailImport }) {
  const rapport = rapportDe(travail);
  const erreurs = rapport?.errors ?? [];
  if (rapport === null || erreurs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
          Lignes refusées
        </CardTitle>
        <CardDescription>
          {rapport.truncated
            ? `${formatNumber(rapport.maxReportedErrors)} premières erreurs sur ${formatNumber(
                rapport.errorRows,
              )}. Corrigez celles-ci et redéposez le fichier.`
            : `${formatNumber(rapport.errorRows)} lignes refusées.`}{' '}
          Le numéro est celui de la ligne dans le classeur, en-tête compris.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Ligne</TableHead>
              <TableHead className="w-56">Colonne</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {erreurs.map((erreur, rang) => (
              <TableRow key={`${String(erreur.rowNumber)}-${erreur.code}-${String(rang)}`}>
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

export function PanneauTravail({
  travail,
  applique,
  onAppliquer,
  onRecommencer,
}: {
  travail: TravailImport;
  applique: boolean;
  onAppliquer: () => void;
  onRecommencer: () => void;
}) {
  const enCours = importEnCours(travail);
  const simule = travail.mode === 'DRY_RUN';

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-[1.0625rem]">
            <FileSpreadsheetIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">{travail.fileName}</span>
            <Badge variant={teinteEtat(travail)}>{libelleEtat(travail)}</Badge>
            {simule ? <Badge variant="outline">Simulation</Badge> : null}
          </CardTitle>
          <CardDescription>
            {LIBELLES_GENRE[travail.kind]} · déposé le {formatDateTime(travail.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p role="status" className="flex items-center gap-2 text-[0.9375rem] tabular-nums">
            {enCours ? (
              <>
                <LoaderIcon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                {libelleAvancement(travail)}
              </>
            ) : (
              <EtatTerminal travail={travail} />
            )}
          </p>

          {enCours ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              Vous pouvez quitter cet écran : le travail court sur le serveur et se retrouve dans
              l’historique.
            </p>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Compteur
              label={simule ? 'À créer' : 'Créées'}
              valeur={travail.createdRows}
              ton="text-success"
            />
            <Compteur label={simule ? 'À corriger' : 'Corrigées'} valeur={travail.updatedRows} />
            <Compteur label="Déjà en base" valeur={travail.skippedRows} />
            <Compteur label="Refusées" valeur={travail.errorRows} ton="text-destructive" />
          </dl>
        </CardContent>
      </Card>

      <BandeauApplique travail={travail} />

      <LignesRefusees travail={travail} />

      <ActionsTravail
        travail={travail}
        applique={applique}
        enCours={enCours}
        onAppliquer={onAppliquer}
        onRecommencer={onRecommencer}
      />
    </div>
  );
}

function BandeauApplique({ travail }: { travail: TravailImport }) {
  if (travail.status !== 'succeeded' || travail.mode !== 'APPLY') return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
    >
      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 text-[0.875rem]">
        <p className="font-[600]">{formatNumber(lignesEcrites(travail))} lignes écrites.</p>
        <p className="mt-1 text-muted-foreground">
          Corrigez les lignes refusées dans le classeur et redéposez-le : ce qui est déjà en base
          sera de nouveau ignoré, sans doublon.
        </p>
      </div>
    </div>
  );
}

function ActionsTravail({
  travail,
  applique,
  enCours,
  onAppliquer,
  onRecommencer,
}: {
  travail: TravailImport;
  applique: boolean;
  enCours: boolean;
  onAppliquer: () => void;
  onRecommencer: () => void;
}) {
  const vide =
    travail.status === 'succeeded' && travail.mode === 'DRY_RUN' && lignesEcrites(travail) === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {peutAppliquer(travail) ? (
          <Button type="button" disabled={applique} onClick={onAppliquer}>
            {applique ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {libelleApplication(travail)}
          </Button>
        ) : null}
        {enCours ? null : (
          <Button type="button" variant="ghost" disabled={applique} onClick={onRecommencer}>
            Déposer un autre fichier
          </Button>
        )}
      </div>

      {vide ? (
        <p className="text-[0.875rem] text-muted-foreground">
          Aucune ligne à écrire : tout le fichier est soit déjà en base, soit refusé.
        </p>
      ) : null}
    </>
  );
}
