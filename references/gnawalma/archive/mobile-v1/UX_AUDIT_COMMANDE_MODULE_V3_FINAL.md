# UX AUDIT FINAL: Module Commande - Gnawalma (V3 Consolidated)
**Date:** 2026-02-12
**Prepared by:** Codex (consolidation + additional code-backed findings)
**Based on:** `UX_AUDIT_COMMANDE_MODULE.md` + `UX_AUDIT_COMMANDE_MODULE_V2.md` + direct code review
**Scope:** New order flow (`/orders/new`) for Senegalese tailor workflow

---

## 1) Executive Summary

Le flux global en **3 étapes** (`Client -> Panier -> Paiement`) est cohérent avec la réalité métier d’un atelier de couture sénégalais, surtout pour les commandes multi-articles sur un seul client payeur.

La V2 corrige bien la mauvaise hypothèse de la V1 sur le renommage des étapes. En revanche, il reste des problèmes UX importants, et j’ai identifié des problèmes supplémentaires non couverts dans V2, dont certains ont un impact direct sur la fiabilité de l’expérience:

1. **Risque de double création de client** dans le quick-add (critique fonctionnel + UX).
2. **Validation/feedback trop intrusive ou mal synchronisée** (snackbar bas + états d’erreur précoces).
3. **État de mesures potentiellement incohérent** quand on change de bénéficiaire.
4. **Création bénéficiaire incomplète côté UI** (liste non rafraîchie clairement).
5. **Flux non protégé contre sortie accidentelle** (perte de saisie possible sans confirmation).

Conclusion: le produit est proche d’un bon niveau UX métier, mais il faut traiter un lot de correctifs structurants avant de parler de “finalisation production UX”.

---

## 2) Méthodologie et Niveau de Confiance

### Sources consolidées
- `UX_AUDIT_COMMANDE_MODULE.md`
- `UX_AUDIT_COMMANDE_MODULE_V2.md`
- Revue directe du code Flutter/Riverpod dans:
  - `lib/app/modules/orders/...`
  - `lib/app/shared/widgets/...`
  - `lib/app/shared/utils/app_feedback.dart`

### Légende de confiance
- **CONFIRMÉ (code)**: constat vérifié par lecture de code avec référence fichier/ligne.
- **PROBABLE (code)**: très probable selon implémentation, nécessite test runtime pour reproduire visuellement.
- **HYPOTHÈSE UX**: recommandation ergonomique (valide UX), sans bug fonctionnel garanti.

---

## 3) Ce Que V2 A Correctement Capté (à conserver)

1. Le nom d’étape `Panier` est acceptable dans ce contexte métier multi-vêtements.
2. Les snackbars flottants en bas sont intrusifs pour ce flow.
3. Les labels `Terminer` / `Ajouter cet article` ne sont pas optimaux.
4. La section mesures mérite une logique plus “smart” (enregistrées vs absentes).
5. L’édition d’article panier manque (suppression seulement).
6. La date de livraison est en état d’erreur avant interaction utilisateur.
7. Le dépôt/acompte manque de clarté sur l’optionnalité.

---

## 4) Findings Consolidés (V2 + nouveaux)

## CRITICAL

### F-01. Double création potentielle de client en “Nouveau Client Rapide”
- **Niveau:** CRITICAL
- **Statut:** CONFIRMÉ (code)
- **Origine:** Nouveau finding (absent de V2)
- **Évidence:**
  - `QuickAddClientSheet` crée déjà le client via repository: `lib/app/modules/orders/views/widgets/quick_add_client_sheet.dart:74`
  - Puis appelle `onClientCreated(client)`: `lib/app/modules/orders/views/widgets/quick_add_client_sheet.dart:77`
  - Or `onClientCreated` pointe vers `quickCreateClient`, qui recrée le client: `lib/app/modules/orders/controllers/new_order_provider.dart:96`
- **Impact UX:** doublons, incohérences de recherche, perte de confiance, parcours “client introuvable/dupliqué”.
- **Recommandation:** faire de `quickCreateClient` une simple sélection/navigation si client déjà persisté, ou déplacer toute persistance dans un seul endroit.
- **Critère d’acceptation:** création rapide = 1 seul insert DB, jamais 2.

### F-02. Feedback erreurs/infos intrusif via snackbars flottants bas
- **Niveau:** CRITICAL
- **Statut:** CONFIRMÉ (code)
- **Origine:** V2 confirmé
- **Évidence:**
  - Toast global via `SnackBarBehavior.floating`: `lib/app/shared/widgets/feedback/app_toast.dart:72`
  - Snackbar spécifique date livraison: `lib/app/modules/orders/views/steps/payment_step.dart:609`
  - Plusieurs appels `AppFeedback.showError/showToast` dans provider: `lib/app/modules/orders/controllers/new_order_provider.dart:207`, `lib/app/modules/orders/controllers/new_order_provider.dart:243`, `lib/app/modules/orders/controllers/new_order_provider.dart:309`
- **Impact UX:** masque les CTA bas, feedback volatile, charge cognitive.
- **Recommandation:** inline validation + banner top/dialgoue selon criticité.
- **Critère d’acceptation:** aucun message bloquant important ne dépend d’un snackbar bas auto-dismiss.

## HIGH

### F-03. Mesures potentiellement “stale” lors du changement de bénéficiaire
- **Niveau:** HIGH
- **Statut:** CONFIRMÉ (code)
- **Origine:** Nouveau finding
- **Évidence:** dans `setForWhom`, si pas de mesures bénéficiaire et pas de mesures client, aucun reset explicite des mesures: `lib/app/modules/orders/controllers/new_order_provider.dart:109`
- **Impact UX:** mauvaises mesures pré-remplies silencieusement, erreur métier grave.
- **Recommandation:** reset explicite `itemMeasurements` si aucune source valide trouvée.
- **Critère d’acceptation:** changement de personne sans historique => mesures vides, jamais héritées par erreur.

### F-04. Ajout bénéficiaire: liste UI non mise à jour explicitement
- **Niveau:** HIGH
- **Statut:** CONFIRMÉ (code)
- **Origine:** Nouveau finding
- **Évidence:** commentaire explicite “Need to update state list”: `lib/app/modules/orders/widgets/beneficiary_list.dart:66`
- **Impact UX:** utilisateur ne retrouve pas le bénéficiaire fraîchement créé dans la liste horizontale.
- **Recommandation:** append immédiat à `clientBeneficiaries` dans provider après création (optimistic update).
- **Critère d’acceptation:** nouveau bénéficiaire visible instantanément dans le carousel sans rechargement externe.

### F-04B. Bouton “Confirmer” potentiellement bloqué si saisie clavier du libellé bénéficiaire
- **Niveau:** HIGH
- **Statut:** PROBABLE (code)
- **Origine:** Nouveau finding
- **Évidence:**
  - Activation du bouton basée sur `_labelController.text.trim().isNotEmpty`: `lib/app/shared/widgets/sheets/add_beneficiary_sheet.dart:222`
  - Le `TextField` du libellé n’appelle pas `setState` sur saisie clavier: `lib/app/shared/widgets/sheets/add_beneficiary_sheet.dart:98`
  - Seules les puces suggestions appellent `setState`: `lib/app/shared/widgets/sheets/add_beneficiary_sheet.dart:246`
- **Impact UX:** l’utilisateur peut taper un nom personnalisé sans voir le bouton s’activer.
- **Recommandation:** ajouter `onChanged: (_) => setState(() {})` sur le champ texte.
- **Critère d’acceptation:** bouton “Confirmer” s’active immédiatement dès qu’un caractère est saisi.

### F-05. Date de livraison affichée en erreur avant action utilisateur
- **Niveau:** HIGH
- **Statut:** CONFIRMÉ (code)
- **Origine:** V2 confirmé
- **Évidence:** style rouge conditionné à `deliveryDate == null` dès affichage: `lib/app/modules/orders/views/steps/payment_step.dart:280`, `lib/app/modules/orders/views/steps/payment_step.dart:324`
- **Impact UX:** anxiogène, faux sentiment d’erreur initiale.
- **Recommandation:** gating via flag `attemptedSubmit` ou focus/blur.
- **Critère d’acceptation:** aucun état “erreur” visuel avant tentative de confirmation.

### F-06. Impossibilité d’éditer un article panier (suppression uniquement)
- **Niveau:** HIGH
- **Statut:** CONFIRMÉ (code)
- **Origine:** V1/V2 confirmé
- **Évidence:** bouton delete uniquement: `lib/app/modules/orders/views/steps/payment_step.dart:549`
- **Impact UX:** correction coûteuse, frustration, temps opérateur.
- **Recommandation:** action `Modifier` ramenant à Step 2 avec preload.
- **Critère d’acceptation:** toute ligne panier peut être modifiée sans suppression/recréation complète.

### F-07. Libellés CTA ambigus dans Step 2
- **Niveau:** HIGH
- **Statut:** HYPOTHÈSE UX (forte)
- **Origine:** V1/V2 confirmé
- **Évidence:** `Terminer` et `Ajouter cet article`: `lib/app/modules/orders/widgets/order_bottom_bar.dart:46`, `lib/app/modules/orders/widgets/order_bottom_bar.dart:57`
- **Impact UX:** ambiguïté sur l’action et le statut du panier.
- **Recommandation:** `Ajouter` + `Continuer (N)`.
- **Critère d’acceptation:** compréhension de l’action en <1s sans ambiguïté en test modéré.

### F-08. Sortie/back sans garde de perte de saisie
- **Niveau:** HIGH
- **Statut:** CONFIRMÉ (code)
- **Origine:** Nouveau finding
- **Évidence:** retour Step0 quitte sans confirmation: `lib/app/modules/orders/views/new_order_view.dart:25`, `lib/app/modules/orders/views/new_order_view.dart:32`
- **Impact UX:** perte accidentelle des données non soumises.
- **Recommandation:** dialog “Quitter sans enregistrer ?” si state non-vide.
- **Critère d’acceptation:** confirmation obligatoire avant abandon d’un draft non vide.

## MEDIUM

### F-09. Voice note présentée mais non branchée au provider
- **Niveau:** MEDIUM
- **Statut:** CONFIRMÉ (code)
- **Origine:** V1/V2 confirmé
- **Évidence:** callbacks TODO dans step: `lib/app/modules/orders/views/steps/item_builder_step.dart:66`
- **Impact UX:** fonctionnalité perçue partiellement fiable.
- **Recommandation:** connecter `setAudioNotePath` ou masquer feature.
- **Critère d’acceptation:** audio ajouté/supprimé persiste dans le panier.

### F-10. Acompte: champ optionnel mais libellé non explicite
- **Niveau:** MEDIUM
- **Statut:** CONFIRMÉ (code)
- **Origine:** V1/V2 confirmé
- **Évidence:** validator accepte vide, label sans “optionnel”: `lib/app/modules/orders/views/steps/payment_step.dart:142`, `lib/app/modules/orders/views/steps/payment_step.dart:152`
- **Impact UX:** ambiguïté métier et interprétation opérateur.
- **Recommandation:** clarifier politique (optionnel/règle mini) + label explicite.
- **Critère d’acceptation:** aucun doute utilisateur sur caractère requis ou non.

### F-11. Désynchronisation possible UI/état pour acompte lors de navigation entre étapes
- **Niveau:** MEDIUM
- **Statut:** PROBABLE (code)
- **Origine:** Nouveau finding
- **Évidence:** `TextEditingController` local sans init depuis state: `lib/app/modules/orders/views/steps/payment_step.dart:22`; valeur affichée du reste dépend du state provider: `lib/app/modules/orders/views/steps/payment_step.dart:247`
- **Impact UX:** champ visuellement vide alors que montant déjà pris en compte.
- **Recommandation:** hydrater controller depuis `state.depositAmount` en `initState/didUpdateWidget`.
- **Critère d’acceptation:** contenu du champ = source de vérité state en permanence.

### F-12. Tissu stock: métrage non validé (>0, <= stock)
- **Niveau:** MEDIUM
- **Statut:** CONFIRMÉ (code)
- **Origine:** Nouveau finding
- **Évidence:** saisie libre métrage sans validation locale: `lib/app/modules/orders/widgets/stock_selector_widget.dart:87`; création autorisée sans check quantité: `lib/app/modules/orders/controllers/new_order_provider.dart:211`
- **Impact UX:** devis/consommation incohérents.
- **Recommandation:** bloquer ajout panier si métrage invalide.
- **Critère d’acceptation:** impossible d’ajouter un article stock avec métrage 0 ou > disponible.

### F-13. Mesures dans section repliée par défaut
- **Niveau:** MEDIUM
- **Statut:** HYPOTHÈSE UX (forte)
- **Origine:** V1/V2 confirmé
- **Évidence:** `initiallyExpanded: false`: `lib/app/modules/orders/views/steps/item_builder_step.dart:79`
- **Impact UX:** risque d’oubli si pas de signal adaptatif.
- **Recommandation:** logique conditionnelle (badge “mesures existantes”, expansion forcée sinon).
- **Critère d’acceptation:** taux d’articles sans mesures involontaires en baisse.

### F-14. Positionnement / rôle des “modèles rapides” peu explicite
- **Niveau:** MEDIUM
- **Statut:** CONFIRMÉ (code)
- **Origine:** V2
- **Évidence:** simple set garment type via chips: `lib/app/modules/orders/widgets/smart_templates_list.dart:31`
- **Impact UX:** promesse “template” > comportement réel (simple shortcut).
- **Recommandation:** renommer en “Raccourcis modèles” ou enrichir vrai template.
- **Critère d’acceptation:** utilisateur comprend le comportement sans essai-erreur.

## LOW

### F-15. Style labels tissu en majuscules agressives
- **Niveau:** LOW
- **Statut:** HYPOTHÈSE UX
- **Origine:** V1/V2
- **Évidence:** `TISSU CLIENT` / `TISSU STOCK`: `lib/app/modules/orders/widgets/project_details_card.dart:164`
- **Impact UX:** ton visuel dur, lisibilité secondaire.
- **Recommandation:** “Tissu client”, “Tissu stock”.

### F-16. Stepper sans labels textuels sous les pastilles
- **Niveau:** LOW
- **Statut:** HYPOTHÈSE UX
- **Origine:** V1/V2
- **Évidence:** indicateur visuel numéroté seulement: `lib/app/modules/orders/views/new_order_view.dart:118`
- **Impact UX:** repérage contextuel moindre pour nouveaux utilisateurs.
- **Recommandation:** micro-labels “Client / Panier / Paiement”.

---

## 5) Priorisation d’Implémentation (pragmatique)

## Sprint 0 - Correctifs Bloquants (0.5 à 1 jour)
1. Corriger F-01 (double création client).
2. Corriger F-03 (reset mesures stale).
3. Corriger F-04 (rafraîchissement liste bénéficiaires).
4. Corriger F-02/F-05 minimalement (retirer snackbar bas et état rouge prématuré).

## Sprint 1 - Stabilité UX du flow (1 à 2 jours)
1. F-06 édition d’article panier.
2. F-08 confirmation sortie avec perte potentielle.
3. F-10 politique acompte claire + wording.
4. F-12 validation métrage stock.

## Sprint 2 - Finition et polish (1 à 2 jours)
1. F-07 labels CTA naturels.
2. F-09 voice note branchée ou masquée.
3. F-13 logique smart mesures dans UI.
4. F-14/F-15/F-16 microcopy + stepper labels.

---

## 6) KPIs UX à Suivre Après Correctifs

1. **Temps moyen création commande** (objectif: -20%).
2. **Taux d’abandon en Step 2** (objectif: baisse nette).
3. **Taux de suppression/recréation article** (objectif: baisse après edit item).
4. **Taux d’erreurs validation date/acompte** (objectif: baisse via feedback clair).
5. **Taux de doublons client créés en quick add** (objectif: 0).
6. **Taux d’articles “stock” avec métrage nul/invalide** (objectif: 0).

---

## 7) Plan de Test QA (ciblé)

1. Créer un client rapide et vérifier qu’un seul enregistrement est créé.
2. Ajouter bénéficiaire “Enfant 1”, sauvegarder, vérifier apparition immédiate dans la liste.
3. Changer successivement de bénéficiaires avec/sans mesures et vérifier reset correct.
4. Step paiement sans date: vérifier qu’on n’a pas de snackbar bas intrusif.
5. Revenir Step 3 -> Step 2 -> Step 3: vérifier cohérence champ acompte/remaining.
6. Mode tissu stock: tenter ajout avec métrage `0`, négatif, et supérieur au stock.
7. Modifier un article panier sans suppression complète (après implémentation F-06).
8. Tenter sortie du flow avec brouillon non vide: confirmation obligatoire.

---

## 8) Delta Par Rapport à V2

Nouveaux apports majeurs de cette V3:
1. Identification d’un bug critique de duplication client (F-01).
2. Identification du risque de mesures périmées inter-bénéficiaires (F-03).
3. Mise en évidence du rafraîchissement bénéficiaire incomplet (F-04).
4. Ajout du risque de perte de saisie via back sans garde (F-08).
5. Ajout des incohérences de synchronisation acompte et validation métrage stock (F-11/F-12).

---

## 9) Verdict Final

Le module commande est **structurellement bon** et aligné sur le métier. La base UX est saine.

Pour une “finalisation robuste”, il faut traiter d’abord les points F-01/F-03/F-04/F-02/F-05, puis passer sur l’édition panier et les garde-fous de navigation. Après ces correctifs, le flow peut devenir très solide en production atelier.
