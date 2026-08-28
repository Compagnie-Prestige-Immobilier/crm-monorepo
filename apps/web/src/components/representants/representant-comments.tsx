'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, SendHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  createRepresentantComment,
  deleteRepresentantComment,
  fetchRepresentantComments,
  newCommentId,
  representantCommentsQueryKey,
  type NewRepresentantComment,
  type RepresentantComment,
} from '@/lib/data/representants';
import { formatDateTime, initials } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const MAX_LENGTH = 2000;

export function RepresentantComments({
  representantId,
  author,
  canAdminister = false,
  readOnly = false,
}: {
  representantId: string;
  author: { id: string; fullName: string };
  canAdminister?: boolean;
  /** Un rôle de pilotage lit le fil : le composeur disparaît au lieu de 403. */
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<RepresentantComment | null>(null);
  const queryKey = representantCommentsQueryKey(representantId);

  const thread = useQuery({ queryKey, queryFn: () => fetchRepresentantComments(representantId) });

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

  const remove = useMutation({
    mutationFn: (comment: RepresentantComment) =>
      deleteRepresentantComment(representantId, comment.id),
    onSuccess: () => {
      setDeleting(null);
      toast.success('Commentaire supprimé.');
    },
    onError: (error) => {
      toastApiError(error, 'Le commentaire n’a pas été supprimé.');
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
    <div className="flex flex-col gap-5">
      {readOnly ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldId}>Ajouter au fil</Label>
          <Textarea
            id={fieldId}
            value={draft}
            rows={3}
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
      )}

      {(() => {
        if (thread.isPending) return <Skeleton className="h-24 w-full" />;
        return (() => {
          if (thread.isError)
            return (
              <QueryErrorState
                error={thread.error}
                onRetry={() => {
                  void thread.refetch();
                }}
                fallback="Le fil n’a pas pu être chargé."
              />
            );
          return (() => {
            if (thread.data.length === 0)
              return (
                <p className="text-[0.875rem] text-muted-foreground">
                  Rien dans le fil. Le premier commentaire dit d’où part la relation.
                </p>
              );
            return (
              <ol aria-label="Fil de la fiche" className="flex flex-col divide-y divide-border">
                {thread.data.map((comment) => (
                  <li key={comment.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6875rem] font-[700] text-secondary-foreground"
                    >
                      {initials(comment.authorName)}
                    </span>
                    <div className="min-w-0 grow">
                      <p className="text-[0.75rem] text-muted-foreground">
                        <span className="font-[600] text-foreground">{comment.authorName}</span> ·{' '}
                        <time dateTime={comment.clientCreatedAt} className="tabular-nums">
                          {formatDateTime(comment.clientCreatedAt)}
                        </time>
                      </p>
                      <p className="max-w-prose whitespace-pre-wrap text-[0.875rem]">
                        {comment.body}
                      </p>
                    </div>
                    {canAdminister ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Supprimer ce commentaire"
                        onClick={() => {
                          setDeleting(comment);
                        }}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            );
          })();
        })();
      })()}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        pending={remove.isPending}
        confirmLabel="Supprimer"
        title="Supprimer ce commentaire ?"
        description={
          deleting === null
            ? ''
            : `Publié par ${deleting.authorName} le ${formatDateTime(deleting.clientCreatedAt)}. La ligne quitte le fil et ne se rétablit pas.`
        }
        onConfirm={() => {
          if (deleting !== null) remove.mutate(deleting);
        }}
      >
        {deleting === null ? null : (
          <p className="max-w-prose rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem] whitespace-pre-wrap">
            {deleting.body}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
