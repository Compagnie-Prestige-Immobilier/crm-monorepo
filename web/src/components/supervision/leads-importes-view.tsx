import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { RechercheTableau, useTriLocal } from '@/components/ui/tri-local';
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
      <Fiches fiches={leads.data.fiches} total={leads.data.totalFiches} />
    </div>
  );
}

const COLONNES_IMPORTS = {
  fichier: (lot: ImportDeLeads) => lot.fichier,
  importeLe: (lot: ImportDeLeads) => lot.importeLe,
  importes: (lot: ImportDeLeads) => lot.importes,
  appeles: (lot: ImportDeLeads) => lot.appeles,
  joints: (lot: ImportDeLeads) => lot.joints,
  interesses: (lot: ImportDeLeads) => lot.interesses,
  part: (lot: ImportDeLeads) => (lot.importes === 0 ? null : lot.interesses / lot.importes),
};

const ENTETES_IMPORTS = [
  { id: 'fichier', label: 'Classeur' },
  { id: 'importeLe', label: 'Importé le' },
  { id: 'importes', label: 'Fiches', className: 'text-right' },
  { id: 'appeles', label: 'Appelées', className: 'text-right' },
  { id: 'joints', label: 'Jointes', className: 'text-right' },
  { id: 'interesses', label: 'Très intéressées', className: 'text-right' },
  { id: 'part', label: 'Part des fiches', className: 'text-right' },
] as const;

function Imports({ imports }: { imports: ImportDeLeads[] }) {
  const tri = useTriLocal(imports, COLONNES_IMPORTS);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">Qualité des imports</h2>
      <RechercheTableau
        recherche={tri.recherche}
        setRecherche={tri.setRecherche}
        total={tri.total}
        affichees={tri.lignes.length}
      />
      <Table>
        <TableHeader>
          <TableRow>
            {ENTETES_IMPORTS.map((colonne) => (
              <SortableTableHead
                key={colonne.id}
                column={colonne}
                className={'className' in colonne ? colonne.className : undefined}
                sortBy={tri.sortBy}
                sortDir={tri.sortDir}
                onToggle={tri.toggle}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.length > 0 && tri.lignes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Aucun classeur ne correspond à la recherche.
              </TableCell>
            </TableRow>
          ) : null}
          {imports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Aucun classeur de leads importé. Le marketing dépose le sien sur SharePoint, il est
                relevé tous les quarts d’heure.
              </TableCell>
            </TableRow>
          ) : null}
          {tri.lignes.map((lot) => (
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

const COLONNES_FICHES = {
  nom: (fiche: LeadTresInteresse) => `${fiche.prenom} ${fiche.nom}`,
  telephone: (fiche: LeadTresInteresse) => fiche.phoneE164,
  classeur: (fiche: LeadTresInteresse) => `${fiche.fichier} ${fiche.feuille ?? ''}`,
  appeleLe: (fiche: LeadTresInteresse) => fiche.appeleLe,
  appelePar: (fiche: LeadTresInteresse) => fiche.appelePar,
  motif: (fiche: LeadTresInteresse) => fiche.motif,
  commentaire: (fiche: LeadTresInteresse) => fiche.commentaire,
};

const ENTETES_FICHES = [
  { id: 'nom', label: 'Nom' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'classeur', label: 'Classeur' },
  { id: 'appeleLe', label: 'Dernier appel' },
  { id: 'motif', label: 'Motif' },
  { id: 'commentaire', label: 'Commentaire' },
] as const;

function Fiches({ fiches, total }: { fiches: LeadTresInteresse[]; total: number }) {
  const tri = useTriLocal(fiches, COLONNES_FICHES);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">Fiches très intéressées</h2>
      {total > fiches.length ? (
        <p className="text-[0.875rem] text-muted-foreground">
          {formatNumber(total)} fiches au total, les {formatNumber(fiches.length)} appelées le plus
          récemment affichées.
        </p>
      ) : null}
      <RechercheTableau
        recherche={tri.recherche}
        setRecherche={tri.setRecherche}
        total={tri.total}
        affichees={tri.lignes.length}
      />
      <Table>
        <TableHeader>
          <TableRow>
            {ENTETES_FICHES.map((colonne) => (
              <SortableTableHead
                key={colonne.id}
                column={colonne}
                sortBy={tri.sortBy}
                sortDir={tri.sortDir}
                onToggle={tri.toggle}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fiches.length > 0 && tri.lignes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Aucune fiche ne correspond à la recherche.
              </TableCell>
            </TableRow>
          ) : null}
          {fiches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Aucune fiche pour le moment. Elles apparaissent ici dès qu’un téléconseiller
                consigne l’un des quatre motifs sur un lead importé.
              </TableCell>
            </TableRow>
          ) : null}
          {tri.lignes.map((fiche) => (
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
