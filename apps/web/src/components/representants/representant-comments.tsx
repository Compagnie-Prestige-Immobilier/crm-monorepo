'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, SendHorizontalIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createRepresentantComment,
  deleteRepresentantComment,
  newCommentId,
  representantCommentsQueryKey,
  type NewRepresentantComment,
  type RepresentantComment,
} from '@/lib/data/representants';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const MAX_LENGTH = 2000;

/** Le composeur du fil. Ce qu'il publie apparaît dans l'histoire de la fiche. */
export function ComposeurFil({
  representantId,
  author,
}: {
  representantId: string;
  author: { id: string; fullName: string };
}) {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [draft, setDraft] = useState('');
  const queryKey = representantCommentsQueryKey(representantId);

  const publish = useMutation({
    mutationFn: (comment: NewRepresentantComment) =>
      createRepresentantComment(representantId, comment),
    onMutate: async (comment) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RepresentantComment[]>(queryKey);
      queryClient.setQueryData<RepresentantComment[]>(queryKey, (current) => [
        {
          ...comment,
          representantId,
          authorId: author.id,
          authorName: author.fullName,
          createdAt: comment.clientCreatedAt,
        },
        ...(current ?? []),
      ]);
      return { previous, body: comment.body };
    },
    // Un échec RENVOIE le texte dans la zone de saisie : sans cela, l'envoi
    // optimiste ferait disparaître un commentaire que personne n'a enregistré.
    onError: (error, _comment, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
        setDraft(context.body);
      }
      toastApiError(error, 'Le commentaire n’a pas été publié.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const body = draft.trim();

  const submit = () => {
    if (body === '' || body.length > MAX_LENGTH) return;
    setDraft('');
    publish.mutate({ id: newCommentId(), body, clientCreatedAt: new Date().toISOString() });
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/40 p-3">
      <Label htmlFor={fieldId}>Ajouter au fil</Label>
      <Textarea
        id={fieldId}
        value={draft}
        rows={2}
        maxLength={MAX_LENGTH}
        placeholder="Ce qui s’est dit, ce qui reste à faire."
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-muted-foreground">
          Un commentaire publié ne se modifie plus.
        </p>
        <Button type="button" size="sm" disabled={body === ''} onClick={submit}>
          {publish.isPending ? (
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

export function SupprimerCommentaireDialog({
  representantId,
  comment,
  onClose,
}: {
  representantId: string;
  comment: RepresentantComment | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = representantCommentsQueryKey(representantId);

  const remove = useMutation({
    mutationFn: (cible: RepresentantComment) => deleteRepresentantComment(representantId, cible.id),
    onSuccess: () => {
      onClose();
      toast.success('Commentaire supprimé.');
    },
    onError: (error) => {
      toastApiError(error, 'Le commentaire n’a pas été supprimé.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <ConfirmDialog
      open={comment !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      pending={remove.isPending}
      confirmLabel="Supprimer"
      title="Supprimer ce commentaire ?"
      description={
        comment === null
          ? ''
          : `Publié par ${comment.authorName} le ${formatDateTime(comment.clientCreatedAt)}. La ligne quitte le fil et ne se rétablit pas.`
      }
      onConfirm={() => {
        if (comment !== null) remove.mutate(comment);
      }}
    >
      {comment === null ? null : (
        <p className="max-w-prose rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem] whitespace-pre-wrap">
          {comment.body}
        </p>
      )}
    </ConfirmDialog>
  );
}
