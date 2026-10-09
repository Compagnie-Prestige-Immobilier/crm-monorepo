import type { Permission } from '@/lib/types';

export const AIDE_PERMISSIONS: Record<Permission, string> = {
  'accueil.consulter': 'Consulter le registre des visites et ses chiffres, sans rien saisir.',
  'accueil.listes': 'Modifier les listes de choix du registre des visites et importer des visites.',
  'accueil.registre': 'Enregistrer les visites à l’accueil et les archiver.',
  'analytics.lire':
    'Voir l’entonnoir, les délais, le rendement par département et les ouvertures de fiches.',
  'analytics.superviser':
    'Ouvrir les tableaux de bord de supervision : activité, entonnoir, pôle marketing.',
  'assistant.tout_lire':
    'Laisser l’assistant lire n’importe quelle donnée de la base pour répondre, sans se limiter aux chiffres prévus.',
  'assistant.utiliser':
    'Poser des questions sur les appels, les conversions et les conversions à venir.',
  'banque.administrer': 'Régler les étapes des dossiers Banque & Finance et valider les dossiers.',
  'banque.dossiers': 'Faire avancer les dossiers Banque & Finance de son portefeuille.',
  'banque.dossiers_lire':
    'Consulter les dossiers et les demandes de création de client, sans les faire avancer.',
  'banque.lire': 'Voir la vue d’ensemble Banque & Finance : encaissements, rejets et délais.',
  'banque.voir_tous_portefeuilles':
    'Voir les demandes Banque & Finance de tous les portefeuilles, pas seulement le sien.',
  'bases.administrer': 'Créer et supprimer les bases de démonstration.',
  'campagnes.administrer': 'Supprimer une campagne d’appels.',
  'campagnes.attributions_toutes': 'Voir qui a reçu quelle fiche dans toutes les campagnes.',
  'campagnes.gerer': 'Créer et modifier les campagnes d’appels.',
  'campagnes.superviser': 'Suivre l’avancement des campagnes d’appels.',
  'chiffres.consulter': 'Ouvrir un tableau de bord, sans changer ses cartes.',
  'chiffres.disposer': 'Choisir les blocs du tableau de bord et leur disposition.',
  'chiffres.voir_montants': 'Afficher les montants (ventes, paiements) dans les chiffres.',
  'comptes.administrer': 'Créer, modifier et désactiver les comptes.',
  'comptes.lister': 'Voir la liste des comptes, sans les modifier.',
  'courriels.administrer': 'Régler les courriels envoyés par le CRM.',
  'donnees.voir_supprimees': 'Voir les fiches et données supprimées.',
  'enrolement.administrer': 'Suivre les inscriptions de la plateforme et régler l’enrôlement.',
  'exploitation.administrer':
    'Suivre les envois et les tâches, lire le journal des actions et supprimer des données.',
  'exports.banque': 'Exporter les dossiers Banque & Finance.',
  'exports.globaux': 'Exporter les données de supervision (Excel global).',
  'exports.modeles': 'Télécharger les modèles de fichiers d’import.',
  'exports.prospects': 'Exporter les prospects de son portefeuille.',
  'exports.voir_tout': 'Exporter le portefeuille d’un autre téléconseiller.',
  'fiches.consigner_attribuees':
    'Enregistrer un appel sur une fiche distribuée à un autre téléconseiller. Sans elle, l’enregistrement de l’appel est refusé.',
  'fiches.forcer_transition':
    'Changer le statut d’une fiche même quand le parcours ne le permet pas.',
  'fiches.ignorer_propriete': 'Agir sur les rappels et les identifiants créés par d’autres.',
  'fiches.modifier_toutes': 'Modifier et supprimer les fiches créées par d’autres.',
  'fiches.ouvrir_attribuees': 'Ouvrir une fiche distribuée à un autre téléconseiller.',
  'fiches.parametres_reserves': 'Régler les liens, l’adresse et les destinataires CHUES.',
  'fiches.tenir': 'Lire et modifier les fiches de son propre portefeuille.',
  'fiches.voir_converties':
    'Voir aussi les fiches déjà converties dans les listes et à l’ouverture.',
  'fiches.voir_origine':
    'Voir d’où vient une fiche : canal, campagne publicitaire du classeur et campagnes d’appels.',
  'fiches.voir_segment': 'Voir le segment d’une fiche et l’historique de ses changements.',
  'formulaires.administrer': 'Régler les champs du formulaire de conversion.',
  'imports.administrer': 'Importer des fichiers de prospects ou de représentants.',
  'imports.relever':
    'Lancer tout de suite le relevé du classeur des leads SharePoint, même s’il n’a pas changé.',
  'notifications.administrer': 'Envoyer des notifications et régler leur envoi.',
  'panneau.acceder': 'Se connecter au panneau. Sans elle, le compte ne peut rien ouvrir.',
  'parametres.administrer': 'Régler les objectifs et les tableaux de bord par défaut.',
  'portefeuille.voir_tout':
    'Voir les portefeuilles de tous les téléconseillers, pas seulement le sien.',
  'prospects.convertir': 'Convertir un prospect Grand Public.',
  'prospects.fusionner': 'Fusionner deux fiches en doublon.',
  'prospects.lire': 'Consulter la liste et le détail des prospects.',
  'prospects.reaffecter': 'Redistribuer des fiches de son propre portefeuille.',
  'prospects.reaffecter_tout': 'Redistribuer une fiche vers n’importe quel téléconseiller.',
  'prospects.revoir': 'Traiter une demande de révision sur une fiche.',
  'prospects.superviser': 'Régler les segments et paramètres CHUES, et requalifier une fiche.',
  'qualification.rappels': 'Reporter ou annuler ses propres rappels.',
  'representants.lire': 'Consulter les représentants, leurs appels et leur historique.',
  'referentiels.superviser': 'Modifier les listes de référence : motifs, statuts, départements.',
  'rendez_vous.suivre': 'Confirmer, reporter ou annuler un rendez-vous et noter la présence.',
  'rendez_vous.closer': 'Remplir le formulaire de closing après un rendez-vous honoré.',
  'rendez_vous.exporter':
    'Emporter les rendez-vous affichés dans un classeur Excel, filtres compris.',
  'rendez_vous.voir':
    'Voir la liste des rendez-vous obtenus au téléphone, sans ouvrir les fiches prospect.',
  'roles.administrer': 'Créer des rôles et régler leurs permissions, dont celle-ci.',
  'support.plateforme': 'Ouvrir la plateforme de support GLPI.',
  'support.signaler': 'Signaler un problème au support depuis un écran.',
  'ventes.gerer': 'Saisir et corriger les ventes, déposer le classeur, régler sites et canaux.',
  'ventes.lire': 'Consulter les ventes.',
  'visites.detruire': 'Détruire définitivement une visite archivée.',
  'visites.voir_archivees': 'Consulter les visites archivées.',
};
