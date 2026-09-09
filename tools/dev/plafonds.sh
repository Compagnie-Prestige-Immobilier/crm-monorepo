#!/usr/bin/env bash
# Plafonds de docs/v2-refonte/plan.md : 1 500 lignes par fichier Go, 300 par
# fichier du panneau v2, rien de genere suivi par git.
set -u
cd "$(dirname "$0")/../.."
echec=0
for f in $(git ls-files 'apps/go/*.go'); do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 1500 ] || { echo "::error::$f : $n lignes, plafond 1500"; echec=1; }
done
for f in $(git ls-files 'apps/go/web/src/**/*.tsx' 'apps/go/web/src/**/*.ts' | grep -vE '\.gen\.ts$|\.d\.ts$'); do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 300 ] || { echo "::error::$f : $n lignes, plafond 300"; echec=1; }
done
generes=$(git ls-files 'apps/go/db/**' 'apps/go/openapi.json' 'apps/go/web/src/api/schema.d.ts' 'apps/go/web/src/**/*.gen.ts' 'apps/go/web/dist/**' | grep -v '\.gitkeep$')
[ -z "$generes" ] || { echo "::error::Artefacts generes commites :"; echo "$generes"; echec=1; }
exit $echec
