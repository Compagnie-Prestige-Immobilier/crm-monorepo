import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, ArrowRightIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Candidats, CarteProspect } from '@/components/prospects/dialogue-fusion-choix';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { fusionnerProspects, type Prospect } from '@/lib/data/prospects';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function paire(
  prospect: Prospect,
  doublon: Prospect | null,
  garderOriginal: boolean,
): { conserve: Prospect | null; absorbe: Prospect | null } {
  if (garderOriginal) return { conserve: prospect, absorbe: doublon };
  return { conserve: doublon, absorbe: prospect };
}

function libelleBouton(conserve: Prospect | null): string {
  if (conserve === null) return 'Fusionner';
  return `Conserver ${conserve.prenom} ${conserve.nom}`;
}

export function DialogueFusionProspects({
  prospect,
  onOpenChange,
}: {
  prospect: Prospect | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState('');
  const [doublon, setDoublon] = useState<Prospect | null>(null);
  const [garderOriginal, setGarderOriginal] = useState(true);
  const { brouillon, frapper } = useRechercheDifferee(recherche, setRecherche);

  useEffect(() => {
    if (prospect === null) return;
    // oxlint-disable-next-line react/set-state-in-effect -- choix recalé sur la fiche ouverte
    setRecherche('');
    setDoublon(null);
    setGarderOriginal(true);
  }, [prospect]);

  const fusionner = useMutation({
    mutationFn: () => {
      if (prospect === null || doublon === null) {
        throw new Error('Sélectionnez la fiche à fusionner.');
      }
      const cibles = paire(prospect, doublon, garderOriginal);
      return fusionnerProspects({
        targetId: cibles.conserve?.id ?? prospect.id,
        sourceId: cibles.absorbe?.id ?? doublon.id,
        preferSource: false,
      });
    },
    onSuccess: (conserve) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(`Fusion effectuée. Fiche conservée : ${conserve.prenom} ${conserve.nom}.`);
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La fusion a échoué. Aucune fiche n’a été modifiée.');
    },
  });

  if (prospect === null) return null;

  const { conserve, absorbe } = paire(prospect, doublon, garderOriginal);

  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fusionner deux doublons</DialogTitle>
          <DialogDescription>
            Choisissez la fiche à conserver. L’autre est supprimée, son historique suit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <SearchField
            label="Fiche en double"
            value={brouillon}
            onChange={frapper}
            placeholder="Nom ou téléphone (2 caractères minimum)…"
          />
          <Candidats
            recherche={recherche}
            exclureId={prospect.id}
            choisiId={doublon?.id ?? null}
            onChoisir={setDoublon}
          />
        </div>

        {doublon === null ? null : (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-[0.875rem] font-[600]">Fiche conservée</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <CarteProspect
                  prospect={prospect}
                  choisi={garderOriginal}
                  onChoisir={() => {
                    setGarderOriginal(true);
                  }}
                />
                <CarteProspect
                  prospect={doublon}
                  choisi={!garderOriginal}
                  onChoisir={() => {
                    setGarderOriginal(false);
                  }}
                />
              </div>
            </fieldset>

            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
            >
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Cette opération est <strong>irréversible</strong>. La fiche{' '}
                <strong>
                  {absorbe?.prenom} {absorbe?.nom}
                </strong>{' '}
                sera supprimée.
              </span>
            </p>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={doublon === null || fusionner.isPending}
            onClick={() => {
              fusionner.mutate();
            }}
          >
            {fusionner.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightIcon aria-hidden="true" />
            )}
            {libelleBouton(conserve)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
