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
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, PhoneIcon } from 'lucide-react';
import Link from 'next/link';
import { createContext, useContext, useState } from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

// Le closing s'ouvre hors de la bulle : la bulle se referme dès que « Présent » est noté.
const OuvrirClosing = createContext<(fiche: RendezVousObtenu) => void>(() => undefined);

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

function Bulle({ fiche, onFait }: { fiche: RendezVousObtenu; onFait: () => void }) {
  const ouvrirClosing = useContext(OuvrirClosing);
  const etat = etatDe(fiche);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-[1.0625rem] font-[700]">
          {fiche.prenom} {fiche.nom}
        </p>
        <p className="text-sm text-muted-foreground">
          {fiche.quand === null ? '' : formatDateTime(fiche.quand)} · {fiche.type}
          {fiche.site === '' ? '' : ` · ${fiche.site}`}
        </p>
        <Badge variant={etat.ton} className="mt-2">
          {etat.texte}
        </Badge>
      </div>
      <ActionsRendezVous
        fiche={fiche}
        peutNoter
        peutCloser
        bulle
        onCloser={(choisie) => {
          onFait();
          ouvrirClosing(choisie);
        }}
        onEnregistrerVisite={null}
        onFait={onFait}
      />
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <Link
          href={`/teleconseil/prospects/${fiche.id}`}
          className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2' })}
        >
          <FileTextIcon className="size-4" aria-hidden="true" />
          Ouvrir la fiche
        </Link>
        {fiche.phoneE164 === null ? null : (
          <a
            href={`tel:${fiche.phoneE164}`}
            aria-label={`Appeler ${formatPhone(fiche.phoneE164)}`}
            className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2' })}
          >
            <PhoneIcon className="size-4" aria-hidden="true" />
            Appeler
          </a>
        )}
      </div>
    </div>
  );
}

function Rendu({ event }: EventProps<Evenement>) {
  const [ouvert, setOuvert] = useState(false);
  const etat = etatDe(event.fiche);
  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${event.title}, ${etat.texte}`}
            title={`${format(event.start, 'HH:mm')} · ${event.title} · ${etat.texte}`}
            className="flex h-full w-full min-w-0 flex-col gap-0.5 overflow-hidden text-left leading-tight"
          />
        }
      >
        <span className="truncate font-[600]">{event.title}</span>
        <span className="truncate text-[0.6875rem] tabular-nums opacity-80">
          {format(event.start, 'HH:mm')} · {etat.texte}
        </span>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-80">
        <Bulle
          fiche={event.fiche}
          onFait={() => {
            setOuvert(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function RendezVousAgenda() {
  const [date, setDate] = useState(() => new Date());
  const [vue, setVue] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'week'));
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const du = jour(startOfWeek(date, { weekStartsOn: 1 }));
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
    <OuvrirClosing.Provider value={setClosingDe}>
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
          eventPropGetter={(evenement) => ({
            className: `agenda-${etatDe(evenement.fiche).ton}`,
          })}
          style={{ height: 'calc(100dvh - 9rem)', minHeight: 520 }}
        />
        <ClosingDialog
          rendezVous={closingDe}
          onClose={() => {
            setClosingDe(null);
          }}
        />
      </div>
    </OuvrirClosing.Provider>
  );
}
