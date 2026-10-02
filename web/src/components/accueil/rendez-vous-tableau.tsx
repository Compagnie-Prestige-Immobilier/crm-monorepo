'use client';

import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { FichePopup } from '@/components/accueil/fiche-popup';
import { PastilleQualification } from '@/components/prospects/etiquettes-statut';
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
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { peut } from '@/lib/types';

function NomFiche({ fiche }: { fiche: RendezVousObtenu }) {
  const { data: user } = useQuery(meQueryOptions);
  const [ouverte, setOuverte] = useState(false);
  const nom = `${fiche.prenom} ${fiche.nom}`;
  if (!peut(user, 'prospects.lire')) return nom;
  return (
    <>
      <button
        type="button"
        className="text-left underline-offset-4 hover:underline"
        onClick={() => {
          setOuverte(true);
        }}
      >
        {nom}
      </button>
      <FichePopup
        prospectId={ouverte ? fiche.id : null}
        onClose={() => {
          setOuverte(false);
        }}
      />
    </>
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
    case 'A_RECONTACTER':
      return etatARecontacter(fiche);
    default:
      return etatHistorique(fiche);
  }
}

function etatARecontacter(fiche: RendezVousObtenu): { texte: string; ton: Ton } {
  if (fiche.recontacterLe !== '' && fiche.recontacterLe <= dakarNow().date) {
    return { texte: 'À recontacter, date arrivée', ton: 'destructive' };
  }
  return { texte: 'À recontacter', ton: 'outline' };
}

function etatHistorique(fiche: RendezVousObtenu): { texte: string; ton: Ton } {
  if (fiche.confirmation === 'ANNULE') return { texte: 'Annulé', ton: 'destructive' };
  if (fiche.issue === 'NON_HONORE') return { texte: 'Absent', ton: 'destructive' };
  return { texte: 'Closing enregistré', ton: 'success' };
}

const SECTIONS = [
  'À recontacter',
  'En retard',
  'Aujourd’hui',
  'Demain',
  'Plus tard',
  'Sans date',
] as const;

function sectionDe(fiche: RendezVousObtenu, aujourdhui: string, demain: string): string {
  if (fiche.etape === 'A_RECONTACTER') return 'À recontacter';
  if (fiche.quand === null) return 'Sans date';
  const jour = fiche.quand.slice(0, 10);
  if (jour < aujourdhui) return 'En retard';
  if (jour === aujourdhui) return 'Aujourd’hui';
  return jour === demain ? 'Demain' : 'Plus tard';
}

function quandDe(fiche: RendezVousObtenu): string {
  if (fiche.etape === 'A_RECONTACTER') {
    return fiche.recontacterLe === ''
      ? 'Date à fixer'
      : `Recontacter le ${formatDate(fiche.recontacterLe)}`;
  }
  return fiche.quand === null ? 'Sans date' : formatDateTime(fiche.quand);
}

/** Ce que la personne a dit, et qui l'a noté : l'accueil reprend sans rappeler pour rien. */
function Recontact({ fiche }: { fiche: RendezVousObtenu }) {
  if (fiche.etape !== 'A_RECONTACTER') return null;
  const note = fiche.recontacterAt === '' ? '' : `, le ${formatDateTime(fiche.recontacterAt)}`;
  return (
    <p className="mt-1 max-w-md text-[0.8125rem] font-normal whitespace-pre-line text-muted-foreground">
      {fiche.recontacterNote === '' ? 'Reporté' : `« ${fiche.recontacterNote} »`} ·{' '}
      {fiche.recontacterPar}
      {note}
    </p>
  );
}

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
  const parDateDeRecontact = (a: RendezVousObtenu, b: RendezVousObtenu) =>
    (a.recontacterLe || '9999').localeCompare(b.recontacterLe || '9999');
  return SECTIONS.map((titre) => {
    const lignes = items.filter((fiche) => sectionDe(fiche, aujourdhui, demain) === titre);
    return { titre, lignes: titre === 'À recontacter' ? lignes.sort(parDateDeRecontact) : lignes };
  }).filter((groupe) => groupe.lignes.length > 0);
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
                        <Recontact fiche={fiche} />
                      </TableCell>
                      <TableCell>
                        <Telephone fiche={fiche} />
                      </TableCell>
                      <TableCell>{lieuDe(fiche)}</TableCell>
                      <TableCell>
                        <span className="inline-flex flex-wrap gap-1.5">
                          <Badge variant={etat.ton}>{etat.texte}</Badge>
                          <PastilleQualification qualification={fiche.qualification} />
                        </span>
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
                      <span className="inline-flex flex-wrap justify-end gap-1.5">
                        <Badge variant={etat.ton}>{etat.texte}</Badge>
                        <PastilleQualification qualification={fiche.qualification} />
                      </span>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {quandDe(fiche)} · {lieuDe(fiche)}
                    </p>
                    <Recontact fiche={fiche} />
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
