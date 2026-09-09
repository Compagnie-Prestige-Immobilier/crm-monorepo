import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon, LoaderIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChampsLibres } from '@/components/admin/champs-libres';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ecrireChampsConversion,
  fetchChampsConversion,
  nouveauChampLibre,
  type ChampLibre,
  type ReglageChamp,
  type ReglagesConversion,
} from '@/lib/data/champs-conversion';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, PROJETS, type Projet } from '@/lib/types';

const LIBELLES_PROJET: Record<Projet, string> = {
  chues: 'CHUES',
  'grand-public': 'Grand Public',
};

export function ChampsConversionView() {
  const [projet, setProjet] = useState<string>(PROJETS[0]);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Ces réglages pilotent le formulaire de conversion. Les réponses aux champs ajoutés se lisent
        sur la fiche du prospect et dans les exports, elles n’entrent dans aucun indicateur.
      </p>

      <Tabs
        value={projet}
        onValueChange={(valeur) => {
          if (typeof valeur === 'string') setProjet(valeur);
        }}
      >
        <TabsList>
          {PROJETS.map((valeur) => (
            <TabsTrigger key={valeur} value={valeur}>
              {LIBELLES_PROJET[valeur]}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROJETS.map((valeur) => (
          <TabsContent key={valeur} value={valeur}>
            <Panneau projet={valeur} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Panneau({ projet }: { projet: Projet }) {
  const reglages = useQuery({
    queryKey: queryKeys.champsConversion(projet),
    queryFn: () => fetchChampsConversion(PROJET_API[projet]),
  });

  if (reglages.isPending) return <Skeleton className="h-96 w-full" />;
  if (reglages.isError) {
    return (
      <QueryErrorState
        error={reglages.error}
        onRetry={() => {
          void reglages.refetch();
        }}
        fallback="Les champs n’ont pas pu être chargés."
      />
    );
  }

  // La clé remonte l'éditeur à chaque enregistrement : l'état local repart des
  // identifiants que le serveur vient d'attribuer aux champs ajoutés.
  return <Editeur key={reglages.data.updatedAt} projet={projet} initial={reglages.data} />;
}

function Editeur({ projet, initial }: { projet: Projet; initial: ReglagesConversion }) {
  const queryClient = useQueryClient();
  const [champs, setChamps] = useState<readonly ReglageChamp[]>(initial.champs ?? []);
  const [libres, setLibres] = useState<readonly ChampLibre[]>(initial.libres ?? []);

  const enregistrer = useMutation({
    mutationFn: () => ecrireChampsConversion(PROJET_API[projet], champs, libres),
    onSuccess: (rendu) => {
      queryClient.setQueryData(queryKeys.champsConversion(projet), rendu);
      toast.success('Formulaire enregistré.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le formulaire n’a pas été enregistré.');
    },
  });

  const deplacer = (index: number, pas: number): void => {
    const cible = index + pas;
    if (cible < 0 || cible >= champs.length) return;
    const suivants = [...champs];
    const [retire] = suivants.splice(index, 1);
    if (retire === undefined) return;
    suivants.splice(cible, 0, retire);
    setChamps(suivants);
  };

  const basculer = (index: number, patch: Partial<ReglageChamp>): void => {
    setChamps(champs.map((champ, rang) => (rang === index ? { ...champ, ...patch } : champ)));
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Card>
        <CardHeader>
          <CardTitle>Champs du formulaire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {champs.map((champ, index) => (
            <div
              key={champ.champ}
              className="flex flex-wrap items-center gap-4 rounded-md border border-border px-3 py-2"
            >
              <span className="min-w-48 flex-1 text-[0.875rem] font-[600]">{champ.libelle}</span>

              <Case
                label="Visible"
                checked={champ.visible}
                disabled={champ.impose}
                onChange={(visible) => {
                  basculer(index, { visible });
                }}
              />
              <Case
                label="Obligatoire"
                checked={champ.obligatoire}
                disabled={!champ.visible}
                onChange={(obligatoire) => {
                  basculer(index, { obligatoire });
                }}
              />

              {champ.impose ? (
                <span className="text-[0.75rem] text-muted-foreground">
                  Exigé par les indicateurs
                </span>
              ) : null}

              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Monter ${champ.libelle}`}
                  disabled={index === 0}
                  onClick={() => {
                    deplacer(index, -1);
                  }}
                >
                  <ArrowUpIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Descendre ${champ.libelle}`}
                  disabled={index === champs.length - 1}
                  onClick={() => {
                    deplacer(index, 1);
                  }}
                >
                  <ArrowDownIcon aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Champs ajoutés</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {libres.length === 0 ? (
            <p className="text-[0.875rem] text-muted-foreground">
              Aucun champ ajouté. Utilisez « Ajouter un champ » pour poser une question de plus.
            </p>
          ) : (
            <ChampsLibres libres={libres} onChange={setLibres} />
          )}

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => {
              setLibres([...libres, nouveauChampLibre()]);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Ajouter un champ
          </Button>
        </CardContent>
      </Card>

      <Button
        type="button"
        className="self-start"
        disabled={enregistrer.isPending}
        onClick={() => {
          enregistrer.mutate();
        }}
      >
        {enregistrer.isPending ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Enregistrer
      </Button>
    </div>
  );
}

function Case({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (valeur: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="size-4 accent-[var(--primary)]"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}
