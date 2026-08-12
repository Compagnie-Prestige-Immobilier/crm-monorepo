'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/utils';

/**
 * Téléchargement d'un fichier produit par un Route Handler.
 *
 * On ne pose JAMAIS un simple `<a download>` : la réponse peut être une erreur
 * JSON (session expirée, rôle refusé, API indisponible), et un lien nu
 * enregistrerait alors un fichier `.xlsx` ou `.pdf` contenant du texte
 * d'erreur — que l'utilisateur transmettrait sans le savoir, et que le
 * destinataire ouvrirait devant sa direction. On récupère donc la réponse, on
 * vérifie le statut, et on ne déclenche l'enregistrement qu'ensuite.
 *
 * Le drapeau `pending` interdit le second clic : deux téléchargements
 * concurrents du même classeur consommeraient deux fois le quota de l'API pour
 * un seul fichier utile.
 */
export function useFileDownload(): {
  pending: boolean;
  download: (input: { url: string; fileName: string; failureMessage: string }) => Promise<void>;
} {
  const [pending, setPending] = useState(false);

  const download = useCallback(
    async (input: { url: string; fileName: string; failureMessage: string }) => {
      setPending(true);
      try {
        const response = await fetch(input.url);

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          toast.error(apiErrorMessage(payload, input.failureMessage));
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = input.fileName;
        anchor.click();
        // Sans révocation, le blob reste en mémoire tant que l'onglet est ouvert.
        URL.revokeObjectURL(objectUrl);
        toast.success('Fichier généré.');
      } catch {
        toast.error('Le serveur est injoignable.');
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { pending, download };
}
