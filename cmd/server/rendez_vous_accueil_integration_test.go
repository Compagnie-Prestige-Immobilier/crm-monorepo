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

// Le comptoir trie les rendez-vous par type : il reçoit ceux qui viennent à
// l'agence, pas ceux qui se tiennent ailleurs.
func TestRendezVousFiltresParType(t *testing.T) {
	t.Setenv("BETA_SUIVI_RENDEZ_VOUS", "true")
	teleconseiller := qualificationConnecte(t, "COMMERCIAL")
	accueil := qualificationConnecte(t, "ACCUEIL")
	accueil.exec(`INSERT INTO "role_permissions" ("roleId", "permission")
	              VALUES ('ACCUEIL', 'rendez_vous.suivre'), ('ACCUEIL', 'prospects.lire')
	              ON CONFLICT DO NOTHING`)
	t.Cleanup(func() {
		_, _ = accueil.pool.Exec(accueil.ctx,
			`DELETE FROM "role_permissions" WHERE "roleId" = 'ACCUEIL' AND "permission" IN ('rendez_vous.suivre', 'prospects.lire')`)
	})

	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	fiches := map[string]string{}
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

	// La session porte les permissions lues à la connexion : elle est reprise
	// après l'écriture en base, sinon l'accueil reste sur ses quatre permissions.
	accueil = qualificationConnecte(t, "ACCUEIL")
	const liste = "/api/v1/prospects?phase2Status=APPOINTMENT&pageSize=200"
	statut, body := qualificationEnvoi(accueil, http.MethodGet, liste+"&motif=RV_CPI", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous filtrés sur RV CPI", body)
	if !contientFiche(body, fiches["RV_CPI"]) || contientFiche(body, fiches["RV_SITE"]) {
		t.Fatalf("le filtre RV CPI ne garde pas la bonne fiche : %v", body["meta"])
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, liste+"&motif=RV_SITE", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous filtrés sur RV site", body)
	if !contientFiche(body, fiches["RV_SITE"]) || contientFiche(body, fiches["RV_CPI"]) {
		t.Fatalf("le filtre RV site ne garde pas la bonne fiche : %v", body["meta"])
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, liste, nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous sans filtre", body)
	if !contientFiche(body, fiches["RV_CPI"]) || !contientFiche(body, fiches["RV_SITE"]) {
		t.Fatal("sans filtre, les deux types de rendez-vous manquent")
	}

	statut, body = qualificationEnvoi(accueil, http.MethodPost,
		"/api/v1/prospects/"+fiches["RV_CPI"]+"/suivi-rendez-vous", map[string]any{"issue": "HONORE", "suiteRencontre": "CHAUD"})
	accueil.attend(statut, http.StatusOK, "le comptoir confirme la venue", body)
}
