'use client';

import { AIDE_DELAIS, aideDelai } from '@/components/enrolement/aides';
import { InfoPopover } from '@/components/stats/stat-info';
import { Card, CardContent } from '@/components/ui/card';
import type { EnrolementIndicateurs, Projet } from '@/lib/data/enrolement';
import { formatNumber } from '@/lib/format';

const SANS_MESURE = 'Aucune mesure';

const HEURES_PAR_JOUR = 24;
const MINUTES_PAR_HEURE = 60;

/**
 * « 0,6 j » ne se lit pas : personne ne compte en fractions de journée. Sous
 * une journée, l'écart se dit en heures, et sous une heure en minutes.
 */
export function formatDelai(jours: number): string {
  if (jours >= 1) return `${formatNumber(Math.round(jours * 10) / 10)} j`;
  const heures = jours * HEURES_PAR_JOUR;
  if (heures >= 1) return `${formatNumber(Math.round(heures))} h`;
  return `${formatNumber(Math.round(heures * MINUTES_PAR_HEURE))} min`;
}

type Delai = EnrolementIndicateurs['delais'][number];

function delaiDe(indicateurs: EnrolementIndicateurs | undefined, leg: string): Delai | undefined {
  return indicateurs?.delais.find((delai) => delai.leg === leg);
}

/**
 * Une moyenne se recompose entre plateformes en pondérant par le nombre de
 * dossiers ; une médiane, non, elle exige les valeurs elles-mêmes. D'où la
 * colonne d'ensemble sur la seule moyenne.
 */
function moyennePonderee(delais: readonly (Delai | undefined)[]): string {
  const mesures = delais.filter(
    (delai): delai is Delai =>
      delai !== undefined && delai.moyenneDays !== null && delai.sample > 0,
  );
  const dossiers = mesures.reduce((total, delai) => total + delai.sample, 0);
  if (dossiers === 0) return SANS_MESURE;
  const jours = mesures.reduce(
    (total, delai) => total + (delai.moyenneDays ?? 0) * delai.sample,
    0,
  );
  return `${formatDelai(jours / dossiers)} · ${formatNumber(dossiers)}`;
}

function moyenneDe(delai: Delai | undefined): string {
  if (delai === undefined || delai.moyenneDays === null || delai.sample === 0) return SANS_MESURE;
  return `${formatDelai(delai.moyenneDays)} · ${formatNumber(delai.sample)}`;
}

const LEGS: readonly { leg: string; label: string }[] = [
  { leg: 'INSCRIPTION_TO_SOUMISSION', label: 'Inscription vers dossier soumis' },
  { leg: 'SOUMISSION_TO_DECISION', label: 'Dossier soumis vers décision' },
];

export function DelaisEnrolement({
  colonnes,
  indicateurs,
}: {
  colonnes: readonly { projet: Projet; nom: string }[];
  indicateurs: readonly (EnrolementIndicateurs | undefined)[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="flex items-center gap-1 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          Temps moyen de traitement
          <InfoPopover label="Temps moyen de traitement" description={AIDE_DELAIS} />
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-[0.875rem]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left font-[600]">Étape</th>
                {colonnes.map((entree) => (
                  <th key={entree.projet} className="py-2 text-right font-[600]">
                    {entree.nom}
                  </th>
                ))}
                <th className="py-2 text-right font-[600]">Ensemble</th>
              </tr>
            </thead>
            <tbody>
              {LEGS.map((etape) => {
                const delais = indicateurs.map((donnees) => delaiDe(donnees, etape.leg));
                return (
                  <tr key={etape.leg} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1">
                        {etape.label}
                        <InfoPopover label={etape.label} description={aideDelai(etape.leg)} />
                      </span>
                    </td>
                    {delais.map((delai, index) => (
                      <td
                        key={colonnes[index]?.projet ?? index}
                        className="py-2 text-right tabular-nums"
                      >
                        {moyenneDe(delai)}
                      </td>
                    ))}
                    <td className="py-2 text-right tabular-nums font-[600]">
                      {moyennePonderee(delais)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[0.75rem] text-muted-foreground">
          Délai moyen, suivi du nombre de dossiers sur lesquels il est calculé.
        </p>
      </CardContent>
    </Card>
  );
}
