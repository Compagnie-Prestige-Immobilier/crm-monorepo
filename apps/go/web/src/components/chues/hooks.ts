import { useQuery } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient, unwrap } from '@/api/client';
import { enregistrerBrouillon, type OuvertureFiche } from '@/lib/data/ouvertures';
import { actifs, complement, fetchReferentiels, libelle } from '@/lib/data/referentiels';
import { queryKeys } from '@/lib/query-keys';

export type Raccourcis = Readonly<Record<string, () => void>>;

function estChampTexte(cible: EventTarget | null): boolean {
  if (cible === null || !(cible instanceof HTMLElement)) return false;
  if (cible.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName);
}

function accord(evenement: KeyboardEvent): string {
  const touche = evenement.key === ' ' ? 'Space' : evenement.key;
  if (evenement.ctrlKey || evenement.metaKey) return `mod+${touche.toLowerCase()}`;
  return touche.length === 1 ? touche.toLowerCase() : touche;
}

/**
 * Un seul écouteur pour tout l'écran. Il se tait dès qu'un champ texte a le
 * focus, sinon taper « 4 » dans un commentaire consignerait un appel.
 */
export function useShortcuts(raccourcis: Raccourcis, actif = true): void {
  const derniers = useRef<Raccourcis>(raccourcis);

  useEffect(() => {
    derniers.current = raccourcis;
  });

  useEffect(() => {
    if (!actif) return undefined;

    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.altKey) return;
      const touche = accord(evenement);
      if (touche !== 'Escape' && estChampTexte(evenement.target)) return;
      const action = derniers.current[touche];
      if (action === undefined) return;
      evenement.preventDefault();
      action();
    };

    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [actif]);
}

export function useDebouncedValue<T>(valeur: T, delaiMs = 350): T {
  const [retardee, setRetardee] = useState(valeur);

  useEffect(() => {
    const minuteur = setTimeout(() => {
      setRetardee(valeur);
    }, delaiMs);
    return () => {
      clearTimeout(minuteur);
    };
  }, [valeur, delaiMs]);

  return retardee;
}

/** Actif par défaut : tant que le réglage n'a pas répondu, le verrou tient. */
export function useVerrouFiches(): boolean {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: async () => unwrap(await apiClient.GET('/api/v1/parametres-chues')),
    staleTime: 300_000,
  });
  return parametres.data?.verrouFiches ?? true;
}

/** Le routeur tient la navigation interne ; `enableBeforeUnload` tient l'onglet. */
export function useVerrouNavigation(actif: boolean, prevenir: () => void): void {
  const alerte = useRef(prevenir);

  useEffect(() => {
    alerte.current = prevenir;
  });

  useBlocker({
    disabled: !actif,
    enableBeforeUnload: actif,
    shouldBlockFn: () => {
      alerte.current();
      return true;
    },
  });
}

export interface Syndicats {
  readonly options: readonly { value: string; label: string }[];
  /** Le NOM complet du syndicat retenu : c'est lui que la tentative transporte. */
  readonly nom: string;
}

export function useSyndicats(syndicatId: string | null): Syndicats {
  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: fetchReferentiels,
    staleTime: 300_000,
  });
  const items = actifs(referentiels.data?.syndicats);
  const retenu = items.find((syndicat) => syndicat.id === syndicatId);

  return {
    options: items.map((syndicat) => ({
      value: syndicat.id,
      label: complement(syndicat) ?? libelle(syndicat),
    })),
    nom: retenu === undefined ? '' : libelle(retenu),
  };
}

const REPOS_MS = 1_000;
const ATTENTE_MAX_MS = 5_000;

/**
 * La saisie part au fil de l'eau, pour qu'une coupure de courant ou un onglet
 * tué n'emporte pas ce qui a été tapé. Un échec ne se dit pas : c'est un filet,
 * la charge refusée repart à la modification suivante.
 *
 * Rend le départ du chronomètre, relevé à la FRAPPE et non à l'envoi.
 */
export function useBrouillonAuto(
  ouverture: OuvertureFiche | null,
  draft: Record<string, unknown>,
): string | null {
  const ouvertureId = ouverture?.id ?? null;
  const serialise = JSON.stringify(draft);
  const aEcrire = useRef<string | null>(null);
  const ecrit = useRef<string | null>(null);
  const repos = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plafond = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premiereSaisie = useRef<string | null>(null);
  const [saisie, setSaisie] = useState<string | null>(null);

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
    void enregistrerBrouillon(
      ouvertureId,
      JSON.parse(charge) as Record<string, unknown>,
      premiereSaisie.current ?? undefined,
    ).then(
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
      aEcrire.current = null;
      annuler();
      return;
    }
    aEcrire.current = serialise;
    if (premiereSaisie.current === null) {
      premiereSaisie.current = new Date().toISOString();
      setSaisie(premiereSaisie.current);
    }
    if (repos.current !== null) clearTimeout(repos.current);
    repos.current = setTimeout(envoyer, REPOS_MS);
    plafond.current ??= setTimeout(envoyer, ATTENTE_MAX_MS);
  }, [annuler, envoyer, ouvertureId, serialise]);

  useEffect(() => {
    const surMasquage = (): void => {
      if (document.visibilityState === 'hidden') envoyer();
    };
    document.addEventListener('visibilitychange', surMasquage);
    window.addEventListener('pagehide', envoyer);
    return () => {
      document.removeEventListener('visibilitychange', surMasquage);
      window.removeEventListener('pagehide', envoyer);
      annuler();
    };
  }, [annuler, envoyer]);

  return ouverture?.firstInputAt ?? saisie;
}
