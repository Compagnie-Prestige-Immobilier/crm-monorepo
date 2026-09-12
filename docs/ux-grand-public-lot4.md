# Grand Public : lot 4 du plan d'interactions, livré

Travail du 12 septembre 2026 sur la branche `feat/amelioration-ux`, à la suite
des lots 1 à 3. Le plan est `ux-grand-public.md`, §4 (barre latérale, en-tête
et navigation).

Le lot 4 corrige **ce qui fait perdre le fil entre deux écrans** : savoir où
l'on est, retrouver ce qu'on a quitté, atteindre la fiche et l'appel. Aucun
écran n'a été redessiné.

## 1. Ce qui change pour l'utilisateur

### Savoir où l'on est

| Situation                               | Avant                                               | Maintenant                                        |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| Onglet du navigateur                    | « Prospects · CPI GO », sans projet                 | « Prospects · Projet Grand Public · CPI GO »      |
| Barre supérieure                        | le titre seul                                       | le projet en petites capitales au-dessus du titre |
| Activité, Campagnes, Banque du pilotage | toutes titrées « Tableau de bord »                  | « Activité », « Campagnes », « Banque »           |
| Compte, Notifications                   | barre latérale du premier projet du rôle (Accueil…) | barre du dernier projet ouvert dans l'onglet      |
| Pilotage Grand Public                   | pas d'onglet Présence                               | « Présence », comme CHUES                         |
| Onglets du pilotage sur téléphone       | le premier onglet coupé                             | la liste part du premier onglet et défile         |

### Retrouver ce qu'on a quitté

| Situation                                   | Avant                                               | Maintenant                                                         |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Revenir d'une fiche à la liste Grand Public | liste sans filtres, page 1                          | mêmes filtres, même page                                           |
| Revenir en arrière dans une liste           | retour en haut de page                              | position de défilement restaurée                                   |
| Ouvrir un projet depuis le hub              | toujours son premier écran                          | le dernier écran visité dans ce projet                             |
| « Plus » dans la barre latérale             | restait ouvert après être passé sur un écran replié | ne retient que l'ouverture ou la fermeture faite par l'utilisateur |
| Tiroir de navigation sur téléphone          | restait ouvert après le retour du navigateur        | se ferme à tout changement d'écran                                 |

### Atteindre la fiche, l'appel, le bon écran

| Situation                                    | Avant                                                               | Maintenant                                           |
| -------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Nom d'une ligne de la liste Grand Public     | ouvrait l'appel ; la fiche n'était atteignable que par Mes contacts | ouvre la fiche ; « Appeler » reste sur la ligne      |
| Fiche Grand Public                           | un lien `tel:` seulement                                            | bouton « Appeler » vers l'écran d'appel              |
| Notification « Dossier complet »             | liste des dossiers, rien de mis en avant                            | écran « À ouvrir » du dossier                        |
| Touches N et R pendant un appel Grand Public | ouvraient des écrans CHUES                                          | sans effet ; inchangées sur CHUES                    |
| Page refusée ou introuvable                  | « Retour à l'accueil », qui menait au hub                           | « Tous les espaces » (« Se connecter » sans session) |
| Campagne Grand Public d'un rôle refusé       | renvoi silencieux vers CHUES                                        | écran de refus, comme les autres routes              |

### Clavier, attente, tactile

| Situation                           | Avant                                      | Maintenant                                                                |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Changer d'écran                     | rien ne bougeait pendant le chargement     | fine barre en haut après 150 ms, sans pulsation si mouvement réduit       |
| Clavier, première tabulation        | la barre latérale entière avant le contenu | « Aller au contenu »                                                      |
| Liens de retour                     | quatre styles                              | un seul (`DetailBackLink`) ; « Revenir à la liste » garde sa confirmation |
| Bouton qui replie la barre latérale | cible de 24 px                             | 44 px, même apparence                                                     |

« Appeler » sur la ligne et sur la fiche suit la garde de l'écran d'appel :
ADMIN, SUPERVISEUR, COMMERCIAL, CHARGE_CLIENTELE ; la direction ne le voit pas.

## 2. Comment c'est construit

- **Titres** : les libellés des entrées cachées de `nav-items.ts` changent, la
  surbrillance (`onglet`) ne bouge pas. Le titre d'onglet est assemblé dans
  `routes/_panneau.tsx` : page, projet, « CPI GO ».
- **Mémoire de navigation**, en `sessionStorage`, dans un `try/catch` :
  - la chaîne de recherche de la liste Grand Public, posée au clic sur une
    fiche (`prospects-view.tsx`) ;
  - le dernier projet ouvert dans l'onglet, et le dernier écran de chaque
    projet rangé **par compte** (`nav-items.ts`), pour qu'un téléphone partagé
    ne rouvre pas l'écran du précédent.

  Seuls des chemins et des critères d'URL y sont gardés, aucune donnée de
  prospect. `AGENTS.md` écarte le stockage local des données métier ; cet usage
  est à confirmer par le propriétaire.

- **Barre de chargement** : `useRouterState` sur le statut `pending`.
- **Lien d'évitement** : il place le focus sur `main` (`tabIndex={-1}`) sans
  changer l'URL ; une ancre simple aurait été traitée comme une navigation.

## 3. Ce qui n'a pas été fait

- **« Espaces » dans la barre supérieure sur téléphone** : un cinquième bouton
  laissait environ 55 px au titre à 375 px. Le lien « Tous les espaces » reste
  en bas du tiroir, visible sans défiler.
- **Filtres portés d'un onglet de pilotage à l'autre** : aucun tableau de bord
  ne garde sa période dans l'URL ; il n'y a rien à reporter.
- **Titre de barre supérieure en `h1` doublé par celui de la page** : une
  trentaine de parcours lisent ce `h1`.
- **« Revenir à la liste » de l'écran d'appel et de Nouveau prospect** reste un
  bouton : un lien naviguerait avant la confirmation de sortie.

## 4. Commits

| Commit     | Portée                                                             |      Lignes |
| ---------- | ------------------------------------------------------------------ | ----------: |
| `407ba1cb` | la liste ouvre la fiche, la fiche propose l'appel, retour filtré   |   +92 / -28 |
| `4d9a121c` | un style de lien de retour, N et R bornés à CHUES                  |    +8 / -13 |
| `649a6b40` | notification « Dossier complet » (Go)                              |     +1 / -1 |
| `1f94b8cd` | onglet Présence Grand Public, onglets alignés                      |     +4 / -3 |
| `2df00a5d` | coque : titres, projet, mémoire de navigation, chargement, clavier | +195 / -109 |

Total du lot : **+300 / -154 lignes**.

## 5. Vérifications

| Contrôle                       | Résultat                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `tsc --noEmit` du panneau      | sans erreur                                                                      |
| `oxlint` du panneau            | aucune erreur dans les fichiers touchés ; les 9 erreurs connues de `dev` restent |
| `tsc` du dossier `e2e`         | les 6 erreurs connues de `e2e/convertir.spec.ts`                                 |
| `go build ./...`, `go vet`     | sans erreur                                                                      |
| Prettier (contenu en LF)       | fichiers touchés formatés                                                        |
| `tools/dev/plafonds.sh`        | sans erreur                                                                      |
| Tiret cadratin, « commercial » | absents des lignes ajoutées                                                      |
| Parcours Playwright, tests Go  | **non joués** : pas de base de test jetable sur ce poste                         |

Parcours ajustés sans être joués : les titres attendus de seize fichiers v1 et
de `parite-banque.spec.ts` (nouveau format, « Tous les espaces »),
`listes-et-fiches.spec.ts` et GP-12 (le nom ouvre la fiche, « Appeler »
l'appel), GP-22 (bouton « Appeler » de la fiche). Environ trente-cinq titres v1
étaient déjà faux avant ce lot (« Téléconseillers », « Supervision », « Lots
d'export »…) et restent en l'état. La suite v1 n'est pas jouée par `make e2e`.

## 6. À voir à l'écran, poste et 375 px

- **Barre supérieure** : hauteur avec la ligne du projet, à 375 px et à 200 %
  de zoom.
- **Liste Grand Public** : « Appeler » tient à côté d'un nom long à 375 px ;
  filtrer, passer en page 2, ouvrir une fiche, revenir : mêmes filtres.
- **Fiche** : « Appeler » peut apparaître un instant après le reste, le temps de
  relire le compte.
- **Hub** : une tuile rouvre un écran profond ; vérifier que ce n'est pas
  déroutant pour l'accueil.
- **Présence Grand Public** : sous `?volet=comptes`, le titre dit encore
  « Activité » ; la liste des fiches ouvertes n'est pas bornée au projet, comme
  sur CHUES.
- **« Plus »** : reste fermé après rechargement quand seul le code l'avait
  ouvert, garde l'état choisi après un clic.
- **Barre de chargement** : couleur sous la palette CHUES ; pas d'éclair au
  lien « Aller au contenu ».

## 7. Suite

1. **Lot 0** : les quatre lots se vérifient à l'écran, rôle par rôle, et les
   parcours se jouent contre une base de test jetable. Bloqué : la base de
   `.env` (port 5434) ne répond pas, et le serveur Postgres du port 5432 exige
   un mot de passe.
2. **Lot 5 du plan** : listes et retours d'information (L1 à L11, C4 à C9).
