'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchChampsConversion,
  updateChampsConversion,
  TYPE_CHAMP_LIBRE_LABELS,
  type ChampLibre,
  type ReglageChamp,
  type ReglagesConversion,
  type TypeChampLibre,
} from '@/lib/data/champs-conversion';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

const NOUVEAU_PREFIXE = 'nouveau-';

const PROJETS: readonly { value: Projet; label: string }[] = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

const TYPES: readonly { value: TypeChampLibre; label: string }[] = (
  ['TEXTE', 'LISTE', 'OUI_NON'] as const
).map((value) => ({ value, label: TYPE_CHAMP_LIBRE_LABELS[value] }));

export function ChampsConversionView() {
  const [projet, setProjet] = useState<string>('CHUES');

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Ces réglages s’appliquent au formulaire de conversion des deux applications. Les réponses
        aux champs ajoutés se lisent sur la fiche du prospect et dans les exports Excel ; elles
        n’entrent dans aucun indicateur.
      </p>

      <Tabs value={projet} onValueChange={setProjet}>
        <TabsList>
          {PROJETS.map((entree) => (
            <TabsTrigger key={entree.value} value={entree.value}>
              {entree.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROJETS.map((entree) => (
          <TabsContent key={entree.value} value={entree.value}>
            <Panneau projet={entree.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Panneau({ projet }: { projet: Projet }) {
  const reglages = useQuery({
    queryKey: queryKeys.champsConversion(projet),
    queryFn: () => fetchChampsConversion(projet),
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

  // La clé remonte l'éditeur sur chaque enregistrement : l'état local repart
  // alors des identifiants que le serveur vient d'attribuer aux champs ajoutés.
  return (
    <Editeur key={reglages.data.updatedAt ?? 'usine'} projet={projet} initial={reglages.data} />
  );
}

function Editeur({ projet, initial }: { projet: Projet; initial: ReglagesConversion }) {
  const queryClient = useQueryClient();
  const [champs, setChamps] = useState<readonly ReglageChamp[]>(initial.champs);
  const [libres, setLibres] = useState<readonly ChampLibre[]>(initial.libres);

  const enregistrer = useMutation({
    mutationFn: () =>
      updateChampsConversion(projet, {
        champs: champs.map((champ) => ({
          champ: champ.champ,
          visible: champ.visible,
          obligatoire: champ.obligatoire,
        })),
        libres: libres.map((champ) => ({
          ...(champ.id.startsWith(NOUVEAU_PREFIXE) ? {} : { id: champ.id }),
          libelle: champ.libelle,
          type: champ.type,
          options: champ.options,
          obligatoire: champ.obligatoire,
        })),
      }),
    onSuccess: (rendu) => {
      queryClient.setQueryData(queryKeys.champsConversion(projet), rendu);
      toast.success('Formulaire enregistré.');
    },
    onError: (error) => {
      toastApiError(error, 'Le formulaire n’a pas été enregistré.');
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

  const majLibre = (index: number, patch: Partial<ChampLibre>): void => {
    setLibres(libres.map((champ, rang) => (rang === index ? { ...champ, ...patch } : champ)));
  };

  return (
    <div className="flex flex-col gap-6">
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
                  <ArrowUpIcon />
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
                  <ArrowDownIcon />
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
          ) : null}

          {libres.map((champ, index) => (
            <div
              key={champ.id}
              className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={`libelle-${champ.id}`}>Libellé</Label>
                <Input
                  id={`libelle-${champ.id}`}
                  value={champ.libelle}
                  onChange={(event) => {
                    majLibre(index, { libelle: event.target.value });
                  }}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-1.5 sm:w-52">
                <Label htmlFor={`type-${champ.id}`}>Type</Label>
                <Select
                  items={TYPES}
                  value={champ.type}
                  onValueChange={(valeur) => {
                    if (valeur === null) return;
                    majLibre(index, { type: valeur as TypeChampLibre });
                  }}
                >
                  <SelectTrigger id={`type-${champ.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {champ.type === 'LISTE' ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor={`options-${champ.id}`}>Valeurs, séparées par une virgule</Label>
                  <Input
                    id={`options-${champ.id}`}
                    value={champ.options.join(', ')}
                    onChange={(event) => {
                      majLibre(index, { options: decouper(event.target.value) });
                    }}
                  />
                </div>
              ) : null}

              <Case
                label="Obligatoire"
                checked={champ.obligatoire}
                disabled={false}
                onChange={(obligatoire) => {
                  majLibre(index, { obligatoire });
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Retirer ${champ.libelle === '' ? 'ce champ' : champ.libelle}`}
                onClick={() => {
                  setLibres(libres.filter((_, rang) => rang !== index));
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => {
              setLibres([...libres, nouveauChamp()]);
            }}
          >
            <PlusIcon />
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

const decouper = (brut: string): string[] =>
  brut
    .split(',')
    .map((valeur) => valeur.trim())
    .filter((valeur) => valeur !== '');

/**
 * Identifiant provisoire : le serveur ne reconnaît que ceux qu'il a déjà écrits
 * et engendre le définitif à l'enregistrement.
 */
const nouveauChamp = (): ChampLibre => ({
  id: `${NOUVEAU_PREFIXE}${String(Date.now())}-${String(Math.random()).slice(2, 8)}`,
  libelle: '',
  type: 'TEXTE',
  options: [],
  obligatoire: false,
});
