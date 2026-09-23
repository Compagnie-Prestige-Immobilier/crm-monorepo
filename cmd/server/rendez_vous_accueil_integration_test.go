//go:build integration

package main

import (
	"net/http"
	"slices"
	"testing"
	"time"
)

func contientFiche(body map[string]any, fiche string) bool {
	items, _ := body["items"].([]any)
	return slices.ContainsFunc(items, func(item any) bool {
		ligne, _ := item.(map[string]any)
		return ligne["id"] == fiche
	})
}

// Deux rendez-vous posés par un téléconseiller, un par type, pour demain.
func rendezVousPoses(t *testing.T) (teleconseiller *banc, fiches map[string]string) {
	t.Helper()
	t.Setenv("BETA_SUIVI_RENDEZ_VOUS", "true")
	teleconseiller = qualificationConnecte(t, "COMMERCIAL")
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	fiches = map[string]string{}
	for _, motif := range []string{"RV_CPI", "RV_SITE"} {
		fiche := qualificationProspect(teleconseiller)
		fiches[motif] = fiche
		t.Cleanup(func() {
			_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
			_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
			_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
		})
		statut, body := qualificationEnvoi(teleconseiller, http.MethodPost, "/api/v1/phase2/call-attempts",
			qualificationCorpsTentative(fiche, map[string]any{"reasonCode": motif, "callbackAt": quand}))
		teleconseiller.attend(statut, http.StatusOK, motif+" consigné", body)
	}
	return teleconseiller, fiches
}

const listeRendezVous = "/api/v1/rendez-vous?pageSize=200"

// Le comptoir trie les rendez-vous par type : il reçoit ceux qui viennent à
// l'agence, pas ceux qui se tiennent ailleurs.
func TestRendezVousFiltresParType(t *testing.T) {
	teleconseiller, fiches := rendezVousPoses(t)

	// Sans la permission, le comptoir ne lit rien : le téléconseiller la teste
	// pour tout le monde, lui qui vit pourtant dans les fiches.
	statut, body := qualificationEnvoi(teleconseiller, http.MethodGet, "/api/v1/rendez-vous", nil)
	teleconseiller.attend(statut, http.StatusForbidden, "lecture sans la permission", body)

	accueil := qualificationConnecte(t, "ACCUEIL")
	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&type=RV_CPI", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous filtrés sur RV CPI", body)
	if !contientFiche(body, fiches["RV_CPI"]) || contientFiche(body, fiches["RV_SITE"]) {
		t.Fatalf("le filtre RV CPI ne garde pas la bonne fiche : %v", body["meta"])
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&type=RV_SITE", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous filtrés sur RV site", body)
	if !contientFiche(body, fiches["RV_SITE"]) || contientFiche(body, fiches["RV_CPI"]) {
		t.Fatalf("le filtre RV site ne garde pas la bonne fiche : %v", body["meta"])
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous, nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous sans filtre", body)
	if !contientFiche(body, fiches["RV_CPI"]) || !contientFiche(body, fiches["RV_SITE"]) {
		t.Fatal("sans filtre, les deux types de rendez-vous manquent")
	}
}

// La venue notée au comptoir sépare les filtres, et le classeur les emporte.
func TestRendezVousVenuesEtClasseur(t *testing.T) {
	teleconseiller, fiches := rendezVousPoses(t)
	accueil := qualificationConnecte(t, "ACCUEIL")

	statut, body := qualificationEnvoi(accueil, http.MethodPost,
		"/api/v1/prospects/"+fiches["RV_CPI"]+"/suivi-rendez-vous", map[string]any{"issue": "HONORE", "suiteRencontre": "CHAUD"})
	accueil.attend(statut, http.StatusOK, "le comptoir confirme la venue", body)

	// La venue notée, les deux filtres se séparent.
	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&issue=HONORE", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous honorés", body)
	if !contientFiche(body, fiches["RV_CPI"]) || contientFiche(body, fiches["RV_SITE"]) {
		t.Fatal("le filtre des venues ne sépare pas les fiches confirmées")
	}
	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&issue=SANS", nil)
	accueil.attend(statut, http.StatusOK, "venue pas encore notée", body)
	if contientFiche(body, fiches["RV_CPI"]) || !contientFiche(body, fiches["RV_SITE"]) {
		t.Fatal("le filtre « à confirmer » garde une fiche déjà confirmée")
	}

	// Le lendemain du rendez-vous ne le contient plus.
	jour := time.Now().Add(24 * time.Hour)
	statut, body = qualificationEnvoi(accueil, http.MethodGet,
		listeRendezVous+"&du="+jour.Format("2006-01-02")+"&au="+jour.Format("2006-01-02"), nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous du jour", body)
	if !contientFiche(body, fiches["RV_CPI"]) {
		t.Fatal("le rendez-vous de demain manque à la journée de demain")
	}
	apres := jour.Add(48 * time.Hour).Format("2006-01-02")
	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&du="+apres+"&au="+apres, nil)
	accueil.attend(statut, http.StatusOK, "journée sans rendez-vous", body)
	if contientFiche(body, fiches["RV_CPI"]) {
		t.Fatal("un rendez-vous ressort d'une journée qui n'est pas la sienne")
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, "/api/v1/export/rendez-vous.xlsx", nil)
	accueil.attend(statut, http.StatusOK, "classeur des rendez-vous", body)
	statut, body = qualificationEnvoi(teleconseiller, http.MethodGet, "/api/v1/export/rendez-vous.xlsx", nil)
	teleconseiller.attend(statut, http.StatusForbidden, "classeur sans la permission", body)
}
