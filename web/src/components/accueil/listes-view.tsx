import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChampRecherche } from '@/components/accueil/champs';
import { ListeFormDialog } from '@/components/accueil/liste-form-dialog';
import { ADAPTATEUR_LISTES, LISTES, type Liste } from '@/components/accueil/listes-catalogue';
import { ListesTableau, ListeVide } from '@/components/accueil/listes-tableau';
import { OngletsVisites } from '@/components/accueil/onglets';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchReferentiel,
  libelle,
  modifierEntreeReferentiel,
  type ReferentielItem,
} from '@/lib/data/referentiels';
import { useFiltresUrl } from '@/lib/filtres-url';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

function sansAccent(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function filtrer(
  entrees: readonly ReferentielItem[] | undefined,
  recherche: string,
): ReferentielItem[] {
  const besoin = sansAccent(recherche.trim());
  if (besoin === '') return [...(entrees ?? [])];
  return (entrees ?? []).filter((entree) =>
    sansAccent(`${libelle(entree)} ${entree.code ?? ''}`).includes(besoin),
  );
}

export function ListesView({ role }: { role: Role }) {
  const { filtres, setFiltres } = useFiltresUrl(ADAPTATEUR_LISTES);

  return (
    <div className="flex flex-col gap-6">
      <OngletsVisites role={role} />

      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Les quatre listes proposées à la saisie du registre. Une entrée retirée reste lisible sur
        les visites déjà enregistrées, et disparaît de la saisie.
      </p>

      <Tabs
        value={filtres.onglet}
        onValueChange={(valeur) => {
          setFiltres({ onglet: String(valeur), recherche: '' });
        }}
      >
        <TabsList className="max-w-full overflow-x-auto">
          {LISTES.map((liste) => (
            <TabsTrigger key={liste.kind} value={liste.kind}>
              {liste.onglet}
            </TabsTrigger>
          ))}
        </TabsList>

        {LISTES.map((liste) => (
          <TabsContent key={liste.kind} value={liste.kind}>
            <PanneauListe
              liste={liste}
              recherche={filtres.recherche}
              onRecherche={(recherche) => {
                setFiltres({ recherche });
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function messageBascule(entree: ReferentielItem): string {
  if (entree.isActive === false) return `${libelle(entree)} retiré de la saisie.`;
  return `${libelle(entree)} de nouveau proposé.`;
}

function messageVide(liste: Liste, recherche: string): string {
  return recherche.trim() === '' ? liste.vide : 'Aucune entrée ne correspond.';
}

function EnTeteListe({ liste, onCreer }: { liste: Liste; onCreer: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{liste.titre}</h2>
        <p className="text-[0.8125rem] text-muted-foreground">{liste.description}</p>
      </div>
      <Button type="button" onClick={onCreer}>
        <PlusIcon aria-hidden="true" />
        {liste.creation}
      </Button>
    </div>
  );
}

function ConfirmationRetrait({
  entree,
  pending,
  onAnnuler,
  onConfirmer,
}: {
  entree: ReferentielItem | null;
  pending: boolean;
  onAnnuler: () => void;
  onConfirmer: (entree: ReferentielItem) => void;
}) {
  if (entree === null) return null;

  return (
    <ConfirmDialog
      open
      onOpenChange={onAnnuler}
      title={`Retirer « ${libelle(entree)} » de la saisie`}
      description="Les visites déjà enregistrées la gardent. Elle ne sera plus proposée au comptoir."
      confirmLabel="Retirer de la saisie"
      pending={pending}
      onConfirm={() => {
        onConfirmer(entree);
      }}
    />
  );
}

function PanneauListe({
  liste,
  recherche,
  onRecherche,
}: {
  liste: Liste;
  recherche: string;
  onRecherche: (valeur: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formOuvert, setFormOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<ReferentielItem | null>(null);
  const [aRetirer, setARetirer] = useState<ReferentielItem | null>(null);

  const entrees = useQuery({
    queryKey: queryKeys.visiteReferentiel(liste.kind),
    queryFn: () => fetchReferentiel(liste.kind, false),
  });

  const basculer = useMutation({
    mutationFn: (cible: { entree: ReferentielItem; isActive: boolean }) =>
      modifierEntreeReferentiel(liste.kind, cible.entree.id, { isActive: cible.isActive }),
    onSuccess: (enregistree) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.visiteReferentielsRoot });
      setARetirer(null);
      toast.success(messageBascule(enregistree));
    },
    onError: (error) => {
      toastApiError(error, 'Changement d’état impossible. Réessayez.');
    },
  });

  const lignes = filtrer(entrees.data, recherche);
  const vide = !entrees.isPending && !entrees.isError && lignes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <EnTeteListe
        liste={liste}
        onCreer={() => {
          setEnEdition(null);
          setFormOuvert(true);
        }}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
        <ChampRecherche valeur={recherche} placeholder="Libellé ou code…" onChange={onRecherche} />
      </div>

      {entrees.isPending ? <Skeleton className="h-64 w-full" /> : null}

      {entrees.isError ? (
        <QueryErrorState
          error={entrees.error}
          onRetry={() => {
            void entrees.refetch();
          }}
          fallback="Liste non chargée."
        />
      ) : null}

      {vide ? <ListeVide message={messageVide(liste, recherche)} /> : null}

      {lignes.length > 0 ? (
        <ListesTableau
          entrees={lignes}
          basculePending={basculer.isPending}
          onModifier={(entree) => {
            setEnEdition(entree);
            setFormOuvert(true);
          }}
          onBasculer={(entree) => {
            if (entree.isActive === false) {
              basculer.mutate({ entree, isActive: true });
              return;
            }
            setARetirer(entree);
          }}
        />
      ) : null}

      {/* `key` : le formulaire repart de l'entrée choisie sans effet de synchronisation. */}
      {formOuvert ? (
        <ListeFormDialog
          key={enEdition?.id ?? 'nouveau'}
          kind={liste.kind}
          titreCreation={liste.creation}
          open
          onOpenChange={setFormOuvert}
          entree={enEdition}
        />
      ) : null}

      <ConfirmationRetrait
        entree={aRetirer}
        pending={basculer.isPending}
        onAnnuler={() => {
          setARetirer(null);
        }}
        onConfirmer={(entree) => {
          basculer.mutate({ entree, isActive: false });
        }}
      />
    </div>
  );
}
