'use client';

import type { components } from '@crm/api-client';
import { useState, type ReactNode } from 'react';

import type { Choix } from '@/components/console/console-paliers';
import { useRvSite } from '@/components/console/rendez-vous-site';
import { formatCallbackAt } from '@/lib/data/console';
import type { StatutQualification } from '@/lib/data/statuts-qualification';

type RendezVousRep = components['schemas']['QualificationRepRendezVous'];

/** Les motifs « Rendez-vous » de la console prospect : le serveur refuse tout autre code. */
const TYPES_RDV: readonly { code: string; label: string; aide: string }[] = [
  { code: 'RV_CPI', label: 'RV CPI', aide: 'Il vient à la CPI' },
  { code: 'RV_SITE', label: 'RV site', aide: 'Il va sur le site' },
  { code: 'RV_EXTERNE', label: 'RV externe', aide: 'Ailleurs, puis le type' },
  { code: 'RDV_TELEPHONIQUE', label: 'RV téléphonique', aide: 'Au téléphone' },
];

/** Une personne jointe peut prendre rendez-vous ; un faux numéro, non. */
export const rdvPossible = (joignable: boolean, statut: StatutQualification | null): boolean =>
  joignable &&
  statut !== null &&
  statut.effect !== 'UNREACHABLE' &&
  statut.effect !== 'WRONG_NUMBER';

/**
 * Le rendez-vous pris au script représentant. Il part avec l'appel et s'inscrit
 * sur la fiche prospect du représentant : agenda, liste et suivi le reprennent.
 */
export function useRdvRepresentant() {
  const [code, setCode] = useState<string | null>(null);
  const [refuse, setRefuse] = useState(false);
  const [at, setAt] = useState<string | null>(null);
  const rvSite = useRvSite(code ?? undefined);
  const type = TYPES_RDV.find((ligne) => ligne.code === code) ?? null;

  const choix = (apres: (avecDate: boolean) => void): Choix[] => [
    {
      cle: 'non',
      label: 'Non',
      aide: 'Pas de rendez-vous',
      actif: refuse,
      choisir: () => {
        setRefuse(true);
        setCode(null);
        setAt(null);
        apres(false);
      },
    },
    ...TYPES_RDV.map((ligne) => ({
      cle: ligne.code,
      label: `Oui, ${ligne.label}`,
      aide: ligne.aide,
      actif: code === ligne.code,
      choisir: () => {
        setRefuse(false);
        if (code !== ligne.code) setAt(null);
        setCode(ligne.code);
        apres(true);
      },
    })),
  ];

  /** Vrai quand la date et ce que le type exige sont là ; une date passée se rechoisit. */
  const complet = (): boolean => {
    if (code === null) return true;
    if (at !== null && Date.parse(at) <= Date.now()) setAt(null);
    return at !== null && Date.parse(at) > Date.now() && rvSite.verifier();
  };

  const corps = (actif: boolean): { rendezVous?: RendezVousRep } =>
    !actif || code === null || at === null
      ? {}
      : { rendezVous: { reasonCode: code, rendezVousAt: at, ...rvSite.corps } };

  const recap = (now: number, actif: boolean): string | null =>
    !actif || type === null || at === null ? null : `${type.label} ${formatCallbackAt(at, now)}`;

  return { code, at, setAt, choix, complet, corps, recap, rvSite };
}

export type RdvRepresentant = ReturnType<typeof useRdvRepresentant>;

/** Les champs du type, puis la date : le calendrier des RV site, sinon le choix d'échéance. */
export function DateRdv({ rdv, echeance }: { rdv: RdvRepresentant; echeance: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {rdv.rvSite.champs}
      {rdv.rvSite.calendrier(rdv.at, rdv.setAt) ?? echeance}
    </div>
  );
}
