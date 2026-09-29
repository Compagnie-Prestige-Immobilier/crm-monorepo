'use client';

import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useQuery } from '@tanstack/react-query';
import {
  addHours,
  endOfDay,
  endOfWeek,
  format,
  getDay,
  min as auPlusTot,
  parse,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type ToolbarProps,
  type View,
} from 'react-big-calendar';

import { ClosingDialog } from '@/components/accueil/closing-dialog';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { etatDe } from '@/components/accueil/rendez-vous-tableau';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLE_RENDEZ_VOUS,
  lireRendezVousEntre,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { formatDateTime, formatPhone } from '@/lib/format';

const localisateur = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const FORMATS = {
  dayFormat: 'EEE d',
  timeGutterFormat: 'HH:mm',
  dayHeaderFormat: 'EEEE d MMMM',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`,
};

/** Les heures du comptoir ; une semaine qui déborde élargit la grille, jamais l'inverse. */
const OUVERTURE = 8;
const FERMETURE = 19;

const LEGENDE: readonly { texte: string; ton: 'warning' | 'info' | 'success' | 'destructive' }[] = [
  { texte: 'À confirmer', ton: 'warning' },
  { texte: 'Confirmé', ton: 'info' },
  { texte: 'Présent', ton: 'success' },
  { texte: 'Annulé ou absent', ton: 'destructive' },
];

interface Evenement {
  title: string;
  start: Date;
  end: Date;
  fiche: RendezVousObtenu;
}

const jour = (date: Date): string => format(date, 'yyyy-MM-dd');

function heures(evenements: Evenement[]): { min: Date; max: Date } {
  const debut = Math.min(OUVERTURE, ...evenements.map((e) => e.start.getHours()));
  const fin = Math.max(FERMETURE, ...evenements.map((e) => e.start.getHours() + 1));
  return { min: new Date(1970, 0, 1, debut), max: new Date(1970, 0, 1, Math.min(fin, 23), 59) };
}

function Barre({ label, onNavigate, view, onView }: ToolbarProps<Evenement>) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onNavigate('TODAY');
        }}
      >
        Aujourd’hui
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Période précédente"
        onClick={() => {
          onNavigate('PREV');
        }}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Période suivante"
        onClick={() => {
          onNavigate('NEXT');
        }}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>
      <p className="font-display text-[1.0625rem] font-[700] capitalize">{label}</p>
      <Tabs
        value={view}
        onValueChange={(valeur) => {
          onView(valeur as View);
        }}
        className="ml-auto"
      >
        <TabsList>
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="day">Jour</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function Rendu({ event }: EventProps<Evenement>) {
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span className="text-[0.6875rem] tabular-nums opacity-80">
        {format(event.start, 'HH:mm')}
      </span>
      <span className="truncate font-[600]">{event.title}</span>
      <span className="truncate text-[0.6875rem] opacity-80">{event.fiche.type}</span>
    </div>
  );
}

function Detail({
  fiche,
  onClose,
  onCloser,
}: {
  fiche: RendezVousObtenu | null;
  onClose: () => void;
  onCloser: (fiche: RendezVousObtenu) => void;
}) {
  if (fiche === null) return null;
  const etat = etatDe(fiche);
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
            {fiche.prenom} {fiche.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-1 text-sm">
          <p className="font-[600]">{fiche.quand === null ? '' : formatDateTime(fiche.quand)}</p>
          <p className="text-muted-foreground">
            {fiche.type}
            {fiche.site === '' ? '' : ` · ${fiche.site}`}
          </p>
          {fiche.phoneE164 === null ? null : (
            <a href={`tel:${fiche.phoneE164}`} className="w-fit font-mono text-primary">
              {formatPhone(fiche.phoneE164)}
            </a>
          )}
          <Badge variant={etat.ton} className="mt-1 w-fit">
            {etat.texte}
          </Badge>
        </div>
        <ActionsRendezVous
          fiche={fiche}
          peutNoter
          peutCloser
          onCloser={(choisie) => {
            onClose();
            onCloser(choisie);
          }}
          onEnregistrerVisite={null}
          onFait={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function RendezVousAgenda() {
  const [date, setDate] = useState(() => new Date());
  const [vue, setVue] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'week'));
  const [choisie, setChoisie] = useState<RendezVousObtenu | null>(null);
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const lundi = startOfWeek(date, { weekStartsOn: 1 });
  const du = jour(lundi);
  const au = jour(endOfWeek(date, { weekStartsOn: 1 }));
  const semaine = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, 'agenda', du, au],
    queryFn: () => lireRendezVousEntre(du, au),
  });
  const evenements: Evenement[] = (semaine.data?.items ?? []).flatMap((fiche) => {
    if (fiche.quand === null) return [];
    const start = new Date(fiche.quand);
    const end = auPlusTot([addHours(start, 1), endOfDay(start)]);
    return [{ title: `${fiche.prenom} ${fiche.nom}`, start, end, fiche }];
  });
  const { min, max } = heures(evenements);

  return (
    <div className="agenda-rendez-vous flex flex-col gap-3">
      {semaine.isError ? (
        <QueryErrorState error={semaine.error} onRetry={() => void semaine.refetch()} />
      ) : null}
      {(semaine.data?.total ?? 0) > evenements.length ? (
        <p className="text-sm text-warning">
          Plus de 200 rendez-vous cette semaine : seuls les 200 premiers sont affichés.
        </p>
      ) : null}
      <ul aria-label="Légende" className="flex flex-wrap gap-2">
        {LEGENDE.map((item) => (
          <li key={item.texte}>
            <Badge variant={item.ton}>{item.texte}</Badge>
          </li>
        ))}
      </ul>
      <Calendar<Evenement>
        localizer={localisateur}
        culture="fr"
        events={evenements}
        date={date}
        view={vue}
        views={['week', 'day']}
        onNavigate={setDate}
        onView={setVue}
        min={min}
        max={max}
        scrollToTime={min}
        step={30}
        timeslots={2}
        formats={FORMATS}
        components={{ toolbar: Barre, event: Rendu }}
        onSelectEvent={(evenement) => {
          setChoisie(evenement.fiche);
        }}
        eventPropGetter={(evenement) => ({
          className: `agenda-${etatDe(evenement.fiche).ton}`,
        })}
        style={{ height: 'calc(100dvh - 13rem)', minHeight: 520 }}
      />
      <Detail
        fiche={choisie}
        onClose={() => {
          setChoisie(null);
        }}
        onCloser={setClosingDe}
      />
      <ClosingDialog
        rendezVous={closingDe}
        onClose={() => {
          setClosingDe(null);
        }}
      />
    </div>
  );
}
