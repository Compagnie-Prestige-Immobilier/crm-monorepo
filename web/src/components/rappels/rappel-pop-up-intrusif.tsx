'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRingIcon,
  CalendarClockIcon,
  ClockIcon,
  PhoneCallIcon,
  UserRoundIcon,
  XCircleIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  callbackKeys,
  cancelCallback,
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  type Callback,
} from '@/lib/data/console';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

type Rappel = Callback & { readonly prospectName?: string };
const EMPTY_CALLBACKS: Callback[] = [];

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

interface ContenuRappelProps {
  readonly callback: Rappel;
  readonly serverTimeMs: number;
  readonly racine: string;
  readonly onIgnorer: () => void;
  readonly onAnnuler: (id: string) => void;
  readonly isPendingCancel: boolean;
  readonly enAttente: number;
}

function ContenuRappelPopUp({
  callback,
  serverTimeMs,
  racine,
  onIgnorer,
  onAnnuler,
  isPendingCancel,
  enAttente,
}: ContenuRappelProps) {
  const retardMs = serverTimeMs - Date.parse(callback.scheduledAt);
  const retardTxt = retardMs > 0 ? formatDelay(retardMs) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onIgnorer()}>
      <DialogContent showCloseButton className="border-2 border-amber-500/50 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-30" />
              <BellRingIcon className="h-6 w-6 animate-bounce text-amber-600" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-200">
                Rappel à passer maintenant
                <Badge variant="destructive" className="ml-1 uppercase">
                  Urgent
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Le créneau est atteint. Toutes les informations utiles sont ci-dessous.
                {enAttente > 1
                  ? ` ${enAttente - 1} autre${enAttente > 2 ? 's' : ''} en attente.`
                  : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="grid gap-3 border-b pb-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <UserRoundIcon className="size-3.5" aria-hidden="true" />
                Prospect
              </p>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {callback.prospectName ?? `Prospect · ${callback.shortCode}`}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Téléphone</p>
              <p className="text-lg font-bold tracking-tight text-foreground">
                {formatPhone(callback.phoneE164)}
              </p>
              <p className="font-mono text-xs text-muted-foreground">Fiche {callback.shortCode}</p>
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                Prévu
              </p>
              <time className="font-semibold" dateTime={callback.scheduledAt}>
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
              </time>
            </div>
            {retardTxt ? (
              <div className="sm:text-right">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Retard</p>
                <span className="font-semibold text-destructive">{retardTxt}</span>
              </div>
            ) : null}
          </div>

          {callback.comment ? (
            <div className="mt-2 rounded border bg-background p-2.5 text-xs text-foreground">
              <span className="mb-0.5 block font-semibold text-muted-foreground">
                Commentaire du rappel
              </span>
              <p className="whitespace-pre-wrap italic">&laquo; {callback.comment} &raquo;</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onIgnorer} className="gap-1.5">
            <ClockIcon className="h-4 w-4" />
            Plus tard
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={isPendingCancel}
            onClick={() => onAnnuler(callback.id)}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <XCircleIcon className="h-4 w-4" />
            Annuler ce rappel
          </Button>

          <Link
            href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
            onClick={onIgnorer}
            className={buttonVariants({ variant: 'default', size: 'sm', className: 'gap-1.5' })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Consigner l’appel
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RappelPopUpIntrusif() {
  const pathname = usePathname();
  const grandPublic = pathname.startsWith('/grand-public');
  const projet = grandPublic ? 'GRAND_PUBLIC' : 'CHUES';
  const racine = grandPublic ? '/grand-public' : '/chues';
  const queryClient = useQueryClient();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(() => new Set());
  const initializedRef = useRef(false);
  const overdueIdsRef = useRef<Set<string>>(new Set());

  const overdueQuery = useQuery({
    queryKey: [...callbackKeys.list('overdue', null), projet, 'intrusif'],
    queryFn: () => fetchCallbacks('overdue', null, undefined, projet),
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelCallback(id),
    onSuccess: () => {
      toast.success('Rappel annulé.');
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas été annulé.');
    },
  });

  const callbacks = overdueQuery.data?.items ?? EMPTY_CALLBACKS;
  const serverTimeStr = overdueQuery.data?.serverTime ?? new Date().toISOString();
  const serverTimeMs = Date.parse(serverTimeStr);

  useEffect(() => {
    if (!overdueQuery.isSuccess) return;

    const overdueIds = new Set(
      callbacks.filter((callback) => callback.overdue).map(({ id }) => id),
    );
    if (!initializedRef.current) {
      initializedRef.current = true;
      overdueIdsRef.current = overdueIds;
      setTriggeredIds(overdueIds);
      return;
    }

    const newlyOverdue = callbacks.filter(
      (callback) => callback.overdue && !overdueIdsRef.current.has(callback.id),
    );
    overdueIdsRef.current = overdueIds;
    if (newlyOverdue.length === 0) return;
    setTriggeredIds((previous) => new Set([...previous, ...newlyOverdue.map(({ id }) => id)]));
  }, [callbacks, overdueQuery.isSuccess]);

  const enAttenteIds = callbacks
    .filter(
      (callback) =>
        triggeredIds.has(callback.id) && !dismissedIds.has(callback.id) && callback.overdue,
    )
    .map(({ id }) => id);
  const activeCallback: Rappel | null =
    callbacks.find((callback) => callback.id === enAttenteIds[0]) ?? null;
  const enAttente = enAttenteIds.length;

  useEffect(() => {
    if (!activeCallback) return;

    jouerSonnerieRappel();
    const interval = window.setInterval(jouerSonnerieRappel, 8_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeCallback]);

  if (!activeCallback) return null;

  // Une file de rappels en retard ne doit pas bloquer l'écran : « Plus tard » les écarte tous.
  const reporterTout = () => {
    setDismissedIds((prev) => new Set([...prev, ...enAttenteIds]));
  };

  const annulerRappel = (id: string) => {
    cancelMutation.mutate(id);
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  return (
    <ContenuRappelPopUp
      callback={activeCallback}
      serverTimeMs={serverTimeMs}
      racine={racine}
      onIgnorer={reporterTout}
      onAnnuler={annulerRappel}
      isPendingCancel={cancelMutation.isPending}
      enAttente={enAttente}
    />
  );
}
