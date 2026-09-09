import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserMinusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  modifierCampagne,
  retirerTeleconseiller,
  type CampagneDetail,
} from '@/lib/data/lots-export';
import { formatNumber, formatRate } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type Ligne = NonNullable<CampagneDetail['performance']>[number];

/**
 * L'API remplace la table entière des objectifs : le PATCH renvoie donc TOUS
 * ceux de la campagne, sans quoi régler l'un effacerait les autres.
 */
function ChampObjectif({ id, lignes, ligne }: { id: string; lignes: Ligne[]; ligne: Ligne }) {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState(String(ligne.objectif));

  const reglage = useMutation({
    mutationFn: (valeur: number) =>
      modifierCampagne(id, {
        objectifs: lignes.map((autre) => ({
          teleconseillerId: autre.teleconseillerId,
          fichesParJour:
            autre.teleconseillerId === ligne.teleconseillerId ? valeur : autre.objectif,
        })),
      }),
    onSuccess: (_resume, valeur) => {
      setSaisie(String(valeur));
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      toast.success('Objectif enregistré.');
    },
    onError: (erreur) => {
      setSaisie(String(ligne.objectif));
      toast.error(apiErrorText(erreur, 'L’objectif n’a pas pu être enregistré.'));
    },
  });

  return (
    <Input
      type="number"
      min={1}
      max={500}
      step={1}
      className="ml-auto h-9 w-20 text-right tabular-nums"
      aria-label={`Objectif quotidien de ${ligne.teleconseillerName}`}
      value={saisie}
      disabled={reglage.isPending}
      onChange={(event) => {
        setSaisie(event.target.value);
      }}
      onBlur={() => {
        const valeur = Number.parseInt(saisie, 10);
        if (!Number.isFinite(valeur) || valeur < 1 || valeur === ligne.objectif) {
          setSaisie(String(ligne.objectif));
          return;
        }
        reglage.mutate(Math.min(500, valeur));
      }}
    />
  );
}

/** Le retiré rend ses fiches non traitées au reste de l'équipe. */
function BoutonRetrait({ id, ligne, seul }: { id: string; ligne: Ligne; seul: boolean }) {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);

  const retrait = useMutation({
    mutationFn: () => retirerTeleconseiller(id, ligne.teleconseillerId),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.lotsExportDetail(id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      setOuvert(false);
      toast.success(`${ligne.teleconseillerName} a été retiré de la campagne.`);
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le retrait a échoué.'));
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={seul}
        aria-label={`Retirer ${ligne.teleconseillerName} de la campagne`}
        onClick={() => {
          setOuvert(true);
        }}
      >
        <UserMinusIcon className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={`Retirer ${ligne.teleconseillerName} ?`}
        description="Ses fiches non traitées repartent au reste de l’équipe. Les fiches qu’il a déjà appelées lui restent."
        confirmLabel="Retirer"
        pending={retrait.isPending}
        onConfirm={() => {
          retrait.mutate();
        }}
      />
    </>
  );
}

export function CartePerformance({
  id,
  lignes,
  peutRegler,
}: {
  id: string;
  lignes: Ligne[];
  peutRegler: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Performance de la campagne
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Une fiche est traitée quand la personne assignée y consigne au moins un appel. Un appel
          hors attribution vise une fiche confiée à un collègue dans cette campagne.
        </p>
      </CardHeader>
      <CardContent>
        <Table aria-label="Performance de la campagne">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Téléconseiller</TableHead>
              <TableHead scope="col" className="text-right">
                Objectif par jour
              </TableHead>
              <TableHead scope="col" className="text-right">
                Traitées
              </TableHead>
              <TableHead scope="col" className="text-right">
                Couverture
              </TableHead>
              <TableHead scope="col" className="text-right">
                Appels attribués
              </TableHead>
              <TableHead scope="col" className="text-right">
                Hors attribution
              </TableHead>
              {peutRegler ? (
                <TableHead scope="col" className="text-right">
                  <span className="sr-only">Retirer de la campagne</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne) => (
              <TableRow key={ligne.teleconseillerId}>
                <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                  {ligne.teleconseillerName}
                </th>
                <TableCell className="text-right tabular-nums">
                  {peutRegler ? (
                    <ChampObjectif id={id} lignes={lignes} ligne={ligne} />
                  ) : (
                    formatNumber(ligne.objectif)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.treated)} sur {formatNumber(ligne.assigned)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRate(ligne.completionRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.assignedCalls)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {ligne.outsideAssignmentCalls === 0 ? (
                    '0'
                  ) : (
                    <Badge variant="warning">{formatNumber(ligne.outsideAssignmentCalls)}</Badge>
                  )}
                </TableCell>
                {peutRegler ? (
                  <TableCell className="text-right">
                    <BoutonRetrait id={id} ligne={ligne} seul={lignes.length < 2} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
