//go:build integration

package main

import (
	"archive/zip"
	"bytes"
	"cpi-go/db"
	"cpi-go/internal/banque"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

type socleBanque struct {
	*banc
	banqueID       string
	depot          string
	etude          string
	encaisse       string
	rejete         string
	motifAutre     string
	motifIncomplet string
	prospectID     string
	inscriptionID  string
	// Uniquement ce que le test a inséré : les lignes semées ne se suppriment pas.
	etapesCreees []string
	motifsCrees  []string
}

func banqueJSON(b *banc, method, chemin string, corps any) (statut int, reponse map[string]any) {
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

func banqueExec(b *banc, sql string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, sql, args...); err != nil {
		b.t.Fatal(err)
	}
}

func banqueLigne(b *banc, requete string, args ...any) string {
	b.t.Helper()
	var id string
	if err := b.pool.QueryRow(b.ctx, requete, args...).Scan(&id); err != nil {
		b.t.Fatal(err)
	}
	return id
}

// Une seule étape initiale, CASHED et REJECTED dans toute la base (index partiels) :
// on emprunte celles du seed et on ne crée que ce qui manque.
func (s *socleBanque) etape(filtre, code, genre string, position int, initiale bool) string {
	s.t.Helper()
	id := banqueLigne(s.banc, `SELECT COALESCE((SELECT "id" FROM "bank_case_stages"
		WHERE `+filtre+` ORDER BY "position" ASC, "id" ASC LIMIT 1), '')`)
	if id != "" {
		return id
	}
	id = uuid.NewString()
	banqueExec(s.banc, `INSERT INTO "bank_case_stages"
		("id","code","label","position","color","type","isActive","isInitial","isSystem","updatedAt")
		VALUES ($1,$2,$2,$3,'info',$4::"BankStageType",true,$5,$6,now())`,
		id, code+"-"+id[:8], position, genre, initiale, genre != "OPEN")
	s.etapesCreees = append(s.etapesCreees, id)
	return id
}

func (s *socleBanque) motif(filtre, code string, rang int) string {
	s.t.Helper()
	id := banqueLigne(s.banc, `SELECT COALESCE((SELECT "id" FROM "bank_rejection_reasons"
		WHERE `+filtre+` ORDER BY "sortOrder" ASC, "id" ASC LIMIT 1), '')`)
	if id != "" {
		return id
	}
	id = uuid.NewString()
	// Code verbatim : le serveur reconnaît « AUTRE » à son code, pas à son libellé.
	banqueExec(s.banc, `INSERT INTO "bank_rejection_reasons" ("id","code","label","sortOrder","updatedAt")
		VALUES ($1,$2,$2,$3,now())`, id, code, rang)
	s.motifsCrees = append(s.motifsCrees, id)
	return id
}

// Un flux complet : deux étapes ouvertes, l'encaissement, le rejet, deux motifs
// et un prospect enrôlé, empruntés au seed quand il les porte.
func nouveauBancBanque(t *testing.T, role string) *socleBanque {
	t.Helper()
	b := nouveauBanc(t, role)
	s := &socleBanque{banc: b, banqueID: uuid.NewString(), prospectID: uuid.NewString()}
	banqueExec(b, `INSERT INTO "banques" ("id","name","shortName","updatedAt") VALUES ($1,$2,$3,now())`,
		s.banqueID, "Banque Test "+s.banqueID[:8], "BT"+s.banqueID[:6])
	s.depot = s.etape(`"isInitial" AND "isActive"`, "DEPOT", "OPEN", 1, true)
	s.etude = s.etape(`"type" = 'OPEN' AND NOT "isInitial" AND "isActive"`, "ETUDE", "OPEN", 2, false)
	s.encaisse = s.etape(`"type" = 'CASHED'`, "ENCAISSE", "CASHED", 100, false)
	s.rejete = s.etape(`"type" = 'REJECTED'`, "REJETE", "REJECTED", 101, false)
	// Le motif « AUTRE » est le seul qui exige une précision libre.
	s.motifAutre = s.motif(`"code" = 'AUTRE'`, "AUTRE", 900)
	s.motifIncomplet = s.motif(`"code" <> 'AUTRE' AND "isActive"`, "INCOMPLET-"+s.banqueID[:8], 1)
	banqueExec(b, `INSERT INTO "prospects"
		("id","nom","prenom","phoneE164","banqueId","createdById","clientCreatedAt","updatedAt","phase2Status","enrollmentMethod")
		VALUES ($1,'Diétou','Amadou',$2,$3,$4,now(),now(),'METHOD_OBTAINED','PLATFORM')`,
		s.prospectID, "+2217"+s.prospectID[:8], s.banqueID, b.userID)
	s.inscriptionID = s.inscription(&s.prospectID)

	t.Cleanup(func() {
		menage := []struct {
			sql  string
			args []any
		}{
			{`DELETE FROM "courriels" WHERE "objetId" IN (SELECT "id"::text FROM "bank_cases" WHERE "processingBankId" = $1)
				OR "objetId" IN (SELECT "id" FROM "inscriptions_plateforme" WHERE "identifiantDistant" LIKE 'test-' || $1 || '%')`, []any{s.banqueID}},
			{`DELETE FROM "notification_deliveries" WHERE "notificationId" IN (SELECT "id" FROM "notifications" WHERE "category" = 'DOSSIER' AND "body" LIKE '%' || $1 || '%')`, []any{"Banque Test " + s.banqueID[:8]}},
			{`DELETE FROM "notifications" WHERE "category" = 'DOSSIER' AND "body" LIKE '%' || $1 || '%'`, []any{"Banque Test " + s.banqueID[:8]}},
			{`DELETE FROM "bank_cases" WHERE "processingBankId" = $1`, []any{s.banqueID}},
			{`DELETE FROM "inscriptions_plateforme" WHERE "identifiantDistant" LIKE 'test-' || $1 || '%'`, []any{s.banqueID}},
			{`DELETE FROM "client_creation_requests" WHERE "banqueId" = $1`, []any{s.banqueID}},
			{`DELETE FROM "prospects" WHERE "banqueId" = $1`, []any{s.banqueID}},
			{`DELETE FROM "bank_case_stages" WHERE "id" = ANY($1)`, []any{s.etapesCreees}},
			{`DELETE FROM "bank_rejection_reasons" WHERE "id" = ANY($1)`, []any{s.motifsCrees}},
			{`DELETE FROM "banques" WHERE "id" = $1`, []any{s.banqueID}},
			{`DELETE FROM "audit_logs" WHERE "userId" = $1`, []any{b.userID}},
		}
		for _, etape := range menage {
			if _, err := b.pool.Exec(b.ctx, etape.sql, etape.args...); err != nil {
				t.Errorf("ménage %q : %v", etape.sql, err)
			}
		}
	})
	return s
}

func (s *socleBanque) connecte() {
	s.t.Helper()
	statut, body := s.connexion(s.email, "motdepasse")
	s.attend(statut, http.StatusOK, "connexion", body)
}

// Une inscription validée sur la plateforme (décision datée), rapprochée ou non
// d'un prospect : la seule porte d'entrée d'un dossier bancaire.
func (s *socleBanque) inscription(prospectID *string) string {
	s.t.Helper()
	id := uuid.NewString()
	banqueExec(s.banc, `INSERT INTO "inscriptions_plateforme"
		("id","projet","identifiantDistant","nom","prenom","phoneE164","statutDistant","decideeLe","prospectId","chargeUtile","dernierTirageAt","updatedAt")
		VALUES ($1,'CHUES',$2,'Diétou','Amadou',$3,'validated',now(),$4,'{}',now(),now())`,
		id, "test-"+s.banqueID+"-"+id[:8], "+2217"+s.prospectID[:8], prospectID)
	return id
}

func (s *socleBanque) inscriptionDistante(projet, statutDistant, charge string) string {
	s.t.Helper()
	id := uuid.NewString()
	banqueExec(s.banc, `INSERT INTO "inscriptions_plateforme"
		("id","projet","identifiantDistant","nom","prenom","statutDistant","chargeUtile","dernierTirageAt","updatedAt")
		VALUES ($1,$2::"Projet",$3,'Sy','Awa',$4,$5::jsonb,now(),now())`,
		id, projet, "test-"+s.banqueID+"-"+id[:8], statutDistant, charge)
	return id
}

func (s *socleBanque) ouvrirDossier() (id string, rev float64) {
	s.t.Helper()
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases",
		map[string]any{"inscriptionId": s.inscriptionID})
	s.attend(statut, http.StatusCreated, "ouverture du dossier", body)
	return body["id"].(string), body["rev"].(float64)
}

// Deux créations simultanées lisent le même rang en READ COMMITTED : sans le
// verrou consultatif, elles écrivent la même position.
func TestBanquePositionsDistinctesEnConcurrence(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()

	var attente sync.WaitGroup
	depart := make(chan struct{})
	positions := make([]float64, 6)
	statuts := make([]int, len(positions))
	for i := range positions {
		attente.Add(1)
		go func() {
			defer attente.Done()
			<-depart
			statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-case-stages",
				map[string]any{"code": "CONC" + strings.ToUpper(uuid.NewString()[:6]), "label": "Concurrence", "color": "info"})
			statuts[i] = statut
			if position, ok := body["position"].(float64); ok {
				positions[i] = position
			}
		}()
	}
	close(depart)
	attente.Wait()

	defer func() {
		_, _ = s.pool.Exec(s.ctx, `DELETE FROM "bank_case_stages" WHERE "code" LIKE 'CONC%'`)
	}()
	vues := map[float64]bool{}
	for i, statut := range statuts {
		if statut != http.StatusCreated {
			t.Fatalf("création %d : statut %d", i, statut)
		}
		if vues[positions[i]] {
			t.Fatalf("deux étapes créées en même temps partagent la position %v", positions[i])
		}
		vues[positions[i]] = true
	}
}

func TestBanqueAvancementEcritTransitionEtRev(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	id, rev := s.ouvrirDossier()

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev})
	s.attend(statut, http.StatusCreated, "avancement", body)
	dossier := body["bankCase"].(map[string]any)
	if dossier["rev"].(float64) != rev+1 {
		t.Fatalf("rev %v attendu, %v reçu", rev+1, dossier["rev"])
	}
	if historique := body["history"].([]any); len(historique) != 2 {
		t.Fatalf("l'ouverture et l'avancement font deux transitions, %d écrites", len(historique))
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev, "amountXof": "1200000"})
	s.attend(statut, http.StatusConflict, "révision périmée", body)
	if body["code"] != "BANK_CASE_REV_CONFLICT" {
		t.Fatalf("code : %v", body["code"])
	}

	var transitions int
	if err := s.pool.QueryRow(s.ctx, `SELECT count(*)::int FROM "bank_case_transitions" WHERE "caseId" = $1`, id).Scan(&transitions); err != nil {
		t.Fatal(err)
	}
	if transitions != 2 {
		t.Fatalf("la transition refusée ne doit rien écrire : %d lignes", transitions)
	}
}

// Entre étapes ouvertes le déplacement est libre dans les deux sens ; seuls
// l'encaissement et le rejet exigent une confirmation.
func TestBanqueDeplacementLibreEntreEtapesOuvertes(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	id, rev := s.ouvrirDossier()
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev})
	s.attend(statut, http.StatusCreated, "prise en traitement", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.depot, "expectedRev": rev + 1})
	s.attend(statut, http.StatusCreated, "retour à l'étape initiale", body)
	if body["bankCase"].(map[string]any)["currentStage"].(map[string]any)["id"] != s.depot {
		t.Fatalf("étape après retour : %v", body["bankCase"])
	}
	if historique := body["history"].([]any); len(historique) != 3 {
		t.Fatalf("chaque déplacement laisse une transition, %d écrites", len(historique))
	}
}

func TestBanqueRejetExigeUnMotif(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	id, rev := s.ouvrirDossier()

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.rejete, "expectedRev": rev, "rejectionReasonId": s.motifIncomplet})
	s.attend(statut, http.StatusUnprocessableEntity, "rejet depuis l'étape initiale", body)
	if body["code"] != "BANK_CASE_REJECT_BEFORE_PROCESSING" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev})
	s.attend(statut, http.StatusCreated, "prise en traitement", body)
	rev++

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.rejete, "expectedRev": rev})
	s.attend(statut, http.StatusUnprocessableEntity, "rejet sans motif", body)
	if body["code"] != "BANK_CASE_REJECTION_REASON_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.rejete, "expectedRev": rev, "rejectionReasonId": s.motifAutre})
	s.attend(statut, http.StatusUnprocessableEntity, "motif AUTRE sans précision", body)
	if body["code"] != "BANK_CASE_REJECTION_DETAIL_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.rejete, "expectedRev": rev, "rejectionReasonId": s.motifIncomplet})
	s.attend(statut, http.StatusCreated, "rejet motivé", body)
	// Zéro et non NULL : un rejet ne doit pas peser dans la somme encaissée.
	if montant := body["bankCase"].(map[string]any)["amountXof"]; montant != "0" {
		t.Fatalf("montant d'un rejet : %v", montant)
	}
}

func TestBanqueListeInterditeAuCommercial(t *testing.T) {
	s := nouveauBancBanque(t, "COMMERCIAL")
	s.connecte()
	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases", nil)
	s.attend(statut, http.StatusForbidden, "liste des dossiers pour un commercial", body)
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestBanqueDemandeApprouveeCreeLeProspect(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	region, departement, representant, syndicat := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	phone := fmt.Sprintf("+22177%07d", time.Now().UnixNano()%10_000_000)
	banqueExec(s.banc, `INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$2,$2,now())`, region, region[:8])
	banqueExec(s.banc, `INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$2,$2,$3,now())`, departement, departement[:8], region)
	banqueExec(s.banc, `INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
		VALUES ($1,'Représentant test',$2,$3,$4,now(),now())`, representant, "+2217"+representant[:8], departement, s.userID)
	banqueExec(s.banc, `INSERT INTO "syndicats" ("id","name","sigle","updatedAt") VALUES ($1,$2,$2,now())`, syndicat, syndicat[:8])
	// Le prospect né de l'approbation retient le représentant : il part d'abord,
	// avec la demande qui le référence.
	t.Cleanup(func() {
		banqueExec(s.banc, `DELETE FROM "client_creation_requests" WHERE "banqueId" = $1`, s.banqueID)
		banqueExec(s.banc, `DELETE FROM "prospects" WHERE "representantId" = $1`, representant)
		banqueExec(s.banc, `DELETE FROM "syndicats" WHERE "id" = $1`, syndicat)
		banqueExec(s.banc, `DELETE FROM "representants" WHERE "id" = $1`, representant)
		banqueExec(s.banc, `DELETE FROM "departements" WHERE "id" = $1`, departement)
		banqueExec(s.banc, `DELETE FROM "regions" WHERE "id" = $1`, region)
	})

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests", map[string]any{
		"nom": "Ndiaye", "prenom": "Awa", "phone": phone, "banqueId": s.banqueID,
	})
	s.attend(statut, http.StatusCreated, "dépôt de la demande", body)
	demande := body["id"].(string)
	if body["phoneE164"] != phone {
		t.Fatalf("le téléphone doit être normalisé avant tout contrôle : %v", body["phoneE164"])
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests/"+demande+"/approve",
		map[string]any{"representantId": representant, "syndicatId": syndicat})
	s.attend(statut, http.StatusOK, "approbation", body)
	prospect, ok := body["createdProspectId"].(string)
	if !ok || body["status"] != "APPROVED" {
		t.Fatalf("demande arbitrée : %v", body)
	}

	var origine, libelle string
	if err := s.pool.QueryRow(s.ctx, `SELECT "origin", "originLabel" FROM "prospects" WHERE "id" = $1`, prospect).Scan(&origine, &libelle); err != nil {
		t.Fatal(err)
	}
	if origine != "BANQUE" || libelle != "Banque Test "+s.banqueID[:8] {
		t.Fatalf("provenance du prospect créé : %s / %s", origine, libelle)
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests/"+demande+"/approve",
		map[string]any{"representantId": representant, "syndicatId": syndicat})
	s.attend(statut, http.StatusConflict, "seconde approbation", body)
	if body["code"] != "CLIENT_REQUEST_ALREADY_REVIEWED" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestBanqueCorrectionAdminAuditee(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	id, rev := s.ouvrirDossier()

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev, "amountXof": "800000"})
	s.attend(statut, http.StatusCreated, "encaissement depuis la première étape", body)
	rev++

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev})
	s.attend(statut, http.StatusConflict, "un dossier encaissé ne bouge plus sans correction", body)

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/corrections",
		map[string]any{"targetStageId": s.rejete, "expectedRev": rev, "rejectionReasonId": s.motifIncomplet, "reason": "Encaissement saisi par erreur"})
	s.attend(statut, http.StatusCreated, "correction administrateur", body)
	if montant := body["bankCase"].(map[string]any)["amountXof"]; montant != "0" {
		t.Fatalf("montant corrigé : %v", montant)
	}

	var traces int
	if err := s.pool.QueryRow(s.ctx, `SELECT count(*)::int FROM "audit_logs"
		WHERE "entity" = 'bank_case' AND "entityId" = $1 AND "action" = 'bank_case.correction'`, id).Scan(&traces); err != nil {
		t.Fatal(err)
	}
	if traces != 1 {
		t.Fatalf("une correction laisse une trace d'audit : %d", traces)
	}

	statut, body = banqueJSON(s.banc, http.MethodPatch, "/api/v1/bank-cases/"+id,
		map[string]any{"expectedRev": rev + 1, "processingBankId": s.banqueID})
	s.attend(statut, http.StatusConflict, "modification d'un dossier terminal", body)
	if body["code"] != "BANK_CASE_TERMINAL" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestBanqueEncaissementCorrigeCompteUneFoisParAgent(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	id, rev := s.ouvrirDossier()
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev, "amountXof": "800000"})
	s.attend(statut, http.StatusCreated, "premier encaissement", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/corrections",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev + 1, "reason": "Montant faux"})
	s.attend(statut, http.StatusCreated, "correction vers l'étude", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev + 2, "amountXof": "500000"})
	s.attend(statut, http.StatusCreated, "second encaissement", body)

	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/analytics?banqueId="+s.banqueID, nil)
	s.attend(statut, http.StatusOK, "indicateurs", body)
	agents, _ := body["byAgent"].([]any)
	for _, brut := range agents {
		agent := brut.(map[string]any)
		if agent["agentId"] == s.userID && (agent["cashed"] != float64(1) || agent["amountXof"] != "500000") {
			t.Fatalf("un encaissement corrigé compte une fois, au dernier montant : %v", agent)
		}
	}
	if len(agents) == 0 {
		t.Fatal("l'agent qui a encaissé doit figurer dans les indicateurs")
	}
}

// Des ouvertures simultanées d'une même inscription butent sur son unicité, pas sur la référence.
func TestBanqueOuverturesSimultaneesDUneInscription(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	var attente sync.WaitGroup
	depart := make(chan struct{})
	codes := make([]string, 8)
	statuts := make([]int, len(codes))
	for i := range codes {
		attente.Add(1)
		go func() {
			defer attente.Done()
			<-depart
			statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases", map[string]any{"inscriptionId": s.inscriptionID})
			statuts[i], codes[i] = statut, texteDe(body["code"])
		}()
	}
	close(depart)
	attente.Wait()
	ouverts := 0
	for i, statut := range statuts {
		switch {
		case statut == http.StatusCreated:
			ouverts++
		case statut != http.StatusConflict || codes[i] != "BANK_CASE_INSCRIPTION_ALREADY_OPEN":
			t.Fatalf("ouverture %d : %d %s, attendu 409 BANK_CASE_INSCRIPTION_ALREADY_OPEN", i, statut, codes[i])
		}
	}
	if ouverts != 1 {
		t.Fatalf("un seul dossier par inscription : %d ouverts", ouverts)
	}
}

func TestBanqueRechercheInsensibleAuxAccents(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	s.ouvrirDossier()

	for _, terme := range []string{"dietou", "Diétou", "amadou dietou"} {
		statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases?search="+url.QueryEscape(terme), nil)
		s.attend(statut, http.StatusOK, "recherche « "+terme+" »", body)
		if total := body["meta"].(map[string]any)["total"].(float64); total < 1 {
			t.Fatalf("« %s » ne retrouve pas « Amadou Diétou »", terme)
		}
	}

	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/prospect-search?search=Dietou", nil)
	s.attend(statut, http.StatusOK, "autocomplétion sans accent", body)
	if items := body["items"].([]any); len(items) == 0 {
		t.Fatal("l'autocomplétion doit trouver le prospect désaccentué")
	}
}

// La fiche d'une demande ne sort pas du portefeuille de l'agent qui l'a
// déposée : l'arbitre la lit, l'agent d'une autre banque ne la devine pas.
func TestBanqueDemandeLueDansSonPortefeuille(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	t.Cleanup(func() {
		banqueExec(s.banc, `DELETE FROM "client_creation_requests" WHERE "banqueId" = $1`, s.banqueID)
	})

	nouvelle := map[string]any{
		"nom": "Sow", "prenom": "Fatou", "banqueId": s.banqueID,
		"phone": fmt.Sprintf("77%07d", uuid.New().ID()%10000000),
	}
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests", nouvelle)
	s.attend(statut, http.StatusCreated, "dépôt de la demande", body)
	demande := body["id"].(string)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests", nouvelle)
	s.attend(statut, http.StatusConflict, "second dépôt par le même agent", body)
	if !strings.Contains(fmt.Sprint(body), demande) {
		t.Fatalf("le 409 rend au demandeur l'identifiant de sa demande : %v", body)
	}

	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/client-requests/"+demande, nil)
	s.attend(statut, http.StatusOK, "lecture de sa propre demande", body)
	if body["nom"] != "Sow" || body["status"] != "PENDING" ||
		body["banqueName"] != "Banque Test "+s.banqueID[:8] || body["requestedById"] != s.userID {
		t.Fatalf("la fiche lue porte la banque, le statut et le demandeur : %v", body)
	}
	if body["createdProspectId"] != nil || body["reviewedAt"] != nil || body["reviewedByName"] != nil {
		t.Fatalf("une demande en attente n'a pas d'arbitrage : %v", body)
	}

	autre := nouveauBanc(t, "BANQUE_FINANCE")
	statut, body = autre.connexion(autre.email, "motdepasse")
	autre.attend(statut, http.StatusOK, "connexion d'un autre agent bancaire", body)
	statut, body = banqueJSON(autre, http.MethodGet, "/api/v1/client-requests/"+demande, nil)
	autre.attend(statut, http.StatusNotFound, "demande déposée par une autre banque", body)
	if body["code"] != "CLIENT_REQUEST_NOT_FOUND" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = banqueJSON(autre, http.MethodPost, "/api/v1/client-requests", nouvelle)
	autre.attend(statut, http.StatusConflict, "même numéro déposé par une autre banque", body)
	if strings.Contains(fmt.Sprint(body), demande) {
		t.Fatalf("le 409 ne révèle pas la demande d'un autre portefeuille : %v", body)
	}

	arbitre := nouveauBanc(t, "ADMIN")
	statut, body = arbitre.connexion(arbitre.email, "motdepasse")
	arbitre.attend(statut, http.StatusOK, "connexion de l'arbitre", body)
	statut, body = banqueJSON(arbitre, http.MethodGet, "/api/v1/client-requests/"+demande, nil)
	arbitre.attend(statut, http.StatusOK, "l'arbitre lit toutes les demandes", body)
	if body["id"] != demande {
		t.Fatalf("fiche lue : %v", body)
	}
}

func banqueContientID(items any, id string) bool {
	liste, _ := items.([]any)
	for _, item := range liste {
		if ligne, ok := item.(map[string]any); ok && ligne["id"] == id {
			return true
		}
	}
	return false
}

func banqueCompter(s *socleBanque, requete string, args ...any) int {
	s.t.Helper()
	var n int
	if err := s.pool.QueryRow(s.ctx, requete, args...).Scan(&n); err != nil {
		s.t.Fatal(err)
	}
	return n
}

func TestBanqueSeulUnDossierValideAuxPiecesValidesEstProposeALOuverture(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	incompletes := []string{
		s.inscriptionDistante("CHUES", "compte-adhesion-released", `{}`),
		s.inscriptionDistante("CHUES", "needs_correction", `{}`),
		s.inscriptionDistante("CHUES", "dfc_review", `{}`),
		s.inscriptionDistante("GRAND_PUBLIC", "etape-1", `{"demande":{"soumise":true},"pieces":[{"statut":"accepte"},{"statut":"en-attente"}]}`),
		s.inscriptionDistante("GRAND_PUBLIC", "etape-1", `{"demande":{"soumise":true},"pieces":[]}`),
		s.inscriptionDistante("GRAND_PUBLIC", "etape-0", `{"demande":{"soumise":false},"pieces":[{"statut":"accepte"}]}`),
	}
	complete := s.inscriptionDistante("GRAND_PUBLIC", "etape-2", `{"demande":{"soumise":true},"pieces":[{"statut":"accepte"},{"statut":"accepte"}]}`)
	for _, projet := range []string{"CHUES", "GRAND_PUBLIC"} {
		statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/a-ouvrir?projet="+projet, nil)
		s.attend(statut, http.StatusOK, "inscriptions à ouvrir "+projet, body)
		for _, id := range incompletes {
			if banqueContientID(body["items"], id) {
				t.Fatalf("%s : un dossier non validé ou aux pièces non toutes valides est proposé : %s", projet, id)
			}
		}
		if projet == "GRAND_PUBLIC" && !banqueContientID(body["items"], complete) {
			t.Fatal("un dossier Grand Public aux pièces toutes acceptées doit être proposé")
		}
	}
}

func TestBanqueOuvertureDepuisInscriptionGenereLaReference(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/a-ouvrir?projet=CHUES", nil)
	s.attend(statut, http.StatusOK, "inscriptions à ouvrir", body)
	if !banqueContientID(body["items"], s.inscriptionID) {
		t.Fatalf("l'inscription validée doit être proposée à l'ouverture : %v", body["items"])
	}

	id, _ := s.ouvrirDossier()
	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/"+id, nil)
	s.attend(statut, http.StatusOK, "lecture du dossier", body)
	dossier := body["bankCase"].(map[string]any)
	if ref, _ := dossier["reference"].(string); !regexp.MustCompile(`^CHUES-BF-\d{4}-\d{6}$`).MatchString(ref) {
		t.Fatalf("référence générée attendue, %q reçue", ref)
	}
	if dossier["inscriptionId"] != s.inscriptionID || dossier["suiviParId"] != s.userID {
		t.Fatalf("lien inscription et téléconseiller : %v", dossier)
	}

	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/a-ouvrir?projet=CHUES", nil)
	s.attend(statut, http.StatusOK, "inscriptions à ouvrir après ouverture", body)
	if banqueContientID(body["items"], s.inscriptionID) {
		t.Fatal("une inscription déjà ouverte ne doit plus être proposée")
	}
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases", map[string]any{"inscriptionId": s.inscriptionID})
	s.attend(statut, http.StatusConflict, "second dossier sur la même inscription", body)
	if body["code"] != "BANK_CASE_INSCRIPTION_ALREADY_OPEN" {
		t.Fatalf("code : %v", body["code"])
	}
	// Les plateformes suivent seules leurs inscrits : le dossier s'ouvre sur
	// l'identité de l'inscription, sans fiche au CRM, la banque étant choisie.
	sansProspect := s.inscription(nil)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases",
		map[string]any{"inscriptionId": sansProspect, "processingBankId": s.banqueID})
	s.attend(statut, http.StatusCreated, "dossier ouvert sans fiche au CRM", body)
	if body["prospectId"] != nil {
		t.Fatalf("le dossier ne s’accroche à aucune fiche : %v", body)
	}
	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/"+texteDe(body["id"]), nil)
	s.attend(statut, http.StatusOK, "relecture du dossier sans fiche", body)
	statut, body = banqueJSON(s.banc, http.MethodPatch, "/api/v1/bank-cases/"+id,
		map[string]any{"expectedRev": 1, "reference": "DOS-SAISIE"})
	s.attend(statut, http.StatusUnprocessableEntity, "la référence ne se saisit plus", body)

	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/analytics?projet=CHUES", nil)
	s.attend(statut, http.StatusOK, "indicateurs", body)
	pilotage, _ := body["pilotage"].(map[string]any)
	if pilotage == nil || pilotage["entonnoir"] == nil || pilotage["overdueDays"].(float64) != 7 {
		t.Fatalf("pilotage : %v", body["pilotage"])
	}
}

// La plateforme envoie elle-même le courriel du dossier complet : ici, la
// notification in-app à la banque, une fois, et aucun courriel.
func TestBanqueDossierCompletSignaleSansCourriel(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()

	s.signalerComplets()
	s.signalerComplets()
	if n := banqueCompter(s, `SELECT count(*)::int FROM "inscriptions_plateforme" WHERE "id" = $1 AND "completeSignaleeLe" IS NOT NULL`, s.inscriptionID); n != 1 {
		t.Fatal("l'inscription complète doit être marquée signalée")
	}
	if n := banqueCompter(s, `SELECT count(*)::int FROM "courriels" WHERE "objetType" = 'inscription' AND "objetId" = $1`, s.inscriptionID); n != 0 {
		t.Fatalf("aucun courriel ne part du CRM pour un dossier complet, %d écrits", n)
	}
	if n := banqueCompter(s, `SELECT count(*)::int FROM "notification_deliveries" d INNER JOIN "notifications" n ON n."id" = d."notificationId"
		WHERE d."userId" = $1 AND n."category" = 'DOSSIER' AND n."route" LIKE '%ouvrir=' || $2`, s.userID, s.inscriptionID); n != 1 {
		t.Fatalf("la banque doit recevoir une notification in-app, %d livrées", n)
	}
}

// Les réglages par courriel : destinataires, copies et texte, avec l'aide qui
// nomme les variables et le texte d'origine.
func TestBanqueReglagesCourrielsParType(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	t.Cleanup(func() { banqueExec(s.banc, `DELETE FROM "app_settings" WHERE "key" = 'courriels.destinataires'`) })

	corps := map[string]any{
		"enrolement":   map[string]any{"destinataires": []string{"Enrolement@Test.cpi"}, "copies": []string{}, "intro": " Bonjour {client} "},
		"encaissement": map[string]any{"destinataires": []string{}, "copies": []string{"bpe@test.cpi"}, "intro": ""},
		"refus":        map[string]any{"destinataires": []string{}, "copies": []string{}, "intro": ""},
		"importLeads":  map[string]any{"destinataires": []string{}, "copies": []string{}, "intro": ""},
	}
	statut, body := banqueJSON(s.banc, http.MethodPut, "/api/v1/courriels/reglages", corps)
	s.attend(statut, http.StatusOK, "réglages écrits", body)
	enrolement := body["enrolement"].(map[string]any)
	if enrolement["destinataires"].([]any)[0] != "enrolement@test.cpi" || enrolement["intro"] != "Bonjour {client}" {
		t.Fatalf("adresses en minuscules et texte épuré : %v", enrolement)
	}
	aide := body["aide"].(map[string]any)["refus"].(map[string]any)
	if aide["introUsine"] == "" || len(aide["variables"].([]any)) == 0 {
		t.Fatalf("l'aide nomme le texte d'origine et les variables : %v", aide)
	}

	corps["refus"] = map[string]any{"destinataires": []string{"pas une adresse"}, "copies": []string{}, "intro": ""}
	statut, body = banqueJSON(s.banc, http.MethodPut, "/api/v1/courriels/reglages", corps)
	s.attend(statut, http.StatusUnprocessableEntity, "adresse invalide", body)
}

func (s *socleBanque) signalerComplets() {
	s.t.Helper()
	cfg, err := socle.LireConfig()
	if err != nil {
		s.t.Fatal(err)
	}
	if _, err := banque.SignalerDossiersComplets(s.ctx, nouveauDeps(s.pool, cfg, socle.NouvelAnnuaire(cfg.Base)), "CHUES"); err != nil {
		s.t.Fatal(err)
	}
}

func TestBanqueCourrielRenvoyeEtWebhookBrevo(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	courrielID := uuid.NewString()
	banqueExec(s.banc, `INSERT INTO "courriels" ("id","type","sujet","destinataires","copies","objetType","objetId","html","texte","statut","updatedAt")
		VALUES ($1,'DOSSIER_ENCAISSE','Dossier bancaire encaissé','{banque@test.cpi}','{}','inscription',$2,'<p>x</p>','x','ECHEC',now())`,
		courrielID, s.inscriptionID)
	t.Cleanup(func() { banqueExec(s.banc, `DELETE FROM "courriels" WHERE "id" = $1`, courrielID) })

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/courriels/"+courrielID+"/renvoyer", nil)
	s.attend(statut, http.StatusOK, "renvoi", body)
	if body["statut"] != "ECHEC" {
		t.Fatalf("renvoi sans transport : %v", body["statut"])
	}

	t.Setenv("BREVO_WEBHOOK_SECRET", "secret-de-test")
	messageID := "<" + uuid.NewString() + "@smtp-relay.mailin.fr>"
	banqueExec(s.banc, `UPDATE "courriels" SET "messageId" = $2, "statut" = 'ENVOYE' WHERE "id" = $1`, courrielID, messageID)
	evenement := map[string]any{"event": "delivered", "message-id": messageID}
	statut = s.appelSansOrigine(http.MethodPost, "/api/v1/webhooks/brevo?secret=faux", evenement)
	if statut != http.StatusNotFound {
		t.Fatalf("mauvais secret : %d", statut)
	}
	statut = s.appelSansOrigine(http.MethodPost, "/api/v1/webhooks/brevo?secret=secret-de-test", evenement)
	if statut != http.StatusNoContent && statut != http.StatusOK {
		t.Fatalf("webhook Brevo : %d", statut)
	}
	if n := banqueCompter(s, `SELECT count(*)::int FROM "courriels" WHERE "id" = $1 AND "statut" = 'REMIS' AND "remisLe" IS NOT NULL`, courrielID); n != 1 {
		t.Fatal("l'événement delivered doit marquer le courriel remis")
	}

	rebond := map[string]any{"event": "hard_bounce", "message-id": messageID}
	if statut = s.appelSansOrigine(http.MethodPost, "/api/v1/webhooks/brevo?secret=secret-de-test", rebond); statut/100 != 2 {
		t.Fatalf("webhook hard_bounce : %d", statut)
	}
	aRejouer, err := db.New(s.pool).CourrielsARejouer(s.ctx, db.CourrielsARejouerParams{TentativesMax: 3, Prendre: 100_000})
	if err != nil {
		t.Fatal(err)
	}
	for i := range aRejouer {
		if aRejouer[i].ID == courrielID {
			t.Fatal("un rebond définitif ne se rejoue pas")
		}
	}
}

func (s *socleBanque) appelSansOrigine(method, chemin string, corps map[string]any) int {
	s.t.Helper()
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(corps); err != nil {
		s.t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(s.ctx, method, s.ts.URL+chemin, &buf)
	if err != nil {
		s.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		s.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode
}

func TestBanqueEncaissementSignaleLeTeleconseiller(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	id, rev := s.ouvrirDossier()
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev})
	s.attend(statut, http.StatusCreated, "prise en traitement", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev + 1, "amountXof": "500000"})
	s.attend(statut, http.StatusCreated, "encaissement", body)

	if n := banqueCompter(s, `SELECT count(*)::int FROM "courriels" WHERE "type" = 'DOSSIER_ENCAISSE' AND "objetId" = $1`, id); n != 1 {
		t.Fatalf("un courriel d'encaissement tracé, %d trouvés", n)
	}
	if n := banqueCompter(s, `SELECT count(*)::int FROM "notification_deliveries" d INNER JOIN "notifications" n ON n."id" = d."notificationId"
		WHERE d."userId" = $1 AND n."title" LIKE 'Dossier bancaire encaissé%'`, s.userID); n != 1 {
		t.Fatalf("le téléconseiller doit être notifié de l'encaissement, %d livraisons", n)
	}

	sansFiche := s.inscriptionDistante("GRAND_PUBLIC", "etape-2", `{"demande":{"soumise":true},"pieces":[{"statut":"accepte"}]}`)
	banqueExec(s.banc, `UPDATE "inscriptions_plateforme" SET "phoneE164" = $2 WHERE "id" = $1`, sansFiche, "+2217"+sansFiche[:8])
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases",
		map[string]any{"inscriptionId": sansFiche, "processingBankId": s.banqueID})
	s.attend(statut, http.StatusCreated, "dossier Grand Public sans fiche au CRM", body)
	idSansFiche, revSansFiche := texteDe(body["id"]), body["rev"].(float64)
	statut, body = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/"+idSansFiche+"?projet=GRAND_PUBLIC", nil)
	s.attend(statut, http.StatusOK, "dossier sans fiche lu depuis Grand Public", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+idSansFiche+"/transitions",
		map[string]any{"targetStageId": s.etude, "expectedRev": revSansFiche})
	s.attend(statut, http.StatusCreated, "prise en traitement sans fiche", body)
	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+idSansFiche+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": revSansFiche + 1, "amountXof": "250000"})
	s.attend(statut, http.StatusCreated, "encaissement sans fiche", body)
	if n := banqueCompter(s, `SELECT count(*)::int FROM "courriels" WHERE "type" = 'DOSSIER_ENCAISSE' AND "objetId" = $1
		AND "sujet" LIKE '[CPI GRAND PUBLIC]%'`, idSansFiche); n != 1 {
		t.Fatalf("un dossier sans fiche au CRM doit tracer son courriel Grand Public, %d trouvés", n)
	}

	var reference string
	if err := s.pool.QueryRow(s.ctx, `SELECT "reference" FROM "bank_cases" WHERE "id" = $1`, idSansFiche).Scan(&reference); err != nil {
		t.Fatal(err)
	}
	statut, _, classeur := s.classeur("/api/v1/export/bank-cases.xlsx?projet=GRAND_PUBLIC&banqueId=" + s.banqueID)
	s.attend(statut, http.StatusOK, "export Grand Public des dossiers", nil)
	lignes, err := classeur.GetRows("Dossiers")
	if err != nil {
		t.Fatal(err)
	}
	if len(lignes) != 2 || lignes[1][0] != reference {
		t.Fatalf("l'export Grand Public doit compter le dossier sans fiche %s : %v", reference, lignes)
	}
}

// La liste « à ouvrir » et l'ouverture partagent le même prédicat : une inscription
// Grand Public proposée s'ouvre.
func TestBanqueInscriptionProposeeEstOuvrable(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	inscription := s.inscriptionDistante("GRAND_PUBLIC", "etape-2",
		`{"demande":{"soumise":true},"pieces":[{"statut":"accepte"},{"statut":"accepte"}]}`)
	banqueExec(s.banc, `UPDATE "inscriptions_plateforme" SET "phoneE164" = $2 WHERE "id" = $1`, inscription, "+2217"+inscription[:8])

	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/a-ouvrir?projet=GRAND_PUBLIC", nil)
	s.attend(statut, http.StatusOK, "inscriptions à ouvrir", body)
	if !banqueContientID(body["items"], inscription) {
		t.Fatalf("une inscription Grand Public aux pièces acceptées doit être proposée : %v", body["items"])
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases",
		map[string]any{"inscriptionId": inscription, "processingBankId": s.banqueID})
	s.attend(statut, http.StatusCreated, "ouverture d’une inscription proposée à l’ouverture", body)
}

// Vider le miroir des inscriptions garde le lien d'un dossier, et supprimer une
// inscription liée est refusé plutôt que de remettre `inscriptionId` à NULL.
func TestEnrolementPurgeGardeLeDossier(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	id, _ := s.ouvrirDossier()

	statut, body := banqueJSON(s.banc, http.MethodDelete, "/api/v1/enrolement/CHUES/inscriptions", nil)
	s.attend(statut, http.StatusOK, "purge du miroir CHUES", body)

	var inscriptionEncore string
	if err := s.pool.QueryRow(s.ctx, `SELECT "inscriptionId" FROM "bank_cases" WHERE "id" = $1`, id).Scan(&inscriptionEncore); err != nil {
		t.Fatal(err)
	}
	if inscriptionEncore != s.inscriptionID {
		t.Fatalf("la purge a détaché le dossier de son inscription : %q reçu, %q attendu", inscriptionEncore, s.inscriptionID)
	}

	statut, body = banqueJSON(s.banc, http.MethodDelete, "/api/v1/enrolement/CHUES/inscriptions/"+s.inscriptionID, nil)
	s.attend(statut, http.StatusConflict, "suppression unitaire d’une inscription liée à un dossier", body)
	if body["code"] != "INSCRIPTION_LIEE_A_UN_DOSSIER" {
		t.Fatalf("code : %v", body["code"])
	}
}

// Un motif de trois espaces passe le schéma mais, nettoyé, ne dit rien : la
// correction le refuse.
func TestBanqueMotifVideRefuse(t *testing.T) {
	s := nouveauBancBanque(t, "ADMIN")
	s.connecte()
	id, rev := s.ouvrirDossier()

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/corrections",
		map[string]any{"targetStageId": s.etude, "expectedRev": rev, "reason": "   "})
	s.attend(statut, http.StatusUnprocessableEntity, "correction au motif rempli d’espaces", body)
	if body["code"] != "BANK_REASON_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}

	var transitions int
	if err := s.pool.QueryRow(s.ctx, `SELECT count(*)::int FROM "bank_case_transitions" WHERE "caseId" = $1`, id).Scan(&transitions); err != nil {
		t.Fatal(err)
	}
	if transitions != 1 {
		t.Fatalf("un motif refusé ne doit rien écrire au-delà de la transition d’ouverture : %d transitions", transitions)
	}
}

func TestBanqueInscriptionsAOuvrirSignalentLeurPlafond(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	banqueExec(s.banc, `INSERT INTO "inscriptions_plateforme"
		("id","projet","identifiantDistant","nom","prenom","statutDistant","decideeLe","chargeUtile","dernierTirageAt","updatedAt")
		SELECT gen_random_uuid()::text,'CHUES','test-' || $1 || '-' || n,'Sy','Awa','validated',now(),'{}',now(),now()
		FROM generate_series(1, 2001) n`, s.banqueID)
	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-cases/a-ouvrir?projet=CHUES", nil)
	s.attend(statut, http.StatusOK, "inscriptions à ouvrir", body)
	if items, _ := body["items"].([]any); len(items) != 2000 || body["truncated"] != true {
		t.Fatalf("2000 inscriptions et le plafond signalé attendus : %d, truncated=%v", len(items), body["truncated"])
	}
}

// Plateforme locale : l'archive CHUES est relue à chaque pièce, une pièce Grand Public
// sans Content-Length au-delà du plafond est refusée plutôt que servie tronquée.
func TestBanquePiecesDUnePlateformeLocale(t *testing.T) {
	var archives atomic.Int32
	var zippee bytes.Buffer
	zipper := zip.NewWriter(&zippee)
	fichier, _ := zipper.Create("cni.pdf")
	_, _ = fichier.Write([]byte("%PDF-1.4 cni"))
	_ = zipper.Close()
	var plateforme *httptest.Server
	plateforme = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/dossiers/42/archive":
			archives.Add(1)
			_, _ = w.Write(zippee.Bytes())
		case strings.HasSuffix(r.URL.Path, "/docs"):
			_, _ = fmt.Fprintf(w, `{"data":[{"docId":"lourde","label":"Lourde","status":"accepte","fileUrl":%q}]}`, plateforme.URL+"/fichiers/lourde?signature=secrete")
		case r.URL.Path == "/fichiers/lourde":
			bloc := make([]byte, 1<<20)
			for range 65 {
				_, _ = w.Write(bloc)
			}
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(plateforme.Close)
	for _, projet := range []string{"CHUES", "GRAND_PUBLIC"} {
		t.Setenv("PLATEFORME_"+projet+"_URL", plateforme.URL)
		t.Setenv("PLATEFORME_"+projet+"_TOKEN", "jeton-de-test")
	}
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	chues := s.inscriptionDistante("CHUES", "validated", `{"dossier":{"id":42}}`)

	statut, body := banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-inscriptions/"+chues+"/pieces", nil)
	s.attend(statut, http.StatusOK, "pièces CHUES d'une plateforme locale", body)
	for range 2 {
		statut, _ = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-inscriptions/"+chues+"/piece?code=cni.pdf", nil)
		s.attend(statut, http.StatusOK, "pièce CHUES", nil)
	}
	statut, _ = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-inscriptions/"+chues+"/pieces.zip", nil)
	s.attend(statut, http.StatusOK, "archive CHUES relayée", nil)
	if n := archives.Load(); n != 4 {
		t.Fatalf("l'archive se relit à chaque appel, sans cache : %d lectures au lieu de 4", n)
	}

	grandPublic := s.inscriptionDistante("GRAND_PUBLIC", "etape-2", `{}`)
	statut, _ = banqueJSON(s.banc, http.MethodGet, "/api/v1/bank-inscriptions/"+grandPublic+"/piece?code=lourde", nil)
	s.attend(statut, http.StatusNotFound, "pièce de plus de 64 Mo sans Content-Length", nil)
}
