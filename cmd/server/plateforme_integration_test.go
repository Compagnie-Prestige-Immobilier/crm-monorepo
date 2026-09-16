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

// Un rappel promis par le téléconseiller, encore à venir.
func plateformeRappelPromis(b *banc, prospectID, teleconseillerID string) string {
	b.t.Helper()
	tentative, rappel := uuid.NewString(), uuid.NewString()
	adminExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","outcome","clientCreatedAt")
		VALUES ($1,$2,$3,'CALLBACK',now())`, tentative, prospectID, teleconseillerID)
	adminExec(b, `INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","sourceAttemptId","updatedAt")
		VALUES ($1,$2,$3,now() + interval '1 day',$4,now())`, rappel, prospectID, teleconseillerID, tentative)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rappel)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "id" = $1`, rappel)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, tentative)
	})
	return rappel
}

// Le CCP le moins chargé de la base reçoit le rappel : n'importe lequel, mais un CCP, avec sa trace.
func plateformeAttendRappelChezUnCCP(b *banc, rappelID string) {
	b.t.Helper()
	var role string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT u."role"::text FROM "scheduled_callbacks" c JOIN "users" u ON u."id" = c."assignedToId" WHERE c."id" = $1`,
		rappelID).Scan(&role); err != nil {
		b.t.Fatal(err)
	}
	if role != "CCP" || adminCompterAudit(b, "rappel.reattribue", rappelID) != 1 {
		b.t.Fatalf("le rappel promis doit passer à un CCP avec sa trace : rôle %s", role)
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
	rappelID := plateformeRappelPromis(b, prospectID, commercialID)
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
	var lignes int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."plateformeDepuis", (SELECT count(*) FROM "lot_export_items" li WHERE li."prospectId" = p."id")::int
		 FROM "prospects" p WHERE p."id" = $1`, prospectID).Scan(&depuis, &lignes); err != nil {
		t.Fatal(err)
	}
	if depuis == nil || lignes != 0 {
		t.Fatalf("après le tirage : marque %v, %d ligne(s) de campagne", depuis, lignes)
	}
	plateformeAttendRappelChezUnCCP(b, rappelID)

	plateformeAttendFiches(commercial, telephone, 0, "après le tirage, le téléconseiller ne la voit plus")
	statut, body := adminAppel(commercial, http.MethodGet, "/api/v1/prospects/"+prospectID, nil)
	commercial.attend(statut, http.StatusForbidden, "détail refusé au téléconseiller", body)
	statut, body = adminAppel(commercial, http.MethodPost, "/api/v1/ouvertures", plateformeOuverture(prospectID))
	commercial.attend(statut, http.StatusNotFound, "ouverture refusée au téléconseiller", body)
	statut, body = adminAppel(commercial, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospectID, nil))
	commercial.attend(statut, http.StatusForbidden, "consignation refusée au téléconseiller", body)

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/lots-export/"+lotID+"/fiches", nil)
	b.attend(statut, http.StatusOK, "fiches de la campagne", body)
	if fiches, _ := body["items"].([]any); len(fiches) != 0 {
		t.Fatalf("la fiche plateforme ne doit plus paraître dans la campagne : %v", body["items"])
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

// Chaude : une inscription vivante sur la plateforme est rapprochée. Froide :
// seul le classeur cite le site. Les deux vont au CCP, la note du classeur suit.
func TestFichesPlateformeChaudeEtFroide(t *testing.T) {
	b := adminConnecte(t)
	_, ccpEmail := adminCompte(b, "CCP")
	telChaud, telFroid := adminTelephone(), adminTelephone()
	chaud := adminProspect(b, b.userID, "GRAND_PUBLIC", telChaud)
	froid := adminProspect(b, b.userID, "GRAND_PUBLIC", telFroid)
	adminExec(b, `UPDATE "prospects" SET "plateformeDepuis" = now() WHERE "id" IN ($1, $2)`, chaud, froid)
	adminExec(b, `UPDATE "prospects" SET "remarqueImport" = 'Rappeler après 18 h' WHERE "id" = $1`, froid)
	inscription := uuid.NewString()
	adminExec(b, `INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","phoneE164","statutDistant","prospectId","chargeUtile","dernierTirageAt","updatedAt")
		VALUES ($1,'GRAND_PUBLIC',$1,'Diop','Awa',$2,'etape-2',$3,'{}'::jsonb,now(),now())`, inscription, telChaud, chaud)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "id" = $1`, inscription)
	})

	ccp := adminSession(b, ccpEmail)
	inscrite := func(vue map[string]any) bool {
		v, _ := vue["plateformeInscrite"].(bool)
		return v
	}
	vueChaude, _ := plateformeAttendFiches(ccp, telChaud, 1, "le CCP voit la fiche chaude")[0].(map[string]any)
	vueFroide, _ := plateformeAttendFiches(ccp, telFroid, 1, "le CCP voit la fiche froide")[0].(map[string]any)
	if !inscrite(vueChaude) || vueChaude["remarqueImport"] != nil {
		t.Fatalf("fiche chaude : %v", vueChaude)
	}
	if inscrite(vueFroide) || vueFroide["remarqueImport"] != "Rappeler après 18 h" {
		t.Fatalf("fiche froide : %v", vueFroide)
	}
	statut, body := adminAppel(ccp, http.MethodGet, "/api/v1/prospects/"+froid, nil)
	ccp.attend(statut, http.StatusOK, "le détail de la fiche froide", body)
	if body["remarqueImport"] != "Rappeler après 18 h" {
		t.Fatalf("la note du classeur manque au détail : %v", body["remarqueImport"])
	}

	adminExec(b, `UPDATE "inscriptions_plateforme" SET "disparueLe" = now() WHERE "id" = $1`, inscription)
	vueChaude, _ = plateformeAttendFiches(ccp, telChaud, 1, "la fiche reste au CCP")[0].(map[string]any)
	if inscrite(vueChaude) {
		t.Fatal("une inscription disparue ne vaut plus une étoile")
	}
}

// L'encadrement lit une fiche plateforme, liste, détail et filtre
// « plateforme », sans pouvoir l'ouvrir ni y consigner ; le téléconseiller ne
// la voit pas, même en la demandant.
func TestEncadrementLitLaFichePlateformeSansYToucher(t *testing.T) {
	b := adminConnecte(t)
	telephone := adminTelephone()
	prospectID := adminProspect(b, b.userID, "GRAND_PUBLIC", telephone)
	adminExec(b, `UPDATE "prospects" SET "plateformeDepuis" = now() WHERE "id" = $1`, prospectID)
	_, ccpEmail := adminCompte(b, "CCP")
	_, superviseurEmail := adminCompte(b, "SUPERVISEUR")
	_, directionEmail := adminCompte(b, "DIRECTION")
	_, commercialEmail := adminCompte(b, "COMMERCIAL")
	superviseur := adminSession(b, superviseurEmail)

	cas := []struct {
		quoi    string
		session *banc
		attendu int
	}{
		{"l’administrateur", b, 1},
		{"le CCP", adminSession(b, ccpEmail), 1},
		{"le superviseur", superviseur, 1},
		{"la direction", adminSession(b, directionEmail), 1},
		{"le téléconseiller", adminSession(b, commercialEmail), 0},
	}
	for _, c := range cas {
		chemin := "/api/v1/prospects?plateforme=true&search=" + url.QueryEscape(telephone)
		statut, body := adminAppel(c.session, http.MethodGet, chemin, nil)
		c.session.attend(statut, http.StatusOK, c.quoi+" liste les fiches plateforme", body)
		items, _ := body["items"].([]any)
		if len(items) != c.attendu {
			t.Fatalf("%s : %d fiche(s) plateforme dans la liste, attendu %d", c.quoi, len(items), c.attendu)
		}
	}

	statut, body := adminAppel(superviseur, http.MethodGet, "/api/v1/prospects/"+prospectID, nil)
	superviseur.attend(statut, http.StatusOK, "le superviseur lit le détail", body)
	statut, body = adminAppel(superviseur, http.MethodGet, "/api/v1/phase2/directory?limit=50", nil)
	superviseur.attend(statut, http.StatusOK, "annuaire du superviseur", body)
	entrees, _ := body["entries"].([]any)
	for _, ligne := range entrees {
		if fiche, _ := ligne.(map[string]any); fiche["prospectId"] == prospectID {
			t.Fatal("la fiche plateforme ne doit pas paraître dans l’annuaire d’appel du superviseur")
		}
	}
	statut, body = adminAppel(superviseur, http.MethodPost, "/api/v1/ouvertures", plateformeOuverture(prospectID))
	superviseur.attend(statut, http.StatusNotFound, "ouverture refusée au superviseur", body)
	statut, body = adminAppel(superviseur, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(prospectID, nil))
	superviseur.attend(statut, http.StatusForbidden, "consignation refusée au superviseur", body)
}

// L'équipe CCP se lit par l'encadrement et par le CCP lui-même, jamais par un
// téléconseiller ; l'administrateur seul règle l'objectif du jour.
func TestEquipeCCPEtObjectifDuJour(t *testing.T) {
	b := adminConnecte(t)
	ccpID, ccpEmail := adminCompte(b, "CCP")
	_, superviseurEmail := adminCompte(b, "SUPERVISEUR")
	_, commercialEmail := adminCompte(b, "COMMERCIAL")
	prospectID := adminProspect(b, b.userID, "GRAND_PUBLIC", adminTelephone())
	adminExec(b, `UPDATE "prospects" SET "plateformeDepuis" = now() WHERE "id" = $1`, prospectID)
	plateformeRappelPromis(b, prospectID, ccpID)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'plateforme.objectifAppelsParJour'`) })

	statut, body := adminAppel(b, http.MethodPut, "/api/v1/plateforme/objectif", map[string]any{"objectifAppelsParJour": 40})
	b.attend(statut, http.StatusOK, "objectif réglé", body)
	if body["objectifAppelsParJour"] != float64(40) {
		t.Fatalf("objectif : %v", body["objectifAppelsParJour"])
	}

	superviseur := adminSession(b, superviseurEmail)
	statut, body = adminAppel(superviseur, http.MethodGet, "/api/v1/plateforme/equipe", nil)
	superviseur.attend(statut, http.StatusOK, "équipe lue par le superviseur", body)
	var ligne map[string]any
	for _, c := range body["ccps"].([]any) {
		if candidat, _ := c.(map[string]any); candidat["id"] == ccpID {
			ligne = candidat
		}
	}
	if ligne == nil || ligne["appelsJour"] != float64(1) || ligne["jointsJour"] != float64(1) ||
		ligne["rappelsEnAttente"] != float64(1) || ligne["dernierAppel"] == nil || ligne["appelsSemaine"] != float64(1) {
		t.Fatalf("ligne du CCP : %v", ligne)
	}

	ccp := adminSession(b, ccpEmail)
	statut, body = adminAppel(ccp, http.MethodGet, "/api/v1/plateforme/equipe", nil)
	ccp.attend(statut, http.StatusOK, "le CCP lit l'équipe", body)
	commercial := adminSession(b, commercialEmail)
	statut, body = adminAppel(commercial, http.MethodGet, "/api/v1/plateforme/equipe", nil)
	commercial.attend(statut, http.StatusForbidden, "équipe refusée au téléconseiller", body)
	statut, body = adminAppel(superviseur, http.MethodPut, "/api/v1/plateforme/objectif", map[string]any{"objectifAppelsParJour": 10})
	superviseur.attend(statut, http.StatusForbidden, "objectif refusé au superviseur", body)
}

// Un rappel promis sur une fiche plateforme alors qu'aucun CCP n'existait :
// le premier tirage qui suit l'arrivée d'un CCP le lui remet, avec sa trace.
func TestRappelsPlateformeRattrapesParLeTirage(t *testing.T) {
	b := adminConnecte(t)
	commercialID, _ := adminCompte(b, "COMMERCIAL")
	_, _ = adminCompte(b, "CCP")
	telephone, autreTelephone := adminTelephone(), adminTelephone()
	prospectID := adminProspect(b, commercialID, "GRAND_PUBLIC", telephone)
	rappelID := plateformeRappelPromis(b, prospectID, commercialID)
	adminExec(b, `UPDATE "prospects" SET "plateformeDepuis" = now() WHERE "id" = $1`, prospectID)
	adminExec(b, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'enrolement.GRAND_PUBLIC'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, autreTelephone)
	})

	plateforme := adminPlateformeGrandPublic(autreTelephone, &appelPlateformeRecu{})
	t.Cleanup(plateforme.Close)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_URL", plateforme.URL)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_TOKEN", "jeton-machine")
	adminTirage(b, 1, 0)

	plateformeAttendRappelChezUnCCP(b, rappelID)
}
