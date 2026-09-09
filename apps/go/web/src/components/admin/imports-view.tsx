import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { DownloadIcon, HistoryIcon, LoaderIcon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { PanneauTravail, libelleApplication } from '@/components/admin/import-travail';
import { ImportsHistorique } from '@/components/admin/imports-historique';
import { QueryErrorInline } from '@/components/query-error-state';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  appliquerImport,
  CONSIGNES_GENRE,
  deposerClasseur,
  fetchTravailImport,
  GENRES_DEPOSABLES,
  importEnCours,
  LIBELLES_GENRE,
  MODELES_GENRE,
  TAILLE_MAX_OCTETS,
  type GenreDeposable,
} from '@/lib/data/imports';
import { LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const ACCEPTE = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const OPTIONS_GENRE = GENRES_DEPOSABLES.map((valeur) => ({
  value: valeur,
  label: LIBELLES_GENRE[valeur],
}));

const estGenre = (valeur: string): valeur is GenreDeposable =>
  (GENRES_DEPOSABLES as readonly string[]).includes(valeur);

/** Le flux `imports` pousse l'avancement ; le sondage n'est plus qu'un filet. */
const SONDAGE_MS = 5_000;

export function ImportsView() {
  const queryClient = useQueryClient();
  const searchStr = useLocation({ select: (etat) => etat.searchStr });
  const champFichier = useRef<HTMLInputElement>(null);

  const [genre, setGenre] = useState<GenreDeposable>(() => {
    const demande = new URLSearchParams(searchStr).get('kind') ?? '';
    return estGenre(demande) ? demande : 'PROSPECTS';
  });
  const [travailId, setTravailId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [glisse, setGlisse] = useState(false);

  const travail = useQuery({
    queryKey: queryKeys.importJob(travailId ?? ''),
    queryFn: () => fetchTravailImport(travailId ?? ''),
    enabled: travailId !== null,
    refetchInterval: (requete) =>
      importEnCours(requete.state.data) ? SONDAGE_MS : LIVE_SLOW_INTERVAL_MS,
  });

  const depot = useMutation({
    mutationFn: (fichier: File) => deposerClasseur(genre, fichier),
    onSuccess: (cree) => {
      queryClient.setQueryData(queryKeys.importJob(cree.id), cree);
      setTravailId(cree.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le classeur n’a pas pu être déposé.');
    },
  });

  const application = useMutation({
    mutationFn: (id: string) => appliquerImport(id),
    onSuccess: (maj) => {
      queryClient.setQueryData(queryKeys.importJob(maj.id), maj);
      setConfirmation(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success('Application lancée. L’écran suit son avancement.');
    },
    onError: (erreur) => {
      setConfirmation(false);
      toastApiError(erreur, 'L’import n’a pas pu être appliqué.');
    },
  });

  const accepter = (candidat: File | null): void => {
    if (candidat === null) return;
    if (!candidat.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Seul un classeur Excel (.xlsx) est accepté.');
      return;
    }
    if (candidat.size > TAILLE_MAX_OCTETS) {
      toast.error('Fichier trop volumineux : 25 Mo au maximum.');
      return;
    }
    depot.mutate(candidat);
  };

  const modele = MODELES_GENRE[genre];
  const courant = travail.data;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Déposer un classeur</CardTitle>
          <CardDescription>
            Le fichier est d’abord simulé. Rien n’est écrit tant que l’application n’est pas
            confirmée.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-col gap-1.5">
              <Label htmlFor="genre-import">Entité à importer</Label>
              <Select
                items={OPTIONS_GENRE}
                value={genre}
                onValueChange={(valeur) => {
                  if (typeof valeur === 'string' && estGenre(valeur)) setGenre(valeur);
                }}
              >
                <SelectTrigger id="genre-import">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS_GENRE.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {modele === undefined ? null : (
              <a href={modele} download className={buttonVariants({ variant: 'outline' })}>
                <DownloadIcon aria-hidden="true" />
                Télécharger le modèle
              </a>
            )}
          </div>

          <p className="text-[0.8125rem] text-muted-foreground">{CONSIGNES_GENRE[genre]}</p>

          {/* Le champ de fichier double la zone de dépôt : le glisser-déposer
              n'est pas atteignable au clavier. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- input de fichier associé */}
          <label
            htmlFor="fichier-import"
            onDragOver={(event) => {
              event.preventDefault();
              setGlisse(true);
            }}
            onDragLeave={() => {
              setGlisse(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setGlisse(false);
              accepter(event.dataTransfer.files.item(0));
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center',
              'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              glisse ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
            )}
          >
            <UploadIcon className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="text-[0.9375rem] font-[600]">
              Glissez le classeur ici, ou choisissez un fichier
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              Format .xlsx, 25 Mo au maximum.
            </span>
            <input
              id="fichier-import"
              ref={champFichier}
              type="file"
              accept={ACCEPTE}
              className="sr-only"
              disabled={depot.isPending}
              onChange={(event) => {
                accepter(event.target.files?.item(0) ?? null);
                // Vidé pour que redéposer le même fichier corrigé émette bien un
                // nouvel évènement `change`.
                event.target.value = '';
              }}
            />
          </label>

          {depot.isPending ? (
            <p role="status" className="flex items-center gap-2 text-[0.875rem]">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Envoi du classeur…
            </p>
          ) : null}
        </CardContent>
      </Card>

      {travail.isError && courant === undefined ? (
        <QueryErrorInline
          error={travail.error}
          onRetry={() => {
            void travail.refetch();
          }}
          fallback="Ce travail d’import n’a pas pu être relu."
        />
      ) : null}

      {courant === undefined ? null : (
        <PanneauTravail
          travail={courant}
          applique={application.isPending}
          onAppliquer={() => {
            setConfirmation(true);
          }}
          onRecommencer={() => {
            setTravailId(null);
            champFichier.current?.focus();
          }}
        />
      )}

      <details>
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[0.9375rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <HistoryIcon className="size-4 shrink-0" aria-hidden="true" />
          Imports précédents
        </summary>
        <div className="pt-3">
          <ImportsHistorique
            onOuvrir={(ouvert) => {
              queryClient.setQueryData(queryKeys.importJob(ouvert.id), ouvert);
              setTravailId(ouvert.id);
            }}
          />
        </div>
      </details>

      {confirmation && courant !== undefined ? (
        <ConfirmDialog
          open
          onOpenChange={(ouvert) => {
            if (!ouvert && !application.isPending) setConfirmation(false);
          }}
          pending={application.isPending}
          confirmVariant="default"
          confirmLabel={libelleApplication(courant)}
          title="Écrire ces lignes en base ?"
          description="La simulation ne sera plus rejouable : ce classeur passe en mode application."
          onConfirm={() => {
            application.mutate(courant.id);
          }}
        />
      ) : null}
    </div>
  );
}
