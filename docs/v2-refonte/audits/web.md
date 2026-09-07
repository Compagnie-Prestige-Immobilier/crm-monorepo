# Audit v2 : inventaire exhaustif du panneau web (7 septembre 2026)

Périmètre : `app/(auth)`, `app/(hub)`, `app/(panel)`, `app/demande`, `app/api`, `app/moved-routes.ts`, `components/*`, `lib/*`, `e2e/*.spec.ts`, `next.config.ts`, `globals.css`. Aucun `middleware.ts`. 62 fichiers `page.tsx`, 80 fichiers `e2e/*.spec.ts` (les 84 entrées du dossier incluent `fixtures.ts`, `auth.setup.ts`, `global-setup.ts`, `xlsx.ts`).

## 1. Écrans

Rôles : ADM, DIR, SUP, COM, CC (chargé de clientèle), BQ (Banque & Finance), ACC.

### Coque Accueil (`nav-items.ts:178-220`)

| Route | Titre | Rôles | Données | Gestes | Nav |
| --- | --- | --- | --- | --- | --- |
| `/accueil` | Registre des visites | ADM, DIR, ACC (`accueil/layout.tsx:9`) | `RegistreView` → `fetchVisites` | créer/éditer une visite (`visite-form.tsx`), filtres, impression, export Excel | onglet 1/4 de `VisitesTabs` |
| `/accueil/tableau-de-bord` | Tableau de bord des visites | ADM, DIR, ACC (`page.tsx:17`) | SSR `fetchVisiteDashboardStats` + `fetchDisposition('visites')` (`:27-36`) | « Organiser les graphiques », dnd, export Excel | `hidden` (`nav-items.ts:198`) |
| `/accueil/listes` | Listes du registre | ADM, DIR (`listes/page.tsx:20`) | 4 `fetchVisiteReferentielList` + usage | créer/désactiver (`listes-form-dialog.tsx`) | `hidden` (`:208`) |
| `/accueil/import` | Import du registre | ADM, DIR (`import/page.tsx:11`) | `RegistreImportView` | export → correction → redépôt → application | `hidden` (`:218`) |

### Coque CHUES (`nav-items.ts:222-557`)

| Route | Titre | Rôles | Composant | Gestes | URL |
| --- | --- | --- | --- | --- | --- |
| `/chues` | Projet CHUES | ADM,COM,CC,SUP,DIR,BQ (BQ → `/chues/banque`, `page.tsx:38`) | `HubView`, 3 compteurs | lien du formulaire public copiable | |
| `/chues/appels-representants` | Qualifier un représentant | ADM,COM,CC,SUP,DIR | `RepScript` (1 705 lignes) | annuaire → qualification → 5 issues → callback | recherche |
| `/chues/prospects/nouveau` | Ajouter un prospect | idem | `ProspectCreateForm` | créer & suivant, doublon en direct, représentant en aparté | `?rep=` |
| `/chues/console` | Convertir un prospect | idem | `ConsoleView projet="CHUES"` (1 061 lignes) | 20 dernières fiches → recherche → issues clavier 1-5 → conversion, brouillon auto | `?fiche=` |
| `/chues/rappels` | Rappels | idem | `RepresentantsSuiviView` + `RappelsView` | marquer traité, filtre par téléconseiller | |
| `/chues/mes-contacts` | Mes contacts | idem | `MesContactsView` | | |
| `/chues/suggestions` | Numéros suggérés | idem | `SuggestionsView` | traiter/rejeter (COM, ADM) | |
| `/chues/representants` | Représentants | idem | `RepresentantsView` | créer/éditer, export, `campaignScoped` si COM | `parseRepresentantFilters` |
| `/chues/representants/[id]` | Représentant | idem | `RepresentantDetailView` | | |
| `/chues/prospects` | Prospects | idem | `ProspectsView` | fusion/réaffectation (ADM), export | `parseProspectFilters` |
| `/chues/prospects/[id]` | Prospect | idem | `ProspectDetailView` | | |
| `/chues/statistiques` | Tableau de bord | ADM,SUP,DIR | `ChiffresView` + `OngletsPilotage` | « Composer l'écran », dnd, export classeur, « Proposer par défaut » | `?volet=` |
| `/chues/supervision` | Tableau de bord | ADM,SUP,DIR | `SupervisionTabs` → `ActivityView` ou `FichesRestees` + `SupervisionView` | libérer une fiche restée (ADM/SUP) | `?volet=comptes` |
| `/chues/campagnes` | Tableau de bord | ADM,SUP,DIR | `LotsExportView` | créer, régler, supprimer | pagination |
| `/chues/campagnes/[id]` | Campagne | idem | `LotExportDetailView` | réaffectation, retrait, export xlsx/pdf/zip | |
| `/chues/banque` | Tableau de bord bancaire | ADM,BQ | `BankDashboardView` | | |
| `/chues/dossiers` | Dossiers bancaires | ADM,BQ | `BankCasesView` | | `BankFiltersBar` |
| `/chues/dossiers/nouveau` | Nouveau dossier | ADM,BQ | `BankCaseForm` | | |
| `/chues/dossiers/[id]` | Dossier bancaire | ADM,BQ | `BankCaseDetailView` | étape, rejet motivé, encaissement | |
| `/chues/dossiers/export` | Export des dossiers | ADM,BQ | `BankExportView` | classeur 3 feuilles | |
| `/chues/dossiers/etapes` | Étapes bancaires | ADM | `BankStagesView` | monter/descendre | |
| `/chues/demandes-clients` | Demandes clients | ADM,BQ | `ClientRequestsView` | approuver/refuser (ADM) ; BQ voit les siennes | |
| `/chues/representants/import` | Import de représentants | ADM | `RepresentantsImportView` | modèle → simulation → application | |
| `/chues/parametres-chues` | Paramètres CHUES | ADM,SUP,DIR | `ParametresChuesCard` | | |
| `/chues/tableau-de-bord` | | | `permanentRedirect('/chues/statistiques')` | | |

### Coque Grand Public (`nav-items.ts:559-727`)

| Route | Rôles | Particularité |
| --- | --- | --- |
| `/grand-public` | ADM,DIR,SUP,COM,CC | `GrandPublicProspectsView` (composant séparé de CHUES) |
| `/grand-public/nouveau` | ADM,COM,CC | `GrandPublicProspectForm` (1 219 lignes, séparé) |
| `/grand-public/console` | ADM,COM,CC | même `ConsoleView`, `projet="GRAND_PUBLIC"` |
| `/grand-public/rappels` | ADM,COM,CC,SUP,DIR | réexporte `../../chues/rappels/page` |
| `/grand-public/mes-contacts` | idem | `MesContactsView` |
| `/grand-public/[id]` | ADM,DIR,SUP,COM,CC | `GrandPublicProspectDetail` (séparé) |
| `/grand-public/statistiques` | ADM,SUP,DIR | `ChiffresView ecran="grand-public"` |
| `/grand-public/supervision` | ADM,SUP,DIR | `ActivityView` seul, pas de Présence |
| `/grand-public/campagnes`, `/campagnes/[id]` | ADM,SUP,DIR | `LotsExportView` ; `[id]` réexporte CHUES |
| `/grand-public/banque`, `/dossiers`, `/dossiers/nouveau`, `/dossiers/[id]`, `/dossiers/export` | ADM,BQ | mêmes composants `Bank*` |
| `/grand-public/tableau-de-bord` | | redirection |

Pas de suggestions côté Grand Public (`nav-items.ts:597-607`).

### Coque Admin

| Route | Rôles | Contenu |
| --- | --- | --- |
| `/admin` | | redirection `coqueHomePath` |
| `/admin/commerciaux` | ADM | créer/éditer (`UserFormDialog`), désactiver, réinitialiser, supprimer en masse |
| `/admin/referentiels` | ADM,SUP,DIR | 8 onglets `?onglet=` (`referentiels-view.tsx:106-155`) |
| `/admin/referentiels/issues-appel` | ADM,SUP,DIR | 6 motifs système verrouillés |
| `/admin/referentiels/statuts-qualification` | | redirection |
| `/admin/imports` | ADM | `ImportsView`, `?kind=` |
| `/admin/notifications` | ADM (autres → `INBOX_PATH`) | composeur 2 temps, onglets réception/historique/gabarits |
| `/admin/enrolement` | ADM | `EnrolementView` |
| `/admin/parametres` | ADM | `DemoModeCard`, `AndroidReleaseCard`, `PurgeCard`, `DatabaseDumpSection` |
| `/admin/champs-conversion` | ADM | `ChampsConversionView` |

### Hors coque

| Route | Rôles | Détail |
| --- | --- | --- |
| `/compte` | authentifié | `ChangePasswordCard` |
| `/notifications` | ADM,DIR,SUP,BQ,ACC | `NotificationsView` |
| `/espaces` | authentifié | 4 tuiles, `?retour=` validé (`espaces/page.tsx:26-31`), tuiles grisées |
| `/connexion` | anonyme | formulaire, `DevRoleSwitcher`, `?expired=1` |
| `/demande/[jeton]` | public | formulaire multi-étapes, Turnstile |
| `/[ancien]/[[...segments]]` | | renvois |
| `/`, `/not-found` | | |

## 2. Comportements transverses

- Session : `readSession()`/`getSession()` (`lib/session.ts:15-32`) distingue `authenticated`/`anonymous`/`unavailable` ; `guardRoles()` (`:39-45`). Cookies posés par `setSessionCookies`, rotation sur 401 dans le relais générique `app/api/v1/[...path]/route.ts:95-128`, `SESSION_EXPIRED` si la rotation échoue. `lib/api/session-expiry.ts`. `DevRoleSwitcher` (dev seulement, `app/api/auth/dev-login/route.ts:31-33`, `FIXTURE_IDENTIFIERS` `:9-16`). Cookie de repli sidebar (`sidebar-cookie.ts`, `(panel)/layout.tsx:35`).
- Relais `app/api/*` : générique `v1/[...path]` (jeton httpOnly, rotation, en-têtes transmis `:21-28` dont `idempotency-key`) ; `auth/{login,dev-login,logout,session,workspace}` ; `demande/[jeton]` sans identité, `x-forwarded-for` (`:80-82`) ; `export/{relay,bank-cases,prospects}` (binaire, MIME, nom, suffixe démo) ; `app-updates/android` (flux 85 Mo, rafraîchit le jeton avant l'envoi `:24-28`).
- `moved-routes.ts:8-31` : `tableau-de-bord`, `statistiques`, `prospects`, `campagnes`, `console`, `rappels`, `representants`, `suggestions`, `banque`, `dossiers`, `demandes-clients`, `supervision` → `/chues/*` ; `commerciaux`, `referentiels`, `imports`, `parametres`, `notifications` → `/admin/*` ; `phase2`, `rep-campaigns` → `/chues/campagnes` ; `MOVED_PATHS` (`:40-42`) `/phase2/callbacks` → `/chues/rappels`. Capturé par `app/[ancien]/[[...segments]]/page.tsx`.
- `DemoBanner` si `user.workspace === 'demo'` (`(panel)/layout.tsx:47`). Hub : tuiles refusées grisées sans lien (`(hub)/espaces/page.tsx:51-73`).
- `LiveStream` SSE (`lib/live-stream.ts:9-15`, `/api/v1/live`) : `notifications` → `inboxRoot` ; `imports` → `importsRoot` + `['visites','import']` ; `db-dump` → `databaseDump` ; `referentiels` → `referentielsRoot` + `reference` ; `app-updates` → `androidReleases`. Indicateur « En direct / Interrompu / En pause » (`lib/live.ts:32-37`).
- `NotificationBell` : badge, liste, « Tout voir », « Tout marquer comme lu » (`:206-230`).
- `ThemeToggle` : `next-themes`, 3 options.
- Sidebar : aucune sur Accueil (`sidebar-shell.tsx:36`) ; « Plus » en `<details>` (`sidebar-nav.tsx:230-296`) ; `Sheet` sous 768 px (`topbar.tsx:26-51`).
- `PermissionDenied`, `QueryErrorState`/`QueryErrorInline` (`presentation(error)` : configuration, 403, 404, 400-422, 5xx, réseau).
- Error boundaries : `app/error.tsx`, `(panel)/error.tsx` (`RenderError`), `app/global-error.tsx`, `app/not-found.tsx`. `loading.tsx` : `(hub)`, `(panel)`, `accueil/appels-representants`, `chues/banque`, `chues/console`, `chues/dossiers`, `chues/prospects`, `chues/prospects/nouveau`, `grand-public`.
- `react-joyride` : aucun usage malgré la dépendance.
- Impression : `components/accueil/impression-dialog.tsx`, portée page/tout (plafond 3 000, `:41`), colonnes verrouillées, orientation, `COLONNES_REGISTRE` (`:53-88`).
- Formulaire public : brouillon `sessionStorage` (`cpi:demande:<jeton>`), Turnstile, champ-piège `site`, étapes conditionnelles (`aDesCoordonnees`).

## 3. Tableaux de bord

Contrat (`lib/data/disposition.ts`) : `Disposition = { widgets, preset, source, updatedAt }`, `DashboardWidget = { id (client), source, marque?, taille?, presentation? }`. Endpoints `GET/PUT/DELETE /api/v1/tableaux-de-bord/{ecran}/disposition`, `PUT .../par-defaut`. `serializeWidget()` (`:39-51`) seul point de sérialisation (`forbidNonWhitelisted`). `ecran` : `visites | chues | grand-public`.

Widgets visites (`components/accueil/tableau-de-bord/sources.ts`, 20) : `total-visites`, `moyenne-journaliere`, `jour-le-plus-charge`, `par-entreprise`, `par-objet`, `par-direction`, `par-destinataire`, `par-agent`, `visiteurs-recurrents`, `par-jour`, `par-mois`, `par-heure`, `par-jour-semaine`, `par-heure-jour-semaine`, `par-entreprise-objet`, `par-destinataire-direction`, `par-objet-mois`, `avec-telephone`, `qualite-de-saisie`.

Widgets chiffres (`components/chiffres/sources.ts`, 33) : `taux-de-contact`, `taux-de-joignabilite-representants`, `taux-d-acceptation`, `taux-de-rappel`, `repartition-statuts-qualification`, `joints-non-joints`, `statuts-par-famille`, `joignabilite-par-creneau`, `taux-d-exploitation`, `representants-par-departement`, `representants-par-ief`, `representants-jamais-appeles`, `representants-injoignables`, `taux-de-qualification`, `duree-moyenne-sur-la-fiche`, `duree-moyenne-de-communication`, `appels-par-jour`, `taux-de-joignabilite`, `prospects-notes`, `fiches-ouvertes`, `couverture-derniere-campagne`, `hors-attribution-derniere-campagne`, `de-l-appel-a-l-encaissement`, `methodes-d-adhesion`, `par-banque`, `delais-medians`, `rendement-par-departement`, `enrolement-inscriptions`, `enrolement-taux-rapprochement`, `enrolement-taux-conversion`, `enrolement-par-jour`, `enrolement-par-etape`, `enrolement-par-teleconseiller`, `parTeleconseiller`.

Sources : `lib/data/chiffres.ts`, `lib/data/ouvertures.ts`, `lib/data/admin.ts`, `lib/data/visites-stats.ts`. Dnd : `components/accueil/tableau-de-bord/grille.tsx` (`DndContext`, `SortableContext`, capteurs souris/tactile/clavier, `DragOverlay`, annonces), `barre-edition.tsx`, `tiroir-widgets.tsx`. 21 graphiques (`components/dashboard/visites-charts.tsx`), options (`chart-options.ts`). Export classeur (`lib/tableau-de-bord-xlsx.ts`) : feuille « Charte » (`:140-217`), une feuille par groupe (`:242-252`), « Chiffres clés », couleurs figées, Arial 14.

## 4. Formulaires

- `RepScript` (1 705 lignes) : validation manuelle `manque*` (`:1071-1103`), annuaire `FilterCombobox`, `useShortcuts`, `useBrouillonAuto` (`lib/use-brouillon-auto.ts:8-11`), `useVerrouNavigation`.
- `GrandPublicProspectForm` (1 219 lignes) : table `CHAMPS` (`:74-84`) par `ProspectType` (FONCTIONNAIRE, SECTEUR_PRIVE, INFORMEL, DIASPORA), `InternationalPhoneField`.
- `RepresentantFormDialog` (1 028 lignes) : `checkPhone.mutate` au blur, `ficheEnvoyable`.
- `ProspectCreateForm` (522 lignes) : `validateProspectForm` (`:94-100`), représentant en aparté.
- `prospect-edit-dialog.tsx:51`, `prospect-merge-dialog.tsx:85,166-174`, `prospect-reassign-dialog.tsx:50`.
- `UserFormDialog` (280 lignes) : seul formulaire sur `react-hook-form` + `zodResolver`, `lib/schemas.ts:36-59`.
- `BankCaseForm` (522 lignes) : `:130-137`, `ReferenceFeedback` (`:250-286`).
- `VisiteForm` (502 lignes) : bornes `:35-38`.
- Formulaire public : `validerDemande` (`formulaire-public.ts:212-224`), `TOUJOURS_REQUIS` (`:112`), masquages (`:124-128`).
- Imports : modèle → dry-run → application, `IMPORT_MAX_ROWS`.

## 5. Exports et imports

| Fichier | Endpoint | Déclencheur |
| --- | --- | --- |
| `cpi-prospects-<date>.xlsx`, `-consolide-` | `GET /api/export/prospects` | `export-menu.tsx`, `lib/data/export.ts:8-32` |
| `cpi-prospects-grand-public-<date>.xlsx` | idem `projet=GRAND_PUBLIC` | `export.ts:39-49` |
| `cpi-dossiers-bancaires-<date>.xlsx` (Dossiers, Historique, Synthèse) | `GET /api/export/bank-cases` | `BankExportView` (`:15-27`) |
| `cpi-representants-modele.xlsx`, `cpi-representants-<date>.xlsx` | `/api/v1/export/representants(-modele).xlsx` | `representants-import.ts:47-56` |
| `cpi-prospects(-grand-public)-modele.xlsx` | `/api/v1/export/...-modele.xlsx` | `ImportsView` |
| `cpi-registre-visites-<date>.xlsx` | `/api/v1/export/visites.xlsx` | `RegistreImportView` |
| classeur tableau de bord | client `exceljs` | `bouton-export-excel.tsx` |
| impression registre | `window.print()` | `ImpressionDialog` |
| campagne `export.xlsx`, `programmes.zip`, `programme.pdf` | `/api/v1/lots-export/{id}/...` | `LotExportDetailView`, `lots-export-fiches.tsx` |
| imports REPRESENTANTS, PROSPECTS, PROSPECTS_GRAND_PUBLIC, VISITES, VISITES_REGISTRE (50k/150k/50k/20k/20k) | `/api/v1/imports` | `ImportsView` |
| APK | `POST /api/app-updates/android` (`duplex:'half'`) | `AndroidReleaseCard` |
| dump | `DB_DUMP_ENABLED` | `DatabaseDumpSection` |

## 6. Couverture e2e (80 specs)

Regroupement en parcours candidats : 1 connexion/session ; 2 hub et navigation par rôle (`roles-*`, `redirections`) ; 3 étape 1 ; 4 étape 2 ; 5 étape 3 + console ; 6 rappels ; 7 listes et fiches ; 8 suggestions ; 9 chiffres et pilotage CHUES ; 10 dossiers bancaires ; 11 Grand Public complet ; 12 registre des visites ; 13 admin utilisateurs/référentiels/imports ; 14 admin notifications/paramètres/démo/Android ; 15 cycle bout-en-bout (`workspaces.spec.ts`) ; 16 accessibilité et responsive (transverse).

Ce qu'une réduction perdrait : `chues-chiffres.direction` et `chues-chiffres.superviseur` volontairement rouges (bug serveur `supervision.service.ts`) ; `chues-prospects.commercial2` dépend de `chues-prospects.commercial` ; `roles-trous` ROL-30 (`GET /api/v1/lots-export/{id}` 500) ; pannes réseau simulées (`transversal-pannes`) et budget de 4 connexions (`accueil-connexion.anon`) ; `chues-dossiers-etapes` CHU-DOSE-01 non écrit (2 étapes seulement dans le semis).

## 7. Dettes et pièges

Duplications CHUES / Grand Public : `components/prospects/prospects-view.tsx` (91 lignes) vs `components/grand-public/prospects-view.tsx` (628) ; `prospects/prospect-detail-view.tsx` (497) vs `grand-public/prospect-detail.tsx` (556) ; `prospects/prospect-create-form.tsx` (522) vs `grand-public/prospect-form.tsx` (1 219). Principe documenté `nav-items.ts:76-79`.

Vocabulaire : « Téléconseiller » dans 39 fichiers (`ROLE_LABELS`, `lib/types.ts:95`) ; « Banque & Finance » cohérent ; aucune occurrence affichée de « commercial », seulement des noms de champs internes (`ownedByCommercialName`, `commercialId`).

`'use client'` : incident corrigé (`hub-filters.ts:1`), aucune occurrence actuelle ; remarque prospective sur `annuaireFilters` de `rep-script.tsx:75-81`.

TODO : aucun.
