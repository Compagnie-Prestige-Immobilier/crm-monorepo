'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';

import {
  Apercu,
  Comprendre,
  entree,
  Forme,
  type ArgsApercu,
} from '@/components/accueil/tableau-de-bord/etapes-constructeur';
import type { ChargementDonnees } from '@/components/accueil/tableau-de-bord/apercu-donnees';
import {
  Ajoute,
  ICI,
  Reflexion,
  Saisie,
} from '@/components/accueil/tableau-de-bord/saisie-constructeur';
import type { Catalogue } from '@/components/accueil/tableau-de-bord/sources';
import {
  construireIndicateur,
  fetchAmorces,
  SOURCE_CALCUL,
  type Amorce,
  type DashboardEcran,
  type DashboardWidget,
  type Proposition,
  type ReponseConstructeur,
} from '@/lib/data/disposition';
import { apiErrorText } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

type Etape =
  | { nom: 'saisie'; initiale: string }
  | { nom: 'reflexion'; demande: string }
  | { nom: 'comprendre'; demande: string; reponse: ReponseConstructeur }
  | { nom: 'forme'; demande: string; proposition: Proposition }
  | { nom: 'apercu'; demande: string; args: ArgsApercu }
  | { nom: 'ajoute'; titre: string };

const CATALOGUE_MAX = 200;
const REFLEXION_MIN_MS = 900;
const PAS = [
  { nom: 'saisie', libelle: 'Demande' },
  { nom: 'comprendre', libelle: 'Compréhension' },
  { nom: 'forme', libelle: 'Forme' },
  { nom: 'apercu', libelle: 'Aperçu' },
] as const;
const RANG: Record<Etape['nom'], number> = {
  saisie: 0,
  reflexion: 0,
  comprendre: 1,
  forme: 2,
  apercu: 3,
  ajoute: 4,
};
const RESSORT = { type: 'spring', stiffness: 320, damping: 34 } as const;

function catalogueApi(catalogue: Catalogue) {
  return Object.entries(catalogue)
    .slice(0, CATALOGUE_MAX)
    .map(([id, e]) => ({
      id,
      libelle: e.label,
      forme: e.forme,
      ...(e.description === undefined ? {} : { description: e.description }),
      ...(e.groupe === undefined ? {} : { groupe: e.groupe }),
    }));
}

function widgetDe(
  { proposition, marque }: ArgsApercu,
  catalogue: Catalogue,
): Omit<DashboardWidget, 'id'> {
  if (proposition.calcul !== undefined)
    return { source: SOURCE_CALCUL, calcul: proposition.calcul, titre: proposition.titre, marque };
  const source = proposition.source ?? '';
  const titre = catalogue[source]?.label === proposition.titre ? {} : { titre: proposition.titre };
  return { source, marque, ...titre };
}

function useHauteur() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [hauteur, setHauteur] = useState<number | 'auto'>('auto');
  useEffect(() => {
    if (element === null) return;
    const observateur = new ResizeObserver(([mesure]) => {
      if (mesure !== undefined) setHauteur(mesure.contentRect.height);
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [element]);
  return [setElement, hauteur] as const;
}

function Fil({ etape, ajoutes }: { etape: Etape; ajoutes: readonly string[] }) {
  const rang = RANG[etape.nom];
  return (
    <div className="flex flex-col gap-2 border-b border-border px-5 py-3">
      <ol className="flex flex-wrap items-center gap-1 text-[0.75rem]">
        {PAS.map((pas, i) => (
          <li
            key={pas.nom}
            className={cn(
              'relative rounded-full px-2.5 py-1 font-[600] transition-colors',
              i <= rang ? 'text-primary' : 'text-muted-foreground',
              i !== rang && 'max-sm:hidden',
            )}
          >
            {i === rang ? (
              <motion.span
                layoutId="pas-courant"
                transition={RESSORT}
                className="absolute inset-0 rounded-full bg-primary/10"
              />
            ) : null}
            <span className="relative">{pas.libelle}</span>
          </li>
        ))}
      </ol>
      {ajoutes.length === 0 ? null : (
        <ul aria-label="Ajoutés pendant cette session" className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {ajoutes.map((titre) => (
              <motion.li
                key={titre}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[0.75rem]"
              >
                <CheckIcon aria-hidden="true" className="size-3 text-primary" />
                {titre}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

export default function Constructeur({
  ecran,
  catalogue,
  plage,
  cleDonnees,
  chargerSource,
  onAjouter,
}: ChargementDonnees & {
  ecran: DashboardEcran;
  catalogue: Catalogue;
  onAjouter: (widget: Omit<DashboardWidget, 'id'>) => Promise<unknown>;
}) {
  const [etape, setEtape] = useState<Etape>({ nom: 'saisie', initiale: '' });
  const [proposition, setProposition] = useState<Proposition | undefined>();
  const [ajoutes, setAjoutes] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | undefined>();
  const [ajout, setAjout] = useState(false);
  const [refHauteur, hauteur] = useHauteur();
  const chargement: ChargementDonnees = { plage, cleDonnees, chargerSource };
  const { data: calculables = [] } = useQuery({
    queryKey: ['tableau-de-bord', 'amorces'],
    queryFn: fetchAmorces,
    retry: false,
    staleTime: Infinity,
  });
  const ici: Amorce[] = Object.values(catalogue).map((e) => ({ texte: e.label, groupe: ICI }));
  const libelles = new Set(ici.map((a) => a.texte));
  const amorces = [...ici, ...calculables.filter((a) => !libelles.has(a.texte))];

  const demander = async (demande: string) => {
    setErreur(undefined);
    setEtape({ nom: 'reflexion', demande });
    const delai = new Promise((resoudre) => setTimeout(resoudre, REFLEXION_MIN_MS));
    try {
      const [reponse] = await Promise.all([
        construireIndicateur(ecran, demande, catalogueApi(catalogue), proposition),
        delai,
      ]);
      if (reponse.proposition !== undefined) setProposition(reponse.proposition);
      setEtape({ nom: 'comprendre', demande, reponse });
    } catch (error) {
      setErreur(apiErrorText(error, 'Le constructeur n’a pas répondu. Réessayez.'));
      setEtape({ nom: 'saisie', initiale: demande });
    }
  };

  const ajouter = (args: ArgsApercu) => {
    setAjout(true);
    setErreur(undefined);
    onAjouter(widgetDe(args, catalogue))
      .then(() => {
        setProposition(undefined);
        setAjoutes((liste) => [...liste, args.proposition.titre]);
        setEtape({ nom: 'ajoute', titre: args.proposition.titre });
      })
      .catch((error: unknown) => {
        setErreur(apiErrorText(error, 'L’indicateur n’a pas été ajouté. Réessayez.'));
      })
      .finally(() => setAjout(false));
  };

  const reformuler = (demande: string) => setEtape({ nom: 'saisie', initiale: demande });

  function contenu() {
    switch (etape.nom) {
      case 'saisie':
        return (
          <Saisie
            amorces={amorces}
            initiale={etape.initiale}
            ajustement={proposition !== undefined}
            onDemander={(demande) => void demander(demande)}
          />
        );
      case 'reflexion':
        return <Reflexion demande={etape.demande} />;
      case 'comprendre':
        return (
          <Comprendre
            {...etape.reponse}
            onConfirmer={(choisie) => {
              setProposition(choisie);
              setEtape({ nom: 'forme', demande: etape.demande, proposition: choisie });
            }}
            onReformuler={() => reformuler(etape.demande)}
          />
        );
      case 'forme':
        return (
          <Forme
            proposition={etape.proposition}
            chargement={chargement}
            onChoisir={(marque) =>
              setEtape({
                nom: 'apercu',
                demande: etape.demande,
                args: { proposition: etape.proposition, marque },
              })
            }
          />
        );
      case 'apercu':
        return (
          <Apercu
            args={etape.args}
            chargement={chargement}
            ajout={ajout}
            onAjouter={() => ajouter(etape.args)}
            onAutreForme={() =>
              setEtape({
                nom: 'forme',
                demande: etape.demande,
                proposition: etape.args.proposition,
              })
            }
          />
        );
      case 'ajoute':
        return (
          <Ajoute titre={etape.titre} onEncore={() => setEtape({ nom: 'saisie', initiale: '' })} />
        );
    }
  }

  return (
    <MotionConfig reducedMotion="user" transition={RESSORT}>
      <LayoutGroup>
        <Fil etape={etape} ajoutes={ajoutes} />
        {erreur === undefined ? null : (
          <p
            role="alert"
            className="border-b border-border px-5 py-2 text-[0.8125rem] text-destructive"
          >
            {erreur}
          </p>
        )}
        <motion.div animate={{ height: hauteur }} className="relative overflow-hidden">
          <div ref={refHauteur}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={etape.nom} {...entree}>
                {contenu()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </LayoutGroup>
    </MotionConfig>
  );
}
