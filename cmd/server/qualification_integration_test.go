//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func qualificationEnvoi(b *banc, methode, chemin string, corps any) (statut int, reponse map[string]any) {
	b.t.Helper()
	var buf bytes.Buffer
	if corps != nil {
		if err := json.NewEncoder(&buf).Encode(corps); err != nil {
			b.t.Fatal(err)
		}
	}
	return qualificationBrut(b, methode, chemin, "application/json", buf.Bytes())
}

func qualificationBrut(b *banc, methode, chemin, typeContenu string, corps []byte) (statut int, reponse map[string]any) {
	b.t.Helper()
	req, err := http.NewRequestWithContext(b.ctx, methode, b.ts.URL+chemin, bytes.NewReader(corps))
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", typeContenu)
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func qualificationConnecte(t *testing.T, role string) *banc {
	t.Helper()
	b := nouveauBanc(t, role)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	return b
}

func qualificationExec(b *banc, requete string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, requete, args...); err != nil {
		b.t.Fatal(err)
	}
}

func qualificationDepartement(b *banc) string {
	b.t.Helper()
	region, departement := uuid.NewString(), uuid.NewString()
	qualificationExec(b, `INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$1,$1,now())`, region)
	qualificationExec(b, `INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$1,$1,$2,now())`,
		departement, region)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "departements" WHERE "id" = $1`, departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, region)
	})
	return departement
}

func qualificationRepresentant(b *banc) string {
	b.t.Helper()
	id := uuid.NewString()
	qualificationExec(b, `INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
	                      VALUES ($1,'Rep Test',$2,$3,$4,now(),now())`,
		id, qualificationNumero(), qualificationDepartement(b), b.userID)
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "id" = $1`, id) })
	return id
}

func qualificationProspect(b *banc) string {
	b.t.Helper()
	id := uuid.NewString()
	qualificationExec(b, `INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","updatedAt")
	                      VALUES ($1,'Diop','Awa',$2,$3,now(),now())`, id, qualificationNumero(), b.userID)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" = $1`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = $1`, id)
	})
	return id
}

// Distinct par fiche : l'index unique partiel sur `phoneE164` refuserait deux
// fiches de test au même numéro.
func qualificationNumero() string {
	return fmt.Sprintf("+2217%08d", time.Now().UnixNano()%100000000)
}

func qualificationCompte(b *banc, requete string, args ...any) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, requete, args...).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func qualificationCorpsTentative(prospectID string, extra map[string]any) map[string]any {
	corps := map[string]any{
		"id":              uuid.Must(uuid.NewV7()).String(),
		"prospectId":      prospectID,
		"outcome":         "UNREACHABLE",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for cle, valeur := range extra {
		corps[cle] = valeur
	}
	return corps
}

func TestQualificationProspectGrandPublicNonAttribueRefuse(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	importeur, prospect, lot := uuid.NewString(), uuid.NewString(), uuid.NewString()
	qualificationExec(b, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
	                      VALUES ($1,$2,$1,'x','Import Leads','ADMIN',now())`, importeur, importeur+"@cpi.sn")
	qualificationExec(b, `INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","projet","clientCreatedAt","updatedAt")
	                      VALUES ($1,'Sarr','Mame',$2,$3,'GRAND_PUBLIC',now(),now())`, prospect, qualificationNumero(), importeur)
	qualificationExec(b, `INSERT INTO "prospect_journeys" ("id","prospectId","projet","updatedAt") VALUES ($1,$2,'GRAND_PUBLIC',now())`,
		uuid.NewString(), prospect)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, importeur)
	})

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospect, nil))
	b.attend(statut, http.StatusForbidden, "prospect Grand Public hors de ses campagnes", body)
	if body["code"] != "PHASE2_NOT_ASSIGNED" {
		t.Fatalf("code : %v", body["code"])
	}

	qualificationExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                      VALUES ($1,'Leads importés','PROSPECTS','GRAND_PUBLIC','{}'::jsonb,1,$2)`, lot, importeur)
	qualificationExec(b, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, prospect, b.userID)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospect, nil))
	b.attend(statut, http.StatusOK, "prospect Grand Public attribué par une campagne", body)
}

func TestQualificationTentativeProspectRejoueeNEcritQuUneLigne(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	corps := qualificationCorpsTentative(prospect, nil)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"]) })

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "première tentative", body)
	if body["status"] != "applied" {
		t.Fatalf("statut de la première tentative : %v", body["status"])
	}
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "rejeu de la même tentative", body)
	if body["status"] != "duplicate" || body["attemptId"] != corps["id"] {
		t.Fatalf("le rejeu doit rendre le verdict existant : %v", body)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, prospect); n != 1 {
		t.Fatalf("%d tentatives écrites pour un seul appel", n)
	}
}

func TestQualificationIssueSansCommentaireRefusee(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(prospect, map[string]any{"outcome": "OTHER"}))
	b.attend(statut, http.StatusBadRequest, "issue OTHER sans commentaire", body)
	if body["code"] != "PHASE2_COMMENT_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, prospect); n != 0 {
		t.Fatalf("une tentative refusée ne doit rien écrire : %d lignes", n)
	}
	corps := qualificationCorpsTentative(prospect, map[string]any{"outcome": "OTHER", "comment": "  injoignable au bureau "})
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"]) })
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "issue OTHER commentée", body)
}

func TestQualificationRappelPlanifieEtListe(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	// Rappel déjà dû : la file du jour porte les retards, et l'assertion ne
	// dépend pas de l'heure à laquelle le test tourne.
	quand := time.Now().UTC().Add(-time.Hour)
	corps := qualificationCorpsTentative(prospect, map[string]any{
		"outcome":         "CALLBACK",
		"clientCreatedAt": quand.Add(-time.Hour).Format(time.RFC3339Nano),
		"callbackAt":      quand.Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "issue à rappeler", body)

	var planifie time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "scheduledAt" FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`,
		prospect).Scan(&planifie); err != nil {
		t.Fatal(err)
	}
	if planifie.Sub(quand).Abs() > time.Second {
		t.Fatalf("rappel planifié à %v, attendu %v", planifie, quand)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/phase2/callbacks", nil)
	b.attend(statut, http.StatusOK, "file des rappels", body)
	items, _ := body["items"].([]any)
	trouve := false
	for _, item := range items {
		ligne, _ := item.(map[string]any)
		retard, _ := ligne["overdue"].(bool)
		if ligne["prospectId"] == prospect && retard {
			trouve = true
		}
	}
	if !trouve {
		t.Fatalf("un rappel en retard doit remonter dans la file du jour : %v", body)
	}
}

func qualificationTotalProspects(b *banc, requete string) (total int, ids []string) {
	b.t.Helper()
	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects?mesFiches=true"+requete, nil)
	b.attend(statut, http.StatusOK, "liste des prospects", body)
	meta, _ := body["meta"].(map[string]any)
	n, _ := meta["total"].(float64)
	items, _ := body["items"].([]any)
	for _, item := range items {
		ligne, _ := item.(map[string]any)
		id, _ := ligne["id"].(string)
		ids = append(ids, id)
	}
	return int(n), ids
}

// Une téléconseillère qui a fini sa campagne ne doit plus voir ses fiches
// appelées dans la file, sauf celles qui attendent un rappel.
func TestQualificationResteAAppelerEcarteLesFichesTraitees(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	traitee, intacte, rappelee := qualificationProspect(b), qualificationProspect(b), qualificationProspect(b)
	appel := qualificationCorpsTentative(traitee, nil)
	rappel := qualificationCorpsTentative(rappelee, map[string]any{
		"outcome":    "CALLBACK",
		"callbackAt": time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, rappelee)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" IN ($1, $2)`, appel["id"], rappel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "fiche traitée", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rappel)
	b.attend(statut, http.StatusOK, "fiche à rappeler", body)

	total, _ := qualificationTotalProspects(b, "")
	if total != 3 {
		t.Fatalf("sans filtre, les trois fiches restent visibles : %d", total)
	}
	total, ids := qualificationTotalProspects(b, "&resteAAppeler=true")
	if total != 2 || slices.Contains(ids, traitee) || !slices.Contains(ids, intacte) || !slices.Contains(ids, rappelee) {
		t.Fatalf("reste à appeler = la fiche jamais appelée et celle à rappeler : total %d, %v", total, ids)
	}
}

// Sans verrou depuis le 10 septembre 2026 : plusieurs fiches restent en main,
// et chaque console reprend la plus récente des siennes.
func TestQualificationPlusieursFichesEnMainUneParConsole(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	premier, second := qualificationRepresentant(b), qualificationRepresentant(b)
	prospect := qualificationProspect(b)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "openedById" = $1`, b.userID) })

	ouvrir := map[string]any{
		"id":             uuid.Must(uuid.NewV7()).String(),
		"representantId": premier,
		"openedAt":       time.Now().UTC().Add(-2 * time.Minute).Format(time.RFC3339Nano),
	}
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", ouvrir)
	b.attend(statut, http.StatusOK, "première ouverture", body)

	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", ouvrir)
	b.attend(statut, http.StatusOK, "rejeu de la même ouverture", body)
	if body["id"] != ouvrir["id"] {
		t.Fatalf("le rejeu doit rendre l'ouverture existante : %v", body)
	}

	autre := map[string]any{
		"id":             uuid.Must(uuid.NewV7()).String(),
		"representantId": second,
		"openedAt":       time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano),
	}
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", autre)
	b.attend(statut, http.StatusOK, "seconde fiche, sans verrou", body)
	surProspect := map[string]any{
		"id":         uuid.Must(uuid.NewV7()).String(),
		"prospectId": prospect,
		"openedAt":   time.Now().UTC().Format(time.RFC3339Nano),
	}
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", surProspect)
	b.attend(statut, http.StatusOK, "fiche prospect en plus", body)
	if n := qualificationCompte(b,
		`SELECT count(*) FROM "ouvertures_fiche" WHERE "openedById" = $1 AND "closedAt" IS NULL`, b.userID); n != 3 {
		t.Fatalf("%d fiches ouvertes, attendu 3", n)
	}

	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/ouvertures/courante?cible=representant", nil)
	b.attend(statut, http.StatusOK, "fiche courante des représentants", body)
	if body["id"] != autre["id"] {
		t.Fatalf("la console des représentants reprend la plus récente des siennes : %v", body)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/ouvertures/courante?cible=prospect", nil)
	b.attend(statut, http.StatusOK, "fiche courante des prospects", body)
	if body["id"] != surProspect["id"] {
		t.Fatalf("la console des prospects reprend la sienne : %v", body)
	}
}

func TestQualificationLaQualificationFermeLOuverture(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	ouvertureID := uuid.Must(uuid.NewV7()).String()
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "id" = $1`, ouvertureID) })

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", map[string]any{
		"id": ouvertureID, "prospectId": prospect,
		"openedAt": time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano),
	})
	b.attend(statut, http.StatusOK, "ouverture", body)
	statut, body = qualificationEnvoi(b, http.MethodPut, "/api/v1/ouvertures/"+ouvertureID+"/brouillon",
		map[string]any{"draft": map[string]any{"resultat": "JOIGNABLE"}})
	b.attend(statut, http.StatusOK, "brouillon", body)
	if body["firstInputAt"] == nil {
		t.Fatalf("la première saisie doit démarrer le chronomètre : %v", body)
	}

	corps := qualificationCorpsTentative(prospect, map[string]any{"ouvertureId": ouvertureID})
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"]) })
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "qualification", body)

	var ferme *time.Time
	var tentative *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "closedAt", "closingAttemptId" FROM "ouvertures_fiche" WHERE "id" = $1`,
		ouvertureID).Scan(&ferme, &tentative); err != nil {
		t.Fatal(err)
	}
	if ferme == nil || tentative == nil || *tentative != corps["id"] {
		t.Fatalf("la qualification doit fermer l'ouverture : closedAt %v, tentative %v", ferme, tentative)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/ouvertures/courante", nil)
	b.attend(statut, http.StatusOK, "fiche courante", body)
	if len(body) != 0 {
		t.Fatalf("plus aucune fiche ne doit être en main : %v", body)
	}
}

func TestQualificationBeatEcritUnCreneauDActivite(t *testing.T) {
	b := qualificationConnecte(t, "CHARGE_CLIENTELE")
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "agent_activity_slots" WHERE "userId" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "agent_heartbeats" WHERE "userId" = $1`, b.userID)
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/presence/beat", nil)
	b.attend(statut, http.StatusNoContent, "battement", body)
	if n := qualificationCompte(b, `SELECT count(*) FROM "agent_activity_slots" WHERE "userId" = $1`, b.userID); n != 1 {
		t.Fatalf("%d créneaux d'activité", n)
	}
	if n := qualificationCompte(b,
		`SELECT count(*) FROM "agent_heartbeats" WHERE "userId" = $1 AND "lastPullAt" IS NOT NULL`, b.userID); n != 1 {
		t.Fatalf("%d battements enregistrés", n)
	}
	var vuAvant time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "lastSeenAt" FROM "agent_activity_slots" WHERE "userId" = $1`, b.userID).Scan(&vuAvant); err != nil {
		t.Fatal(err)
	}
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/presence/beat", nil)
	b.attend(statut, http.StatusNoContent, "battement rapproché", body)
	var vuApres time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "lastSeenAt" FROM "agent_activity_slots" WHERE "userId" = $1`, b.userID).Scan(&vuApres); err != nil {
		t.Fatal(err)
	}
	if !vuApres.Equal(vuAvant) {
		t.Fatalf("un battement sous les dix secondes ne s'écrit pas : %v puis %v", vuAvant, vuApres)
	}
}

func qualificationLotSync(operations ...map[string]any) map[string]any {
	return map[string]any{
		"clientBatchId":  uuid.Must(uuid.NewV7()).String(),
		"payloadVersion": 1,
		"operations":     operations,
	}
}

func qualificationOperationSync(entite, op, entityID string, data map[string]any) map[string]any {
	operation := map[string]any{
		"opId": uuid.Must(uuid.NewV7()).String(), "seq": 0, "entity": entite, "op": op,
		"entityId": entityID, "clientUpdatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	if data != nil {
		operation["data"] = data
	}
	return operation
}

func qualificationResultatsSync(b *banc, lot map[string]any, quoi string) []any {
	b.t.Helper()
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/sync/push", lot)
	b.attend(statut, http.StatusOK, quoi, body)
	if body["batchId"] != lot["clientBatchId"] || body["nextCursor"] != nil {
		b.t.Fatalf("entête du lot : %v", body)
	}
	resultats, _ := body["results"].([]any)
	return resultats
}

func TestSyncPushConsigneLaTentativeEtRendLesRefusDansLeCorps(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	attemptID := uuid.Must(uuid.NewV7()).String()
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, prospect) })
	data := map[string]any{
		"prospectId": prospect, "outcome": "UNREACHABLE",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}

	resultats := qualificationResultatsSync(b, qualificationLotSync(
		qualificationOperationSync("call_attempt", "create", attemptID, data)), "premier lot")
	premier, _ := resultats[0].(map[string]any)
	if premier["status"] != "applied" || premier["entityId"] != attemptID || premier["errorCode"] != nil {
		t.Fatalf("première opération : %v", premier)
	}

	resultats = qualificationResultatsSync(b, qualificationLotSync(
		qualificationOperationSync("call_attempt", "create", attemptID, data)), "lot rejoué")
	if rejeu, _ := resultats[0].(map[string]any); rejeu["status"] != "duplicate" {
		t.Fatalf("le rejeu doit rendre duplicate : %v", resultats[0])
	}

	muet := map[string]any{
		"prospectId": prospect, "outcome": "OTHER",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	resultats = qualificationResultatsSync(b, qualificationLotSync(
		qualificationOperationSync("call_attempt", "create", uuid.Must(uuid.NewV7()).String(), muet),
		qualificationOperationSync("prospect", "update", uuid.Must(uuid.NewV7()).String(), nil),
	), "lot refusé")
	refus, _ := resultats[0].(map[string]any)
	if refus["status"] != "rejected" || refus["errorCode"] != "PHASE2_COMMENT_REQUIRED" || refus["error"] == nil {
		t.Fatalf("refus métier : %v", refus)
	}
	inconnue, _ := resultats[1].(map[string]any)
	if inconnue["status"] != "rejected" || inconnue["errorCode"] != "UNSUPPORTED_OPERATION" {
		t.Fatalf("opération non traitée : %v", inconnue)
	}

	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, prospect); n != 1 {
		t.Fatalf("%d tentatives écrites pour un seul appel consigné", n)
	}
}

func TestQualificationAppelRepresentantRendLaSuggestionRecueillie(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	rep := qualificationRepresentant(b)
	// Le numéro suggéré passe par la normalisation E.164 : il lui faut un
	// préfixe mobile sénégalais réel, ce que `qualificationNumero` ne garantit pas.
	numero := fmt.Sprintf("+22177%07d", time.Now().UnixNano()%10000000)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representant_suggestions" WHERE "sourceRepresentantId" = $1`, rep)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "rep_call_attempts" WHERE "representantId" = $1`, rep)
	})

	corps := map[string]any{
		"id": uuid.Must(uuid.NewV7()).String(), "representantId": rep, "outcome": "REFUSED",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
		"suggestedPhone":  numero, "suggestedName": "Fatou Sow", "suggestedNote": "une collègue",
	}
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/rep-campaigns/attempts", corps)
	b.attend(statut, http.StatusOK, "appel avec numéro suggéré", body)
	suggestion, _ := body["suggestion"].(map[string]any)
	if suggestion == nil {
		t.Fatalf("la piste recueillie doit accompagner le verdict : %v", body)
	}
	if suggestion["suggestedPhoneE164"] != numero || suggestion["suggestedName"] != "Fatou Sow" ||
		suggestion["status"] != "A_APPELER" || suggestion["suggestedById"] != b.userID ||
		suggestion["sourceRepresentantId"] != rep || suggestion["suggestedByName"] != "Test Intégration" {
		t.Fatalf("piste renvoyée : %v", suggestion)
	}
	if code, _ := suggestion["sourceRepresentantShortCode"].(string); len(code) != 6 {
		t.Fatalf("code court du représentant source : %v", suggestion["sourceRepresentantShortCode"])
	}

	sans := map[string]any{
		"id": uuid.Must(uuid.NewV7()).String(), "representantId": rep, "outcome": "UNREACHABLE",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/rep-campaigns/attempts", sans)
	b.attend(statut, http.StatusOK, "appel sans numéro suggéré", body)
	if body["suggestion"] != nil {
		t.Fatalf("sans numéro suggéré, la piste est nulle : %v", body)
	}
}

func annuairePage(b *banc, requete string) (entrees []any, suivant string, encore bool) {
	b.t.Helper()
	statut, body := appelJSON(b, http.MethodGet, "/api/v1/phase2/directory"+requete, nil, nil)
	b.attend(statut, http.StatusOK, "annuaire de phase 2", body)
	entrees, _ = body["entries"].([]any)
	suivant, _ = body["nextCursor"].(string)
	encore, _ = body["hasMore"].(bool)
	if body["serverTime"] == nil {
		b.t.Fatalf("l’annuaire doit dater sa réponse : %v", body)
	}
	return entrees, suivant, encore
}

func exigerEntreeAnnuaire(b *banc, entree map[string]any) {
	b.t.Helper()
	if entree["enrollmentMethod"] != nil || entree["updatedAt"] == nil {
		b.t.Fatalf("entrée d’annuaire : %v", entree)
	}
	if numero, _ := entree["phoneE164"].(string); numero == "" {
		b.t.Fatalf("l’entrée doit porter le numéro : %v", entree)
	}
	exigerChampsJSON(b, entree, map[string]string{"phase2Status": "PENDING", "rev": "1"}, "entrée d’annuaire")
}

func annuaireRelever(b *banc, entrees []any, miennes map[string]bool, etrangere string) {
	b.t.Helper()
	for _, brute := range entrees {
		entree := brute.(map[string]any)
		identifiant := entree["prospectId"].(string)
		if identifiant == etrangere {
			b.t.Fatalf("l’annuaire sort de la portée du téléconseiller : %v", entree)
		}
		if _, mienne := miennes[identifiant]; mienne {
			miennes[identifiant] = true
		}
	}
}

func TestAnnuairePhase2PagineDansLaPorteeDuTeleconseiller(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	miennes := map[string]bool{
		qualificationProspect(b): false, qualificationProspect(b): false, qualificationProspect(b): false,
	}
	autre := autreCompte(b, "COMMERCIAL")
	etrangere := qualificationProspect(autre)

	entrees, curseur, encore := annuairePage(b, "?limit=2")
	if len(entrees) != 2 || !encore || curseur == "" {
		t.Fatalf("première page : %d entrées, hasMore %v, curseur %q", len(entrees), encore, curseur)
	}
	exigerEntreeAnnuaire(b, entrees[0].(map[string]any))

	for range 5 {
		annuaireRelever(b, entrees, miennes, etrangere)
		if !encore {
			break
		}
		entrees, curseur, encore = annuairePage(b, "?limit=2&since="+url.QueryEscape(curseur))
	}
	for identifiant, vue := range miennes {
		if !vue {
			t.Fatalf("la fiche %s manque à l’annuaire", identifiant)
		}
	}

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/phase2/directory?since=hier", nil, nil)
	b.attend(statut, http.StatusBadRequest, "curseur illisible", body)
	if body["code"] != "PHASE2_DIRECTORY_CURSOR_INVALID" {
		t.Fatalf("code : %v", body["code"])
	}
}
