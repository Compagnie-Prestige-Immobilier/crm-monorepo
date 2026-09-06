# TODO

Les 39 exigences de l'expression de besoins CHUES du 4 septembre 2026, avec
leur état vérifié dans le code le 6 septembre 2026.

Lire ce fichier avant d'ouvrir un chantier. S'il contredit le code, c'est le
code qui a raison : corriger le fichier.

**38 faites, 1 partielle.** Les lots 1 à 6 sont livrés en entier. Il ne reste
du lot 7 que la ventilation par superviseur des indicateurs d'enrôlement.

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

### Lot 3 en entier, campagnes

Branche `feat/lot2-compagnes`.

Les six exigences EB-14 à EB-19 sont dans le code. Pièges déjà payés :

- La répartition n'a jamais eu de colonne : elle vit dans
  `LotExport.filters.distribution`, et les objectifs par téléconseiller avec
  elle. La réécrire sans garder les critères qui l'entourent efface l'étiquette
  de la campagne.
- Une fiche DÉJÀ APPELÉE ne se réaffecte jamais. Le calcul porte sur la
  POSITION et non sur la fiche : la même personne peut figurer dans deux
  campagnes.
- « Hors Injoignable définitif » se lit sur `retryAfterMinutes IS NULL`, pas sur
  un code écrit en dur. L'administrateur peut créer d'autres statuts qui ne
  repassent jamais.
- Un contact recommandé devient une fiche AU LANCEMENT. `Representant.phoneE164`
  porte un index unique partiel : sans dédoublonnage par numéro, la transaction
  entière échoue.
- La suppression d'une campagne reste à l'administrateur seul. Elle était gardée
  par le même drapeau que la création côté web ; les deux sont séparés.

### Lots 4, 5 et 6, conversion, rôles et formulaire public

Branche `feat/lot4-conversion`. Treize exigences : EB-20 à EB-26, EB-27 à
EB-32, EB-29.

**DETTE ASSUMÉE : aucun test neuf n'a été écrit sur ces trois lots.** Décision
du 6 septembre 2026 sous contrainte de délai. Les parcours E2E et journey sont
à écrire à partir de la semaine du 8 septembre. Deux règles resteront hors de
leur portée et demandent un test d'un autre genre : la reprise des données
d'EB-24, et la protection `minPayloadVersion` d'EB-21 qu'un navigateur ne sait
pas rejouer.

Pièges déjà payés :

- EB-21 ne mord qu'à partir de `payloadVersion` 8. Appliquer le refus tout de
  suite condamnerait une saisie faite hors ligne, où un 400 est TERMINAL. Le
  web et le mobile sont passés à 8 ; la file repart avec le MINIMUM des
  versions qu'elle porte, donc une saisie mise en file en 7 repart en 7.
- EB-24 ne réécrit PAS `call_attempts`. La contrainte interdit une date sur
  PHYSICAL, donc aucune ligne n'en porte et les convertir les violerait toutes.
  Les fiches et les parcours sont convertis, l'historique garde son code et se
  LIT « RDV CPI ».
- Une base mobile d'avant la v13 ne pouvait plus migrer : `_prospectsCopy`
  ignorait les colonnes neuves, et les paliers v6 et v13 recréent `prospects`.
  Invisible à l'analyse et à la compilation.
- EB-27 n'a pas un lien général mais un lien PAR COMPTE : `createdById` est NOT
  NULL et commande la visibilité.
- Le catalogue d'EB-28 est DÉRIVÉ du DTO par soustraction : un champ ajouté au
  formulaire sans libellé fait échouer la compilation.

Restent à décider :

- `GET /analytics/funnel` rend `montantEncaisse` à TOUS les rôles. « Réservé à
  l'administrateur et à la direction » n'est qu'une convention d'affichage.
- `API_TRUST_PROXY_HEADERS` vaut `false` : la limitation du formulaire public
  est GLOBALE et non par visiteur tant qu'il n'est pas à `true`.
- EB-25 : « Lien envoyé le {date} » et la mise à jour de la fiche visée
  demandent deux colonnes et un jeton qui porte le prospect. PR suivante.
- Le formulaire mobile ignore les réglages d'EB-28.
- Un import portant « Physique » est désormais refusé ligne à ligne.

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
