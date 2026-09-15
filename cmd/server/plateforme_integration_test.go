//go:build integration

package main

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"
)

func plateformeFiches(b *banc, telephone, quoi string) []any {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/prospects?mesFiches=true&search="+url.QueryEscape(telephone), nil)
	b.attend(statut, http.StatusOK, quoi, body)
	items, _ := body["items"].([]any)
	return items
}

func plateformeOuverture(prospectID string) map[string]any {
	return map[string]any{
		"id": uuid.Must(uuid.NewV7()).String(), "prospectId": prospectID,
		"openedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
}

func plateformeAttendFiches(b *banc, telephone string, attendu int, quoi string) []any {
	b.t.Helper()
	items := plateformeFiches(b, telephone, quoi)
	if len(items) != attendu {
		b.t.Fatalf("%s : %d fiche(s), attendu %d", quoi, len(items), attendu)
	}
	return items
}

// Une inscription plateforme rapprochée d'une fiche en campagne : la fiche sort
// de la campagne à l'instant, le téléconseiller la perd partout, les CCP la
// prennent et se voient l'un l'autre dessus, l'encadrement la lit sans l'ouvrir.
func TestFichesPlateformeReserveesAuxCCP(t *testing.T) {
	b := adminConnecte(t)
	telephone := adminTelephone()
	commercialID, commercialEmail := adminCompte(b, "COMMERCIAL")
	_, ccpEmail := adminCompte(b, "CCP")
	_, autreCCPEmail := adminCompte(b, "CCP")
	prospectID := adminProspect(b, commercialID, "GRAND_PUBLIC", telephone)
	adminExec(b, `INSERT INTO "prospect_journeys" ("id","prospectId","projet","updatedAt") VALUES ($1,$2,'GRAND_PUBLIC',now())`,
		uuid.NewString(), prospectID)
	lotID := uuid.NewString()
	adminExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
		VALUES ($1,'Campagne plateforme','PROSPECTS','GRAND_PUBLIC','{}'::jsonb,1,$2)`, lotID, b.userID)
	adminExec(b, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lotID, prospectID, commercialID)
	adminExec(b, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'enrolement.GRAND_PUBLIC'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lotID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "prospectId" = $1`, prospectID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, lotID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" = $1`, prospectID)
	})

	commercial := adminSession(b, commercialEmail)
	plateformeAttendFiches(commercial, telephone, 1, "avant le tirage, la campagne confie la fiche au téléconseiller")

	plateforme := adminPlateformeGrandPublic(telephone, &appelPlateformeRecu{})
	t.Cleanup(plateforme.Close)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_URL", plateforme.URL)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_TOKEN", "jeton-machine")
	adminTirage(b, 1, 0)

	var depuis *time.Time
	var assignee *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."plateformeDepuis", li."assigneeId" FROM "prospects" p
		 JOIN "lot_export_items" li ON li."prospectId" = p."id" WHERE p."id" = $1`, prospectID).Scan(&depuis, &assignee); err != nil {
		t.Fatal(err)
	}
	if depuis == nil || assignee != nil {
		t.Fatalf("après le tirage : marque %v, attribution %v", depuis, assignee)
	}

	plateformeAttendFiches(commercial, telephone, 0, "après le tirage, le téléconseiller ne la voit plus")
	statut, body := adminAppel(commercial, http.MethodGet, "/api/v1/prospects/"+prospectID, nil)
	commercial.attend(statut, http.StatusForbidden, "détail refusé au téléconseiller", body)
	statut, body = adminAppel(commercial, http.MethodPost, "/api/v1/ouvertures", plateformeOuverture(prospectID))
	commercial.attend(statut, http.StatusNotFound, "ouverture refusée au téléconseiller", body)
	statut, body = adminAppel(commercial, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospectID, nil))
	commercial.attend(statut, http.StatusForbidden, "consignation refusée au téléconseiller", body)

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/lots-export/"+lotID+"/fiches", nil)
	b.attend(statut, http.StatusOK, "fiches de la campagne", body)
	fiches, _ := body["items"].([]any)
	premiere, _ := fiches[0].(map[string]any)
	if len(fiches) != 1 || premiere["etat"] != "PLATEFORME" {
		t.Fatalf("la campagne doit marquer la fiche « Plateforme » : %v", body["items"])
	}

	ccp := adminSession(b, ccpEmail)
	plateformeAttendFiches(ccp, telephone, 1, "le CCP voit la fiche")
	statut, body = adminAppel(ccp, http.MethodPost, "/api/v1/ouvertures", plateformeOuverture(prospectID))
	if statut/100 != 2 {
		t.Fatalf("ouverture par le CCP : %d %v", statut, body)
	}
	autre := adminSession(b, autreCCPEmail)
	vue, _ := plateformeAttendFiches(autre, telephone, 1, "l’autre CCP voit la fiche")[0].(map[string]any)
	if vue["enCoursPar"] != "Compte de test" {
		t.Fatalf("« en cours par » attendu pour l’autre CCP : %v", vue["enCoursPar"])
	}

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/prospects/"+prospectID, nil)
	b.attend(statut, http.StatusOK, "l’administrateur lit la fiche", body)
	statut, body = adminAppel(b, http.MethodPost, "/api/v1/ouvertures", plateformeOuverture(prospectID))
	b.attend(statut, http.StatusNotFound, "l’administrateur n’ouvre pas une fiche plateforme", body)

	statut, body = adminAppel(b, http.MethodPost, "/api/v1/lots-export", map[string]any{
		"name": "Campagne après tirage", "cible": "PROSPECTS", "prospects": map[string]any{"projet": "GRAND_PUBLIC"},
		"distribution": map[string]any{"teleconseillerIds": []string{commercialID}, "fichesParJour": 500, "jours": 1},
	})
	if statut == http.StatusCreated {
		nouveau, _ := body["id"].(string)
		t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, nouveau) })
		var tirees int
		if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "lot_export_items" WHERE "lotId" = $1 AND "prospectId" = $2`,
			nouveau, prospectID).Scan(&tirees); err != nil {
			t.Fatal(err)
		}
		if tirees != 0 {
			t.Fatal("une nouvelle campagne a tiré la fiche plateforme")
		}
	}
}

// La liste des prospects ne montre une fiche plateforme qu'au CCP et à
// l'administrateur : le superviseur et la direction lisent tout le reste.
func TestListeProspectsCacheLaFichePlateformeAlEncadrement(t *testing.T) {
	b := adminConnecte(t)
	telephone := adminTelephone()
	prospectID := adminProspect(b, b.userID, "GRAND_PUBLIC", telephone)
	adminExec(b, `UPDATE "prospects" SET "plateformeDepuis" = now() WHERE "id" = $1`, prospectID)
	_, ccpEmail := adminCompte(b, "CCP")
	_, superviseurEmail := adminCompte(b, "SUPERVISEUR")
	_, directionEmail := adminCompte(b, "DIRECTION")

	cas := []struct {
		quoi    string
		session *banc
		attendu int
	}{
		{"l’administrateur", b, 1},
		{"le CCP", adminSession(b, ccpEmail), 1},
		{"le superviseur", adminSession(b, superviseurEmail), 0},
		{"la direction", adminSession(b, directionEmail), 0},
	}
	for _, c := range cas {
		statut, body := adminAppel(c.session, http.MethodGet, "/api/v1/prospects?search="+url.QueryEscape(telephone), nil)
		c.session.attend(statut, http.StatusOK, c.quoi+" liste les prospects", body)
		items, _ := body["items"].([]any)
		if len(items) != c.attendu {
			t.Fatalf("%s : %d fiche(s) plateforme dans la liste, attendu %d", c.quoi, len(items), c.attendu)
		}
	}
}
