import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { IndicateursEnrolement } from '@/lib/data/enrolement';
import { formatNumber, formatRateOrNone } from '@/lib/format';

export function TuilesEnrolement({
  indicateurs,
}: {
  indicateurs: IndicateursEnrolement | undefined;
}) {
  const tuiles = [
    { label: 'Inscriptions', valeur: indicateurs && formatNumber(indicateurs.inscriptions) },
    { label: 'Rapprochées', valeur: indicateurs && formatNumber(indicateurs.rapprochees) },
    {
      label: 'Taux de rapprochement',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxRapprochement),
    },
    {
      label: 'Convertis puis inscrits',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxConversion),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((tuile) => (
        <Card key={tuile.label}>
          <CardContent>
            <p className="text-[0.75rem] font-[600] tracking-wide text-muted-foreground uppercase">
              {tuile.label}
            </p>
            {tuile.valeur === undefined ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-1 font-display text-[1.75rem] leading-none font-[800] tracking-[-0.02em] tabular-nums">
                {tuile.valeur}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RepartitionsEnrolement({ indicateurs }: { indicateurs: IndicateursEnrolement }) {
  const blocs = [
    { titre: 'Par étape', lignes: indicateurs.parEtape ?? [] },
    { titre: 'Par téléconseiller', lignes: indicateurs.parTeleconseiller ?? [] },
    { titre: 'Par campagne', lignes: indicateurs.parCampagne ?? [] },
    { titre: 'Par méthode d’enrôlement', lignes: indicateurs.parMethode ?? [] },
  ].filter((bloc) => bloc.lignes.length > 0);

  const delais = (indicateurs.delais ?? []).filter((delai) => delai.medianDays !== null);
  if (blocs.length === 0 && delais.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocs.map((bloc) => (
        <Card key={bloc.titre}>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[0.75rem] font-[600] tracking-wide text-muted-foreground uppercase">
              {bloc.titre}
            </p>
            <ul className="flex flex-col gap-1">
              {bloc.lignes.slice(0, 8).map((ligne) => (
                <li key={ligne.id} className="flex justify-between gap-4 text-[0.875rem]">
                  <span className="truncate">{ligne.label}</span>
                  <span className="tabular-nums">{formatNumber(ligne.inscriptions)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {delais.length === 0 ? null : (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[0.75rem] font-[600] tracking-wide text-muted-foreground uppercase">
              Délais médians
            </p>
            <ul className="flex flex-col gap-1">
              {delais.map((delai) => (
                <li key={delai.leg} className="flex justify-between gap-4 text-[0.875rem]">
                  <span className="truncate">{delai.label}</span>
                  <span className="tabular-nums">
                    {formatNumber(delai.medianDays ?? 0)} j · {formatNumber(delai.sample)} mesures
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
