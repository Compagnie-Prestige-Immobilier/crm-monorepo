'use client';

import { CheckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Fragment, useEffect, useRef, useState } from 'react';

import {
  useDonneesApercu,
  type ChargementDonnees,
} from '@/components/accueil/tableau-de-bord/apercu-donnees';
import { renderMark } from '@/components/accueil/tableau-de-bord/grille';
import { evaluerMarques } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  mesurerDonnees,
  type DashboardMarque,
  type DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import { ChartCard } from '@/components/dashboard/chart-card';
import { marqueTexte } from '@/components/dashboard/chart-visual';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Proposition } from '@/lib/data/disposition';

export type ArgsApercu = { proposition: Proposition; marque: DashboardMarque };

const VIDE = 'Rien sur la période.';
const MULTI_SERIES: readonly DashboardMarque[] = [
  'barres-empilees',
  'barres-100',
  'barres-groupees',
];
export const entree = {
  initial: { opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, scale: 0.98, filter: 'blur(6px)', transition: { duration: 0.14 } },
};
const cascade = { animate: { transition: { staggerChildren: 0.06 } } };
const enfant = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

export function useFocus<T extends HTMLElement>(pret = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (pret) ref.current?.focus();
  }, [pret]);
  return ref;
}

/** Une seule série : aucune forme qui empile ou groupe plusieurs séries. */
function marquesPour(donnees: DonneesSource): DashboardMarque[] {
  const marques = evaluerMarques(donnees.forme, mesurerDonnees(donnees)).map((e) => e.marque);
  const uneSerie =
    donnees.forme !== 'composition' || donnees.donnee.every((l) => l.segments.length <= 1);
  return uneSerie ? marques.filter((marque) => !MULTI_SERIES.includes(marque)) : marques;
}

function Phrase({ texte }: { texte: string }) {
  return (
    <motion.p variants={cascade} initial="initial" animate="animate" className="text-[1.0625rem]">
      {texte.split(' ').map((mot, rang) => (
        <Fragment key={`${mot}-${String(rang)}`}>
          <motion.span variants={enfant} className="inline-block">
            {mot}
          </motion.span>{' '}
        </Fragment>
      ))}
    </motion.p>
  );
}

export function Comprendre({
  interpretation,
  proposition,
  alternatives,
  onConfirmer,
  onReformuler,
}: {
  interpretation: string;
  proposition?: Proposition | undefined;
  alternatives: readonly Proposition[];
  onConfirmer: (choisie: Proposition) => void;
  onReformuler: () => void;
}) {
  const oui = useFocus<HTMLButtonElement>();
  return (
    <div className="flex flex-col gap-5 p-6">
      <Phrase texte={interpretation} />
      <motion.div variants={cascade} initial="initial" animate="animate" className="flex gap-2">
        {proposition === undefined ? null : (
          <motion.div variants={enfant}>
            <Button ref={oui} onClick={() => onConfirmer(proposition)}>
              <CheckIcon aria-hidden="true" />
              Oui, c’est ça
            </Button>
          </motion.div>
        )}
        <motion.div variants={enfant}>
          <Button variant="outline" onClick={onReformuler}>
            Reformuler
          </Button>
        </motion.div>
      </motion.div>
      {alternatives.length === 0 ? null : (
        <div role="group" aria-label="Autres indicateurs proches" className="flex flex-col gap-2">
          <p className="text-[0.8125rem] text-muted-foreground">Ou peut-être :</p>
          <motion.div
            variants={cascade}
            initial="initial"
            animate="animate"
            className="flex flex-wrap gap-2"
          >
            {alternatives.map((alternative) => (
              <motion.button
                key={alternative.source ?? alternative.titre}
                variants={enfant}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onConfirmer(alternative)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-[0.8125rem] hover:border-primary/40 hover:bg-secondary"
              >
                {alternative.titre}
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function EtatDonnees({ pending, erreur }: { pending: boolean; erreur: string | undefined }) {
  if (pending) return <Skeleton className="h-40 w-full rounded-md" />;
  return <p className="text-destructive">{erreur}</p>;
}

function Note({ texte }: { texte: string | undefined }) {
  if (texte === undefined) return null;
  return <p className="text-[0.8125rem] text-muted-foreground">{texte}</p>;
}

export function Forme({
  proposition,
  chargement,
  onChoisir,
}: {
  proposition: Proposition;
  chargement: ChargementDonnees;
  onChoisir: (marque: DashboardMarque) => void;
}) {
  const { data, isPending } = useDonneesApercu(proposition, chargement);
  const donnees = data?.donnees;
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="font-display text-[1.0625rem] font-[600]">
        Comment afficher « {proposition.titre} » ?
      </p>
      <Note texte={data?.note} />
      {donnees === undefined ? (
        <EtatDonnees pending={isPending} erreur={data?.erreur} />
      ) : (
        <motion.div
          role="group"
          aria-label="Formes possibles"
          variants={cascade}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {marquesPour(donnees).map((marque) => (
            <motion.button
              key={marque}
              variants={enfant}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              title={marqueTexte(marque).usage}
              onClick={() => onChoisir(marque)}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2 text-left hover:border-primary/50 hover:shadow-elev-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <motion.div
                layoutId={`forme-${marque}`}
                aria-hidden="true"
                className="pointer-events-none h-28 overflow-hidden"
              >
                {renderMark(proposition.titre, marque, donnees, undefined, VIDE)}
              </motion.div>
              <span className="text-[0.8125rem] font-[600]">{marqueTexte(marque).nom}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function Apercu({
  args,
  chargement,
  ajout,
  onAjouter,
  onAutreForme,
}: {
  args: ArgsApercu;
  chargement: ChargementDonnees;
  ajout: boolean;
  onAjouter: () => void;
  onAutreForme: () => void;
}) {
  const { data, isPending } = useDonneesApercu(args.proposition, chargement);
  const donnees = data?.donnees;
  const oui = useFocus<HTMLButtonElement>(donnees !== undefined);
  // Nivo mesure son conteneur pendant le morphing, encore à la taille de la vignette.
  const [pose, setPose] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="font-display text-[1.0625rem] font-[600]">C’est celui-ci ?</p>
      <Note texte={data?.note} />
      <motion.div layoutId={`forme-${args.marque}`} onLayoutAnimationComplete={() => setPose(true)}>
        <ChartCard
          title={args.proposition.titre}
          hauteur={args.marque === 'tuile' ? 'compacte' : 'normale'}
          className="animate-none"
        >
          {donnees === undefined ? (
            <EtatDonnees pending={isPending} erreur={data?.erreur} />
          ) : (
            <div key={String(pose)} className="contents">
              {renderMark(args.proposition.titre, args.marque, donnees, undefined, VIDE)}
            </div>
          )}
        </ChartCard>
      </motion.div>
      <div className="flex flex-wrap gap-2">
        <Button ref={oui} disabled={ajout || donnees === undefined} onClick={onAjouter}>
          <CheckIcon aria-hidden="true" />
          Oui, l’ajouter
        </Button>
        <Button variant="outline" disabled={ajout} onClick={onAutreForme}>
          Autre forme
        </Button>
      </div>
    </div>
  );
}
