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

// Le mardi ou le jeudi à 10h : créneau ouvert par les réglages RV site par
// défaut (jours 2 et 4, 9h-20h), sans dépendre d'un autre test qui les change.
func prochainCreneauRvSite() time.Time {
	d := time.Now().UTC().AddDate(0, 0, 1)
	for d.Weekday() != time.Tuesday && d.Weekday() != time.Thursday {
		d = d.AddDate(0, 0, 1)
	}
	return time.Date(d.Year(), d.Month(), d.Day(), 10, 0, 0, 0, time.UTC)
}

// Deux rendez-vous posés par un téléconseiller, un par type, au même créneau.
func rendezVousPoses(t *testing.T) (teleconseiller *banc, fiches map[string]string, quandRV time.Time) {
	t.Helper()
	t.Setenv("BETA_SUIVI_RENDEZ_VOUS", "true")
	teleconseiller = qualificationConnecte(t, "COMMERCIAL")
	quandRV = prochainCreneauRvSite()
	quand := quandRV.Format(time.RFC3339)
	var site, point string
	if err := teleconseiller.pool.QueryRow(teleconseiller.ctx, `SELECT (SELECT "id" FROM "ventes_sites" WHERE "actif" LIMIT 1),
		(SELECT "id" FROM "points_rencontre" WHERE "isActive" LIMIT 1)`).Scan(&site, &point); err != nil {
		t.Fatal(err)
	}
	champsParMotif := map[string]map[string]any{
		"RV_CPI":  {"reasonCode": "RV_CPI", "callbackAt": quand},
		"RV_SITE": {"reasonCode": "RV_SITE", "callbackAt": quand, "siteId": site, "pointRencontreId": point},
	}
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
			qualificationCorpsTentative(fiche, champsParMotif[motif]))
		teleconseiller.attend(statut, http.StatusOK, motif+" consigné", body)
	}
	return teleconseiller, fiches, quandRV
}

const listeRendezVous = "/api/v1/rendez-vous?pageSize=200"

// Le comptoir trie les rendez-vous par type : il reçoit ceux qui viennent à
// l'agence, pas ceux qui se tiennent ailleurs.
func TestRendezVousFiltresParType(t *testing.T) {
	teleconseiller, fiches, _ := rendezVousPoses(t)

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
	teleconseiller, fiches, quandRV := rendezVousPoses(t)
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

	// Le jour du rendez-vous le contient, celui d'après non.
	jour := quandRV
	statut, body = qualificationEnvoi(accueil, http.MethodGet,
		listeRendezVous+"&du="+jour.Format("2006-01-02")+"&au="+jour.Format("2006-01-02"), nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous du jour", body)
	if !contientFiche(body, fiches["RV_CPI"]) {
		t.Fatal("le rendez-vous manque à sa propre journée")
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

func rappelEnAttente(b *banc, fiche string) string {
	b.t.Helper()
	var id string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, fiche).Scan(&id); err != nil {
		b.t.Fatal(err)
	}
	return id
}

func dateDuRendezVous(b *banc, fiche string) time.Time {
	b.t.Helper()
	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/"+fiche+"/rendez-vous", nil)
	b.attend(statut, http.StatusOK, "rendez-vous de la fiche", body)
	rdv, _ := body["rendezVous"].(map[string]any)
	quand, _ := rdv["quand"].(string)
	lue, err := time.Parse(time.RFC3339, quand)
	if err != nil {
		b.t.Fatalf("la fiche doit rendre la date de son rendez-vous : %v", body)
	}
	return lue
}

// La date affichée au comptoir est celle du rappel qui tient encore, pas celle
// d'un rappel supplanté ; annuler le rappel ne l'efface pas.
func TestRendezVousDateEstCelleDuDernierRappel(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	loin := time.Now().UTC().AddDate(0, 0, 20)
	proche := time.Now().UTC().AddDate(0, 0, 5)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "CALLBACK", "callbackAt": loin.Format(time.RFC3339)}))
	b.attend(statut, http.StatusOK, "rappel à J+20 consigné", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "RV_CPI", "callbackAt": proche.Format(time.RFC3339)}))
	b.attend(statut, http.StatusOK, "RV CPI à J+5 consigné", body)

	if lue := dateDuRendezVous(b, fiche); lue.Sub(proche).Abs() > time.Minute {
		t.Fatalf("date rendue %v, attendue le RV CPI du %v, pas le rappel supplanté du %v", lue, proche, loin)
	}

	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/callbacks/"+rappelEnAttente(b, fiche)+"/cancel", nil)
	b.attend(statut, http.StatusOK, "rappel du rendez-vous annulé", body)
	if lue := dateDuRendezVous(b, fiche); lue.Sub(proche).Abs() > time.Minute {
		t.Fatalf("date rendue %v après annulation du rappel, attendue %v", lue, proche)
	}
}

// Un RDV téléphonique se décale comme un rappel ; un rendez-vous physique non.
func TestRendezVousTelephoniqueSeReporte(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	for motif, attendu := range map[string]int{"RDV_TELEPHONIQUE": http.StatusOK, "RV_CPI": http.StatusConflict} {
		fiche := qualificationProspect(b)
		t.Cleanup(func() {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
		})
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
			qualificationCorpsTentative(fiche, map[string]any{"reasonCode": motif, "callbackAt": quand}))
		b.attend(statut, http.StatusOK, motif+" consigné", body)
		statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/callbacks/"+rappelEnAttente(b, fiche)+"/snooze", nil)
		b.attend(statut, attendu, "report du "+motif, body)
	}
}

// Un nouveau rendez-vous efface le sort du précédent : sinon un « Non honoré »
// périmé continue d'exclure la fiche du filtre « à confirmer ».
func TestNouveauRendezVousEffaceLIssuePrecedente(t *testing.T) {
	t.Setenv("BETA_SUIVI_RENDEZ_VOUS", "true")
	teleconseiller := qualificationConnecte(t, "COMMERCIAL")
	accueil := qualificationConnecte(t, "ACCUEIL")
	fiche := qualificationProspect(teleconseiller)
	t.Cleanup(func() {
		_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = teleconseiller.pool.Exec(teleconseiller.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	premier := time.Now().UTC().AddDate(0, 0, 3).Format(time.RFC3339)
	statut, body := qualificationEnvoi(teleconseiller, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "RV_CPI", "callbackAt": premier}))
	teleconseiller.attend(statut, http.StatusOK, "premier RV CPI consigné", body)

	statut, body = qualificationEnvoi(accueil, http.MethodPost, "/api/v1/prospects/"+fiche+"/suivi-rendez-vous",
		map[string]any{"issue": "NON_HONORE"})
	accueil.attend(statut, http.StatusOK, "rendez-vous non honoré", body)

	var issue *string
	if err := teleconseiller.pool.QueryRow(teleconseiller.ctx,
		`SELECT "rendezVousIssue" FROM "prospects" WHERE "id" = $1`, fiche).Scan(&issue); err != nil {
		t.Fatal(err)
	}
	if issue == nil || *issue != "NON_HONORE" {
		t.Fatalf("l'issue doit être enregistrée avant la reprise : %v", issue)
	}

	second := time.Now().UTC().AddDate(0, 0, 7).Format(time.RFC3339)
	statut, body = qualificationEnvoi(teleconseiller, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "RV_CPI", "callbackAt": second}))
	teleconseiller.attend(statut, http.StatusOK, "nouveau RV CPI consigné", body)

	var suite *string
	var reporte *time.Time
	if err := teleconseiller.pool.QueryRow(teleconseiller.ctx,
		`SELECT "rendezVousIssue", "rendezVousReporteAt", "suiteRencontre" FROM "prospects" WHERE "id" = $1`, fiche).
		Scan(&issue, &reporte, &suite); err != nil {
		t.Fatal(err)
	}
	if issue != nil || reporte != nil || suite != nil {
		t.Fatalf("un nouveau rendez-vous doit effacer l'issue précédente : issue %v, reporté %v, suite %v", issue, reporte, suite)
	}

	statut, body = qualificationEnvoi(accueil, http.MethodGet, listeRendezVous+"&issue=SANS", nil)
	accueil.attend(statut, http.StatusOK, "rendez-vous à confirmer", body)
	if !contientFiche(body, fiche) {
		t.Fatal("le nouveau rendez-vous doit revenir dans le filtre « à confirmer »")
	}
}
