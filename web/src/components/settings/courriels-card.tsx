'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { StatutCourriel } from '@/components/bank/bank-courriels';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  COURRIEL_TYPE_LABELS,
  fetchCourrielsJournal,
  fetchReglagesCourriels,
  saveReglagesCourriels,
  type TypeCourriel,
} from '@/lib/data/courriels';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ReglagesCourriels } from '@/lib/types';

const CHAMPS: { cle: keyof ReglagesCourriels; label: string; aide: string }[] = [
  {
    cle: 'banque',
    label: 'Banque',
    aide: 'Reçoit chaque dossier complet validé sur la plateforme.',
  },
  {
    cle: 'banqueCopies',
    label: 'Copies banque',
    aide: 'En copie des dossiers complets. Reçoit aussi les encaissements et les rejets.',
  },
  {
    cle: 'enrolement',
    label: 'Enrôlement',
    aide: 'Reçoit chaque prospect dont la méthode est obtenue.',
  },
  { cle: 'enrolementCopies', label: 'Copies enrôlement', aide: 'En copie des prospects transmis.' },
];

function versTexte(liste: string[]): string {
  return liste.join('\n');
}

function versListe(texte: string): string[] {
  return texte
    .split(/[\n,;]+/u)
    .map((a) => a.trim())
    .filter((a) => a !== '');
}

/** Les destinataires des courriels formels et le journal de ce qui est parti. */
export function CourrielsCard() {
  const queryClient = useQueryClient();
  const reglages = useQuery({
    queryKey: queryKeys.courrielsReglages,
    queryFn: () => fetchReglagesCourriels(),
  });
  const enregistrer = useMutation({
    mutationFn: (body: ReglagesCourriels) => saveReglagesCourriels(body),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.courrielsReglages, suivants);
      toast.success('Destinataires enregistrés.');
    },
    onError: (error) => {
      toastApiError(error, 'Les destinataires n’ont pas pu être enregistrés.');
    },
  });

  if (reglages.isPending) return <Skeleton className="h-64 rounded-lg" />;
  if (reglages.isError) {
    return (
      <QueryErrorState
        error={reglages.error}
        onRetry={() => {
          void reglages.refetch();
        }}
        fallback="Les destinataires des courriels n’ont pas pu être lus."
      />
    );
  }

  return (
    <>
      <FormulaireDestinataires
        initial={reglages.data}
        pending={enregistrer.isPending}
        onSave={(body) => {
          enregistrer.mutate(body);
        }}
      />
      <JournalCourriels />
    </>
  );
}

function FormulaireDestinataires({
  initial,
  pending,
  onSave,
}: {
  initial: ReglagesCourriels;
  pending: boolean;
  onSave: (body: ReglagesCourriels) => void;
}) {
  const prefixe = useId();
  const [brouillon, setBrouillon] = useState<Record<keyof ReglagesCourriels, string>>({
    banque: versTexte(initial.banque),
    banqueCopies: versTexte(initial.banqueCopies),
    enrolement: versTexte(initial.enrolement),
    enrolementCopies: versTexte(initial.enrolementCopies),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courriels automatiques</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-[0.875rem] text-muted-foreground">
          Une adresse par ligne. Chaque envoi part avec un PDF joint et reste tracé dans le journal
          ci-dessous, même quand il échoue.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS.map((champ) => (
            <div key={champ.cle} className="flex flex-col gap-1.5">
              <Label htmlFor={`${prefixe}-${champ.cle}`}>{champ.label}</Label>
              <Textarea
                id={`${prefixe}-${champ.cle}`}
                rows={3}
                value={brouillon[champ.cle]}
                onChange={(event) => {
                  setBrouillon({ ...brouillon, [champ.cle]: event.target.value });
                }}
              />
              <p className="text-[0.75rem] text-muted-foreground">{champ.aide}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              onSave({
                banque: versListe(brouillon.banque),
                banqueCopies: versListe(brouillon.banqueCopies),
                enrolement: versListe(brouillon.enrolement),
                enrolementCopies: versListe(brouillon.enrolementCopies),
              });
            }}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function JournalCourriels() {
  const [page, setPage] = useState(1);
  const journal = useQuery({
    queryKey: queryKeys.courrielsJournal('', '', page),
    queryFn: () => fetchCourrielsJournal({ type: '', statut: '', page }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal des courriels</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {journal.isPending ? <Skeleton className="h-24 rounded-md" /> : null}
        {journal.isError ? (
          <p className="text-[0.875rem] text-destructive">Le journal n’a pas pu être lu.</p>
        ) : null}
        {journal.data?.items.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun courriel envoyé pour l’instant.
          </p>
        ) : null}
        {journal.data !== undefined && journal.data.items.length > 0 ? (
          <ul className="divide-y divide-border">
            {journal.data.items.map((courriel) => (
              <li
                key={courriel.id}
                className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 text-[0.8125rem]">
                  <p className="truncate font-[600]">
                    {COURRIEL_TYPE_LABELS[courriel.type as TypeCourriel] ?? courriel.type}
                  </p>
                  <p className="truncate text-muted-foreground">{courriel.sujet}</p>
                  <p className="text-[0.75rem] text-muted-foreground">
                    À {courriel.destinataires.join(', ') || 'personne'} ·{' '}
                    <time dateTime={courriel.createdAt}>{formatDateTime(courriel.createdAt)}</time>
                  </p>
                  {courriel.statut === 'ECHEC' && courriel.erreur !== null ? (
                    <p className="text-[0.75rem] text-destructive">{courriel.erreur}</p>
                  ) : null}
                </div>
                <StatutCourriel courriel={courriel} />
              </li>
            ))}
          </ul>
        ) : null}
        {journal.data !== undefined && journal.data.pageCount > 1 ? (
          <div className="flex items-center justify-end gap-2 text-[0.8125rem] tabular-nums">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </Button>
            <span>
              {page} / {journal.data.pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= journal.data.pageCount}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
