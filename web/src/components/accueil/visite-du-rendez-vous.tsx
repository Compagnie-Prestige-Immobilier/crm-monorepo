'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { VisiteForm } from '@/components/accueil/visite-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { fetchVisiteReferentiels, VISITE_REFERENTIELS_QUERY_KEY } from '@/lib/data/visites';
import { formatPhone } from '@/lib/format';

export function VisiteDuRendezVous({
  rendezVous,
  onClose,
}: {
  rendezVous: RendezVousObtenu | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const referentiels = useQuery({
    queryKey: VISITE_REFERENTIELS_QUERY_KEY,
    queryFn: () => fetchVisiteReferentiels(),
    staleTime: 5 * 60_000,
    enabled: rendezVous !== null,
  });
  if (rendezVous === null) return null;
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Enregistrer une visite</DialogTitle>
        </DialogHeader>
        <VisiteForm
          referentiels={referentiels.data}
          preremplie={{
            visitorName: `${rendezVous.prenom} ${rendezVous.nom}`.trim(),
            phone: rendezVous.phoneE164 === null ? '' : formatPhone(rendezVous.phoneE164),
            comment: `Rendez-vous ${rendezVous.type} pris par ${rendezVous.prisPar}`,
          }}
          onSaved={() => {
            onClose();
            void client.invalidateQueries({ queryKey: ['visites'] });
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
