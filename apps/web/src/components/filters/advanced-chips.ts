import { ADVANCED_FILTER_KEYS, type AdvancedFilterKey } from '@/lib/filters';
import { withRetired } from '@/lib/format';
import {
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type ProspectFilters,
  type ReferenceData,
} from '@/lib/types';

/**
 * Les puces qui rappellent les critères avancés pendant que le panneau est
 * replié.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Un filtre actif mais invisible est PIRE qu'un panneau trop haut.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replier dix champs libère de la place, mais crée un risque nouveau : un
 * critère resté actif restreint silencieusement la population, et l'écran
 * affiche un chiffre partiel qui se lit comme un total. Personne ne vérifie un
 * nombre qui a l'air normal. Le panneau replié doit donc NOMMER ce qui filtre,
 * et permettre de le retirer sans le rouvrir.
 *
 * D'où la forme retenue : un compte sur le bouton, et une puce par critère
 * portant le champ ET sa valeur. « Banque » seul ne suffit pas : savoir qu'un
 * filtre banque existe sans savoir laquelle oblige à rouvrir le panneau, ce qui
 * annule le bénéfice.
 *
 * Le module est PUR et séparé du composant pour être éprouvable sans
 * navigateur : c'est la correspondance identifiant vers libellé qui casse en
 * premier, quand un référentiel est retiré ou qu'une campagne disparaît.
 */

export interface AdvancedChip {
  key: AdvancedFilterKey;
  /** Nom du critère : « Banque », « Segment BDD ». */
  field: string;
  /** Valeur lisible : « CBAO », « BDD1 : CHUES / CBAO ». */
  value: string;
}

/** Nom de chaque critère, identique à l'étiquette de son champ dans le panneau. */
export const ADVANCED_FILTER_LABELS: Record<AdvancedFilterKey, string> = {
  representantId: 'Représentant',
  departementId: 'Département',
  banqueId: 'Banque',
  syndicatId: 'Syndicat',
  statut: 'Statut',
  segment: 'Segment BDD',
  phase2Status: 'Statut phase 2',
  enrollmentMethod: 'Méthode d’enrôlement',
  campaignId: 'Campagne d’appels',
  enrollmentCapturedById: 'Méthode obtenue par',
};

/**
 * Valeur affichée quand l'identifiant ne correspond à aucune entrée du
 * référentiel.
 *
 * Le cas est réel : une URL partagée peut porter l'identifiant d'une campagne
 * supprimée depuis. Masquer la puce laisserait un filtre actif sans aucune
 * trace à l'écran, c'est-à-dire exactement le défaut que ces puces existent
 * pour supprimer. On montre donc la puce, avec une valeur qui dit ce qu'elle
 * est, et elle reste retirable.
 */
const UNKNOWN_VALUE = 'Valeur inconnue';

function optionLabel(options: readonly { value: string; label: string }[], id: string): string {
  return options.find((option) => option.value === id)?.label ?? UNKNOWN_VALUE;
}

/**
 * Valeur lisible d'un critère, ou `null` s'il n'est pas renseigné.
 *
 * Chaque branche lit SON champ nommément plutôt qu'un `filters[key]` générique.
 * C'est ce qui permet au compilateur de savoir qu'un `statut` s'indexe dans
 * `PROSPECT_STATUT_LABELS` et pas ailleurs : un critère renommé casse ici, à
 * l'endroit exact, au lieu de produire une puce vide en production.
 */
function chipValue(
  key: AdvancedFilterKey,
  filters: ProspectFilters,
  reference: ReferenceData | undefined,
): string | null {
  switch (key) {
    case 'representantId':
      return filters.representantId === null
        ? null
        : optionLabel(reference?.representants ?? [], filters.representantId);

    case 'departementId': {
      if (filters.departementId === null) return null;
      const item = reference?.departements.find((d) => d.id === filters.departementId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.name, item.isActive);
    }

    case 'banqueId': {
      if (filters.banqueId === null) return null;
      const item = reference?.banques.find((b) => b.id === filters.banqueId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.shortName, item.isActive);
    }

    case 'syndicatId': {
      if (filters.syndicatId === null) return null;
      const item = reference?.syndicats.find((s) => s.id === filters.syndicatId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.sigle, item.isActive);
    }

    case 'statut':
      return filters.statut === null ? null : PROSPECT_STATUT_LABELS[filters.statut];

    case 'segment':
      return filters.segment === null ? null : SEGMENT_LABELS[filters.segment];

    case 'phase2Status':
      return filters.phase2Status === null ? null : PHASE2_STATUS_LABELS[filters.phase2Status];

    case 'enrollmentMethod':
      return filters.enrollmentMethod === null
        ? null
        : ENROLLMENT_METHOD_LABELS[filters.enrollmentMethod];

    case 'campaignId':
      return filters.campaignId === null
        ? null
        : optionLabel(reference?.campagnes ?? [], filters.campaignId);

    case 'enrollmentCapturedById':
      return filters.enrollmentCapturedById === null
        ? null
        : optionLabel(reference?.commerciaux ?? [], filters.enrollmentCapturedById);
  }
}

/**
 * `reference` peut être absent : les listes se chargent après le premier rendu.
 * Une puce portant « Valeur inconnue » pendant une seconde vaut mieux qu'une
 * absence de puce, qui laisserait croire qu'aucun filtre ne s'applique.
 */
export function buildAdvancedChips(
  filters: ProspectFilters,
  reference: ReferenceData | undefined,
): AdvancedChip[] {
  const chips: AdvancedChip[] = [];

  for (const key of ADVANCED_FILTER_KEYS) {
    const value = chipValue(key, filters, reference);
    if (value === null) continue;
    chips.push({ key, field: ADVANCED_FILTER_LABELS[key], value });
  }

  return chips;
}
