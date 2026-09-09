import { useQuery } from '@tanstack/react-query';
import { BanknoteIcon, ClockIcon, FolderOpenIcon, PercentIcon } from 'lucide-react';

import { Kpi, TableauMontants } from '@/components/banque/apercu-pieces';
import { BarreFiltres } from '@/components/banque/barre-filtres';
import { ADAPTATEUR_DOSSIERS, criteres, urlClasseur } from '@/components/banque/filtres';
import { GraphiquesBanque } from '@/components/banque/graphiques';
import { formatMontant } from '@/components/banque/montant';
import { LienTelechargement } from '@/components/exports/liens';
import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchIndicateurs, type IndicateursBanque } from '@/lib/data/bank-cases';
import { useFiltresUrl } from '@/lib/filtres-url';
import { formatDecimal, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';

function delaiMoyen(heures: number | null): string {
  return heures === null ? '–' : `${formatDecimal(heures / 24)} j`;
}

function detailDelai(heures: number | null): string {
  if (heures === null) return 'Aucun dossier encore clos';
  return `${formatNumber(Math.round(heures))} heures entre ouverture et issue`;
}

export function ApercuBanque({ projet }: { projet: Projet }) {
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_DOSSIERS);
  const requete = { ...criteres(filtres, PROJET_API[projet]), granularity: 'day' as const };

  const indicateurs = useQuery({
    queryKey: queryKeys.bankAnalytics(requete),
    queryFn: () => fetchIndicateurs(requete),
    placeholderData: (precedent) => precedent,
  });

  const agents = (indicateurs.data?.byAgent ?? []).map((agent) => ({
    value: agent.agentId,
    label: agent.label,
    hint: `${formatNumber(agent.cashed)} encaissés`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Volume, encaissements et rejets des dossiers, sur les critères réglés ci-dessous.
        </p>
        <LienTelechargement
          href={urlClasseur(filtres, PROJET_API[projet])}
          label="Télécharger le classeur des dossiers filtrés"
        >
          Exporter
        </LienTelechargement>
      </div>

      <BarreFiltres
        filtres={filtres}
        setFiltres={setFiltres}
        reinitialiser={reinitialiser}
        agents={agents}
      />

      {indicateurs.isError ? (
        <QueryErrorState
          error={indicateurs.error}
          onRetry={() => {
            void indicateurs.refetch();
          }}
          fallback="Les agrégats bancaires n’ont pas pu être calculés."
        />
      ) : null}

      {indicateurs.isPending ? <SqueletteApercu /> : null}

      {indicateurs.data === undefined ? null : (
        <>
          <Compteurs totaux={indicateurs.data.totals} />
          <GraphiquesBanque
            donnees={indicateurs.data}
            onEtape={(stageId) => {
              setFiltres({ stageId, stageType: null });
            }}
            onBanque={(banqueId) => {
              setFiltres({ banqueId });
            }}
            onMotif={(rejectionReasonId) => {
              setFiltres({ rejectionReasonId, stageType: 'REJECTED', stageId: null });
            }}
            onAgent={(agentId) => {
              setFiltres({ agentId });
            }}
          />
          {/* Un tableau et non un graphique : comparer des sommes en francs CFA
              se fait sur des chiffres alignés, un axe à sept chiffres est illisible. */}
          <TableauMontants banques={indicateurs.data.byBank ?? []} />
        </>
      )}
    </div>
  );
}

function Compteurs({ totaux }: { totaux: IndicateursBanque['totals'] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        index={0}
        label="Dossiers"
        valeur={formatNumber(totaux.total)}
        detail={`${formatNumber(totaux.aTraiter)} à traiter · ${formatNumber(totaux.enTraitement)} en cours`}
        icone={FolderOpenIcon}
      />
      <Kpi
        index={1}
        label="Encaissés"
        valeur={formatNumber(totaux.encaisses)}
        detail={formatMontant(totaux.totalAmountCashed, '0 FCFA')}
        icone={BanknoteIcon}
      />
      <Kpi
        index={2}
        label="Taux de rejet"
        valeur={`${formatDecimal(totaux.rejectionRate)} %`}
        detail={`${formatNumber(totaux.rejetes)} dossiers rejetés`}
        icone={PercentIcon}
      />
      <Kpi
        index={3}
        label="Délai moyen"
        valeur={delaiMoyen(totaux.meanDelayHours)}
        detail={detailDelai(totaux.meanDelayHours)}
        icone={ClockIcon}
      />
    </div>
  );
}

function SqueletteApercu() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="h-48 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
