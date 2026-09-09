# Audit du panneau Next.js vers SPA embarquée

Lecture seule, 8 septembre 2026, base `dev` à `68217387`. Écart avec
`audits/web.md` : 82 specs Playwright (`global-export.spec.ts`,
`responsive-mobile.spec.ts`) ; `rep-script.tsx` fait 1 728 lignes.

## 1. Le relais Next : repris par Go ou supprimé

| Fonction                                                                    | Preuve                                                            | En v2                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cookies `cpi_at`/`cpi_rt`, TTL 30 j                                         | `lib/api/config.ts:1-8`, `lib/api/server.ts:45-77`                | Disparaît : un cookie opaque posé par Go                                                  |
| Rotation sur 401, `SESSION_EXPIRED`                                         | `app/api/v1/[...path]/route.ts:91-128`, `lib/api/tokens.ts:36-53` | Disparaît ; 401 → `redirectToLogin()` conservé (`lib/api/session-expiry.ts:12-27`)        |
| En-têtes transmis (`idempotency-key`, `content-disposition`, `x-demo-mode`) | `route.ts:20-28`                                                  | `idempotency-key` et `x-demo-mode` disparaissent ; `content-disposition` posé par Go      |
| Suffixe `-DEMONSTRATION`                                                    | `lib/demo-marking.ts:9-19`, `app/api/export/relay.ts:152-160`     | Disparaît                                                                                 |
| Autorisation par rôle avant export                                          | `relay.ts:109-118`, `bank-cases/route.ts:12`, `global/route.ts:8` | `roles.go`                                                                                |
| Réécriture des filtres d'export Grand Public                                | `app/api/export/prospects/route.ts:11-26`                         | Côté Go, même querystring que la liste                                                    |
| Nom de fichier                                                              | `lib/data/export.ts`, `relay.ts:158`                              | `Content-Disposition` posé par Go, la SPA n'a qu'un `<a href>`                            |
| Formulaire public, report `x-forwarded-for`                                 | `app/api/demande/[jeton]/route.ts:75-83,106,64-72`                | Disparaît ; Go lit `X-Forwarded-For` derrière Traefik                                     |
| Validation zod du corps public                                              | `route.ts:13-15,97-100`, `lib/schemas.ts:149-172`                 | tags huma                                                                                 |
| Traduction des refus (`CAPTCHA_REFUSE`, 404 jeton, 429, 503)                | `route.ts:17-36`                                                  | dans la SPA                                                                               |
| `POST /api/app-updates/android`                                             | `app/api/app-updates/android/route.ts:24-28`                      | Supprimé                                                                                  |
| `auth/{login,logout,session,workspace}`                                     | `app/api/auth/*/route.ts`                                         | `login`, `logout` en Go ; `session` devient `GET /api/v1/auth/me` ; `workspace` disparaît |
| `moved-routes.ts` : 17 racines + `/phase2/callbacks`                        | `app/moved-routes.ts:8-42`                                        | 301 côté Go, pas dans la SPA                                                              |

Aucun `middleware.ts`.

## 2. Chargement de données

28 `page.tsx` sur 62 lisent l'API côté serveur ; motif `guardRoles()` puis
`prefetchQuery` puis `HydrationBoundary` (`chues/prospects/page.tsx:23-64`),
requêtes déjà parallèles (`chues/page.tsx:50-67`).

- La garde de rôle devient un choix d'écran ; l'autorité reste `roles.go`.
- TanStack Router `loader` + `queryClient.ensureQueryData` reproduit le
  `Promise.all`.
- États de chargement existants : `loading.tsx` sur 9 routes,
  `shouldShowSkeleton`/`shouldShowError` (`lib/live.ts:24-30`), `QueryErrorState`.
- Cache TanStack Query déjà réglé (`lib/query-client.ts:8-24`) ; la branche
  serveur `:31` disparaît.
- Le repli sidebar lu côté serveur (`(panel)/layout.tsx:35,40-43`) disparaît :
  lire le cookie de façon synchrone avant le premier rendu, sinon la barre saute.

Topics SSE (`components/live/live-stream.tsx:13-33`, `lib/live-stream.ts:9-15`) :

| Topic           | Clés invalidées                       | Émetteur                                                             | Écrans                                                            |
| --------------- | ------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `notifications` | `inboxRoot`                           | `notifications.service.ts:1069,1322`                                 | `NotificationBell` (`notification-bell.tsx:73`), `/notifications` |
| `imports`       | `importsRoot`, `['visites','import']` | `import-runner.service.ts:182,268,307,335`, `imports.service.ts:139` | `/admin/imports`, `/accueil/import`                               |
| `db-dump`       | `databaseDump`                        | `db-dump.service.ts:543`                                             | `/admin/parametres`                                               |
| `referentiels`  | `referentielsRoot`, `reference`       | `cache.interceptor.ts:60`                                            | référentiels, console, RepScript, formulaires                     |
| `app-updates`   | `androidReleases`                     | `app-updates.controller.ts:62`                                       | supprimé                                                          |

Repli par sondage `liveInterval()` (`lib/live.ts:17-22`) à conserver. Aucun
client WebSocket de présence dans `apps/web` : le battement est du code neuf.

## 3. Écrans téléconseiller au pouce

Les quatre écrans sont entièrement clients (`chues/appels-representants/page.tsx:24`,
`chues/console/page.tsx:26`, `chues/rappels/page.tsx:27-31`,
`chues/mes-contacts/page.tsx:23`).

| Écran                 | Acquis après `43f6ffdf`                                                                                     | Ne tient pas à 390 px                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `RepScript`           | `flex-wrap` (`rep-script.tsx:490,963,1580,1641`), boutons 44 px (`ui/button.tsx:31-32`), annuaire en cartes | Longueur : `Qualification` empile tout (`:1476-1545`) ; bouton d'enregistrement `self-start` hors écran (`:1466-1472`) |
| `ConsoleView`         | `flex-wrap` (`console-view.tsx:764`)                                                                        | `<Kbd>` sur les cinq issues (`:825-836`), `PanneauEcheance` (`:992,1007`) ; action principale non ancrée               |
| `/chues/rappels`      | première colonne collante (`ui/table.tsx:75,89`)                                                            | deux tableaux 4 à 6 colonnes (`:186-189`, `rappels-view.tsx:128-135`)                                                  |
| `/chues/mes-contacts` | idem                                                                                                        | tableau 5 colonnes (`mes-contacts-view.tsx:237-241`)                                                                   |
| `/chues/suggestions`  | liste de cartes (`suggestions-view.tsx:142-146`)                                                            | rien                                                                                                                   |
| Fiches                | sept grilles `sm:grid-cols-2`                                                                               | non revérifié                                                                                                          |
| Grand Public          | mêmes composants                                                                                            | mêmes corrections                                                                                                      |

Plus petite refonte : pied collant `sticky bottom-0` sur « Enregistrer »
(`rep-script.tsx:1466`) et la rangée d'issues (`console-view.tsx:825`) ;
`max-md:hidden` sur les 8 `<Kbd>` et la carte clavier (`:1508-1528`), raccourcis
gardés (`use-shortcuts.ts:24`) ; les quatre tableaux téléconseiller en cartes
sous 768 px sur le patron de `suggestions-view.tsx:142-146` ; rien d'autre
(`dvh` déjà sur les modales `ui/dialog.tsx:54`, `responsive-mobile.spec.ts`
couvre 52 routes en Pixel 5, `playwright.config.ts:65-70`).

Découpage sans changement de comportement, `Qualification` gardant les 17
`useState` (`rep-script.tsx:1205-1228`) et `useBrouillonAuto` (`:1234`) :

| Fichier                    | Contenu                                                                                                                   | Lignes |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `rep-annuaire.tsx`         | `RepScript` (`:190-364`), `ResultatsAnnuaire`, `FiltreRelation`, `Pages`, `ChampAnnuaire` (`:364-575`)                    | ~250   |
| `rep-qualification.tsx`    | `Qualification` (`:1192-1552`)                                                                                            | ~290   |
| `rep-etapes.tsx`           | `EtapeQuestions`, `QuestionsJoignable`, `QuestionSuggestion`, `ChoixStatut`, `Question`                                   | ~290   |
| `rep-recap.tsx`            | `RecapAppel`, `Recap`, `EnTeteRepresentant`, `HistoriqueAppels`                                                           | ~180   |
| `rep-reponse.ts`           | `deriverQualification`, `manque*` (`:1070-1140`), `champs*` (`:1141-1175`), `reponseDe`, `outcomeDuStatut`, `scriptExige` | ~210   |
| `console-ui.tsx` (existe)  | `Choix`, `ChoixEcheance` : deux consommateurs (`rep-script.tsx:1621`, `console-view.tsx:950`)                             | ~230   |
| `console-annuaire.tsx`     | `ConsoleView` (`console-view.tsx:115-286`), `ListeAnnuaire`, `ChampAnnuaire`, `deriverFiches`                             | ~290   |
| `console-consignation.tsx` | `Consignation` (`:520-950`)                                                                                               | ~290   |
| `console-echeance.tsx`     | `PanneauEcheance` (`:950-1034`), `Commentaire` (`:1034-1069`)                                                             | ~120   |

`conversion-fields.tsx` (656 l.) est déjà piloté par le schéma
(`reglesChamps`, `:441-450`, `lib/data/console.ts:357,370-385`) : coupe en
deux seulement. Hors périmètre téléconseiller, cinq fichiers de plus de 300
lignes restent : `activity-view.tsx` 1 094, `grand-public/prospect-form.tsx`
1 219, `representant-form-dialog.tsx` 1 028, `imports-view.tsx` 1 007,
`registre-import-view.tsx` 989.

## 4. Notes vocales dans le navigateur

Serveur intact sur `dev` : `POST/GET /api/v1/phase2/call-attempts/:id/recording`
(`phase2.controller.ts:48,78`), fichier nommé par `attemptId`, MIME
`audio/mp4`, `audio/x-m4a` seulement (`recordings.service.ts:23`), 25 Mo,
48 h, balayage horaire par âge et par orphelin (`:35,112-140`). Le panneau v1
n'écoute rien.

Emplacement : enregistrement dans `Consignation` près du commentaire
(`console-view.tsx:1034`) ; écoute dans `HistoriqueAppels` (`rep-script.tsx:944`)
et `appels-representant.tsx`.

`MediaRecorder` natif, aucune bibliothèque : `getUserMedia({audio:true})`,
`new MediaRecorder(stream, {mimeType})` choisi par `isTypeSupported()` dans
l'ordre `audio/webm;codecs=opus`, `audio/mp4`, chaîne vide ; `ondataavailable`
→ `Blob` → `FormData` → `POST` multipart ; `<audio controls>`. MDN : WebM non
pris en charge par Safari, MP4 partout ; Chrome Android donne WebM/Opus. Le
serveur Go accepte donc les deux conteneurs.

| Cas                    | Détection                              | Conduite                                              |
| ---------------------- | -------------------------------------- | ----------------------------------------------------- |
| HTTP non sécurisé      | `navigator.mediaDevices` `undefined`   | bouton absent ; risque en développement sur IP locale |
| Permission refusée     | `NotAllowedError`                      | message une fois, bouton désactivé pour la session    |
| Aucun micro            | `NotFoundError`                        | idem                                                  |
| Pas de `MediaRecorder` | `typeof MediaRecorder === 'undefined'` | bouton absent, commentaire écrit                      |
| Onglet quitté          | `visibilitychange`                     | `stop()` et envoi                                     |
| Durée                  | aucun garde-fou natif                  | plafond client 2 min + plafond d'octets Go            |
| Envoi échoué           | `fetch` en erreur                      | blob gardé en mémoire pour un nouvel essai, message   |

## 5. Formulaires

Neuf fichiers utilisent `react-hook-form` + `zodResolver` sur des formulaires
courts (`lib/schemas.ts`, 174 l.). Les formulaires longs valident à la main :
`rep-script.tsx` (`manqueDe()` `:1070-1140`), `grand-public/prospect-form.tsx`
(`:60,611-617`), `representant-form-dialog.tsx` (`checkPhone`, `ficheEnvoyable`),
`formulaire-demande.tsx` (`validerDemande`, `lib/data/formulaire-public.ts:212-224`),
`conversion-fields.tsx` + `console.ts` (`validateConversion()` `:370-385`,
champs libres `:387-399`), `prospect-create-form.tsx` (`validateProspectForm`),
`visite-form.tsx` (bornes de date), `bank-case-form.tsx` (rien trouvé).

Rien ne se perd sur le fond : l'API renvoie déjà des codes traduits en erreur
de champ (`conversionErrorFor`, `console.ts:621`, `console-view.tsx:583-587`).
Un adaptateur unique remplace `extractMessage` (`packages/api-client/src/query.ts:54-60`).
Ce qui se perd est le temps : validation client obligatoire pour
`ConversionFields` (déjà pilotée par `useChampsConversion`,
`champs-conversion.ts:64-71`), `manqueDe` (active le bouton), la confirmation
de mot de passe (`lib/schemas.ts:75-93`), plus `required`, `type`, `min`,
`max`, `pattern` natifs. Le serveur garde unicité, doublon, cohérence, jeton.

## 6. Tableaux de bord

`DndContext` avec trois capteurs dont `TouchSensor` `delay: 220, tolerance: 8`
(`grille.tsx:333-336,414-436`) : conserver. `chart.js` + `react-chartjs-2`
(`visites-charts.tsx` 1 040 l., `chart-visual.tsx` 677) : migrent sans
changement. Export classeur entièrement client : `exceljs` importé
dynamiquement (`lib/tableau-de-bord-xlsx.ts:87`), classeur en mémoire
(`:81`), `URL.createObjectURL` (`:481`), charte et Arial 14 (`:140-217`) :
rester côté SPA. `serializeWidget()` point unique (`lib/data/disposition.ts:39-51`).

## 7. Tests : 82 specs vers 16 parcours

| #   | Parcours                          | Specs absorbées                                                                                                           | 390 px                    |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Connexion et session              | `auth.anon`, `accueil-connexion.anon`, `accueil-session`, `roles.anon`                                                    | connexion, expiration     |
| 2   | Hub et navigation par rôle        | `roles-*`, `redirections`, `accueil-espaces`, `accueil-coque`, `chues-hub.*`                                              | tiroir, `Sheet`           |
| 3   | Qualifier un représentant         | `chues-etape1.*`, `chues-representants.*`                                                                                 | oui                       |
| 4   | Ajouter un prospect               | `chues-etape2.commercial`, `prospects`                                                                                    | oui                       |
| 5   | Convertir                         | `chues-etape3.commercial`, `console`, `grand-public-console`                                                              | oui, note vocale comprise |
| 6   | Rappels                           | `chues-rappels.*`, `grand-public-rappels`                                                                                 | oui                       |
| 7   | Listes et fiches                  | `chues-prospects.*`, `chues-representants`, `grand-public-liste`, `grand-public-fiche`                                    | oui                       |
| 8   | Suggestions                       | `chues-suggestions.*`                                                                                                     | oui                       |
| 9   | Chiffres et pilotage              | `chues-chiffres*`, `chues-disposition*`, `grand-public-chiffres`                                                          | non                       |
| 10  | Dossiers bancaires                | `chues-dossiers*`, `chues-banque`, `chues-demandes*`                                                                      | non                       |
| 11  | Grand Public complet              | `grand-public-saisie`, `chues-import.roles`                                                                               | oui                       |
| 12  | Registre des visites              | `accueil-*`                                                                                                               | non                       |
| 13  | Admin comptes et référentiels     | `admin-utilisateurs`, `admin-referentiels`, `admin-issues-appel`, `admin-imports`, `representants-import`, `chues-import` | non                       |
| 14  | Admin notifications et paramètres | `admin-notifications`, `admin-parametres`, `admin-enrolement`, `chues-lots-export*`, `global-export`                      | non                       |
| 15  | Cycle bout en bout                | `workspaces`                                                                                                              | non                       |
| 16  | Matrice des rôles                 | générée depuis `roles.go`                                                                                                 | non                       |

Disparaissent : `android-release`, `demo-isolement`, `transversal-mobile`.
`responsive-mobile` (91 l., 52 routes) est gardé tel quel. Ne pas perdre
`transversal-pannes`, `transversal-erreurs`, le budget de 4 connexions
d'`accueil-connexion.anon` (limiteur 10/min) et la connexion partagée
(`playwright.config.ts:44-46`).

## 8. Packages

Garder : `@base-ui/react` 1.7, `lucide-react`, `tailwindcss` 4,
`tw-animate-css`, `cva`, `clsx`, `tailwind-merge`, `cmdk`, `sonner`,
`@tanstack/react-query`, `@tanstack/react-table`, `@dnd-kit/*`, `chart.js`,
`react-chartjs-2`, `exceljs`, `date-fns`, `libphonenumber-js`, `zod`,
`react-hook-form`, `@hookform/resolvers`. Remplacer : `next` → `vite` +
`@tanstack/react-router` ; `next-themes` → ~30 l. `useSyncExternalStore`
(`providers.tsx:17`). Supprimer : `server-only`, `@crm/api-client`,
`@axe-core/playwright` si le parcours accessibilité ne survit pas.

TanStack Router (`@tanstack/react-router` 1.170.33) plutôt que React Router
8.3.1 : seul à typer les paramètres de recherche (`parseProspectFilters`,
`parseRepresentantFilters`, `parseBankFilters`, `?volet=`, `?onglet=`,
`?fiche=`, `?rep=`, `?retour=`, `?kind=` analysés à la main aujourd'hui).

## 9. Arbitrages

| #   | Question                                   | Recommandation                                                                                                             | Coût          |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Conteneur audio accepté                    | `audio/webm` et `audio/mp4`, choix par `isTypeSupported()`                                                                 | 1 ligne Go    |
| 2   | Durée maximale                             | 2 minutes + plafond d'octets                                                                                               | une constante |
| 3   | Rétention                                  | 48 h, balayage double conservé                                                                                             | un cron       |
| 4   | Notes vocales sur les appels représentants | conversion seule d'abord (périmètre mobile, `audits/mobile.md:26`)                                                         |               |
| 5   | Ouvertures de fiche                        | conserver : `useBrouillonAuto`, verrou et chronomètre déjà dans le panneau (`rep-script.tsx:1234`, `console-view.tsx:557`) | 0             |
| 6   | Battement de présence                      | à écrire, ~20 l.                                                                                                           |               |
| 7   | `X-Forwarded-For` pour le limiteur public  | Go doit le lire, sinon le limiteur compte le proxy                                                                         | 3 l.          |
| 8   | `moved-routes`                             | 301 côté Go                                                                                                                |               |
| 9   | `DevRoleSwitcher` et `dev-login`           | supprimer (`FIXTURE_IDENTIFIERS` en dur, `auth.setup.ts` suffit)                                                           |               |
| 10  | Repli sidebar                              | lecture synchrone du cookie au démarrage                                                                                   |               |
| 11  | Export classeur du tableau de bord         | rester côté client avec `exceljs`                                                                                          | 0             |

## Hypothèses et non vérifié

Parc Android Chrome, HTTPS partout, les 21 pages qui préchargent restent des
routes SPA. Aucun rendu à 390 px vérifié (preuve C de la phase 0) ;
`MediaRecorder` non mesuré sur appareil réel ; fin de `recordings.service.ts`
lue partiellement ; fiches à 390 px non relues.
