# Audit complet du CRM CPI, 25 septembre 2026

Base auditée : `dev` en `45cf3cc` (fusion de la PR #143, ventes et dispatching).
Méthode : huit revues spécialisées en parallèle (sécurité, prospects et qualification, campagnes et ventes, banque et imports, notifications et analytique, base de données, panneau web, infrastructure et CI), puis contre-vérification manuelle des constats les plus graves et seconde passe transverse.

Cadrage :

- Qui en a besoin : la DSI, pour décider quoi corriger avant la bascule et avant le 1er octobre.
- Plus petit livrable complet : ce rapport. Aucun code applicatif n'a été modifié.
- Hors périmètre : les correctifs eux-mêmes, un test d'intrusion, les mesures de charge sur copie de production.

## 1. Synthèse pour la direction

| Gravité  | Nombre | À traiter                            |
| -------- | ------ | ------------------------------------ |
| Critique | 2      | immédiatement                        |
| Haute    | 16     | avant la fin de la semaine prochaine |
| Moyenne  | 43     | dans le mois                         |
| Basse    | 73     | au fil de l'eau                      |

Les dix points à lire en premier :

1. **Le formulaire public de demande ne fonctionne plus depuis le 11 septembre** (B02). Il envoie vers `/api/demande/{jeton}`, route de la v1 supprimée ; toute demande reçoit « Route inconnue. ». Aucune demande publique n'arrive.
2. **Un visiteur anonyme peut devenir ADMIN sur toute base de démonstration** (B01), et depuis ce compte piloter les vrais Kairo, GLPI et plateformes d'enrôlement, qui ne vérifient pas la base.
3. **La CI de `dev` est rouge** (B03) : trois tests d'intégration échouent depuis le commit `7553c351` du 24 septembre.
4. **Le 1er octobre, l'import des leads perdra la date d'onglet** (B08) : « oct », « nov », « déc » ne sont pas reconnus, et l'incident des dates inversées du 15 septembre reviendra.
5. **Les parts propriétaire, apporteur et CPI d'une vente sont recalculées à chaque correction** (B04), et **redéposer le classeur des ventes efface les versements saisis au comptoir** (B05).
6. **Un appel consigné peut faire repasser une fiche VENDU en PERDU** (B07).
7. **La date d'un rendez-vous affichée à l'accueil peut être celle d'un rappel supplanté** (B17).
8. **Le battement de présence n'est jamais émis par le panneau** (B11) : la note de rendement vaut « Présence non mesurée » pour tout le monde.
9. **Des numéros de téléphone et noms de clients réels sont versionnés dans git** (B16), dans deux migrations et un classeur à la racine.
10. **Aucune sauvegarde vérifiée avant des migrations destructives appliquées au démarrage** (B13), et une migration fusionnée hors ordre met la production en boucle de redémarrage (B14).

## 2. Ce qui a été exécuté

| Commande                                                                                                                | Résultat                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `sqlc generate`, `go build ./...`, `go vet ./...`, `go vet -tags integration ./...`                                     | propre                                                                                                       |
| `sqlc vet` sur Postgres local (schéma + 87 migrations)                                                                  | propre                                                                                                       |
| `go test -tags integration -count=1 ./...`                                                                              | **3 échecs** : `TestRendezVousFiltresParType`, `TestRendezVousVenuesEtClasseur`, `TestMatriceRolesInchangee` |
| `pnpm install --frozen-lockfile`, `pnpm --dir web gen`, `vite build`, `pnpm --dir web typecheck`, `pnpm --dir web lint` | propre                                                                                                       |
| `actionlint` sur les workflows                                                                                          | propre                                                                                                       |
| `tools/dev/plafonds.sh`                                                                                                 | vert, mais le script ne contrôle pas tout ce qu'il annonce (B109)                                            |
| `govulncheck`                                                                                                           | non concluant : `vuln.go.dev` bloqué par le proxy de sortie. À relancer en CI                                |
| Parcours Playwright                                                                                                     | non lancés dans cette session                                                                                |

Réserve : le Postgres local est en version 16, la production en 18.4. Aucun écart n'est apparu sur le schéma.

## 3. Légende

- **CONFIRMÉ** : chemin tracé de bout en bout dans le code, ou reproduit.
- **HAUTE CONFIANCE** : chemin tracé, une condition d'exécution n'a pas pu être observée (concurrence, configuration de production).
- **POTENTIEL** : dépend d'une hypothèse non vérifiable ici.
- Tous les tests de régression proposés sont des tests d'intégration Go (`cmd/server/*_integration_test.go`, `//go:build integration`) ou des parcours Playwright (`e2e/`), conformément à `CLAUDE.md`. Chacun doit être cassé une fois sur le code actuel pour vérifier qu'il rougit.

## 4. Constats critiques

### B01. Critique, HAUTE CONFIANCE : ADMIN anonyme sur les bases de démonstration, branché sur les intégrations de production

- **Où** : `internal/auth/auth.go:132-155` (`demoLogin`), `:72-83` (profil `ADMIN` = `admin@cpi.sn`), `:313-314` (`demo-login` et `GET /api/v1/auth/bases` en `socle.Publique`) ; `cmd/server/main.go:155-164` (le cookie `cpi_base` choisit la base) ; `cmd/server/bases.go:359-363` et `cmd/server/seed.go:56` (toute base non principale est semée avec les fixtures).
- **Cause** : le seul contrôle est `if s.Cfg.Base == socle.BasePublique`. Aucun secret, profil ADMIN autorisé. Or Kairo (`internal/support/support_kairo.go:181-205`), GLPI (`internal/support/support_glpi.go:36-42`, `support_transmission.go:86-107`), les plateformes d'enrôlement (`internal/shared/socle/reglages.go:17-22`, `internal/admin/admin_enrolement.go:454-456`), les pièces bancaires (`internal/banque/banque_pieces.go:75`) et `DB_DUMP_DIR` lisent l'environnement du processus sans regarder la base. Seuls les courriels et l'OAuth GLPI (`internal/auth/glpi.go:106`) le font.
- **Reproduction** : `GET /api/v1/auth/bases` donne le nom d'une base de démonstration ; cookie `cpi_base=<nom>` ; `POST /api/v1/auth/demo-login {"role":"ADMIN"}` ; puis `POST /api/v1/admin/kairo/pause`, `POST /api/v1/support/tickets` ou `POST /api/v1/enrolement/CHUES/tirage`.
- **Impact** : consignes envoyées à l'agent Kairo qui code les correctifs, tickets et comptes créés dans le vrai GLPI, inscriptions réelles (données personnelles) copiées dans une base anonyme, tirage de production bloqué (`tiragesEnCours` global, `admin_enrolement.go:35`).
- **Condition** : au moins une base de démonstration montée et les variables `KAIRO_*`, `GLPI_*` ou `PLATEFORME_*` posées. `docs/v2-refonte/plan.md:106` déclare pourtant `demo-login` abandonné.
- **Correctif** : dans l'ordre de préférence : retirer `demo-login` (décision du plan) ; sinon exclure le profil ADMIN et poser la garde `if s.Cfg.Base != socle.BasePublique { return 403 BASE_DEMO }` dans `appelKairo`, `transmettreUn`, `tirer`, `sourcePieces` et le dump.
- **Test** : `TestBaseDemoNAtteintAucunServiceExterne` dans `bases_isolation_integration_test.go` : `t.Setenv` des URL Kairo, GLPI et plateforme vers un `httptest.Server` qui compte les appels ; connexion démo ; pause Kairo, signalement, tirage ; attendre 403 et zéro appel.

### B02. Critique, CONFIRMÉ : le formulaire public envoie vers une route disparue

- **Où** : `web/src/components/demande/formulaire-demande.tsx:209` : ``fetch(`/api/demande/${encodeURIComponent(jeton)}`, …)``. La route Go est `POST /api/v1/formulaire-public/{jeton}` (`internal/prospects/formulaire_public.go:826`). Aucune réécriture dans `cmd/server` ; tout autre `/api/` tombe sur « Route inconnue. » (`cmd/server/main.go:83-85`).
- **Cause** : relais Next de la v1 supprimé le 9 septembre ; le composant (dernier changement `3ae9449d`, 11 septembre) n'a pas été porté. Le test d'intégration `prospects_integration_test.go:445` appelle directement la bonne route, donc il ne voit pas le défaut.
- **Reproduction** : ouvrir `/demande/<jeton>`, remplir, envoyer : 404.
- **Impact** : aucune demande de prospect par lien public depuis deux semaines, sans alerte interne.
- **Correctif** : `getApiClient().POST('/api/v1/formulaire-public/{jeton}', { params: { path: { jeton } }, body })`, typé par `schema.d.ts`.
- **Test** : parcours e2e anonyme : ouvrir `/demande/<jeton>`, envoyer, attendre l'état envoyé et vérifier la fiche en base.

## 5. Constats de gravité haute

### B03. Haute, CONFIRMÉ (exécuté) : trois tests d'intégration rouges sur `dev`

- **Où** : `cmd/server/rendez_vous_accueil_integration_test.go:47` et `:76` reçoivent `400 PHASE2_RV_SITE_INCOMPLETE` (« Un RV site exige la date, le site intéressé et le point de rencontre. ») ; `cmd/server/roles_integration_test.go:46` : `nombre de routes: obtenu 275, attendu 271`.
- **Cause** : le commit `7553c351` (24 septembre, RV site) a rendu le site et le point de rencontre obligatoires et ajouté quatre routes gardées (`GET /api/v1/phase2/rv-site`, `GET /api/v1/prospects/{id}/rendez-vous`, `GET` et `PUT /api/v1/rv-site/reglages`) sans mettre à jour les tests ni `testdata/matrice-roles-2026-09-18.json`.
- **Impact** : la CI de `dev` ne protège plus rien tant qu'elle est rouge ; les fusions suivantes (dont #143) sont passées par-dessus.
- **Correctif** : compléter les corps RV_SITE des deux tests ; vérifier les permissions des quatre routes puis les inscrire dans la matrice figée.
- **Test** : les trois tests eux-mêmes.

### B04. Haute, CONFIRMÉ : une correction de vente recalcule les parts avec la règle actuelle du site

- **Où** : `internal/ventes/saisie.go:465-479` (`partsVente`), appelé par `preparer` depuis `corriger` ; le panneau n'envoie jamais `partProprietaire`, `partApporteur`, `partCpi` (`web/src/components/ventes/vente-parcours.tsx:137-167`).
- **Reproduction** : vente saisie avec une règle apporteur à 10 %, règle passée à 5 %, correction de l'e-mail du client : l'apporteur perd la moitié de sa part, la part CPI gagne la différence. Le test `TestVenteAncienneCorrigeableSurSiteEtCanalRetires` (`ventes_integration_test.go:185-210`) produit déjà `partCpi = -3 500 000` sans le vérifier.
- **Impact** : montants dus aux propriétaires et apporteurs faux, totaux par site faux, sans trace lisible.
- **Correctif** : dans `preparer`, si `avant != nil` et que site, nombre de lots et prix n'ont pas changé, reprendre les parts de `avant`. Le recalcul quand lots ou prix changent est à trancher par la direction.
- **Test** : `TestVenteCorrectionGardeSesParts` ; ajouter la vérification de `partCpi` au test existant.

### B05. Haute, CONFIRMÉ : redéposer le classeur des ventes efface versements, corrections et archivages

- **Où** : `sql/queries/ventes.sql:4-5` (`DELETE FROM "ventes" WHERE "origine" = 'IMPORT'`), cascade `ventes_versements` (`sql/migrations/20260916180000_ventes.sql:35`), `internal/ventes/ventes.go:400-418`. Les écritures `ModifierVente`, `ArchiverVente`, `ajouterVersement` ne filtrent pas l'origine.
- **Reproduction** : versement de 500 000 sur une vente IMPORT, puis nouveau dépôt du classeur : le versement disparaît, une vente archivée réapparaît, le journal pointe vers un identifiant supprimé.
- **Impact** : perte silencieuse de données financières.
- **Correctif minimal** : refuser (409) toute écriture sur `origine = 'IMPORT'` et afficher un badge « Classeur » ; à défaut, refuser le dépôt tant qu'une vente IMPORT porte des versements saisis hors classeur. Dans les deux cas, mettre l'état supprimé dans l'`avant` de `vente.importer`.
- **Test** : `TestDepotClasseurNeFaitPasDisparaitreUnVersement`.

### B06. Haute, CONFIRMÉ : les campagnes « Contacts recommandés Grand Public » ne peuvent pas être créées

- **Où** : `internal/campagnes/campagnes.go:272-274` (`lotSurRepresentants` vrai pour toute cible autre que prospects) et `:557` ; le panneau envoie `{ cible: 'CONTACTS_RECOMMANDES', prospects: { projet: 'GRAND_PUBLIC' } }` (`web/src/components/lots-export/lot-create-dialog.tsx:265-267`).
- **Cause** : `Representants == nil`, donc refus 422 `LOT_EXPORT_FILTRES_REQUIS`. Au-delà : identifiants de prospects écrits dans `representantId` (violation de clé étrangère, `:637-641`), aperçu compté sur les recommandations de représentants (`:464-469`), projet enregistré CHUES (`:660-669`).
- **Impact** : la fonctionnalité parrainage (commit `f1910ad`) est inutilisable depuis le panneau.
- **Correctif** : faire dépendre `lotSurRepresentants` de la cible et du projet, écrire `prospectId`, compter sur `prospect_suggestions`, `projetDuLot` à GRAND_PUBLIC.
- **Test** : `TestCampagneParrainageGrandPublic` (aperçu = 1, création 201, `lot_export_items.prospectId` renseigné).

### B07. Haute, CONFIRMÉ : un appel consigné fait régresser une fiche VENDU ou CONVERTI

- **Où** : `internal/qualification/qualification.go:1011-1033` (`qualificationPreVol` ne lit pas le statut), `:1321-1324` ; `sql/queries/qualification.sql:239-240` (`MarquerProspectPerdu`), `:505-508` (`PrendreLaFiche`) ; lien affiché quel que soit le statut (`web/src/components/prospects/prospect-detail-view.tsx:124-131`).
- **Reproduction** : le dernier appelant d'un client vendu consigne `A_SUPPRIMER` : `VENDU` devient `PERDU`, le journal écrit « VENDU → PERDU » ; avec un autre compte, `createdById` change aussi.
- **Impact** : le client sort de « Clients » et du compteur des ventes, contrairement à `docs/decisions/plan-de-migration-et-de-reaffectation.md`.
- **Correctif** : ajouter `statut` à `ProspectPourTentative` et renvoyer 422 `PROSPECT_CONVERTI` comme la requalification ; en défense, `AND "statut" NOT IN ('CONVERTI','VENDU')` dans les deux requêtes ; masquer « Consigner un appel » sur une fiche vendue.
- **Test** : `TestQualificationFicheVendueNeRegressePas`.

### B08. Haute, CONFIRMÉ (exécuté sur copie de la fonction) : les onglets d'octobre à décembre ne donnent plus de date

- **Où** : `internal/shared/socle/feuilles.go:56-66` : `strings.HasPrefix(brut, plat[:min(4, len(plat))])` ; utilisé par `internal/imports/imports_adaptateurs_leads.go:160-166` et `:204-213`.
- **Cause** : il faut les quatre premières lettres du mois : « oct », « nov », « déc », « avr », « aou », « 1er » échouent ; « Leads 30 décembre » relu le 2 janvier donne une date future rejetée.
- **Impact** : sans date d'onglet, la correction d'inversion jour/mois ne s'applique plus : l'incident du 15 septembre (372 fiches mal datées) reviendra dès le 1er octobre, sans avertissement `DATE_CORRIGEE`.
- **Correctif** : table fixe d'abréviations (trois lettres, départage juin/juillet sur la quatrième), accepter « 1er », reculer d'un an une date sans année qui tombe dans le futur.
- **Test** : `TestImportLeadsOngletOctobreCorrigeLInversion` (onglet `Leads 1 oct 2026`, cellule au 10/01/2026, attendre le 01/10/2026 et un compteur `DATE_CORRIGEE`).

### B09. Haute, HAUTE CONFIANCE : un dossier Grand Public proposé « à ouvrir » ne s'ouvre pas

- **Où** : `internal/banque/banque_plateforme.go:161-166` (sans `statutsComplets`, exige `decideeLe != nil`) contre `sql/queries/banque.sql:208-215` (liste sur pièces acceptées) ; `internal/admin/admin_enrolement_flux.go:256-281` ne renseigne jamais `DecideeLe` pour le Grand Public.
- **Reproduction** : inscription GP aux pièces acceptées : listée par `GET /bank-cases/a-ouvrir`, refusée par `POST /bank-cases` (422 `BANK_CASE_INSCRIPTION_INCOMPLETE`). Inversement, une inscription CHUES refusée porte une date de décision et s'ouvre par l'API.
- **Correctif** : un seul prédicat, celui de la requête SQL, réutilisé par l'ouverture.
- **Test** : `TestBanqueInscriptionProposeeEstOuvrable`.

### B10. Haute, CONFIRMÉ : vider le miroir des inscriptions coupe le lien des dossiers bancaires

- **Où** : `sql/queries/admin.sql:216-220`, clé `ON DELETE SET NULL` (`20260910200000_banque_plateforme_courriels.sql:2`), appelants `internal/admin/admin_enrolement.go:237` et `:269`. La requête sœur `EffacerInscriptionsPurgees` exclut déjà les inscriptions liées.
- **Impact** : `bank_cases.inscriptionId` passe à NULL, les inscriptions reviennent avec de nouveaux identifiants et redeviennent « à ouvrir » : dossiers en double et signalement renvoyé.
- **Correctif** : `AND NOT EXISTS (SELECT 1 FROM "bank_cases" c WHERE c."inscriptionId" = i."id")` sur les deux suppressions, 409 sur la suppression unitaire, puis clé en `ON DELETE RESTRICT` (`NOT VALID` puis `VALIDATE`).
- **Test** : `TestEnrolementPurgeGardeLeDossier`.

### B11. Haute, CONFIRMÉ : le panneau n'émet jamais le battement de présence

- **Où** : la route existe (`internal/qualification/qualification_presence.go:41`), le plan la prévoit toutes les 60 s (`docs/v2-refonte/plan.md:101`), mais aucun appel dans `web/src` ; seul `e2e/chiffres.spec.ts:141` l'appelle à la main. `internal/analytics/analytics_presence.go:923-924` rend alors `presence_non_mesuree`.
- **Impact** : supervision et note de rendement sans mesure de présence pour tous les téléconseillers.
- **Correctif** : dans `web/src/routes/_panneau.tsx`, un effet `setInterval` de 60 s vers `POST /api/v1/presence/beat`, nettoyé au démontage, réservé aux rôles qui tiennent des fiches. Décision à prendre : battre ou non onglet masqué.
- **Test** : dans `e2e/chiffres.spec.ts`, remplacer l'appel manuel par une vraie page téléconseiller ouverte 70 s.

### B12. Haute, HAUTE CONFIANCE : le cache TanStack Query survit à la déconnexion

- **Où** : `web/src/components/layout/user-menu.tsx:70-71` et `web/src/components/auth/login-form.tsx:215-224` : navigation SPA sans `queryClient.clear()`. Clés sans identité du compte : `web/src/lib/query-keys.ts:106` (`inbox`), `components/chues/hub-view.tsx:51,57`.
- **Reproduction** : poste partagé du plateau ; A se déconnecte, B se connecte dans le même onglet : B voit les rappels et retards de A pendant 30 s.
- **Correctif** : `queryClient.clear()` à la déconnexion et à la connexion (déjà fait dans `dev-role-switcher.tsx:78`).
- **Test** : dans `e2e/connexion.spec.ts`, A puis B dans le même contexte, le prospect de A ne doit pas apparaître.

### B13. Haute, CONFIRMÉ (pipeline) / POTENTIEL (état réel) : migrations destructives au démarrage sans sauvegarde vérifiée

- **Où** : `cmd/server/main.go:320` applique goose à chaque démarrage ; neuf migrations suppriment des données (dont `20260917260200`, purge en cascade) ; `infra/dokploy/README.md:197-200` : sauvegarde « à activer » ; restauration jamais exercée (`docs/v2-refonte/plan.md:323-324`) ; procédure citée dans deux fichiers inexistants (`infra/dokploy/README.md:271-273`, `deploy.py:1592`).
- **Impact** : une fusion vers `prod` peut détruire des données sans retour possible.
- **Correctif** : activer `deploy.py backup`, écrire la procédure `pg_restore`, faire refuser `cmd_redeploy` si la dernière sauvegarde réussie a plus de 26 h. Faire un exercice de restauration.

### B14. Haute, HAUTE CONFIANCE : une migration fusionnée hors ordre fait planter la production

- **Où** : `internal/shared/database/migrations.go:22-24` sans `WithAllowOutofOrder` ; la CI part toujours d'une base vide. Incident déjà survenu (`20260918150000_statuts_qualification_parent_reprise.sql:2-3`), versions aux heures « 25 » et « 26 » renumérotées à la main.
- **Impact** : « missing migrations », sortie en 1, boucle de redémarrage.
- **Correctif** : étape CI sur les PR qui refuse toute migration ajoutée dont la version n'est pas supérieure à la plus haute de la base de fusion (script en annexe A).

### B15. Haute, CONFIRMÉ : le script de reprise Dokploy est obsolète et effacerait des variables de production

- **Où** : `infra/dokploy/deploy.py:497-518` recrée NestJS, Next et Redis ; `:886-919` pointe vers des Dockerfile supprimés ; `cmd_deploy` (`:1037-1047`) ne déploie pas `cpi-go` ; `_go_env` (`:620-663`) réécrit tout l'environnement sans `GLPI_*`, `KAIRO_*`, `BREVO_WEBHOOK_SECRET`, `PLATEFORME_WEBHOOK_SECRET`, `SUPPORT_AI_*`, `DATABASE_URL_DEMO`.
- **Impact** : aucune reprise après sinistre qui fonctionne ; un `configure-go` coupe silencieusement les intégrations et, sans Turnstile exporté, le formulaire public.
- **Correctif** : retirer v1 et Redis, déployer `GO_ID`, fusionner l'environnement existant au lieu de l'écraser.

### B16. Haute, CONFIRMÉ : données personnelles réelles versionnées dans git

- **Où** : `sql/migrations/20260923160000_rendez_vous_alignes.sql:37-84` et `20260923190000_rendez_vous_dates.sql:10-57` (numéros `+221…` de clients, noms de téléconseillers, créneaux) ; `tickets-crm-historique-git.xlsx` (22 utilisateurs réels). Fichiers étrangers ajoutés par `c5d2242` sous un message `fix(banque)` : `design.md` (projet sans rapport), `prompt.md`, `t.save`, `openapi.err` (vide), `plan-glpi.md`.
- **Impact** : exposition de données personnelles à toute personne ayant accès au dépôt (loi sénégalaise 2008-12, CDP), conservée dans l'historique.
- **Correctif** : correctifs de données passés par un script hors dépôt ou par une table de correspondance chargée à part ; `git rm` des fichiers étrangers ; purge d'historique à décider par le propriétaire.

### B17. Haute, CONFIRMÉ : la date d'un rendez-vous est le MAX de tous les rappels, supplantés compris

- **Où** : `sql/queries/rendez_vous.sql:28-31` (`MAX("scheduledAt") … GROUP BY "prospectId"` sans filtre de statut) ; même règle `sql/queries/qualification.sql:530` et `:541` (capacité RV site) ; `ReporterRappel` réécrit la date à « maintenant + 15 min » depuis le pop-up.
- **Reproduction** : « À rappeler » à J+20, puis « RV CPI » à J+5 : l'accueil et l'export affichent J+20.
- **Impact** : client attendu le mauvais jour, capacité RV site faussée, agrégat de toute la table à chaque lecture.
- **Correctif** : `LEFT JOIN LATERAL (… WHERE "status" IN ('PENDING','DONE') ORDER BY ("status"='PENDING') DESC, "createdAt" DESC LIMIT 1)` dans les trois requêtes ; refuser le report de 15 min sur un rendez-vous.
- **Test** : `TestRendezVousDateEstCelleDuDernierRappel`.

### B18. Haute, CONFIRMÉ : la requête SQL libre de l'assistant repose sur une liste noire contournable

- **Où** : `internal/assistant/sql_libre.go:36-38` et `:63-94`, réservé à `assistant.tout_lire` (ADMIN seul).
- **Cause** : la transaction est bien en lecture seule avec `statement_timeout`, mais la liste noire laisse passer `set_config(...)` (`\bset\b` ne correspond pas à `set_config`), qui annule le délai local, `pg_terminate_backend`, `pg_stat_activity`, et la lecture de `users."passwordHash"` et `users."formulaireJeton"` (seul le schéma décrit au modèle les masque). L'application se connecte en superutilisateur (B54), donc la lecture seule est la seule barrière. La question de l'utilisateur est un vecteur d'injection vers le modèle.
- **Impact** : un ADMIN (ou une session ADMIN volée, ou B01 sur une base de démonstration) lit les hachages et jetons, coupe les connexions des autres, ou occupe la base sans limite de temps.
- **Correctif** : exécuter la requête sous un rôle Postgres dédié `assistant_lecture` (`SET LOCAL ROLE`), `GRANT SELECT` sur une liste blanche de tables et une vue `users` sans colonnes sensibles, `REVOKE EXECUTE` sur les fonctions d'administration. La liste noire devient un confort, pas une barrière.
- **Test** : `TestAssistantSQLNeLitPasLesHachages` : une requête `select "passwordHash" from users` fournie par un faux modèle doit échouer.

## 6. Constats de gravité moyenne

Format : gravité, statut, emplacement, cause et scénario, impact, correctif, test.

### Prospects et qualification

**B19. Moyenne, CONFIRMÉ : l'issue d'un rendez-vous précédent reste sur le nouveau.** `CloreProspectParTentative` (`sql/queries/qualification.sql:242-248`) ne remet pas `rendezVousIssue`, `rendezVousReporteAt`, `suiteRencontre` à zéro. Un RV marqué `NON_HONORE` puis repris s'affiche « Non honoré » et sort du filtre `issue=SANS`. Correctif : remise à NULL quand `phase2Status = 'APPOINTMENT'`. Test : `TestNouveauRendezVousEffaceLIssuePrecedente`.

**B20. Moyenne, CONFIRMÉ : « À traiter » ne remet pas la fiche en file si le projet diffère de `prospects.projet`.** `internal/prospects/prospects_requalifier.go:40-45`, `sql/queries/prospects.sql:732-739` (`AND "projet" = @projet`), nombre de lignes ignoré. Depuis la vue Grand Public d'une fiche CHUES : 200, journal écrit, mais `remiseATraiterAt` reste NULL. Le test `TestProspectRequalificationParLEncadrement` passe sur le code cassé. Correctif : retirer le filtre projet, 409 si 0 ligne. Test : compléter le test existant.

**B21. Moyenne, CONFIRMÉ : une fiche peut être créée directement en CONVERTI.** `internal/prospects/prospects.go:708` (enum accepte `CONVERTI`), `:946`, `:983`, `:1028` sans `prospectStatutModifiable`. Fiche convertie sans offre ni `prospect_conversions`, indicateurs faussés. Correctif : appeler `prospectStatutModifiable` à la création. Test : `TestProspectCreationRefuseConverti`.

**B22. Moyenne, HAUTE CONFIANCE : une conversion Grand Public rejouée fait régresser une fiche VENDU.** `internal/prospects/prospects_conversion.go:98-113`, `sql/queries/prospects.sql:398-399` sans garde, `UpsertConversion` écrase l'auteur. Double clic : retour à CONVERTI, auteur perdu, courriel d'adhésion renvoyé. Correctif : `:execrows` avec `WHERE "statut" NOT IN ('CONVERTI','VENDU')`, 422 sinon. Test : `TestConversionGrandPublicNeRegressePasUneVente`.

**B23. Moyenne, CONFIRMÉ : la troncature par octets casse l'UTF-8 et bloque les avis du formulaire public.** `internal/prospects/prospects.go:140-145` (`texte[:maximum]`), utilisé `formulaire_public.go:292-293`. Un message accentué de 480 caractères produit une chaîne invalide refusée par Postgres (22021) : ni notification ni accusé de réception. Correctif : `strings.ToValidUTF8(texte[:maximum], "")` ou troncature par runes. Test : `TestFormulairePublicMessageAccentuePrevientLaSupervision`.

**B24. Moyenne, HAUTE CONFIANCE : l'horloge du navigateur fait foi sans borne.** `web/src/lib/data/console.ts:869` (`clientCreatedAt: input.at`), utilisé côté serveur `qualification.go:1212`, `:1293-1296`, `:867`, `:901`. Un poste en avance d'un jour fige `lastReasonId` et `lastCallById` pour tous les appels suivants. Correctif : remplacer par `time.Now()` au-delà d'une tolérance (le panneau est en ligne uniquement). Test : `TestTentativeHorlogeEnAvanceNeFigePasLaFiche`.

**B25. Moyenne, HAUTE CONFIANCE : consignation sans verrou de ligne.** `ProspectPourTentative` (`qualification.sql:89-92`) lu dans la transaction sans `FOR UPDATE` ; contrôle `expectedRev` (`qualification.go:1024`) et `MajDernierAppel` sur une lecture périmée ; second rappel avalé par `ON CONFLICT DO NOTHING` alors que l'API répond « applied ». Correctif : `FOR NO KEY UPDATE`. Test : `TestTentativesConcurrentesGardentLaPlusRecente` (verrou tenu par le test, ordre forcé).

**B26. Moyenne, CONFIRMÉ : fusion impossible (500) si les deux fiches ont un rappel en attente.** `sql/queries/prospects.sql:512` contre l'index unique `scheduled_callbacks_one_pending_per_prospect` ; `FusionnerProspect` ne recalcule pas le dernier appel ; fusions croisées simultanées suppriment les deux fiches (`SoftDeleteProspect` sans garde). Correctif : supplanter le rappel source, recalculer `lastCall*`, `:execrows` avec `"deletedAt" IS NULL`. Test : `TestFusionDeuxRappelsEnAttente`.

**B27. Moyenne, CONFIRMÉ : les ouvertures de fiche s'accumulent sans borne.** `qualification.sql:306-323` sans LIMIT, lu en entier par `/ouvertures/courante` (`qualification_ouvertures.go:433-441`) ; `FermerAutreOuverture` sans appelant ; message 23505 « fiche déjà ouverte » périmé depuis la suppression de l'index (`20260910230500_remove_fiche_lock.sql`). Correctif : `ORDER BY "openedAt" DESC LIMIT 1`, supprimer le code mort, corriger le message.

### Campagnes, ventes, accueil

**B28. Moyenne, CONFIRMÉ : au retrait d'un téléconseiller, le surplus de fiches reste au compte retiré.** `internal/campagnes/campagnes.go:1284-1292` : `lotRepartir` plafonne à la capacité des restants. Retirer A (100 fiches) quand B fait 20 par jour laisse 80 fiches sans personne ; après désactivation, elles ne sont plus jamais reprises. Correctif : répartir tout `arendre` (jours allongés ou tourniquet). Test : `TestCampagneRetraitRendToutesLesFiches`.

**B29. Moyenne, HAUTE CONFIANCE : deux campagnes créées en même temps tirent les mêmes prospects.** `campagnes.go:584-599` en READ COMMITTED, exclusion `NOT EXISTS` sans verrou (`sql/queries/campagnes.sql:465-467`). Correctif : `SELECT pg_advisory_xact_lock(hashtext('lots_export.tirage'))` en tête de transaction. Test : `TestCampagnesSimultaneesSansFicheCommune`.

**B30. Moyenne, CONFIRMÉ : ajout d'une fiche à une campagne sans verrou ni unicité.** `campagnes.sql:514-519` (`MAX(position)+1`), contrôle hors transaction `campagnes_affecter.go:147-154`, affectation en trois transactions (`:143-154`, `:49`, `:54-67`). Collision de clé (500) ou fiche en double dans le lot, statistiques doublées. Correctif : une transaction avec `FOR UPDATE` sur `lots_export`, index uniques partiels `(lotId, prospectId)` et `(lotId, representantId)` créés `CONCURRENTLY` après contrôle des doublons. Test : `TestLotRefuseDoublonFiche`.

**B31. Moyenne, HAUTE CONFIANCE : mise à jour perdue sur l'équipe d'une campagne.** `campagnes.go:1217`, `:1253`, `:1342-1350`, `campagnes_equipe.go:25`, `campagnes_reglages.go:92` : `filters` réécrit depuis une lecture hors transaction. Réaffectation et retrait simultanés : X porte des fiches sans être dans l'équipe. Correctif : relire `filters` `FOR UPDATE` dans la transaction. Test : `TestReaffectationsConcurrentesGardentLEquipe`.

**B32. Moyenne, CONFIRMÉ : parts de vente sans invariant.** `internal/ventes/saisie.go:474` (`cpi = total - proprietaire - apporteur`), `:466` sans garde de débordement, aucune contrainte CHECK. Prix négocié sous la somme des parts : part CPI négative sans message. Correctif : 400 si une part est négative ou si leur somme dépasse le prix. Test : `TestVenteRefusePartsSuperieuresAuPrix`.

**B33. Moyenne, CONFIRMÉ : versements, reliquat et numéro de vente calculés hors verrou.** `saisie.go:185` (vente lue avant la transaction), `:199` (`MAX(rang)+1`), `:213` (reliquat sur l'ancien prix), `:92` (`ProchainNumeroVente` hors transaction, `numero` non unique). Correctif : `SELECT … FOR UPDATE`, reliquat recalculé en SQL, verrou consultatif pour le numéro. Test : `TestVersementsSimultanesMemeVente`.

**B34. Moyenne, CONFIRMÉ : renommer un site ou un canal détache les ventes existantes.** `ventes.site` et `ventes.canal` en texte libre ; `ModifierSiteVente` (`sql/queries/ventes.sql:104-111`) ne touche pas `ventes` ; corriger une ancienne vente répond ensuite 400 (`saisie.go:424-427`). Correctif : renommer dans `ventes` dans la même transaction. Test : `TestRenommerSiteSuitLesVentes`.

**B35. Moyenne, CONFIRMÉ : import du registre, une date impossible devient le 01/01/0001.** `internal/accueil/accueil_import.go:571-580` accepte « 31/04 » ; `accueil.go:595-598` rend `time.Time{}` en cas d'erreur ; écrit `:1120`, `:1167`. La visite disparaît de tous les filtres. Correctif : valider par `time.Parse`, borner les minutes à 1439, renvoyer une erreur. Test : `TestImportRegistreRefuseDateImpossible`.

**B36. Moyenne, CONFIRMÉ : les écritures de ventes sont gardées par « Lire les ventes ».** `internal/ventes/ventes.go:29-47`, `internal/shared/socle/permissions.go:132`. Un rôle personnalisé lecteur peut remplacer le classeur et changer les règles de partage. Correctif : permission `ventes.gerer` sur les écritures, semée pour ADMIN et DIRECTION.

### Banque, imports, exports

**B37. Moyenne, CONFIRMÉ : dossiers bancaires sans fiche CRM, signalement perdu et projet faux.** `sql/queries/banque.sql:226-227` : `suiviParId` NULL après `LEFT JOIN`, typé `string` par sqlc, donc erreur de lecture pgx ; `signalerIssue` s'arrête sans courriel ni notification ; projet retombe sur CHUES ; filtres projet via `prospect_journeys` excluent ces dossiers, `/grand-public/dossiers/{id}` répond 404. Correctif : champ nullable, projet déduit de `inscriptions_plateforme.projet`. Test : étendre `TestBanqueEncaissementSignaleLeTeleconseiller`.

**B38. Moyenne, CONFIRMÉ : l'import prospects CHUES jette en silence la méthode « Enrôlement sur place » et les référentiels inconnus.** `internal/imports/imports_adaptateurs_prospects.go:24-29`, `:112-145`, `:184-198`. Fiche en `PENDING` au lieu de `METHOD_OBTAINED`, banque inconnue ignorée sans erreur. Correctif : table des méthodes construite depuis `ExportLibellesMethode`, refus des référentiels inconnus comme l'adaptateur Grand Public. Test : `TestImportProspectsRelitLeModele`.

**B39. Moyenne, CONFIRMÉ : l'export du registre des visites inclut les visites archivées.** `sql/queries/exports.sql:237-258` sans `v."deletedAt" IS NULL`. Le rôle Accueil récupère les archives. Test : compléter `TestExportVisitesRegistre`.

**B40. Moyenne, HAUTE CONFIANCE : la visionneuse de pièces CHUES retélécharge l'archive complète à chaque pièce.** `internal/banque/banque_pieces_plateforme.go:116-136`, `banque_pieces.go:198`, `Cache-Control: no-store`. N pièces coûtent N+1 archives de jusqu'à 64 Mo, lues en mémoire. Correctif : relayer en flux (`io.Copy`), mesurer avant tout cache. Test : faux serveur CHUES qui compte les appels.

### Notifications, analytique, exploitation

**B41. Moyenne, CONFIRMÉ : un rebond ou une plainte Brevo renvoie le courriel à tous ses destinataires.** `internal/notifications/courriels.go:537-541` (bounce et spam en `ECHEC`), `sql/queries/courriels.sql:30-34` (rejeu des `ECHEC` avec tentatives < 3). Jusqu'à quatre envois avec PDF client, renvoi au plaignant, risque de suspension du compte Brevo. Correctif : `tentatives = GREATEST(tentatives, 3)` sur un échec signalé par webhook. Test : à côté de `TestBanqueCourrielRenvoyeEtWebhookBrevo`.

**B42. Moyenne, CONFIRMÉ : l'alerte d'incident rate les courriels créés le soir et le week-end.** `sql/queries/exploitation.sql:176-177` filtre sur `createdAt > now() - 24h` ; un courriel créé à 20 h, reporté hors heures, qui échoue le lendemain n'est jamais cité. Correctif : filtrer sur `updatedAt`.

**B43. Moyenne, CONFIRMÉ : l'entonnoir compte en double les prospects à plusieurs dossiers.** `internal/analytics/analytics.go:506-511` : `COUNT(*)` après `LEFT JOIN "bank_cases"`. Correctif : `COUNT(DISTINCT p."id")`. Test : étendre `TestAnalyticsEntonnoirEtFinance`.

**B44. Moyenne, HAUTE CONFIANCE : chaque destinataire d'une annonce voit les adresses des 98 autres.** `internal/notifications/notifications.go:1142-1149`, `brevo.go:192-194` (`To` à 99 adresses). Correctif : `messageVersions` Brevo, une version par destinataire. Test : faux Brevo qui vérifie un seul `to` par version.

### Panneau web

**B45. Moyenne, CONFIRMÉ : les sujets SSE `ventes` et `visites` sont émis mais ignorés.** `web/src/lib/live-stream.ts:9-15` ; émis par `internal/ventes/saisie.go` et `internal/accueil/accueil_archivage.go:47,73`. Correctif : ajouter les deux clés à `LIVE_TOPIC_KEYS`.

**B46. Moyenne, CONFIRMÉ : compteurs de rappels faux et page bloquée sur une liste vide.** `web/src/components/rappels/rappels-view.tsx:400` (compte la page, pas `total`), `:367-373`, `:427-429` (page non remise à 1), `:258` ; même défaut `components/chues/hub-view.tsx:62,137`. Test : `e2e/rappels.spec.ts` avec 60 retards.

**B47. Moyenne, CONFIRMÉ : une clé de cache partagée par trois requêtes différentes.** `callbackKeys.teleconseillers` dans `mes-contacts-view.tsx:380-382`, `rappels-view.tsx:382-384`, `representants-suivi-view.tsx:81-83`, avec `staleTime` de 5 min : le premier écran impose sa liste aux autres. Correctif : clés distinctes.

**B48. Moyenne, HAUTE CONFIANCE : un nouvel essai après une réponse perdue enregistre l'appel en double.** `web/src/components/console/console-view.tsx:1122`, `web/src/lib/data/console.ts:876-887` : `attemptId` recréé à chaque essai alors que le serveur déduplique par identifiant. Correctif : identifiant stable par brouillon. Test : `page.route` qui avorte la réponse, deux clics, une tentative en base.

**B49. Moyenne, CONFIRMÉ : l'écran promet une restauration de vente qui n'existe pas dans le panneau.** `web/src/components/ventes/ventes-view.tsx:210` ; route `POST /api/v1/ventes/{id}/restaurer` sans appelant. Correctif : filtre « Archivées » avec « Restaurer », ou retirer la promesse.

**B50. Moyenne, CONFIRMÉ : le pop-up de rappels sonde en 403 toutes les 15 s pour ACCUEIL et BANQUE_FINANCE.** `web/src/routes/_panneau.tsx:45`, `rappel-pop-up-intrusif.tsx:232-236` contre `PermissionFichesTenir`. Correctif : monter le pop-up seulement si `fiches.tenir`.

**B51. Moyenne, CONFIRMÉ : les notifications des téléconseillers ne sont lisibles nulle part.** `web/src/components/layout/nav-items.ts:50-62` exclut ces rôles « pour l'application mobile », abandonnée ; le serveur émet toujours « Rappels à passer » (`notifications_rappels.go:131-132`). Décision : ouvrir la cloche ou arrêter l'émission.

**B52. Moyenne, CONFIRMÉ : des gardes d'écran par rôle de base contournent les permissions réglables.** `web/src/lib/guard.ts:24-28` (`guardRoles`), 13 fichiers de routes. Un rôle personnalisé sans `fiches.tenir` ouvre la console et reçoit des 403 ; l'inverse est refusé. Correctif : `guardPermission` avec la permission exigée par l'API (touche des écrans v1 repris : accord du propriétaire requis).

### Infrastructure, CI, sécurité transverse

**B53. Moyenne, HAUTE CONFIANCE : l'application se connecte à Postgres en superutilisateur.** `infra/dokploy/deploy.py:487-489`, `:638`. Toute injection SQL donne `COPY … PROGRAM` et `DROP`. Correctif : rôle `NOSUPERUSER CREATEDB` propriétaire de `crm`. Vérification : `SELECT rolsuper FROM pg_roles WHERE rolname = current_user`.

**B54. Moyenne, CONFIRMÉ : la branche `prod` n'a aucune CI et a reçu une fusion directe.** `.github/workflows/ci.yml:3-11` ; PR #132 fusionnée dans `prod` le 24 septembre. Correctif : `pull_request: branches: [dev, prod]` et protection de branche.

**B55. Moyenne, CONFIRMÉ : le Dockerfile n'est jamais construit en CI, et la chaîne Go diffère.** CI en 1.26.2 (`go.mod`), image en `golang:1.26-bookworm` flottant (`Dockerfile:2,8`), soit 1.26.8. Correctif : `toolchain go1.26.8`, image épinglée par digest, job `docker build` sans push sur les PR.

**B56. Moyenne, CONFIRMÉ : aucune traçabilité de la révision en production.** `Dockerfile:38` sans `-X`, `.git` exclu. Correctif : `ARG REVISION` passé en `-X main.revision`, journalisé au démarrage et exposé par `/health/live`.

**B57. Moyenne, CONFIRMÉ (code) : bases de démonstration semées avec un mot de passe écrit dans le dépôt et l'admin de production.** `cmd/server/seed.go:327` (`SEED_FIXTURE_PASSWORD` par défaut), `:278-300` (admin semé avec `SEED_ADMIN_PASSWORD`, dont le hachage part dans le dump de la base démo). Correctif : exiger la variable hors développement, ne pas semer l'admin de production dans une base secondaire.

**B58. Moyenne, POTENTIEL : outils locaux sans garde contre une base distante.** `e2e/comptes.ts:9-10`, `e2e/global-setup.ts:18` (comptes ADMIN au mot de passe connu), `Makefile:13-17`. Correctif : refuser tout hôte autre que `localhost` ou `127.0.0.1`.

**B59. Moyenne, POTENTIEL : `CF-Connecting-IP` cru sans contrôle de l'émetteur.** `internal/shared/socle/middleware.go:64-72` quand `API_TRUST_PROXY_HEADERS=true` ; IP du VPS publiée (`infra/dokploy/README.md:155-156`). Si l'origine est joignable hors Cloudflare, la limite de connexion se contourne. Correctif : pare-feu aux plages Cloudflare ou Authenticated Origin Pulls.

**B60. Moyenne, HAUTE CONFIANCE : migrations au démarrage sans `lock_timeout`.** `migrations.go:17-30` ; contraintes validées sous ACCESS EXCLUSIVE sur `prospects` et `call_attempts` (`20260919010000`, `20260922130000`, `20260918160000`, `20260924140000`) ; requêtes de 120 s possibles. Le panneau gèle pendant la migration. Correctif : `lock_timeout=5s` sur la connexion de migration, `NOT VALID` puis `VALIDATE` pour les contraintes.

**B61. Moyenne, HAUTE CONFIANCE (sans plan mesuré) : index manquants sur des filtres fréquents.** `lot_export_items."assigneeId"` (`campagnes.sql:103-107`), `ouvertures_fiche."closingAttemptId"` (`prospects.sql:593`), `audit_logs.after->>'prospectId'` (`prospects.sql:617-618`). Correctif : trois index `CONCURRENTLY`, validés par `EXPLAIN (ANALYZE, BUFFERS)` sur copie de production.

## 7. Constats de gravité basse

| #    | Statut               | Emplacement                                                                                                                                                                                                                                                                                                                                                   | Défaut et scénario                                                                                                     | Correctif                                                              | Test ou vérification                                     |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| B62  | CONFIRMÉ             | `internal/admin/admin_dump.go:278`, `:460-476`                                                                                                                                                                                                                                                                                                                | Un dump demandé en base démo efface l'export prêt de la production (répertoire partagé)                                | refuser le dump hors base principale                                   | `bases_isolation_integration_test.go`                    |
| B63  | CONFIRMÉ             | `cmd/server/main.go:114`, `:411`                                                                                                                                                                                                                                                                                                                              | Un flux SSE ouvert sur une base démo fait échouer l'arrêt propre (30 s puis code 1)                                    | fermer le `Live` de chaque instance                                    | `srv.Shutdown` avec flux démo ouvert                     |
| B64  | HAUTE CONFIANCE      | `main.go:198-200`, `:374-379`, `notifications.go:1098-1103`                                                                                                                                                                                                                                                                                                   | Pools fermés avant le planificateur : verdict Brevo non écrit, notification renvoyée                                   | arrêter le planificateur d'abord, verdict sous `context.WithoutCancel` | faux Brevo qui annule le contexte                        |
| B65  | CONFIRMÉ             | `internal/notifications/service.go:16-18`                                                                                                                                                                                                                                                                                                                     | Un redéploiement à 08:00 pile supprime les rappels du jour                                                             | planifier sur plusieurs heures, l'index de période garantit l'unicité  | test d'idempotence existant                              |
| B66  | POTENTIEL            | `sql/queries/courriels.sql:30-34`                                                                                                                                                                                                                                                                                                                             | Rejeu sans `FOR UPDATE SKIP LOCKED` : doublon si « Renvoyer » ou deux conteneurs                                       | réserver les lignes avant envoi                                        | deux rejeux concurrents                                  |
| B67  | CONFIRMÉ             | `main.go:45`, `:79`, `:126`                                                                                                                                                                                                                                                                                                                                   | Globales réécrites à chaque base démo, signalées par `-race`                                                           | `sync.Once`                                                            | `-race` sur le test existant                             |
| B68  | CONFIRMÉ             | `internal/notifications/courriels.go:547`                                                                                                                                                                                                                                                                                                                     | Secret du webhook Brevo comparé en temps non constant                                                                  | `subtle.ConstantTimeCompare`                                           | relecture                                                |
| B69  | CONFIRMÉ             | `internal/analytics/analytics_objectifs.go:51-62`                                                                                                                                                                                                                                                                                                             | Erreurs SQL ignorées, 0 affiché et mis en cache 60 s                                                                   | propager l'erreur                                                      | relecture                                                |
| B70  | CONFIRMÉ             | `qualification.go:969` avant `:977`                                                                                                                                                                                                                                                                                                                           | Capacité RV site contrôlée hors transaction : `maxVisites` dépassé                                                     | contrôle sous verrou consultatif dans la transaction                   | deux goroutines, un 409                                  |
| B71  | CONFIRMÉ             | `prospects.go:1442`                                                                                                                                                                                                                                                                                                                                           | Réaffectation en lot journalisée sur la seule première fiche                                                           | une ligne d'audit par fiche                                            | étendre `TestProspectReaffectationEstAuditee`            |
| B72  | CONFIRMÉ             | `prospects.go:1025-1033`                                                                                                                                                                                                                                                                                                                                      | `prospectRattacher` écrit sur le pool depuis sa transaction, sans journal                                              | `pgx.BeginFunc`, `Auditer`                                             | relecture                                                |
| B73  | CONFIRMÉ             | `formulaire_public.go:668`, `:697`                                                                                                                                                                                                                                                                                                                            | Le formulaire écrase `origin` d'une fiche existante sans journal                                                       | poser `origin` seulement s'il est vide                                 | test formulaire sur fiche BANQUE                         |
| B74  | CONFIRMÉ             | `prospects_conversion.go:212-214`                                                                                                                                                                                                                                                                                                                             | `/vendre` journalise toujours `avant: CONVERTI`                                                                        | journaliser le statut lu                                               | relecture                                                |
| B75  | CONFIRMÉ             | `prospects.go:474`, `qualification_ouvertures.go:603`                                                                                                                                                                                                                                                                                                         | `page` sans maximum : débordement int32, OFFSET négatif, 500                                                           | `maximum:"10000"`                                                      | appel `page=2147483647`                                  |
| B76  | CONFIRMÉ             | `prospect_suggestions.sql:27-32`, `qualification.go:372-397`                                                                                                                                                                                                                                                                                                  | Parrain choisi sans `ORDER BY`, auto-recommandation possible                                                           | ordre stable, exclure le numéro source                                 | relecture                                                |
| B77  | CONFIRMÉ             | `qualification.go:1204-1210`                                                                                                                                                                                                                                                                                                                                  | Champs libres d'un appel fusionnés sans filtre                                                                         | réutiliser `formulaireLibresRetenus`                                   | relecture                                                |
| B78  | POTENTIEL            | `qualification.go:840`                                                                                                                                                                                                                                                                                                                                        | Motif `CLOSE_METHOD` sans méthode : 500 sur CHECK                                                                      | 400 `PHASE2_METHOD_REQUIRED`                                           | test avec motif créé par l'admin                         |
| B79  | CONFIRMÉ             | `internal/ventes/saisie.go:260-270`                                                                                                                                                                                                                                                                                                                           | Restaurer une vente inexistante : 500 et trace écrite                                                                  | `:execrows`, 404                                                       | appel sur id inconnu                                     |
| B80  | HAUTE CONFIANCE      | `campagnes.sql:340-351`, `:368-386`                                                                                                                                                                                                                                                                                                                           | Représentant supprimé encore dans le PDF et le classeur de campagne                                                    | filtrer `deletedAt`                                                    | relecture                                                |
| B81  | CONFIRMÉ             | `campagnes.go:744-746`, `campagnes_parrainage.go:40-42`                                                                                                                                                                                                                                                                                                       | Suggestions au numéro connu jamais résolues : aperçu gonflé, `LOT_EXPORT_CIBLE_VIDE`                                   | résoudre vers la fiche existante                                       | aperçu puis création                                     |
| B82  | CONFIRMÉ             | `campagnes.go:396-407`                                                                                                                                                                                                                                                                                                                                        | `RetirerDesEquipes` non atomique                                                                                       | vérifier tous les lots avant d'écrire                                  | relecture                                                |
| B83  | CONFIRMÉ             | `accueil_archivage.go:35-46`, `:60-71`, `referentiels.go:317-328`                                                                                                                                                                                                                                                                                             | Destruction de visite tracée hors transaction ; réordonnancement sans trace                                            | `pgx.BeginFunc`                                                        | relecture                                                |
| B84  | POTENTIEL            | `internal/ventes/ventes.go:631-637`                                                                                                                                                                                                                                                                                                                           | Montant texte « 1 500 000 » lu 0                                                                                       | refuser la ligne                                                       | classeur de test                                         |
| B85  | POTENTIEL            | `accueil_import.go:659`                                                                                                                                                                                                                                                                                                                                       | Date Excel au format court natif refusée avec un message trompeur                                                      | `ShortDatePattern: "dd/mm/yyyy"`                                       | classeur de test                                         |
| B86  | CONFIRMÉ (reproduit) | `internal/imports/imports.go:221-231`                                                                                                                                                                                                                                                                                                                         | Fichiers `multipart-*` jamais supprimés au-delà de 1 Mo                                                                | `defer r.MultipartForm.RemoveAll()`                                    | `TestImportNeLaissePasDeFichierTemporaire`               |
| B87  | CONFIRMÉ             | `banque_analytics.go:665-672`                                                                                                                                                                                                                                                                                                                                 | Encaissement corrigé compté plusieurs fois par agent                                                                   | dernière transition `CASHED` seulement                                 | étendre `TestBanqueCorrectionAdminAuditee`               |
| B88  | CONFIRMÉ             | `imports.go:586-593`, `:686-698`                                                                                                                                                                                                                                                                                                                              | Une reprise d'import perd erreurs et compteurs                                                                         | persister le rapport partiel                                           | étendre `TestImportRepriseParTranchesSansDoublon`        |
| B89  | CONFIRMÉ             | `imports_adaptateurs.go:1193-1206`, `:1374-1388`                                                                                                                                                                                                                                                                                                              | Projet final dépendant de `IMPORTS_CHUNK_SIZE`                                                                         | garder projet et date de la première ligne                             | classeur à deux onglets                                  |
| B90  | HAUTE CONFIANCE      | `internal/banque/banque.go:448-450`                                                                                                                                                                                                                                                                                                                           | Tout 23505 lu comme « référence déjà utilisée »                                                                        | tester `ConstraintName`                                                | deux POST simultanés                                     |
| B91  | CONFIRMÉ             | `banque.go:553`, `:756`, `:1368`, `:1379`                                                                                                                                                                                                                                                                                                                     | Motif obligatoire rempli d'espaces accepté                                                                             | refuser vide après `TrimSpace`                                         | `reason: "   "` attend 422                               |
| B92  | HAUTE CONFIANCE      | `banque.go:1170-1179`                                                                                                                                                                                                                                                                                                                                         | Le 409 révèle `existingId` de la demande d'un autre portefeuille                                                       | ne rendre l'id qu'au propriétaire                                      | deux comptes BANQUE_FINANCE                              |
| B93  | CONFIRMÉ             | `banque_pieces.go:198`, `banque_pieces_plateforme.go:144`                                                                                                                                                                                                                                                                                                     | `io.LimitReader` tronque à 64 Mo sans erreur                                                                           | lire `max+1` et refuser                                                | relecture                                                |
| B94  | CONFIRMÉ             | `banque_pieces.go:52-54`, `:92`, `:196`                                                                                                                                                                                                                                                                                                                       | Erreur brute (URL signée) renvoyée au client, rien en journal                                                          | `slog.Warn` et message fixe                                            | relecture                                                |
| B95  | HAUTE CONFIANCE      | `banque_plateforme.go:116-125`                                                                                                                                                                                                                                                                                                                                | Inscription liée à une fiche supprimée proposée mais refusée                                                           | repli sur l'identité de l'inscription                                  | relecture                                                |
| B96  | POTENTIEL            | `banque_pieces_plateforme.go:68`, `:155`                                                                                                                                                                                                                                                                                                                      | `FileURL` suivi sans contrôle d'hôte (SSRF si plateforme compromise)                                                   | https et hôtes du stockage seulement                                   | relecture                                                |
| B97  | CONFIRMÉ             | `internal/shared/socle/errors.go:51`                                                                                                                                                                                                                                                                                                                          | Les 500 renvoient le texte brut de l'erreur interne                                                                    | message fixe au client, détail en journal                              | réponse d'une 500 provoquée                              |
| B98  | CONFIRMÉ             | `formulaire_public.go:310-345`                                                                                                                                                                                                                                                                                                                                | Courriels du formulaire public sans garde base démo ni heures ouvrables                                                | reprendre les gardes de `courriels.go:172-178`                         | test sur base démo                                       |
| B99  | CONFIRMÉ             | `prospects.go:1324-1343`                                                                                                                                                                                                                                                                                                                                      | `prospectRevue` écrit avant de vérifier la portée (écriture puis 404)                                                  | lire avec portée avant d'écrire                                        | rôle personnalisé hors portée                            |
| B100 | CONFIRMÉ             | `internal/shared/socle/session.go:28-35`                                                                                                                                                                                                                                                                                                                      | Cookie de session en clair accepté même en TLS                                                                         | n'accepter `NomCookieClair` que hors TLS                               | relecture                                                |
| B101 | CONFIRMÉ             | `internal/shared/socle/config.go:76`                                                                                                                                                                                                                                                                                                                          | Mot de passe limité à 24 octets par défaut                                                                             | 128 au moins                                                           | relecture                                                |
| B102 | HAUTE CONFIANCE      | 11 `go` hors requête, `recover` seulement `middleware.go:127` et `main.go:248`                                                                                                                                                                                                                                                                                | Une panique dans une goroutine de fond arrête toutes les bases                                                         | `recover` journalisé dans chaque goroutine détachée                    | relecture                                                |
| B103 | POTENTIEL            | `internal/auth/glpi.go`                                                                                                                                                                                                                                                                                                                                       | Identité SSO GLPI fondée sur un e-mail ou identifiant modifiables                                                      | identifiant stable (`users.id`)                                        | relecture                                                |
| B104 | POTENTIEL            | `main.go:301-304`                                                                                                                                                                                                                                                                                                                                             | Fuseau de session Postgres non fixé ; colonnes `timestamp` sans fuseau                                                 | `RuntimeParams["timezone"] = "UTC"`                                    | `SELECT current_setting('TimeZone')`                     |
| B105 | CONFIRMÉ             | `20260918190000:6`, `20260914090100:20`, `20260917260200`                                                                                                                                                                                                                                                                                                     | Plusieurs `Down` détruisent ou ne restaurent rien                                                                      | assumer une stratégie en avant seulement, sauvegarde avant déploiement | relecture                                                |
| B106 | POTENTIEL            | `sql/queries/auth.sql:7`, `admin.sql:44-48`                                                                                                                                                                                                                                                                                                                   | Connexion insensible à la casse, unicité sensible, `LIMIT 1` sans ordre                                                | index unique sur `lower(email)` après contrôle                         | requête de doublons                                      |
| B107 | CONFIRMÉ             | `tools/dev/audit-coherence.sql:55-57`, `:80-85`                                                                                                                                                                                                                                                                                                               | Faux positifs (numéros NULL) et contrôles impossibles                                                                  | filtrer les NULL, contrôler `(lotId, prospectId)`                      | relecture                                                |
| B108 | CONFIRMÉ             | `sql/schema.sql`                                                                                                                                                                                                                                                                                                                                              | Hybride v1 et migrations, écart réel avec la production non vérifié                                                    | comparer `pg_dump --schema-only` prod et base neuve                    | script en annexe B                                       |
| B109 | CONFIRMÉ             | `tools/dev/plafonds.sh:19`, `:14`                                                                                                                                                                                                                                                                                                                             | `'web/src/api/schema.d.ts''web/src/**/*.gen.ts'` collés : artefacts jamais contrôlés ; `web/src/main.tsx` hors plafond | ajouter l'espace, motifs `web/src/*.ts*`                               | commiter un faux `x.gen.ts` en local                     |
| B110 | CONFIRMÉ             | `ci.yml:40-45`                                                                                                                                                                                                                                                                                                                                                | Le refus des tests unitaires ne couvre que Go                                                                          | ajouter `*.test.ts(x)`                                                 | relecture                                                |
| B111 | CONFIRMÉ             | `security.yml:66-70`, `:133-136`, `:77`, `package.json:17`                                                                                                                                                                                                                                                                                                    | Binaires gitleaks et osv-scanner sans empreinte, `@latest`                                                             | `sha256sum -c`, versions fixées                                        | relecture                                                |
| B112 | CONFIRMÉ             | `Dockerfile:8,21,41`                                                                                                                                                                                                                                                                                                                                          | Images de base non épinglées par digest, image jamais scannée                                                          | digests, Trivy image                                                   | relecture                                                |
| B113 | HAUTE CONFIANCE      | `.dockerignore:1-9`                                                                                                                                                                                                                                                                                                                                           | `.env.*`, `.yolo`, `.secrets.generated` non exclus d'un build local                                                    | compléter                                                              | relecture                                                |
| B114 | CONFIRMÉ             | 7 `//nolint` Go (`admin_dump.go:327,410`, `auth.go:37`, `qualification_ouvertures.go:143`, `imports_leads.go:216,221`, `support.go:527`), 2 `# nosemgrep` (`deploy.py:282,1281`), 33 `eslint-disable` dans `web/src`                                                                                                                                          | Suppressions interdites par `CLAUDE.md`                                                                                | corriger la cause, retirer                                             | `grep` en CI                                             |
| B115 | CONFIRMÉ             | `security.yml:14-32`, `infra/dokploy/README.md:9,97-113`, `e2e/playwright.v1.config.ts`, `plan.md:106`                                                                                                                                                                                                                                                        | Documentation et configuration v1 périmées                                                                             | nettoyer                                                               | relecture                                                |
| B116 | CONFIRMÉ             | `ci.yml:86`                                                                                                                                                                                                                                                                                                                                                   | Clé de cache du binaire incomplète : parcours sur un binaire périmé                                                    | ajouter les fichiers de build                                          | relecture                                                |
| B117 | CONFIRMÉ             | `osv-scanner.toml:1-7`                                                                                                                                                                                                                                                                                                                                        | Exceptions de vulnérabilités sans échéance                                                                             | `ignoreUntil`                                                          | relecture                                                |
| B118 | POTENTIEL            | `main.go:421`, `:430`, `Dockerfile:60`                                                                                                                                                                                                                                                                                                                        | Arrêt 30 s contre 10 s côté Docker, `start-period` trop court avec migrations                                          | aligner `StopGracePeriod`, `start-period`                              | `docker service inspect`                                 |
| B119 | CONFIRMÉ             | `internal/shared/socle/config.go:72-83`                                                                                                                                                                                                                                                                                                                       | Aucune validation : `PUBLIC_WEB_URL` vide, TTL de session nul ou négatif acceptés                                      | refuser au démarrage en production                                     | démarrage avec variable vide                             |
| B120 | POTENTIEL            | `e2e/chiffres.spec.ts:50,63`, `playwright.config.ts:42`, `bases-demonstration.spec.ts:17-19`                                                                                                                                                                                                                                                                  | Parcours instables, `reuseExistingServer` en CI, base non supprimée en échec                                           | `!process.env.CI`, nettoyage en `afterAll`                             | relances répétées                                        |
| B121 | CONFIRMÉ             | `Makefile:15`                                                                                                                                                                                                                                                                                                                                                 | `createdb cpi_v2_dev` ignore `DB` surchargé                                                                            | dériver le nom de `DB`                                                 | relecture                                                |
| B122 | CONFIRMÉ             | `web/src/components/layout/nav-items.ts:107`, `prospects.go:778,1418`, `prospects_reaffecter.go:10`, `admin.go:762`, `exports.go:86`, `exports_prospects.go:771`                                                                                                                                                                                              | Mot « Commercial » affiché, interdit                                                                                   | « Téléconseil », « téléconseiller »                                    | `e2e/roles-ecran.spec.ts`                                |
| B123 | CONFIRMÉ             | 9 occurrences (`lot-export-fiches.tsx:509`, `detail-heure.tsx:136`, `rattraper-feuilles.tsx:33`, `pole-deploiement-view.tsx:176`, `pole-marketing-view.tsx:168`, `enrolement-view.tsx:796,810,815,817`)                                                                                                                                                       | Tiret cadratin affiché                                                                                                 | repli « – » de `formatXof`                                             | `grep` en CI                                             |
| B124 | CONFIRMÉ             | `routes/_panneau/grand-public/campagnes/$id.tsx:12`                                                                                                                                                                                                                                                                                                           | Refus Grand Public renvoyé vers la coque CHUES                                                                         | `/grand-public`                                                        | relecture                                                |
| B125 | CONFIRMÉ             | `finance/dossiers/export.tsx:10` et `grand-public/dossiers/export.tsx:9`                                                                                                                                                                                                                                                                                      | Deux gardes différentes pour le même export                                                                            | `exports.banque` partout                                               | relecture                                                |
| B126 | HAUTE CONFIANCE      | `web/src/lib/mutation-feedback.ts:28-30`                                                                                                                                                                                                                                                                                                                      | Toute erreur locale affichée « Serveur injoignable »                                                                   | afficher `error.message` hors erreur réseau                            | relecture                                                |
| B127 | CONFIRMÉ             | `web/src/lib/data/ouvertures.ts:7-39`, `:65-76`                                                                                                                                                                                                                                                                                                               | Contrat écrit à la main malgré le type engendré, code mort                                                             | type `components['schemas']`, retirer                                  | typecheck                                                |
| B128 | CONFIRMÉ             | `components/console/contacts-recommandes.tsx:47-72`                                                                                                                                                                                                                                                                                                           | Champs sans étiquette, bouton icône sans nom accessible                                                                | `aria-label`, `type="tel"`                                             | audit d'accessibilité                                    |
| B129 | POTENTIEL            | `lib/format.ts:48-58` contre `lib/data/console.ts:118-126`                                                                                                                                                                                                                                                                                                    | Heures formatées dans deux fuseaux                                                                                     | `timeZone: 'Africa/Dakar'` partout                                     | poste en Europe/Paris                                    |
| B130 | POTENTIEL            | `components/auth/dev-role-switcher.tsx:40-49`                                                                                                                                                                                                                                                                                                                 | Identifiants de développement dans le bundle de production                                                             | exclure le module du build                                             | `grep` dans `dist/`                                      |
| B131 | POTENTIEL            | `components/exports/download-button.tsx:19`, `:37`                                                                                                                                                                                                                                                                                                            | URL révoquée après 0 ms ; 401 non redirigé vers la connexion                                                           | délai et gestion 401                                                   | relecture                                                |
| B132 | CONFIRMÉ             | `components/auth/login-form.tsx:263-267`                                                                                                                                                                                                                                                                                                                      | Double envoi possible sur la connexion démo                                                                            | passer par `handleSubmit`                                              | relecture                                                |
| B133 | CONFIRMÉ             | `components/layout/user-menu.tsx:46`                                                                                                                                                                                                                                                                                                                          | Appel à `/api/auth/workspace`, route inexistante (code mort)                                                           | retirer                                                                | relecture                                                |
| B134 | CONFIRMÉ             | `ventes.sql:80-87`, `banque.sql:199-218`, `analytics.sql:206-228`, `qualification.sql:363-394`, `prospects.sql:580-595,702-707`, `representants.sql:199-226`, `campagnes.sql:485-493`, `courriels.sql:10-14`, `TirerSuggestions*`, `EcheancesVentesACredit`, `web/src/lib/data/reference.ts:87-101`, `exports_rendez_vous.go:15` (coupe à 5 000 sans le dire) | Listes sans borne, contraire à `CLAUDE.md`                                                                             | `LIMIT` et pagination, ou plafond dur avec message                     | `GET /api/v1/ouvertures/comptage` sans `from` attend 400 |

## 8. Seconde passe : ce que la première passe avait manqué

La seconde passe a relu les interactions entre domaines plutôt que les domaines eux-mêmes. Elle a ajouté ou requalifié :

- **B02 et B11** : deux ruptures du contrat panneau/serveur invisibles aux tests d'intégration, qui appellent directement les bonnes routes. Il manque un parcours e2e par écriture anonyme et par signal de fond.
- **B03** : l'exécution réelle de la suite a révélé que `dev` est rouge, ce qu'aucune lecture de code ne montrait.
- **B01, B62, B63, B98** : les bases de démonstration partagent le processus, l'environnement, le répertoire de dump et la configuration Brevo ; chaque fonction qui lit l'environnement doit être revue sous cet angle.
- **B07, B22, B20** : le double état `prospects.statut` / `phase2Status` / `prospect_journeys` produit la majorité des régressions de statut. Chaque écriture de statut doit garder les états terminaux.
- **B05 et B04** : le classeur des ventes et la saisie au comptoir écrivent la même table sans règle de priorité.
- **B16** : la recherche de secrets ne trouvait rien, mais les données personnelles n'étaient cherchées par personne.
- **B109** : le garde-fou des plafonds est vert parce qu'il ne regarde pas ce qu'il croit regarder.

Points vérifiés et sains : aucune transaction manuelle sans `defer Rollback` (16 sites) ; aucun montant en flottant (`bigint`, `numeric(18,0)`) ; SQL dynamique limité à des listes blanches ou `pgx.Identifier` ; exports xlsx écrits en valeurs (pas d'injection de formule, testé) ; transitions bancaires protégées par `rev` ; pas de `dangerouslySetInnerHTML` ; redirection après connexion ramenée à l'origine ; aucun jeton dans `localStorage` ; actions GitHub épinglées par SHA et conformes ; image non root avec HEALTHCHECK ; `.env` et `.yolo` ignorés par git.

## 9. Améliorations fonctionnelles (22)

Chacune s'appuie sur des données ou des routes qui existent déjà.

1. **État des sommes dues aux propriétaires et apporteurs**, par site et par période, en xlsx : les parts sont déjà dans `ventes` (`ListerVentes`), l'export réutilise `internal/exports`.
2. **Stock restant par site** : `ventes_sites.totalLots` moins la somme des `nombreLots` vendus, affiché dans les réglages et contrôlé à la saisie.
3. **Échéances en retard** des ventes à crédit : `premierVersement`, `periodiciteMois`, `jourVersement` comparés à `ventes_versements`, à partir de `EcheancesVentesACredit`.
4. **Relance WhatsApp depuis les échéances** : reprendre `prospects/bouton-whatsapp.tsx` (lien `wa.me` prérempli).
5. **Ventes attribuées à une campagne d'appels** : rapprocher le téléphone de la vente de `lot_export_items`.
6. **Suivi du parrainage jusqu'à la vente** : `VenteDTO.Parrain` existe ; compteur de ventes par parrain sur la fiche Grand Public.
7. **Visites de l'agence dans la fiche prospect** : `visites.phoneE164` rapproché de `prospects.phoneE164`, taux visite vers vente.
8. **Rééquilibrer une campagne** en un clic : `lotRepartir` et `lotAppliquerMouvements` sont déjà écrits.
9. **Report de rappel à une date choisie** au lieu des 15 minutes fixes de `qualificationReportRappel`, bloqué pour les rendez-vous.
10. **Places restantes par créneau RV site** dans le sélecteur de date : `RvSiteReservations` et `maxVisites` suffisent.
11. **Remise « À traiter » en lot** des injoignables de plus de N jours, par un paramètre de la route existante (`remiseATraiterAt`).
12. **Rendez-vous du lendemain à confirmer** pour chaque téléconseiller, à partir de `RendezVousObtenus` filtré par `du`/`au`.
13. **Commentaire obligatoire** sur la requalification par l'encadrement, versé au journal de la fiche.
14. **Conserver le numéro saisi au formulaire public** en `relaisPhoneE164` quand la fiche est rapprochée par e-mail.
15. **Relance automatique des dossiers bancaires** ouverts depuis plus de 7 jours : `banqueJoursRetard` et `Overdue` sont déjà calculés.
16. **Téléchargement des lignes refusées d'un import** en xlsx pour correction et réimport (le rapport est plafonné à 200 lignes).
17. **Avertissement « onglet sans date reconnue »** dans le rapport d'import des leads, avec compteur par onglet (filet de B08).
18. **Colonnes Projet et Identifiant plateforme** dans l'export des dossiers bancaires (`inscriptionId` est déjà présent).
19. **Expiration des demandes de création de client en attente** anciennes (`pendingCount` existe).
20. **Liste de suppression des adresses** en rebond définitif ou plainte, avec avis à l'ADMIN (complète B41).
21. **Rattrapage au démarrage des tâches quotidiennes manquées**, à partir de `Deps.Planifications` et `cron_runs` (complète B65).
22. **Boîte de réception pour les téléconseillers et chargés de clientèle** : les notifications leur sont déjà émises (B51).

## 10. Améliorations UX et UI (14)

1. **Saisie de vente** : afficher la répartition propriétaire, apporteur, CPI au dernier écran, avec alerte si la part CPI est négative (B32).
2. **Badge « Classeur »** sur les ventes importées et phrase « Le prochain classeur remplacera cette vente. » (B05).
3. **Retrait d'un membre de campagne** : « 20 fiches reprises, 80 restent sans téléconseiller » avant confirmation (B28).
4. **Revue d'import du registre** : date lue en jj/mm/aaaa à côté de la cellule d'origine, pour repérer un 31/04 ou une inversion.
5. **Aperçu de campagne** : quand les retenues sont inférieures aux éligibles, dire combien de places manquent et proposer un jour de plus.
6. **Fiche en rendez-vous** : avant un statut injoignable, prévenir « Rendez-vous le JJ/MM : il sera retiré ».
7. **Masquer « Consigner un appel » et « Requalifier »** sur une fiche VENDU (`requalifier-fiche.tsx:131` ne teste que CONVERTI).
8. **Pop-up de rappel** : « Honoré / Non honoré » pour un rendez-vous au lieu de « Reporter » ; respecter la préférence `sonActif()`.
9. **Boîte « Requalifier »** : afficher le projet ciblé quand la fiche a deux parcours (B20).
10. **Écran « à ouvrir » de la banque** : bouton désactivé avec le statut distant qui bloque l'ouverture (B09).
11. **Montant encaissé** : séparateurs de milliers, suffixe FCFA, refus visible de zéro ; aperçu du numéro normalisé +221 dans la demande de création.
12. **Recherche des ventes** : réutiliser `matchesSearch` de `lib/search.ts` (accents, « Ndiaye » et « Ndiayé ») et proposer « Effacer la recherche » sur un résultat vide.
13. **Hub « Mon travail »** : chaque chiffre ouvre la liste filtrée correspondante ; recherche des rappels côté serveur au lieu de la page affichée.
14. **Supervision** : heure du dernier signal à côté de « Présence non mesurée », pour distinguer une absence d'un défaut de mesure ; bandeau permanent et boutons Kairo, GLPI, tirage masqués sur une base démo.

## 11. Améliorations techniques

### Sécurité

- Rôle Postgres applicatif sans superutilisateur (B53) et rôle `assistant_lecture` à liste blanche (B18).
- Retrait de `demo-login` ou garde de base sur chaque intégration externe (B01).
- Pare-feu de l'origine aux plages Cloudflare (B59) ; seul `CF-Connecting-IP` accepté ensuite.
- Réponses 500 sans texte interne (B97) ; `recover` dans les goroutines détachées (B102).
- Comparaisons de secrets en temps constant partout (B68) ; longueur de mot de passe portée à 128 (B101).

### Données et base

- Une seule source de vérité pour le statut d'une fiche : `prospect_journeys` ou `prospects.statut`, pas les deux. C'est la cause de B07, B20, B22 et de la moitié de `audit-coherence.sql`.
- `lock_timeout` sur les migrations et contraintes en deux temps (B60) ; garde CI sur l'ordre des migrations (B14).
- Pagination par clé (keyset) pour `ListProspects`, `ListRepresentants`, `JournalAudit` au lieu d'OFFSET suivi d'un COUNT.
- `join_collapse_limit=1` limité à la seule requête qui en a besoin (`SET LOCAL`), au lieu du pool entier (`main.go:301-304`).
- Rétention de `audit_logs`, sur le modèle de `cron_runs` et `metriques_http`.
- CHECK sur les énumérations en texte (`courriels.statut`, `courriels.type`, `notification_deliveries.error`).
- Revue des ~30 index de `prospects` avec `pg_stat_user_indexes` : le déclencheur `set_updated_at` empêche toute mise à jour HOT.
- `pg_stat_statements` en production pour mesurer au lieu d'estimer (B61).

### Fiabilité et observabilité

- Révision gravée dans le binaire et exposée (B56) ; notifications de déploiement Dokploy ; sonde externe sur `/health/ready`.
- Alerte sur `cron_runs` sans fin et sur les passages manqués (B65).
- Compteur des verdicts Brevo par code et abonnés SSE par base dans l'écran Exploitation.
- Journal d'arrêt listant les tâches encore actives (dump, transmission, tirage).

### CI/CD et DX

- CI sur `prod` et protection de branche (B54) ; job `docker build` et scan Trivy de l'image (B55, B112).
- sqlc et goose en directives `tool` de `go.mod` : une seule version au lieu de huit répétitions.
- Téléverser `e2e/test-results` sur échec (6 lignes) ; `reuseExistingServer: !process.env.CI`.
- Un seul build du panneau en CI, partagé en artefact entre `statique` et `binaire`.
- Corriger `plafonds.sh` (B109) et étendre le refus des tests unitaires au TypeScript (B110).
- Contrôle CI qui refuse `commercial` et le tiret cadratin dans les chaînes affichées (B122, B123) et toute nouvelle suppression de lint (B114).
- Garde `localhost` dans `e2e/global-setup.ts` et la cible `make db` (B58).

### Tests

- Un parcours e2e par écriture anonyme (formulaire public) et par signal de fond (présence) : ce sont les deux trous qui ont laissé passer B02 et B11.
- Un parcours `e2e/ventes.spec.ts` : le métier Ventes n'en a aucun, alors qu'il porte B04, B05, B32, B33, B49.
- Tests de concurrence déterministes (verrou tenu par le test, ordre forcé) pour B25, B29, B31, B33, sur le modèle décrit en B25.
- Chaque test existant cité comme « passe sur du code cassé » (B04, B20) reçoit l'assertion manquante.

## 12. Plan de remédiation

| Lot                         | Contenu                                                                                                                                                        | Pourquoi maintenant                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **0. Aujourd'hui**          | B02 (formulaire public), B03 (CI verte), B01 (couper `demo-login` ou ses bases démo)                                                                           | fonctionnalité morte, CI aveugle, faille ouverte  |
| **1. Avant le 1er octobre** | B08 (mois d'onglet), B13 (sauvegarde vérifiée et exercice de restauration), B14 (garde d'ordre des migrations), B16 (sortir les données personnelles du dépôt) | échéance calendaire et risque de perte de données |
| **2. Semaine suivante**     | B04, B05, B32, B33 (ventes) ; B07, B22, B20, B21 (statuts terminaux) ; B17, B19 (rendez-vous) ; B06, B09, B10                                                  | intégrité des données financières et commerciales |
| **3. Sous quinze jours**    | B11, B12, B18, B53, B54, B55, B41, B44, B37, B23                                                                                                               | sécurité et fiabilité                             |
| **4. Dans le mois**         | reste des constats moyens, notamment concurrence (B25, B29 à B31), migrations (B60, B61), panneau (B45 à B52)                                                  | robustesse                                        |
| **5. Au fil de l'eau**      | constats bas, par domaine touché                                                                                                                               | qualité                                           |

Décisions à prendre par le propriétaire avant de coder :

1. `demo-login` : suppression (conforme au plan) ou maintien avec garde (B01).
2. Ventes importées : écritures refusées, ou dépôt refusé tant que des versements existent (B05) ; recalcul des parts quand lots ou prix changent (B04).
3. Présence : battre ou non onglet masqué (B11).
4. Notifications des téléconseillers : ouvrir la cloche ou arrêter l'émission (B51).
5. Gardes d'écran par permission : touche des écrans v1 repris à l'identique (B52).
6. Purge de l'historique git pour les données personnelles (B16).
7. Une fiche PERDU requalifiée par motif reste PERDU ; un superviseur qui consigne un appel devient titulaire. Voulu ou non ?

## Annexe A. Garde CI sur l'ordre des migrations

```sh
base=$(git merge-base "origin/$GITHUB_BASE_REF" HEAD)
max=$(git ls-tree --name-only "$base" sql/migrations/ | grep -o '[0-9]\{14\}' | sort | tail -1)
git diff --name-only --diff-filter=A "$base" -- sql/migrations | grep -o '[0-9]\{14\}' \
  | awk -v max="$max" '$1 <= max { print "migration " $1 " <= " max; bad=1 } END { exit bad }'
```

## Annexe B. Écart entre la production et une base neuve

```sh
pg_dump --schema-only --no-owner -d "$COPIE_PROD" | grep -v '^--' > prod.sql
createdb verif && psql -d verif -v ON_ERROR_STOP=1 -f sql/schema.sql && goose -dir sql/migrations postgres "$VERIF" up
pg_dump --schema-only --no-owner -d verif | grep -v '^--' > neuf.sql && diff prod.sql neuf.sql
```
