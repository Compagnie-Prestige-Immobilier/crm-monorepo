import { DialogueEditionProspect } from '@/components/prospects/dialogue-edition';
import { DialogueFusionProspects } from '@/components/prospects/dialogue-fusion';
import { DialogueReaffectation } from '@/components/prospects/dialogue-reaffectation';
import { FormulaireProspect } from '@/components/prospects/formulaire';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Prospect } from '@/lib/data/prospects';
import { formatPhone } from '@/lib/format';

export interface EtatsDialogues {
  creation: boolean;
  edition: Prospect | null;
  fusion: Prospect | null;
  reaffectation: Prospect | null;
  suppression: Prospect | null;
}

function resume(prospect: Prospect): string {
  return `${prospect.prenom} ${prospect.nom}, ${formatPhone(prospect.phoneE164)}. La fiche quitte les listes et les exports, le numéro redevient disponible.`;
}

/** Les cinq boîtes de la liste : ouvertes par le menu d'une ligne, fermées ensemble. */
export function DialoguesProspects({
  etats,
  suppressionEnCours,
  onFermer,
  onSupprimer,
}: {
  etats: EtatsDialogues;
  suppressionEnCours: boolean;
  onFermer: (cle: keyof EtatsDialogues) => void;
  onSupprimer: (prospect: Prospect) => void;
}) {
  return (
    <>
      <Dialog
        open={etats.creation}
        onOpenChange={(ouvert) => {
          if (!ouvert) onFermer('creation');
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau prospect CHUES</DialogTitle>
            <DialogDescription>
              Recherchez le représentant par son nom ou son numéro.
            </DialogDescription>
          </DialogHeader>
          <FormulaireProspect
            representantId={null}
            onEnregistre={() => {
              onFermer('creation');
            }}
          />
        </DialogContent>
      </Dialog>

      <DialogueEditionProspect
        prospect={etats.edition}
        onOpenChange={(ouvert) => {
          if (!ouvert) onFermer('edition');
        }}
      />
      <DialogueFusionProspects
        prospect={etats.fusion}
        onOpenChange={(ouvert) => {
          if (!ouvert) onFermer('fusion');
        }}
      />
      <DialogueReaffectation
        prospect={etats.reaffectation}
        onOpenChange={(ouvert) => {
          if (!ouvert) onFermer('reaffectation');
        }}
      />

      <ConfirmDialog
        open={etats.suppression !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) onFermer('suppression');
        }}
        pending={suppressionEnCours}
        confirmLabel="Supprimer"
        title="Supprimer ce prospect ?"
        description={etats.suppression === null ? '' : resume(etats.suppression)}
        onConfirm={() => {
          if (etats.suppression !== null) onSupprimer(etats.suppression);
        }}
      />
    </>
  );
}
