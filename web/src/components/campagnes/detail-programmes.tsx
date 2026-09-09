import { LienTelechargement } from '@/components/exports/liens';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  urlFichesRecues,
  urlProgramme,
  type CampagneDetail,
  type CampagneReaffectation,
} from '@/lib/data/lots-export';
import { formatDateTime, formatNumber } from '@/lib/format';

export function CarteProgrammes({
  id,
  repartition,
  jours,
  fichesParJour,
}: {
  id: string;
  repartition: NonNullable<CampagneDetail['repartition']>;
  jours: number;
  fichesParJour: number;
}) {
  const colonnes = Array.from({ length: jours }, (_, index) => index + 1);

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Programmes d’appel
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Chacun reçoit son objectif quotidien, réglable plus bas. À défaut,{' '}
          {formatNumber(fichesParJour)} fiches par jour, dont 20 % pour la supervision et la
          direction. « Reçues » : les fiches arrivées après impression, à imprimer en complément.
        </p>
      </CardHeader>
      <CardContent>
        {repartition.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun téléconseiller n’a reçu de fiche.
          </p>
        ) : (
          <Table aria-label="Programmes d’appel">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Téléconseiller</TableHead>
                {colonnes.map((jour) => (
                  <TableHead key={jour} scope="col" className="text-right">
                    Jour {jour}
                  </TableHead>
                ))}
                <TableHead scope="col" className="text-right">
                  Reçues
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repartition.map((ligne) => (
                <TableRow key={ligne.teleconseillerId}>
                  <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                    {ligne.teleconseillerName}
                  </th>
                  {colonnes.map((jour) => {
                    const fiches =
                      (ligne.jours ?? []).find((entree) => entree.jour === jour)?.fiches ?? 0;
                    return (
                      <TableCell key={jour}>
                        <span className="flex items-center justify-end gap-2">
                          <span className="tabular-nums">{formatNumber(fiches)}</span>
                          <LienTelechargement
                            href={urlProgramme(id, ligne.teleconseillerId, jour)}
                            label={`Programme de ${ligne.teleconseillerName}, jour ${String(jour)}`}
                            size="icon-sm"
                            iconSeule
                            desactive={fiches === 0}
                          />
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <span className="flex items-center justify-end gap-2">
                      <span className="tabular-nums">
                        {ligne.recues > 0 ? `+${formatNumber(ligne.recues)}` : '0'}
                      </span>
                      <LienTelechargement
                        href={urlFichesRecues(id, ligne.teleconseillerId)}
                        label={`Fiches reçues par ${ligne.teleconseillerName}`}
                        size="icon-sm"
                        iconSeule
                        desactive={ligne.recues === 0}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function CarteReaffectations({
  id,
  reaffectations,
}: {
  id: string;
  reaffectations: readonly CampagneReaffectation[];
}) {
  if (reaffectations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Réaffectations
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Le PDF d’un mouvement ne reprend que les fiches que le destinataire tient encore.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {reaffectations.map((trace) => (
            <li
              key={trace.id}
              className="flex items-center justify-between gap-3 py-2.5 text-[0.875rem]"
            >
              <span>
                <span className="font-[600] tabular-nums">{formatNumber(trace.fiches)}</span> fiche
                {trace.fiches > 1 ? 's' : ''} de {trace.fromName} vers {trace.toName}
                <span className="block text-[0.8125rem] text-muted-foreground">
                  {formatDateTime(trace.createdAt)}, par {trace.performedByName}
                </span>
              </span>
              {trace.fichesEnMain > 0 ? (
                <LienTelechargement
                  href={urlFichesRecues(id, trace.toTeleconseillerId, trace.id)}
                  label={`Fiches reçues par ${trace.toName}`}
                  size="sm"
                >
                  PDF
                </LienTelechargement>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
