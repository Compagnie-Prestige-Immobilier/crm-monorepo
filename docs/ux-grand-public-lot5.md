# Grand Public : lot 5 du plan d'interactions, livré

Travail du 12 septembre 2026 sur la branche `feat/amelioration-ux`, dernier lot
du plan `ux-grand-public.md` (§5 listes et filtres, §6 confirmations et retours
d'information). Les lots précédents sont décrits dans `ux-grand-public-lot1.md`
à `ux-grand-public-lot4.md`.

Le lot 5 corrige **les listes qui perdent ce qu'on y a réglé** et **les gestes
risqués qui ne demandent rien**. Aucun écran n'a été redessiné.

## 1. Ce qui change pour l'utilisateur

### Listes et filtres

| Situation                                         | Avant                                                                               | Maintenant                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Fiches de campagne sur l'écran d'appel            | 20 fiches lues, filtrées dans le navigateur : les suivantes n'apparaissaient jamais | le serveur ne rend que les fiches confiées, total juste    |
| Rappels, Mes contacts, Campagnes, Activité        | onglet, filtres, page et période perdus au retour ou au rechargement                | gardés dans l'URL                                          |
| Colonne Prospect des rappels                      | un numéro et un code de fiche                                                       | le nom, lien vers la fiche, puis le numéro                 |
| Liste des prospects sur téléphone                 | 9 colonnes, deux cadres qui défilent                                                | Nom et Statut, un seul cadre                               |
| Rappels sur téléphone                             | 6 colonnes                                                                          | Prospect, Échéance, actions                                |
| Filtres repliés                                   | rien ne disait qu'un filtre était actif                                             | puces effaçables et « Tout effacer »                       |
| Champs de filtre sur téléphone                    | largeurs fixes qui débordaient                                                      | pleine largeur sous 640 px                                 |
| Cellule tronquée                                  | texte coupé sans moyen de le lire                                                   | texte complet au survol                                    |
| Fiches d'une campagne, sélection pour réattribuer | vidée au changement de page ou de filtre                                            | gardée ; « Vider la sélection » ; case d'en-tête partielle |
| Tableau des dossiers bancaires en panne           | écran vide                                                                          | message d'erreur et « Réessayer »                          |
| Tuile « Complets non ouverts »                    | ne menait nulle part                                                                | ouvre « À ouvrir »                                         |

### Confirmations et messages

| Situation                                    | Avant                                                                   | Maintenant                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Glisser un dossier vers une étape antérieure | enregistré aussitôt                                                     | « Ramener DOS-… de « A » à « B » ? » ; en avant, toujours immédiat |
| Mettre une campagne en pause                 | un clic retirait les fiches de toutes les consoles                      | confirmation nommant la campagne ; reprendre reste d'un clic       |
| Renommer une campagne                        | aucun message ; ni Entrée ni Échap                                      | « Campagne renommée « X ». » ; Entrée valide, Échap annule         |
| Messages de succès                           | « Campagne supprimée. », « Fiche modifiée. », « Conversion confirmée. » | nomment la campagne ou le prospect                                 |
| Réattribuer des fiches                       | un message avec « Télécharger » et une boîte au même PDF                | la boîte seule, message simple                                     |
| Disposition du tableau de bord               | « Définir par défaut » et « Réinitialiser » sans retour                 | message de succès                                                  |
| Appel Grand Public, réponse donnée           | seul Échap permettait de revenir sur Joignable / Injoignable            | « Changer de réponse », avec « Rétablir » ; focus sur le statut    |

## 2. Comment c'est construit

- **Filtre serveur** : `attribuees=true` sur `GET /api/v1/prospects`. La clause
  reprend l'`EXISTS` sur `lot_export_items."assigneeId"` de la portée, campagnes
  en pause exclues, dans la liste et dans le comptage
  (`sql/queries/prospects.sql`). Le contrat `web/contrat-v1.openapi.json`
  déclare ce paramètre et `prospectName` des rappels, que l'API rendait déjà.
- **Filtres dans l'URL** : le crochet existant `useUrlFilters`, comme sur la
  liste des prospects ; les valeurs par défaut n'apparaissent pas dans l'URL.
- **Colonnes masquées** : `hidden md:table-cell` sur l'en-tête et les cellules
  ensemble.
- **Recul d'un dossier** : `decider` du tableau compare la position des étapes ;
  un recul ouvre un `ConfirmDialog`.

## 3. Ce qui n'a pas été fait

- **Tuile « En retard » cliquable** : aucun filtre de la liste ne compte le
  retard comme le serveur (heure exacte à sept jours, contre un filtre au jour) ;
  la liste afficherait un autre nombre que la tuile.
- **« Sélectionner les N fiches » d'une campagne** : l'API de réattribution
  n'accepte qu'une liste de positions.
- **En-tête de tableau collant** : le cadre qui défile horizontalement retient
  aussi le défilement vertical.
- **Pagination de l'écran d'appel** : le filtre est juste, mais l'annuaire
  n'affiche toujours que ses 20 premières fiches, sans pages.
- **`fetchProspectsDeCampagne`** (`lib/data/grand-public.ts`) filtre encore dans
  le navigateur ; il peut passer à `attribuees=true`.
- **Onglets Représentants / Prospects de `/chues/rappels`** : hors URL, la page
  rouvre sur Représentants.

## 4. Commits

| Commit     | Portée                                                        |      Lignes |
| ---------- | ------------------------------------------------------------- | ----------: |
| `f3b70802` | campagnes, banque, activité : état dans l'URL, confirmations  | +286 / -114 |
| `6929b5f2` | filtre des fiches de campagne côté serveur (SQL, Go, contrat) |   +22 / -13 |
| `bc5dd4c5` | rappels et listes sur téléphone, « Changer de réponse »       |  +291 / -70 |

Total du lot : **+599 / -197 lignes**.

## 5. Vérifications

| Contrôle                      | Résultat                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `go build ./...`, `go vet`    | sans erreur ; `prospects.go` à 1 473 lignes                                      |
| `tsc --noEmit` du panneau     | sans erreur                                                                      |
| `oxlint` du panneau           | aucune erreur dans les fichiers touchés ; les 9 erreurs connues de `dev` restent |
| `tsc` du dossier `e2e`        | les 6 erreurs connues de `e2e/convertir.spec.ts`                                 |
| Prettier (contenu en LF)      | fichiers touchés formatés                                                        |
| `tools/dev/plafonds.sh`       | sans erreur ; `console-view.tsx` à 1 759 lignes                                  |
| Parcours Playwright, tests Go | **non joués** : pas de base de test jetable sur ce poste                         |

Parcours ajustés sans être joués : GP-11 (colonnes secondaires masquées à
375 px), `parite-imports.spec.ts` (confirmation de la pause). Aucun test
d'intégration ne couvrait `mesFiches` ; `attribuees` n'en a pas non plus.

## 6. À voir à l'écran, poste et 375 px

- **Écran d'appel** : un téléconseiller à qui une campagne confie plus de 20
  fiches les voit toutes sous « Campagne » en cherchant.
- **Rappels** (`/grand-public/rappels` et `/chues/rappels`) : changer d'onglet et
  de téléconseiller, recharger, revenir ; trois colonnes à 375 px, le nom ouvre
  la fiche.
- **Campagnes et Activité** : filtres, page 2, ouvrir une campagne, revenir,
  recharger.
- **Fiches de campagne** : cocher en page 1, passer en page 2, le compte reste ;
  la barre à trois boutons passe à la ligne à 375 px.
- **Tableau des dossiers** : glisser en avant (immédiat), en arrière (boîte ;
  annuler remet la carte).
- **Appel Grand Public** : après Joignable, Entrée sur le statut ouvre la liste
  au lieu de « Continuer » ; « Changer de réponse » puis « Rétablir ».
- **Champ de recherche** partagé : mise en page sur les autres écrans (filtres
  bancaires, registre, listes de référence) à 320 et 375 px.
