set -u
PW="${SEED_FIXTURE_PASSWORD:-ChangeMoi123456}"
tok () { curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'content-type: application/json' -H 'user-agent: CPI-GO-QA/1.0' -d "{\"identifier\":\"$1\",\"password\":\"$PW\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])'; }
AWA=$(tok fixture.awa); FATOU=$(tok fixture.fatou)
pull () { curl -s "http://localhost:3001/api/v1/sync/pull?limit=200${2:+&since=$2}" -H "authorization: Bearer $1" -H 'x-cpi-payload-version: 5'; }
resume () { python3 -c "
import sys,json
d=json.load(sys.stdin)
print('prospects=%d representants=%d suppressions=%d hasMore=%s' % (len(d['changes']['prospects']),len(d['changes']['representants']),len(d['deletions']),d['hasMore']))
print('nextCursor=%s' % d['nextCursor'])
"; }
echo "== awa, sans curseur (premiere page)"
C=$(pull "$AWA" "" | python3 -c 'import sys,json;print(json.load(sys.stdin)["nextCursor"])')
for i in 1 2 3 4 5 6 7 8 9 10; do C=$(pull "$AWA" "$C" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["nextCursor"] if d["hasMore"] else "STOP:"+d["nextCursor"])'); case "$C" in STOP:*) C=${C#STOP:}; break;; esac; done
echo "curseur d'awa apres rattrapage complet : ${C}"
echo
echo "== fatou, sans curseur (appareil vierge)"
pull "$FATOU" "" | resume
echo
echo "== fatou, avec le curseur laisse par awa sur le MEME telephone"
pull "$FATOU" "$C" | resume
