'use client';

import { ProspectDetailView } from '@/components/prospects/prospect-detail-view';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function FichePopup({
  prospectId,
  onClose,
}: {
  prospectId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={prospectId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogTitle className="sr-only">Fiche du prospect</DialogTitle>
        {prospectId === null ? null : <ProspectDetailView prospectId={prospectId} enPopup />}
      </DialogContent>
    </Dialog>
  );
}
