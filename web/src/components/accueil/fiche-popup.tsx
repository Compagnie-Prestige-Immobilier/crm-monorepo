'use client';

import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '@/api/auth';
import { ProspectDetailView } from '@/components/prospects/prospect-detail-view';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function FichePopup({
  prospectId,
  onClose,
}: {
  prospectId: string | null;
  onClose: () => void;
}) {
  const { data: user } = useQuery(meQueryOptions);
  return (
    <Dialog
      open={prospectId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogTitle className="sr-only">Fiche du prospect</DialogTitle>
        {prospectId === null || user === undefined || user === null ? null : (
          <ProspectDetailView prospectId={prospectId} role={user.role} enPopup />
        )}
      </DialogContent>
    </Dialog>
  );
}
