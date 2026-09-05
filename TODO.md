# TODO

Les 39 exigences de l'expression de besoins CHUES du 4 septembre 2026, avec
leur état vérifié dans le code de `dev` le 5 septembre 2026.

Lire ce fichier avant d'ouvrir un chantier. S'il contredit le code, c'est le
code qui a raison : corriger le fichier.

**19 faites, 1 partielle, 19 absentes.** Les lots 1 et 2 sont livrés en entier,
le lot 7 à une ventilation près. Les lots 3, 4 et 6 n'ont pas commencé.

## Lot 3, campagnes

L'entité est `LotExport` : il n'existe pas de modèle « campagne » distinct.
Aucune des six exigences n'est commencée.

- [ ] EB-14 Nom de campagne modifiable. Fabriqué au clic, aucun champ éditable,
      aucune route de renommage.
- [ ] EB-15 Le superviseur crée et lance les campagnes. `@Roles(Role.ADMIN)` sur
      `create` et `apercu`, `lots-export.controller.ts:56`.
- [ ] EB-16 Réaffectation des fiches. `assigneeId` est figé à la création.
- [ ] EB-17 Objectif par téléconseiller. `fichesParJour` vaut pour toute
      l'équipe.
- [ ] EB-18 Liste des fiches par téléconseiller. Le détail n'affiche que des
      compteurs.
- [ ] EB-19 Cibles injoignables et contacts recommandés. L'enum `LotExportCible`
      ne connaît que REPRESENTANTS et PROSPECTS. Le filtre `suivi=INJOIGNABLE`
      existe déjà côté API, aucun écran ne l'expose.

## Lot 4, conversion et paramètres

Aucune des sept exigences n'est commencée.

- [ ] EB-20 Champ « Établissement » à la création d'un prospect. Absent en base.
- [ ] EB-21 Revenu mensuel obligatoire côté API. `incomeBandId` est
      `@IsOptional`, seul l'écran l'impose.
- [ ] EB-22 « Durée dans la fonction » et retrait de la durée du système de
      paiement.
- [ ] EB-23 Numéro WhatsApp à la conversion. N'existe que pour la diaspora.
- [ ] EB-24 Méthodes d'enrôlement recomposées, plus la migration des valeurs
      existantes. L'enum n'a ni WHATSAPP ni fusion RDV CPI / Physique.
- [ ] EB-26 Bouton « Écrire sur WhatsApp ». Aucun lien `wa.me` dans le dépôt.
- [ ] EB-29 Page « Paramètres CHUES ». Les réglages du connecteur vivent en
      variables d'environnement, pas en base.

## Lot 5, rôles

- [ ] EB-31 Rôle Chargé de clientèle. L'enum `Role` ne le porte pas, et la revue
      avant enrôlement n'existe sous aucun nom.
- [ ] EB-32 Rendre au superviseur les cartes couverture de campagne, appels hors
      attribution et rendement par département (`sources.ts:639`). Le reste est
      déjà conforme : les montants restent à l'administrateur et à la direction,
      l'enrôlement à l'administrateur seul.

## Lot 6, formulaire public

Aucune des quatre exigences n'est commencée. EB-30 dépend d'EB-27.

- [ ] EB-25 Deux modes de conversion, dont l'envoi du lien.
- [ ] EB-27 Formulaire public sans connexion. Tous les groupes de routes sont
      derrière `guardRoles`.
- [ ] EB-28 Champs de conversion réglables par l'administrateur.
- [ ] EB-30 Notifications à la réception d'une demande.

## Lot 7, connecteur

- [ ] EB-39 Ajouter la ventilation « par superviseur » aux indicateurs
      d'enrôlement. Tout le reste est livré, voir plus bas.

## Fait, ne pas refaire

### Lot 1 en entier, statuts et fiche

Branche `feat/lot1-statuts-et-fiche`, merge `e1645745`.

Les quatorze exigences EB-01 a EB-13 et EB-38 sont dans le code, migrations de
reprise comprises. Pièges déjà payés :

- Le code d'un statut se DÉDUIT de son libellé. Ne pas rouvrir la saisie
  manuelle (`a00f7838`, rupture assumée).
- Faux numéro compte comme JOINT et ne repasse jamais en file de rappel.
- Le délai de rappel automatique est lu dans `rep-campaigns.service.ts:333`, pas
  dans le module `callbacks` où on le cherche d'abord.
- Sous verrou, la déconnexion et le changement d'espace sont REFUSÉS : la fiche
  resterait verrouillée côté serveur, hors de vue.

### Lot 2 en entier, indicateurs et tableau de bord

Branche `feat/lot2-indicateurs`. EB-33 à EB-37 sont dans le code. Pièges
déjà payés :

- Les taux se lisent PAR FICHE, sur le dernier statut de la fenêtre, attribués
  à qui l'a posé (`REP_FICHE_COLONNES`, `pilotage.sql.ts`). Une fiche par
  fenêtre : sommable entre téléconseillers d'une même fenêtre, pas entre
  fenêtres. Le tableau par créneau interroge une fenêtre par créneau : une
  fiche appelée matin et après-midi compte dans les deux.
- Le taux de contact se calcule sur les fiches CONFIÉES par les campagnes de
  la période (`campagnes.service.ts`). EB-17 remplacera ce dénominateur par
  l'objectif du téléconseiller.
- La disposition est en `version: 2`. Une version 1 relue renomme
  `taux-de-contact`, `taux-de-qualification` et `a-rappeler`, dont le sens a
  changé (`RENOMMAGES_V1`, `dashboard-layout.ts`).
- La permission du journal d'appels se demande UNE fois, à la première
  ouverture de fiche, et l'appareil déclare son état à chaque synchronisation
  (`journalAppelsAutorise` sur le battement de cœur).
- Les specs Playwright `chues-chiffres*.spec.ts` portent les nouveaux titres
  mais leurs valeurs attendues datent du calcul par tentative : à reprendre
  avec le jeu de données avant de les relancer.

### Lot 7, connecteur d'enrôlement

Branche `feat/connecteur-enrolement`, merges `317d2eaf` et `c805b924`.

- Tirage périodique : `@Cron(EVERY_MINUTE)` qui teste l'échéance, fréquence
  réglable de 5 à 1440 minutes, défaut 15, réservée à l'administrateur.
- Premier tirage : reprend tout l'historique.
- Rapprochement par téléphone puis par e-mail, projet vérifié en plus de la
  requête. Une inscription CHUES ne s'attache jamais à une fiche Grand Public.
- Écran réservé à l'administrateur, invisible pour la direction, les
  superviseurs et les téléconseillers. Verrouillé par `enrolement.roles.test.ts`.
- Les horodatages Grand Public arrivent sans fuseau et se lisent en UTC. Son
  champ `statut` est décoratif : l'état qui se mesure est l'ÉTAPE.

L'expression de besoins dit « le connecteur lui-même reste à développer » : cette
phrase est périmée.

### Remise au vert de la CI

Merges `2c508581` et `5e9458af`. Deux pièges qui se reproduisent :

- Mode env strict de turbo 2 : une tâche ne voit QUE les variables déclarées
  dans sa `env`. Le workflow peut les exporter, turbo les jette. Deux suites
  d'intégration échouaient en CI et nulle part ailleurs.
- Le cycle entre `@crm/api-client#build` et les clients de plateforme est rompu
  côté `generate`. `schema.ts` est commité, `codegen:check` reste le juge de sa
  fraîcheur.

## Exploitation

- [ ] Appliquer les migrations `20260905090000_inscriptions_plateforme` et
      `20260905200000_journal_appels_dans_le_battement` hors local.
- [ ] Délivrer le jeton machine Grand Public : `php artisan integration:token crm`
      dans son conteneur. C'est la dernière variable manquante ; l'URL et le
      couple CHUES sont posés et vérifiés. Sans jeton, le connecteur ne tire pas
      Grand Public et l'écran d'administration le dit.
- [ ] Lancer les e2e Playwright. Ils n'ont jamais tourné sur l'arbre fusionné.
- [ ] Décider du sort des branches locales `feat/connecteur-enrolement` et
      `feat/redis-implementation`, fusionnées dans `dev`.
- [ ] Supprimer les branches `codex/administration` et `codex/banque-finance`.
      Zéro commit, 151 de retard, leurs worktrees sont déjà retirés.
