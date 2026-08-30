set -u
PW="${SEED_FIXTURE_PASSWORD:-ChangeMoi123456}"
TOK=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H 'content-type: application/json' -H 'user-agent: CPI-GO-QA/1.0' -d "{\"identifier\":\"fixture.awa\",\"password\":\"$PW\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
uuid () { python3 -c 'import uuid;print(uuid.uuid4())'; }
KEY=$(uuid); R1=$(uuid); R2=$(uuid); O1=$(uuid); O2=$(uuid)
DEP=$(curl -s http://localhost:3001/api/v1/referentiels -H "authorization: Bearer $TOK" | python3 -c 'import sys,json;print(json.load(sys.stdin)["departements"][0]["id"])')
NOW=$(python3 -c 'import datetime;print(datetime.datetime.utcnow().isoformat(timespec="milliseconds")+"Z")')
op () { echo "{\"opId\":\"$1\",\"seq\":$2,\"entity\":\"representant\",\"op\":\"create\",\"entityId\":\"$3\",\"clientUpdatedAt\":\"$NOW\",\"data\":{\"fullName\":\"QA $2\",\"phone\":\"$4\",\"departementId\":\"$DEP\",\"clientCreatedAt\":\"$NOW\"}}"; }
BODY1="{\"clientBatchId\":\"$KEY\",\"payloadVersion\":5,\"operations\":[$(op $O1 1 $R1 +221769900011),$(op $O2 2 $R2 +221769900012)]}"
BODY2="{\"clientBatchId\":\"$KEY\",\"payloadVersion\":5,\"operations\":[$(op $O2 2 $R2 +221769900012)]}"
send () { curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/sync/push -H "authorization: Bearer $TOK" -H 'content-type: application/json' -H "idempotency-key: $KEY" -d "$1" | head -c 500; echo; }
echo "== envoi 1 : DEUX operations, cle $KEY"; send "$BODY1"
echo "== envoi 2 : MEME cle, UNE seule operation (renvoi partiel)"; send "$BODY2"
echo "== envoi 3 : MEME cle, MEME corps (rejeu exact)"; send "$BODY1"
