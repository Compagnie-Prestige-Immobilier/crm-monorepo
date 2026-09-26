'use client';

import { useMutation } from '@tanstack/react-query';
import { SparklesIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resumerFiche, type ResumeFiche } from '@/lib/data/assistant';
import { toastApiError } from '@/lib/mutation-feedback';

export function useResumeFiche() {
  return useMutation({
    mutationFn: resumerFiche,
    onError: (error) => toastApiError(error, 'Le résumé n’a pas pu être calculé.'),
  });
}

export function BoutonResume({
  resume,
  prospectId,
}: {
  resume: ReturnType<typeof useResumeFiche>;
  prospectId: string;
}) {
  return (
    <Button
      variant="outline"
      className="max-sm:col-span-2"
      disabled={resume.isPending}
      aria-busy={resume.isPending}
      onClick={() => {
        resume.mutate(prospectId);
      }}
    >
      <SparklesIcon aria-hidden="true" />
      Résumer cette fiche
    </Button>
  );
}

export function EncartResume({ resume }: { resume: ResumeFiche }) {
  return (
    <details
      open
      className="rounded-xl border border-border bg-card px-4 py-3 text-[0.875rem] animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none"
    >
      <summary className="cursor-pointer font-[600]">
        Résumé de la fiche
        {resume.reponduPar === 'calcul' ? (
          <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
            résumé calculé
          </span>
        ) : null}
      </summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
        {resume.lignes.map((ligne) => (
          <li key={ligne}>{ligne}</li>
        ))}
      </ol>
    </details>
  );
}
