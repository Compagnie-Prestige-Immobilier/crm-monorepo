# `crm_api_client` — client Dart généré

**Aucun fichier de `lib/` n'est écrit à la main.** Tout est produit par
`openapi-generator` (7.24.0, générateur `dart-dio`) depuis `apps/api/openapi.json`,
puis par `build_runner` pour les `*.g.dart`.

## Paquet hybride pub + pnpm

Ce dossier contient à la fois un `pubspec.yaml` (nom pub `crm_api_client`) et un
`package.json` (`@crm/api-client-dart`). Le `package.json` n'apporte aucun code
JavaScript : il fait de ce paquet Dart un nœud turbo de plein droit, si bien
qu'un seul `pnpm turbo run generate` couvre les deux langages et que l'arête
`@crm/api#openapi:generate` s'applique aussi au client mobile.

## Régénérer

```bash
pnpm --filter @crm/api-client-dart generate
# ou, depuis la racine, en régénérant d'abord le contrat :
pnpm turbo run generate
```

Le script racine (`tools/dev/generate-dart-client.mjs`) épingle `JAVA_HOME`,
lance le générateur, puis `dart pub get`, `build_runner` et `dart format`.

## Consommation depuis `apps/mobile`

```yaml
dependencies:
  crm_api_client:
    path: ../../packages/api-client-dart
```

## Ce qui est committé

`lib/` en entier, **y compris les `*.g.dart`**. Voir `docs/adr/0002` : cela rend
le contrôle de dérive total et permet d'ouvrir le projet Flutter sans Node ni
JDK installés.

## Fichiers protégés

`.openapi-generator-ignore` empêche le générateur d'écraser `pubspec.yaml`,
`analysis_options.yaml`, `README.md` et `.gitignore` — il en écrit sa propre
version à chaque exécution.
