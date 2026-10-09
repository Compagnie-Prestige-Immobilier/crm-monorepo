//go:build integration

package main

import (
	"cpi-go/internal/campagnes"
	"cpi-go/internal/shared/socle"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

// Une ligne complétée dans le classeur après le lancement de la campagne de son
// onglet rejoint cette campagne au relevé suivant, chez le membre le moins
// chargé, et le sélecteur ne la propose plus. Ce que la campagne
// n'aurait pas tiré n'y entre pas : autre projet, fiche déjà appelée, campagne en pause.
func TestCampagneRecoitLesFichesRemontees(t *testing.T) {
	b := nouveauBancCampagne(t, 0)
	feuille := "Leads 01 oct 2026 " + uuid.NewString()
	classeur := "Suivi Campagne & Leads " + uuid.NewString() + ".xlsx"
	premier := b.travailDImport(classeur)
	for range 3 {
		b.dansLeTravail(premier, b.prospect(feuille, "GRAND_PUBLIC", nil, "NOUVEAU"))
	}

	statut, body := b.appelCampagne(http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name": "Leads 1 octobre", "cible": "PROSPECTS",
		"prospects": map[string]any{"importFeuille": feuille, "importJobId": premier, "projet": "GRAND_PUBLIC"},
		"distribution": map[string]any{
			"teleconseillerIds": []string{b.agentA, b.agentB}, "fichesParJour": 2, "jours": 1,
		},
	})
	b.attend(statut, http.StatusCreated, "campagne de l'onglet", body)
	lotID, _ := body["id"].(string)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lotID) })

	tardif := b.travailDImport(classeur)
	remontee := b.prospect(feuille, "GRAND_PUBLIC", nil, "NOUVEAU")
	chues := b.prospect(feuille, "CHUES", nil, "NOUVEAU")
	issue := "PAS_DE_REPONSE"
	appelee := b.prospect(feuille, "GRAND_PUBLIC", &issue, "NOUVEAU")
	b.dansLeTravail(tardif, remontee, chues, appelee)

	deps := serviceDesImports(b.banc)
	b.enPauseRienNEntre(deps, lotID, remontee)
	b.ranger(deps)
	if !b.dansLeLot(lotID, remontee) || b.dansLeLot(lotID, chues) || b.dansLeLot(lotID, appelee) {
		t.Fatal("seule la fiche que la campagne aurait tirée la rejoint")
	}
	b.remonteeChezLeMoinsCharge(lotID, remontee)

	b.ranger(deps)
	if n := b.compte(`SELECT count(*)::int FROM "lot_export_items" WHERE "prospectId" = $1`, remontee); n != 1 {
		t.Fatalf("un second relevé ne range pas deux fois la fiche : %d", n)
	}
	fiches := 0.0
	for _, ligne := range b.lignesDeLOnglet(feuille) {
		n, _ := ligne["fiches"].(float64)
		fiches += n
	}
	if fiches != 5 {
		t.Fatalf("le sélecteur ne compte plus la fiche rangée, il garde les autres : %v fiches", fiches)
	}
}

func (b *bancCampagne) dansLeTravail(travail string, fiches ...string) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, `UPDATE "prospects" SET "importJobId" = $1 WHERE "id" = ANY($2::text[])`, travail, fiches); err != nil {
		b.t.Fatal(err)
	}
}

// Le tourniquet du lancement donne deux fiches à A et une à B : la fiche remontée lui revient, en
// tête de la campagne, et la campagne compte une fiche de plus.
func (b *bancCampagne) remonteeChezLeMoinsCharge(lotID, prospectID string) {
	b.t.Helper()
	if n := b.compte(`SELECT count(*)::int FROM "lot_export_items"
		WHERE "lotId" = $1 AND "prospectId" = $2 AND "assigneeId" = $3 AND "remonteeLe" IS NOT NULL`, lotID, prospectID, b.agentB); n != 1 {
		b.t.Fatal("la fiche remontée va au membre le moins chargé")
	}
	statut, body := b.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+lotID, nil)
	b.attend(statut, http.StatusOK, "campagne après rangement", body)
	if body["itemCount"] != float64(4) || body["remontees"] != float64(1) || body["derniereRemontee"] == "" {
		b.t.Fatalf("la campagne compte la fiche remontée : %v", body)
	}
	statut, body = b.appelCampagne(http.MethodGet, "/api/v1/lots-export/"+lotID+"/fiches", nil)
	b.attend(statut, http.StatusOK, "fiches de la campagne", body)
	items, _ := body["items"].([]any)
	premiere, _ := items[0].(map[string]any)
	if marquee, _ := premiere["remontee"].(bool); len(items) != 4 || premiere["ficheId"] != prospectID || !marquee {
		b.t.Fatalf("la fiche remontée passe en tête : %v", items)
	}
}

func (b *bancCampagne) ranger(deps *socle.Deps) {
	b.t.Helper()
	if _, err := campagnes.RangerFichesRemontees(b.ctx, deps, b.userID); err != nil {
		b.t.Fatal(err)
	}
}

// En pause, la campagne ne reçoit rien ; reprise, elle reçoit au relevé suivant.
func (b *bancCampagne) enPauseRienNEntre(deps *socle.Deps, lotID, prospectID string) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, `UPDATE "lots_export" SET "pausedAt" = now() WHERE "id" = $1`, lotID); err != nil {
		b.t.Fatal(err)
	}
	b.ranger(deps)
	if b.dansLeLot(lotID, prospectID) {
		b.t.Fatal("une campagne en pause ne reçoit rien")
	}
	if _, err := b.pool.Exec(b.ctx, `UPDATE "lots_export" SET "pausedAt" = NULL WHERE "id" = $1`, lotID); err != nil {
		b.t.Fatal(err)
	}
}
