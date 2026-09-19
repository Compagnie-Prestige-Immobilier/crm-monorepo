//go:build integration

package main

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

// Le journal de la fiche dit qui a changé quoi : un premier appel qui passe la
// fiche à « Contacté », une modification par le panneau, l'avant et l'après.
func TestJournalDeLaFicheDitQuiAChangeQuoi(t *testing.T) {
	b := adminConnecte(t)
	prospectID := adminProspect(b, b.userID, "CHUES", adminTelephone())
	adminExec(b, `INSERT INTO "prospect_journeys" ("id","prospectId","projet","updatedAt") VALUES ($1,$2,'CHUES',now())`,
		uuid.NewString(), prospectID)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, prospectID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, prospectID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" = $1`, prospectID)
	})

	corps := qualificationCorpsTentative(prospectID, map[string]any{"reasonCode": "INTERESSE"})
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "premier appel", body)
	statut, body = adminAppel(b, http.MethodPatch, "/api/v1/prospects/"+prospectID, map[string]any{"statut": "CONVERTI"})
	b.attend(statut, http.StatusOK, "modification par le panneau", body)

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/prospects/"+prospectID+"/journal", nil)
	b.attend(statut, http.StatusOK, "journal de la fiche", body)
	items, _ := body["items"].([]any)
	parAction := map[string]map[string]any{}
	for _, item := range items {
		entree := mapDe(item)
		action, _ := entree["action"].(string)
		parAction[action] = entree
	}
	premierAppel, ok := parAction["prospect.statut"]
	if !ok || mapDe(premierAppel["avant"])["statut"] != "NOUVEAU" || mapDe(premierAppel["apres"])["statut"] != "CONTACTE" ||
		premierAppel["auteur"] != "Test Intégration" {
		t.Fatalf("le premier appel doit laisser « Nouveau → Contacté » signé : %v", premierAppel)
	}
	modification, ok := parAction["prospect.update"]
	if !ok || mapDe(modification["avant"])["statut"] != "CONTACTE" || mapDe(modification["apres"])["statut"] != "CONVERTI" {
		t.Fatalf("la modification doit porter l’avant et l’après : %v", modification)
	}
	if mapDe(items[0])["action"] != "prospect.update" {
		t.Fatalf("le journal se lit du plus récent au plus ancien : %v", items)
	}
}
