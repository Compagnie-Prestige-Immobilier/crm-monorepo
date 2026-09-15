import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  leadsImportesQuery,
  type ImportDeLeads,
  type LeadTresInteresse,
} from '@/lib/data/leads-importes';
import { formatDate, formatDateTime, formatNumber, formatPhone } from '@/lib/format';

function taux(part: number, total: number): string {
  if (total === 0) return 'Sans objet';
  return `${formatNumber(Math.round((part / total) * 100))} %`;
}

export function LeadsImportesView() {
  const leads = useQuery(leadsImportesQuery());

  if (leads.isError) {
    return <QueryErrorState error={leads.error} onRetry={() => void leads.refetch()} />;
  }
  if (leads.data === undefined) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
        Les leads importés dont le dernier appel a donné Demande d’information, RDV téléphonique,
        Transfert enrôlement ou Construction. Chaque classeur dit ce qu’il a rapporté.
      </p>
      <Imports imports={leads.data.imports} />
      <Fiches fiches={leads.data.fiches} />
    </div>
  );
}

function Imports({ imports }: { imports: ImportDeLeads[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">Qualité des imports</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Classeur</TableHead>
            <TableHead>Importé le</TableHead>
            <TableHead className="text-right">Fiches</TableHead>
            <TableHead className="text-right">Appelées</TableHead>
            <TableHead className="text-right">Jointes</TableHead>
            <TableHead className="text-right">Très intéressées</TableHead>
            <TableHead className="text-right">Part des fiches</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Aucun classeur de leads importé. Le marketing dépose le sien sur SharePoint, il est
                relevé tous les quarts d’heure.
              </TableCell>
            </TableRow>
          ) : null}
          {imports.map((lot) => (
            <TableRow key={lot.id}>
              <TableCell className="font-[600]">{lot.fichier}</TableCell>
              <TableCell>{formatDate(lot.importeLe)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(lot.importes)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(lot.appeles)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(lot.joints)}</TableCell>
              <TableCell className="text-right tabular-nums font-[600]">
                {formatNumber(lot.interesses)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {taux(lot.interesses, lot.importes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function Fiches({ fiches }: { fiches: LeadTresInteresse[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">Fiches très intéressées</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Classeur</TableHead>
            <TableHead>Dernier appel</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Commentaire</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fiches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Aucune fiche pour le moment. Elles apparaissent ici dès qu’un téléconseiller
                consigne l’un des quatre motifs sur un lead importé.
              </TableCell>
            </TableRow>
          ) : null}
          {fiches.map((fiche) => (
            <TableRow key={fiche.id}>
              <TableCell>
                <Link
                  to="/teleconseil/prospects/$id"
                  params={{ id: fiche.id }}
                  className="font-[600] underline underline-offset-4"
                >
                  {fiche.prenom} {fiche.nom}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatPhone(fiche.phoneE164)}</TableCell>
              <TableCell>
                {fiche.fichier}
                {fiche.feuille === null ? null : (
                  <Badge variant="outline" className="ml-2">
                    {fiche.feuille}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(fiche.appeleLe)}
                <span className="block text-muted-foreground">par {fiche.appelePar}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{fiche.motif}</Badge>
              </TableCell>
              <TableCell className="max-w-96 text-muted-foreground">
                {fiche.commentaire ?? ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
