//go:build integration

package main

import (
	"net/http"
	"sync"
	"testing"
	"time"
)

// Un poste dont l'horloge avance ne doit pas figer le dernier appel pour tous
// les appels suivants : le motif et l'heure gardés sont ceux du dernier appel
// réellement passé, pas ceux du premier envoyé avec une date future.
func TestTentativeHorlogeEnAvanceNeFigePasLaFiche(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	enAvance := qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "HESITANT", "clientCreatedAt": time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339Nano),
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", enAvance)
	b.attend(statut, http.StatusOK, "appel depuis un poste en avance", body)

	// Capturé après coup : sur un poste à l'heure, un second appel vient
	// forcément après que le premier a été traité, jamais avant.
	normal := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "DEMANDE_INFORMATION"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" IN ($1, $2)`, enAvance["id"], normal["id"])
	})
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", normal)
	b.attend(statut, http.StatusOK, "appel suivant, horloge juste", body)

	var reasonCode string
	var lastCallAt time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT r."code", p."lastCallAt" FROM "prospects" p JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
		 WHERE p."id" = $1`, fiche).Scan(&reasonCode, &lastCallAt); err != nil {
		t.Fatal(err)
	}
	if reasonCode != "DEMANDE_INFORMATION" {
		t.Fatalf("le dernier appel doit rester le dernier motif consigné, pas celui de l'horloge en avance : %s", reasonCode)
	}
	if lastCallAt.After(time.Now().Add(time.Minute)) {
		t.Fatalf("l'horloge en avance ne doit pas s'écrire telle quelle sur la fiche : %v", lastCallAt)
	}
}

// Combien de sessions attendent un verrou de ligne, pour forcer un ordre
// d'arrivée sans dépendre du hasard de l'ordonnanceur Go.
func attendreAttentesVerrou(b *banc, n int) {
	b.t.Helper()
	for range 200 {
		var empiles int
		if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM pg_stat_activity
			WHERE wait_event_type = 'Lock' AND datname = current_database()`).Scan(&empiles); err != nil {
			b.t.Fatal(err)
		}
		if empiles >= n {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	b.t.Fatalf("%d requête(s) attendue(s) sur le verrou de ligne, jamais atteint", n)
}

// Deux consignations forcées dans cet ordre sur la même fiche par un verrou
// tenu par le test : sans verrou de ligne à la lecture, la seconde a lu la
// fiche avant que la première n'ait écrit, et écrase le dernier appel avec sa
// propre date, plus ancienne que celle déjà consignée.
func TestTentativesConcurrentesGardentLaPlusRecente(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	origine := time.Now().UTC().Add(-time.Hour)
	qualificationExec(b, `UPDATE "prospects" SET "lastCallAt" = $2, "lastCallById" = $3,
		"lastReasonId" = (SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE')
		WHERE "id" = $1`, fiche, origine, b.userID)

	recent := qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "HESITANT", "clientCreatedAt": origine.Add(10 * time.Minute).Format(time.RFC3339Nano),
	})
	ancien := qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "DEMANDE_INFORMATION", "clientCreatedAt": origine.Add(time.Minute).Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" IN ($1, $2)`, recent["id"], ancien["id"])
	})

	tx, err := b.pool.Begin(b.ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(b.ctx) }()
	if _, err := tx.Exec(b.ctx, `SELECT 1 FROM "prospects" WHERE "id" = $1 FOR NO KEY UPDATE`, fiche); err != nil {
		t.Fatal(err)
	}
	statuts := make([]int, 2)
	var attente sync.WaitGroup
	attente.Go(func() {
		statuts[0], _ = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", recent)
	})
	attendreAttentesVerrou(b, 1)
	attente.Go(func() {
		statuts[1], _ = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", ancien)
	})
	attendreAttentesVerrou(b, 2)
	if err := tx.Commit(b.ctx); err != nil {
		t.Fatal(err)
	}
	attente.Wait()
	if statuts[0] != http.StatusOK || statuts[1] != http.StatusOK {
		t.Fatalf("les deux consignations doivent aboutir : %v", statuts)
	}

	var reasonCode string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT r."code" FROM "prospects" p JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
		 WHERE p."id" = $1`, fiche).Scan(&reasonCode); err != nil {
		t.Fatal(err)
	}
	if reasonCode != "HESITANT" {
		t.Fatalf("la fiche doit garder le dernier appel le plus récent, pas celui lu avant coup : %s", reasonCode)
	}
}
