import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  BandeauReaffectation,
  ChoixListe,
  deplacable,
  ETATS,
  FenetreFichesRecues,
  Pagination,
  TOUS,
} from '@/components/campagnes/fiches-pieces';
import { TableFiches } from '@/components/campagnes/fiches-table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchCampagneFiches,
  reaffecterFiches,
  type CampagneDetail,
  type CampagneFiche,
  type CampagneFicheEtat,
  type CampagneReaffectation,
  type Page,
} from '@/lib/data/lots-export';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

const PAGE_SIZE = 50;

function filtresDe(page: number, teleconseillerId: string, etat: string) {
  return {
    page,
    pageSize: PAGE_SIZE,
    ...(teleconseillerId === TOUS ? {} : { teleconseillerId }),
    ...(etat === TOUS ? {} : { etat: etat as CampagneFicheEtat }),
  };
}

function EtatFiches({ enCours, vide }: { enCours: boolean; vide: boolean }) {
  if (enCours) return <Skeleton className="h-64 rounded-lg" />;
  if (!vide) return null;
  return (
    <p className="text-[0.875rem] text-muted-foreground">
      Aucune fiche ne correspond à ces filtres.
    </p>
  );
}

export function FichesCampagne({
  lot,
  projet,
  peutReaffecter,
}: {
  lot: CampagneDetail;
  projet: Projet;
  peutReaffecter: boolean;
}) {
  const queryClient = useQueryClient();
  const [teleconseillerId, setTeleconseillerId] = useState<string>(TOUS);
  const [etat, setEtat] = useState<string>(TOUS);
  const [page, setPage] = useState(1);
  const [cochees, setCochees] = useState<readonly number[]>([]);
  const [vers, setVers] = useState<string>(TOUS);
  const [confirmation, setConfirmation] = useState(false);
  const [recues, setRecues] = useState<readonly CampagneReaffectation[]>([]);

  const filtres = filtresDe(page, teleconseillerId, etat);
  const fiches = useQuery({
    queryKey: queryKeys.lotsExportFiches(lot.id, filtres),
    queryFn: () => fetchCampagneFiches(lot.id, filtres),
  });

  const equipe = lot.repartition ?? [];
  const connues = new Set((lot.reaffectations ?? []).map((trace) => trace.id));

  const reaffectation = useMutation({
    mutationFn: () =>
      reaffecterFiches(lot.id, { positions: [...cochees], versTeleconseillerId: vers }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.lotsExportDetail(lot.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(lot.id) });
      setCochees([]);
      setConfirmation(false);
      setRecues((detail.reaffectations ?? []).filter((trace) => !connues.has(trace.id)));
      toast.success('Fiches attribuées.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les fiches n’ont pas pu être attribuées.'));
    },
  });

  const page1 = (fiches.data ?? {
    items: [],
    total: 0,
    page: 1,
    pageCount: 1,
  }) as Page<CampagneFiche>;
  const lignes = page1.items;
  const cochables = lignes.filter(deplacable);
  const destinataire =
    equipe.find((ligne) => ligne.teleconseillerId === vers)?.teleconseillerName ?? '';
  const pluriel = cochees.length > 1 ? 's' : '';

  const changerLeFiltre = (appliquer: () => void): void => {
    appliquer();
    setPage(1);
    setCochees([]);
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Fiches de la campagne
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Une fiche traitée reste à celui qui l’a appelée. Seules les fiches non traitées
          s’attribuent à quelqu’un d’autre.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <ChoixListe
            label="Tous"
            legende="Téléconseiller"
            largeur="w-56"
            valeur={teleconseillerId}
            options={equipe.map((ligne) => ({
              value: ligne.teleconseillerId,
              label: ligne.teleconseillerName,
            }))}
            onChange={(value) => {
              changerLeFiltre(() => {
                setTeleconseillerId(value);
              });
            }}
          />
          <ChoixListe
            label="Tous les états"
            legende="État"
            largeur="w-48"
            valeur={etat}
            options={Object.entries(ETATS).map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              changerLeFiltre(() => {
                setEtat(value);
              });
            }}
          />
        </div>

        <BandeauReaffectation
          equipe={peutReaffecter ? equipe : []}
          nombre={cochees.length}
          vers={vers}
          enCours={reaffectation.isPending}
          onVers={setVers}
          onAttribuer={() => {
            setConfirmation(true);
          }}
        />

        <ConfirmDialog
          open={confirmation}
          onOpenChange={setConfirmation}
          title={`Attribuer ${String(cochees.length)} fiche${pluriel} à ${destinataire} ?`}
          description="Elles rejoignent son programme. Son papier déjà imprimé ne les contient pas : un PDF des fiches reçues sera proposé."
          confirmLabel="Attribuer"
          confirmVariant="default"
          pending={reaffectation.isPending}
          onConfirm={() => {
            reaffectation.mutate();
          }}
        />

        <FenetreFichesRecues
          lotId={lot.id}
          recues={recues}
          onFermer={() => {
            setRecues([]);
          }}
        />

        <EtatFiches enCours={fiches.isPending} vide={fiches.isSuccess && lignes.length === 0} />

        <TableFiches
          lignes={lignes}
          projet={projet}
          cible={lot.cible}
          peutReaffecter={peutReaffecter}
          cochables={cochables}
          cochees={cochees}
          onCocherTout={(toutes: boolean) => {
            setCochees(toutes ? cochables.map((fiche) => fiche.position) : []);
          }}
          onCocherUne={(position: number, coche: boolean) => {
            setCochees((courantes) =>
              coche ? [...courantes, position] : courantes.filter((p) => p !== position),
            );
          }}
        />

        <Pagination
          page={page}
          pageCount={page1.pageCount}
          total={page1.total}
          onPage={(suivante) => {
            setPage(suivante);
            setCochees([]);
          }}
        />
      </CardContent>
    </Card>
  );
}
