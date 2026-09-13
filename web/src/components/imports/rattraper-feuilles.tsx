'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, WandSparklesIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { rattraperFeuillesImport } from '@/lib/data/imports';
import { apiErrorText } from '@/lib/mutation-feedback';

/**
 * RATTRAPAGE PONCTUEL, À RETIRER APRÈS USAGE. Les fiches importées avant le
 * 13 septembre 2026 n'ont pas d'onglet : leur lot s'affiche sous le nom du
 * classeur, le même pour tous les jours. Ce geste relit les classeurs conservés
 * et pose l'onglet sur chaque fiche.
 */
export function RattraperFeuilles() {
  const queryClient = useQueryClient();

  const rattrapage = useMutation({
    mutationFn: () => rattraperFeuillesImport(),
    onSuccess: (bilan) => {
      void queryClient.invalidateQueries({ queryKey: ['lots-export'] });
      const refus = bilan.classeurs.filter((classeur) => classeur.motif !== undefined);
      if (bilan.fiches === 0 && refus.length === 0) {
        toast.success('Aucun lot à renommer : tous portent déjà leur onglet.');
        return;
      }
      toast.success(`${bilan.fiches} fiche(s) rattachées à leur onglet.`, {
        description:
          refus.length === 0
            ? undefined
            : `${refus.length} classeur(s) illisibles : ${refus.map((c) => c.fileName).join(', ')}`,
      });
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le rattrapage des onglets a échoué.'));
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      disabled={rattrapage.isPending}
      onClick={() => {
        rattrapage.mutate();
      }}
    >
      {rattrapage.isPending ? (
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <WandSparklesIcon className="size-4" aria-hidden="true" />
      )}
      Nommer les lots d’après leur onglet
    </Button>
  );
}
