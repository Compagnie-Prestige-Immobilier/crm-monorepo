'use client';

import { type DataMessagePartComponent } from '@assistant-ui/react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { DownloadIcon, ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ActionsQuestion } from '@/components/assistant/questions';
import { useNivo } from '@/components/exploitation/nivo';
import { Button } from '@/components/ui/button';
import { exporterReponse, type ReponseAssistant } from '@/lib/data/assistant';
import { formatNumber } from '@/lib/format';
import { formatXofAxisTick, formatXofCompact } from '@/lib/money';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

export interface Echange {
  question: string;
  reponse: ReponseAssistant;
}

type Resultat = NonNullable<ReponseAssistant['resultat']>;

const LIGNE_TOTAL = 'Total';

function enFcfa(resultat: Resultat): boolean {
  const colonne = resultat.tableau.colonnes.indexOf(resultat.mesure);
  return resultat.tableau.lignes[0]?.[colonne]?.endsWith('FCFA') ?? false;
}

const REPERES_MAX = 6;

function reperes(resultat: Resultat): string[] {
  const pas = Math.ceil(resultat.serie.length / REPERES_MAX);
  return resultat.serie.filter((_, index) => index % pas === 0).map((p) => p.libelle);
}

function Graphique({ resultat, type }: { resultat: Resultat; type: 'barres' | 'courbe' }) {
  const { couleurs, nivo, animate } = useNivo();
  const fcfa = enFcfa(resultat);
  const axe = (valeur: number) => (fcfa ? formatXofAxisTick(valeur) : formatNumber(valeur));
  const bulle = (valeur: number) =>
    fcfa ? formatXofCompact(String(Math.round(valeur))) : formatNumber(valeur);
  const communs = {
    role: 'img',
    ariaLabel: resultat.mesure,
    margin: { top: 8, right: 12, bottom: 48, left: 48 },
    theme: nivo,
    animate,
    colors: [couleurs[0] ?? '#630210'],
    axisLeft: { tickSize: 0, tickPadding: 6, tickValues: 4, format: axe },
    gridYValues: 4,
    axisBottom: {
      tickSize: 0,
      tickPadding: 8,
      tickRotation: resultat.serie.length > 4 ? -35 : 0,
      tickValues: reperes(resultat),
    },
  };
  return (
    <div className="h-48 w-full">
      {type === 'courbe' ? (
        <ResponsiveLine
          {...communs}
          data={[
            {
              id: resultat.mesure,
              data: resultat.serie.map((p) => ({ x: p.libelle, y: p.valeur })),
            },
          ]}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0 }}
          curve="monotoneX"
          enableArea
          areaOpacity={0.1}
          pointSize={resultat.serie.length > 20 ? 0 : 5}
          enableGridX={false}
          useMesh
          yFormat={(valeur) => bulle(Number(valeur))}
        />
      ) : (
        <ResponsiveBar
          {...communs}
          data={resultat.serie.map((p) => ({ libelle: p.libelle, valeur: p.valeur }))}
          keys={['valeur']}
          indexBy="libelle"
          padding={0.3}
          borderRadius={3}
          enableLabel={false}
          valueFormat={bulle}
        />
      )}
    </div>
  );
}

function Tableau({ resultat }: { resultat: Resultat }) {
  const { colonnes, lignes } = resultat.tableau;
  return (
    <div className="max-h-56 overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-[0.75rem] tabular-nums">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            {colonnes.map((colonne) => (
              <th key={colonne} scope="col" className="px-2 py-1.5 font-[600] whitespace-nowrap">
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr
              key={`${ligne[0] ?? ''}-${String(index)}`}
              className={cn(
                'border-t border-border',
                ligne[0] === LIGNE_TOTAL && index === lignes.length - 1 && 'font-[700]',
              )}
            >
              {ligne.map((cellule, colonne) => (
                <td key={colonnes[colonne] ?? colonne} className="px-2 py-1 whitespace-nowrap">
                  {cellule}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoutonExporter({ reponse }: { reponse: ReponseAssistant }) {
  const [enCours, setEnCours] = useState(false);
  const parametres = reponse.parametres;
  if (parametres === undefined || reponse.resultat === undefined) return null;
  const exporter = async () => {
    setEnCours(true);
    try {
      await exporterReponse(parametres);
    } catch (error) {
      toastApiError(error, 'L’export a échoué. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Button variant="outline" size="sm" disabled={enCours} onClick={() => void exporter()}>
      {enCours ? (
        <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        <DownloadIcon aria-hidden="true" />
      )}
      Exporter
    </Button>
  );
}

export const ReponseRiche: DataMessagePartComponent<Echange> = ({ data }) => {
  const router = useRouter();
  const { question, reponse } = data;
  const { resultat, ecran } = reponse;
  const type = reponse.graphique?.type ?? 'aucun';
  return (
    <div
      data-riche=""
      className="mt-3 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
    >
      {resultat !== undefined && type !== 'aucun' && resultat.serie.length > 1 ? (
        <Graphique resultat={resultat} type={type} />
      ) : null}
      {resultat !== undefined && resultat.tableau.lignes.length > 0 ? (
        <Tableau resultat={resultat} />
      ) : null}
      {reponse.explication === undefined ? null : (
        <details className="group text-[0.8125rem] text-muted-foreground">
          <summary className="cursor-pointer font-[600] text-foreground">
            Comment c’est calculé
          </summary>
          <p className="mt-1">{reponse.explication}</p>
        </details>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ecran === undefined ? null : (
          <Button size="sm" onClick={() => router.push(ecran.lien)}>
            <ExternalLinkIcon aria-hidden="true" />
            Ouvrir dans l’écran
          </Button>
        )}
        <BoutonExporter reponse={reponse} />
        <ActionsQuestion question={question} />
      </div>
    </div>
  );
};
