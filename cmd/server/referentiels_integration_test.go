//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func (b *banc) referentielsEnvoi(method, chemin string, corps map[string]any) (statut int, reponse map[string]any) {
	b.t.Helper()
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(corps); err != nil {
		b.t.Fatal(err)
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

func (b *banc) referentielsLecture(chemin string) {
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
	if resp.StatusCode != http.StatusOK {
		b.t.Fatalf("GET %s : %d", chemin, resp.StatusCode)
	}
	var items []any
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		b.t.Fatal(err)
	}
	if items == nil {
		b.t.Fatalf("GET %s : tableau attendu", chemin)
	}
}

func (b *banc) referentielsPurge(table, id string) {
	b.t.Helper()
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "`+table+`" WHERE "id" = $1`, id)
	})
}

func (b *banc) referentielsJeton() string {
	b.t.Helper()
	return "T" + strings.ToUpper(uuid.NewString()[:8])
}

func (b *banc) referentielsConnexion(role string) {
	b.t.Helper()
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion "+role, body)
}

func TestReferentielsCodeDupliqueRefuse(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	code := "PROF_" + b.referentielsJeton()

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/professions",
		map[string]any{"code": code, "label": "Profession " + code})
	b.attend(statut, http.StatusCreated, "création", body)
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatalf("identifiant absent : %v", body)
	}
	b.referentielsPurge("professions", id)

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/professions",
		map[string]any{"code": code, "label": "Autre " + code})
	b.attend(statut, http.StatusConflict, "code dupliqué", body)
	if body["code"] != "UNIQUE_CONSTRAINT_VIOLATION" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}
}

func TestReferentielsKindInconnuEtEcritureSurListeLue(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/inconnu", map[string]any{"code": "X"})
	b.attend(statut, http.StatusNotFound, "kind inconnu", body)

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/pays",
		map[string]any{"code": "ZZ", "label": "Nulle part"})
	b.attend(statut, http.StatusNotFound, "écriture sur une liste en lecture seule", body)

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/banques",
		map[string]any{"name": "Banque " + b.referentielsJeton(), "shortName": "BQ", "sigle": "SYN"})
	b.attend(statut, http.StatusUnprocessableEntity, "champ étranger à la liste", body)
}

func TestReferentielsCommercialLitMaisNEcritPas(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	b.referentielsConnexion("COMMERCIAL")

	b.referentielsLecture("/api/v1/referentiels/banques")

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/banques",
		map[string]any{"name": "Banque " + b.referentielsJeton(), "shortName": "BQ"})
	b.attend(statut, http.StatusForbidden, "écriture refusée au COMMERCIAL", body)

	statut, body = b.referentielsEnvoi(http.MethodGet, "/api/v1/referentiels/bank-rejection-reasons", nil)
	b.attend(statut, http.StatusForbidden, "motifs de rejet réservés à Banque & Finance", body)
}

func TestReferentielsColonnesPropresPersistees(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	code := "TRANCHE_" + b.referentielsJeton()

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/income-bands",
		map[string]any{"code": code, "label": "Tranche " + code, "minXof": 150000, "maxXof": 300000})
	b.attend(statut, http.StatusCreated, "création", body)
	id, _ := body["id"].(string)
	b.referentielsPurge("income_bands", id)
	if body["minXof"] != float64(150000) || body["maxXof"] != float64(300000) {
		t.Fatalf("bornes non renvoyées : %v", body)
	}

	var minXof int32
	if err := b.pool.QueryRow(b.ctx, `SELECT "minXof" FROM "income_bands" WHERE "id" = $1`, id).Scan(&minXof); err != nil {
		t.Fatal(err)
	}
	if minXof != 150000 {
		t.Fatalf("minXof en base : %d", minXof)
	}

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/referentiels/income-bands/"+id,
		map[string]any{"minXof": 200000})
	b.attend(statut, http.StatusOK, "modification", body)
	if body["minXof"] != float64(200000) || body["label"] != "Tranche "+code {
		t.Fatalf("le patch partiel a écrasé le reste : %v", body)
	}
}

func TestReferentielsAliasFrancaisDuPanneauV1(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")

	b.referentielsLecture("/api/v1/referentiels/tranches-revenu")
	b.referentielsLecture("/api/v1/referentiels/offres")

	code := "OFFRE_" + b.referentielsJeton()
	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/offres",
		map[string]any{"code": code, "label": "Offre " + code})
	b.attend(statut, http.StatusCreated, "création par l'alias", body)
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatalf("identifiant absent : %v", body)
	}
	b.referentielsPurge("offers", id)

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/referentiels/offres/"+id,
		map[string]any{"label": "Offre révisée " + code})
	b.attend(statut, http.StatusOK, "modification par l'alias", body)
	if body["label"] != "Offre révisée "+code {
		t.Fatalf("la modification n'a pas porté sur la table offers : %v", body)
	}
}

func TestReferentielsBundleSertLesNeufListes(t *testing.T) {
	b := nouveauBanc(t, "CHARGE_CLIENTELE")
	b.referentielsConnexion("CHARGE_CLIENTELE")

	req, err := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+"/api/v1/referentiels?activeOnly=false", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("bundle : %d", resp.StatusCode)
	}
	var bundle map[string][]map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&bundle); err != nil {
		t.Fatal(err)
	}
	for _, cle := range []string{"banques", "syndicats", "departements", "regions", "professions", "incomeBands", "offers", "employeurs", "pays"} {
		if _, ok := bundle[cle]; !ok {
			t.Fatalf("liste %q absente du bundle", cle)
		}
	}
	for _, dept := range bundle["departements"] {
		if dept["regionName"] == nil || dept["regionName"] == "" {
			t.Fatalf("département sans nom de région : %v", dept)
		}
	}
}

func TestReferentielsVisiteSystemeNonDesactivable(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	id, code := uuid.NewString(), "OBJ_"+b.referentielsJeton()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "visite_objets" ("id","code","label","isSystem") VALUES ($1,$2,$3,true)`,
		id, code, "Objet "+code); err != nil {
		t.Fatal(err)
	}
	b.referentielsPurge("visite_objets", id)

	statut, body := b.referentielsEnvoi(http.MethodPatch, "/api/v1/referentiels/visite-objets/"+id,
		map[string]any{"isActive": false})
	b.attend(statut, http.StatusConflict, "désactivation d'une entrée système", body)
	if body["code"] != "VISITE_REFERENTIEL_SYSTEM_IMMUTABLE" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/referentiels/visite-objets/"+id,
		map[string]any{"code": "AUTRE_CODE"})
	b.attend(statut, http.StatusUnprocessableEntity, "code figé", body)

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/referentiels/visite-objets/"+id,
		map[string]any{"label": "Objet renommé " + code})
	b.attend(statut, http.StatusOK, "renommage d'une entrée système", body)
}

func TestReferentielsVisiteFermeeAuSuperviseur(t *testing.T) {
	b := nouveauBanc(t, "SUPERVISEUR")
	b.referentielsConnexion("SUPERVISEUR")

	b.referentielsLecture("/api/v1/referentiels/visite-objets")

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/referentiels/visite-objets",
		map[string]any{"code": "OBJ_" + b.referentielsJeton(), "label": "Objet interdit"})
	b.attend(statut, http.StatusForbidden, "les listes de visite restent à ADMIN et DIRECTION", body)
}

func TestReferentielsStatutCodeDeduitDuLibelle(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	jeton := b.referentielsJeton()

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Rappel prévu " + jeton, "effect": "SCHEDULE_CALLBACK", "requiresCallback": true})
	b.attend(statut, http.StatusCreated, "création", body)
	id, _ := body["id"].(string)
	b.referentielsPurge("statuts_qualification", id)
	if body["code"] != "RAPPEL_PREVU_"+jeton {
		t.Fatalf("code déduit du libellé : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Rappel prevu " + jeton, "effect": "REACHED"})
	b.attend(statut, http.StatusConflict, "même code aux accents près", body)
	if body["code"] != "STATUT_QUALIFICATION_CODE_CONFLICT" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Refus net " + jeton, "effect": "REFUSED", "requiresCallback": true})
	b.attend(statut, http.StatusConflict, "rappel exigé hors SCHEDULE_CALLBACK", body)
	if body["code"] != "STATUT_QUALIFICATION_CALLBACK_NOT_ALLOWED" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}
}

func TestReferentielsSousStatutHeriteEffetEtResteAUnNiveau(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	jeton := b.referentielsJeton()

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Parent " + jeton, "effect": "REFUSED"})
	b.attend(statut, http.StatusCreated, "création du parent", body)
	parent, _ := body["id"].(string)
	b.referentielsPurge("statuts_qualification", parent)

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Enfant " + jeton, "parentId": parent})
	b.attend(statut, http.StatusCreated, "création du sous-statut", body)
	enfant, _ := body["id"].(string)
	b.referentielsPurge("statuts_qualification", enfant)
	if body["effect"] != "REFUSED" || body["parentId"] != parent {
		t.Fatalf("effet hérité et parent posé : %v", body)
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Petit enfant " + jeton, "parentId": enfant})
	b.attend(statut, http.StatusConflict, "sous-statut d'un sous-statut", body)
	if body["code"] != "STATUT_QUALIFICATION_PARENT_TOO_DEEP" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/statuts-qualification",
		map[string]any{"label": "Sans effet " + jeton})
	b.attend(statut, http.StatusBadRequest, "premier niveau sans effet", body)
	if body["code"] != "STATUT_QUALIFICATION_EFFECT_REQUIRED" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}
}

func TestReferentielsMotifSystemeNiDesactivableNiReconfigurable(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	id, code := uuid.NewString(), "MOTIF_"+b.referentielsJeton()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "call_outcome_reasons" ("id","code","label","effect","isSystem") VALUES ($1,$2,$3,'KEEP_OPEN',true)`,
		id, code, "Motif "+code); err != nil {
		t.Fatal(err)
	}
	b.referentielsPurge("call_outcome_reasons", id)

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/call-outcome-reasons/"+id+"/active",
		map[string]any{"isActive": false})
	b.attend(statut, http.StatusConflict, "désactivation d'un motif système", body)
	if body["code"] != "OUTCOME_REASON_SYSTEM_IMMUTABLE" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/call-outcome-reasons/"+id,
		map[string]any{"requiresComment": true})
	b.attend(statut, http.StatusConflict, "règle d'un motif système", body)

	statut, body = b.referentielsEnvoi(http.MethodPatch, "/api/v1/call-outcome-reasons/"+id,
		map[string]any{"label": "Motif renommé " + code})
	b.attend(statut, http.StatusOK, "renommage d'un motif système", body)
}

func TestReferentielsPrecisionDeMotifHeriteEffetEtResteAUnNiveau(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.referentielsConnexion("ADMIN")
	jeton := b.referentielsJeton()

	statut, body := b.referentielsEnvoi(http.MethodPost, "/api/v1/call-outcome-reasons",
		map[string]any{"code": "PARENT_" + jeton, "label": "Parent " + jeton, "effect": "CLOSE_LOST"})
	b.attend(statut, http.StatusCreated, "création du motif parent", body)
	parent, _ := body["id"].(string)
	b.referentielsPurge("call_outcome_reasons", parent)

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/call-outcome-reasons",
		map[string]any{"code": "ENFANT_" + jeton, "label": "Enfant " + jeton, "parentId": parent})
	b.attend(statut, http.StatusCreated, "création de la précision", body)
	enfant, _ := body["id"].(string)
	b.referentielsPurge("call_outcome_reasons", enfant)
	if body["effect"] != "CLOSE_LOST" || body["parentId"] != parent {
		t.Fatalf("effet hérité et parent posé : %v", body)
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/call-outcome-reasons",
		map[string]any{"code": "PETIT_" + jeton, "label": "Petit enfant " + jeton, "parentId": enfant})
	b.attend(statut, http.StatusConflict, "précision d'une précision", body)
	if body["code"] != "OUTCOME_REASON_PARENT_TOO_DEEP" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}

	statut, body = b.referentielsEnvoi(http.MethodPost, "/api/v1/call-outcome-reasons",
		map[string]any{"code": "SEUL_" + jeton, "label": "Sans effet " + jeton})
	b.attend(statut, http.StatusBadRequest, "premier niveau sans effet", body)
	if body["code"] != "OUTCOME_REASON_EFFECT_REQUIRED" {
		t.Fatalf("code d'erreur : %v", body["code"])
	}
}
