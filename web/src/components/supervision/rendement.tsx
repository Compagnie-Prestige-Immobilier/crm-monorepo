import { useQuery } from '@tanstack/react-query';
import { GaugeIcon } from 'lucide-react';
import { Fragment, useState } from 'react';

import { dureeAffichee, formatPresence } from '@/components/supervision/colonnes';
import {
  appelsParHeure,
  BadgeNote,
  BasculeNote,
  DetailNote,
  Fait,
  Faits,
  parNoteDecroissante,
} from '@/components/supervision/note';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Rendement } from '@/lib/data/supervision';
import { CLE_CRENEAUX, fetchCreneaux } from '@/lib/data/work-shifts';
import { formatNumber } from '@/lib/format';

/**
 * Section à part, et non une colonne du tableau d'activité : la note ne suit ni
 * le tri par colonne, ni le filtre par famille, ni le découpage par jour.
 */
export function RendementSurLaPeriode({ notes }: { notes: readonly Rendement[] }) {
  const creneauxQuery = useQuery({ queryKey: CLE_CRENEAUX, queryFn: fetchCreneaux });
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  const creneaux = (creneauxQuery.data?.shifts ?? []).map(
    (creneau) => `${creneau.label} ${creneau.start}-${creneau.end}`,
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-5 py-4">
          <h2
            id="rendement-periode"
            className="flex items-center gap-2 font-display text-[1.0625rem] font-[700]"
          >
            <GaugeIcon className="size-4" aria-hidden="true" />
            Rendement sur la période
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {creneaux.length > 0
              ? `Note calculée sur ${creneaux.join(' et ')} ; rétrécir ces créneaux rétrécit d’autant la mesure. `
              : ''}
            Seuls les jours où le compte a été vu sont comptés : un dimanche ou un congé ne fait pas
            baisser la note.
          </p>
        </div>

        <Table aria-labelledby="rendement-periode">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Rendement</TableHead>
              <TableHead className="text-right">Appels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parNoteDecroissante(notes).map((ligne) => {
              const ouvert = ouvertId === ligne.teleconseillerId;
              return (
                <Fragment key={ligne.teleconseillerId}>
                  <TableRow>
                    <th scope="row" className="px-3 py-2.5 text-left font-[400]">
                      <BasculeNote
                        ouvert={ouvert}
                        onBascule={() => {
                          setOuvertId(ouvert ? null : ligne.teleconseillerId);
                        }}
                      >
                        <span className="font-[600]">{ligne.teleconseillerName}</span>
                      </BasculeNote>
                    </th>
                    <TableCell>
                      <BadgeNote note={ligne.score} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(ligne.calls)}
                    </TableCell>
                  </TableRow>
                  {ouvert ? (
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={3} className="px-5 pb-4 pt-2">
                        <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                          <Faits titre="Période">
                            <Fait
                              label="Présence en créneau"
                              valeur={formatPresence(ligne.activeSecondsInShifts)}
                            />
                            <Fait
                              label="Créneaux écoulés"
                              valeur={formatPresence(ligne.shiftSecondsElapsed)}
                            />
                            <Fait
                              label="Appels par heure active"
                              valeur={appelsParHeure(ligne.calls, ligne.activeSecondsInShifts)}
                            />
                            <Fait label="Joints" valeur={formatNumber(ligne.reached)} />
                            <Fait label="Qualifiés" valeur={formatNumber(ligne.qualified)} />
                            <Fait label="Reprises" valeur={formatNumber(ligne.repeatCalls)} />
                            <Fait label="Temps mort" valeur={dureeAffichee(ligne.deadSeconds)} />
                          </Faits>

                          <DetailNote parts={ligne.score.parts} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            {notes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  Aucune note sur cette période. Élargissez la période.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
