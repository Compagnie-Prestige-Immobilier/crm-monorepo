# QA mobile : émulateur (boîte noire)

Date : 30 août 2026.

## Environnement

| Élément     | Valeur                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| AVD         | `Pixel_10_Pro_XL` (seul AVD), `emulator-5554`                             |
| Écran       | 1344 x 2992, densité 480                                                  |
| Système     | `sdk gphone16k arm64`, fuseau `Africa/Dakar`                              |
| Flutter     | 3.41.7 via FVM, build **debug** (`emu.sh run`)                            |
| Application | `sn.cpi.go`, moteur de rendu Impeller (OpenGLES)                          |
| Commit      | `e8baacd`, arbre de travail **modifié**                                   |
| API         | `http://localhost:3001`, vue par l'émulateur comme `http://10.0.2.2:3001` |
| Compte      | `fixture.awa@cpi.sn` (COMMERCIAL / Télécounseiller)                       |

L'URL de l'API n'a demandé aucun `--dart-define` : `ApiEnvironment` retient
`http://10.0.2.2:3001` par défaut hors release
(`apps/mobile/lib/core/network/api_environment.dart:8-11`).

**Blocage d'environnement levé avant de commencer** (hors périmètre mobile, noté
pour le mainteneur). L'API refusait de démarrer :

```
Error: Les schémas PostgreSQL public et demo ne portent pas les mêmes migrations.
    at PrismaClients.assertMigrationParity (apps/api/dist/prisma/prisma.service.js:59:19)
```

Le schéma `demo` avait 40 migrations contre 41 pour `public`, la manquante étant
`20260830132651_lot_export_repartition`. Levé par
`DATABASE_URL='postgresql://crm:crm@localhost:5434/crm?schema=public' pnpm db:deploy`.
À noter : `pnpm db:deploy` échoue si `DATABASE_URL` n'est pas exporté dans le
shell, le `.env` de `apps/api` n'étant pas lu par
`packages/database/src/deploy-workspaces.ts`.

## Synthèse

| Id     | Sévérité   | Parcours                                 | Titre                                                                                                                                                                                                         |
| ------ | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EMU-01 | bloquant   | CHUES, ajout puis conversion de prospect | Le formulaire promet « Il sera enregistré », le serveur refuse le numéro, et la saisie est bloquée à vie : aucune modification possible, et l'application laisse enchaîner une conversion complète par-dessus |
| EMU-02 | majeur     | CHUES, consigner un appel                | Écran « Enregistré » sans sortie : retour Android et flèche de retour inertes                                                                                                                                 |
| EMU-03 | majeur     | Connexion                                | La saisie au clavier bloque le fil principal jusqu'à 13,7 s : caractères perdus, puis « CPI GO isn't responding »                                                                                             |
| EMU-04 | mineur     | CHUES, ajout de prospect                 | Doublon de téléphone : la seule action offerte est « Réessayer », qui échoue toujours                                                                                                                         |
| EMU-05 | mineur     | Introduction                             | Le retour Android sur la page 2 sur 2 ferme l'application au lieu de revenir à la page 1                                                                                                                      |
| EMU-06 | mineur     | CHUES, étape 1, résultat « À rappeler »  | Le récapitulatif « À enregistrer » n'affiche pas la date du rappel programmé                                                                                                                                  |
| EMU-07 | cosmétique | À corriger                               | Les codes d'erreur bruts `PHONE_INVALID` et `PHASE2_PROSPECT_NOT_FOUND` sont montrés au télécounseiller                                                                                                       |
| EMU-08 | cosmétique | CHUES, ajout de prospect                 | Le libellé de l'interrupteur « Le représentant lui-même est intéressé » est tronqué à la taille de texte par défaut                                                                                           |

---

### EMU-01 — Le client accepte un numéro que le serveur refuse, et la saisie devient un zombie

**Sévérité** : bloquant. **Parcours** : CHUES, étape 2 « Ajouter des prospects »,
puis « Consigner l'appel ».

C'est le défaut le plus grave observé : perte de travail terrain silencieuse,
sans aucun chemin de réparation dans l'application.

**Reproduction**

```bash
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
D=emulator-5554
# connecté en fixture.awa@cpi.sn
$S tap-label "Projet CHUES"
$S tap-label "Étape 2"
$S tap-label "Représentant Essai 49"
$S tap-label "Prénom";     adb -s $D shell input text "QATest"
$S tap-label "Nom";        adb -s $D shell input text "Zzz"
$S tap-label "Téléphone"
for c in 1 2 3 4 5 6 7 8 9; do adb -s $D shell input text "$c"; sleep 0.25; done
adb -s $D shell input keyevent 4        # referme le clavier
$S tap-label "Continuer"
$S tap-label "Enregistrer et suivant"
# puis onglet « À corriger »
```

**Attendu** : soit le numéro `+221 12 345 67 89` est refusé à la saisie, au
moment où l'utilisateur a le contact au téléphone et peut redemander le bon
numéro ; soit il est accepté et il part. Dans tous les cas, une saisie refusée
par le serveur doit pouvoir être **corrigée**, l'onglet s'appelant « À corriger ».

**Observé**, en quatre temps :

1. Le formulaire affiche un avertissement **doux** sous le champ :
   « Préfixe inhabituel : vérifiez le numéro. **Il sera enregistré.** »
   « Continuer » reste actif. L'application promet explicitement l'enregistrement.
2. « Enregistrer et suivant » réussit visuellement : le compteur passe à
   « 1 prospect ajouté », et l'accueil CHUES passe de « 31 prospects à appeler »
   à « 32 ».
3. À la synchronisation, le serveur refuse : la saisie tombe dans « À corriger »
   avec « Numéro de téléphone invalide : +221123456789 » et le badge
   `PHONE_INVALID`. Le bandeau d'accueil dit lui-même
   « 1 saisie à corriger. **Aucun envoi ne les débloquera.** »
4. **Aucune correction n'est possible.** Les seules actions sont « Réessayer »
   (rejeu de la même requête, donc échec identique et déterministe) et, sous
   « Autres » : « Voir la fiche » et « Supprimer cette saisie ». La fiche
   n'offre que « Appeler » et « Consigner l'appel » — pas de modification du
   numéro. Le seul chemin est de **détruire** la saisie et de tout ressaisir.

**Aggravation, effet cascade.** Depuis cette fiche condamnée, l'application
laisse dérouler le formulaire de conversion en **5 étapes** jusqu'au bout, avec
un « Enregistré ✅ Méthode obtenue : Plateforme ». La conversion tombe elle
aussi dans « À corriger » : « Appel · QATest Zzz — Prospect introuvable ou
supprimé — `PHASE2_PROSPECT_NOT_FOUND` ». Une saisie invalide en engendre
d'autres, indéfiniment, et chacune coûte un appel réel au télécounseiller.

**Preuve**

Contrôle serveur, le prospect n'existe pas :

```
$ psql ... -c "select count(*) from public.prospects where \"phoneE164\" like '%12345678%'"
0
```

Arbre d'accessibilité de « À corriger » après la conversion :

```
180  122  -    '2 saisies bloquées'
180  257  -    'Prospect · QATest Zzz\nNuméro de téléphone invalide : +22112…'
180  285  tap  'Réessayer'
180  336  tap  'Autres'
180  485  -    'Appel · QATest Zzz\nProspect introuvable ou supprimé.\nPHASE2…'
180  502  tap  'Réessayer'
```

Actions offertes sous « Autres », aucune ne corrige :

```
180  695  tap  'Voir la fiche'
180  746  tap  'Supprimer cette saisie'
```

Captures :

- `docs/qa-mobile/captures/emu06-a-corriger-impasse.jpg` (première saisie bloquée, `PHONE_INVALID`)
- `docs/qa-mobile/captures/emu06-cascade-2-saisies.jpg` (les deux saisies bloquées)
- `docs/qa-mobile/captures/emu06-fiche-sans-modification.jpg` (la fiche n'offre pas la modification)

**Fréquence** : systématique, 1 essai complet suivi de bout en bout, chaque étape
vérifiée en base. Le désaccord de validation est déterministe : le client
accepte tout préfixe avec un simple avertissement, le serveur applique une liste
de préfixes.

---

### EMU-02 — Écran « Enregistré » sans sortie dans « Consigner un appel »

**Sévérité** : majeur. **Parcours** : CHUES, « Consigner l'appel », étape 5 sur 5.

**Reproduction**

```bash
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
# depuis une fiche prospect
$S tap-label "Consigner l'appel"
# dérouler les 5 étapes, puis à l'étape 5 :
$S tap-label "Méthode obtenue : Plateforme. En ligne"
# l'écran passe à « Enregistré »
adb -s emulator-5554 shell input keyevent 4     # retour Android
```

**Attendu** : après un enregistrement, le retour Android ramène à la fiche ou à
l'accueil du projet, comme partout ailleurs dans l'application.

**Observé** : l'écran de succès n'offre qu'un bouton « Numéro suivant ». Le
bouton retour Android est **sans effet** (4 pressions consécutives : l'écran ne
bouge pas et l'application garde le focus, elle ne se ferme pas non plus). La
flèche de retour de l'en-tête est présente à l'écran mais **inerte** : son nœud
d'accessibilité `'Revenir à sa banque'` n'a plus l'indicateur `tap`, et un
`input tap` dessus ne fait rien. L'utilisateur qui vient de finir son dernier
appel de la journée ne peut pas sortir : il doit taper « Numéro suivant », qui
relance un nouvel appel à l'étape 1 sur 5, et seulement là retrouver un
« Retour » actif.

**Preuve**

Arbre d'accessibilité de l'écran de succès, aucun nœud tactile de sortie :

```
180  400  -   'android:id/content'
 33   63  -   'Revenir à sa banque'          <- pas d'indicateur `tap`
180  143  -   "Étape 5 sur 5. Comment la personne s'inscrit-elle ?"
180  257  -   'Enregistré : Méthode obtenue : Plateforme.'
```

Après 4 `input keyevent 4`, l'arbre est identique et la fenêtre reste
l'application :

```
mCurrentFocus=Window{89f07ae u0 sn.cpi.go/sn.cpi.go.MainActivity}
```

Capture : `docs/qa-mobile/captures/emu07-ecran-sans-sortie.jpg`.

**Fréquence** : systématique, 4 pressions retour + 1 appui sur la flèche
d'en-tête, aucun effet.

---

### EMU-03 — La saisie au clavier bloque le fil principal jusqu'à 13,7 s

**Sévérité** : majeur. **Parcours** : connexion.

**Reproduction**

```bash
D=emulator-5554
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
$S tap-label "Identifiant"
adb -s $D shell input text "fixture.awa@cpi.sn"
sleep 1
$S tap-label "Mot de passe"
adb -s $D shell input text "MauvaisMotDePasse1"
```

**Attendu** : les deux champs contiennent le texte saisi ; l'interface reste
réactive pendant la frappe.

**Observé**, trois faits enchaînés :

1. Une partie des caractères est perdue. `input text "fixture.awa@cpi.sn"` ne
   laisse que `fixture.awa@` dans le champ ; les six derniers sont avalés. Il a
   fallu les retaper un par un avec 0,4 s d'attente pour compléter l'identifiant.
2. Le fil principal reste bloqué plusieurs secondes par événement clavier, avec
   des rafales de trames sautées.
3. Au bout d'une dizaine de secondes, le système affiche
   « CPI GO isn't responding — Close app / Wait ». Après « Wait », le champ
   Identifiant est **vide** et le champ Mot de passe ne contient que 3
   caractères sur 18 : la saisie a été annulée par le système.

**Preuve**

Arbre d'accessibilité au moment de l'ANR :

```
180  371  -    "CPI GO isn't responding"
180  413  tap  'Close app'
180  452  tap  'Wait'
```

`adb logcat` sur `sn.cpi.go` :

```
InputDispatcher: ed27ad4 sn.cpi.go/sn.cpi.go.MainActivity spent 3529ms processing KeyEvent
InputDispatcher: Window ed27ad4 sn.cpi.go/... is unresponsive: ... Waited 5507ms for KeyEvent
InputDispatcher: Canceling events for ed27ad4 sn.cpi.go/... because it is unresponsive
InputDispatcher: ed27ad4 sn.cpi.go/sn.cpi.go.MainActivity spent 9966ms processing KeyEvent
InputDispatcher: Window ed27ad4 sn.cpi.go/... is unresponsive: ... Waited 11415ms for KeyEvent
InputDispatcher: ed27ad4 sn.cpi.go/sn.cpi.go.MainActivity spent 11721ms processing KeyEvent
InputDispatcher: ed27ad4 sn.cpi.go/sn.cpi.go.MainActivity spent 13734ms processing KeyEvent
```

Journal Flutter (`/tmp/android-emu-flutter-18395.log`) sur la même fenêtre :

```
I/Choreographer: Skipped 468 frames!  The application may be doing too much work on its main thread.
I/Choreographer: Skipped 374 frames!  ...
I/Choreographer: Skipped 240 frames!  ...
I/Choreographer: Skipped 217 frames!  ...
I/Choreographer: Skipped 215 frames!  ...
```

468 trames à 60 Hz font 7,8 s d'écran figé.

Capture de l'identifiant tronqué après un seul `input text` :
`docs/qa-mobile/captures/emu02-identifiant-tronque.jpg` (le champ affiche
`fixture.awa@` alors que `fixture.awa@cpi.sn` a été envoyé).

Symptôme indirect reproductible : `uiautomator dump` renvoie
`ERROR: null root node returned by UiTestAutomationBridge` immédiatement après
chaque frappe dans un champ, et redevient normal 5 à 10 s plus tard. Le pont
d'accessibilité ne peut lire l'arbre que si le fil principal répond.

**Réserve honnête** : ces mesures sont prises sur un **build de débogage**, dont
le JIT est intrinsèquement plus lent qu'une release. Le mainteneur doit
contre-vérifier en `--profile` ou `--release` avant de conclure sur l'ampleur.
Ce qui reste indépendant du mode de build : le fil principal est le chemin
critique de chaque frappe, et la perte silencieuse de caractères est un risque
direct sur un champ mot de passe, où l'utilisateur ne relit pas ce qu'il tape.

**Fréquence** : perte de caractères systématique sur `input text` d'une chaîne
complète (3 essais sur 3, identifiant comme mot de passe) ; boîte ANR observée
1 fois sur 3 essais. Ralentissements marqués observés aussi hors connexion, sur
la recherche de représentant et le formulaire de prospect.

---

### EMU-04 — Doublon de téléphone : « Réessayer » est la seule issue et ne peut pas réussir

**Sévérité** : mineur. **Parcours** : CHUES, étape 2 « Ajouter des prospects ».

**Reproduction**

```bash
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
# après avoir déjà créé un prospect au numéro 12 345 67 89 sur ce représentant
$S tap-label "Étape 2"; $S tap-label "Représentant Essai 49"
# ressaisir un autre nom avec LE MÊME numéro, puis :
$S tap-label "Continuer"
$S tap-label "Enregistrer et terminer"
$S tap-label "Réessayer"
```

**Attendu** : la détection de doublon de l'étape 1 (« Déjà saisi : QATest Zzz »)
bloque la progression, ou bien l'erreur d'enregistrement propose l'action utile
— modifier le numéro, ou ouvrir la fiche existante.

**Observé** trois glissements successifs :

1. À l'étape 1, l'application détecte bien le doublon et affiche
   « Déjà saisi : QATest Zzz ». Mais « Continuer » reste **actif**.
2. Le récapitulatif « À enregistrer » de l'étape 2 **ne rappelle pas** le
   doublon. L'utilisateur qui a passé l'avertissement n'a plus aucun signal.
3. « Enregistrer et terminer » échoue avec « Ce numéro est déjà enregistré sur
   cet appareil. » et la seule action proposée est **« Réessayer »**. Or
   l'échec est déterministe : le doublon existe toujours. Un second appui sur
   « Réessayer » redonne exactement la même erreur. Le bandeau d'erreur suit
   même l'utilisateur quand il revient à l'étape 1, où « Réessayer » n'a plus
   de sens, l'enregistrement appartenant à l'étape 2.

**Preuve**

Étape 1, doublon détecté mais « Continuer » actif :

```
180  445  tap  '12 345 67 89'
180  523  -    'Déjà saisi : QATest Zzz'
180  750  tap  'Continuer'
```

Après « Enregistrer et terminer », puis après « Réessayer », arbre **identique** :

```
180  143  -    'Ce numéro est déjà enregistré sur cet appareil.'
284  156  tap  'Réessayer'
```

Captures : `docs/qa-mobile/captures/emu05-doublon-etape1.jpg`,
`docs/qa-mobile/captures/emu05-doublon-bloque.jpg`.

**Fréquence** : systématique, 2 appuis sur « Réessayer », même résultat.

---

### EMU-05 — Le retour Android sur la page 2 sur 2 ferme l'application

**Sévérité** : mineur. **Parcours** : introduction (premier lancement).

**Reproduction**

```bash
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
adb -s emulator-5554 shell pm clear sn.cpi.go        # état premier lancement
adb -s emulator-5554 shell monkey -p sn.cpi.go -c android.intent.category.LAUNCHER 1
$S tap-label "Continuer"                             # on arrive sur « Page 2 sur 2 »
adb -s emulator-5554 shell input keyevent 4          # retour Android
adb -s emulator-5554 shell dumpsys window | grep mCurrentFocus
```

**Attendu** : le retour ramène à la page 1 sur 2 (« Saisissez partout »).

**Observé** : l'application se ferme et le lanceur reprend la main. Au
relancement, l'introduction repart de la page 1, la progression n'étant pas
mémorisée.

**Preuve**

Arbre avant le retour :

```
180  410  -     'Tout part tout seul'
180  704  -     'Page 2 sur 2'
180  750  tap   'Commencer'
```

Après `input keyevent 4` :

```
mCurrentFocus=Window{87efcd5 u0 com.google.android.apps.nexuslauncher/...NexusLauncherActivity}
mFocusedApp=ActivityRecord{237488221 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t2}
```

Capture : `docs/qa-mobile/captures/emu01-onboarding-page2.jpg`.

**Fréquence** : systématique, 2 essais sur 2.

---

### EMU-06 — Le récapitulatif « À enregistrer » omet la date du rappel programmé

**Sévérité** : mineur. **Parcours** : CHUES, étape 1 « Qualifier les
représentants », résultat « À rappeler ».

**Reproduction**

```bash
S=/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh
$S tap-label "Projet CHUES"; $S tap-label "Étape 1"
$S tap-label "Représentant Essai 50"
$S tap-label "Comment s'est passé l'appel ? : À rappeler"
$S tap-label "Choisir une date"
$S tap-label "3 septembre 2026"
$S tap-label "Valider"                          # donne « jeu. 3 sept., 08 h 00 »
adb -s emulator-5554 shell input tap 672 2800   # Continuer
```

**Attendu** : l'encadré « À enregistrer » de l'étape 2 sur 2 récapitule tout ce
qui va partir, y compris la date et l'heure de rappel. C'est la donnée la plus
facile à se tromper de tout le formulaire (calendrier plus roue d'heure), et la
seule que l'écran de confirmation n'affiche pas.

**Observé** : l'encadré ne liste que trois lignes.

```
'À enregistrer'
'Personne appelée : Représentant Essai 50'
'Téléphone : +221 78 100 48 50'
'Résultat : À rappeler'
```

La date `jeu. 3 sept., 08 h 00` n'apparaît nulle part sur l'étape 2. Pour la
vérifier il faut revenir à l'étape précédente. La donnée est pourtant bien
transmise : après enregistrement, la base porte
`outcome=CALLBACK, callbackAt=2026-09-03 08:00:00`.

**Preuve** : `docs/qa-mobile/captures/emu03-recap-sans-date-rappel.jpg`.

**Fréquence** : systématique, 1 essai (l'encadré est statique, il ne dépend pas
de la date choisie).

---

### EMU-07 — Les codes d'erreur bruts sont montrés au télécounseiller

**Sévérité** : cosmétique. **Parcours** : « À corriger ».

**Attendu** : l'écran destiné à un télécounseiller n'affiche que le message en
français, déjà présent et correct.

**Observé** : sous chaque message, un badge rouge portant le code technique de
l'API, en majuscules et en anglais : `PHONE_INVALID`,
`PHASE2_PROSPECT_NOT_FOUND`. Rien dans l'application ne les explique.

**Preuve** : `docs/qa-mobile/captures/emu06-cascade-2-saisies.jpg`, les deux
badges sont lisibles sous les messages « Numéro de téléphone invalide » et
« Prospect introuvable ou supprimé ».

**Fréquence** : systématique, présent sur les 2 saisies bloquées observées.

---

### EMU-08 — Le libellé de l'interrupteur est tronqué à la taille de texte par défaut

**Sévérité** : cosmétique. **Parcours** : CHUES, étape 2 « Ajouter des
prospects », étape 1 sur 2 « Qui est-ce ? ».

**Attendu** : sur un Pixel 10 Pro XL, à la taille de texte **par défaut**, le
libellé d'une option et sa description tiennent en entier, en passant à la ligne
si nécessaire.

**Observé** : les deux lignes sont coupées avec des points de suspension.

```
Le représentant lui-même est int…
Son nom et son numéro sont déj…
```

L'utilisateur ne peut pas lire ce que l'interrupteur fait ni ce qu'il implique,
sur le plus grand téléphone du catalogue et au réglage standard. Sur un écran de
320 dp la troncature sera plus sévère.

**Preuve** : `docs/qa-mobile/captures/emu04-libelle-tronque.jpg`. Le nœud
d'accessibilité porte le texte complet, seul l'affichage tronque, ce qui rend le
défaut invisible aux vérifications par arbre :

```
180  240  tap  'Le représentant lui-même est intéressé\nSon nom et son numér…'
```

**Fréquence** : systématique, observé à chaque passage sur l'écran (3 fois).

---

## Écarté après vérification

Un candidat a été instruit puis **écarté**, il ne doit pas être compté. La teinte
bleue du parcours CHUES (bordure de l'option sélectionnée, calendrier,
« Changer de date », barre de progression) alors que la connexion et le hub sont
bordeaux n'est pas une régression de thème : le bleu est la couleur de marque de
la CHUES, branchée volontairement via `AppTheme.chues`
(`apps/mobile/lib/core/theme/forui_theme.dart:55`, « y brancher le bordeaux (ou
le bleu CHUES) repeint chaque bouton »). Aucun défaut.

Captures conservées pour référence :
`docs/qa-mobile/captures/emu04-calendrier-bleu.jpg`,
`docs/qa-mobile/captures/emu04-selection-bleue.jpg`.

## Parcours couverts sans défaut

- **Introduction, double appui.** Deux `input tap` simultanés sur « Continuer »
  (page 1 sur 2) ne sautent pas la page 2 : un seul passage est consommé.
- **Connexion, champs vides.** Valider à vide affiche deux erreurs distinctes,
  « Écrivez votre identifiant. » et « Écrivez votre mot de passe. ».
- **Connexion, 12 mots de passe faux d'affilée.** L'application reste utilisable,
  affiche « Identifiants invalides. » à chaque tentative, et le bon mot de passe
  passe immédiatement à la 13e. Côté API le limiteur de débit est bien actif :
  12 `POST /api/v1/auth/login` en boucle depuis l'hôte donnent `401` sur les
  4 premières puis `429 TOO_MANY_REQUESTS` sur les 8 suivantes.
- **Hub des projets selon le rôle.** En COMMERCIAL, le hub n'affiche que
  « Projet CHUES » et « Projet Grand Public » ; « Accueil » est absent, ce qui
  est correct pour ce rôle.
- **Mise à jour obligatoire.** Aucun écran de blocage n'est apparu : l'API
  démarrée avec `APK_SIGNER_SHA256` laisse passer, le parcours nominal n'est pas
  entravé.
- **CHUES, recherche de représentant, cas limites.** Recherche sans résultat
  (`zzzzzzzz`) : état vide propre, « Aucun résultat / Vérifiez le nom ou le
  numéro. » avec bouton « Effacer la recherche ». Recherche de 540 caractères
  (`Representant` x 45) : pas de plantage, pas de gel, libellé tronqué
  proprement, même état vide.
- **CHUES, étape 1, date de rappel dans le passé.** Le calendrier grise les jours
  antérieurs à aujourd'hui et ne les expose pas dans l'arbre d'accessibilité. Un
  `input tap` sur le 17 août 2026 ne sélectionne rien. Aucun rappel ne peut être
  programmé dans le passé par ce chemin.
- **CHUES, étape 1, garde-fous de progression.** « Continuer » reste inactif avec
  le libellé de raison tant qu'aucun résultat n'est choisi (« Choisissez d'abord
  le résultat »), puis tant qu'aucune échéance n'est choisie pour « À rappeler »
  (« Choisissez quand rappeler »).
- **CHUES, étape 1, anti-double-envoi.** Trois appuis sur « Enregistrer » (deux
  simultanés puis un troisième à 1 s) ne créent **qu'une seule** tentative
  d'appel côté serveur :
  `select count(*) from rep_call_attempts where "representantId"='01a05324-…'` → 1.
  La date choisie est correctement transmise (`callbackAt = 2026-09-03 08:00:00`).
- **CHUES, étape 2, champ téléphone.** Le préfixe `+221` est fixe et non
  éditable, le formatage en groupes `77 123 45 67` est appliqué à la frappe, et
  un préfixe inconnu déclenche un avertissement visible (voir toutefois EMU-01
  sur ce que cet avertissement promet).
- **Permission de notifications.** Demandée au premier enregistrement d'un
  rappel, avec la boîte système standard ; « Allow » n'interrompt pas
  l'enregistrement en cours, qui se termine correctement.

## Non testé

Le flux a été interrompu par une coupure de session. Les parcours suivants n'ont
**pas** été exécutés et ne doivent pas être considérés comme couverts.

| Parcours                                                                                                        | Raison                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Résultats « Joignable » et « Injoignable », question « représentant CHUES » oui/non, représentant déjà qualifié | Temps ; seul le chemin « À rappeler » a été suivi jusqu'au bout                                                            |
| Brouillon d'un formulaire de prospect interrompu                                                                | Non atteint                                                                                                                |
| Conversion d'un prospect **valide** (phase 2 / 3, méthodes autres que « Plateforme », champs étendus)           | Seule la conversion d'un prospect condamné a été suivie, pour prouver EMU-01                                               |
| Rappels promis, notifications déclenchées, échéance passée                                                      | Non atteint                                                                                                                |
| Historique, onglet « Fiches »                                                                                   | Non atteint                                                                                                                |
| Grand Public (saisie prospect direct)                                                                           | Non atteint                                                                                                                |
| Accueil (registre des visites, formulaire de visite, chiffres)                                                  | Le compte utilisé est COMMERCIAL ; demande une reconnexion en `fixture.accueil@cpi.sn`                                     |
| Réglages (thème, taille de texte, animations), à propos, permission batterie                                    | Non atteint                                                                                                                |
| Déconnexion puis reconnexion avec un autre rôle, fuite de données de l'ancien compte                            | Non atteint. Déjà couvert par SEC-01 de `securite-session.md` et SYN-02 de `synchronisation.md` : ne pas compter deux fois |
| Saisie hors ligne puis synchronisation, mode avion 10 minutes, application tuée pendant une synchronisation     | Non atteint. Domaine déjà couvert par `synchronisation.md` (SYN-01 à SYN-07)                                               |
| Rotation d'écran, taille de texte à 200 %, réduction d'animations, écran de 320 dp                              | Non atteint. Recouvrement avec UI-01 et UI-02 de `navigation-ui.md`                                                        |
| Horloge de l'appareil décalée                                                                                   | Non atteint                                                                                                                |
| Saisie d'emoji dans un champ libre                                                                              | `adb shell input text` ne transmet pas les caractères hors BMP ; demande un autre canal (presse-papier ou IME de test)     |

## Reproduire l'environnement

```bash
# 1. Base : aligner les schémas public et demo
DATABASE_URL='postgresql://crm:crm@localhost:5434/crm?schema=public' pnpm db:deploy

# 2. API
cd apps/api
JWT_ACCESS_TTL=4h \
APK_SIGNER_SHA256=9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909 \
pnpm start

# 3. Émulateur et application
/Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh boot
cd apps/mobile && /Users/cheikh/.claude/skills/android-emulator/scripts/emu.sh run
```

## Nettoyage à faire côté base

Les données de test créées pendant cette campagne restent en base et sur
l'appareil :

- `rep_call_attempts` id `01a0533c-15d2-70c6-b8ab-d8a4164b0976` (rappel au
  3 septembre 2026 sur « Représentant Essai 50 ») ;
- deux saisies locales bloquées sur l'émulateur (prospect « QATest Zzz » et sa
  conversion), qui ne sont jamais parties au serveur.
