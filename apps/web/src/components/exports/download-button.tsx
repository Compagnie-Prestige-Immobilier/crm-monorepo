'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { isDemoResponse, withDemoSuffix } from '@/lib/demo-marking';
import { apiErrorMessage } from '@/lib/utils';

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

        const fileName = withDemoSuffix(input.fileName, isDemoResponse(response.headers));

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
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
