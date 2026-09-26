'use client';

import { unwrap } from '@crm/api-client/query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  ClockIcon,
  EllipsisIcon,
  PhoneCallIcon,
  XCircleIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { sonActif } from '@/components/notifications/notification-signal';
import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  callbackKeys,
  cancelCallback,
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  snoozeCallback,
  type Callback,
  type DureeReport,
} from '@/lib/data/console';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { getApiClient } from '@/lib/api/browser';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

type Rappel = Callback;
const EMPTY_CALLBACKS: Callback[] = [];
const PAGE_INTRUSIF = 50;

/** Synthétise un carillon sonore de rappel à trois notes via Web Audio API. */
function jouerSonnerieRappel() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 659.25, time: 0, duration: 0.35, gain: 0.15 },
      { freq: 880, time: 0.15, duration: 0.5, gain: 0.2 },
      { freq: 1046.5, time: 0.35, duration: 0.6, gain: 0.25 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      g.gain.setValueAtTime(note.gain, now + note.time);
      g.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    }
    window.setTimeout(() => {
      void ctx.close();
    }, 1_400);
  } catch {
    // Context d'audio bloqué par la politique navigateur ou non disponible.
  }
}

async function retablirRappel(id: string): Promise<Rappel> {
  return unwrap(
    await getApiClient().POST('/api/v1/phase2/callbacks/{id}/retablir', {
      params: { path: { id } },
    }),
  );
}

/** Un rendez-vous fixé ne se reporte ni ne s'annule d'ici ; un rendez-vous téléphonique reste un rappel. */
export const rendezVousFixe = (callback: Rappel): boolean =>
  callback.rendezVous && callback.reasonCode !== 'RDV_TELEPHONIQUE';

export function useAnnulationRappel() {
  const queryClient = useQueryClient();
  const invalider = () => void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
  return useMutation({
    mutationFn: (id: string) => cancelCallback(id),
    onSuccess: (_rappel, id) => {
      invalider();
      toast.success('Rappel annulé.', {
        duration: 10_000,
        action: {
          label: 'Rétablir',
          onClick: () => {
            retablirRappel(id).then(
              () => {
                toast.success('Rappel rétabli.');
                invalider();
              },
              (error: unknown) => {
                toastApiError(error, 'Le rappel n’a pas été rétabli.');
              },
            );
          },
        },
      });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas été annulé.');
    },
  });
}

/** Annuler se range dans un menu, loin de l'action principale. */
export function AnnulerRappel({
  callback,
  pending,
  onAnnuler,
}: {
  callback: Rappel;
  pending: boolean;
  onAnnuler: () => void;
}) {
  const nom =
    callback.prospectName === '' ? formatPhone(callback.phoneE164) : callback.prospectName;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`Autres actions pour ${nom}`}
          />
        }
      >
        <EllipsisIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem variant="destructive" onClick={onAnnuler}>
          <XCircleIcon aria-hidden="true" />
          Annuler le rappel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const REPORTS: readonly { duree: DureeReport; libelle: string; annonce: string }[] = [
  { duree: '15min', libelle: '15 min', annonce: 'de 15 minutes' },
  { duree: '1h', libelle: '1 h', annonce: 'd’une heure' },
  { duree: '2h', libelle: '2 h', annonce: 'de 2 heures' },
  { duree: 'demain', libelle: 'Demain matin', annonce: 'à demain matin' },
];

export function useReportRappel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, duree }: { id: string; duree: DureeReport }) => snoozeCallback(id, duree),
    onSuccess: (_rappel, { duree }) => {
      const annonce = REPORTS.find((report) => report.duree === duree)?.annonce ?? '';
      toast.success(`Rappel reporté ${annonce}.`);
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas pu être reporté.');
    },
  });
}

export function RappelerDans({
  pending,
  onReporter,
  className,
}: {
  pending: boolean;
  onReporter: (duree: DureeReport) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={pending} className={className} />}
      >
        <ClockIcon className="size-4" aria-hidden="true" />
        Rappeler dans
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {REPORTS.map((report) => (
          <DropdownMenuItem key={report.duree} onClick={() => onReporter(report.duree)}>
            {report.libelle}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ContenuRappelProps {
  readonly callback: Rappel;
  readonly serverTimeMs: number;
  readonly racine: string;
  readonly onIgnorer: () => void;
  readonly onAnnuler: (id: string) => void;
  readonly onReporter: (id: string, duree: DureeReport) => void;
  readonly isPendingCancel: boolean;
  readonly isPendingSnooze: boolean;
  readonly enAttente: number;
}

function ContenuRappelPopUp({
  callback,
  serverTimeMs,
  racine,
  onIgnorer,
  onAnnuler,
  onReporter,
  isPendingCancel,
  isPendingSnooze,
  enAttente,
}: ContenuRappelProps) {
  const retardMs = serverTimeMs - Date.parse(callback.scheduledAt);
  const retardTxt = retardMs > 0 ? formatDelay(retardMs) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onIgnorer()}>
      <DialogContent showCloseButton className="w-[calc(100%-1rem)] max-w-lg overflow-x-hidden">
        <DialogHeader>
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <BellIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2">
                Rappel à passer
                <ProjetBadge projet={callback.projet} />
              </DialogTitle>
              <DialogDescription className="break-words">
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
                {enAttente > 1
                  ? ` · ${enAttente - 1} autre${enAttente > 2 ? 's' : ''} en attente`
                  : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prospect</p>
              <p className="text-lg font-semibold text-foreground">
                {callback.prospectName ?? `Prospect · ${callback.shortCode}`}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium text-muted-foreground">Téléphone</p>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatPhone(callback.phoneE164)}
              </p>
              <p className="font-mono text-xs text-muted-foreground">Fiche {callback.shortCode}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                Prévu
              </p>
              <time className="font-semibold" dateTime={callback.scheduledAt}>
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
              </time>
            </div>
            {retardTxt ? <Badge variant="destructive">Retard {retardTxt}</Badge> : null}
          </div>

          {callback.comment ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              <p className="whitespace-pre-wrap">{callback.comment}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {rendezVousFixe(callback) ? null : (
            <div className="order-last sm:order-first sm:mr-auto">
              <AnnulerRappel
                callback={callback}
                pending={isPendingCancel}
                onAnnuler={() => {
                  onAnnuler(callback.id);
                }}
              />
            </div>
          )}
          <a
            href={`tel:${callback.phoneE164}`}
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
              className: 'w-full gap-1.5 sm:w-auto',
            })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Appeler
          </a>

          <BoutonWhatsApp
            prospect={{
              prenom: callback.prospectName ?? '',
              phoneE164: callback.phoneE164,
              whatsappStatus: 'MEME_NUMERO',
              whatsappNumber: callback.phoneE164,
            }}
          />

          {rendezVousFixe(callback) ? null : (
            <RappelerDans
              className="w-full sm:w-auto"
              pending={isPendingSnooze}
              onReporter={(duree) => onReporter(callback.id, duree)}
            />
          )}

          <Link
            href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
            onClick={onIgnorer}
            className={buttonVariants({
              variant: 'default',
              size: 'sm',
              className: 'w-full gap-1.5 sm:w-auto',
            })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Consigner l’appel
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ne sonne que pour les rappels que la personne connectée a promis elle-même. */
export function RappelPopUpIntrusif({ userId }: { userId: string }) {
  const projet = undefined;
  const racine = '/teleconseil';
  const ficheOuverte = useSearchParams().get('fiche') !== null;

  // Un rappel reporté change d'heure : c'est une nouvelle échéance, à signaler à son tour.
  const echeance = (callback: Rappel) => `${callback.id}@${callback.scheduledAt}`;
  const [aSignaler, setASignaler] = useState<Set<string>>(() => new Set());
  const [ecartees, setEcartees] = useState<Set<string>>(() => new Set());
  const ouvertureRef = useRef<number | null>(null);

  const overdueQuery = useQuery({
    queryKey: [...callbackKeys.list('overdue', userId), projet, 'intrusif'],
    // La liste va du plus ancien au plus récent : une échéance qui vient de passer est sur la dernière page.
    queryFn: async () => {
      const compte = await fetchCallbacks('overdue', userId, undefined, projet, 1, 1);
      const derniere = Math.max(1, Math.ceil((compte.total ?? 0) / PAGE_INTRUSIF));
      return fetchCallbacks('overdue', userId, undefined, projet, derniere, PAGE_INTRUSIF);
    },
    refetchInterval: 15_000,
  });

  const callbacks = overdueQuery.data?.items ?? EMPTY_CALLBACKS;
  const serverTimeStr = overdueQuery.data?.serverTime ?? new Date().toISOString();
  const serverTimeMs = Date.parse(serverTimeStr);

  // Seule une échéance dépassée depuis l'ouverture du panneau interrompt : l'arriéré, un rappel
  // rétabli ou remonté d'une page gardent leur ancienne heure et restent sur la page Rappels.
  useEffect(() => {
    if (!overdueQuery.isSuccess) return;
    ouvertureRef.current ??= serverTimeMs;
    const ouverture = ouvertureRef.current;
    const nouvelles = callbacks
      .filter((callback) => callback.overdue && Date.parse(callback.scheduledAt) > ouverture)
      .map(echeance);
    if (nouvelles.length === 0) return;
    setASignaler((previous) =>
      nouvelles.every((cle) => previous.has(cle)) ? previous : new Set([...previous, ...nouvelles]),
    );
  }, [callbacks, overdueQuery.isSuccess, serverTimeMs]);

  const enAttente = callbacks.filter(
    (callback) =>
      callback.overdue && aSignaler.has(echeance(callback)) && !ecartees.has(echeance(callback)),
  );
  const activeCallback = enAttente[0] ?? null;

  const masquerRappelsEnAttente = () => {
    setEcartees((previous) => new Set([...previous, ...aSignaler]));
  };

  const cancelMutation = useAnnulationRappel();

  const snoozeMutation = useReportRappel();

  useEffect(() => {
    if (activeCallback === null || !sonActif()) return;
    jouerSonnerieRappel();
  }, [activeCallback]);

  if (activeCallback === null || ficheOuverte) return null;

  const annulerRappel = (id: string) => {
    cancelMutation.mutate(id, { onSuccess: masquerRappelsEnAttente });
  };

  return (
    <ContenuRappelPopUp
      callback={activeCallback}
      serverTimeMs={serverTimeMs}
      racine={racine}
      onIgnorer={masquerRappelsEnAttente}
      onAnnuler={annulerRappel}
      onReporter={(id, duree) =>
        snoozeMutation.mutate({ id, duree }, { onSuccess: masquerRappelsEnAttente })
      }
      isPendingCancel={cancelMutation.isPending}
      isPendingSnooze={snoozeMutation.isPending}
      enAttente={enAttente.length}
    />
  );
}
