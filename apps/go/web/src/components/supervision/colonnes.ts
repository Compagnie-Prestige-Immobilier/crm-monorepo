import { formatDuree } from '@/lib/format';
import type { CleActivite } from '@/lib/data/activite-agregats';
import type { Projet } from '@/lib/types';

export interface Colonne {
  cle: CleActivite;
  label: string;
  taux?: boolean;
  /** Une durée en secondes, affichée en minutes et secondes. */
  duree?: boolean;
}

/**
 * Deux familles d'appels, jamais dans le même tableau : le plateau CHUES appelle
 * des représentants et, en conversion, des prospects ; le Grand Public n'appelle
 * que des prospects.
 */
export type Famille = 'representants' | 'prospects';

export const FAMILLE_LABELS: Record<Famille, string> = {
  representants: 'Appels représentants',
  prospects: 'Appels prospects',
};

export const COLONNES: Record<Famille, Colonne[]> = {
  representants: [
    { cle: 'repCalls', label: 'Appels' },
    { cle: 'repConfirmedCalls', label: 'Confirmés' },
    { cle: 'repDetectedCalls', label: 'Détectés' },
    { cle: 'repUnloggedCalls', label: 'Non consignés' },
    { cle: 'repConfirmRate', label: 'Confirmation', taux: true },
    { cle: 'repAvgCallSeconds', label: 'Durée moy.', duree: true },
    // « Joints » est la famille : les acceptés en sont un détail, pas un voisin.
    { cle: 'repReached', label: 'Joints' },
    { cle: 'repFichesAcceptees', label: 'Acceptés' },
    { cle: 'repFichesARappeler', label: 'À rappeler' },
    { cle: 'repUnreachable', label: 'Injoignables' },
    { cle: 'repCallbacksHonored', label: 'Rappels tenus' },
    { cle: 'repCallbacksLate', label: 'Rappels en retard' },
    { cle: 'repCallbacksUpcoming', label: 'Rappels à venir' },
    { cle: 'repReachabilityRate', label: 'Joignabilité', taux: true },
    { cle: 'repAcceptanceRate', label: 'Acceptation', taux: true },
    { cle: 'representantsContacted', label: 'Représentants contactés' },
    { cle: 'prospectsCreated', label: 'Prospects saisis' },
  ],
  prospects: [
    { cle: 'calls', label: 'Appels' },
    { cle: 'confirmedCalls', label: 'Confirmés' },
    { cle: 'detectedCalls', label: 'Détectés' },
    { cle: 'unloggedCalls', label: 'Non consignés' },
    { cle: 'confirmRate', label: 'Confirmation', taux: true },
    { cle: 'avgCallSeconds', label: 'Durée moy.', duree: true },
    { cle: 'methodObtained', label: 'Méthodes' },
    { cle: 'unreachable', label: 'Injoignables' },
    { cle: 'wrongNumber', label: 'Faux numéros' },
    { cle: 'refused', label: 'Refus' },
    { cle: 'callback', label: 'À rappeler' },
    { cle: 'callbacksHonored', label: 'Rappels tenus' },
    { cle: 'callbacksLate', label: 'Rappels en retard' },
    { cle: 'callbacksUpcoming', label: 'Rappels à venir' },
    { cle: 'ficheReachRate', label: 'Joignabilité', taux: true },
    { cle: 'prospectsCreated', label: 'Prospects saisis' },
  ],
};

export function famillesDuProjet(projet: Projet): Famille[] {
  return projet === 'chues' ? ['representants', 'prospects'] : ['prospects'];
}

export function dureeAffichee(secondes: number | null): string {
  if (secondes === null) return 'Sans objet';
  // Un écart négatif ne vient pas du réseau : l'horloge du téléphone avance.
  if (secondes < 0) return 'Horloge en avance';
  return formatDuree(secondes);
}

export function formatPresence(secondes: number): string {
  if (secondes < 60) return '< 1 min';
  const minutes = Math.floor(secondes / 60);
  const heures = Math.floor(minutes / 60);
  return heures === 0
    ? `${String(minutes)} min`
    : `${String(heures)} h ${String(minutes % 60).padStart(2, '0')}`;
}
