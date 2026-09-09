# QA mobile : navigation, états, UI, accessibilité, performance

Date : 30 août 2026
Commit : `e8baacd` (arbre modifié)
Méthode : lecture des sources de l'application et de `forui-0.21.3` (`~/.pub-cache`), `fvm flutter analyze` (0 issue dans `lib/`). Aucun émulateur. Chaque constat est étiqueté « prouvé par source » ou « à confirmer par test » (test décrit dans la fiche, non écrit : auditeur en lecture seule).

## Synthèse

| Id    | Sévérité   | Écran / zone                   | Titre                                                                           | Statut                    |
| ----- | ---------- | ------------------------------ | ------------------------------------------------------------------------------- | ------------------------- |
| UI-01 | majeur     | global                         | Le texte ne peut jamais atteindre 200 % (plafond 1,755)                         | prouvé par source         |
| UI-02 | majeur     | démarrage, intro, mise à jour  | Taille de texte et réduction d'animations ignorées sur 3 écrans                 | prouvé par source         |
| UI-03 | majeur     | Accueil Grand Public           | « Appels du jour » figé à zéro en dur                                           | prouvé par source         |
| UI-04 | majeur     | Fiches Grand Public / Réglages | L'état vide envoie vers un bouton qui n'existe pas                              | prouvé par source         |
| UI-05 | majeur     | Annonces                       | Lignes non activables par lecteur d'écran / Switch Access                       | prouvé par source         |
| UI-06 | majeur     | À corriger                     | Cartes sans clé : l'état d'une saisie migre sur une autre                       | à confirmer par test      |
| UI-07 | majeur     | Accueil CHUES                  | Les compteurs des trois étapes comptent tout, pas le reste à faire              | prouvé par source         |
| UI-08 | mineur     | bandeaux d'état                | Message coupé à 2 lignes : la date limite de mise à jour disparaît              | arithmétique, à confirmer |
| UI-09 | mineur     | Mes fiches / Fiches            | Une seule recherche partagée entre CHUES et Grand Public                        | prouvé par source         |
| UI-10 | mineur     | mémoire de route               | Le même écran est restauré dans un projet et pas dans l'autre                   | prouvé par source         |
| UI-11 | mineur     | 8 écrans                       | Roues de chargement sans libellé accessible                                     | prouvé par source         |
| UI-12 | mineur     | Réglages                       | Les cinq en-têtes de section ne sont pas des titres                             | prouvé par source         |
| UI-13 | mineur     | Quel représentant ?            | La recherche n'est jamais vidée entre deux visites                              | prouvé par source         |
| UI-14 | mineur     | Quel représentant ?            | État vide sans geste de sortie                                                  | prouvé par source         |
| UI-15 | cosmétique | Chiffres                       | Heure de pointe « entre 23 h et 24 h »                                          | prouvé par source         |
| UI-16 | cosmétique | À propos                       | Version « 1.0.0 » en dur alors que `PackageInfo` la fournit                     | prouvé par source         |
| UI-17 | cosmétique | Accueil CHUES                  | Erreur annoncée « en cours de lecture », deux glyphes de tiret                  | prouvé par source         |
| UI-18 | cosmétique | Accueil CHUES / GP             | Minuteur d'une minute qui bat même sans rappel                                  | prouvé par source         |
| UI-19 | cosmétique | vocabulaire                    | « Rappels » contre « Rappels promis » du web ; « Fiches » veut dire deux choses | prouvé par source         |

## Fiches

### UI-01 (majeur) Le texte ne peut jamais atteindre 200 %

WCAG 1.4.4 exige 200 %. `display_settings.dart:84-87` : `kCpiMaxTextScale = 1.8`, `kCpiMaxSystemTextScale = 1.3` ; `:173-186` : `systemFactor.clamp(1.0, 1.3)` puis `(systemFactor * choice.factor).clamp(0.85, 1.8)`. Maximum atteignable 1,3 × 1,35 = 1,755. Une police système à 200 % avec réglage « Normal » rend 1,3.
Correctif : porter les deux plafonds à 2,0 et traiter les débordements, ou documenter l'exception. Test : `resolveTextScaleFactor(system: TextScaler.linear(2), choice: normal) == 2.0`.

### UI-02 (majeur) Réglages d'affichage ignorés sur trois écrans

Seule la branche `MaterialApp.router` porte le `builder:` qui pose `textScaler` et `disableAnimations` (`app.dart:100-130`). Les retours anticipés `OnboardingScreen` (`:37-49`), `_BrandSplash` (`:52-64`) et `AppUpdateScreen` (`:76-88`, écran bloquant) n'ont pas de `builder:` : police système brute, `reduceMotion` non transmis à `MediaQuery`.
Correctif : extraire le `builder:` et le passer aux quatre `MaterialApp`.

### UI-03 (majeur) « Appels du jour » figé à zéro

`grand_public_screen.dart:65-72` : `_GrandeCarte(nombre: 0, loading: false, titre: 'Appels du jour', vide: 'Rien à appeler aujourd\'hui.')`. Le chiffre principal de l'accueil Grand Public est une constante, et TalkBack lit « Rien à appeler aujourd'hui » quel que soit l'état. Cause probable : retrait des campagnes, la source du compteur a disparu.
Correctif : brancher un compteur réel ou retirer le chiffre.

### UI-04 (majeur) État vide renvoyant à un bouton inexistant

`grand_public_fiches_screen.dart:198-201` : « Touchez « Recevoir les listes » dans Réglages. » Ce libellé n'existe que dans `referentials_banner.dart:71-77`, jamais dans `reglages_screen.dart:109-264` (« Envoyer maintenant », « Réessayer d'envoyer »).
Correctif : action dans l'état vide (`CpiEmptyState.action` appelant `syncCoordinatorProvider.notifier.run()`), comme `_EmptyHistorique`.

### UI-05 (majeur) Annonces non activables par l'assistance

`notifications_screen.dart:198-203`, `:262-306` : `FTile` nu dans un `FTileGroup.builder` sans `maxHeight`. Dans `forui-0.21.3/lib/src/widgets/tile/tile_group.dart:327`, `maxHeight` infini et `slideableTiles` vrai posent un `FTappableGroup` qui retire `SemanticsAction.tap` de la tuile, ce que le dépôt documente lui-même (`cpi_kit.dart:561-573`, `cpi_choice_group.dart:28-34`, `about_screen.dart:202-207`) et corrige partout ailleurs par `MergeSemantics` + `Semantics(button, onTap)`. `local_typeahead.dart:540` écarté (`maxHeight` fini).
Correctif : remplacer par `CpiRow` ou appliquer la même coquille. Test : `tester.getSemantics(find.byType(_NotificationTile))` expose `SemanticsAction.tap`.

### UI-06 (majeur, à confirmer) « À corriger » : l'état d'une carte migre

`corrections_screen.dart:123-129` : `_CorrectionCard(row: list[index - 1])` sans clé, alors que `_CorrectionCard` est stateful (`_busy`, `_besoinDInternet`, `:194-198`). Toutes les autres listes portent `ValueKey(id)` (`registre_screen.dart:252`, `historique_screen.dart:182`, `rappels_screen.dart:70`, `grand_public_fiches_screen.dart:99`). `CpiListEntrance` a une clé positionnelle (`cpi_pressable.dart:32`).
Correctif : `key: ValueKey<int>(list[index - 1].seq)`. Test : deux lignes en conflit hors ligne, « Choisir » sur A, émettre la liste réduite à B, l'alerte ne doit pas rester sur B.

### UI-07 (majeur) Les compteurs des étapes CHUES comptent tout

`home_screen.dart:55-56`, `:63-64` : `aQualifier = representantCountProvider`, `aConvertir = prospectCountProvider`, requêtes sans filtre (`database.g.dart:13570-13584`, `COUNT(*) WHERE deleted_at IS NULL`), sous les libellés « représentants à appeler » (`:98-99`) et « prospects à appeler » (`:117-118`). L'étape 2 a, elle, une vraie requête de reste à faire (`:28-44`). La charge affichée ne décroît jamais.
Correctif : deux `customSelect` (relation inconnue ; conversion non consignée), ou renommer sans « à appeler ».

### UI-08 (mineur) Bandeau coupé à deux lignes

`cpi_kit.dart:991-1000` : `maxLines: 2`, `ellipsis`, 16 sp semi-gras ; le commentaire `:906-907` annonce trois lignes. Message `app_shell.dart:221-230` (127 caractères, dont la date limite) sur ~236 dp à 320 dp : ~54 caractères visibles. Idem `:233-235`.
Correctif : `maxLines` 3 ou retrait (la bande est dans un `AnimatedSize`, `:114-139`).

### UI-09 (mineur) Une seule recherche pour deux projets

`app_providers.dart:275-283` (`historiqueSearchProvider`) alimente `representantListProvider` (`:285-290`) et `grandPublicProspectListProvider` (`:292-302`) ; consommé par `historique_screen.dart:41/50/65` et `grand_public_fiches_screen.dart:34/76-79`. Le registre a son provider séparé (`:556`).
Correctif : deux providers ou `family` par projet.

### UI-10 (mineur) Restauration de route asymétrique

`route_memory.dart:17-32` liste `Routes.grandPublic` mais ni `Routes.rappels` ni `Routes.reglages` ; `/grand-public/rappels` est restaurable par préfixe (`:153-157`), `/rappels` non, et `write()` (`:92-95`) efface la mémoire sur une adresse non restaurable.
Correctif : ajouter `Routes.rappels` et `Routes.reglages` à `allowList`.

### UI-11 (mineur) Roues de chargement sans libellé

`FCircularProgress()` nu dans `historique_screen.dart:112`, `representant_picker_screen.dart:76`, `representant_detail_screen.dart:48`, `prospect_detail_screen.dart:66`, `registre_screen.dart:491`, `correction_visite_sheet.dart:227`, `notifications_screen.dart:153`, `corrections_screen.dart:100`. `CpiLoadingState` (`cpi_kit.dart:852-882`) n'est utilisé nulle part.
Correctif : `semanticsLabel: 'Chargement'` ou `CpiLoadingState`.

### UI-12 (mineur) En-têtes de Réglages sans rôle de titre

`reglages_screen.dart:558-565` : `Text(title.toUpperCase())` nu ; `CpiSectionHeader` (`cpi_kit.dart:762-780`) pose `Semantics(header: true)` et n'est pas utilisé.

### UI-13 (mineur) Recherche du sélecteur jamais vidée

`representantPickerSearchProvider` (`app_providers.dart:304-312`) n'est écrit qu'en `representant_picker_screen.dart:36`, jamais remis à vide. Le registre le fait (`visites_repository.dart:89-93`).

### UI-14 (mineur) État vide du sélecteur sans geste

`representant_picker_screen.dart:194-215` : ni « Effacer la recherche » ni action de téléchargement, contrairement à `historique_screen.dart:239-255` et `registre_screen.dart:470-475`.

### UI-15 (cosmétique) « entre 23 h et 24 h »

`chiffres_screen.dart:122-124` : `heure + 1` sans modulo. Correctif : `% 24`.

### UI-16 (cosmétique) Version en dur

`about_screen.dart:47`, `:91` : `'1.0.0'` littéral ; `main.dart:38` construit un `PackageInfo` et n'en transmet que `buildNumber` (`:49`).

### UI-17 (cosmétique) Erreur lue comme un chargement

`home_screen.dart:195-208` : `nombre == null` rend « en cours de lecture » y compris en erreur ; tiret demi-cadratin `:197` contre tiret cadratin `cpi_kit.dart:833`.

### UI-18 (cosmétique) Minuteur inconditionnel

`rappels_en_retard_banner.dart:44-50` : `Timer.periodic(1 min)` armé même sans rappel ; annulé en `dispose` (`:52-56`), pas de fuite, reconstruction inutile toutes les 60 s sur trois écrans.

### UI-19 (cosmétique) Vocabulaire

Web « Rappels promis » (`nav-items.ts:250`, `:507`) contre mobile « Rappels » (`rappels_screen.dart:41`, `home_screen.dart:293`, `grand_public_screen.dart:84`). « Fiches » = représentants dans la coque CHUES (`app_shell.dart:52-57`, `historique_screen.dart:73`) et prospects dans la coque Grand Public (`grand_public_fiches_screen.dart:37`). `AccesRefuse` affiche « Registre réservé » sous le titre « Chiffres » (`acces_refuse.dart:32`, `chiffres_screen.dart:26`).

## Vérifié sans défaut

- Contraste : paires couvertes par `theme_test.dart` et `theme_tokens_test.dart` ; encre de `CpiStatusBand` recalculée à la main, bien au-dessus de 4,5:1.
- Cibles tactiles : `kCpiMinTouchTarget = 48`, boutons 56, actions d'en-tête 52 ; rien sous 44 dp.
- Coquilles sémantiques ForUI correctes dans `CpiRow`, `CpiBottomNav`, `CpiHeaderAction`, `CpiBackButton`, `CpiWorkspaceSwitch`, `_ChoiceTile`, `_LigneCopiable`.
- Timers et `setState` après `dispose` : tous annulés avec garde `mounted`.
- Aucun double `Scaffold`, aucun `SnackBar` direct hors le repli documenté de `cpiToast`.
- Listes paresseuses partout où la taille est variable ; pull-to-refresh sur les six listes rechargeables.
- Aucune route mémorisée morte après le retrait des campagnes.
- Retour arrière : `CpiPopScope` + `popOrHome` sur les écrans poussés.

## Non vérifié

Tout ce qui demande un appareil (TalkBack, Switch Access, rotation, débordements mesurés, fluidité) ; les tests widget décrits (UI-06, UI-08 restent « à confirmer ») ; les gros formulaires, relevant du testeur « formulaires » ; comparaison des libellés limitée à `nav-items.ts`.

## Cause racine transverse

UI-05, UI-11, UI-12 : une primitive du kit porte la règle d'accessibilité (`CpiRow`, `CpiLoadingState`, `CpiSectionHeader`) et un écran a recodé la ligne sans elle. Correctif structurel : utiliser la primitive.

## Commandes exécutées

`git rev-parse --short HEAD` → `e8baacd` ; `fvm flutter --version` → Flutter 3.41.7, Dart 3.11.5 ; `fvm flutter analyze` → 1 issue dans `test/qa/qa_sync_test.dart:14` (fichier d'un autre testeur), 0 dans `lib/`. Aucun fichier créé ni modifié par l'auditeur.
