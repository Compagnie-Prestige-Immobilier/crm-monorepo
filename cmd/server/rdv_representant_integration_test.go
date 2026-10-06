//go:build integration

package main

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func rdvRepresentantAppel(b *banc, rep, statut string, rendezVous map[string]any) (code int, body map[string]any) {
	b.t.Helper()
	return qualificationEnvoi(b, http.MethodPost, "/api/v1/rep-campaigns/attempts", map[string]any{
		"id": uuid.Must(uuid.NewV7()).String(), "representantId": rep,
		"statutQualificationId": qualificationStatutID(b, statut),
		"clientCreatedAt":       time.Now().UTC().Format(time.RFC3339Nano), "rendezVous": rendezVous,
	})
}

func TestRendezVousPrisAuScriptRepresentant(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	rep := qualificationRepresentant(b)
	var telephone string
	if err := b.pool.QueryRow(b.ctx, `SELECT "phoneE164" FROM "representants" WHERE "id" = $1`, rep).Scan(&telephone); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		fiches := `SELECT "id" FROM "prospects" WHERE "phoneE164" = $1`
		for _, table := range []string{"call_attempts", "scheduled_callbacks", "prospect_journeys"} {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "`+table+`" WHERE "prospectId" IN (`+fiches+`)`, telephone)
		}
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" IN (`+fiches+`)`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "rep_call_attempts" WHERE "representantId" = $1`, rep)
	})
	demain := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)

	statut, body := rdvRepresentantAppel(b, rep, "ACCEPTE", map[string]any{"reasonCode": "CALLBACK", "rendezVousAt": demain})
	b.attend(statut, http.StatusBadRequest, "un rappel n'est pas un rendez-vous", body)
	statut, body = rdvRepresentantAppel(b, rep, "PAS_DE_REPONSE", map[string]any{"reasonCode": "RV_CPI", "rendezVousAt": demain})
	b.attend(statut, http.StatusBadRequest, "pas de rendez-vous sans personne jointe", body)
	if n := qualificationCompte(b, `SELECT count(*) FROM "prospects" WHERE "phoneE164" = $1`, telephone); n != 0 {
		t.Fatalf("un refus n'ouvre aucune fiche : %d", n)
	}

	statut, body = rdvRepresentantAppel(b, rep, "ACCEPTE", map[string]any{"reasonCode": "RV_CPI", "rendezVousAt": demain})
	b.attend(statut, http.StatusOK, "rendez-vous à la CPI", body)
	var fiche, origine string
	if err := b.pool.QueryRow(b.ctx, `SELECT "id", "origin" FROM "prospects" WHERE "phoneE164" = $1`, telephone).Scan(&fiche, &origine); err != nil || origine != "REPRESENTANT" {
		t.Fatalf("fiche du représentant : %q %v", origine, err)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/"+fiche+"/rendez-vous", nil)
	b.attend(statut, http.StatusOK, "rendez-vous de la fiche", body)
	rdv, _ := body["rendezVous"].(map[string]any)
	if rdv["typeCode"] != "RV_CPI" || rdv["quand"] == "" {
		t.Fatalf("le rendez-vous du représentant rejoint la liste : %v", body)
	}

	statut, body = rdvRepresentantAppel(b, rep, "ACCEPTE", map[string]any{"reasonCode": "RDV_TELEPHONIQUE", "rendezVousAt": demain})
	b.attend(statut, http.StatusOK, "second rendez-vous", body)
	if n := qualificationCompte(b, `SELECT count(*) FROM "prospects" WHERE "phoneE164" = $1`, telephone); n != 1 {
		t.Fatalf("le second rendez-vous reprend la même fiche : %d", n)
	}
}
