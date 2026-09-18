'use client';

import { DownloadIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/utils';
import { isDemoExport, withDemoSuffix } from '@/lib/demo-marking';

export function GlobalExportButton() {
  const [pending, setPending] = useState(false);

  async function download(): Promise<void> {
    setPending(true);
    try {
      const response = await fetch('/api/export/global', { cache: 'no-store' });
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(error, 'L’export a échoué. Réessayez.'));
      }
      const { completeGlobalWorkbook } = await import('@/lib/global-export-xlsx');
      const data = await completeGlobalWorkbook(await response.arrayBuffer());
      const url = URL.createObjectURL(
        new Blob([data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = withDemoSuffix(
        `cpi-global-${new Date().toISOString().slice(0, 10)}.xlsx`,
        isDemoExport(response.headers),
      );
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'L’export a échoué. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="cpi-export border-white/45 bg-white text-primary hover:bg-white/90 hover:text-primary"
      disabled={pending}
      aria-busy={pending}
      title="Export Excel global"
      onClick={() => void download()}
    >
      {pending ? (
        <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        <DownloadIcon aria-hidden="true" />
      )}
      <span className="sr-only lg:not-sr-only">
        {pending ? 'Préparation…' : 'Export Excel global'}
      </span>
    </Button>
  );
}
