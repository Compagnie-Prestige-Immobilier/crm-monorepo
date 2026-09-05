# TODO

Les 39 exigences de l'expression de besoins CHUES du 4 septembre 2026, avec
leur état vérifié dans le code le 6 septembre 2026.

Lire ce fichier avant d'ouvrir un chantier. S'il contredit le code, c'est le
code qui a raison : corriger le fichier.

**21 faites, 5 partielles, 13 absentes.** Les lots 1 et 4 sont livrés en entier,
le lot 7 à une ventilation près. Les lots 3 et 6 n'ont pas commencé.

## Lot 2, indicateurs et tableau de bord

- [ ] EB-33 Définition des taux. Faits : fiches ouvertes par téléconseiller et
      par jour, DMC, DMT, affichage « Sans objet » sans dénominateur. Manquent :
      taux de joignabilité PAR FICHE sur le dernier statut (aujourd'hui calculé
      par tentative, `supervision.service.ts:881`), taux de qualification
      (qualifiées / ouvertes, n'existe nulle part), taux d'exploitation, et le
      croisement téléconseiller x créneau horaire (`activity-view.tsx:591` ne
      croise que l'équipe entière). Partiels : taux de contact borné à la
      dernière campagne et plafonné à 100 %, taux d'acceptation et taux de
      rappel côté représentants seulement.
- [ ] EB-34 Diagrammes. La répartition des statuts en circulaire existe
      (`sources.ts:278`). Manquent le taux d'exploitation par campagne et les
      deux histogrammes joint / non joint.
- [ ] EB-35 La colonne « Rendez-vous » du tableau par téléconseiller compte
      encore le taux de rappel (`sources.ts:97,140`). La renommer « Acceptés »
      et compter les fiches au statut Accepté.
- [ ] EB-36 Catalogue de cartes. Représentants, prospects, appels, fiches et
      enrôlement sont couverts. Manquent les campagnes au-delà de la dernière,
      et les rappels honorés, en retard, à venir.
- [ ] EB-37 La permission de lecture du journal d'appels n'est demandée que
      depuis l'écran de diagnostic. La demander à la première ouverture de
      fiche, et signaler le refus en supervision et sur l'accueil.

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

Les sept exigences sont dans le code. Voir `docs/lot4-conversion-et-parametres.md`
pour ce qui a été tranché et ce qui reste à faire tourner.

- [x] EB-20 Champ « Établissement » à la création d'un prospect. Colonne
      `prospects.etablissement`, facultative, sur les deux projets.
- [x] EB-21 Revenu mensuel obligatoire côté API. Vérifié sur la fiche APRÈS
      correction : rien à ressaisir quand la tranche est déjà en base.
      `PHASE2_INCOME_BAND_REQUIRED`.
- [x] EB-22 « Durée dans la fonction », et la durée du système de paiement
      quitte le formulaire de conversion. La colonne reste : imports Grand
      Public, exports et sync mobile l'écrivent encore.
- [x] EB-23 Numéro WhatsApp à la conversion, question « ce numéro est un numéro
      WhatsApp » comprise.
- [x] EB-24 `EMAIL` et `WHATSAPP` ajoutées, « Vocal ou messagerie
      électronique » retirée du formulaire et ses lignes reprises vers `EMAIL`.
      `PHYSICAL` reste distincte, décision du 6 septembre 2026.
- [x] EB-26 Le numéro WhatsApp de la fiche est un lien `wa.me`.
- [x] EB-29 Page « Paramètres CHUES » dans l'écran d'administration : lien de la
      plateforme, adresse CHUES, numéro WhatsApp, et les accès des deux
      plateformes. La base prime sur l'environnement.

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

- [ ] Appliquer la migration `20260905090000_inscriptions_plateforme` hors local.
- [ ] Appliquer les deux migrations du lot 4,
      `20260906090000_lot4_etablissement_et_canaux` puis
      `20260906090100_lot4_reprise_des_methodes`, DANS CET ORDRE : PostgreSQL
      refuse d'employer une valeur d'énumération dans la transaction qui la crée.
- [ ] Régénérer le client Dart sur une machine qui porte un JDK 17+. Les champs
      `etablissement` et `whatsappE164` manquent au mobile tant que ce n'est pas
      fait.
- [ ] Délivrer le jeton machine Grand Public : `php artisan integration:token crm`
      dans son conteneur. C'est la dernière variable manquante ; l'URL et le
      couple CHUES sont posés et vérifiés. Sans jeton, le connecteur ne tire pas
      Grand Public et l'écran d'administration le dit.
- [ ] Lancer les e2e Playwright. Ils n'ont jamais tourné sur l'arbre fusionné.
- [ ] Décider du sort des branches locales `feat/connecteur-enrolement` et
      `feat/redis-implementation`, fusionnées dans `dev`.
- [ ] Supprimer les branches `codex/administration` et `codex/banque-finance`.
      Zéro commit, 151 de retard, leurs worktrees sont déjà retirés.
