'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClockIcon,
  CheckIcon,
  ClipboardPenIcon,
  MoreHorizontalIcon,
  PlusIcon,
  UserCheckIcon,
  UserXIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suivreRendezVous } from '@/lib/data/prospects';
import { CLE_RENDEZ_VOUS, type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

type Geste = 'CONFIRME' | 'ANNULE' | 'HONORE' | 'NON_HONORE' | 'REPORTE';
type Bouton = 'CONFIRME' | 'HONORE' | 'NON_HONORE' | 'REPORTER' | 'ANNULER';

const MESSAGES: Record<Geste, string> = {
  CONFIRME: 'Rendez-vous confirmé.',
  ANNULE: 'Rendez-vous annulé.',
  HONORE: 'Présence notée.',
  NON_HONORE: 'Absence notée.',
  REPORTE: 'Rendez-vous reporté. Il revient à confirmer.',
};

const BOUTONS: Record<Bouton, { label: string; Icon: typeof CheckIcon }> = {
  CONFIRME: { label: 'Confirmer', Icon: CheckIcon },
  HONORE: { label: 'Présent', Icon: UserCheckIcon },
  NON_HONORE: { label: 'Absent', Icon: UserXIcon },
  REPORTER: { label: 'Reporter', Icon: CalendarClockIcon },
  ANNULER: { label: 'Annuler', Icon: XIcon },
};

/** Le geste attendu reste visible ; le reste passe dans le menu « … ». */
function gestesDe(fiche: RendezVousObtenu): { visibles: Bouton[]; menu: Bouton[] } {
  if (fiche.etape === 'A_CONFIRMER')
    return { visibles: ['CONFIRME'], menu: ['REPORTER', 'ANNULER'] };
  if (fiche.etape === 'CONFIRMES' || fiche.etape === 'EN_RETARD') {
    return { visibles: ['HONORE', 'NON_HONORE'], menu: ['REPORTER', 'ANNULER'] };
  }
  return { visibles: [], menu: [] };
}

function Reporter({
  fiche,
  pending,
  onReporter,
  onClose,
}: {
  fiche: RendezVousObtenu;
  pending: boolean;
  onReporter: (iso: string) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState('');
  const iso = dakarLocalToIso(local);
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Reporter le rendez-vous de {fiche.prenom} {fiche.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rendez-vous-nouvelle-date">Nouvelle date (heure de Dakar)</Label>
          <Input
            id="rendez-vous-nouvelle-date"
            type="datetime-local"
            value={local}
            onChange={(event) => {
              setLocal(event.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            disabled={iso === null || pending}
            onClick={() => {
              if (iso !== null) onReporter(iso);
            }}
          >
            Reporter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Suites({
  fiche,
  peutCloser,
  onCloser,
  onEnregistrerVisite,
}: {
  fiche: RendezVousObtenu;
  peutCloser: boolean;
  onCloser: (fiche: RendezVousObtenu) => void;
  onEnregistrerVisite: ((fiche: RendezVousObtenu) => void) | null;
}) {
  if (fiche.issue !== 'HONORE') return null;
  const aCloser = fiche.etape === 'A_CLOSER';
  return (
    <>
      {peutCloser ? (
        <Button
          size="sm"
          variant={aCloser ? 'default' : 'ghost'}
          onClick={() => {
            toast.dismiss();
            onCloser(fiche);
          }}
          className="gap-1.5"
        >
          <ClipboardPenIcon className="size-3.5" aria-hidden="true" />
          {aCloser ? 'Compléter le closing' : 'Voir le closing'}
        </Button>
      ) : null}
      {onEnregistrerVisite === null ? null : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onEnregistrerVisite(fiche);
          }}
          className="gap-1.5"
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          Enregistrer la visite
        </Button>
      )}
    </>
  );
}

export function ActionsRendezVous({
  fiche,
  peutNoter,
  peutCloser,
  onCloser,
  onEnregistrerVisite,
  onFait,
}: {
  fiche: RendezVousObtenu;
  peutNoter: boolean;
  peutCloser: boolean;
  onCloser: (fiche: RendezVousObtenu) => void;
  onEnregistrerVisite: ((fiche: RendezVousObtenu) => void) | null;
  /** L'agenda ferme sa fiche une fois le geste enregistré. */
  onFait?: () => void;
}) {
  const client = useQueryClient();
  const [dialogue, setDialogue] = useState<'reporter' | 'annuler' | null>(null);
  const noter = useMutation({
    mutationFn: ({ issue, reporteAt }: { issue: Geste; reporteAt?: string }) =>
      suivreRendezVous(fiche.id, { issue, ...(reporteAt === undefined ? {} : { reporteAt }) }),
    onSuccess: (_, { issue }) => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      setDialogue(null);
      onFait?.();
      // Présent, le closing s'ouvre aussitôt : pas d'aller-retour dans la liste.
      if (issue === 'HONORE' && peutCloser) {
        toast.dismiss();
        onCloser({ ...fiche, issue: 'HONORE', etape: 'A_CLOSER' });
      } else toast.success(MESSAGES[issue]);
    },
    onError: (error) => toastApiError(error, 'Le rendez-vous n’a pas été mis à jour.'),
  });
  const cliquer = (bouton: Bouton) => {
    if (bouton === 'REPORTER') setDialogue('reporter');
    else if (bouton === 'ANNULER') setDialogue('annuler');
    else noter.mutate({ issue: bouton });
  };
  const { visibles, menu } = peutNoter ? gestesDe(fiche) : { visibles: [], menu: [] };
  const nom = `${fiche.prenom} ${fiche.nom}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibles.map((bouton) => {
        const { label, Icon } = BOUTONS[bouton];
        return (
          <Button
            key={bouton}
            size="sm"
            variant={bouton === 'NON_HONORE' ? 'outline' : 'default'}
            disabled={noter.isPending}
            aria-label={`${label} : ${nom}`}
            onClick={() => {
              cliquer(bouton);
            }}
            className="gap-1.5"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </Button>
        );
      })}
      <Suites
        fiche={fiche}
        peutCloser={peutCloser}
        onCloser={onCloser}
        onEnregistrerVisite={onEnregistrerVisite}
      />
      {menu.length === 0 ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label={`Autres actions : ${nom}`} />}
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {menu.map((bouton) => {
              const { label, Icon } = BOUTONS[bouton];
              return (
                <DropdownMenuItem
                  key={bouton}
                  onClick={() => {
                    cliquer(bouton);
                  }}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {dialogue === 'reporter' ? (
        <Reporter
          fiche={fiche}
          pending={noter.isPending}
          onReporter={(reporteAt) => {
            noter.mutate({ issue: 'REPORTE', reporteAt });
          }}
          onClose={() => {
            setDialogue(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialogue === 'annuler'}
        onOpenChange={(ouvert) => {
          setDialogue(ouvert ? 'annuler' : null);
        }}
        title={`Annuler le rendez-vous de ${nom} ?`}
        description="Il passe dans l’historique. Un nouveau rendez-vous se reprend depuis la fiche."
        confirmLabel="Annuler le rendez-vous"
        pending={noter.isPending}
        onConfirm={() => {
          noter.mutate({ issue: 'ANNULE' });
        }}
      />
    </div>
  );
}
