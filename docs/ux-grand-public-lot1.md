# Grand Public : lot 1 du plan d'interactions, livré

Travail du 12 septembre 2026 sur la branche `feat/amelioration-ux`, partie de
`dev` (`1ebeeb6a`). Le plan qui chiffre ce lot est `ux-grand-public.md` (§8,
lot 1) ; ce document dit ce qui existe désormais dans le code et ce qui reste
à vérifier.

Le lot 1 visait une seule chose : **qu'aucun geste courant ne jette du travail
sans le dire**. Aucun écran n'a été redessiné.

## 1. Avant le lot : une branche qui part de `dev` et porte Grand Public

| Commit     | Ce qu'il fait                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `95c985fb` | Fusion de `feat/grand-public-demandes-prospect`, douze commits jamais poussés compris. Un conflit dans `internal/prospects/prospects.go` : `dev` écrit la modification d'une fiche et sa trace d'audit dans la même transaction, la branche Grand Public enregistre les champs ajoutés par l'administrateur. Les deux sont gardés. |
| `c23a3a36` | `cpi-go.exe` (60 Mo), `openapi.err` et `.claude/launch.json` sortent du suivi et entrent dans `.gitignore`. Ils restent sur le poste. Le binaire reste dans l'historique de la branche Grand Public.                                                                                                                               |
| `9c816f52` | `internal/imports/imports_adaptateurs.go` passait le plafond de 1 500 lignes (1 582). L'adaptateur prospects part tel quel dans `imports_adaptateurs_prospects.go` (1 328 + 262 lignes).                                                                                                                                           |

Le code généré local (`db/`, `openapi.json`, types du panneau) a été régénéré :
il datait d'avant l'écran Exploitation de `dev` et cassait la compilation.

## 2. Ce qui change pour l'utilisateur

### Écran d'appel (téléconseiller, superviseur, administrateur)

| Geste                                         | Avant                                                   | Maintenant                                                      |
| --------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Échap tapé dans un champ                      | effaçait statut, commentaire et dossier d'adhésion      | quitte le champ, rien n'est effacé                              |
| Échap hors d'un champ, saisie en cours        | effaçait tout, sans retour possible                     | efface, et le message « Saisie effacée » propose **Rétablir**   |
| Entrée dans le commentaire, sur téléphone     | envoyait l'appel ; impossible de passer à la ligne      | passe à la ligne ; l'envoi se fait par le bouton                |
| Entrée sur un bouton ou une option focalisés  | validait l'écran au lieu du bouton                      | active le bouton                                                |
| Choisir un statut qui planifie un rappel      | effaçait le dossier d'adhésion rempli                   | garde le dossier, comme le bouton « À rappeler »                |
| « Revenir à la liste » pendant une saisie     | abandonnait l'appel                                     | demande « Quitter sans enregistrer l'appel ? »                  |
| Enregistrer un appel ouvert depuis la console | ramenait à la liste des prospects, sans message         | revient à la console, avec « Appel enregistré pour X »          |
| Enregistrer un appel ouvert depuis un rappel  | l'appel s'ouvrait dans la console avec les motifs CHUES | s'ouvre sur l'écran d'appel Grand Public et revient aux rappels |

### Formulaires de fiche

| Geste                                                                       | Avant                                               | Maintenant                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Échap, clic à côté ou « Annuler » dans **Nouveau prospect** (liste et page) | la saisie disparaissait                             | « Abandonner la saisie ? » si quelque chose a été saisi     |
| Les mêmes gestes dans **Modifier la fiche**                                 | la saisie disparaissait                             | même confirmation, seulement si un champ a changé           |
| WhatsApp, numéro du relais ou ancienneté illisibles, à la modification      | partaient vides et **effaçaient** la valeur en base | l'enregistrement s'arrête, l'erreur s'affiche sous le champ |

### Rappels promis

| Geste                     | Avant                                                           | Maintenant                                                                               |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ouvrir « Rappels promis » | onglet Représentants d'abord, notion CHUES non bornée au projet | la liste des rappels de prospects, directement                                           |
| Annuler un rappel         | un toucher sur « Annuler », sans retour possible                | « Annuler le rappel », puis une confirmation qui nomme la fiche, l'échéance et le numéro |

L'annulation confirmée vaut aussi pour CHUES, qui partage l'écran.

### Tous les rôles

| Geste                                   | Avant                                                            | Maintenant                         |
| --------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| Se déconnecter sur un téléphone partagé | le compte suivant lisait les listes encore en cache du précédent | le cache est vidé à la déconnexion |

### Banque & Finance, fiche d'un dossier

| Situation                       | Avant                                     | Maintenant                              |
| ------------------------------- | ----------------------------------------- | --------------------------------------- |
| Plateforme injoignable (pièces) | « Aucune pièce déposée »                  | le message d'erreur, avec « Réessayer » |
| Lecture des courriels en échec  | « Aucun courriel envoyé pour ce dossier » | le message d'erreur, avec « Réessayer » |

## 3. Comment c'est construit

- **`useGardeSaisie(fermer)`**, dans `web/src/components/ui/confirm-dialog.tsx`.
  Trois appelants : la page Nouveau prospect, la boîte Nouveau prospect de la
  liste, la boîte Modifier la fiche. Le formulaire signale s'il est modifié
  (`onModifie`) ; la boîte demande confirmation avant de se refermer. La
  confirmation se rend dans la boîte gardée, pour ne pas compter comme un clic
  à l'extérieur.
- **`ConfirmDialog`** accepte `cancelLabel` : « Garder le rappel » face à
  « Annuler le rappel », « Rester sur l'appel » face à « Quitter ».
- **`useShortcuts`** (`web/src/components/console/use-shortcuts.ts`) : dans un
  champ, Échap ne fait que quitter le champ ; Entrée est ignorée sur un
  bouton, un lien, une option, un onglet ou une entrée de menu.
- **Retour après l'appel** : `/grand-public/appel/{id}?retour=console` ou
  `?retour=rappels`. Sans paramètre, la liste des prospects, comme avant.
- **Téléphone** : `matchMedia('(pointer: coarse)')` décide du rôle d'Entrée
  dans le commentaire.

| Commit     | Portée                                                         |     Lignes |
| ---------- | -------------------------------------------------------------- | ---------: |
| `bfe73283` | écran d'appel, formulaires, garde de saisie                    | +256 / -29 |
| `7086d7e3` | rappels Grand Public, annulation confirmée, trois parcours e2e |  +72 / -27 |
| `1fbdfbf8` | cache vidé à la déconnexion                                    |         +2 |
| `88a95e8c` | pièces et courriels en panne                                   |   +27 / -3 |
| `12f4f4cd` | formatage de `console-view.tsx`, arrivé non formaté            |    +6 / -9 |

Total du lot : **+357 / -59 lignes, 16 fichiers**. Le plan en annonçait ~150 :
la garde de saisie branchée sur trois formulaires et la confirmation
d'annulation ont coûté le double de l'estimation.

## 4. Vérifications

| Contrôle                                      | Résultat                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` du panneau                     | sans erreur                                                                                         |
| `oxlint` du panneau                           | aucune erreur dans les fichiers touchés ; 9 erreurs existaient déjà sur `dev`, fichiers non touchés |
| Prettier, fichiers touchés                    | formatés (contrôlé en fins de ligne LF, le poste extrait en CRLF)                                   |
| `tools/dev/plafonds.sh`                       | sans erreur                                                                                         |
| `go build ./...`, `go vet`, gofumpt (imports) | sans erreur                                                                                         |
| Parcours Playwright                           | **non joués**                                                                                       |
| Tests d'intégration Go                        | **non joués**                                                                                       |

**Aucun parcours n'a tourné.** Les tests d'intégration écrivent et suppriment
dans la base désignée par `TEST_DATABASE_URL`, et la seule configurée sur ce
poste est la base de développement de `.env`. Les trois parcours de rappels
(`e2e/rappels.spec.ts`, `e2e/v1/chues-rappels.commercial.spec.ts`,
`e2e/v1/grand-public-rappels.spec.ts`) ont été ajustés au nouveau geste
d'annulation, sans être joués. Aucun parcours nouveau n'a été écrit : la règle
du dépôt veut qu'on le voie échouer avant de le garder.

Déjà cassé sur cette branche, hors du lot : `tsc` du dossier `e2e` échoue sur
`e2e/convertir.spec.ts` (six erreurs), fichier modifié par la branche Grand
Public.

## 5. Limites connues, à voir à l'écran

- **Erreurs hors de vue.** Une erreur WhatsApp, relais ou ancienneté s'affiche
  sous son champ, mais rien ne fait défiler jusqu'à elle : dans la boîte
  Modifier, l'enregistrement peut sembler ne rien faire. Corrigé par S3 au
  lot 2 (focus sur la première erreur).
- **Échap dans l'échéance.** Depuis le champ « Autre échéance », il faut deux
  Échap pour refermer l'échéance : le premier quitte le champ.
- **Faux « modifié ».** Dans Modifier la fiche, changer la situation puis
  revenir à la première peut encore déclencher la confirmation.
- **Quitter un appel** laisse la fiche ouverte côté serveur ; le brouillon
  enregistré en continu y reste, et la console la rouvre à la visite suivante.
  La libérer par le téléconseiller demande une garde serveur : hors de ce plan,
  à arbitrer.
- **Ordinateur tactile.** Un écran dont le pointeur principal est tactile
  traite Entrée comme un téléphone.
- **Direction.** Le lien « Consigner l'appel » d'un rappel mène à un écran que
  la garde de route refuse à la direction, comme avant ce lot.

## 6. Suite

1. **Lot 0 du plan** : passer chaque rôle sur poste et à 375 px, sur les
   gestes du §2, et jouer les parcours de rappels contre une base de test
   jetable.
2. **Lot 2** : le socle partagé (S1 à S11), en commençant par S3 pour lever la
   première limite du §5.
