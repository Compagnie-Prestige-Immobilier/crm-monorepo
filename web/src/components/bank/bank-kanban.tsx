'use client';

import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { AdvanceDialog, RejectDialog } from '@/components/bank/bank-case-detail-view';
import {
  ContenuDossier,
  ContenuInscription,
  EnteteColonne,
  teinteDe,
} from '@/components/bank/bank-kanban-carte';
import { QueryErrorState } from '@/components/query-error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/kanban';
import { Skeleton } from '@/components/ui/skeleton';
import { bankBasePath, EMPTY_BANK_FILTERS } from '@/lib/bank-filters';
import {
  createBankCaseTransition,
  fetchBankCases,
  fetchBankStages,
  fetchInscriptionsAOuvrir,
} from '@/lib/data/bank-cases';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { BankCase, BankCaseStage, InscriptionAOuvrir, Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

const PLAFOND_CARTES = 200;
const COLONNE_PLATEFORME = 'plateforme';

type Carte = {
  id: string;
  name: string;
  column: string;
  dossier: BankCase | null;
  inscription: InscriptionAOuvrir | null;
};

type Colonne = { id: string; name: string; etape: BankCaseStage | null };

type Boite =
  | { genre: 'avance'; dossier: BankCase; cible: BankCaseStage; encaissement: boolean }
  | { genre: 'rejet'; dossier: BankCase; cible: BankCaseStage }
  | { genre: 'recul'; dossier: BankCase; cible: BankCaseStage }
  | null;

type Decision =
  { genre: 'refus'; message: string } | { genre: 'direct' } | { genre: 'boite'; boite: Boite };

// Avancer entre étapes ouvertes est immédiat ; reculer, encaisser et rejeter se confirment.
function decider(dossier: BankCase, cible: BankCaseStage): Decision {
  if (cible.type === 'REJECTED') {
    if (dossier.currentStage.isInitial) {
      return {
        genre: 'refus',
        message: 'Un dossier encore à traiter ne se rejette pas : prenez-le d’abord en traitement.',
      };
    }
    return { genre: 'boite', boite: { genre: 'rejet', dossier, cible } };
  }
  if (cible.type === 'CASHED') {
    return { genre: 'boite', boite: { genre: 'avance', dossier, cible, encaissement: true } };
  }
  if (cible.position < dossier.currentStage.position) {
    return { genre: 'boite', boite: { genre: 'recul', dossier, cible } };
  }
  return { genre: 'direct' };
}

function cartesDe(dossiers: BankCase[], inscriptions: InscriptionAOuvrir[]): Carte[] {
  return [
    ...inscriptions.map((inscription) => ({
      id: inscription.id,
      name: `${inscription.prenom} ${inscription.nom}`,
      column: COLONNE_PLATEFORME,
      dossier: null,
      inscription,
    })),
    ...dossiers.map((dossier) => ({
      id: dossier.id,
      name: dossier.reference,
      column: dossier.currentStage.id,
      dossier,
      inscription: null,
    })),
  ];
}

/** Une colonne par étape active, précédée des dossiers complets de la plateforme. Ordinateur seulement. */
export function BankKanban({ projet }: { projet: Projet }) {
  const filtres = { ...EMPTY_BANK_FILTERS, projet, pageSize: PLAFOND_CARTES };
  const dossiers = useQuery({
    queryKey: queryKeys.bankCases(filtres),
    queryFn: () => fetchBankCases(filtres),
  });
  const etapes = useQuery({
    queryKey: queryKeys.bankStages(false),
    queryFn: () => fetchBankStages(false),
  });
  const aOuvrir = useQuery({
    queryKey: queryKeys.bankAOuvrir(projet),
    queryFn: () => fetchInscriptionsAOuvrir(projet),
  });

  if (dossiers.isError || etapes.isError || aOuvrir.isError) {
    return (
      <QueryErrorState
        error={dossiers.error ?? etapes.error ?? aOuvrir.error}
        onRetry={() => {
          void dossiers.refetch();
          void etapes.refetch();
          void aOuvrir.refetch();
        }}
        fallback="Le tableau des dossiers n’a pas pu être chargé."
      />
    );
  }
  if (dossiers.isPending || etapes.isPending) return <BankKanbanSkeleton />;

  return (
    <div className="flex flex-col gap-3">
      {dossiers.data.total > PLAFOND_CARTES ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Les {formatNumber(PLAFOND_CARTES)} derniers dossiers mis à jour sont affichés. La liste
          montre tout.
        </p>
      ) : null}
      <Tableau
        projet={projet}
        dossiers={dossiers.data.items}
        etapes={[...etapes.data].sort((a, b) => a.position - b.position)}
        inscriptions={aOuvrir.data ?? []}
      />
    </div>
  );
}

function Tableau({
  projet,
  dossiers,
  etapes,
  inscriptions,
}: {
  projet: Projet;
  dossiers: BankCase[];
  etapes: BankCaseStage[];
  inscriptions: InscriptionAOuvrir[];
}) {
  const queryClient = useQueryClient();
  const base = bankBasePath(projet);
  const [boite, setBoite] = useState<Boite>(null);
  const [brouillon, setBrouillon] = useState<Carte[] | null>(null);
  const enCours = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const serveur = useMemo(() => cartesDe(dossiers, inscriptions), [dossiers, inscriptions]);
  const cartes = brouillon ?? serveur;
  const colonnes: Colonne[] = [
    { id: COLONNE_PLATEFORME, name: 'Complets sur la plateforme', etape: null },
    ...etapes.map((etape) => ({ id: etape.id, name: etape.label, etape })),
  ];

  function invalider(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
  }

  const avancer = useMutation({
    mutationFn: (entree: { dossier: BankCase; cible: BankCaseStage }) =>
      createBankCaseTransition(entree.dossier.id, {
        targetStageId: entree.cible.id,
        expectedRev: entree.dossier.rev,
      }),
    onSuccess: (detail, entree) => {
      invalider();
      // Le retour est un déplacement ordinaire vers l'étape quittée : il reste dans l'historique.
      toast.success(
        `${detail.bankCase.reference} passé à « ${detail.bankCase.currentStage.label} ».`,
        {
          action: {
            label: 'Annuler',
            onClick: () =>
              avancer.mutate({ dossier: detail.bankCase, cible: entree.dossier.currentStage }),
          },
        },
      );
    },
    onError: (error) => {
      toastApiError(error, 'Le déplacement a échoué.');
    },
    onSettled: () => {
      setBrouillon(null);
    },
  });

  // Le composant déplace la carte pendant le survol ; le serveur n'est saisi qu'au dépôt.
  function deposer(): void {
    enCours.current = false;
    const deplacee = (brouillon ?? []).find(
      (carte) => carte.column !== serveur.find((s) => s.id === carte.id)?.column,
    );
    const cible = etapes.find((etape) => etape.id === deplacee?.column);
    if (deplacee?.dossier == null || cible === undefined) {
      setBrouillon(null);
      return;
    }
    const decision = decider(deplacee.dossier, cible);
    if (decision.genre === 'refus') {
      toast.error(decision.message);
      setBrouillon(null);
      return;
    }
    if (decision.genre === 'boite') {
      setBoite(decision.boite);
      return;
    }
    avancer.mutate({ dossier: deplacee.dossier, cible });
  }

  const fermer = (ouverte: boolean): void => {
    if (ouverte) return;
    setBoite(null);
    setBrouillon(null);
  };

  return (
    <>
      <KanbanProvider
        columns={colonnes}
        data={cartes}
        sensors={sensors}
        className="flex h-[calc(100dvh-15rem)] min-h-[30rem] gap-3 overflow-x-auto pb-2"
        onDragStart={() => {
          enCours.current = true;
        }}
        onDataChange={(suivantes) => {
          if (enCours.current) setBrouillon(suivantes);
        }}
        onDragEnd={deposer}
      >
        {(colonne) => (
          <ColonneKanban key={colonne.id} colonne={colonne} cartes={cartes} base={base} />
        )}
      </KanbanProvider>
      <BoitesKanban
        boite={boite}
        fermer={fermer}
        invalider={invalider}
        pending={avancer.isPending}
        reculer={(dossier, cible) => {
          avancer.mutate({ dossier, cible }, { onSettled: () => setBoite(null) });
        }}
      />
    </>
  );
}

function ColonneKanban({
  colonne,
  cartes,
  base,
}: {
  colonne: Colonne;
  cartes: Carte[];
  base: string;
}) {
  const siennes = cartes.filter((carte) => carte.column === colonne.id);
  const encaisse = colonne.etape?.type === 'CASHED';
  const total = encaisse
    ? siennes.reduce((somme, carte) => somme + Number(carte.dossier?.amountXof ?? 0), 0)
    : undefined;
  return (
    <KanbanBoard
      id={colonne.id}
      role="region"
      aria-label={colonne.name}
      style={{ '--teinte': teinteDe(colonne.etape?.color ?? 'primary') } as CSSProperties}
      className={cn(
        'w-[19.5rem] shrink-0 [background:color-mix(in_oklab,var(--teinte)_5%,var(--card))]',
        colonne.etape === null && 'border-dashed',
      )}
    >
      <KanbanHeader>
        <EnteteColonne
          etape={colonne.etape ?? { label: colonne.name }}
          compte={siennes.length}
          part={cartes.length === 0 ? 0 : siennes.length / cartes.length}
          total={total}
        />
      </KanbanHeader>
      {siennes.length === 0 ? (
        <p className="mx-2.5 mt-2.5 rounded-lg border border-border/70 border-dashed p-4 text-center text-[0.75rem] text-muted-foreground">
          {colonne.etape === null
            ? 'Aucun dossier complet en attente d’ouverture.'
            : 'Déposez une carte ici pour passer un dossier à cette étape.'}
        </p>
      ) : null}
      <KanbanCards<Carte> id={colonne.id}>
        {(carte) => (
          <KanbanCard<Carte>
            key={carte.id}
            {...carte}
            disabled={carte.dossier === null || carte.dossier.isTerminal}
          >
            <ContenuCarte carte={carte} base={base} />
          </KanbanCard>
        )}
      </KanbanCards>
    </KanbanBoard>
  );
}

function ContenuCarte({ carte, base }: { carte: Carte; base: string }) {
  if (carte.dossier !== null) return <ContenuDossier dossier={carte.dossier} base={base} />;
  if (carte.inscription !== null) {
    return <ContenuInscription inscription={carte.inscription} base={base} />;
  }
  return null;
}

function BoitesKanban({
  boite,
  fermer,
  invalider,
  pending,
  reculer,
}: {
  boite: Boite;
  fermer: (ouverte: boolean) => void;
  invalider: () => void;
  pending: boolean;
  reculer: (dossier: BankCase, cible: BankCaseStage) => void;
}) {
  if (boite === null) return null;
  if (boite.genre === 'recul') {
    const { dossier, cible } = boite;
    return (
      <ConfirmDialog
        open
        onOpenChange={fermer}
        title={`Ramener ${dossier.reference} de « ${dossier.currentStage.label} » à « ${cible.label} » ?`}
        description="Le dossier revient à une étape déjà franchie. Le retour reste dans son historique."
        confirmLabel="Ramener le dossier"
        confirmVariant="default"
        pending={pending}
        onConfirm={() => {
          reculer(dossier, cible);
        }}
      />
    );
  }
  return (
    <>
      <AdvanceDialog
        open={boite.genre === 'avance'}
        onOpenChange={fermer}
        caseId={boite.dossier.id}
        expectedRev={boite.dossier.rev}
        target={boite.genre === 'avance' ? boite.cible : null}
        isCashing={boite.genre === 'avance' && boite.encaissement}
        onDone={invalider}
      />
      <RejectDialog
        open={boite.genre === 'rejet'}
        onOpenChange={fermer}
        caseId={boite.dossier.id}
        expectedRev={boite.dossier.rev}
        targetStageId={boite.genre === 'rejet' ? boite.cible.id : null}
        onDone={invalider}
      />
    </>
  );
}

export function BankKanbanSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[30rem] gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="w-[19.5rem] shrink-0 rounded-xl" />
      ))}
    </div>
  );
}
