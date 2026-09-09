import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Clock3Icon } from 'lucide-react';
import { useState } from 'react';

import type { Famille } from '@/components/supervision/colonnes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { lignesActivite, type Compteurs } from '@/lib/data/activite-agregats';
import { cleActivite, fetchActivite, type Granularite, type Periode } from '@/lib/data/supervision';
import { CLE_CRENEAUX, fetchCreneaux, majCreneaux, type MajCreneaux } from '@/lib/data/work-shifts';
import { formatNumber, formatRateOrNone } from '@/lib/format';
import type { ProjetApi } from '@/lib/types';

type Utiles = Pick<
  Compteurs,
  | 'repCalls'
  | 'calls'
  | 'repFichesAcceptees'
  | 'methodObtained'
  | 'repReachabilityRate'
  | 'ficheReachRate'
>;

function ChampHeure({
  label,
  valeur,
  onChange,
}: {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const id = `creneau-${label.toLocaleLowerCase().replaceAll(/[^a-z]+/gu, '-')}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={valeur}
        required
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/**
 * Chaque créneau est une fenêtre à part : une fiche appelée le matin et
 * l'après-midi compte dans les deux.
 */
export function EfficaciteParCreneau({
  periode,
  granularite,
  projet,
  famille,
  peutRegler,
}: {
  periode: Periode;
  granularite: Granularite;
  projet: ProjetApi;
  famille: Famille;
  peutRegler: boolean;
}) {
  const queryClient = useQueryClient();
  const creneauxQuery = useQuery({ queryKey: CLE_CRENEAUX, queryFn: fetchCreneaux });
  const creneaux = creneauxQuery.data?.shifts ?? [];

  const resultats = useQueries({
    queries: creneaux.map((creneau) => ({
      queryKey: cleActivite(periode, granularite, projet, creneau),
      queryFn: () =>
        fetchActivite({
          periode,
          granularite,
          projet,
          creneau: { start: creneau.start, end: creneau.end },
        }),
      placeholderData: keepPreviousData,
    })),
  });

  const [brouillon, setBrouillon] = useState<MajCreneaux | null>(null);

  const enregistrer = useMutation({
    mutationFn: (body: MajCreneaux) => majCreneaux(body),
    onSuccess: async (suivant) => {
      queryClient.setQueryData(CLE_CRENEAUX, suivant);
      await queryClient.invalidateQueries({ queryKey: ['supervision', 'activite'] });
      setBrouillon(null);
    },
  });

  if (creneauxQuery.isPending || creneaux.length === 0) return null;

  const parCreneau = resultats.map((resultat) =>
    resultat.data === undefined ? [] : lignesActivite(resultat.data),
  );
  const personnes = [...new Map(parCreneau.flat().map((ligne) => [ligne.id, ligne.name]))].sort(
    ([, a], [, b]) => a.localeCompare(b, 'fr'),
  );

  const appels = (c: Utiles): number => (famille === 'representants' ? c.repCalls : c.calls);
  const succes = (c: Utiles): number =>
    famille === 'representants' ? c.repFichesAcceptees : c.methodObtained;
  const joignabilite = (c: Utiles): number | null =>
    famille === 'representants' ? c.repReachabilityRate : c.ficheReachRate;

  const cellules = (c: Utiles | undefined): [string, string, string] => [
    formatNumber(c === undefined ? 0 : appels(c)),
    formatRateOrNone(c === undefined ? null : joignabilite(c)),
    formatNumber(c === undefined ? 0 : succes(c)),
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-[700]">
              <Clock3Icon className="size-4" aria-hidden="true" />
              Efficacité par créneau
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Appels, joignabilité et {famille === 'representants' ? 'acceptés' : 'méthodes'} de
              chaque téléconseiller, créneau par créneau, sur la période choisie.
            </p>
          </div>
          {peutRegler ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [matin, apresMidi] = creneaux;
                if (brouillon !== null || matin === undefined || apresMidi === undefined) {
                  setBrouillon(null);
                  return;
                }
                setBrouillon({
                  morningStart: matin.start,
                  morningEnd: matin.end,
                  afternoonStart: apresMidi.start,
                  afternoonEnd: apresMidi.end,
                });
              }}
            >
              {brouillon === null ? 'Modifier les horaires' : 'Annuler'}
            </Button>
          ) : null}
        </div>

        {brouillon !== null ? (
          <form
            className="grid gap-4 border-y border-border px-5 py-4 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              enregistrer.mutate(brouillon);
            }}
          >
            <ChampHeure
              label="Matin, début"
              valeur={brouillon.morningStart}
              onChange={(morningStart) => {
                setBrouillon({ ...brouillon, morningStart });
              }}
            />
            <ChampHeure
              label="Matin, fin"
              valeur={brouillon.morningEnd}
              onChange={(morningEnd) => {
                setBrouillon({ ...brouillon, morningEnd });
              }}
            />
            <ChampHeure
              label="Après-midi, début"
              valeur={brouillon.afternoonStart}
              onChange={(afternoonStart) => {
                setBrouillon({ ...brouillon, afternoonStart });
              }}
            />
            <ChampHeure
              label="Après-midi, fin"
              valeur={brouillon.afternoonEnd}
              onChange={(afternoonEnd) => {
                setBrouillon({ ...brouillon, afternoonEnd });
              }}
            />
            <div className="sm:col-span-4">
              <Button type="submit" size="sm" disabled={enregistrer.isPending}>
                Enregistrer
              </Button>
              {enregistrer.isError ? (
                <p className="mt-2 text-[0.8125rem] text-destructive">
                  Horaires invalides. Vérifiez leur ordre et leur chevauchement.
                </p>
              ) : null}
            </div>
          </form>
        ) : null}

        <Table aria-label="Efficacité par créneau">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2}>Téléconseiller</TableHead>
              {creneaux.map((creneau) => (
                <TableHead key={creneau.key} colSpan={3} className="text-center">
                  {creneau.label} · {creneau.start}–{creneau.end}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {creneaux.flatMap((creneau) => [
                <TableHead key={`${creneau.key}-appels`} className="text-right">
                  Appels
                </TableHead>,
                <TableHead key={`${creneau.key}-taux`} className="text-right">
                  Joignabilité
                </TableHead>,
                <TableHead key={`${creneau.key}-succes`} className="text-right">
                  {famille === 'representants' ? 'Acceptés' : 'Méthodes'}
                </TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnes.map(([id, nom]) => (
              <TableRow key={id}>
                <TableCell className="font-[600]">{nom}</TableCell>
                {creneaux.flatMap((creneau, index) =>
                  cellules(parCreneau[index]?.find((ligne) => ligne.id === id)).map(
                    (texte, colonne) => (
                      <TableCell
                        key={`${creneau.key}-${String(colonne)}`}
                        className="text-right tabular-nums"
                      >
                        {texte}
                      </TableCell>
                    ),
                  ),
                )}
              </TableRow>
            ))}
            <TableRow className="font-[600]">
              <TableCell>Équipe</TableCell>
              {creneaux.flatMap((creneau, index) =>
                cellules(resultats[index]?.data?.totals).map((texte, colonne) => (
                  <TableCell
                    key={`${creneau.key}-${String(colonne)}`}
                    className="text-right tabular-nums"
                  >
                    {texte}
                  </TableCell>
                )),
              )}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
