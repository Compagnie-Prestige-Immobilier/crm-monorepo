//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"

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

// Les index partiels du schéma n'admettent qu'une seule étape initiale, une
// seule CASHED et une seule REJECTED dans TOUTE la base : le seed v2 les porte
// déjà, on les emprunte et on ne crée que ce qui manque.
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

	t.Cleanup(func() {
		menage := []struct {
			sql  string
			args []any
		}{
			{`DELETE FROM "bank_cases" WHERE "processingBankId" = $1`, []any{s.banqueID}},
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

func (s *socleBanque) ouvrirDossier(reference string) (id string, rev float64) {
	s.t.Helper()
	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases",
		map[string]any{"prospectId": s.prospectID, "reference": reference})
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
	id, rev := s.ouvrirDossier("DOS-" + uuid.NewString()[:8])

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

func TestBanqueRejetExigeUnMotif(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	id, rev := s.ouvrirDossier("DOS-" + uuid.NewString()[:8])

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
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
		"nom": "Ndiaye", "prenom": "Awa", "phone": "77 123 45 67", "banqueId": s.banqueID,
	})
	s.attend(statut, http.StatusCreated, "dépôt de la demande", body)
	demande := body["id"].(string)
	if body["phoneE164"] != "+221771234567" {
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
	id, rev := s.ouvrirDossier("DOS-" + uuid.NewString()[:8])

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/transitions",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev, "amountXof": "800000"})
	s.attend(statut, http.StatusUnprocessableEntity, "encaissement depuis la première étape", body)
	if body["code"] != "BANK_STAGE_CASHED_NOT_LAST" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = banqueJSON(s.banc, http.MethodPost, "/api/v1/bank-cases/"+id+"/corrections",
		map[string]any{"targetStageId": s.encaisse, "expectedRev": rev, "amountXof": "800000", "reason": "Encaissement constaté hors flux"})
	s.attend(statut, http.StatusCreated, "correction administrateur", body)
	if montant := body["bankCase"].(map[string]any)["amountXof"]; montant != "800000" {
		t.Fatalf("montant corrigé : %v", montant)
	}

	var traces int
	if err := s.pool.QueryRow(s.ctx, `SELECT count(*)::int FROM "audit_logs" WHERE "entity" = 'bank_case' AND "entityId" = $1`, id).Scan(&traces); err != nil {
		t.Fatal(err)
	}
	if traces != 1 {
		t.Fatalf("une correction laisse une trace d'audit : %d", traces)
	}

	statut, body = banqueJSON(s.banc, http.MethodPatch, "/api/v1/bank-cases/"+id,
		map[string]any{"expectedRev": rev + 1, "reference": "DOS-AUTRE"})
	s.attend(statut, http.StatusConflict, "modification d'un dossier terminal", body)
	if body["code"] != "BANK_CASE_TERMINAL" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestBanqueRechercheInsensibleAuxAccents(t *testing.T) {
	s := nouveauBancBanque(t, "BANQUE_FINANCE")
	s.connecte()
	reference := "DOS-" + uuid.NewString()[:8]
	s.ouvrirDossier(reference)

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

	statut, body := banqueJSON(s.banc, http.MethodPost, "/api/v1/client-requests", map[string]any{
		"nom": "Sow", "prenom": "Fatou", "banqueId": s.banqueID,
		"phone": fmt.Sprintf("77%07d", uuid.New().ID()%10000000),
	})
	s.attend(statut, http.StatusCreated, "dépôt de la demande", body)
	demande := body["id"].(string)

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

	arbitre := nouveauBanc(t, "ADMIN")
	statut, body = arbitre.connexion(arbitre.email, "motdepasse")
	arbitre.attend(statut, http.StatusOK, "connexion de l'arbitre", body)
	statut, body = banqueJSON(arbitre, http.MethodGet, "/api/v1/client-requests/"+demande, nil)
	arbitre.attend(statut, http.StatusOK, "l'arbitre lit toutes les demandes", body)
	if body["id"] != demande {
		t.Fatalf("fiche lue : %v", body)
	}
}
