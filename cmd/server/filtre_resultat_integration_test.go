//go:build integration

package main

import (
	"net/http"
	"slices"
	"testing"
	"time"
)

// Le filtre « Résultat de l'appel » suit le statut du formulaire, précisions comprises.
func TestFiltreResultatSuitLeStatutDuFormulaire(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	partenariat, information, rendezVous := qualificationProspect(b), qualificationProspect(b), qualificationProspect(b)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, rendezVous)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2, $3)`, partenariat, information, rendezVous)
	})
	for _, appel := range []map[string]any{
		qualificationCorpsTentative(partenariat, map[string]any{"reasonCode": "PARTENARIAT"}),
		qualificationCorpsTentative(information, map[string]any{"reasonCode": "DEMANDE_INFORMATION"}),
		qualificationCorpsTentative(rendezVous, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}),
	} {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "appel consigné", body)
	}
	for motif, attendu := range map[string]string{"PARTENARIAT": partenariat, "RENDEZ_VOUS": rendezVous} {
		total, ids := qualificationTotalProspects(b, "&motif="+motif)
		if total != 1 || !slices.Equal(ids, []string{attendu}) {
			t.Fatalf("motif %s : %d fiche(s) %v", motif, total, ids)
		}
	}
}
