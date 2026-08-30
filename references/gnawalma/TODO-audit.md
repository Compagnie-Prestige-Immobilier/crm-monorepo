# Audit 2026-08-26 : corrections suivies

Cocher quand corrigé ET vérifié (analyse, tests API, ou émulateur). « (émulateur à faire) » = vérifié par analyse et tests seulement.

## Bloquants

- [x] 2. Confirmation du numéro à l'inscription (« C'est bien ce numéro ? »)
- [x] 3. WhatsApp depuis la fiche atelier via https://wa.me/
- [x] 4. Invité : appel et WhatsApp sans compte, contact journalisé après
- [x] 5. Appel lancé avant l'enregistrement du contact (hors ligne OK)
- [x] 6. Encaisser possible sur une commande livrée avec reste à payer
- [x] 7. Retour de statut (Livré → Prêt, Prêt → En cours) + confirmation avant « Livré »
- [x] 8. Mode invité persisté au démarrage
- [x] 9. Session expirée : message + cache vidé + retour à l'écran d'origine
- [x] 10. Pastille « demandes en attente » sur l'onglet Tableau (émulateur à faire)
- [x] 11. Activité client : « Vue par l'atelier » / « En attente » (handled_at)
- [x] 12. AppButton hauteur minimale ; étoile vide lisible

## Majeurs : commandes et tableau (mobile atelier)

- [x] Tableau → « En cours » / « Prochaine échéance » ouvre bien l'onglet En cours
- [x] « Impayées » sans contrainte de statut
- [x] « En retard » : Prêt compté comme le serveur ; compteur serveur
- [x] Onglet Livré : status=livre,annule côté serveur, tri décroissant
- [x] Filtre sans résultat : bandeau conservé
- [x] Nouvelle commande : retour → étape précédente, confirmation si rempli
- [x] Créer une commande depuis une demande : loading, pas de doublon, traitée après création
- [x] Encaisser : champ vide ; correction d'un paiement
- [x] Recherche client par téléphone normalisée
- [x] Confirmation après modification client / commande / bénéficiaire
- [x] « Plus tard » saute l'étape sans enregistrer
- [x] Permission notifications depuis le réglage avec explication ; refus reflété
- [x] Enregistrer le profil invalide listes et carte
- [x] Photo du tissu : nouvel essai, fichier conservé
- [x] Fermer une feuille par glissement : confirmation si saisie non vide

## Majeurs : client, auth, session (mobile client)

- [x] Favoris : clés de cache avec uid
- [x] Carte : rechargement au déplacement
- [x] GPS refusé : message + repli région ; GPS réactivé : rafraîchi au retour
- [x] « Donner mon avis » masqué sans contact préalable (can_review)
- [x] Relance d'avis ignorée si déjà noté
- [x] Publier un avis invalide les cartes
- [x] Réveil du serveur relancé au retour d'arrière-plan
- [x] AppState.fromError : message générique

## Majeurs : API

- [x] total_cfa < déjà payé refusé
- [x] Transitions de statut validées
- [x] Contacts dédoublonnés
- [x] share_phone respecté
- [x] can_review exposé
- [x] status=livre,annule et sort=desc acceptés

## Vague 2 : manques

- [x] WhatsApp prérempli « c'est prêt » après « Marquer prêt »
- [x] Reçu après encaissement ; bon de commande avec photo du tissu et journal des paiements
- [x] Relance : « Prêt depuis N jours » + WhatsApp ; relance impayé depuis la commande
- [x] Fiche atelier : numéro en texte (copie), itinéraire
- [x] Lien partageable vers une fiche (deep link + page publique) + « Partager » dans le menu de la fiche
- [x] Commande : nom du client tappable ; WhatsApp sur commande et demande reçue
- [x] Mesures : reprendre la dernière commande du client ; « Ajouter un bénéficiaire » à l'étape 2 ; photo du cahier
- [x] Bénéficiaire visible en liste
- [x] Suppression client et bénéficiaire
- [x] Horaires et « à partir de X FCFA » sur la fiche
- [x] « Ouvrir mon atelier » pour un client connecté
- [x] Suppression de compte différée de 7 jours, annulable à la reconnexion
- [x] Accessibilité : cibles 48 dp, switches nommés, erreurs annoncées, touche Effacer nommée, états non portés par la couleur seule
- [x] Code choisi une seule fois, visible, avec récapitulatif
- [x] Registre de commerce en photo
- [x] Rail alphabétique supprimé : recherche + tri par récence
