'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Fragment } from 'react';

import { meQueryOptions } from '@/api/auth';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { dakarNow } from '@/lib/data/visites';
import { formatDateTime, formatPhone } from '@/lib/format';
import { peut } from '@/lib/types';

function NomFiche({ fiche }: { fiche: RendezVousObtenu }) {
  const { data: user } = useQuery(meQueryOptions);
  const nom = `${fiche.prenom} ${fiche.nom}`;
  if (!peut(user, 'prospects.lire')) return nom;
  return (
    <Link
      href={`/teleconseil/prospects/${fiche.id}`}
      className="underline-offset-4 hover:underline"
    >
      {nom}
    </Link>
  );
}

type Ton = 'warning' | 'success' | 'destructive' | 'outline' | 'info';

export function etatDe(fiche: RendezVousObtenu): { texte: string; ton: Ton } {
  switch (fiche.etape) {
    case 'A_CONFIRMER':
      return { texte: fiche.reporte ? 'Reporté, à confirmer' : 'À confirmer', ton: 'warning' };
    case 'CONFIRMES':
      return { texte: 'Confirmé', ton: 'info' };
    case 'EN_RETARD':
      return {
        texte: fiche.confirmation === 'CONFIRME' ? 'Confirmé' : 'Non confirmé',
        ton: 'warning',
      };
    case 'A_CLOSER':
      return { texte: 'Présent, closing à compléter', ton: 'success' };
    default:
      if (fiche.confirmation === 'ANNULE') return { texte: 'Annulé', ton: 'destructive' };
      if (fiche.issue === 'NON_HONORE') return { texte: 'Absent', ton: 'destructive' };
      return { texte: 'Closing enregistré', ton: 'success' };
  }
}

const SECTIONS = ['En retard', 'Aujourd’hui', 'Demain', 'Plus tard', 'Sans date'] as const;

function sectionDe(fiche: RendezVousObtenu, aujourdhui: string, demain: string): string {
  if (fiche.quand === null) return 'Sans date';
  const jour = fiche.quand.slice(0, 10);
  if (jour < aujourdhui) return 'En retard';
  if (jour === aujourdhui) return 'Aujourd’hui';
  return jour === demain ? 'Demain' : 'Plus tard';
}

const quandDe = (fiche: RendezVousObtenu): string =>
  fiche.quand === null ? 'Sans date' : formatDateTime(fiche.quand);

const lieuDe = (fiche: RendezVousObtenu): string =>
  fiche.site === '' ? fiche.type : `${fiche.type} · ${fiche.site}`;

function Telephone({ fiche }: { fiche: RendezVousObtenu }) {
  if (fiche.phoneE164 === null) return null;
  return (
    <a href={`tel:${fiche.phoneE164}`} className="font-mono whitespace-nowrap text-primary">
      {formatPhone(fiche.phoneE164)}
    </a>
  );
}

/** L'historique est un seul groupe ; le travail se range par jour. */
function groupes(items: RendezVousObtenu[], historique: boolean) {
  if (historique) return [{ titre: null, lignes: items }];
  const { date: aujourdhui } = dakarNow();
  const lendemain = new Date(`${aujourdhui}T12:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const { date: demain } = dakarNow(lendemain);
  return SECTIONS.map((titre) => ({
    titre,
    lignes: items.filter((fiche) => sectionDe(fiche, aujourdhui, demain) === titre),
  })).filter((groupe) => groupe.lignes.length > 0);
}

export function Groupes({
  items,
  historique,
  actions,
}: {
  items: RendezVousObtenu[];
  historique: boolean;
  actions: (fiche: RendezVousObtenu) => React.ReactNode;
}) {
  const liste = groupes(items, historique);
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <Table aria-label="Rendez-vous">
          <TableHeader>
            <TableRow>
              <TableHead>Rendez-vous le</TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.map((groupe) => (
              <Fragment key={groupe.titre ?? 'historique'}>
                {groupe.titre === null ? null : (
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell
                      colSpan={6}
                      className="py-2 text-[0.75rem] font-[700] tracking-wide text-muted-foreground uppercase"
                    >
                      {groupe.titre} ({groupe.lignes.length})
                    </TableCell>
                  </TableRow>
                )}
                {groupe.lignes.map((fiche) => {
                  const etat = etatDe(fiche);
                  return (
                    <TableRow key={fiche.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {quandDe(fiche)}
                      </TableCell>
                      <TableCell className="font-[600]">
                        <NomFiche fiche={fiche} />
                      </TableCell>
                      <TableCell>
                        <Telephone fiche={fiche} />
                      </TableCell>
                      <TableCell>{lieuDe(fiche)}</TableCell>
                      <TableCell>
                        <Badge variant={etat.ton}>{etat.texte}</Badge>
                      </TableCell>
                      <TableCell>{actions(fiche)}</TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        {liste.map((groupe) => (
          <section key={groupe.titre ?? 'historique'} className="flex flex-col gap-2">
            {groupe.titre === null ? null : (
              <h2 className="text-[0.75rem] font-[700] tracking-wide text-muted-foreground uppercase">
                {groupe.titre} ({groupe.lignes.length})
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {groupe.lignes.map((fiche) => {
                const etat = etatDe(fiche);
                return (
                  <li
                    key={fiche.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-[600]">
                        <NomFiche fiche={fiche} />
                      </p>
                      <Badge variant={etat.ton}>{etat.texte}</Badge>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {quandDe(fiche)} · {lieuDe(fiche)}
                    </p>
                    <Telephone fiche={fiche} />
                    {actions(fiche)}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
