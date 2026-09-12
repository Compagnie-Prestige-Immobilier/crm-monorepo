# Grand Public : plan d'amélioration des interactions

Relevé du 12 septembre 2026 sur la branche `feat/grand-public-demandes-prospect`.
Périmètre : ce que l'utilisateur **manipule** dans la coque `/grand-public/*`,
pour les six rôles : formulaires, barre latérale et navigation, dialogues,
listes et filtres, retours d'information, clavier et tactile.
Rien n'est codé avant l'arbitrage du §9.

- **Qui l'exige** : le téléconseiller perd une saisie sur Échap, sur Entrée ou
  en touchant hors d'un dialogue ; un téléphone partagé garde les listes du
  compte précédent ; l'encadrement retombe sur la mauvaise page après chaque
  retour.
- **Plus petit changement complet** : le lot 1 (§8), environ 150 lignes, aucun
  écran redessiné, aucune migration.
- **Hors périmètre** : les décisions de rôle (§10), CHUES, Accueil et Admin sauf
  les composants partagés, toute refonte d'écran sans accord écrit (§9).

## 1. Méthode et limites

Lecture du code, en trois passes : formulaires, navigation, retours et listes.
Les composants partagés cités au §2 ont été relus ligne à ligne
(`ui/dialog.tsx`, `ui/button.tsx`, `layout/sidebar-nav.tsx`, `layout/user-menu.tsx`,
`console/use-shortcuts.ts`, `main.tsx`). **Aucun écran n'a été rendu.** Les
lignes marquées _(à voir)_ reposent sur un comportement du navigateur que le
lot 0 confirme ou retire.

Contraintes (`AGENTS.md`) : panneau v1 repris tel quel, aucune refonte d'écran
sans accord écrit ; un composant nouveau sous 300 lignes et seulement avec deux
appelants réels ; aucun test unitaire ; pas de tiret cadratin affiché.

Chemins relatifs à `web/src/` sauf mention. **P1** fait perdre du travail ou
des données, **P2** ralentit ou trompe, **P3** finition.

## 2. Socle partagé : corriger une fois, gagner partout

Chaque ligne a au moins deux appelants en Grand Public ; la plupart servent
aussi CHUES.

| #   | Composant                 | Défaut                                                                                                                                             | Preuve                                                                                                                                   | Correctif                                                                                   |                 Lignes |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------: |
| S1  | `DialogContent`           | Tout le dialogue défile : pied et bouton Fermer sortent de l'écran sur téléphone ; jamais plein écran ; Échap et clic extérieur ferment une saisie | `components/ui/dialog.tsx:51-55`                                                                                                         | corps défilant, pied collant, plein écran sous `sm`, prop `modifie` qui bloque la fermeture |       ~30 + 1 par site |
| S2  | `Button`                  | Pas d'état d'envoi : chaque écran bricole, beaucoup n'affichent rien                                                                               | `components/ui/button.tsx:48`                                                                                                            | prop `pending` : `disabled`, `aria-busy`, spinner                                           |                    ~10 |
| S3  | Formulaires               | Aucun focus ni défilement vers la première erreur après envoi                                                                                      | `nouveau-prospect.tsx:250-252`, `prospect-form.tsx:678-680`, `console-view.tsx:912`                                                      | `focusPremiereErreur(racine)` sur `[aria-invalid="true"]`                                   | ~10 + 1 par formulaire |
| S4  | `Liste`, `FilterCombobox` | Erreur non signalée sur le contrôle ; une valeur facultative ne s'efface pas                                                                       | `components/forms/liste.tsx:38`, `filters/filter-combobox.tsx:25-49`                                                                     | `aria-invalid` lu depuis `Field`, entrée « Non renseigné » optionnelle                      |                    ~25 |
| S5  | `useShortcuts`            | Échap agit même dans un champ ; Entrée sur un bouton focalisé déclenche le raccourci au lieu du bouton                                             | `components/console/use-shortcuts.ts:7-12,38`                                                                                            | Échap dans un champ ne fait que quitter le champ ; ignorer `button`, `[role=option]`        |                     ~6 |
| S6  | Numéros de téléphone      | `tel:` sur deux écrans seulement ; ailleurs texte brut, ni appelable ni copiable                                                                   | `rappels-view.tsx:142`, `mes-contacts-view.tsx:305`, `console-view.tsx:530`, `lot-export-fiches.tsx:480`, `bank/bank-cases-view.tsx:201` | `<LienTelephone>` : ancre `tel:`, sans déclencher le clic de ligne                          |       ~20 + 1 par site |
| S7  | Pagination                | Quatre copies différentes, dont une sans total                                                                                                     | `prospects-view.tsx:476-535`, `bank/bank-cases-view.tsx:236-297`, `lots-export-view.tsx:257-285`, `lot-export-fiches.tsx:546-589`        | un composant ; les copies disparaissent                                                     |             ~60, ~-150 |
| S8  | `EmptyState`              | Une recherche sans résultat ne propose pas d'effacer les filtres                                                                                   | `prospects-view.tsx:568`, `bank/bank-cases-view.tsx:123-129`, `lots-export-view.tsx:182-196`, `console-view.tsx:488-494`                 | action « Effacer les filtres »                                                              |        ~8 + 2 par site |
| S9  | Chargement                | Squelettes qui ne ressemblent pas au contenu ; flash à chaque changement de filtre                                                                 | `prospects-view.tsx:649` (6 colonnes pour 9), `rappels-view.tsx:74-77,103`                                                               | `placeholderData` sur les listes, squelette de tableau aux bonnes colonnes                  |                    ~20 |
| S10 | `Toaster`, `QueryClient`  | Pas de bouton de fermeture ; une erreur dure autant qu'un succès ; une mutation sans `onError` échoue en silence                                   | `components/ui/sonner.tsx:11-30`, `main.tsx:23`                                                                                          | `closeButton`, durée d'erreur allongée, filet `MutationCache.onError`                       |                    ~10 |
| S11 | `Kbd`                     | Indices clavier affichés sur écran tactile                                                                                                         | `components/console/console-ui.tsx:8-14`                                                                                                 | masqués sur pointeur grossier                                                               |                      1 |

## 3. Formulaires

| #   | P   | Formulaire                 | Défaut                                                                                                                                     | Preuve                                                                                                 | Correctif                                                                 | Lignes |
| --- | --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -----: |
| F1  | P1  | Nouveau prospect, Modifier | Échap, clic extérieur, « Annuler » et « Revenir à la liste » jettent la saisie sans demander                                               | `prospects-view.tsx:330`, `prospect-detail.tsx:202`, `nouveau-prospect.tsx:354,452`                    | S1 + confirmation sur les deux boutons                                    |    ~15 |
| F2  | P1  | Commentaire d'appel        | Entrée envoie l'appel ; un téléphone n'a pas Maj+Entrée, le texte d'aide l'exige                                                           | `console-view.tsx:1471-1476`, `nouveau-prospect.tsx:413`                                               | envoi sur Ctrl/Cmd+Entrée, Entrée passe à la ligne                        |     ~5 |
| F3  | P1  | Écran d'appel              | Échap efface statut, commentaire et dossier d'adhésion, même depuis un champ, sans retour possible                                         | `console-view.tsx:997-1001,1059`                                                                       | S5 + toast « Rétablir » quand une saisie est en cours                     |    ~20 |
| F4  | P1  | Modifier la fiche          | WhatsApp, numéro du relais ou ancienneté invalides sont écartés sans message, et **effacés** en base                                       | `prospect-form.tsx:701-709,975-979,312-316`                                                            | vérifier ces champs à l'envoi, erreur sous le champ                       |    ~20 |
| F5  | P1  | Écran d'appel              | Choisir un statut efface le dossier d'adhésion déjà rempli, rappel compris                                                                 | `console-view.tsx:953`                                                                                 | garder le dossier sur un statut qui planifie un rappel                    |     ~6 |
| F6  | P2  | Écran d'appel              | « Ce motif exige un commentaire », « Choisissez une échéance » : en toast, pas sous le champ                                               | `console-view.tsx:888,968`, `nouveau-prospect.tsx:299,329`                                             | prop `error` sur `Commentaire` et `PanneauEcheance`                       |    ~20 |
| F7  | P2  | Téléphone                  | Deux champs : saisie brute sans format à l'ajout, champ international à la modification ; conflit 409 avec lien d'un côté, sans de l'autre | `console/conversion-fields.tsx:83-97`, `nouveau-prospect.tsx:110,220`, `prospect-form.tsx:665,777,789` | `InternationalPhoneField` partout, un seul bloc de conflit avec lien      |    ~30 |
| F8  | P2  | Confirmer la conversion    | Montant `type="number"` sans clavier numérique ni aperçu ; bouton grisé sans raison ; valeurs gardées après fermeture                      | `prospect-detail.tsx:490,527-533,554-559,308-311`                                                      | reprendre le champ montant de l'encaissement, S2, remise à zéro           |    ~20 |
| F9  | P2  | Même champ, trois rendus   | Situation en cases à cocher (choix unique) ou en boutons ; durée en liste ou en nombre libre ; banque avec ou sans recherche               | `conversion-fields.tsx:585-591,308-366`, `prospect-form.tsx:797-803`, `prospect-detail.tsx:538-545`    | boutons radio, liste des durées partout, recherche sur les longues listes |    ~20 |
| F10 | P2  | Tous                       | « Obligatoire » marqué de trois façons : étiquette, astérisque, « (obligatoire pour X) »                                                   | `components/forms/field.tsx:43`, `bank/bank-case-detail-view.tsx:506,797,831`, `console-view.tsx:1462` | `Field` dans les dialogues bancaires                                      |    ~30 |
| F11 | P2  | Dialogues                  | Boutons grisés sans dire pourquoi : rejet sans motif, campagne au nom de moins de 3 lettres                                                | `bank/bank-case-detail-view.tsx:880`, `lots-export/lot-create-dialog.tsx:756`                          | une ligne d'aide sous le bouton                                           |    ~10 |
| F12 | P2  | Création de campagne       | Superviseurs et direction cochés d'office comme destinataires                                                                              | `lots-export/lot-create-dialog.tsx:960,970`                                                            | seuls les téléconseillers cochés                                          |     ~3 |
| F13 | P2  | Nouveau prospect           | Jusqu'à six boutons en pied ; le statut précède le nom ; légendes de l'écran d'appel (« Phase 3 · Conversion »)                            | `nouveau-prospect.tsx:365,421-453`, `conversion-fields.tsx:478`                                        | trois boutons, nom en tête, légendes propres à l'ajout                    |    ~20 |
| F14 | P3  | Tous sauf Modifier         | Pas de `<form>` : la touche Entrée ou « OK » du clavier mobile n'envoie rien                                                               | `nouveau-prospect.tsx`, `console-view.tsx`, `lot-create-dialog.tsx`, dialogues bancaires               | envelopper dans `<form onSubmit>`                                         |    ~20 |
| F15 | P3  | Modifier la fiche          | Pas de bouton Annuler ; Annuler en `ghost` ici, `outline` ailleurs                                                                         | `prospect-form.tsx:926-966`, `prospect-detail.tsx:551`, `bank/bank-a-ouvrir-view.tsx:336`              | bouton Annuler, une seule variante                                        |     ~6 |
| F16 | P3  | Modifier la fiche          | Les erreurs restent affichées pendant la correction ; changer la situation efface toutes les erreurs                                       | `prospect-form.tsx:755,806`                                                                            | effacer l'erreur du champ modifié seulement                               |     ~8 |
| F17 | P3  | Modifier la fiche (mobile) | `autoFocus` sur Prénom ouvre le clavier et masque le dialogue                                                                              | `prospect-form.tsx:754`                                                                                | pas d'autofocus sur pointeur grossier                                     |     ~2 |
| F18 | P3  | Ouvrir un dossier          | La boîte « banque » garde le choix du client précédent ; « Ouvrir le dossier » sans état d'envoi                                           | `bank/bank-a-ouvrir-view.tsx:295,339-347`                                                              | remise à zéro à l'ouverture, S2                                           |     ~4 |
| F19 | P3  | Sélecteur de date          | Cases de 36 px ; `aria-label` masque la date choisie aux lecteurs d'écran                                                                  | `components/filters/date-picker.tsx:59,169`                                                            | 44 px, étiquette qui inclut la valeur                                     |     ~5 |

Nettoyage associé : le mode création de `prospect-form.tsx` n'est plus monté
(`IntroHeader`, `PiedDeFormulaire`, « suivant », Ctrl+Entrée), ~250 lignes
mortes à retirer avant de toucher F4, F15 et F16.

## 4. Barre latérale, en-tête et navigation

Barre vue par rôle en Grand Public (`components/layout/nav-items.ts:594-774`) :

| Rôle                         | Entrées                                        | Sous « Plus »                                                        |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| ADMIN                        | Tableau de bord, Prospects, Dossiers bancaires | Rappels, Mes contacts, Exporter les dossiers, Importer des prospects |
| DIRECTION                    | Tableau de bord, Prospects                     | Rappels, Mes contacts, Listes de référence                           |
| SUPERVISEUR                  | Tableau de bord, Prospects                     | Rappels, Mes contacts, Listes de référence, Exporter les dossiers    |
| COMMERCIAL, CHARGE_CLIENTELE | Appeler les prospects, Rappels promis          | Mes contacts, Prospects, Nouveau prospect                            |
| BANQUE_FINANCE               | Vue d'ensemble, Dossiers bancaires, À ouvrir   | Exporter les dossiers                                                |

| #   | P   | Zone                  | Défaut                                                                                                                          | Preuve                                                                                                                                        | Correctif                                                                    | Lignes |
| --- | --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -----: |
| N1  | P1  | Déconnexion           | Seule la session est vidée : sur un téléphone partagé, le compte suivant voit les listes en cache du précédent                  | `components/layout/user-menu.tsx:70-71`                                                                                                       | `queryClient.clear()` avant la redirection                                   |      1 |
| N2  | P1  | Fin d'appel           | Un appel lancé de la console revient sur la liste des prospects, sans message ; « Plus » s'ouvre pour la surligner              | `grand-public/appel-prospect.tsx:24-26,54-59`                                                                                                 | revenir à l'écran d'origine (`?retour=`), toast « Appel enregistré »         |    ~12 |
| N3  | P1  | Rappels               | « Rappels promis » s'ouvre sur l'onglet Représentants, notion CHUES                                                             | `routes/_panneau/grand-public/rappels.tsx:35-47`                                                                                              | `RappelsView` seul                                                           |    -12 |
| N4  | P1  | Rappels               | « Consigner l'appel » ouvre la console avec les motifs CHUES, pas l'écran d'appel Grand Public                                  | `rappels/rappels-view.tsx:170`                                                                                                                | lien vers `/grand-public/appel/{id}`                                         |     ~3 |
| N5  | P2  | « Plus »              | L'ouverture automatique (écran courant replié) est enregistrée comme préférence : le repli reste ouvert _(à voir)_              | `layout/sidebar-nav.tsx:63-66,172-175,279-281`                                                                                                | n'enregistrer que le clic sur l'intitulé                                     |     ~5 |
| N6  | P2  | Projet courant        | Le nom du projet n'apparaît qu'en pied de barre, disparaît barre réduite ; ni l'en-tête ni l'onglet du navigateur ne le nomment | `layout/sidebar-nav.tsx:222-224`, `routes/_panneau.tsx:38`                                                                                    | projet à côté du titre et dans `document.title`                              |    ~10 |
| N7  | P2  | Titres                | Activité, Campagnes, Banque et chaque campagne s'intitulent « Tableau de bord »                                                 | `nav-items.ts:657,689,708`                                                                                                                    | libellés propres                                                             |      3 |
| N8  | P2  | Changer de projet     | Sur téléphone, « Espaces » est masqué : trois touchers et un défilement ; la tuile rouvre toujours le premier écran             | `layout/topbar.tsx:64-78`, `routes/_hub/espaces.tsx:90`                                                                                       | lien Espaces visible, dernier écran retenu par projet                        |    ~15 |
| N9  | P2  | Compte, Notifications | Hors coque, la barre affiche le premier projet du rôle : la direction venue de Grand Public voit le menu Accueil                | `nav-items.ts:936-938`, `layout/sidebar-nav.tsx:49`                                                                                           | retenir la dernière coque ouverte                                            |     ~8 |
| N10 | P2  | Retour à une liste    | Ni position de défilement ni filtres conservés : retour nu, onglets sans critères                                               | `main.tsx:35-44`, `grand-public/prospect-detail.tsx:373-379`, `pilotage/onglets.tsx:41-44`                                                    | `scrollRestoration`, recherche reportée dans les liens de retour et d'onglet |     ~8 |
| N11 | P2  | Entre deux routes     | Rien ne bouge pendant ~1 s après un toucher, puis un squelette qui ne ressemble pas à la page                                   | `main.tsx:35-44`, `routes/_panneau/grand-public/console.tsx:13-24`                                                                            | barre de progression fine dans `_panneau.tsx`, `defaultPendingMs` court      |    ~15 |
| N12 | P2  | Onglets de pilotage   | Pas d'onglet Présence en Grand Public ; sur téléphone la liste d'onglets coupe le premier                                       | `pilotage/onglets.tsx:33-38,58`, `ui/tabs.tsx:28`                                                                                             | onglet Présence, `justify-start`                                             |     ~6 |
| N13 | P2  | Liste des prospects   | Le nom ouvre l'appel, jamais la fiche ; la fiche n'a pas de bouton Appeler                                                      | `grand-public/prospects-view.tsx:585-586`, `prospect-detail.tsx:384-390`                                                                      | lien vers la fiche, bouton Appeler sur la fiche                              |    ~10 |
| N14 | P2  | Raccourcis            | N et R ouvrent des routes CHUES depuis l'appel Grand Public ; la carte annonce « 1 … 9 Motif », inopérant ici                   | `console-view.tsx:1052,1063-1070,1198-1200`                                                                                                   | bornés au projet, carte filtrée                                              |    ~12 |
| N15 | P2  | Notification banque   | « Dossier complet » mène à la liste, où `ouvrir` n'est pas lu                                                                   | `internal/banque/banque_plateforme.go:216`                                                                                                    | chemin `/dossiers/nouveau?ouvrir=`                                           |      1 |
| N16 | P3  | Liens de retour       | Quatre formes : lien discret, bouton, texte grisé, composant partagé                                                            | `prospect-detail.tsx:373`, `nouveau-prospect.tsx:354`, `lots-export/lot-export-detail-view.tsx:506-512`, `bank/bank-case-detail-view.tsx:310` | `DetailBackLink` partout                                                     |    ~20 |
| N17 | P3  | Refus d'accès         | « Retour à l'accueil » mène au hub ; une campagne refusée renvoie sur `/chues`                                                  | `components/permission-denied.tsx:36,48`, `grand-public/campagnes/$id.tsx:9-12`                                                               | « Tous les espaces », `guardRoles`                                           |     ~8 |
| N18 | P3  | Tiroir mobile         | Ne se ferme pas au retour du navigateur ; « Plus » s'y referme puis se rouvre à chaque ouverture _(à voir)_                     | `layout/topbar.tsx:47-49`, `layout/sidebar-nav.tsx:62-66`                                                                                     | fermer sur changement de route, état initial calculé                         |     ~6 |
| N19 | P3  | Clavier               | Pas de lien d'évitement vers `#contenu-principal` ; deux `h1` par écran                                                         | `routes/_panneau.tsx:49`, `layout/topbar.tsx`, `prospects-view.tsx:199`                                                                       | lien d'évitement, titre de page en `h2`                                      |     ~8 |
| N20 | P3  | Barre réduite         | Infobulles natives `title` seulement ; bouton de réduction de 24 px                                                             | `layout/sidebar-nav.tsx:320`, `layout/sidebar-shell.tsx:58`                                                                                   | cible de 44 px                                                               |     ~2 |

## 5. Listes, filtres et actions de ligne

| #   | P   | Écran                                               | Défaut                                                                                                | Preuve                                                                                                                                                                                                      | Correctif                                                  |        Lignes |
| --- | --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------: |
| L1  | P1  | Console                                             | Le filtre Campagne trie dans le navigateur 20 fiches : les attributions au-delà sont invisibles       | `lib/data/prospects.ts:57,63-70`                                                                                                                                                                            | filtre d'attribution côté serveur, pagination S7           |  ~30 + Go ~10 |
| L2  | P2  | Rappels, Mes contacts, Campagnes, Activité, Console | Filtres et page en état local : perdus au retour et au rechargement ; deux hooks d'URL concurrents    | `rappels-view.tsx:66-67`, `mes-contacts-view.tsx:88-89`, `lots-export-view.tsx:69-71`, `supervision/activity-view.tsx:113-119`, `filters/use-url-filters.ts:48` contre `filters/use-prospect-filters.ts:38` | `useUrlFilters` partout                                    | ~15 par écran |
| L3  | P2  | Tableaux, téléphone                                 | Prospects en 9 colonnes, rappels en 6, défilement horizontal doublé                                   | `prospects-view.tsx:439-473`, `rappels-view.tsx:125-137`                                                                                                                                                    | colonnes secondaires masquées sous `md`, un seul conteneur |           ~20 |
| L4  | P2  | Rappels                                             | La colonne Prospect montre un numéro et un code, pas de nom ni de lien vers la fiche                  | `rappels-view.tsx:141-145`                                                                                                                                                                                  | nom, lien, S6                                              |           ~10 |
| L5  | P2  | Liste, Rappels                                      | Revenir sur l'onglet après un appel ne recharge rien                                                  | `main.tsx:27`                                                                                                                                                                                               | `refetchOnWindowFocus` sur ces deux requêtes               |            ~4 |
| L6  | P2  | Fiches d'une campagne                               | La sélection se vide en changeant de page ; « tout sélectionner » ne vaut que pour la page            | `lots-export/lot-export-fiches.tsx:252,365-366`                                                                                                                                                             | sélection conservée, « Sélectionner les N fiches »         |           ~30 |
| L7  | P2  | Dossiers bancaires                                  | La vue tableau, par défaut sur poste, n'a ni recherche ni filtres ; en erreur elle rend un écran vide | `bank/bank-dossiers.tsx:16,57`, `bank/bank-kanban.tsx:96,111`                                                                                                                                               | `QueryErrorState` ; la barre commune est au §9             |            ~5 |
| L8  | P2  | Vue d'ensemble banque                               | « En retard » et « Complets non ouverts » ne sont pas cliquables, les graphiques le sont              | `bank/bank-pilotage.tsx:38-51`                                                                                                                                                                              | liens vers la liste filtrée                                |           ~15 |
| L9  | P3  | Filtres, téléphone                                  | Replié, le panneau n'affiche pas les filtres actifs ; largeurs fixes qui débordent                    | `prospects-view.tsx:225-240`, `rappels-view.tsx:219`, `filters/search-field.tsx:27`                                                                                                                         | puces des filtres actifs, largeurs fluides                 |           ~15 |
| L10 | P3  | Tableaux                                            | Troncatures sans texte complet au survol ; en-tête non collant                                        | `prospects-view.tsx:607,621,634`, `components/ui/table.tsx:22-30`                                                                                                                                           | `title` sur les cellules tronquées, en-tête collant        |           ~15 |
| L11 | P3  | Activité                                            | Une erreur de chargement rend `null`                                                                  | `supervision/activity-view.tsx:525`                                                                                                                                                                         | `QueryErrorState`                                          |            ~3 |

## 6. Confirmations et retours d'information

| #   | P   | Action                         | Défaut                                                                                                                       | Preuve                                                                                                              | Correctif                                                                | Lignes |
| --- | --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -----: |
| C1  | P1  | Annuler un rappel              | Un toucher supprime, sans confirmation ni retour arrière ; « Annuler » se lit « fermer » ; un envoi grise toutes les lignes  | `rappels/rappels-view.tsx:90,176-185`                                                                               | « Annuler le rappel », confirmation nommant la fiche, ligne seule grisée |    ~20 |
| C2  | P1  | Quitter un appel               | « Revenir à la liste » et « Annuler » jettent une saisie en cours                                                            | `console-view.tsx:1153,1263,1352`                                                                                   | confirmation quand `saisieEnCours`                                       |    ~10 |
| C3  | P1  | Pièces et courriels du dossier | Une panne de lecture s'affiche « Aucune pièce déposée » / « Aucun courriel envoyé »                                          | `bank/bank-pieces.tsx:55-61`, `bank/bank-courriels.tsx:71-79`                                                       | `QueryErrorState` avec réessai                                           |    ~10 |
| C4  | P2  | Disposition du tableau de bord | Enregistrer, définir par défaut, réinitialiser : aucun message d'échec, ni de succès pour « par défaut »                     | `chiffres/vue.tsx:327-350`                                                                                          | `toastApiError`, S10 en filet                                            |    ~12 |
| C5  | P2  | Glisser un dossier             | Un recul d'étape s'enregistre sans confirmation                                                                              | `bank/bank-kanban.tsx:57-73`                                                                                        | confirmer un recul                                                       |    ~10 |
| C6  | P2  | Réaffecter des fiches          | Toast avec « Télécharger » et dialogue proposant le même PDF, en même temps                                                  | `lots-export/lot-export-fiches.tsx:122-127,215-222`                                                                 | garder le dialogue                                                       |     ~5 |
| C7  | P3  | Messages de succès             | « Campagne supprimée », « Fiche modifiée », « Conversion confirmée » sans nommer l'objet ; renommer une campagne ne dit rien | `lots-export-view.tsx:79`, `prospect-form.tsx:631`, `prospect-detail.tsx:342`, `lot-export-detail-view.tsx:598-602` | nommer l'objet, toast au renommage                                       |    ~10 |
| C8  | P3  | Pause d'une campagne           | Retire les fiches de toutes les consoles en un clic                                                                          | `lots-export/lot-export-detail-view.tsx:572-587`                                                                    | confirmation                                                             |     ~8 |
| C9  | P3  | Choix Joignable / Injoignable  | Aucun bouton pour revenir sur le choix, sauf Échap ; le focus ne passe pas à la liste des statuts                            | `console-view.tsx:669,1005-1008`                                                                                    | « Changer de réponse », focus sur la liste                               |    ~10 |

## 7. Vérification

Aucun test unitaire. Les assertions rejoignent les parcours métier existants,
chacune cassée une fois sur l'ancien code avant d'être gardée :

- `e2e/v1/grand-public-console.spec.ts` : Échap dans un champ, Entrée sur un
  bouton, statut qui garde le dossier, retour à la console après appel (F3, F5,
  S5, N2) ;
- `e2e/v1/grand-public-saisie.spec.ts` : fermer un dialogue modifié, erreur
  WhatsApp visible (F1, F4) ;
- `e2e/v1/grand-public-rappels.spec.ts` : onglet unique, confirmation
  d'annulation, lien vers l'écran d'appel (N3, N4, C1) ;
- un passage à 375 px en COMMERCIAL sur l'écran d'appel et le nouveau prospect
  (F2, S1), le seul trou de couverture qui touche le travail quotidien ;
- `e2e/v1/transversal-*` : déconnexion puis connexion d'un autre compte sans
  données résiduelles (N1).

## 8. Ordre proposé

| Lot | Contenu                                                                              | Taille                     |
| --- | ------------------------------------------------------------------------------------ | -------------------------- |
| 0   | Captures par rôle, poste et 375 px ; les lignes _(à voir)_ sont tranchées            | 0 ligne                    |
| 1   | Perte de travail et de données : N1, F1 à F5, S1 (garde seule), S5, N2 à N4, C1 à C3 | ~150 lignes                |
| 2   | Socle : S1 complet, S2, S3, S4, S6 à S11, puis leur adoption écran par écran         | ~200 lignes, ~150 retirées |
| 3   | Formulaires P2 et P3 (F6 à F19), après le nettoyage de `prospect-form.tsx`           | ~220 lignes, ~250 retirées |
| 4   | Navigation P2 et P3 (N5 à N20)                                                       | ~150 lignes                |
| 5   | Listes et retours (L1 à L11, C4 à C9)                                                | ~200 lignes + Go ~10       |

Chaque lot se livre seul. Le lot 1 ne dépend d'aucun autre.

Le lot 1 est livré sur `feat/amelioration-ux` : `ux-grand-public-lot1.md`.
Le lot 2 aussi, sauf la pagination des campagnes : `ux-grand-public-lot2.md`.

## 9. Demande l'accord écrit du propriétaire (refonte d'écran)

Chiffrés pour arbitrer, **non planifiés**.

| #   | Changement                                                                                                        | Lignes |
| --- | ----------------------------------------------------------------------------------------------------------------- | -----: |
| A1  | Lignes en cartes sous `md` pour prospects, rappels, mes contacts                                                  |    ~60 |
| A2  | Menu d'actions de ligne dans la liste Grand Public : fiche, appeler, réaffecter                                   |    ~40 |
| A3  | Pied d'actions collant sur l'écran d'appel en téléphone                                                           |    ~20 |
| A4  | Barre de recherche, filtres et export commune au tableau et à la liste des dossiers                               |    ~40 |
| A5  | Compteur de rappels en retard sur l'entrée « Rappels promis »                                                     |    ~20 |
| A6  | Couleur ou pastille propre à Grand Public dans la barre                                                           |    ~15 |
| A7  | Connexion : aller droit à l'espace quand un seul est ouvert (contraire au choix documenté `nav-items.ts:906-916`) |    ~10 |
| A8  | Tri par colonne sur la liste des prospects                                                                        |    ~20 |
| A9  | Répartition par téléconseiller affichée avant de créer une campagne                                               |    ~50 |

## 10. Hors de ce plan : décisions de rôle

Relevées au passage, elles changent qui voit quoi plutôt que la manière
d'interagir. Chacune tient en quelques lignes une fois tranchée.

- Le chargé de clientèle n'a ni Modifier ni Confirmer la conversion, que l'API
  lui ouvre (`routes/_panneau/grand-public/$id.tsx:60`).
- Le superviseur peut créer un prospect ; GP-09 et GP-20 disent le contraire.
- Le chargé de clientèle reçoit le filtre Téléconseiller des rappels
  (`grand-public/rappels.tsx:32`).
- COMMERCIAL et CHARGE_CLIENTELE n'ont aucune boîte de réception : leurs
  notifications visaient l'application mobile abandonnée (`nav-items.ts:47-57`).
- Direction et supervision : qui exporte les dossiers, qui en voit la liste.

Idées écartées, une ligne chacune : brouillon automatique du nouveau prospect,
filtres enregistrés, palette de commandes, glisser pour fermer le tiroir,
virtualisation des listes, refonte de `console-view.tsx` (1 480 lignes) ou de
`prospect-form.tsx` (1 328 lignes).
