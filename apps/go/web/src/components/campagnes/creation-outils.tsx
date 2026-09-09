import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { TOUS, type Choix } from '@/components/campagnes/cibles';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { CampagneApercu } from '@/lib/data/lots-export';
import type { ReferentielItem } from '@/lib/data/referentiels';
import { fetchComptes, type Compte } from '@/lib/data/users';
import { formatNumber } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';

export const FICHES_PAR_JOUR_DEFAUT = 50;
export const JOURS_DEFAUT = 1;

/** Ceux qui passent les appels d'une campagne, dans l'ordre d'affichage. */
const ROLES_APPELANTS = ['COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'] as const;

export async function fetchAppelants(): Promise<Compte[]> {
  const pages = await Promise.all(
    ROLES_APPELANTS.map((role) =>
      fetchComptes({ search: '', role, isActive: true, page: 1, pageSize: 50 }),
    ),
  );
  return pages
    .flatMap((page) => page.items)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));
}

export function entierBorne(saisie: string, defaut: number, min: number, max: number): number {
  const valeur = Number.parseInt(saisie, 10);
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, valeur));
}

const nomDe = (lignes: readonly ReferentielItem[], id: string): string | null =>
  lignes.find((row) => row.id === id)?.name ?? null;

/** Les libellés de lieu qui entrent dans l'étiquette, nuls quand rien n'est filtré. */
export function nomsDeLieu(
  choix: Choix,
  departements: readonly ReferentielItem[],
  iefs: readonly ReferentielItem[],
): { departement: string | null; ief: string | null } {
  return {
    departement: choix.departementId === TOUS ? null : nomDe(departements, choix.departementId),
    ief: choix.iefId === TOUS ? null : nomDe(iefs, choix.iefId),
  };
}

/** Ce qui n'est pas un entier valable n'est pas envoyé : le serveur reprend son défaut. */
export function objectifsRetenus(
  equipe: readonly Compte[],
  saisies: Readonly<Record<string, string>>,
): { teleconseillerId: string; fichesParJour: number }[] {
  return equipe.flatMap((compte) => {
    const saisi = Number.parseInt(saisies[compte.id] ?? '', 10);
    return Number.isFinite(saisi) && saisi >= 1
      ? [{ teleconseillerId: compte.id, fichesParJour: Math.min(500, saisi) }]
      : [];
  });
}

export function construireDistribution(input: {
  equipe: readonly Compte[];
  fichesParJour: number;
  jours: number;
  objectifs: readonly { teleconseillerId: string; fichesParJour: number }[];
}): {
  teleconseillerIds: string[];
  fichesParJour: number;
  jours: number;
  objectifs?: { teleconseillerId: string; fichesParJour: number }[];
} {
  return {
    teleconseillerIds: input.equipe.map((compte) => compte.id),
    fichesParJour: input.fichesParJour,
    jours: input.jours,
    ...(input.objectifs.length > 0 ? { objectifs: [...input.objectifs] } : {}),
  };
}

export function ErreurCreation({ erreur }: { erreur: unknown }) {
  if (erreur === null) return null;
  return (
    <p role="alert" className="text-[0.875rem] text-destructive">
      {apiErrorText(erreur, 'La campagne n’a pas pu être créée.')}
    </p>
  );
}

export function peutCreer(input: {
  equipe: number;
  eligible: number | null;
  nom: string;
  enCours: boolean;
}): boolean {
  if (input.equipe === 0 || input.eligible === null || input.eligible <= 0) return false;
  if (input.nom.length < 3) return false;
  return !input.enCours;
}

/** L'aperçu vient entièrement du serveur : rien n'est recompté ici. */
function texteApercu(apercu: CampagneApercu, jours: number): string {
  const { eligible, places, retenues } = apercu;
  if (eligible === 0) return 'Aucune fiche ne correspond.';

  const pluriel = eligible > 1 ? 's' : '';
  const disponibles = `${formatNumber(eligible)} fiche${pluriel} disponible${pluriel}`;
  const reparties = `${formatNumber(retenues)} seront réparties selon les capacités choisies`;

  if (eligible <= places) {
    return `${disponibles}. ${formatNumber(places)} places pondérées sur ${formatNumber(jours)} jour${jours > 1 ? 's' : ''} : les ${reparties}.`;
  }
  return `${disponibles} pour ${formatNumber(places)} places : ${reparties} ; ${formatNumber(eligible - retenues)} attendront une prochaine campagne.`;
}

export function Apercu({
  apercu,
  stable,
  equipe,
  jours,
}: {
  apercu: UseQueryResult<CampagneApercu>;
  stable: boolean;
  equipe: number;
  jours: number;
}) {
  const contenu = ((): ReactNode => {
    if (equipe === 0) return 'Cochez au moins un téléconseiller.';
    if (apercu.isError) {
      return (
        <span className="text-destructive">
          {apiErrorText(apercu.error, 'Le nombre de fiches n’a pas pu être compté.')}
        </span>
      );
    }
    if (!apercu.isSuccess || !stable) return 'Comptage des fiches…';
    return texteApercu(apercu.data, jours);
  })();

  return (
    <output className="block rounded-md border border-border bg-secondary/50 px-4 py-3 text-[0.9375rem]">
      {contenu}
    </output>
  );
}

export function ChampsReglages({
  nom,
  onNom,
  fichesParJour,
  onFichesParJour,
  jours,
  onJours,
}: {
  nom: string;
  onNom: (valeur: string) => void;
  fichesParJour: string;
  onFichesParJour: (valeur: string) => void;
  jours: string;
  onJours: (valeur: string) => void;
}) {
  return (
    <>
      <Field
        label="Nom de la campagne"
        description="Proposé d’après les critères. Modifiable ici et plus tard."
      >
        {(props) => (
          <Input
            {...props}
            maxLength={120}
            value={nom}
            onChange={(event) => {
              onNom(event.target.value);
            }}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Fiches par jour, à défaut d’objectif"
          description="La valeur retenue pour qui n’a pas d’objectif propre."
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              step={1}
              value={fichesParJour}
              onChange={(event) => {
                onFichesParJour(event.target.value);
              }}
            />
          )}
        </Field>
        <Field label="Nombre de jours">
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              value={jours}
              onChange={(event) => {
                onJours(event.target.value);
              }}
            />
          )}
        </Field>
      </div>
    </>
  );
}

export function useValeurDifferee(valeur: string, delaiMs: number): string {
  const [differee, setDifferee] = useState(valeur);

  useEffect(() => {
    const minuteur = setTimeout(() => {
      setDifferee(valeur);
    }, delaiMs);
    return () => {
      clearTimeout(minuteur);
    };
  }, [valeur, delaiMs]);

  return differee;
}
