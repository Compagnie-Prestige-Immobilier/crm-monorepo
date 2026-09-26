'use client';

import { Command } from 'cmdk';
import { ArrowRightIcon, CheckIcon, CornerDownLeftIcon, SparklesIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { entree, useFocus } from '@/components/accueil/tableau-de-bord/etapes-constructeur';
import { Button } from '@/components/ui/button';
import type { Amorce } from '@/lib/data/disposition';

const LIBRE = '__demande-libre__';
const REFLEXIONS = [
  'Je lis votre demande',
  'Je cherche dans vos données',
  'Je prépare la proposition',
];

const ITEM =
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[0.875rem] data-[selected=true]:bg-secondary data-[selected=true]:text-foreground';
const GROUPE =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:font-[600] [&_[cmdk-group-heading]]:text-muted-foreground';

export const ICI = 'Sur cet écran';
const SUGGESTIONS = 'Suggestions';

const plat = (texte: string) =>
  texte.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase().trim();

function filtrer(valeur: string, recherche: string): number {
  if (valeur === LIBRE) return 0.01;
  const lue = plat(valeur);
  const cherchee = plat(recherche);
  if (!cherchee.split(/\s+/u).every((mot) => lue.includes(mot))) return 0;
  return lue.startsWith(cherchee) ? 1 : 0.5;
}

export function Saisie({
  amorces,
  initiale,
  ajustement,
  onDemander,
}: {
  amorces: readonly Amorce[];
  initiale: string;
  ajustement: boolean;
  onDemander: (demande: string) => void;
}) {
  const [texte, setTexte] = useState(initiale);
  const champ = useFocus<HTMLInputElement>();
  const demande = texte.trim();
  const groupes =
    demande === ''
      ? new Map([[SUGGESTIONS, amorces.filter((a) => a.groupe === ICI || a.texte === a.groupe)]])
      : Map.groupBy(amorces, (a) => a.groupe);
  return (
    <Command label="Votre demande" loop filter={filtrer} className="flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4">
        <SparklesIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <Command.Input
          ref={champ}
          value={texte}
          onValueChange={setTexte}
          placeholder={
            ajustement
              ? 'Précisez : période, projet, découpage'
              : 'Quel chiffre voulez-vous suivre ?'
          }
          className="h-10 w-full bg-transparent font-display text-[1.25rem] font-[600] outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <Command.List className="max-h-[min(22rem,50dvh)] overflow-y-auto border-t border-border p-2 scrollbar-thin">
        {demande === '' ? null : (
          <Command.Item value={LIBRE} onSelect={() => onDemander(demande)} className={ITEM}>
            <CornerDownLeftIcon aria-hidden="true" className="size-4 text-primary" />
            <span className="truncate">Demander « {demande} »</span>
          </Command.Item>
        )}
        {[...groupes].map(([groupe, liste]) => (
          <Command.Group key={groupe} heading={groupe} className={GROUPE}>
            {liste.map((amorce) => (
              <Command.Item
                key={`${groupe}-${amorce.texte}`}
                value={amorce.texte}
                onSelect={() => onDemander(amorce.texte)}
                className={ITEM}
              >
                {amorce.texte}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );
}

export function Reflexion({ demande }: { demande: string }) {
  const [rang, setRang] = useState(0);
  useEffect(() => {
    const minuterie = setInterval(
      () => setRang((r) => Math.min(r + 1, REFLEXIONS.length - 1)),
      900,
    );
    return () => clearInterval(minuterie);
  }, []);
  return (
    <div role="status" className="flex flex-col items-center gap-5 px-6 py-10 text-center">
      <div aria-hidden="true" className="relative size-20">
        <motion.span
          className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,var(--color-primary),transparent_60%,var(--color-primary))]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, ease: 'linear', repeat: Infinity }}
        />
        <span className="absolute inset-1.5 rounded-full bg-card" />
        <motion.span
          className="absolute inset-5 rounded-full bg-primary/80 blur-[2px]"
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="max-w-md truncate text-[0.875rem] text-muted-foreground">« {demande} »</p>
      <motion.p key={rang} {...entree} className="font-display text-[1.0625rem] font-[600]">
        {REFLEXIONS[rang]}
      </motion.p>
    </div>
  );
}

export function Ajoute({ titre, onEncore }: { titre: string; onEncore: () => void }) {
  const encore = useFocus<HTMLButtonElement>();
  return (
    <div role="status" className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div aria-hidden="true" className="relative grid size-20 place-items-center">
        {[0, 1].map((onde) => (
          <motion.span
            key={onde}
            className="absolute inset-0 rounded-full border-2 border-primary"
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.9, delay: onde * 0.2, ease: 'easeOut' }}
          />
        ))}
        <motion.span
          className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        >
          <CheckIcon className="size-8" />
        </motion.span>
      </div>
      <p className="font-display text-[1.0625rem] font-[600]">
        « {titre} » est sur le tableau de bord.
      </p>
      <Button ref={encore} variant="outline" onClick={onEncore}>
        Un autre indicateur
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
