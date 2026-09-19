//go:build integration

package main

import (
	"net/http"
	"testing"
	"time"
)

func TestSuiviRendezVousBetaParLaDirection(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	direction := qualificationConnecte(t, "DIRECTION")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(b)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}))
	b.attend(statut, http.StatusOK, "rendez-vous consigné", body)

	chemin := "/api/v1/prospects/" + fiche + "/suivi-rendez-vous"
	honore := map[string]any{"issue": "HONORE", "suiteRencontre": "CHAUD"}
	statut, body = qualificationEnvoi(direction, http.MethodPost, chemin, honore)
	direction.attend(statut, http.StatusForbidden, "bêta coupée", body)

	t.Setenv("BETA_SUIVI_RENDEZ_VOUS", "true")
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, honore)
	superviseur.attend(statut, http.StatusForbidden, "le superviseur observe", body)
	statut, body = qualificationEnvoi(direction, http.MethodPost, chemin, map[string]any{"issue": "REPORTE"})
	direction.attend(statut, http.StatusBadRequest, "report sans date", body)
	statut, body = qualificationEnvoi(direction, http.MethodPost, chemin, map[string]any{"issue": "NON_HONORE", "suiteRencontre": "CHAUD"})
	direction.attend(statut, http.StatusBadRequest, "suite sans rencontre", body)
	statut, body = qualificationEnvoi(direction, http.MethodPost, chemin, honore)
	direction.attend(statut, http.StatusOK, "rendez-vous honoré", body)

	statut, body = qualificationEnvoi(superviseur, http.MethodGet, "/api/v1/prospects/"+fiche, nil)
	superviseur.attend(statut, http.StatusOK, "fiche lue", body)
	if body["rendezVousIssue"] != "HONORE" || body["suiteRencontre"] != "CHAUD" {
		t.Fatalf("suivi relu : %v", body)
	}
}
