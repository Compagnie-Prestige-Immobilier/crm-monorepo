# Audit tour 2, 2026-08-26 : corrections suivies

Cocher quand corrigé ET vérifié (analyse, tests, ou émulateur). Hors périmètre décidé : mail, numéro de support réel, OTP, push serveur, wolof, hors-ligne d'écriture.

## A1. Mobile atelier (screens/atelier/*, wizard, notifications, queries, ui, models)

- [x] Retard calculé au jour (`daysUntil < 0`), plus à l'instant ; raccourcis de date normalisés à minuit
- [x] Encaisser masqué sur une commande annulée
- [x] Filtre Impayées exclut les annulées (paramètre serveur) ; filtre Retard côté serveur (`en_retard=1`), plus de filtre client ni d'auto-pagination
- [x] Titre de l'onglet Commandes basé sur les compteurs serveur
- [x] « Marquer prêt » / statut : verrou anti double appui ; feuille « Prévenir le client » avec le contexte de la feuille, pas de la ligne
- [x] Rappels : reprogrammés à la réactivation du réglage ; annulés quand la commande passe à Prêt
- [x] Import contacts : rapprochement par téléphone normalisé avant création
- [x] Croix de recherche annule le debounce
- [x] Correction de paiement datée, non corrigeable elle-même ; cumul du bon trié par date puis id
- [x] Bon de commande : bénéficiaire affiché ; capture sans échelle de police système (bon, reçu, carte de visite)
- [x] Reçu : document distinct du bon (titre « Reçu », dernier paiement mis en avant)
- [x] Photos : choix appareil/galerie explicite, `PlatformException` rattrapée, bouton « Retirer » (tissu, cahier), état d'envoi et confirmation sur logo/couverture/registre
- [x] `PopScope` + confirmation : profil atelier, formulaire client, bénéficiaire, changement de code ; `OrderForm` et contrôleurs libérés
- [x] Clé d'idempotence `client_token` envoyée sur création de commande et paiement
- [x] `orderStatuses[status] ?? status` ; « Prêt depuis N jours » en toutes lettres
- [x] Un seul terme « Reste à payer » partout ; « Client ajouté. » après création
- [x] Étape 2 depuis une fiche client : retour sort directement ; recherche client vide propose « Nouveau client » ; chiffres tapés vont au téléphone
- [x] Encaisser : raccourci « La moitié »
- [x] Tableau : « À livrer aujourd'hui » ; « Ce mois-ci » ouvre les livrées du mois ; « Reste à payer par client » (impayées groupées par client)
- [x] Assistant : région ne passe plus seule à l'étape suivante (les 8 étapes restent, décision produit)
- [x] Changement de code via `PinScreen` (plus de clavier système) ; suppression de compte via `PinScreen` côté atelier aussi
- [x] Motif de vérification (`verification_note`) affiché dans Réglages quand l'atelier n'est pas vérifié
- [x] Rappels reprogrammés depuis les commandes ouvertes ; vocabulaire « Connexion en cours »
- [x] Clients paginés côté serveur avec recherche serveur, liste paresseuse

## A2. Mobile client et auth (screens/client/*, auth, session, api, router, main, config, manifest)

- [x] Lien profond et notification à froid conservés à travers l'intro et la connexion
- [x] Fiche : `didUpdateWidget` sur le favori ; repli hors ligne aussi depuis la carte ; bandeau « données partielles, réessayer » en repli
- [x] Appel invité journalisé après création du compte (tampon local rejoué à la connexion)
- [x] Carte : rechargement seulement au-delà de ~2 km et après 500 ms, coordonnées arrondies dans la clé
- [x] `PopScope` sur l'inscription (retour = étape précédente) ; contrôleurs libérés (auth, home, more, search)
- [x] Relance d'avis : permission demandée depuis le réglage client avec explication ; borne 30 jours ; clé `nudge_dismissed` par compte
- [x] « Un compte existe déjà » propose « Se connecter » ; « Code oublié » contient le bouton support
- [x] Identifiant pré-rempli à la reconnexion
- [x] Recherche : affinage (région, spécialité) visible après une recherche ; bouton Carte sur les résultats ; pas d'autofocus en arrivant de l'accueil
- [x] Fiche : Appeler en primaire, « Demander un devis » en secondaire ; bouton Appeler sur les cartes ; les trois actions passent en colonne à grande police ; « Appeler maintenant » après une demande envoyée
- [x] Catégories de l'accueil reflètent la sélection réelle
- [x] Refus définitif de position : pas de feuille région derrière les réglages système
- [x] Étoiles interactives nommées une par une ; « Partager mon numéro » avec état coché ; carrousel promo s'arrête après un cycle et respecte la réduction de mouvement
- [x] Hauteurs fixes retirées : carte atelier 252, pastilles régions 44, touches du pavé, `SizedBox` d'erreur
- [x] Cibles 48 dp : « Noter », « Effacer », filtres, marqueurs de carte nommés + « Voir en liste »
- [x] Sémantique : `Semantics(onTap:)` sur `AppIconButton` et touche Effacer ; `FTappable` sans `excludeSemantics` qui avale le tap
- [x] `int.tryParse` sur les paramètres d'URL + écran « lien invalide »
- [x] `warmup()` relancé directement au retour d'arrière-plan
- [x] Version minimale : `/health` renvoie `min_version`, écran bloquant vers le Play Store
- [x] Cache d'images borné (`CacheManager`) ; `memCacheWidth` sur les vignettes
- [x] `usesCleartextTraffic` limité au debug via `network_security_config`
- [x] Textes légaux en une seule constante partagée

## A3. API, admin, infra

- [x] `contact()` et `review()` refusent l'auteur de l'atelier (403)
- [x] Retard serveur au jour (`date_trunc`) ; `impayees` exclut `annule` ; `en_retard=1` ; `delivered_at` horodaté et utilisé pour le mois
- [x] Idempotence : `client_token` unique sur commandes et paiements (`firstOrCreate`)
- [x] Paiements triés `created_at, id` ; corrections non corrigeables
- [x] Limiteur de connexion par identifiant seul à délai croissant + compteur d'échecs
- [x] Clients paginés + recherche serveur ; fusion de deux fiches (`POST /clients/{id}/fusionner/{autre}`)
- [x] `review()` remet `text` à null quand absent
- [x] Migration unaccent : `down()` vide
- [x] Journal des changements de montant (`total_cfa`) porté sur le bon
- [x] Montant total facultatif à la création, exigé avant « livré »
- [x] Filament : modifier l'identifiant d'un utilisateur ; `verification_note` sur l'atelier, exposée à l'app ; exports Ateliers/Utilisateurs
- [x] Pages web `/confidentialite` et `/conditions`
- [x] `/health` renvoie `min_version`
- [x] Sauvegarde quotidienne : abandonnée (décision produit), workflow et secret supprimés
- [x] Réveil planifié de Render : cron-job.org, job 8332388, `/api/v1/health` toutes les 10 min (le workflow GitHub est retiré, Actions bloqué par la facturation)
- [x] Photos persistantes : stockées dans Postgres et servies par /m/{path}, aucun coût
- [ ] Base Postgres payante ou migrée avant le 31 août (bloqué : paiement)
  - Décision attendue : payer le plan Render Postgres (7 $/mois) avant l'expiration du plan gratuit, ou fournir l'URL d'une base externe (Neon ou Supabase) à mettre dans `DB_URL` ; sans choix, la base est supprimée et les données perdues.
- [x] Android : keystore de release + `key.properties` ignoré par git, icône adaptative Gnawalma, splash, `flutter_launcher_icons`

## B. Simplifications (après A)

- [x] Un seul chemin d'avis : bandeau de relance + fiche (notification et « Noter » de l'activité retirés)
- [x] État de filtre des commandes en un seul énuméré
- [x] Un seul repli de recherche « Autres ateliers »
- [x] Une seule fonction de capture d'image (bon, reçu, carte)
- [x] Photo facultative : envoi au choix de la photo, échec = sans photo, sans question
- [x] Une seule implémentation de suppression de compte
