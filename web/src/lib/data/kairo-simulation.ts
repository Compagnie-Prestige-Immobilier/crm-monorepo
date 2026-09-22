import type { EtatKairo, TableauKairo } from '@/lib/data/kairo';

export function estModeDev(): boolean {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export const ETAT_KAIRO_SIMULE: EtatKairo = {
  sain: true,
  pauseDepuis: null,
  derniereLectureSecondes: 8,
  intervalleSecondes: 30,
  agents: ['cpi-expert', 'glpi-watcher', 'git-operator', 'pr-reviewer'],
  mttrSecondes: 275,
  jevActif: true,
  tickets: [
    {
      id: 274,
      projet: 'crm-monorepo',
      statut: 'pr',
      essais: 1,
      majLe: '2026-09-22 13:29:47',
      lien: 'https://glpi.cpi.sn/front/ticket.form.php?id=274',
      resume: 'Rafraîchissement global des bases de démonstration',
      cause: 'Demande d’évolution : besoin d’un bouton global pour rafraîchir toutes les bases d’un clic.',
      notes: 'Bouton ajouté dans la vue admin/bases, point d’entrée Go POST /bases/rafraichir câblé.',
      prUrl: 'https://github.com/Compagnie-Prestige-Immobilier/crm-monorepo/pull/116',
      dureeSecondes: 240,
      jevCategorie: 'Évolution',
      jevConfiance: 0.98,
    },
    {
      id: 272,
      projet: 'crm-monorepo',
      statut: 'escalade',
      essais: 2,
      majLe: '2026-09-22 12:45:10',
      lien: 'https://glpi.cpi.sn/front/ticket.form.php?id=272',
      resume:
        'Dilemme métier : deux règles contradictoires sur le statut d’attribution lors de la conversion de prospect.',
      cause: 'Faut-il écraser le téléconseiller initial ou conserver l’historique dans la fiche vente ?',
      consigne: 'Conserver l’historique du téléconseiller d’origine et journaliser la nouvelle attribution.',
      notes: 'Attention à la contrainte de clé étrangère sur la table prospects.',
      dureeSecondes: 180,
      jevCategorie: 'Anomalie métier',
      jevConfiance: 0.94,
    },
    {
      id: 271,
      projet: 'crm-monorepo',
      statut: 'running',
      essais: 1,
      majLe: '2026-09-22 13:50:00',
      lien: 'https://glpi.cpi.sn/front/ticket.form.php?id=271',
      resume: 'Optimisation de la requête SQL d’export Excel des représentants.',
      cause: 'Temps de réponse supérieur à 4s sur les jeux de données volumineux.',
      dureeSecondes: 110,
      jevCategorie: 'Performance',
      jevConfiance: 0.91,
    },
    {
      id: 269,
      projet: 'crm-monorepo',
      statut: 'echec',
      essais: 3,
      majLe: '2026-09-22 11:30:22',
      lien: 'https://glpi.cpi.sn/front/ticket.form.php?id=269',
      resume: 'Échec de synchronisation du filtre de date sur le registre des visites.',
      cause: 'Timeout 5000ms dépassé dans le composant de sélection de date Base UI.',
      notes: 'Nécessite arbitrage : composant tiers à mettre à jour.',
      dureeSecondes: 340,
      jevCategorie: 'Bogue UI',
      jevConfiance: 0.88,
    },
    {
      id: 265,
      projet: 'crm-monorepo',
      statut: 'pr',
      essais: 1,
      majLe: '2026-09-22 09:15:40',
      lien: 'https://glpi.cpi.sn/front/ticket.form.php?id=265',
      resume: 'Ajout du filtre par canal dans la console des ventes.',
      cause: 'Filtre manquant pour les superviseurs.',
      prUrl: 'https://github.com/Compagnie-Prestige-Immobilier/crm-monorepo/pull/112',
      dureeSecondes: 195,
      jevCategorie: 'Évolution',
      jevConfiance: 0.96,
    },
  ],
};

export const REFORMULATION_SIMULEE: TableauKairo['reformulation'] = {
  active: true,
  fournisseurs: ['gemini-1.5-flash', 'claude-3-5-sonnet', 'deepseek-v3'],
  parModele: [
    { modele: 'gemini-1.5-flash', nombre: 42 },
    { modele: 'claude-3-5-sonnet', nombre: 28 },
    { modele: '', nombre: 8 },
  ],
  recentes: [
    {
      id: 'sim-1',
      creeLe: '2026-09-22T13:45:00.000Z',
      reformulePar: 'gemini-1.5-flash',
      description:
        'Le bouton enregistrer ne réagit plus lors de la validation du formulaire de prospection.',
      contexte: 'Navigateur Safari iOS 17.5 sur iPad. Écran de saisie prospect.',
      descriptionTransmise:
        'Problème : lors du clic sur « Enregistrer », aucune requête réseau n’est émise et le formulaire reste bloqué sans message d’erreur. Contexte : iPad Safari 17.5.',
    },
    {
      id: 'sim-2',
      creeLe: '2026-09-22T12:30:00.000Z',
      reformulePar: 'claude-3-5-sonnet',
      description:
        'L’admin doit avoir les mêmes éléments que le superviseur, en plus de ce qui lui est déjà réservé.',
      contexte: 'Tableau de bord des ventes et filtres avancés.',
      descriptionTransmise:
        'Demande : aligner la vue de l’administrateur sur celle du superviseur tout en maintenant l’accès exclusif aux fonctionnalités d’administration (export brut et configuration des canaux).',
    },
  ],
};
