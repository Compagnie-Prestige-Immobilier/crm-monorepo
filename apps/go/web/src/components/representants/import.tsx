import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, LoaderIcon, UploadIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { LienRetour } from '@/components/fiche-en-tete';
import { RapportImport } from '@/components/representants/import-rapport';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  appliquerImport,
  CONSIGNES_GENRE,
  deposerClasseur,
  fetchTravailImport,
  importEnCours,
  TAILLE_MAX_OCTETS,
  type TravailImport,
} from '@/lib/data/imports';
import { liveInterval } from '@/lib/live';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPTE = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const MODELE = '/api/v1/export/representants-modele.xlsx';

export function ImportRepresentants({ projet }: { projet: Projet }) {
  const queryClient = useQueryClient();
  const champId = useId();
  const champRef = useRef<HTMLInputElement>(null);

  const [travailId, setTravailId] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  const travail = useQuery({
    queryKey: queryKeys.importJob(travailId ?? ''),
    queryFn: () => fetchTravailImport(travailId ?? ''),
    enabled: travailId !== null,
    // Le serveur lit le classeur en tâche de fond : l'écran suit l'avancement.
    refetchInterval: (requete) =>
      liveInterval({ hidden: false, failing: false, paused: !importEnCours(requete.state.data) }),
  });

  const deposer = useMutation({
    mutationFn: (fichier: File) => deposerClasseur('REPRESENTANTS', fichier),
    onSuccess: (cree: TravailImport) => {
      setTravailId(cree.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
    },
    onError: (erreur) => {
      setTravailId(null);
      toastApiError(erreur, 'Le fichier n’a pas pu être analysé.');
    },
  });

  const appliquer = useMutation({
    mutationFn: (id: string) => appliquerImport(id),
    onSuccess: (applique) => {
      queryClient.setQueryData(queryKeys.importJob(applique.id), applique);
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
      toast.success('Import appliqué.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'L’import n’a pas pu être appliqué.');
    },
  });

  function accepter(candidat: File | null): void {
    if (candidat === null) return;
    if (candidat.size > TAILLE_MAX_OCTETS) {
      toast.error('Fichier trop volumineux : 25 Mo au maximum.');
      return;
    }
    setTravailId(null);
    deposer.mutate(candidat);
  }

  const analyse = deposer.isPending || importEnCours(travail.data);

  return (
    <div className="flex flex-col gap-6">
      <LienRetour href={`/${projet}/representants`}>Tous les représentants</LienRetour>

      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Partir du modèle</CardTitle>
          <CardDescription>{CONSIGNES_GENRE.REPRESENTANTS}</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={MODELE} className={buttonVariants({ variant: 'outline' })}>
            <DownloadIcon aria-hidden="true" />
            Télécharger le modèle Excel
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Déposer le fichier rempli</CardTitle>
          <CardDescription>
            Le fichier est d’abord ANALYSÉ : rien n’est enregistré tant que vous n’avez pas
            confirmé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Zone de dépôt DOUBLÉE d'un champ de fichier réel : le glisser-déposer
              n'est pas atteignable au clavier. Le `label` porte le clic,
              l'`input` porte le focus et l'annonce. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- input de fichier associé */}
          <label
            htmlFor={champId}
            onDragOver={(event) => {
              event.preventDefault();
              setSurvol(true);
            }}
            onDragLeave={() => {
              setSurvol(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setSurvol(false);
              accepter(event.dataTransfer.files.item(0));
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              survol ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
            )}
          >
            <UploadIcon className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="text-[0.9375rem] font-[600]">
              {travail.data?.fileName ?? 'Glissez le classeur ici, ou choisissez un fichier'}
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              Format .xlsx, 25 Mo au maximum.
            </span>
            <input
              id={champId}
              ref={champRef}
              type="file"
              accept={ACCEPTE}
              className="sr-only"
              onChange={(event) => {
                accepter(event.target.files?.item(0) ?? null);
                event.target.value = '';
              }}
            />
          </label>

          {analyse ? (
            <p role="status" className="flex items-center gap-2 text-[0.875rem]">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Analyse du fichier…
            </p>
          ) : null}
        </CardContent>
      </Card>

      {travail.data === undefined || analyse ? null : (
        <RapportImport
          travail={travail.data}
          application={appliquer.isPending}
          onAppliquer={() => {
            appliquer.mutate(travail.data.id);
          }}
          onRecommencer={() => {
            setTravailId(null);
            champRef.current?.focus();
          }}
        />
      )}

      {travail.isError ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void travail.refetch();
          }}
        >
          Relire l’état de l’import
        </Button>
      ) : null}
    </div>
  );
}
