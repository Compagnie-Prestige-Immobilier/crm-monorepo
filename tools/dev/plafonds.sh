#!/usr/bin/env bash
# Plafonds de docs/v2-refonte/plan.md : 1 500 lignes par fichier Go, rien de
# genere suivi par git. Le panneau est le code v1 repris tel quel le 10 septembre
# 2026 sur ordre du proprietaire (plus gros fichier : 1 728 lignes) : son plafond
# suit ce code, il ne le coupe pas.
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
  [ "$n" -le 1800 ] || { echo "::error::$f : $n lignes, plafond 1800"; echec=1; }
done
generes=$(git ls-files 'db/**' 'openapi.json' 'web/src/api/schema.d.ts''web/src/**/*.gen.ts' 'web/dist/**' | grep -v '\.gitkeep$')
[ -z "$generes" ] || { echo "::error::Artefacts generes commites :"; echo "$generes"; echec=1; }
exit $echec
