//go:build integration

package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strconv"
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
	u := uuid.New()
	return fmt.Sprintf("+2217%08d", binary.BigEndian.Uint32(u[:4])%100000000)
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
		"reasonCode":      "PAS_DE_REPONSE",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for cle, valeur := range extra {
		corps[cle] = valeur
	}
	return corps
}

func qualificationStatutID(b *banc, code string) string {
	b.t.Helper()
	var id string
	if err := b.pool.QueryRow(b.ctx, `SELECT "id" FROM "statuts_qualification" WHERE "code" = $1`, code).Scan(&id); err != nil {
		b.t.Fatal(err)
	}
	return id
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

// La fiche distribuée à un autre échappe à son créateur ; l'encadrement l'ouvre
// mais ne consigne pas dessus : deux personnes appelleraient la même.
func TestQualificationFicheAttribueeAUnAutreEchappeAuCreateurEtALEncadrement(t *testing.T) {
	createur := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	autre, lot := uuid.NewString(), uuid.NewString()
	prospect := qualificationProspect(createur)
	qualificationExec(createur, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
	                             VALUES ($1,$2,$1,'x','Autre Téléconseiller','COMMERCIAL',now())`, autre, autre+"@cpi.sn")
	qualificationExec(createur, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                             VALUES ($1,'Prospects CHUES','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, autre)
	qualificationExec(createur, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, prospect, autre)
	t.Cleanup(func() {
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "ouvertures_fiche" WHERE "prospectId" = $1`, prospect)
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, prospect)
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "users" WHERE "id" = $1`, autre)
	})

	for nom, b := range map[string]*banc{"le créateur": createur, "l'encadrement": superviseur} {
		ouvrir := map[string]any{
			"id": uuid.Must(uuid.NewV7()).String(), "prospectId": prospect,
			"openedAt": time.Now().UTC().Format(time.RFC3339Nano),
		}
		attendu := http.StatusNotFound
		if b == superviseur {
			attendu = http.StatusOK
		}
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/ouvertures", ouvrir)
		b.attend(statut, attendu, nom+" ouvre une fiche attribuée à un autre : le créateur non, l'encadrement oui", body)
		statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospect, nil))
		b.attend(statut, http.StatusForbidden, nom+" ne consigne pas sur une fiche attribuée à un autre", body)
		if body["code"] != "PHASE2_NOT_ASSIGNED" {
			t.Fatalf("%s : code %v", nom, body["code"])
		}
	}

	qualificationExec(createur, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
	statut, body := qualificationEnvoi(createur, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospect, nil))
	createur.attend(statut, http.StatusOK, "rendue par la campagne, la fiche revient à son créateur", body)
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

func TestQualificationMotifInconnuRefuse(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(prospect, map[string]any{"reasonCode": "MOTIF_INEXISTANT"}))
	b.attend(statut, http.StatusBadRequest, "motif inconnu", body)
	if body["code"] != "PHASE2_REASON_UNKNOWN" {
		t.Fatalf("code : %v", body["code"])
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, prospect); n != 0 {
		t.Fatalf("une tentative refusée ne doit rien écrire : %d lignes", n)
	}
	corps := qualificationCorpsTentative(prospect, map[string]any{"reasonCode": "DEMANDE_INFORMATION", "comment": "  rappelle au bureau "})
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"]) })
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "motif du référentiel", body)
}

func TestQualificationRappelPlanifieEtListe(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	// Rappel déjà dû : la file du jour porte les retards, et l'assertion ne
	// dépend pas de l'heure à laquelle le test tourne.
	quand := time.Now().UTC().Add(-time.Hour)
	corps := qualificationCorpsTentative(prospect, map[string]any{
		"reasonCode":      "CALLBACK",
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

func qualificationStatutPhase2(b *banc, prospectID string) string {
	b.t.Helper()
	var statut string
	if err := b.pool.QueryRow(b.ctx, `SELECT "phase2Status"::text FROM "prospects" WHERE "id" = $1`, prospectID).Scan(&statut); err != nil {
		b.t.Fatal(err)
	}
	return statut
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
// appelées dans la file : celle qui attend un rappel se tient depuis « Rappels ».
func TestQualificationResteAAppelerEcarteLesFichesTraitees(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	traitee, intacte, rappelee, injoignable := qualificationProspect(b), qualificationProspect(b), qualificationProspect(b), qualificationProspect(b)
	appel := qualificationCorpsTentative(traitee, nil)
	rappel := qualificationCorpsTentative(rappelee, map[string]any{
		"reasonCode": "CALLBACK",
		"callbackAt": time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano),
	})
	nonJoint := qualificationCorpsTentative(injoignable, nil)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, rappelee)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" IN ($1, $2, $3)`, appel["id"], rappel["id"], nonJoint["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "fiche traitée", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rappel)
	b.attend(statut, http.StatusOK, "fiche à rappeler", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", nonJoint)
	b.attend(statut, http.StatusOK, "fiche injoignable", body)

	total, _ := qualificationTotalProspects(b, "")
	if total != 4 {
		t.Fatalf("sans filtre, les quatre fiches restent visibles : %d", total)
	}
	total, ids := qualificationTotalProspects(b, "&resteAAppeler=true")
	if total != 1 || !slices.Contains(ids, intacte) || slices.Contains(ids, traitee) || slices.Contains(ids, rappelee) {
		t.Fatalf("reste à appeler = la seule fiche jamais appelée : total %d, %v", total, ids)
	}
}

// Une fiche classée que l'on requalifie revient en cours, et le changement
// laisse une trace lisible sur la fiche.
func TestQualificationRequalificationRouvreLeStatutEtLaisseUneTrace(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	refus := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "PAS_INTERESSE"})
	reprise := qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "CALLBACK", "comment": "Rappelle demain",
		"callbackAt": time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" IN ($1, $2)`, refus["id"], reprise["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", refus)
	b.attend(statut, http.StatusOK, "refus consigné", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "REFUSED" {
		t.Fatalf("un refus classe la fiche : %s", lu)
	}

	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", reprise)
	b.attend(statut, http.StatusOK, "requalification consignée", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "PENDING" {
		t.Fatalf("requalifiée, la fiche revient en cours : %s", lu)
	}

	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/"+fiche+"/requalifications", nil)
	b.attend(statut, http.StatusOK, "historique des requalifications", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("une requalification, une ligne d'historique : %v", items)
	}
	ligne, _ := items[0].(map[string]any)
	if ligne["de"] != "REFUSED" || ligne["vers"] != "PENDING" {
		t.Fatalf("l'historique dit d'où vient la fiche et où elle va : %v", ligne)
	}
}

// Réaffecter une fiche déjà appelée la remet dans la file de celui qui la
// reçoit : la borne suit la date d'affectation, pas la création de la campagne.
func TestQualificationReaffectationRemetLaFicheDansLaFile(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	lot := uuid.Must(uuid.NewV7()).String()
	qualificationExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById","createdAt")
	                      VALUES ($1,'Campagne reaffectation','PROSPECTS','GRAND_PUBLIC','{}'::jsonb,1,$2,now() - interval '2 hours')`, lot, b.userID)
	qualificationExec(b, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day")
	                      VALUES ($1,$2,1,$3,1)`, lot, fiche, b.userID)
	// Pas d'injoignable ici : depuis le 16 septembre 2026 la file exclut toute
	// fiche dont le dernier appel n'a pas abouti, ce que ce parcours ne teste pas.
	appel := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "TERRAIN"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_reaffectations" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "fiche appelée", body)

	_, ids := qualificationTotalProspects(b, "&resteAAppeler=true")
	if slices.Contains(ids, fiche) {
		t.Fatalf("une fiche appelée sort de la file : %v", ids)
	}

	qualificationExec(b, `INSERT INTO "lot_export_reaffectations" ("id","lotId","toAssigneeId","fiches","performedById","createdAt","positions")
	                      VALUES ($1,$2,$3,1,$3,now(),'{1}')`, uuid.Must(uuid.NewV7()).String(), lot, b.userID)

	_, ids = qualificationTotalProspects(b, "&resteAAppeler=true")
	if !slices.Contains(ids, fiche) {
		t.Fatalf("réaffectée, la fiche revient dans la file : %v", ids)
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
		"prospectId": prospect, "reasonCode": "PAS_DE_REPONSE",
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
		"prospectId": prospect, "reasonCode": "MOTIF_INEXISTANT",
		"clientCreatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	resultats = qualificationResultatsSync(b, qualificationLotSync(
		qualificationOperationSync("call_attempt", "create", uuid.Must(uuid.NewV7()).String(), muet),
		qualificationOperationSync("prospect", "update", uuid.Must(uuid.NewV7()).String(), nil),
	), "lot refusé")
	refus, _ := resultats[0].(map[string]any)
	if refus["status"] != "rejected" || refus["errorCode"] != "PHASE2_REASON_UNKNOWN" || refus["error"] == nil {
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
		"id": uuid.Must(uuid.NewV7()).String(), "representantId": rep, "statutQualificationId": qualificationStatutID(b, "REFUSE"),
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
		"id": uuid.Must(uuid.NewV7()).String(), "representantId": rep, "statutQualificationId": qualificationStatutID(b, "PAS_DE_REPONSE"),
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

// La codification des leads (docs/decisions/codification-leads.md) : la précision
// consigne l'appel sans commentaire, le rendez-vous devient un rappel promis, la
// méthode du formulaire vaut adhésion quel que soit le statut, et « À supprimer »
// sort la fiche du reste à appeler sans la détruire.
func TestCodificationLeads(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	revenu := uuid.NewString()
	qualificationExec(b, `INSERT INTO "income_bands" ("id","code","label","updatedAt") VALUES ($1,$2,$2,now())`, revenu, "REVENU_"+revenu[:8])
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "income_bands" WHERE "id" = $1`, revenu) })
	dansUneHeure := time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano)

	cas := []struct {
		motif    string
		extra    map[string]any
		phase2   string
		perdu    bool
		rappels  int
		prenom   string
		aAppeler bool
	}{
		{motif: "TERRAIN", extra: map[string]any{"prenom": "Aminata"}, phase2: "INTERESTED", prenom: "Aminata"},
		{motif: "RV_CPI", extra: map[string]any{"callbackAt": dansUneHeure}, phase2: "APPOINTMENT", rappels: 1, prenom: "Awa"},
		{
			motif: "HESITANT", extra: map[string]any{"method": "APPOINTMENT", "rendezVousAt": dansUneHeure, "incomeBandId": revenu, "dureeEtablissementMois": 12},
			phase2: "METHOD_OBTAINED", prenom: "Awa",
		},
		{motif: "A_SUPPRIMER", phase2: "REFUSED", perdu: true, prenom: "Awa"},
	}
	for _, c := range cas {
		prospect := qualificationProspect(b)
		corps := qualificationCorpsTentative(prospect, map[string]any{"reasonCode": c.motif})
		maps.Copy(corps, c.extra)
		t.Cleanup(func() {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, prospect)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
		})
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
		b.attend(statut, http.StatusOK, "appel "+c.motif, body)

		var phase2, statutFiche, prenom string
		if err := b.pool.QueryRow(b.ctx,
			`SELECT p."phase2Status"::text, p."statut"::text, p."prenom"
			   FROM "call_attempts" a JOIN "prospects" p ON p."id" = a."prospectId" WHERE a."id" = $1`,
			corps["id"]).Scan(&phase2, &statutFiche, &prenom); err != nil {
			t.Fatal(err)
		}
		if phase2 != c.phase2 || (statutFiche == "PERDU") != c.perdu || prenom != c.prenom {
			t.Fatalf("%s : phase 2 %s, statut %s, prénom %s ; attendu %+v", c.motif, phase2, statutFiche, prenom, c)
		}
		rappels := qualificationCompte(b, `SELECT count(*) FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, prospect)
		if rappels != c.rappels {
			t.Fatalf("%s : %d rappel(s) promis, attendu %d", c.motif, rappels, c.rappels)
		}
		_, ids := qualificationTotalProspects(b, "&resteAAppeler=true")
		if slices.Contains(ids, prospect) != c.aAppeler {
			t.Fatalf("%s : dans le reste à appeler %v, attendu %v", c.motif, !c.aAppeler, c.aAppeler)
		}
	}

	corps := qualificationCorpsTentative(qualificationProspect(b), map[string]any{"method": "WHATSAPP"})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusBadRequest, "méthode sur un appel non joint", body)
	if body["code"] != "PHASE2_METHOD_NOT_ALLOWED" {
		t.Fatalf("code : %v", body["code"])
	}
}

// Le libellé du statut qui a promis le rappel, nul quand la file ignore la fiche.
func qualificationRappelDansFile(b *banc, portee, prospectID string) *string {
	b.t.Helper()
	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/phase2/callbacks?scope="+portee, nil)
	b.attend(statut, http.StatusOK, "file des rappels", body)
	items, _ := body["items"].([]any)
	for _, item := range items {
		ligne, _ := item.(map[string]any)
		if ligne["prospectId"] != prospectID {
			continue
		}
		label, _ := ligne["reasonLabel"].(string)
		return &label
	}
	return nil
}

// « RV téléphonique » promet un rappel : la fiche quitte « Reste à appeler »
// pour la file des rappels, que « Tous » montre même promise pour dans un mois.
func TestQualificationRappelLointainSeVoitDansTous(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	quand := time.Now().UTC().AddDate(0, 0, 30)
	corps := qualificationCorpsTentative(prospect, map[string]any{
		"reasonCode": "RDV_TELEPHONIQUE",
		"callbackAt": quand.Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "RV téléphonique consigné", body)

	if motif := qualificationRappelDansFile(b, "week", prospect); motif != nil {
		t.Fatalf("un rappel promis dans un mois ne tient pas dans la semaine : %q", *motif)
	}
	motif := qualificationRappelDansFile(b, "all", prospect)
	if motif == nil {
		t.Fatal("« Tous » montre le rappel promis, quelle que soit sa date")
	}
	if *motif != "RV téléphonique" {
		t.Fatalf("la file nomme la qualification qui a promis le rappel : %q", *motif)
	}
	total, ids := qualificationTotalProspects(b, "&resteAAppeler=true")
	if total != 0 || slices.Contains(ids, prospect) {
		t.Fatalf("la fiche promise quitte « Reste à appeler » : total %d, %v", total, ids)
	}
}

// Arbitrage du 17 septembre 2026 : tout statut posé ferme la fiche sur son
// statut ; « À rappeler » seul la laisse ouverte, un rendez-vous garde son rappel.
func TestQualificationUnStatutPoseFermeLaFiche(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	dans := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339Nano)
	cas := []struct {
		motif, phase2 string
		rappel        bool
	}{
		{"PAS_DE_REPONSE", "UNREACHABLE", false},
		{"HESITANT", "HESITANT", false},
		{"VILLA", "INTERESTED", false},
		{"DEMANDE_INFORMATION", "REACHED", false},
		{"RV_CPI", "APPOINTMENT", true},
		{"CALLBACK", "PENDING", true},
	}
	for _, c := range cas {
		fiche := qualificationProspect(b)
		extra := map[string]any{"reasonCode": c.motif}
		if c.rappel {
			extra["callbackAt"] = dans
		}
		corps := qualificationCorpsTentative(fiche, extra)
		t.Cleanup(func() {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
		})
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
		b.attend(statut, http.StatusOK, c.motif, body)
		if lu := qualificationStatutPhase2(b, fiche); lu != c.phase2 {
			t.Fatalf("%s : phase 2 %s, attendu %s", c.motif, lu, c.phase2)
		}
		rappels := qualificationCompte(b, `SELECT count(*)::int FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, fiche)
		if (rappels == 1) != c.rappel {
			t.Fatalf("%s : %d rappel(s) en attente", c.motif, rappels)
		}
	}
}

// « Requalifier → À traiter » par l'encadrement remet dans la file une fiche
// que le téléconseiller avait déjà appelée.
func TestQualificationRemiseATraiterRameneLaFicheDansLaFile(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(b)
	appel := qualificationCorpsTentative(fiche, nil)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "NRP consigné", body)
	if _, ids := qualificationTotalProspects(b, "&resteAAppeler=true"); slices.Contains(ids, fiche) {
		t.Fatalf("fermée, la fiche sort de la file : %v", ids)
	}

	statut, body = qualificationEnvoi(superviseur, http.MethodPost, "/api/v1/prospects/"+fiche+"/requalifier",
		map[string]any{"projet": "CHUES", "statut": "NOUVEAU"})
	superviseur.attend(statut, http.StatusOK, "remise à traiter", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "PENDING" {
		t.Fatalf("remise à traiter, la fiche rouvre : %s", lu)
	}
	if _, ids := qualificationTotalProspects(b, "&resteAAppeler=true"); !slices.Contains(ids, fiche) {
		t.Fatalf("remise à traiter, la fiche revient dans la file : %v", ids)
	}
}

// Le dernier à avoir appelé requalifie depuis « Mes contacts », même quand la
// campagne a confié la fiche à un collègue ; un tiers reste refusé.
func TestQualificationLeDernierAppelantRequalifieSaFiche(t *testing.T) {
	appelant := qualificationConnecte(t, "COMMERCIAL")
	tiers := qualificationConnecte(t, "COMMERCIAL")
	createur := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(createur)
	lot := uuid.NewString()
	qualificationExec(createur, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                             VALUES ($1,'Campagne contacts','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, createur.userID)
	qualificationExec(createur, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, fiche, appelant.userID)
	premier := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "HESITANT"})
	reprise := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "INTERESSE"})
	t.Cleanup(func() {
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
		_, _ = createur.pool.Exec(createur.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})
	statut, body := qualificationEnvoi(appelant, http.MethodPost, "/api/v1/phase2/call-attempts", premier)
	appelant.attend(statut, http.StatusOK, "premier appel", body)
	qualificationExec(createur, `UPDATE "lot_export_items" SET "assigneeId" = $1 WHERE "lotId" = $2`, createur.userID, lot)

	statut, body = qualificationEnvoi(appelant, http.MethodPost, "/api/v1/phase2/call-attempts", reprise)
	appelant.attend(statut, http.StatusOK, "le dernier appelant requalifie", body)
	if lu := qualificationStatutPhase2(appelant, fiche); lu != "INTERESTED" {
		t.Fatalf("requalifiée en Intéressé : %s", lu)
	}
	statut, body = qualificationEnvoi(tiers, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, nil))
	tiers.attend(statut, http.StatusForbidden, "un tiers ne requalifie pas", body)
}

// Un intéressé qui donne sa méthode passe en méthode obtenue et reste dans
// l'onglet Intéressés ; un hésitant qui la donne n'y entre pas.
func TestQualificationIntereseAvecMethodeResteIntereseDansLaRubrique(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	interesse, hesitant := qualificationProspect(b), qualificationProspect(b)
	revenu := uuid.NewString()
	qualificationExec(b, `INSERT INTO "income_bands" ("id","code","label","updatedAt") VALUES ($1,$2,$2,now())`, revenu, "REVENU_"+revenu[:8])
	adhesion := map[string]any{"method": "WHATSAPP", "incomeBandId": revenu, "dureeEtablissementMois": 12}
	appels := []map[string]any{
		qualificationCorpsTentative(interesse, maps.Clone(adhesion)),
		qualificationCorpsTentative(hesitant, maps.Clone(adhesion)),
	}
	appels[0]["reasonCode"], appels[1]["reasonCode"] = "VILLA", "HESITANT"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2)`, interesse, hesitant)
	})
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "income_bands" WHERE "id" = $1`, revenu) })
	for _, appel := range appels {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "méthode obtenue", body)
	}
	if lu := qualificationStatutPhase2(b, interesse); lu != "METHOD_OBTAINED" {
		t.Fatalf("la méthode l'emporte sur l'état : %s", lu)
	}
	injoignable := qualificationProspect(b)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, injoignable) })
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(injoignable, nil))
	b.attend(statut, http.StatusOK, "appel sans méthode", body)
	obtenuPar := `SELECT count(*) FROM "prospects" WHERE "id" = $1 AND "enrollmentCapturedById" IS NOT NULL`
	if qualificationCompte(b, obtenuPar, interesse) != 1 || qualificationCompte(b, obtenuPar, injoignable) != 0 {
		t.Fatal("« Méthode obtenue par » ne doit nommer que l'agent qui a obtenu une méthode")
	}
	_, ids := qualificationTotalProspects(b, "&phase2Status=INTERESTED")
	if !slices.Contains(ids, interesse) || slices.Contains(ids, hesitant) {
		t.Fatalf("onglet Intéressés : %v", ids)
	}
}

// L'appel promis a eu lieu : sans nouvelle échéance, la fiche quitte
// « Rappels promis » au lieu d'y rester jusqu'en retard.
func TestRappelConsommeParTentativeSansNouvelleEcheance(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	prospect := qualificationProspect(b)
	rappelPromis(b, prospect, b.userID)
	corps := qualificationCorpsTentative(prospect, map[string]any{"reasonCode": "TERRAIN"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "appel TERRAIN consigné", body)
	if restants := qualificationCompte(b, `SELECT count(*) FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, prospect); restants != 0 {
		t.Fatalf("le rappel tenu doit quitter la file : %d rappel(s) encore promis", restants)
	}
	if motif := qualificationRappelDansFile(b, "all", prospect); motif != nil {
		t.Fatalf("la fiche traitée ne se lit plus dans « Rappels promis » : %q", *motif)
	}
}

// L'enrôlement est un fait acquis : la fiche prend le statut du dernier appel,
// et garde la méthode déjà obtenue tant qu'un appel n'en apporte pas une autre.
func TestQualificationMethodeAcquiseSurvitAuStatutSuivant(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	revenu := uuid.NewString()
	qualificationExec(b, `INSERT INTO "income_bands" ("id","code","label","updatedAt") VALUES ($1,$2,$2,now())`, revenu, "REVENU_"+revenu[:8])
	adhesion := qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "INTERESSE", "method": "WHATSAPP",
		"incomeBandId": revenu, "dureeEtablissementMois": 12,
	})
	suivant := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "DEMANDE_INFORMATION"})
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "income_bands" WHERE "id" = $1`, revenu) })
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche) })
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", adhesion)
	b.attend(statut, http.StatusOK, "adhésion consignée", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", suivant)
	b.attend(statut, http.StatusOK, "appel suivant sans méthode", body)

	var phase2 string
	var methode *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "phase2Status"::text, "enrollmentMethod"::text FROM "prospects" WHERE "id" = $1`, fiche).Scan(&phase2, &methode); err != nil {
		t.Fatal(err)
	}
	if phase2 != "REACHED" {
		t.Fatalf("la fiche prend le statut du dernier appel : %s", phase2)
	}
	if methode == nil || *methode != "WHATSAPP" {
		t.Fatalf("la méthode acquise reste : %v", methode)
	}
	if lu := qualificationCompte(b, `SELECT count(*)::int FROM "prospect_journeys" WHERE "prospectId" = $1 AND "enrollmentMethod" = 'WHATSAPP'`, fiche); lu != 1 {
		t.Fatalf("le parcours garde la méthode : %d", lu)
	}
}

func ouvertureFiche(prospectID string) map[string]any {
	return map[string]any{
		"id": uuid.Must(uuid.NewV7()).String(), "prospectId": prospectID,
		"openedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
}

// Un rappel promis par le téléconseiller, encore à venir.
func rappelPromis(b *banc, prospectID, teleconseillerID string) {
	b.t.Helper()
	tentative, rappel := uuid.NewString(), uuid.NewString()
	adminExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		SELECT $1,$2,$3,"id",now() FROM "call_outcome_reasons" WHERE "code" = 'CALLBACK'`, tentative, prospectID, teleconseillerID)
	adminExec(b, `INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","sourceAttemptId","updatedAt")
		VALUES ($1,$2,$3,now() + interval '1 day',$4,now())`, rappel, prospectID, teleconseillerID, tentative)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rappel)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "id" = $1`, rappel)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, tentative)
	})
}

// L'encadrement pose le motif sans appel : la fiche suit l'effet du motif,
// aucun appel n'est ajouté, et le rappel promis revient au dernier appelant.
func TestRequalificationParMotifSansAppel(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(b)
	appel := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "HESITANT"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "hésitant consigné", body)

	chemin := "/api/v1/prospects/" + fiche + "/statut-qualification"
	interesse := map[string]any{"reasonCode": "INTERESSE"}
	statut, body = qualificationEnvoi(b, http.MethodPost, chemin, interesse)
	b.attend(statut, http.StatusForbidden, "requalification hors encadrement", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, interesse)
	superviseur.attend(statut, http.StatusOK, "intéressé posé sans appel", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "INTERESTED" {
		t.Fatalf("la fiche suit le motif posé : %s", lu)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, fiche); n != 1 {
		t.Fatalf("aucun appel ne s'ajoute : %d", n)
	}
	if _, ids := qualificationTotalProspects(b, "&phase2Status=INTERESTED"); !slices.Contains(ids, fiche) {
		t.Fatalf("onglet Intéressés : %v", ids)
	}

	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"reasonCode": "CALLBACK"})
	superviseur.attend(statut, http.StatusBadRequest, "un rappel exige sa date", body)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"reasonCode": "CALLBACK", "callbackAt": quand})
	superviseur.attend(statut, http.StatusOK, "rappel posé", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "PENDING" {
		t.Fatalf("à rappeler rouvre la fiche : %s", lu)
	}
	var assigne string
	if err := b.pool.QueryRow(b.ctx, `SELECT "assignedToId" FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, fiche).Scan(&assigne); err != nil {
		t.Fatal(err)
	}
	if assigne != b.userID {
		t.Fatalf("le rappel revient au dernier appelant : %s", assigne)
	}
}

func TestRequalificationRepresentantParStatut(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	rep := qualificationRepresentant(b)
	chemin := "/api/v1/representants/" + rep + "/statut-qualification"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rep)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representant_relation_changes" WHERE "representantId" = $1`, rep)
	})
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"statutQualificationId": qualificationStatutID(b, "A_RAPPELER")})
	superviseur.attend(statut, http.StatusBadRequest, "à rappeler sans date", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"statutQualificationId": qualificationStatutID(b, "REFUSE")})
	superviseur.attend(statut, http.StatusOK, "refusé posé sans appel", body)
	var code string
	if err := b.pool.QueryRow(b.ctx, `SELECT sq."code" FROM "representants" r JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId" WHERE r."id" = $1`, rep).Scan(&code); err != nil {
		t.Fatal(err)
	}
	if code != "REFUSE" {
		t.Fatalf("la fiche porte le statut posé : %s", code)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "rep_call_attempts" WHERE "representantId" = $1`, rep); n != 0 {
		t.Fatalf("aucun appel ne s'ajoute : %d", n)
	}
}

// Un rendez-vous téléphonique n'est pas un rendez-vous : l'onglet l'écarte.
func TestRubriqueRendezVousEcarteLeTelephonique(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	physique, telephonique := qualificationProspect(b), qualificationProspect(b)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	appels := []map[string]any{
		qualificationCorpsTentative(physique, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}),
		qualificationCorpsTentative(telephonique, map[string]any{"reasonCode": "RDV_TELEPHONIQUE", "callbackAt": quand}),
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" IN ($1, $2)`, physique, telephonique)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2)`, physique, telephonique)
	})
	for _, appel := range appels {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "rendez-vous consigné", body)
	}
	_, ids := qualificationTotalProspects(b, "&phase2Status=APPOINTMENT&sansMotif=RDV_TELEPHONIQUE")
	if !slices.Contains(ids, physique) || slices.Contains(ids, telephonique) {
		t.Fatalf("onglet Rendez-vous : %v", ids)
	}
}

// « Affecter à » change le titulaire ; la campagne en cours et le rappel promis
// suivent, l'appel passé reste à son auteur.
func TestAffectationDUneFicheSuitCampagneEtRappel(t *testing.T) {
	avant := qualificationConnecte(t, "COMMERCIAL")
	apres := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(avant)
	lot := uuid.NewString()
	qualificationExec(avant, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                          VALUES ($1,'Campagne affectation','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, superviseur.userID)
	qualificationExec(avant, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, fiche, avant.userID)
	rappelPromis(avant, fiche, avant.userID)
	t.Cleanup(func() {
		_, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "audit_logs" WHERE "entityId" IN ($1, $2)`, fiche, lot)
		_, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	chemin := "/api/v1/prospects/" + fiche + "/affecter"
	corps := map[string]any{"teleconseillerId": apres.userID}
	statut, body := qualificationEnvoi(avant, http.MethodPost, chemin, corps)
	avant.attend(statut, http.StatusForbidden, "affectation hors encadrement", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, corps)
	superviseur.attend(statut, http.StatusOK, "fiche affectée", body)
	if n, _ := body["campagnes"].(float64); n != 1 {
		t.Fatalf("la campagne en cours suit : %v", body["campagnes"])
	}
	var titulaire, attributaire, rappel string
	if err := avant.pool.QueryRow(avant.ctx, `SELECT p."createdById", i."assigneeId", c."assignedToId"
		FROM "prospects" p
		JOIN "lot_export_items" i ON i."prospectId" = p."id" AND i."lotId" = $2
		JOIN "scheduled_callbacks" c ON c."prospectId" = p."id" AND c."status" = 'PENDING'
		WHERE p."id" = $1`, fiche, lot).Scan(&titulaire, &attributaire, &rappel); err != nil {
		t.Fatal(err)
	}
	if titulaire != apres.userID || attributaire != apres.userID || rappel != apres.userID {
		t.Fatalf("titulaire, campagne et rappel suivent : %s %s %s", titulaire, attributaire, rappel)
	}
	if n := qualificationCompte(avant, `SELECT count(*) FROM "lot_export_reaffectations" WHERE "lotId" = $1 AND "toAssigneeId" = $2`, lot, apres.userID); n != 1 {
		t.Fatalf("la réaffectation de campagne est tracée : %d", n)
	}
	if n := qualificationCompte(avant, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1 AND "performedById" = $2`, fiche, avant.userID); n != 1 {
		t.Fatalf("l'appel passé reste à son auteur : %d", n)
	}
}

func TestAffectationDUnRepresentant(t *testing.T) {
	avant := qualificationConnecte(t, "COMMERCIAL")
	apres := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	rep := qualificationRepresentant(avant)
	t.Cleanup(func() { _, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rep) })
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, "/api/v1/representants/"+rep+"/affecter",
		map[string]any{"teleconseillerId": apres.userID})
	superviseur.attend(statut, http.StatusOK, "représentant affecté", body)
	var titulaire string
	if err := avant.pool.QueryRow(avant.ctx, `SELECT "createdById" FROM "representants" WHERE "id" = $1`, rep).Scan(&titulaire); err != nil {
		t.Fatal(err)
	}
	if titulaire != apres.userID {
		t.Fatalf("le titulaire change : %s", titulaire)
	}
}

// Affecter à une campagne : la fiche y entre, va au membre le moins chargé et
// passe en tête de son reste à appeler.
func TestAffectationAUneCampagneVaAuMoinsCharge(t *testing.T) {
	charge := qualificationConnecte(t, "COMMERCIAL")
	libre := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	ancienne, nouvelle := qualificationProspect(charge), qualificationProspect(superviseur)
	// Plus récente que la fiche affectée : sans priorité, elle passerait devant.
	propre := qualificationProspect(libre)
	lot := uuid.NewString()
	filtres := `{"distribution":{"teleconseillerIds":["` + charge.userID + `","` + libre.userID + `"]}}`
	qualificationExec(charge, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                           VALUES ($1,'Campagne équipe','PROSPECTS','CHUES',$2::jsonb,1,$3)`, lot, filtres, superviseur.userID)
	qualificationExec(charge, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, ancienne, charge.userID)
	t.Cleanup(func() {
		_, _ = charge.pool.Exec(charge.ctx, `DELETE FROM "audit_logs" WHERE "entityId" IN ($1, $2)`, nouvelle, lot)
		_, _ = charge.pool.Exec(charge.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	chemin := "/api/v1/prospects/" + nouvelle + "/affecter"
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"teleconseillerId": libre.userID, "campagneId": lot})
	superviseur.attend(statut, http.StatusBadRequest, "une seule destination", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"campagneId": lot})
	superviseur.attend(statut, http.StatusOK, "affectée à la campagne", body)
	if vers, _ := body["teleconseillerId"].(string); vers != libre.userID {
		t.Fatalf("le membre le moins chargé reçoit la fiche : %s", vers)
	}
	var attributaire string
	var position int
	if err := charge.pool.QueryRow(charge.ctx, `SELECT "assigneeId", "position" FROM "lot_export_items" WHERE "lotId" = $1 AND "prospectId" = $2`,
		lot, nouvelle).Scan(&attributaire, &position); err != nil {
		t.Fatal(err)
	}
	if attributaire != libre.userID || position != 2 {
		t.Fatalf("la fiche entre dans la campagne chez le moins chargé : %s %d", attributaire, position)
	}
	if n := qualificationCompte(charge, `SELECT "itemCount" FROM "lots_export" WHERE "id" = $1`, lot); n != 2 {
		t.Fatalf("la campagne compte la fiche : %d", n)
	}
	_, ids := qualificationTotalProspects(libre, "&resteAAppeler=true")
	if len(ids) < 2 || ids[0] != nouvelle || !slices.Contains(ids, propre) {
		t.Fatalf("la fiche affectée passe en tête du reste à appeler : %v", ids)
	}
}

// Celui qui joint le prospect le garde : un appel injoignable ne change rien,
// le premier appel où la personne répond fait du collègue le titulaire.
func TestCeluiQuiJointLeProspectLeGarde(t *testing.T) {
	titulaire := qualificationConnecte(t, "COMMERCIAL")
	collegue := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(titulaire)
	lot := uuid.NewString()
	qualificationExec(titulaire, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                              VALUES ($1,'Relance injoignables','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, titulaire.userID)
	qualificationExec(titulaire, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, fiche, collegue.userID)
	t.Cleanup(func() {
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})
	proprietaire := func() string {
		var id string
		if err := titulaire.pool.QueryRow(titulaire.ctx, `SELECT "createdById" FROM "prospects" WHERE "id" = $1`, fiche).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	// Importée par l'admin, la fiche n'a pas encore de suivi : le premier appel la prend.
	admin := qualificationConnecte(t, "ADMIN")
	qualificationExec(admin, `UPDATE "prospects" SET "createdById" = $2 WHERE "id" = $1`, fiche, admin.userID)
	statut, body := qualificationEnvoi(collegue, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, nil))
	collegue.attend(statut, http.StatusOK, "premier appel, injoignable", body)
	if proprietaire() != collegue.userID {
		t.Fatal("une fiche importée va au premier qui l'appelle")
	}
	// La relance suivante confie la fiche à un autre.
	qualificationExec(admin, `UPDATE "lot_export_items" SET "assigneeId" = $2 WHERE "lotId" = $1`, lot, titulaire.userID)
	statut, body = qualificationEnvoi(titulaire, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, nil))
	titulaire.attend(statut, http.StatusOK, "injoignable consigné", body)
	if proprietaire() != collegue.userID {
		t.Fatal("un appel injoignable ne change pas de titulaire")
	}
	statut, body = qualificationEnvoi(titulaire, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "HESITANT"}))
	titulaire.attend(statut, http.StatusOK, "joint consigné", body)
	if proprietaire() != titulaire.userID {
		t.Fatal("celui qui joint le prospect le garde")
	}
}

// « Mes contacts » montre le parcours du téléconseiller jusqu'à la vente, y
// compris une vente posée depuis le classeur des ventes.
func TestPipelineDesContactsJusquALaVente(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	autre := qualificationConnecte(t, "COMMERCIAL")
	vendue, injoignable := qualificationProspect(b), qualificationProspect(b)
	appels := []map[string]any{
		qualificationCorpsTentative(vendue, map[string]any{"reasonCode": "INTERESSE"}),
		qualificationCorpsTentative(injoignable, nil),
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2)`, vendue, injoignable)
	})
	for _, appel := range appels {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "appel consigné", body)
	}
	qualificationExec(b, `UPDATE "prospects" SET "statut" = 'VENDU' WHERE "id" = $1`, vendue)

	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/pipeline?appelePar="+autre.userID, nil)
	b.attend(statut, http.StatusOK, "pipeline", body)
	if body["appelees"] != float64(2) || body["joignables"] != float64(1) || body["vendues"] != float64(1) {
		t.Fatalf("le téléconseiller voit son propre parcours, quel que soit l'appelePar demandé : %v", body)
	}
	statut, body = qualificationEnvoi(autre, http.MethodGet, "/api/v1/prospects/pipeline", nil)
	autre.attend(statut, http.StatusOK, "pipeline d'un autre", body)
	if body["appelees"] != float64(0) {
		t.Fatalf("les fiches d'un collègue ne comptent pas : %v", body)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/clients", nil)
	b.attend(statut, http.StatusOK, "clients", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("la fiche vendue est un client, sans vente rapprochée : %v", body)
	}
	client, _ := items[0].(map[string]any)
	if rapprochee, _ := client["vente"].(bool); client["id"] != vendue || rapprochee {
		t.Fatalf("client sans vente rapprochée : %v", items[0])
	}
}

// Une vente saisie vaut conversion : la fiche jointe passe vendue sans passer
// par la conversion, et la vente se lit dans les clients du téléconseiller.
func TestVenteSaisieVendLaFicheJointe(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	direction := qualificationConnecte(t, "DIRECTION")
	fiche := qualificationProspect(b)
	// Un numéro mobile sénégalais valide : la saisie normalise le téléphone avant le rapprochement.
	telephone := "+22177" + strconv.FormatInt(time.Now().UnixNano()%10_000_000+1_000_000, 10)[:7]
	qualificationExec(b, `UPDATE "prospects" SET "phoneE164" = $2 WHERE "id" = $1`, fiche, telephone)
	appel := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "INTERESSE"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "ventes" WHERE "telephone" = $1`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "intéressé consigné", body)

	vente := map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-18", "client": "CLIENT " + fiche[:8],
		"telephone": telephone, "site": "THIEO", "nombreLots": 1, "numerosLots": "2001",
		"superficie": "225 m²", "prixUnitaire": 2800000, "acompte": 500000, "modePaiement": "COMPTANT",
	}
	statut, body = qualificationEnvoi(direction, http.MethodPost, "/api/v1/ventes", vente)
	direction.attend(statut, http.StatusCreated, "vente saisie", body)

	var statutFiche, parcours string
	if err := b.pool.QueryRow(b.ctx, `SELECT p."statut"::text, j."statut"::text FROM "prospects" p
		JOIN "prospect_journeys" j ON j."prospectId" = p."id" AND j."projet" = p."projet" WHERE p."id" = $1`, fiche).Scan(&statutFiche, &parcours); err != nil {
		t.Fatal(err)
	}
	if statutFiche != "VENDU" || parcours != "VENDU" {
		t.Fatalf("une vente vaut conversion : %s %s", statutFiche, parcours)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/clients", nil)
	b.attend(statut, http.StatusOK, "clients", body)
	items, _ := body["items"].([]any)
	client, _ := items[0].(map[string]any)
	rapprochee, _ := client["vente"].(bool)
	if len(items) != 1 || !rapprochee || client["site"] != "THIEO" || client["prixTotal"] != float64(2800000) {
		t.Fatalf("la vente se lit chez le téléconseiller : %v", items)
	}
}

func TestComptageSepareLesRequalifications(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	requalifiee, premiere := qualificationProspect(b), qualificationProspect(b)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "openedById" = $1`, b.userID) })
	ouvrir := func(prospect string, ilYA time.Duration, tentative any) {
		qualificationExec(b, `INSERT INTO "ouvertures_fiche" ("id","openedById","prospectId","openedAt","closedAt","closingAttemptId","updatedAt")
		                      VALUES ($1,$2,$3,now() - $4::interval,now() - $4::interval + interval '1 minute',$5,now())`,
			uuid.NewString(), b.userID, prospect, fmt.Sprintf("%d seconds", int(ilYA.Seconds())), tentative)
	}
	ouvrir(requalifiee, 3*time.Hour, uuid.NewString())
	ouvrir(requalifiee, 2*time.Hour, uuid.NewString())
	ouvrir(requalifiee, time.Hour, nil)
	ouvrir(premiere, time.Hour, uuid.NewString())

	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/ouvertures/comptage", nil)
	b.attend(statut, http.StatusOK, "comptage des ouvertures", body)
	totaux := map[string]float64{}
	for _, ligne := range body["items"].([]any) {
		for cle, valeur := range ligne.(map[string]any) {
			if nombre, ok := valeur.(float64); ok {
				totaux[cle] += nombre
			}
		}
	}
	attendus := map[string]float64{"ouvertures": 4, "qualifiees": 3, "ouverturesDejaQualifiees": 2, "requalifiees": 1}
	for cle, attendu := range attendus {
		if totaux[cle] != attendu {
			t.Fatalf("%s = %v, attendu %v (%v)", cle, totaux[cle], attendu, totaux)
		}
	}
}
