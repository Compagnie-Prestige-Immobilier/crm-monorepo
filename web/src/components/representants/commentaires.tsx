import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, SendHorizontalIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ajouterCommentaire,
  cleCommentaires,
  nouvelIdCommentaire,
  supprimerCommentaire,
  type CommentaireRepresentant,
} from '@/lib/data/representants';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const LONGUEUR_MAX = 2000;

interface NouveauCommentaire {
  id: string;
  body: string;
  clientCreatedAt: string;
}

/** Le composeur du fil. Ce qu'il publie apparaît dans l'histoire de la fiche. */
export function ComposeurFil({
  representantId,
  auteur,
}: {
  representantId: string;
  auteur: { id: string; fullName: string };
}) {
  const queryClient = useQueryClient();
  const champId = useId();
  const [brouillon, setBrouillon] = useState('');
  const queryKey = cleCommentaires(representantId);

  const publier = useMutation({
    mutationFn: (commentaire: NouveauCommentaire) =>
      ajouterCommentaire(representantId, commentaire),
    onMutate: async (commentaire) => {
      await queryClient.cancelQueries({ queryKey });
      const precedent = queryClient.getQueryData<CommentaireRepresentant[]>(queryKey);
      queryClient.setQueryData<CommentaireRepresentant[]>(queryKey, (courant) => [
        {
          ...commentaire,
          representantId,
          authorId: auteur.id,
          authorName: auteur.fullName,
          createdAt: commentaire.clientCreatedAt,
        },
        ...(courant ?? []),
      ]);
      return { precedent, body: commentaire.body };
    },
    // Un échec RENVOIE le texte dans la zone de saisie : sans cela, l'envoi
    // optimiste ferait disparaître un commentaire que personne n'a enregistré.
    onError: (erreur, _commentaire, contexte) => {
      if (contexte !== undefined) {
        queryClient.setQueryData(queryKey, contexte.precedent);
        setBrouillon(contexte.body);
      }
      toastApiError(erreur, 'Le commentaire n’a pas été publié.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const corps = brouillon.trim();

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/40 p-3">
      <Label htmlFor={champId}>Ajouter au fil</Label>
      <Textarea
        id={champId}
        value={brouillon}
        rows={2}
        maxLength={LONGUEUR_MAX}
        placeholder="Ce qui s’est dit, ce qui reste à faire."
        onChange={(event) => {
          setBrouillon(event.target.value);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-muted-foreground">
          Un commentaire publié ne se modifie plus.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={corps === ''}
          onClick={() => {
            if (corps === '' || corps.length > LONGUEUR_MAX) return;
            setBrouillon('');
            publier.mutate({
              id: nouvelIdCommentaire(),
              body: corps,
              clientCreatedAt: new Date().toISOString(),
            });
          }}
        >
          {publier.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <SendHorizontalIcon aria-hidden="true" />
          )}
          Publier
        </Button>
      </div>
    </div>
  );
}

export function DialogueSuppressionCommentaire({
  representantId,
  commentaire,
  onClose,
}: {
  representantId: string;
  commentaire: CommentaireRepresentant | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = cleCommentaires(representantId);

  const retirer = useMutation({
    mutationFn: (cible: CommentaireRepresentant) => supprimerCommentaire(representantId, cible.id),
    onSuccess: () => {
      onClose();
      toast.success('Commentaire supprimé.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le commentaire n’a pas été supprimé.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <ConfirmDialog
      open={commentaire !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
      pending={retirer.isPending}
      confirmLabel="Supprimer"
      title="Supprimer ce commentaire ?"
      description={
        commentaire === null
          ? ''
          : `Publié par ${commentaire.authorName} le ${formatDateTime(commentaire.clientCreatedAt)}. La ligne quitte le fil et ne se rétablit pas.`
      }
      onConfirm={() => {
        if (commentaire !== null) retirer.mutate(commentaire);
      }}
    >
      {commentaire === null ? null : (
        <p className="max-w-prose rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem] whitespace-pre-wrap">
          {commentaire.body}
        </p>
      )}
    </ConfirmDialog>
  );
}
