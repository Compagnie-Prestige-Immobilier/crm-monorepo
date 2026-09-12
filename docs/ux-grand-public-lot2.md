# Grand Public : lot 2 du plan d'interactions, livré

Travail du 12 septembre 2026 sur la branche `feat/amelioration-ux`, à la suite
du lot 1 (`ux-grand-public-lot1.md`). Le plan est `ux-grand-public.md`, §2
(socle partagé) et quelques lignes de §5 et §6.

Le lot 2 corrige les **composants partagés** : un correctif sert tous les écrans
qui les utilisent, en Grand Public comme en CHUES. Aucun écran n'a été
redessiné.

## 1. Ce qui change pour l'utilisateur

### Formulaires et envois

| Situation                                                       | Avant                                                             | Maintenant                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Enregistrer une fiche dont un champ est faux, erreur hors écran | rien ne semblait se passer                                        | le premier champ en erreur vient à l'écran et reçoit le focus |
| Attendre la réponse d'un envoi                                  | plusieurs boutons restaient identiques                            | le bouton se désactive et montre un indicateur                |
| Une liste de choix en erreur                                    | l'erreur s'affichait dessous, le contrôle restait neutre          | le contrôle se marque en erreur, comme un champ texte         |
| Vider le type de bien, le contrat ou l'épargne                  | impossible une fois choisi                                        | « Non renseigné » vide la valeur                              |
| Une action échoue sans message prévu                            | rien ne s'affichait (disposition du tableau de bord, par exemple) | « L'action n'a pas abouti. Réessayez. »                       |
| Lire un message d'erreur                                        | il disparaissait après 4 s                                        | il reste 10 s et se ferme d'un clic                           |
| Un dialogue long, sur téléphone                                 | Annuler et Confirmer sortaient de l'écran au défilement           | le pied reste collé en bas                                    |

Boutons qui montrent désormais l'attente : Confirmer (conversion d'une fiche),
Ouvrir le dossier (À ouvrir, carte et choix de la banque), Enregistrer l'appel
et Enregistrer sans appel (nouveau prospect), le bouton d'envoi de Modifier la
fiche, et toutes les confirmations.

### Listes

| Situation                                        | Avant                                                 | Maintenant                                                           |
| ------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Un numéro dans une liste                         | texte brut, ni appelable ni copiable au toucher       | lien `tel:` qui n'ouvre pas la ligne                                 |
| Une liste vide à cause des filtres               | un message, ou seulement « Nouveau prospect »         | « Effacer les filtres » (ou « Effacer la recherche » sur l'annuaire) |
| Changer d'onglet ou de filtre                    | squelette à chaque fois (rappels, fiches de campagne) | la page précédente reste affichée, estompée, jusqu'à la réponse      |
| Revenir sur l'onglet après un appel au téléphone | liste figée jusqu'à 30 s                              | prospects et rappels se rechargent                                   |
| Panne sur « Fiches ouvertes » (supervision)      | le bloc disparaissait                                 | le message d'erreur, avec « Réessayer »                              |
| Indices clavier sur téléphone                    | touches affichées sans clavier                        | masqués, carte du clavier comprise                                   |

Numéros appelables : rappels, mes contacts (deux tableaux), annuaire de
l'écran d'appel, fiches d'une campagne, dossiers bancaires (tableau et cartes).
Pas dans la liste des prospects Grand Public : le numéro y est dans le lien de
la ligne, et un lien ne s'imbrique pas dans un autre.

## 2. Comment c'est construit

| Élément                                    | Fichier                                                 | Rôle                                                                                       |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Button` `pending`                         | `web/src/components/ui/button.tsx`                      | désactive, `aria-busy`, indicateur ; garde le `disabled` de l'appelant                     |
| `usePremiereErreur(racine)`                | `web/src/components/forms/premiere-erreur.ts` (nouveau) | après un échec, un effet cherche le premier `[aria-invalid="true"]` une fois le rendu fait |
| `Liste` `effacable`, erreur lue du `Field` | `web/src/components/forms/liste.tsx`, `field.tsx`       | `idErreurDe` partagé : tout `Field` qui porte une erreur marque sa liste                   |
| `FilterCombobox` `error`                   | `web/src/components/filters/filter-combobox.tsx`        | même marquage ; aucun appelant encore                                                      |
| Filet d'erreur                             | `web/src/main.tsx`                                      | `MutationCache.onError`, ignoré si la mutation a son `onError` ou `meta.erreurAffichee`    |
| Durée d'erreur                             | `web/src/lib/mutation-feedback.ts`                      | `toastApiError` passe 10 s ; `Toaster` a son bouton Fermer                                 |
| `DialogFooter` collant                     | `web/src/components/ui/dialog.tsx`                      | marges négatives sur le `p-6` du dialogue : les boutons ne bougent pas                     |
| `LienTelephone`                            | `web/src/components/lien-telephone.tsx` (nouveau)       | 16 lignes                                                                                  |
| `Pagination`                               | `web/src/components/pagination.tsx` (nouveau)           | remplace les deux copies identiques (prospects, dossiers bancaires)                        |

Deux mutations affichent déjà l'erreur dans leur formulaire et portent
`meta: { erreurAffichee: true }` : la création de campagne et les créneaux de la
supervision. Sans ce drapeau, le filet y ajouterait un second message.

| Commit     | Portée                                                  |      Lignes |
| ---------- | ------------------------------------------------------- | ----------: |
| `b2a3047f` | formulaires : première erreur, attente, listes de choix |  +158 / -85 |
| `42e2236c` | toasts et filet d'erreur                                |    +17 / -2 |
| `8792568e` | listes : numéros, filtres, chargements, indices clavier | +272 / -167 |
| `3b2887ac` | pied de dialogue collant                                |     +7 / -1 |

Total du lot : **+454 / -255 lignes**, trois fichiers nouveaux.

## 3. Ce qui n'a pas été fait

- **Pagination des campagnes et des fiches de campagne** : ni total, ni taille
  de page réglable, masquée sur une page. Les ranger dans le composant commun
  demanderait des options que seules elles utilisent.
- **Dialogues en plein écran sur téléphone** : changement d'apparence, donc
  refonte, à accorder (§9 du plan).
- **Pied de Modifier la fiche** : ce formulaire a son propre pied, pas
  `DialogFooter` ; il défile encore avec le contenu. Une classe à ajouter si
  l'écran le confirme.

## 4. Vérifications

| Contrôle                       | Résultat                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `tsc --noEmit` du panneau      | sans erreur                                                                         |
| `oxlint` du panneau            | aucune erreur dans les 26 fichiers touchés ; les 9 erreurs connues de `dev` restent |
| Prettier (contenu en LF)       | 26 fichiers formatés                                                                |
| `tools/dev/plafonds.sh`        | sans erreur                                                                         |
| Tiret cadratin, « commercial » | absents des lignes ajoutées                                                         |
| Sélecteurs e2e                 | aucun texte, rôle ou libellé attendu par `e2e/` n'a changé                          |
| Parcours Playwright, tests Go  | **non joués** : pas de base de test jetable sur ce poste                            |

## 5. À voir à l'écran

- **Focus après « Effacer les filtres »** : le bouton disparaît et le focus
  retombe sur la page.
- **Données estompées** : pendant un changement d'onglet des rappels, le
  compteur de retards montre encore la valeur précédente ; les fiches de
  campagne restent cochables pendant qu'elles sont estompées.
- **Lien téléphone** : cible de 24 px dans les tableaux, sous les 44 px du
  dépôt ; sur un poste sans application de téléphonie, `tel:` peut ouvrir un
  choix d'application.
- **Pied collant** : deux boutons empilés et leur marge prennent environ 140 px
  en bas d'un petit téléphone.
- **« Non renseigné »** : après avoir vidé la valeur, aucune coche ne s'affiche
  sur ce choix ; le texte d'attente revient.
- **Nouveaux messages d'échec** : marquer une notification comme lue ou
  enregistrer une disposition hors ligne affiche maintenant un message. Vérifier
  que ce n'est pas bruyant.
- **Durée d'erreur** : seuls les messages passés par `toastApiError` restent
  10 s ; un `toast.error` direct (appel refusé à la création) reste à 4 s.
- **Ordinateur à écran tactile principal** : perd les indices et la carte du
  clavier.

## 6. Suite

1. **Lot 0** : les deux lots se vérifient à l'écran, rôle par rôle, et les
   parcours de rappels se jouent contre une base de test jetable.
2. **Lot 3 du plan** : formulaires (F6 à F19), en commençant par retirer les
   ~250 lignes mortes du mode création de `prospect-form.tsx`.
