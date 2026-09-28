'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ClosingSheet } from '@/components/accueil/closing-sheet';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { BarreRendezVous } from '@/components/accueil/rendez-vous-filtres';
import { VisiteDuRendezVous } from '@/components/accueil/visite-du-rendez-vous';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CLE_RENDEZ_VOUS,
  type FiltresRendezVous,
  lireRendezVous,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { dakarNow } from '@/lib/data/visites';
import { formatDateTime, formatPhone } from '@/lib/format';

type Ton = 'warning' | 'success' | 'destructive' | 'outline' | 'info';

function etatDe(fiche: RendezVousObtenu): { texte: string; ton: Ton } {
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

function Ligne({ fiche, actions }: { fiche: RendezVousObtenu; actions: React.ReactNode }) {
  const etat = etatDe(fiche);
  const lieu = fiche.site === '' ? '' : ` · ${fiche.site}`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3 shadow-elev-xs">
      <p className="w-full shrink-0 text-[0.875rem] font-[600] tabular-nums sm:w-40">
        {fiche.quand === null ? 'Sans date' : formatDateTime(fiche.quand)}
      </p>
      <div className="min-w-48 flex-1">
        <p className="font-[600] break-words">
          {fiche.prenom} {fiche.nom}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground">
          {fiche.phoneE164 === null ? null : (
            <a href={`tel:${fiche.phoneE164}`} className="font-mono text-primary">
              {formatPhone(fiche.phoneE164)}
            </a>
          )}{' '}
          {fiche.type}
          {lieu}
        </p>
      </div>
      <Badge variant={etat.ton}>{etat.texte}</Badge>
      {actions}
    </li>
  );
}

function Groupes({
  items,
  historique,
  actions,
}: {
  items: RendezVousObtenu[];
  historique: boolean;
  actions: (fiche: RendezVousObtenu) => React.ReactNode;
}) {
  if (historique) {
    return (
      <ul aria-label="Historique des rendez-vous" className="flex flex-col gap-2">
        {items.map((fiche) => (
          <Ligne key={fiche.id} fiche={fiche} actions={actions(fiche)} />
        ))}
      </ul>
    );
  }
  const { date: aujourdhui } = dakarNow();
  const lendemain = new Date(`${aujourdhui}T12:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const { date: demain } = dakarNow(lendemain);
  return SECTIONS.map((section) => {
    const lignes = items.filter((fiche) => sectionDe(fiche, aujourdhui, demain) === section);
    if (lignes.length === 0) return null;
    return (
      <section key={section} aria-label={section} className="flex flex-col gap-2">
        <h2 className="text-[0.8125rem] font-[700] tracking-wide text-muted-foreground uppercase">
          {section} ({lignes.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {lignes.map((fiche) => (
            <Ligne key={fiche.id} fiche={fiche} actions={actions(fiche)} />
          ))}
        </ul>
      </section>
    );
  });
}

function Resultats({
  items,
  pageCount,
  page,
  filtre,
  historique,
  actions,
  setPage,
}: {
  items: RendezVousObtenu[];
  pageCount: number;
  page: number;
  filtre: boolean;
  historique: boolean;
  actions: (fiche: RendezVousObtenu) => React.ReactNode;
  setPage: (page: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {filtre
          ? 'Aucun rendez-vous pour cette recherche. Videz la recherche ou le type.'
          : 'Aucun rendez-vous ici. Les rendez-vous pris au téléphone arrivent dans « À traiter ».'}
      </p>
    );
  }
  return (
    <>
      <Groupes items={items} historique={historique} actions={actions} />
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            Précédents
          </Button>
          <span className="tabular-nums">
            Page {page} sur {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            Suivants
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function RendezVousListe({
  historique,
  peutNoter,
  peutCloser,
  peutExporter,
  peutEnregistrerVisite,
}: {
  historique: boolean;
  peutNoter: boolean;
  peutCloser: boolean;
  peutExporter: boolean;
  peutEnregistrerVisite: boolean;
}) {
  const [filtres, setFiltres] = useState<FiltresRendezVous>({
    historique,
    type: '',
    search: '',
    page: 1,
  });
  const changer = (patch: Partial<FiltresRendezVous>) => {
    setFiltres((avant) => ({ ...avant, page: 1, ...patch }));
  };
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const [visiteDe, setVisiteDe] = useState<RendezVousObtenu | null>(null);
  const liste = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, { ...filtres, historique }],
    queryFn: () => lireRendezVous({ ...filtres, historique }),
  });
  const onEnregistrerVisite = peutEnregistrerVisite ? setVisiteDe : null;
  const actions = (fiche: RendezVousObtenu) => (
    <ActionsRendezVous
      fiche={fiche}
      peutNoter={peutNoter}
      peutCloser={peutCloser}
      onCloser={setClosingDe}
      onEnregistrerVisite={onEnregistrerVisite}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <BarreRendezVous filtres={filtres} changer={changer} peutExporter={peutExporter} />
      {liste.isError ? (
        <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />
      ) : null}
      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {liste.data === undefined ? null : (
        <Resultats
          items={liste.data.items}
          pageCount={liste.data.pageCount}
          page={filtres.page}
          filtre={filtres.search !== '' || filtres.type !== ''}
          historique={historique}
          actions={actions}
          setPage={(page) => {
            setFiltres((avant) => ({ ...avant, page }));
          }}
        />
      )}
      <ClosingSheet
        rendezVous={closingDe}
        onClose={() => {
          setClosingDe(null);
        }}
      />
      <VisiteDuRendezVous
        rendezVous={visiteDe}
        onClose={() => {
          setVisiteDe(null);
        }}
      />
    </div>
  );
}
