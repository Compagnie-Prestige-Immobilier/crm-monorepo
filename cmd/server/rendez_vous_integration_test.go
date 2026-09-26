//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"slices"
	"sync"
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

	telephone, _ := body["phoneE164"].(string)
	cc := qualificationConnecte(t, "CHARGE_CLIENTELE")
	statut, body = qualificationEnvoi(cc, http.MethodGet, "/api/v1/prospects?phase2Status=APPOINTMENT&search="+telephone[1:], nil)
	cc.attend(statut, http.StatusOK, "onglet Rendez-vous", body)
	items, _ := body["items"].([]any)
	if !slices.ContainsFunc(items, func(item any) bool { ligne, _ := item.(map[string]any); return ligne["id"] == fiche }) {
		t.Fatalf("le CC voit l'onglet Rendez-vous : %d fiches", len(items))
	}
	statut, body = qualificationEnvoi(cc, http.MethodPost, chemin, map[string]any{"issue": "NON_HONORE"})
	cc.attend(statut, http.StatusOK, "le CC note le suivi", body)
}

func prochain(jour time.Weekday) string {
	d := time.Now().UTC().AddDate(0, 0, 1)
	for d.Weekday() != jour {
		d = d.AddDate(0, 0, 1)
	}
	return time.Date(d.Year(), d.Month(), d.Day(), 7, 0, 0, 0, time.UTC).Format(time.RFC3339)
}

// Un RV site se prend à une heure ouverte par l'admin, vers un site et depuis un point de rencontre.
func TestRendezVousSiteSurCreneauOuvert(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(b)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	var avant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'rv_site.reglages'`).Scan(&avant)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'rv_site.reglages'`)
		if avant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES ('rv_site.reglages', $1, now())`, *avant)
		}
	})
	statut, body := qualificationEnvoi(b, http.MethodPut, "/api/v1/rv-site/reglages", map[string]any{"jours": []int{7}})
	b.attend(statut, http.StatusForbidden, "le téléconseiller ne règle pas", body)
	admin := qualificationConnecte(t, "ADMIN")
	reglages := map[string]any{"jours": []int{7, 7}, "heureDebut": 8, "heureFin": 7, "horizonJours": 60}
	statut, body = qualificationEnvoi(admin, http.MethodPut, "/api/v1/rv-site/reglages", reglages)
	admin.attend(statut, http.StatusBadRequest, "plage à l'envers", body)
	reglages["heureDebut"], reglages["heureFin"], reglages["maxVisites"] = 7, 8, 1
	statut, body = qualificationEnvoi(admin, http.MethodPut, "/api/v1/rv-site/reglages", reglages)
	admin.attend(statut, http.StatusOK, "réglages enregistrés", body)
	var site, point string
	if err := b.pool.QueryRow(b.ctx, `SELECT (SELECT "id" FROM "ventes_sites" WHERE "actif" LIMIT 1),
		(SELECT "id" FROM "points_rencontre" WHERE "isActive" LIMIT 1)`).Scan(&site, &point); err != nil {
		t.Fatal(err)
	}
	rv := func(quand string, champs map[string]any) (int, map[string]any) {
		champs["reasonCode"], champs["callbackAt"] = "RV_SITE", quand
		return qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, champs))
	}
	complet := func() map[string]any {
		return map[string]any{"siteId": site, "pointRencontreId": point, "pointRencontreCommentaire": "devant la pharmacie"}
	}
	statut, body = rv(prochain(time.Wednesday), complet())
	b.attend(statut, http.StatusBadRequest, "mercredi fermé", body)
	statut, body = rv(prochain(time.Sunday), map[string]any{"siteId": site})
	b.attend(statut, http.StatusBadRequest, "point de rencontre manquant", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche,
		map[string]any{"reasonCode": "RV_CPI", "callbackAt": prochain(time.Sunday), "siteId": site}))
	b.attend(statut, http.StatusBadRequest, "site hors RV site", body)
	statut, body = rv(prochain(time.Sunday), complet())
	b.attend(statut, http.StatusOK, "RV site sur créneau ouvert", body)

	autre := qualificationProspect(b)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, autre)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, autre)
	})
	corps := complet()
	corps["reasonCode"], corps["callbackAt"] = "RV_SITE", prochain(time.Sunday)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(autre, corps))
	b.attend(statut, http.StatusConflict, "créneau complet", body)

	var siteLu, commentaire string
	if err := b.pool.QueryRow(b.ctx, `SELECT "siteId", "pointRencontreCommentaire" FROM "call_attempts" WHERE "prospectId" = $1`,
		fiche).Scan(&siteLu, &commentaire); err != nil || siteLu != site || commentaire != "devant la pharmacie" {
		t.Fatalf("appel relu : %s %q %v", siteLu, commentaire, err)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/"+fiche+"/rendez-vous", nil)
	b.attend(statut, http.StatusOK, "rendez-vous de la fiche", body)
	rdv, _ := body["rendezVous"].(map[string]any)
	if rdv["typeCode"] != "RV_SITE" || rdv["site"] == "" || rdv["pointRencontre"] == "" || rdv["quand"] == nil {
		t.Fatalf("rendez-vous de la fiche : %v", body)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/"+autre+"/rendez-vous", nil)
	b.attend(statut, http.StatusOK, "fiche sans rendez-vous", body)
	if body["rendezVous"] != nil {
		t.Fatalf("aucun rendez-vous attendu : %v", body)
	}
}

// Le dimanche de 7 h à 8 h, une visite par heure ; les réglages d'avant reviennent à la fin du test.
func rvSiteUneVisiteLeDimanche(t *testing.T) (site, point string) {
	t.Helper()
	admin := qualificationConnecte(t, "ADMIN")
	var avant *string
	_ = admin.pool.QueryRow(admin.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'rv_site.reglages'`).Scan(&avant)
	t.Cleanup(func() {
		_, _ = admin.pool.Exec(admin.ctx, `DELETE FROM "app_settings" WHERE "key" = 'rv_site.reglages'`)
		if avant != nil {
			_, _ = admin.pool.Exec(admin.ctx, `INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES ('rv_site.reglages', $1, now())`, *avant)
		}
	})
	reglages := map[string]any{"jours": []int{7}, "heureDebut": 7, "heureFin": 8, "horizonJours": 60, "maxVisites": 1}
	statut, body := qualificationEnvoi(admin, http.MethodPut, "/api/v1/rv-site/reglages", reglages)
	admin.attend(statut, http.StatusOK, "réglages enregistrés", body)
	if err := admin.pool.QueryRow(admin.ctx, `SELECT (SELECT "id" FROM "ventes_sites" WHERE "actif" LIMIT 1),
		(SELECT "id" FROM "points_rencontre" WHERE "isActive" LIMIT 1)`).Scan(&site, &point); err != nil {
		t.Fatal(err)
	}
	return site, point
}

func rvSiteCorps(fiche, site, point string, quand time.Time) map[string]any {
	return qualificationCorpsTentative(fiche, map[string]any{
		"reasonCode": "RV_SITE", "callbackAt": quand.Format(time.RFC3339), "siteId": site, "pointRencontreId": point,
	})
}

func rvSiteFiche(b *banc) string {
	b.t.Helper()
	fiche := qualificationProspect(b)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	return fiche
}

// Un rappel supplanté libère sa place ; un rappel annulé la garde, comme la date à l'accueil.
func TestRendezVousSitePlaceTenueParLeDernierRappel(t *testing.T) {
	site, point := rvSiteUneVisiteLeDimanche(t)
	b := qualificationConnecte(t, "COMMERCIAL")
	sept, _ := time.Parse(time.RFC3339, prochain(time.Sunday))
	huit := sept.Add(time.Hour)
	premiere, seconde := rvSiteFiche(b), rvSiteFiche(b)

	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rvSiteCorps(premiere, site, point, huit))
	b.attend(statut, http.StatusOK, "RV site à 8 h", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rvSiteCorps(premiere, site, point, sept))
	b.attend(statut, http.StatusOK, "RV site déplacé à 7 h", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/callbacks/"+rappelEnAttente(b, premiere)+"/cancel", nil)
	b.attend(statut, http.StatusOK, "rappel du RV site annulé", body)

	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/phase2/rv-site", nil)
	b.attend(statut, http.StatusOK, "créneaux RV site", body)
	reservations, _ := body["reservations"].([]any)
	pris := map[string]float64{}
	for _, r := range reservations {
		ligne, _ := r.(map[string]any)
		quand, _ := ligne["quand"].(string)
		pris[quand], _ = ligne["nombre"].(float64)
	}
	if pris[sept.Format(time.RFC3339)] != 1 || pris[huit.Format(time.RFC3339)] != 0 {
		t.Fatalf("réservations : %v, attendu une à 7 h et aucune à 8 h", pris)
	}

	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rvSiteCorps(seconde, site, point, sept))
	b.attend(statut, http.StatusConflict, "7 h tenu par le rappel annulé", body)
	statut, body = qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", rvSiteCorps(seconde, site, point, huit))
	b.attend(statut, http.StatusOK, "8 h libéré par le rappel supplanté", body)
}

// Deux téléconseillers visent la dernière place au même instant : un seul l'obtient.
func TestRendezVousSiteDernierePlaceDisputee(t *testing.T) {
	site, point := rvSiteUneVisiteLeDimanche(t)
	sept, _ := time.Parse(time.RFC3339, prochain(time.Sunday))
	consoles := []*banc{qualificationConnecte(t, "COMMERCIAL"), qualificationConnecte(t, "COMMERCIAL")}
	corps := make([][]byte, len(consoles))
	for i, b := range consoles {
		var err error
		if corps[i], err = json.Marshal(rvSiteCorps(rvSiteFiche(b), site, point, sept)); err != nil {
			t.Fatal(err)
		}
	}
	statuts := make([]int, len(consoles))
	var depart, fin sync.WaitGroup
	depart.Add(1)
	for i, b := range consoles {
		fin.Add(1)
		go func() {
			defer fin.Done()
			req, _ := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+"/api/v1/phase2/call-attempts", bytes.NewReader(corps[i]))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", b.ts.URL)
			depart.Wait()
			if resp, err := b.client.Do(req); err == nil {
				statuts[i] = resp.StatusCode
				_ = resp.Body.Close()
			}
		}()
	}
	depart.Done()
	fin.Wait()
	slices.Sort(statuts)
	if statuts[0] != http.StatusOK || statuts[1] != http.StatusConflict {
		t.Fatalf("statuts %v, attendu un 200 et un 409", statuts)
	}
}

// « Khady Kane » et « Kane Khady » trouvent la même fiche, dans les prospects comme dans les rendez-vous.
func TestRechercheNomPrenomDansLesDeuxOrdres(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	direction := qualificationConnecte(t, "DIRECTION")
	fiche := qualificationProspect(b)
	qualificationExec(b, `UPDATE "prospects" SET "nom" = 'Kane', "prenom" = 'Khady' WHERE "id" = $1`, fiche)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
	})
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}))
	b.attend(statut, http.StatusOK, "rendez-vous consigné", body)

	for _, liste := range []string{"/api/v1/prospects?pageSize=100&search=", "/api/v1/rendez-vous?pageSize=200&search="} {
		for _, terme := range []string{"Khady Kane", "kane khady"} {
			statut, body := qualificationEnvoi(direction, http.MethodGet, liste+url.QueryEscape(terme), nil)
			direction.attend(statut, http.StatusOK, liste+terme, body)
			items, _ := body["items"].([]any)
			trouvee := slices.ContainsFunc(items, func(item any) bool {
				ligne, _ := item.(map[string]any)
				return ligne["id"] == fiche || ligne["prospectId"] == fiche
			})
			if !trouvee {
				t.Fatalf("%s%q doit trouver la fiche : %d résultat(s)", liste, terme, len(items))
			}
		}
	}
}
