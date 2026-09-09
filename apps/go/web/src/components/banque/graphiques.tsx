import { formatMontant } from '@/components/banque/montant';
import { ChartCard } from '@/components/tableau-de-bord/chart-card';
import {
  BarresHorizontales,
  BarresVerticales,
} from '@/components/tableau-de-bord/graphiques-barres';
import { Anneau } from '@/components/tableau-de-bord/graphiques-parts';
import { Courbe } from '@/components/tableau-de-bord/graphiques-series';
import type { Valeur } from '@/components/tableau-de-bord/sources';
import type { IndicateursBanque } from '@/lib/data/bank-cases';

/** Un montant en chaîne ne se dessine pas : l'axe le lit en nombre, la valeur reste la source. */
function enNombre(montant: string | null): number {
  const propre = (montant ?? '').trim();
  return /^\d{1,18}$/u.test(propre) ? Number(propre) : 0;
}

function Vide({ message }: { message: string }) {
  return (
    <p className="flex h-full items-center justify-center text-center text-[0.875rem] text-muted-foreground">
      {message}
    </p>
  );
}

function Volet({
  titre,
  aide,
  items,
  vide,
  children,
}: {
  titre: string;
  aide?: string | undefined;
  items: readonly Valeur[];
  vide: string;
  children: React.ReactNode;
}) {
  return (
    <ChartCard titre={titre} aide={aide}>
      {items.length === 0 ? <Vide message={vide} /> : children}
    </ChartCard>
  );
}

function choisir(items: readonly Valeur[], index: number): string | undefined {
  return items[index]?.id;
}

export function GraphiquesBanque({
  donnees,
  onEtape,
  onBanque,
  onMotif,
  onAgent,
}: {
  donnees: IndicateursBanque;
  onEtape: (stageId: string) => void;
  onBanque: (banqueId: string) => void;
  onMotif: (reasonId: string) => void;
  onAgent: (agentId: string) => void;
}) {
  const etapes: Valeur[] = (donnees.byStage ?? []).map((etape) => ({
    id: etape.stageId,
    label: etape.label,
    value: etape.cases,
  }));
  const banques: Valeur[] = (donnees.byBank ?? []).map((banque) => ({
    id: banque.banqueId,
    label: banque.label,
    value: banque.cases,
  }));
  const motifs: Valeur[] = (donnees.byRejectionReason ?? []).map((motif) => ({
    id: motif.reasonId,
    label: motif.label,
    value: motif.cases,
  }));
  const agents: Valeur[] = (donnees.byAgent ?? []).map((agent) => ({
    id: agent.agentId,
    label: agent.label,
    value: agent.cashed,
  }));
  const seaux = donnees.cashingsOverTime ?? [];
  const nombres: Valeur[] = seaux.map((seau) => ({
    id: seau.bucket,
    label: seau.bucket,
    value: seau.cases,
  }));
  const montants: Valeur[] = seaux.map((seau) => ({
    id: seau.bucket,
    label: seau.bucket,
    value: enNombre(seau.amountXof),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Volet
        titre="Dossiers par étape"
        aide="Où les dossiers sont arrêtés aujourd’hui. Cliquez une barre pour ouvrir la liste filtrée sur cette étape."
        items={etapes}
        vide="Aucun dossier sur ces critères."
      >
        <BarresHorizontales
          items={etapes}
          label="Dossiers"
          onSelect={(index) => {
            const id = choisir(etapes, index);
            if (id !== undefined) onEtape(id);
          }}
        />
      </Volet>

      <Volet
        titre="Par banque"
        aide="Répartition des dossiers selon la banque qui les traite."
        items={banques}
        vide="Aucun dossier sur ces critères."
      >
        <Anneau
          items={banques}
          onSelect={(index) => {
            const id = choisir(banques, index);
            if (id !== undefined) onBanque(id);
          }}
        />
      </Volet>

      <Volet
        titre="Motifs de rejet"
        aide="Dossiers rejetés uniquement."
        items={motifs}
        vide="Aucun dossier rejeté sur ces critères."
      >
        <BarresHorizontales
          items={motifs}
          label="Rejets"
          onSelect={(index) => {
            const id = choisir(motifs, index);
            if (id !== undefined) onMotif(id);
          }}
        />
      </Volet>

      <Volet
        titre="Activité par agent"
        aide="Dossiers menés jusqu’à l’encaissement."
        items={agents}
        vide="Aucune activité d’agent sur ces critères."
      >
        <BarresHorizontales
          items={agents}
          label="Encaissés"
          onSelect={(index) => {
            const id = choisir(agents, index);
            if (id !== undefined) onAgent(id);
          }}
        />
      </Volet>

      <Volet
        titre="Encaissements dans le temps"
        aide="Nombre de dossiers encaissés par jour."
        items={nombres}
        vide="Aucun encaissement sur ces critères."
      >
        <BarresVerticales items={nombres} label="Encaissements" />
      </Volet>

      <Volet
        titre="Montant encaissé dans le temps"
        aide={`Somme encaissée par jour. Total sur la période : ${formatMontant(
          donnees.totals.totalAmountCashed,
          '0 FCFA',
        )}.`}
        items={montants}
        vide="Aucun encaissement sur ces critères."
      >
        <Courbe items={montants} label="FCFA" />
      </Volet>
    </div>
  );
}
