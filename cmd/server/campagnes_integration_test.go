//go:build integration

package main

import (
	"archive/zip"
	"bytes"
	"cpi-go/internal/campagnes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

type bancCampagne struct {
	*banc
	agentA      string
	agentB      string
	departement string
	fiches      []string
	lotID       string
}

func (b *bancCampagne) appelCampagne(method, chemin string, corps any) (statut int, reponse map[string]any) {
	b.t.Helper()
	var buf bytes.Buffer
	if corps != nil {
		if err := json.NewEncoder(&buf).Encode(corps); err != nil {
			b.t.Fatal(err)
		}
	}
	req, err := http.NewRequestWithContext(b.ctx, method, b.ts.URL+chemin, &buf)
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
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

func (b *bancCampagne) telechargerCampagne(chemin string) (statut int, entetes http.Header, corps []byte) {
	b.t.Helper()
	req, err := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+chemin, http.NoBody)
	if err != nil {
		b.t.Fatal(err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	octets, err := io.ReadAll(resp.Body)
	if err != nil {
		b.t.Fatal(err)
	}
	return resp.StatusCode, resp.Header, octets
}

func (b *bancCampagne) agent(nom string) string {
	b.t.Helper()
	id := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "users" ("id","email","username","passwordHash","fullName","role") VALUES ($1,$2,$3,'x',$4,'COMMERCIAL')`,
		id, id+"@cpi.sn", id, nom); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	return id
}

func nouveauBancCampagne(t *testing.T, fiches int) *bancCampagne {
	t.Helper()
	base := nouveauBanc(t, "SUPERVISEUR")
	b := &bancCampagne{banc: base}
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion superviseur", body)

	region, departement := uuid.NewString(), uuid.NewString()
	if _, err := b.pool.Exec(b.ctx, `INSERT INTO "regions" ("id","code","name") VALUES ($1,$2,$3)`,
		region, region[:8], "Région "+region); err != nil {
		t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx, `INSERT INTO "departements" ("id","code","name","regionId") VALUES ($1,$2,$3,$4)`,
		departement, departement[:8], "Département "+departement, region); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "departements" WHERE "id" = $1`, departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, region)
	})
	b.departement = departement
	b.agentA = b.agent("Agent Aïda Ndoye")
	b.agentB = b.agent("Agent Boubacar Sy")

	numero := rand.IntN(9_000_000)
	for index := range fiches {
		id := uuid.NewString()
		if _, err := b.pool.Exec(b.ctx,
			`INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt")
			 VALUES ($1,$2,$3,$4,$5,now())`,
			id, "Fiche "+string(rune('A'+index)), fmt.Sprintf("+2217%08d", numero+index), departement, b.userID); err != nil {
			t.Fatal(err)
		}
		b.fiches = append(b.fiches, id)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "departementId" = $1`, departement)
	})
	return b
}

// Deux comptes à 3 fiches par jour sur 2 jours : 12 places pour 10 fiches, ce
// qui laisse le second jour incomplet et rend le tourniquet observable.
func (b *bancCampagne) creer() map[string]any {
	b.t.Helper()
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name":          "Campagne test",
		"cible":         "REPRESENTANTS",
		"representants": map[string]any{"departementId": b.departement},
		"distribution": map[string]any{
			"teleconseillerIds": []string{b.agentA, b.agentB},
			"fichesParJour":     3,
			"jours":             2,
		},
	})
	b.attend(statut, http.StatusCreated, "création de la campagne", body)
	id, _ := body["id"].(string)
	if id == "" {
		b.t.Fatalf("campagne sans identifiant : %v", body)
	}
	b.lotID = id
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, id) })
	return body
}

func (b *bancCampagne) positionsDe(agent string) []int {
	b.t.Helper()
	rows, err := b.pool.Query(b.ctx,
		`SELECT "position" FROM "lot_export_items" WHERE "lotId" = $1 AND "assigneeId" = $2 ORDER BY "position"`,
		b.lotID, agent)
	if err != nil {
		b.t.Fatal(err)
	}
	defer rows.Close()
	var positions []int
	for rows.Next() {
		var position int
		if err := rows.Scan(&position); err != nil {
			b.t.Fatal(err)
		}
		positions = append(positions, position)
	}
	return positions
}

func (b *bancCampagne) compte(requete string, args ...any) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, requete, args...).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func TestCampagneRepartitFichesSansDoublon(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	body := b.creer()
	if body["itemCount"] != float64(10) {
		t.Fatalf("itemCount : %v", body["itemCount"])
	}
	if body["scopeLabel"] != "Tous les représentants" {
		t.Fatalf("scopeLabel : %v", body["scopeLabel"])
	}
	lignes := b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1`, b.lotID)
	distinctes := b.compte(`SELECT count(DISTINCT "position")::int FROM "lot_export_items" WHERE "lotId" = $1`, b.lotID)
	fiches := b.compte(`SELECT count(DISTINCT "representantId")::int FROM "lot_export_items" WHERE "lotId" = $1`, b.lotID)
	if lignes != 10 || distinctes != 10 || fiches != 10 {
		t.Fatalf("10 fiches attendues sans doublon : %d lignes, %d positions, %d fiches", lignes, distinctes, fiches)
	}
	if a, bb := len(b.positionsDe(b.agentA)), len(b.positionsDe(b.agentB)); a != 5 || bb != 5 {
		t.Fatalf("tourniquet déséquilibré : %d et %d", a, bb)
	}
	jour1 := b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "day" = 1`, b.lotID)
	jour2 := b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "day" = 2`, b.lotID)
	if jour1 != 6 || jour2 != 4 {
		t.Fatalf("les journées se remplissent l'une après l'autre : %d puis %d", jour1, jour2)
	}
}

func TestCampagneCibleVideEtEquipeInvalide(t *testing.T) {
	b := nouveauBancCampagne(t, 0)
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name":          "Campagne vide",
		"cible":         "REPRESENTANTS",
		"representants": map[string]any{"departementId": b.departement},
		"distribution":  map[string]any{"teleconseillerIds": []string{b.agentA}},
	})
	b.attend(statut, http.StatusUnprocessableEntity, "cible sans fiche", body)
	if body["code"] != "LOT_EXPORT_CIBLE_VIDE" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = b.appelCampagne(http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name":          "Campagne test",
		"cible":         "REPRESENTANTS",
		"representants": map[string]any{"departementId": b.departement},
		"distribution":  map[string]any{"teleconseillerIds": []string{b.agentA, b.agentA}},
	})
	b.attend(statut, http.StatusUnprocessableEntity, "même compte coché deux fois", body)
	if body["code"] != "LOT_EXPORT_TELECONSEILLER_INVALIDE" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = b.appelCampagne(http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name":          "Campagne test",
		"cible":         "REPRESENTANTS",
		"representants": map[string]any{"departementId": b.departement},
		"distribution":  map[string]any{"teleconseillerIds": []string{uuid.NewString()}},
	})
	b.attend(statut, http.StatusUnprocessableEntity, "compte inconnu", body)
	if body["code"] != "LOT_EXPORT_TELECONSEILLER_INVALIDE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestCampagneStatsComptentUneTentativePosterieure(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	appelee := b.positionsDe(b.agentA)[0]
	var fiche string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "representantId" FROM "lot_export_items" WHERE "lotId" = $1 AND "position" = $2`,
		b.lotID, appelee).Scan(&fiche); err != nil {
		t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "rep_call_attempts" ("id","representantId","performedById","outcome","clientCreatedAt")
		 VALUES ($1,$2,$3,'REACHED',now())`,
		uuid.NewString(), fiche, b.agentA); err != nil {
		t.Fatal(err)
	}
	statut, body := b.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+b.lotID, nil)
	b.attend(statut, http.StatusOK, "détail après un appel", body)
	if body["callsSince"] != float64(1) || body["fichesAppelees"] != float64(1) {
		t.Fatalf("l'appel doit compter : %v appels, %v fiches", body["callsSince"], body["fichesAppelees"])
	}
	statut, body = b.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+b.lotID+"/fiches?etat=TRAITEE", nil)
	b.attend(statut, http.StatusOK, "fiches traitées", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("une seule fiche traitée attendue : %v", body["meta"])
	}
	if premiere, _ := items[0].(map[string]any); premiere["position"] != float64(appelee) {
		t.Fatalf("la position appelée doit être la traitée : %v", items[0])
	}
}

func TestCampagneReaffectationDeplaceEtTrace(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	aDeplacer := b.positionsDe(b.agentA)[1:3]
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/reaffectation", map[string]any{
		"positions": aDeplacer, "versTeleconseillerId": b.agentB,
	})
	b.attend(statut, http.StatusOK, "réaffectation", body)

	for _, position := range aDeplacer {
		if b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "position" = $2 AND "assigneeId" = $3`,
			b.lotID, position, b.agentB) != 1 {
			t.Fatalf("la position %d n'a pas suivi", position)
		}
	}
	if n := b.compte(`SELECT count(*)::int FROM "lot_export_reaffectations" WHERE "lotId" = $1 AND "fromAssigneeId" = $2 AND "toAssigneeId" = $3 AND "fiches" = 2`,
		b.lotID, b.agentA, b.agentB); n != 1 {
		t.Fatalf("une trace de réaffectation attendue, %d trouvées", n)
	}
	if n := b.compte(`SELECT count(*)::int FROM "audit_logs" WHERE "entity" = 'lot_export' AND "entityId" = $1 AND "action" = 'lot_export.reaffectation'`,
		b.lotID); n != 1 {
		t.Fatalf("le geste d'encadrement doit être audité, %d entrées", n)
	}
	traces, _ := body["reaffectations"].([]any)
	if len(traces) != 1 {
		t.Fatalf("le détail rend la trace : %v", body["reaffectations"])
	}
	if trace, _ := traces[0].(map[string]any); trace["fichesEnMain"] != float64(2) {
		t.Fatalf("les deux fiches sont encore en main : %v", traces[0])
	}

	statut, body = b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/reaffectation", map[string]any{
		"positions": aDeplacer, "versTeleconseillerId": b.agentB,
	})
	b.attend(statut, http.StatusUnprocessableEntity, "fiches déjà au même compte", body)
	if body["code"] != "LOT_EXPORT_REAFFECTATION_VIDE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestCampagneReaffectationConfieUneFicheTraitee(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	appelee := b.positionsDe(b.agentA)[0]
	tentative := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "rep_call_attempts" ("id","representantId","performedById","outcome","clientCreatedAt")
		 SELECT $1, "representantId", $2, 'REACHED', now() FROM "lot_export_items" WHERE "lotId" = $3 AND "position" = $4`,
		tentative, b.agentA, b.lotID, appelee); err != nil {
		t.Fatal(err)
	}
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/reaffectation", map[string]any{
		"positions": []int{appelee}, "versTeleconseillerId": b.agentB,
	})
	b.attend(statut, http.StatusOK, "réaffectation d'une fiche traitée", body)
	if b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "position" = $2 AND "assigneeId" = $3`,
		b.lotID, appelee, b.agentB) != 1 {
		t.Fatal("la fiche traitée doit suivre")
	}
	if b.compte(`SELECT count(*)::int FROM "rep_call_attempts" WHERE "id" = $1 AND "performedById" = $2`, tentative, b.agentA) != 1 {
		t.Fatal("l'appel reste à son auteur")
	}
}

func TestCampagneReaffectationFaitEntrerUnTeleconseillerOublie(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	oublie := b.agent("Agent Coumba Fall")
	b.creer()
	aDonner := b.positionsDe(b.agentA)[:2]
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/reaffectation", map[string]any{
		"positions": aDonner, "versTeleconseillerId": oublie,
	})
	b.attend(statut, http.StatusOK, "réaffectation vers un téléconseiller hors campagne", body)

	if recues := b.positionsDe(oublie); len(recues) != len(aDonner) {
		t.Fatalf("les fiches doivent passer au téléconseiller ajouté : %v", recues)
	}
	repartition, _ := body["repartition"].([]any)
	for _, ligne := range repartition {
		if membre, _ := ligne.(map[string]any); membre["teleconseillerId"] == oublie {
			return
		}
	}
	t.Fatalf("le téléconseiller ajouté doit entrer dans la répartition : %v", repartition)
}

func TestCampagneAjoutTeleconseillerSansPuisAvecFiches(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	oublie := b.agent("Agent Coumba Fall")
	b.creer()
	chemin := "/api/v1/lots-export/" + b.lotID + "/equipe"

	statut, body := b.appelCampagne(http.MethodPost, chemin, map[string]any{"teleconseillerId": oublie})
	b.attend(statut, http.StatusOK, "ajout sans fiche", body)
	if !campagneListeMembre(body["repartition"], oublie) || !campagneListeMembre(body["performance"], oublie) {
		t.Fatalf("le téléconseiller ajouté sans fiche doit paraître au programme et à la performance : %v", body)
	}

	statut, body = b.appelCampagne(http.MethodPost, chemin, map[string]any{"teleconseillerId": oublie})
	b.attend(statut, http.StatusUnprocessableEntity, "ajout en double", body)
	if body["code"] != "LOT_EXPORT_DEJA_DANS_EQUIPE" {
		t.Fatalf("code : %v", body["code"])
	}

	renfort := b.agent("Agent Pape Diouf")
	aDonner := b.positionsDe(b.agentB)[:2]
	statut, body = b.appelCampagne(http.MethodPost, chemin, map[string]any{"teleconseillerId": renfort, "positions": aDonner})
	b.attend(statut, http.StatusOK, "ajout avec deux fiches", body)
	if recues := b.positionsDe(renfort); len(recues) != len(aDonner) {
		t.Fatalf("le renfort doit tenir les deux fiches données : %v", recues)
	}
}

func campagneListeMembre(liste any, id string) bool {
	lignes, _ := liste.([]any)
	for _, ligne := range lignes {
		if membre, _ := ligne.(map[string]any); membre["teleconseillerId"] == id {
			return true
		}
	}
	return false
}

func TestCampagneRetraitRendLesFichesNonTraitees(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	traitee := b.positionsDe(b.agentA)[0]
	var fiche string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "representantId" FROM "lot_export_items" WHERE "lotId" = $1 AND "position" = $2`,
		b.lotID, traitee).Scan(&fiche); err != nil {
		t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "rep_call_attempts" ("id","representantId","performedById","outcome","clientCreatedAt")
		 VALUES ($1,$2,$3,'REACHED',now())`,
		uuid.NewString(), fiche, b.agentA); err != nil {
		t.Fatal(err)
	}
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/retrait",
		map[string]any{"teleconseillerId": b.agentA})
	b.attend(statut, http.StatusOK, "retrait", body)

	restantes := b.positionsDe(b.agentA)
	if len(restantes) != 1 || restantes[0] != traitee {
		t.Fatalf("seule la fiche traitée reste au retiré : %v", restantes)
	}
	if len(b.positionsDe(b.agentB)) != 9 {
		t.Fatalf("le reste de l'équipe reprend : %v", b.positionsDe(b.agentB))
	}
	if n := b.compte(`SELECT count(*)::int FROM "audit_logs" WHERE "entity" = 'lot_export' AND "entityId" = $1 AND "action" = 'lot_export.retrait'`,
		b.lotID); n != 1 {
		t.Fatalf("retrait non audité, %d entrées", n)
	}
	repartition, _ := body["repartition"].([]any)
	if len(repartition) != 1 {
		t.Fatalf("le retiré sort de l'équipe : %v", body["repartition"])
	}
	statut, body = b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/retrait",
		map[string]any{"teleconseillerId": b.agentB})
	b.attend(statut, http.StatusUnprocessableEntity, "retrait du dernier téléconseiller", body)
	if body["code"] != "LOT_EXPORT_EQUIPE_VIDE" {
		t.Fatalf("code : %v", body["code"])
	}
}

// Deux membres passés CCP : le premier se retire même si le second siège encore,
// seuls ceux restés téléconseillers reprennent ses fiches.
func TestCampagneRetraitDunMembreDontLeRoleAChange(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	agentC := b.agent("Agent Coumba Fall")
	b.creer()
	if _, err := b.pool.Exec(b.ctx, `UPDATE "users" SET "role" = 'CCP' WHERE "id" IN ($1, $2)`, b.agentA, agentC); err != nil {
		t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "lots_export" SET "filters" = jsonb_set("filters", '{distribution,teleconseillerIds}',
		   ("filters"->'distribution'->'teleconseillerIds') || to_jsonb($2::text)) WHERE "id" = $1`,
		b.lotID, agentC); err != nil {
		t.Fatal(err)
	}
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/"+b.lotID+"/retrait",
		map[string]any{"teleconseillerId": b.agentA})
	b.attend(statut, http.StatusOK, "retrait d'un membre devenu CCP", body)
	if len(b.positionsDe(b.agentA)) != 0 || len(b.positionsDe(b.agentB)) != 10 || len(b.positionsDe(agentC)) != 0 {
		t.Fatalf("seul le téléconseiller restant reprend : A %v, B %v, C %v",
			b.positionsDe(b.agentA), b.positionsDe(b.agentB), b.positionsDe(agentC))
	}
}

// Changer le rôle d'un téléconseiller le sort de ses campagnes, fiches reprises
// et trace écrite ; la dernière personne d'une équipe ne change pas de rôle.
func TestAdminChangementDeRoleRetireDesCampagnes(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	admin := adminConnecte(t)

	statut, body := adminAppel(admin, http.MethodPatch, "/api/v1/users/"+b.agentA, map[string]any{"role": "CCP"})
	admin.attend(statut, http.StatusOK, "passage d'un membre de campagne en CCP", body)
	if len(b.positionsDe(b.agentA)) != 0 || len(b.positionsDe(b.agentB)) != 10 {
		t.Fatalf("les fiches du nouveau CCP reviennent à l'équipe : A %v, B %v", b.positionsDe(b.agentA), b.positionsDe(b.agentB))
	}
	if n := b.compte(`SELECT count(*)::int FROM "audit_logs" WHERE "entity" = 'lot_export' AND "entityId" = $1 AND "action" = 'lot_export.retrait'`,
		b.lotID); n != 1 {
		t.Fatalf("retrait non audité, %d entrées", n)
	}
	_, detail := b.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+b.lotID, nil)
	if campagneListeMembre(detail["repartition"], b.agentA) {
		t.Fatalf("le CCP siège encore dans la campagne : %v", detail["repartition"])
	}

	statut, body = adminAppel(admin, http.MethodPatch, "/api/v1/users/"+b.agentB, map[string]any{"role": "CCP"})
	admin.attend(statut, http.StatusUnprocessableEntity, "le dernier téléconseiller d'une campagne", body)
	if body["code"] != "LOT_EXPORT_EQUIPE_VIDE" || !strings.Contains(texteDe(body["message"]), "Campagne test") {
		t.Fatalf("refus attendu avec le nom de la campagne : %v", body)
	}
	if n := b.compte(`SELECT count(*)::int FROM "users" WHERE "id" = $1 AND "role" = 'COMMERCIAL'`, b.agentB); n != 1 {
		t.Fatal("le rôle refusé ne doit pas changer")
	}
}

func TestCampagneClasseurEtProgrammes(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()

	statut, entetes, corps := b.telechargerCampagne("/api/v1/lots-export/" + b.lotID + "/export.xlsx")
	if statut != http.StatusOK || entetes.Get("Content-Type") != campagnes.LotMimeClasseur {
		t.Fatalf("classeur : statut %d, type %q", statut, entetes.Get("Content-Type"))
	}
	classeur, err := excelize.OpenReader(bytes.NewReader(corps))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = classeur.Close() })
	lignes, err := classeur.GetRows(campagnes.FeuilleLot)
	if err != nil {
		t.Fatal(err)
	}
	if len(lignes) != 11 || lignes[0][0] != "Téléconseiller" {
		t.Fatalf("le classeur porte l'entête puis les 10 fiches : %d lignes, entête %v", len(lignes), lignes[0])
	}
	if lignes[1][0] != "Agent Aïda Ndoye" {
		t.Fatalf("le classeur suit l'ordre du tourniquet : %v", lignes[1])
	}
}

func TestCampagneProgrammesImprimables(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()

	statut, entetes, corps := b.telechargerCampagne("/api/v1/lots-export/" + b.lotID + "/programmes.zip")
	if statut != http.StatusOK || entetes.Get("Content-Type") != "application/zip" {
		t.Fatalf("archive : statut %d, type %q", statut, entetes.Get("Content-Type"))
	}
	archive, err := zip.NewReader(bytes.NewReader(corps), int64(len(corps)))
	if err != nil {
		t.Fatal(err)
	}
	paires := b.compte(`SELECT count(*)::int FROM (SELECT 1 FROM "lot_export_items" WHERE "lotId" = $1 GROUP BY "assigneeId","day") p`, b.lotID)
	if len(archive.File) != paires {
		t.Fatalf("un programme par téléconseiller et par journée : %d fichiers pour %d couples", len(archive.File), paires)
	}
	noms := make([]string, 0, len(archive.File))
	for _, fichier := range archive.File {
		noms = append(noms, fichier.Name)
	}
	joints := strings.Join(noms, " ")
	if !strings.Contains(joints, "programme-agent-aida-ndoye-jour-1.pdf") ||
		!strings.Contains(joints, "programme-agent-boubacar-sy-jour-2.pdf") {
		t.Fatalf("noms de programmes : %v", noms)
	}

	statut, entetes, corps = b.telechargerCampagne(
		"/api/v1/lots-export/" + b.lotID + "/programme.pdf?teleconseillerId=" + b.agentA + "&jour=1")
	if statut != http.StatusOK || entetes.Get("Content-Type") != "application/pdf" ||
		!bytes.HasPrefix(corps, []byte("%PDF")) {
		t.Fatalf("programme : statut %d, type %q, %d octets", statut, entetes.Get("Content-Type"), len(corps))
	}
	statut, _, _ = b.telechargerCampagne(
		"/api/v1/lots-export/" + b.lotID + "/programme.pdf?teleconseillerId=" + b.agentA + "&jour=9")
	if statut != http.StatusNotFound {
		t.Fatalf("journée sans fiche : statut %d", statut)
	}
}

func TestCampagneReserveeALEncadrement(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()
	lecteur := &bancCampagne{banc: nouveauBanc(t, "COMMERCIAL"), lotID: b.lotID}
	statut, body := lecteur.connexion(lecteur.email, "motdepasse")
	lecteur.attend(statut, http.StatusOK, "connexion téléconseiller", body)
	statut, body = lecteur.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+b.lotID, nil)
	lecteur.attend(statut, http.StatusForbidden, "un téléconseiller ne lit pas les campagnes", body)
	statut, body = lecteur.appelCampagne(http.MethodDelete, "/api/v1/lots-export/"+b.lotID, nil)
	lecteur.attend(statut, http.StatusForbidden, "suppression réservée à l'administrateur", body)
	statut, body = b.appelCampagne(http.MethodDelete, "/api/v1/lots-export/"+b.lotID, nil)
	b.attend(statut, http.StatusForbidden, "un superviseur ne supprime pas", body)
}

// Le panneau filtre ses listes sur les fiches du téléconseiller connecté ;
// l'encadrement reçoit « tout » plutôt que la liste entière.
func TestCampagneMesAttributions(t *testing.T) {
	b := nouveauBancCampagne(t, 10)
	b.creer()

	statut, body := b.appelCampagne(http.MethodGet, "/api/v1/lots-export/mes-attributions", nil)
	b.attend(statut, http.StatusOK, "attributions de l'encadrement", body)
	if !estVrai(body["tout"]) || len(body["representantIds"].([]any)) != 0 || len(body["prospectIds"].([]any)) != 0 {
		t.Fatalf("l'encadrement n'est pas filtré : %v", body)
	}

	lecteur := &bancCampagne{banc: nouveauBanc(t, "COMMERCIAL"), lotID: b.lotID}
	statut, body = lecteur.connexion(lecteur.email, "motdepasse")
	lecteur.attend(statut, http.StatusOK, "connexion téléconseiller", body)
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "lot_export_items" SET "assigneeId" = $1 WHERE "lotId" = $2 AND "assigneeId" = $3`,
		lecteur.userID, b.lotID, b.agentA); err != nil {
		t.Fatal(err)
	}

	statut, body = lecteur.appelCampagne(http.MethodGet, "/api/v1/lots-export/mes-attributions", nil)
	lecteur.attend(statut, http.StatusOK, "attributions du téléconseiller", body)
	if estVrai(body["tout"]) || len(body["prospectIds"].([]any)) != 0 {
		t.Fatalf("un téléconseiller ne reçoit que ses fiches : %v", body)
	}
	attribuees := body["representantIds"].([]any)
	if len(attribuees) != len(b.positionsDe(lecteur.userID)) {
		t.Fatalf("autant de fiches que de places tenues : %v", attribuees)
	}
	for _, fiche := range attribuees {
		if !slices.Contains(b.fiches, fiche.(string)) {
			t.Fatalf("fiche étrangère au lot : %v", fiche)
		}
	}
}

func (b *bancCampagne) prospect(feuille, projet string, issue *string, statut string) string {
	b.t.Helper()
	id := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","projet","updatedAt",
		                          "importFeuille","lastCallOutcome","lastCallAt","statut")
		 VALUES ($1,'Sarr','Mame',$2,$3,now(),$4::"Projet",now(),$5,$6::"CallOutcome",
		         CASE WHEN $6::"CallOutcome" IS NULL THEN NULL ELSE now() END,$7::"ProspectStatut")`,
		id, "+2217"+id[:8], b.userID, projet, feuille, issue, statut); err != nil {
		b.t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "prospect_journeys" ("id","prospectId","projet","updatedAt") VALUES ($1,$2,$3::"Projet",now())`,
		uuid.NewString(), id, projet); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = $1`, id) })
	return id
}

// Quatre fiches : CHUES jamais appelée, CHUES injoignable, CHUES injoignable
// puis close par un faux numéro, Grand Public jamais appelée. Sans projet, la
// campagne prend CHUES et Grand Public ensemble, mais seulement ce qui n'a
// jamais été appelé ; « injoignables » ne garde que la deuxième. Une fiche
// distribuée ne se retire plus : recréer la campagne ne la donne pas à un
// second téléconseiller. Un superviseur coché compte pour autant qu'un
// téléconseiller.
func TestCampagneProspectsTousProjetsEtInjoignables(t *testing.T) {
	b := nouveauBancCampagne(t, 0)
	feuille := "Feuille " + uuid.NewString()
	injoignable := "UNREACHABLE"
	jamaisAppelee := b.prospect(feuille, "CHUES", nil, "NOUVEAU")
	aRelancer := b.prospect(feuille, "CHUES", &injoignable, "NOUVEAU")
	b.prospect(feuille, "CHUES", &injoignable, "PERDU")
	b.prospect(feuille, "GRAND_PUBLIC", nil, "NOUVEAU")

	corps := func(projet string, injoignables bool) map[string]any {
		prospects := map[string]any{"importFeuille": feuille, "injoignables": injoignables}
		if projet != "" {
			prospects["projet"] = projet
		}
		return map[string]any{
			"name": "Campagne prospects", "cible": "PROSPECTS", "prospects": prospects,
			"distribution": map[string]any{
				"teleconseillerIds": []string{b.agentA, b.userID}, "fichesParJour": 3, "jours": 1,
			},
		}
	}
	body := b.apercuEligible(corps("", false), 2, "aperçu tous projets")
	if body["places"] != float64(6) || body["scopeLabel"] != "Tous projets" {
		t.Fatalf("6 places sur tous les projets attendues : %v", body)
	}
	b.apercuEligible(corps("CHUES", false), 1, "aperçu CHUES")
	body = b.apercuEligible(corps("", true), 1, "aperçu des injoignables")
	if body["scopeLabel"] != "Tous projets, injoignables" {
		t.Fatalf("libellé des injoignables : %v", body)
	}

	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export", corps("", false))
	b.attend(statut, http.StatusCreated, "création de la campagne", body)
	lotID, _ := body["id"].(string)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lotID) })
	if body["itemCount"] != float64(2) || body["projet"] != nil {
		t.Fatalf("campagne sans projet à 2 fiches attendue : %v", body)
	}
	if b.dansLeLot(lotID, aRelancer) || !b.dansLeLot(lotID, jamaisAppelee) {
		t.Fatal("la campagne prend la fiche jamais appelée et laisse la fiche déjà appelée")
	}

	b.apercuEligible(corps("", false), 0, "aperçu après distribution : une fiche distribuée ne se retire plus")
	statut, body = b.appelCampagne(http.MethodPost, "/api/v1/lots-export", corps("", true))
	b.attend(statut, http.StatusCreated, "campagne des injoignables", body)
	relance, _ := body["id"].(string)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, relance) })
	if !b.dansLeLot(relance, aRelancer) {
		t.Fatal("la relance des injoignables reprend la fiche déjà appelée")
	}
}

func (b *bancCampagne) apercuEligible(corps map[string]any, attendu int, etape string) map[string]any {
	b.t.Helper()
	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export/apercu", corps)
	b.attend(statut, http.StatusOK, etape, body)
	if body["eligible"] != float64(attendu) {
		b.t.Fatalf("%s : %d fiches éligibles attendues, %v", etape, attendu, body)
	}
	return body
}

func (b *bancCampagne) dansLeLot(lotID, prospectID string) bool {
	b.t.Helper()
	return b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "prospectId" = $2`, lotID, prospectID) == 1
}

// Un classeur releve plusieurs fois donne plusieurs travaux d'import, et
// l'onglet du jour se repartit entre eux. Le selecteur de campagne groupe les
// releves par onglet et ne peut rendre qu'un identifiant, le plus recent : le
// 16 septembre 2026, l'onglet « Leads 13 sept » annoncait 93 fiches et la
// creation repondait « Aucune fiche ne correspond aux criteres ».
func TestCampagneOngletReparitiEntrePlusieursReleves(t *testing.T) {
	b := nouveauBancCampagne(t, 0)
	feuille := "Leads 13 sept " + uuid.NewString()
	classeur := "Leads du 10 sept 2026 " + uuid.NewString() + ".xlsx"
	premier, dernier := b.travailDImport(classeur), b.travailDImport(classeur)
	if dernier < premier {
		premier, dernier = dernier, premier
	}
	fiche := b.prospect(feuille, "GRAND_PUBLIC", nil, "NOUVEAU")
	if _, err := b.pool.Exec(b.ctx, `UPDATE "prospects" SET "importJobId" = $2 WHERE "id" = $1`, fiche, premier); err != nil {
		t.Fatal(err)
	}

	// Le panneau envoie l'identifiant que le selecteur lui a donne.
	corps := map[string]any{
		"name": "Campagne onglet", "cible": "PROSPECTS",
		"prospects": map[string]any{"importFeuille": feuille, "importJobId": dernier, "projet": "GRAND_PUBLIC"},
		"distribution": map[string]any{
			"teleconseillerIds": []string{b.agentA}, "fichesParJour": 3, "jours": 1,
		},
	}
	b.apercuEligible(corps, 1, "apercu de l'onglet")

	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export", corps)
	b.attend(statut, http.StatusCreated, "creation de la campagne", body)
	lotID, _ := body["id"].(string)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lotID) })
	if !b.dansLeLot(lotID, fiche) {
		t.Fatalf("la fiche de l'onglet entre dans la campagne : %v", body)
	}
}

func (b *bancCampagne) travailDImport(classeur string) string {
	b.t.Helper()
	id := uuid.Must(uuid.NewV7()).String()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "import_jobs" ("id","kind","status","mode","requestedById","fileName","fileBytes","storagePath","expiresAt","updatedAt")
		 VALUES ($1,'PROSPECTS_GRAND_PUBLIC','succeeded','APPLY',$2,$3,1,'/tmp/x',now() + interval '1 day',now())`,
		id, b.userID, classeur); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "id" = $1`, id) })
	return id
}
