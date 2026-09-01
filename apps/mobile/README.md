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

## arm64 uniquement, jamais d'APK universel

La flotte est 100 % arm64-v8a (Redmi 9T, Samsung A07, …). **Toute release Android
se construit avec `--target-platform android-arm64`**, jamais en universel : le
moteur Flutter (`libflutter.so`, `libapp.so`) ne doit exister que pour arm64.
Sans ce drapeau, l'APK pèse ~87 Mo (les trois ABI) ; avec, ~37 Mo, soit −57 %
sur un lien mobile facturé.

Vérifier chaque artefact avant diffusion :

```
unzip -l <apk> | grep -E 'lib/.*/lib(flutter|app)\.so'
```

ne doit rendre QUE des chemins `lib/arm64-v8a/…`. Un `libflutter.so`/`libapp.so`
sous `armeabi-v7a` ou `x86_64` = APK universel, à rejeter et reconstruire.

Restent quelques stubs de plugins (`libsqlite3.so`, `libdartjni.so`, ~3,6 Mo)
sous les autres ABI : Shorebird bâtit un app-bundle puis en dérive un APK
universel via bundletool, étape qui réinjecte ces `.so` de dépendances. Ils sont
INERTES (aucun moteur pour les charger). Un `ndk { abiFilters }` gradle n'atteint
pas ce chemin bundle→APK : ne pas s'y fier, se fier au grep ci-dessus.

## Livrer une nouvelle version

1. Monter `version:` dans `pubspec.yaml` (le `+N` est le `versionCode`, il doit
   croître ; le serveur refuse un `versionCode` non strictement supérieur au plus
   haut publié).
2. `shorebird release android --artifact apk --target-platform android-arm64`
   depuis `apps/mobile` (jeton dans `SHOREBIRD_TOKEN`). Le drapeau arm64 n'est pas
   optionnel (voir ci-dessus). L'APK sort dans
   `build/app/outputs/flutter-apk/app-release.apk`.
3. Vérifier l'empreinte du signataire (ci-dessus).
4. Publier l'APK par l'écran d'administration des mises à jour du panel
   (`POST /api/v1/app-updates/android`), en obligatoire si besoin : l'appli le
   propose ou l'impose au prochain démarrage.
5. Les changements purement Dart qui suivent partent en
   `shorebird patch android` sur cette release ; tout changement natif
   (plugins, gradle, kotlin) exige une nouvelle release, Shorebird le refuse
   sinon.
