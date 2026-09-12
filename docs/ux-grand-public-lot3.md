# Grand Public : lot 3 du plan d'interactions, livré

Travail du 12 septembre 2026 sur la branche `feat/amelioration-ux`, à la suite
des lots 1 et 2 (`ux-grand-public-lot1.md`, `ux-grand-public-lot2.md`). Le plan
est `ux-grand-public.md`, §3 (formulaires).

Le lot 3 porte deux choses :

- **l'appel et l'ajout d'un prospect Grand Public passent en étapes**. C'est une
  refonte d'écran, accordée par écrit par le propriétaire le 12 septembre 2026,
  avec quatre arbitrages repris au §1 ;
- **les corrections de formulaire hors de ces deux écrans** : Modifier la fiche,
  Confirmer la conversion, dialogues bancaires, création de campagne,
  calendrier.

## 1. Les arbitrages du propriétaire

| Question                                     | Réponse retenue                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Découpage de « Nouveau prospect »            | trois étapes : Identité, Situation, Adhésion ; l'envoi se fait sur la dernière                                  |
| Découpage de l'appel Grand Public            | une étape « Réponse », puis les trois mêmes étapes                                                              |
| « Continuer » quand l'étape a une erreur     | bloqué sur l'étape ; les étapes précédentes restent cliquables                                                  |
| Place des champs réglés par l'administrateur | chaque champ a son étape ; l'ordre de l'administrateur vaut dans l'étape ; ses champs ajoutés vont sur Adhésion |

Une première version en étapes avait existé du 11 au 12 septembre (`1695e7e0`,
retirée par `326c2cd3`). Elle a servi de base ; les écarts viennent des
arbitrages ci-dessus.

## 2. Les deux écrans en étapes

### Nouveau prospect (page et boîte de la liste)

```
[1 Identité] · 2 Situation · 3 Adhésion
Étape 1 sur 3 · Identité

Identité   Nom, prénom, téléphone, WhatsApp, e-mail, envoi du lien
Situation  Situation, profession, banque, syndicat, engagement, durée
Adhésion   Revenu, paiement, durée, méthode, rendez-vous,
           champs ajoutés par l'administrateur,
           statut d'appel (facultatif), échéance, commentaire,
           [Enregistrer sans appel] [Il refuse] [À rappeler]
           [Enregistrer l'appel] [Enregistrer l'adhésion] [Annuler]

[Retour]                                   [Continuer]
```

### Appel d'un prospect Grand Public

```
Awa Diop · +221 77 123 45 67            (visible à chaque étape)
[1 Réponse] · 2 Identité · 3 Situation · 4 Adhésion

Réponse   Avez-vous eu la personne au téléphone ?
          [Joignable] [Injoignable]  puis le statut
          sans dossier ouvert : échéance, commentaire, [Enregistrer l'appel]
          dossier ouvert      : [Continuer]
2 à 4     les mêmes étapes que Nouveau prospect ;
          Adhésion porte [Enregistrer l'adhésion] [Il refuse] [À rappeler]
```

La console CHUES ne change pas : un seul écran, les mêmes touches.

### Ce qui change pour l'utilisateur

| Situation                                            | Avant                                        | Maintenant                                                                       |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Ouvrir Nouveau prospect ou un appel sur téléphone    | tous les champs sur une page, boutons en bas | une étape à la fois, « Étape 2 sur 4 · Identité »                                |
| « Continuer » avec un champ faux                     | (pas d'étape)                                | l'étape reste affichée, le focus va au premier champ en erreur                   |
| Cliquer une étape plus loin                          | (pas d'étape)                                | possible seulement si les étapes d'avant sont valides                            |
| Enregistrer avec une erreur sur une étape précédente | l'erreur pouvait être hors écran             | l'étape fautive se rouvre et son champ reçoit le focus, refus du serveur compris |
| Injoignable, ou un statut sans dossier               | tout le formulaire restait affiché           | l'appel se consigne dès « Réponse »                                              |
| Numéro déjà enregistré, à l'ajout                    | message sous le champ, parfois hors écran    | retour à Identité, champ téléphone en focus                                      |
| « À rappeler », ou la touche 2 sur le dossier        | échéance ouverte en bas de page              | amène à Adhésion et ouvre l'échéance, dossier gardé                              |
| Entrée sur le dossier ouvert                         | enregistrait                                 | « Continuer » tant qu'il reste une étape, puis enregistre                        |

### Une règle ajoutée à la revue

À l'ajout, **« Continuer » n'exige que l'identité**. Si l'administrateur rend
obligatoire un champ de Situation ou d'Adhésion, cette obligation vaut pour
« Enregistrer l'adhésion », qui la vérifie et rouvre l'étape. Sans cette règle,
« Enregistrer sans appel » devenait inatteignable pour un simple lead, alors que
le parcours GP-13 et la décision du 11 septembre veulent qu'une fiche se crée
avec son nom et son numéro. Les erreurs de format (e-mail, durée, WhatsApp)
bloquent toujours. Sur l'appel, où le dossier ouvert annonce une adhésion,
toutes les obligations bloquent.

### Comment c'est construit

- `web/src/components/grand-public/etapes.tsx` (nouveau, 207 lignes) : la barre
  d'étapes (`aria-current="step"`, intitulé qui reçoit le focus, cibles de
  44 px), le pied Retour / Continuer, la table `ETAPE_DU_CHAMP` typée
  `Record<ChampReglable, …>` et le filtrage des erreurs par étape.
- `ConversionFields` reçoit `etape` et filtre l'ordre réglé sans le retrier.
- `NouveauProspect` et `Consignation` (Grand Public seulement, `statutParSelect`)
  tiennent le rang de l'étape ; le corps de la console CHUES est regroupé en
  morceaux que les étapes réutilisent, dans le même ordre qu'avant.
- `console-view.tsx` passe à 1 728 lignes, sous le plafond de 1 800 du panneau
  repris de la v1.

## 3. Les autres corrections de formulaire

| Écran                        | Avant                                                                  | Maintenant                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Modifier la fiche            | aucun bouton Annuler                                                   | « Annuler », qui demande confirmation si un champ a changé                                     |
| Modifier la fiche            | une erreur restait affichée pendant la correction                      | corriger un champ efface son erreur ; changer la situation n'efface que les champs qui partent |
| Modifier la fiche, téléphone | le clavier s'ouvrait par-dessus la boîte                               | pas d'autofocus sur écran tactile                                                              |
| Confirmer la conversion      | montant en nombre libre, durée libre, listes affichant la valeur brute | montant au clavier numérique avec aperçu en F CFA, durée dans la liste commune, libellés       |
| Confirmer la conversion      | « Confirmer » grisé sans raison, valeurs gardées à la réouverture      | « Choisissez une offre. » sous le bouton, boîte vide à chaque ouverture                        |
| Encaissement, rejet          | obligatoire marqué par un astérisque                                   | « Obligatoire » comme ailleurs                                                                 |
| Rejet, création de campagne  | bouton grisé sans raison                                               | la raison sous le bouton                                                                       |
| Banque de traitement         | la banque du client précédent restait choisie                          | chaque client repart sans banque                                                               |
| Création de campagne         | supervision et direction cochées d'office                              | seuls les téléconseillers cochés d'office                                                      |
| Calendrier                   | jours de 36 px ; « Du » annoncé sans la date                           | jours de 44 px ; « Du, 12/09/2026 »                                                            |

Le mode création de `prospect-form.tsx`, sans appelant depuis que l'ajout passe
par `NouveauProspect`, est retiré (environ 140 lignes).

## 4. Commits

| Commit     | Portée                                              |      Lignes |
| ---------- | --------------------------------------------------- | ----------: |
| `c39478de` | Modifier la fiche, conversion, mode création retiré | +259 / -301 |
| `15dd4d19` | dialogues banque et campagne                        | +197 / -201 |
| `0f3e899d` | calendrier, trois parcours e2e ajustés              |   +16 / -13 |
| `8f4bdc4a` | appel et ajout en étapes                            | +642 / -131 |

Total du lot : **+1 114 / -646 lignes**.

## 5. Vérifications

| Contrôle                       | Résultat                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `tsc --noEmit` du panneau      | sans erreur                                                                      |
| `oxlint` du panneau            | aucune erreur dans les fichiers touchés ; les 9 erreurs connues de `dev` restent |
| `tsc` du dossier `e2e`         | les 6 erreurs connues de `e2e/convertir.spec.ts`, fichier non touché             |
| Prettier (contenu en LF)       | fichiers touchés formatés                                                        |
| `tools/dev/plafonds.sh`        | sans erreur                                                                      |
| Tiret cadratin, « commercial » | absents des lignes ajoutées                                                      |
| Parcours Playwright, tests Go  | **non joués** : pas de base de test jetable sur ce poste                         |

Parcours ajustés sans être joués : `grand-public-saisie.spec.ts` (GP-13 à
GP-21 passent par « Continuer »), `grand-public-fiche.spec.ts` (« Confirmer la
conversion »), et trois parcours qui visaient le calendrier par son nom exact.

## 6. À voir à l'écran, poste et 375 px

- **Barre d'étapes** : passe à la ligne sans défilement horizontal ; les étapes
  fermées se lisent comme telles ; l'intitulé reçoit le focus après
  « Continuer » et « Retour ».
- **Nouveau prospect** : « Continuer » sur un formulaire vide montre nom et
  numéro obligatoires ; un numéro déjà pris ramène à Identité.
- **Appel** : Injoignable puis un statut se consigne sur Réponse, étapes 2 à 4
  fermées ; Joignable mène à « Continuer » ; Échap hors d'un champ revient à
  Réponse avec « Rétablir » ; un rappel repris s'ouvre sur Réponse ; un seul
  bouton WhatsApp sur Identité.
- **Changer d'avis après avoir répondu** : aucun bouton pour passer de
  Joignable à Injoignable ; Échap efface et propose « Rétablir », comme avant.
- **Erreurs sur les groupes de choix** (situation, méthode, engagement) : sans
  `aria-invalid`, le focus tombe sur l'intitulé de l'étape plutôt que sur le
  groupe ; le message est annoncé.
- **Console CHUES** : identique, carte du clavier et « Phase 3 · Conversion »
  compris.
- **Création de campagne** : les comptes CHARGE_CLIENTELE ne sont jamais chargés
  dans la liste des téléconseillers, avant comme après ce lot.
- **Calendrier** sur un téléphone de 320 px, et l'aspect d'une plage maintenant
  que les jours se touchent.
- **Modifier la fiche** : les listes Paiement et Durée peuvent encore afficher
  la valeur brute (même défaut que la conversion, corrigé là seulement).

## 7. Suite

1. **Lot 0** : vérifier les trois lots à l'écran, rôle par rôle, et jouer les
   parcours de saisie, de fiche et de rappels contre une base de test jetable.
2. **Lot 4 du plan** : barre latérale et navigation (N5 à N20).
