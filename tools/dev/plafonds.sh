#!/usr/bin/env bash
# Plafonds de docs/v2-refonte/plan.md : 1 500 lignes par fichier Go, 300 par
# fichier du panneau, rien de genere suivi par git.
set -u
cd "$(dirname "$0")/../.."
echec=0
for f in $(git ls-files '*.go'); do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 1500 ] || { echo "::error::$f : $n lignes, plafond 1500"; echec=1; }
done
for f in $(git ls-files 'web/src/**/*.tsx' 'web/src/**/*.ts' | grep -vE '\.gen\.ts$|\.d\.ts$'); do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 300 ] || { echo "::error::$f : $n lignes, plafond 300"; echec=1; }
done
generes=$(git ls-files 'db/**' 'openapi.json' 'web/src/api/schema.d.ts' 'web/src/**/*.gen.ts' 'web/dist/**' | grep -v '\.gitkeep$')
[ -z "$generes" ] || { echo "::error::Artefacts generes commites :"; echo "$generes"; echec=1; }
exit $echec
