# CPI GO (mobile)

Application Flutter (FVM `fvm flutter …`) des téléconseillers et commerciaux CPI.

## Signature des APK : la clé de debug, toujours

Décision du propriétaire (30 août 2026) : **toutes les releases Android se
signent avec la clé de debug de la machine de build** (`~/.android/debug.keystore`).
Il n'existe ni `key.properties` ni keystore dédié, et il n'y en a jamais eu dans
le dépôt ; le gradle (`android/app/build.gradle.kts`) retombe de lui-même sur la
signature de debug quand `key.properties` est absent. Ne jamais bloquer une
release ni demander une clé pour cette raison.

La flotte installée est signée par le certificat SHA-256
`0cd1809449d3dde68254fb1bf5640cfcc9f1aa5c0d9fe5d564cf99e61fe06098`.
Android refuse toute mise à jour signée autrement : vérifier chaque artefact
avant diffusion (`apksigner verify --print-certs <apk>` doit rendre cette
empreinte), et sauvegarder ce `debug.keystore` — le perdre rendrait la flotte
non mettable à jour sans réinstallation.

## Livrer une nouvelle version

1. Monter `version:` dans `pubspec.yaml` (le `+N` est le `versionCode`, il doit
   croître).
2. `shorebird release android --artifact apk` depuis `apps/mobile` (jeton dans
   `SHOREBIRD_TOKEN`). L'APK sort dans
   `build/app/outputs/flutter-apk/app-release.apk`.
3. Vérifier l'empreinte du signataire (ci-dessus).
4. Publier l'APK par l'écran d'administration des mises à jour du panel
   (`POST /api/v1/app-updates/android`), en obligatoire si besoin : l'appli le
   propose ou l'impose au prochain démarrage.
5. Les changements purement Dart qui suivent partent en
   `shorebird patch android` sur cette release ; tout changement natif
   (plugins, gradle, kotlin) exige une nouvelle release, Shorebird le refuse
   sinon.
