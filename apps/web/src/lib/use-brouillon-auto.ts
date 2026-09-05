'use client';

import { useCallback, useEffect, useRef } from 'react';

import { enregistrerBrouillon, type OuvertureFiche } from '@/lib/data/ouvertures';

/** Le temps d'arrêt qui sépare deux mots d'une phrase de la fin d'une réponse. */
const REPOS_MS = 1_000;

/** Ce qu'une frappe ininterrompue peut coûter au plus : cinq secondes de saisie. */
const ATTENTE_MAX_MS = 5_000;

/**
 * EB-08, EB-10 : la saisie part au fil de l'eau, pour qu'une coupure de courant
 * ou un onglet tué n'emporte pas ce qui a été tapé. `beforeunload` ne se
 * déclenche alors pas ; `visibilitychange` vers `hidden` est le dernier moment
 * où le navigateur laisse encore écrire.
 *
 * Un échec ne se dit pas : c'est un filet, pas une opération métier. La charge
 * refusée reste en attente et repart à la modification suivante.
 */
export function useBrouillonAuto(
  ouverture: OuvertureFiche | null,
  draft: Record<string, unknown>,
): void {
  const ouvertureId = ouverture?.id ?? null;
  const serialise = JSON.stringify(draft);
  const aEcrire = useRef<string | null>(null);
  const ecrit = useRef<string | null>(null);
  const repos = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plafond = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annuler = useCallback(() => {
    if (repos.current !== null) clearTimeout(repos.current);
    if (plafond.current !== null) clearTimeout(plafond.current);
    repos.current = null;
    plafond.current = null;
  }, []);

  const envoyer = useCallback(() => {
    annuler();
    const charge = aEcrire.current;
    if (charge === null || ouvertureId === null) return;
    aEcrire.current = null;
    void enregistrerBrouillon(ouvertureId, JSON.parse(charge) as Record<string, unknown>).then(
      () => {
        ecrit.current = charge;
      },
      () => {
        aEcrire.current ??= charge;
      },
    );
  }, [annuler, ouvertureId]);

  useEffect(() => {
    ecrit.current ??= serialise;
    if (ouvertureId === null) return;
    if (serialise === ecrit.current) {
      // Revenu à ce que le serveur a déjà : l'écriture en attente n'a plus lieu.
      aEcrire.current = null;
      annuler();
      return;
    }
    aEcrire.current = serialise;
    if (repos.current !== null) clearTimeout(repos.current);
    repos.current = setTimeout(envoyer, REPOS_MS);
    plafond.current ??= setTimeout(envoyer, ATTENTE_MAX_MS);
  }, [annuler, envoyer, ouvertureId, serialise]);

  useEffect(() => {
    const surMasquage = (): void => {
      if (document.visibilityState === 'hidden') envoyer();
    };
    document.addEventListener('visibilitychange', surMasquage);
    return () => {
      document.removeEventListener('visibilitychange', surMasquage);
      // Le démontage suit la qualification, qui a fermé l'ouverture : écrire
      // encore serait refusé, et il n'y a plus rien à reprendre.
      annuler();
    };
  }, [annuler, envoyer]);
}
