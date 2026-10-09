'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownloadIcon, LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { releverLeadsMaintenant } from '@/lib/data/imports';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut } from '@/lib/types';

/**
 * Le relevé horaire ne relit le classeur SharePoint que s'il a changé. Ce geste
 * le relit tout de suite, même inchangé, et rend le bilan du travail appliqué.
 */
export function ReleveLeads() {
  const queryClient = useQueryClient();
  const { data: user } = useQuery(meQueryOptions);

  const releve = useMutation({
    mutationFn: () => releverLeadsMaintenant(),
    onSuccess: (travail) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
      void queryClient.invalidateQueries({ queryKey: ['lots-export'] });
      if (travail.status !== 'succeeded' || travail.mode !== 'APPLY') {
        toast.warning(`${travail.fileName} : relevé refusé, le détail est dans l’historique.`);
        return;
      }
      toast.success(`${travail.fileName} relevé.`, {
        description: `${travail.createdRows} nouvelle(s) fiche(s), ${travail.updatedRows} mise(s) à jour, ${travail.errorRows} ligne(s) refusée(s).`,
      });
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le relevé du classeur SharePoint a échoué.'));
    },
  });

  if (!peut(user, 'imports.relever')) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={releve.isPending}
      onClick={() => {
        releve.mutate();
      }}
    >
      {releve.isPending ? (
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <CloudDownloadIcon className="size-4" aria-hidden="true" />
      )}
      Relever SharePoint maintenant
    </Button>
  );
}
