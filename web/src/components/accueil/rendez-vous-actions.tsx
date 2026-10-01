'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClockIcon,
  CheckIcon,
  ClipboardPenIcon,
  MoreHorizontalIcon,
  PhoneForwardedIcon,
  PlusIcon,
  UserCheckIcon,
  UserXIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { RecontacterRendezVous } from '@/components/accueil/recontacter-rendez-vous';
import { ReporterRendezVous } from '@/components/accueil/reporter-rendez-vous';
import { AffecterFiche } from '@/components/prospects/affecter-fiche';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { suivreRendezVous } from '@/lib/data/prospects';
import { CLE_RENDEZ_VOUS, type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { toastApiError } from '@/lib/mutation-feedback';

type Geste = 'CONFIRME' | 'ANNULE' | 'HONORE' | 'NON_HONORE' | 'REPORTE' | 'A_RECONTACTER';
type Precisions = { reporteAt: string; commentaire: string; recontacterLe: string };
type Bouton = 'CONFIRME' | 'HONORE' | 'NON_HONORE' | 'REPORTER' | 'RECONTACTER' | 'ANNULER';

const MESSAGES: Record<Geste, string> = {
  CONFIRME: 'Rendez-vous confirmé.',
  ANNULE: 'Rendez-vous annulé.',
  HONORE: 'Présence notée.',
  NON_HONORE: 'Absence notée.',
  REPORTE: 'Rendez-vous reporté. Il revient à confirmer.',
  A_RECONTACTER: 'Rendez-vous à recontacter. Il quitte l’agenda.',
};

const BOUTONS: Record<Bouton, { label: string; Icon: typeof CheckIcon }> = {
  CONFIRME: { label: 'Confirmer', Icon: CheckIcon },
  HONORE: { label: 'Présent', Icon: UserCheckIcon },
  NON_HONORE: { label: 'Absent', Icon: UserXIcon },
  REPORTER: { label: 'Reporter', Icon: CalendarClockIcon },
  RECONTACTER: { label: 'À recontacter', Icon: PhoneForwardedIcon },
  ANNULER: { label: 'Annuler', Icon: XIcon },
};

/** Le geste attendu reste visible ; le reste passe dans le menu « … ». */
function gestesDe(fiche: RendezVousObtenu): { visibles: Bouton[]; menu: Bouton[] } {
  if (fiche.etape === 'A_CONFIRMER')
    return { visibles: ['CONFIRME'], menu: ['REPORTER', 'RECONTACTER', 'ANNULER'] };
  if (fiche.etape === 'A_RECONTACTER')
    return { visibles: ['REPORTER'], menu: ['RECONTACTER', 'ANNULER'] };
  if (fiche.etape === 'EN_RETARD' && fiche.confirmation === '') {
    return {
      visibles: ['CONFIRME'],
      menu: ['HONORE', 'NON_HONORE', 'REPORTER', 'RECONTACTER', 'ANNULER'],
    };
  }
  if (fiche.etape === 'CONFIRMES' || fiche.etape === 'EN_RETARD') {
    return { visibles: ['HONORE', 'NON_HONORE'], menu: ['REPORTER', 'ANNULER'] };
  }
  return { visibles: [], menu: [] };
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

function BoutonGeste({
  bouton,
  nom,
  bulle,
  pending,
  onClick,
}: {
  bouton: Bouton;
  nom: string;
  bulle: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const { label, Icon } = BOUTONS[bouton];
  const principal = bouton === 'CONFIRME' || bouton === 'HONORE';
  return (
    <Button
      size={bulle ? 'default' : 'sm'}
      variant={principal ? 'default' : 'outline'}
      disabled={pending}
      aria-label={`${label} : ${nom}`}
      onClick={onClick}
      className={bulle ? 'h-11 justify-start gap-2 text-[0.9375rem]' : 'gap-1.5'}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function ActionsRendezVous({
  fiche,
  peutNoter,
  peutCloser,
  onCloser,
  onEnregistrerVisite,
  onFait,
  bulle = false,
}: {
  fiche: RendezVousObtenu;
  peutNoter: boolean;
  peutCloser: boolean;
  onCloser: (fiche: RendezVousObtenu) => void;
  onEnregistrerVisite: ((fiche: RendezVousObtenu) => void) | null;
  /** L'agenda ferme sa bulle une fois le geste enregistré. */
  onFait?: () => void;
  bulle?: boolean;
}) {
  const client = useQueryClient();
  const [dialogue, setDialogue] = useState<
    'confirmer' | 'reporter' | 'recontacter' | 'annuler' | null
  >(null);
  const noter = useMutation({
    mutationFn: ({ issue, ...precisions }: { issue: Geste } & Partial<Precisions>) =>
      suivreRendezVous(fiche.id, { issue, ...precisions }),
    onSuccess: (_, { issue, reporteAt }) => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      setDialogue(null);
      onFait?.();
      // Présent, le closing s'ouvre aussitôt : pas d'aller-retour dans la liste.
      if (issue === 'HONORE' && peutCloser) {
        toast.dismiss();
        onCloser({ ...fiche, issue: 'HONORE', etape: 'A_CLOSER' });
      } else if (issue === 'REPORTE' && reporteAt === undefined) {
        toast.success('Rendez-vous reporté sans heure. Il attend dans « À recontacter ».');
      } else toast.success(MESSAGES[issue]);
    },
    onError: (error) => toastApiError(error, 'Le rendez-vous n’a pas été mis à jour.'),
  });
  const cliquer = (bouton: Bouton) => {
    if (bouton === 'CONFIRME') setDialogue('confirmer');
    else if (bouton === 'REPORTER') setDialogue('reporter');
    else if (bouton === 'RECONTACTER') setDialogue('recontacter');
    else if (bouton === 'ANNULER') setDialogue('annuler');
    else noter.mutate({ issue: bouton });
  };
  const gestes = peutNoter ? gestesDe(fiche) : { visibles: [], menu: [] };
  // En bulle, tout est à portée de clic ; en ligne, le secondaire passe dans « … ».
  const visibles = bulle ? [...gestes.visibles, ...gestes.menu] : gestes.visibles;
  const menu = bulle ? [] : gestes.menu;
  const nom = `${fiche.prenom} ${fiche.nom}`;

  return (
    <div className={bulle ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-2'}>
      {visibles.map((bouton) => (
        <BoutonGeste
          key={bouton}
          bouton={bouton}
          nom={nom}
          bulle={bulle}
          pending={noter.isPending}
          onClick={() => {
            cliquer(bouton);
          }}
        />
      ))}
      <Suites
        fiche={fiche}
        peutCloser={peutCloser}
        onCloser={onCloser}
        onEnregistrerVisite={onEnregistrerVisite}
      />
      <AffecterFiche
        cible="prospect"
        id={fiche.id}
        nom={nom}
        titulaireId={fiche.titulaireId}
        onAffectee={() => void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS })}
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
      {dialogue === 'reporter' || dialogue === 'confirmer' ? (
        <ReporterRendezVous
          fiche={fiche}
          confirmation={dialogue === 'confirmer'}
          pending={noter.isPending}
          onValider={(suivi) => {
            noter.mutate(suivi);
          }}
          onClose={() => {
            setDialogue(null);
          }}
        />
      ) : null}
      {dialogue === 'recontacter' ? (
        <RecontacterRendezVous
          fiche={fiche}
          pending={noter.isPending}
          onRecontacter={(commentaire, recontacterLe) => {
            noter.mutate({
              issue: 'A_RECONTACTER',
              commentaire,
              ...(recontacterLe === '' ? {} : { recontacterLe }),
            });
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
