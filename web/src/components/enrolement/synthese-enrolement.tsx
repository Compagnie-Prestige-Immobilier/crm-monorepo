'use client';

import { useQueries } from '@tanstack/react-query';

import {
  AIDE_DECISION,
  AIDE_RAPPROCHEMENT,
  AIDE_TAUX_RAPPROCHEMENT,
} from '@/components/enrolement/aides';
import { DelaisEnrolement } from '@/components/enrolement/delais-enrolement';
import { CourbeEnrolement, EntonnoirCarte } from '@/components/enrolement/entonnoir-enrolement';
import { InfoPopover } from '@/components/stats/stat-info';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ONGLETS_ENROLEMENT,
  fetchIndicateursEnrolement,
  fetchReglagesEnrolement,
  projetDeLOnglet,
  type EnrolementIndicateurs,
  type EnrolementReglages,
  type Projet,
} from '@/lib/data/enrolement';
import { formatDateTime, formatNumber, formatRateOrNone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const PROJETS: readonly { projet: Projet; nom: string }[] = ONGLETS_ENROLEMENT.map((onglet) => ({
  projet: projetDeLOnglet(onglet),
  nom: onglet === 'chues' ? 'CHUES' : 'Grand Public',
}));

/** Un compteur à zéro ne dit pas la même chose selon que la plateforme est muette ou jamais lue. */
function enAttente(reglages: EnrolementReglages): string | null {
  if (!reglages.configuree) {
    return 'Plateforme non configurée. Renseignez son adresse et son jeton pour lancer un tirage.';
  }
  if (reglages.dernierTirage === null) {
    return 'Aucun tirage effectué. Les chiffres ci-dessous restent vides tant que rien n’a été lu.';
  }
  return null;
}

function Sante({ nom, reglages }: { nom: string; reglages: EnrolementReglages | undefined }) {
  if (reglages === undefined) return <Skeleton className="h-40 w-full rounded-md" />;

  const tirage = reglages.dernierTirage;
  const attente = enAttente(reglages);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {nom}
        </p>
        {attente !== null || tirage === null ? (
          <p className="text-[0.875rem] text-muted-foreground">{attente}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[0.875rem]">
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Dernier tirage</span>
              <span>{formatDateTime(tirage.termineLe)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lues sur la plateforme</span>
              <span className="tabular-nums">{formatNumber(tirage.lus)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Créées puis mises à jour</span>
              <span className="tabular-nums">
                {formatNumber(tirage.crees)} · {formatNumber(tirage.misAJour)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rapprochées d’un prospect</span>
              <span className="tabular-nums">{formatNumber(tirage.rapproches)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Retirées de la plateforme</span>
              <span className="tabular-nums">{formatNumber(tirage.disparues)}</span>
            </li>
          </ul>
        )}
        {tirage?.erreur == null ? null : (
          <p className="text-[0.875rem] text-destructive">{tirage.erreur}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface LigneComparee {
  readonly label: string;
  readonly valeurs: readonly string[];
  readonly note?: string;
}

function lignesComparees(
  indicateurs: readonly (EnrolementIndicateurs | undefined)[],
): LigneComparee[] {
  const lire = (extraire: (i: EnrolementIndicateurs) => string): string[] =>
    indicateurs.map((i) => (i === undefined ? '…' : extraire(i)));

  return [
    { label: 'Comptes créés', valeurs: lire((i) => formatNumber(i.entonnoir.inscriptions)) },
    { label: 'Dossiers ouverts', valeurs: lire((i) => formatNumber(i.entonnoir.dossiersOuverts)) },
    { label: 'Dossiers soumis', valeurs: lire((i) => formatNumber(i.entonnoir.dossiersSoumis)) },
    {
      label: 'Dossiers décidés',
      valeurs: lire((i) => formatNumber(i.entonnoir.dossiersDecides)),
      note: AIDE_DECISION,
    },
    {
      label: 'Rapprochées à un prospect',
      valeurs: lire((i) => formatNumber(i.rapprochees)),
      note: AIDE_RAPPROCHEMENT,
    },
    {
      label: 'Taux de rapprochement',
      valeurs: lire((i) => formatRateOrNone(i.tauxRapprochement)),
      note: AIDE_TAUX_RAPPROCHEMENT,
    },
  ];
}

function Comparaison({
  indicateurs,
}: {
  indicateurs: readonly (EnrolementIndicateurs | undefined)[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          Les deux plateformes
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-[0.875rem]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left font-[600]">Indicateur</th>
                {PROJETS.map((entree) => (
                  <th key={entree.projet} className="py-2 text-right font-[600]">
                    {entree.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesComparees(indicateurs).map((ligne) => (
                <tr key={ligne.label} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1">
                      {ligne.label}
                      {ligne.note === undefined ? null : (
                        <InfoPopover label={ligne.label} description={ligne.note} />
                      )}
                    </span>
                  </td>
                  {ligne.valeurs.map((valeur, index) => (
                    <td
                      key={PROJETS[index]?.projet ?? index}
                      className="py-2 text-right tabular-nums"
                    >
                      {valeur}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Comparer, jamais additionner : les deux plateformes ne nomment pas leurs étapes de la même façon. */
export function SyntheseEnrolement() {
  const indicateurs = useQueries({
    queries: PROJETS.map((entree) => ({
      queryKey: queryKeys.enrolementIndicateurs(entree.projet, {}),
      queryFn: () => fetchIndicateursEnrolement(entree.projet, {}),
    })),
  });

  const reglages = useQueries({
    queries: PROJETS.map((entree) => ({
      queryKey: queryKeys.enrolementReglages(entree.projet),
      queryFn: () => fetchReglagesEnrolement(entree.projet),
    })),
  });

  const donnees = indicateurs.map((etat) => etat.data);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid gap-4 lg:grid-cols-2">
        {PROJETS.map((entree, index) => (
          <Sante key={entree.projet} nom={entree.nom} reglages={reglages[index]?.data} />
        ))}
      </div>

      <Comparaison indicateurs={donnees} />

      <DelaisEnrolement colonnes={PROJETS} indicateurs={donnees} />

      <CourbeEnrolement
        titre="Inscriptions par jour"
        series={PROJETS.map((entree, index) => ({
          nom: entree.nom,
          points: donnees[index]?.parJour ?? [],
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {PROJETS.map((entree, index) => (
          <EntonnoirCarte
            key={entree.projet}
            titre={`Avancement · ${entree.nom}`}
            entonnoir={donnees[index]?.entonnoir}
          />
        ))}
      </div>
    </div>
  );
}
