import { useSyncExternalStore } from 'react';

import { blankFiche, type Fiche, type Lot } from './bant';

const FICHES_KEY = 'cpi_radar_proto_fiches';
const LOTS_KEY = 'cpi_radar_proto_lots';

const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const SEED_LOTS: Lot[] = [
  { id: 'L1', programme: 'Les Jardins de Sendou', localite: 'Bargny / Sendou', superficie: '200 m²', prix: 7500000, papiers: 'titre-foncier', etat: 'viabilise-complet' },
  { id: 'L2', programme: 'Cité Lac Rose', localite: 'Diamniadio / Lac Rose', superficie: '150 m²', prix: 5250000, papiers: 'bail', etat: 'viabilise-partiel' },
  { id: 'L3', programme: 'Résidence Keur Massar', localite: 'Pikine / Guédiawaye', superficie: '250 m²', prix: 11000000, papiers: 'titre-foncier', etat: 'viabilise-complet' },
  { id: 'L4', programme: 'Domaine de Saly', localite: 'Mbour / Saly', superficie: '300 m²', prix: 12500000, papiers: 'titre-foncier', etat: 'loti' },
  { id: 'L5', programme: 'Thiès Horizon', localite: 'Thiès', superficie: '200 m²', prix: 4500000, papiers: 'notification-bail', etat: 'loti' },
];

const seed = (partial: Partial<Fiche> & { id: string; values: Record<string, string> }): Fiche => ({ ...blankFiche(), cree: ago(20), maj: ago(2), ...partial });

const SEED_FICHES: Fiche[] = [
  seed({
    id: 'F1', scores: { budget: 4, authority: 4, need: 4, timeline: 4 }, motivations: ['primo', 'transmission'],
    values: { 'prospect-name': 'Aminata Diallo', telephone: '77 412 55 90', 'secteur-activite': 'enseignant', etape: 'visite', 'deja-client': 'non', 'visite-cpi': 'oui-une-fois', 'visite-site': 'oui-un', canal: 'parrainage', langue: 'Wolof', 'localite-souhaitee': 'Bargny / Sendou', superficie: '200 m²', 'exigence-papiers': 'tf', 'consent-date': inDays(-6), 'statut-pro': 'fonctionnaire', charges: '1-2', logement: 'locataire', loyer: '120000', banque: 'CBAO', financement: 'autofinancement', revenu: '650000', 'credit-en-cours': 'non', 'prix-lot': '7500000', apport: '4000000', 'origine-apport': 'epargne', 'lot-localite': 'Bargny / Sendou', 'lot-superficie': '200 m²', 'nature-foncier': 'titre-foncier', 'etat-site': 'viabilise-complet', frein: 'acompte', commercial: 'Moussa Sow', 'prochaine-action': 'proposition', 'date-relance': inDays(2) },
    history: [{ date: ago(6), etape: 'Visite effectuée', action: 'Envoyer la proposition', commercial: 'Moussa Sow', note: 'Visite avec son mari. Très intéressés par le lot d’angle, inquiets pour l’acompte.' }],
  }),
  seed({
    id: 'F2', residence: 'diaspora', scores: { budget: 5, authority: 4, need: 5, timeline: 5 }, motivations: ['retour', 'maison'],
    values: { 'prospect-name': 'Ibrahima Fall', telephone: '+33 6 12 34 56 78', 'secteur-activite': 'tech', etape: 'negociation', 'deja-client': 'non', 'visite-cpi': 'non', canal: 'digital', langue: 'Français', pays: 'France', mandataire: 'proche', sejour: 'moins-1-mois', 'paiement-diaspora': 'virement', 'vu-terrain': 'video', inquietude: 'papiers', 'localite-souhaitee': 'Mbour / Saly', superficie: '300 m²', 'exigence-papiers': 'tf', 'type-projet': 'terrain-construction', 'delai-construction': 'court', 'consent-date': inDays(-10), revenu: '3800', devise: 'EUR', 'prix-lot': '12500000', apport: '7000000', 'lot-localite': 'Mbour / Saly', 'lot-superficie': '300 m²', 'nature-foncier': 'titre-foncier', acquereur: 'lui', piece: 'passeport', 'origine-justifiee': 'demande', commercial: 'Awa Ndiaye', 'prochaine-action': 'signature', 'date-relance': inDays(9) },
  }),
  seed({
    id: 'F3', sector: 'informal', scores: { budget: 2, authority: 3, need: 4, timeline: 2 }, motivations: ['pro'],
    values: { 'prospect-name': 'Fatou Sarr', telephone: '76 220 18 43', 'secteur-activite': 'commerce', etape: 'contacte', canal: 'terrain', langue: 'Wolof', moment: 'soir', 'localite-souhaitee': 'Rufisque', superficie: '150 m²', 'consent-date': inDays(-3), 'statut-pro': 'informel', charges: '3-5', logement: 'heberge', banque: 'mobile', revenu: '350000', regularite: 'variable', 'informel-credit': 'tontine', 'credit-en-cours': 'oui', 'type-credit': 'microcredit', mensualites: '45000', 'fin-credit': '6-12', 'prix-lot': '5250000', apport: '1500000', commercial: 'Moussa Sow', 'prochaine-action': 'appel', 'date-relance': inDays(-3) },
  }),
  seed({
    id: 'F4', sector: 'collective', scores: { budget: 3, authority: 4, need: 5, timeline: 3 }, motivations: ['maison'],
    values: { 'prospect-name': 'Ndèye Coumba Mbaye', company: 'GIE Femmes de Thiaroye', telephone: '78 603 71 12', 'role-groupement': 'presidente', etape: 'rdv', canal: 'evenementiel', langue: 'Wolof', 'localite-souhaitee': 'Pikine / Guédiawaye', superficie: '250 m²', commercial: 'Awa Ndiaye', 'prochaine-action': 'rdv', 'date-relance': inDays(5) },
  }),
  seed({
    id: 'F5', sector: 'formal', scores: { budget: 4, authority: 3, need: 4, timeline: 3 },
    values: { 'prospect-name': 'Cheikh Tidiane Gueye', company: 'Amicale des enseignants de Rufisque', telephone: '77 980 44 21', 'secteur-activite': 'enseignant', etape: 'proposition', canal: 'institutionnel', 'type-structure': 'mutuelle', effectif: '200-1000', 'salaries-concernes': '45', 'fonction-interlocuteur': 'delegue', 'objectif-structure': 'social', modalite: 'convention', cycle: 'comite', 'localite-souhaitee': 'Rufisque', commercial: 'Moussa Sow', 'prochaine-action': 'rdv', 'date-relance': inDays(-1) },
  }),
  seed({
    id: 'F6', scores: { budget: 2, authority: 2, need: 2, timeline: 1 }, motivations: ['placement'],
    values: { 'prospect-name': 'Ousmane Ba', telephone: '70 118 90 03', 'secteur-activite': 'pme', etape: 'perdu', 'motif-perte': 'prix', canal: 'digital', 'localite-souhaitee': 'Dakar', commercial: 'Awa Ndiaye' },
  }),
];

function createStore<T>(key: string, seedValue: T) {
  let value: T = seedValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    value = seedValue;
  }
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    get: () => value,
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Stockage indisponible (navigation privée) : la session reste en mémoire.
      }
      listeners.forEach((l) => l());
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}

export const fiches = createStore(FICHES_KEY, SEED_FICHES);
export const lots = createStore(LOTS_KEY, SEED_LOTS);

export function upsertFiche(f: Fiche) {
  const list = fiches.get();
  fiches.set(list.some((x) => x.id === f.id) ? list.map((x) => (x.id === f.id ? f : x)) : [...list, f]);
}
