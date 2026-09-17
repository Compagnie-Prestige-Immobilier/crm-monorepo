//go:build integration

package main

import (
	"cpi-go/internal/admin"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func exportAttendAbsent(t *testing.T, f *excelize.File, valeurs ...string) {
	t.Helper()
	for _, feuille := range f.GetSheetList() {
		lignes, err := f.GetRows(feuille)
		if err != nil {
			t.Fatal(err)
		}
		for _, cellule := range slices.Concat(lignes...) {
			if slices.Contains(valeurs, cellule) {
				t.Fatalf("%s : %q ne doit pas sortir de l’export de ce compte", feuille, cellule)
			}
		}
	}
}

func TestPorteeEncadrementModifieLesFichesDesAutres(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	voisin := autreCompte(b, "COMMERCIAL")
	superviseur := autreCompte(b, "SUPERVISEUR")
	direction := autreCompte(b, "DIRECTION")
	nettoyerProspects(b, b.userID, voisin.userID, superviseur.userID, direction.userID)
	id := creerProspect(b, "Faye", numeroSenegalais(41))["id"].(string)

	statut, body := appelJSON(voisin, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"prenom": "Voisin"}, nil)
	voisin.attend(statut, http.StatusForbidden, "prospect d’un collègue par un téléconseiller", body)
	for _, encadrant := range []*banc{superviseur, direction} {
		statut, body = appelJSON(encadrant, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"prenom": "Encadrement"}, nil)
		encadrant.attend(statut, http.StatusOK, "prospect d’un téléconseiller modifié par l’encadrement", body)
	}

	departement := representantDepartementDeTest(b)
	for i, encadrant := range []*banc{superviseur, direction} {
		fiche := representantCreer(b, departement, "Représentant encadré", "77 300 10 0"+string(rune('1'+i)))
		chemin := "/api/v1/representants/" + fiche["id"].(string)
		statut, body = representantJSON(voisin, http.MethodPatch, chemin, map[string]any{"rev": 1, "notes": "voisin"})
		voisin.attend(statut, http.StatusForbidden, "représentant d’un collègue par un téléconseiller", body)
		statut, body = representantJSON(encadrant, http.MethodPatch, chemin, map[string]any{"rev": 1, "notes": "encadrement"})
		encadrant.attend(statut, http.StatusOK, "représentant modifié par l’encadrement", body)
		statut, body = representantJSON(encadrant, http.MethodDelete, chemin, nil)
		if statut != http.StatusOK && statut != http.StatusNoContent {
			t.Fatalf("suppression d’un représentant par l’encadrement : %d %v", statut, body)
		}
	}
}

func TestPorteeRappelDUnCollegue(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	voisin := autreCompte(b, "COMMERCIAL")
	administrateur := autreCompte(b, "ADMIN")
	superviseur := autreCompte(b, "SUPERVISEUR")
	prospect := qualificationProspect(b)
	corps := qualificationCorpsTentative(prospect, map[string]any{
		"outcome": "CALLBACK", "callbackAt": time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano),
	})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, corps["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", corps)
	b.attend(statut, http.StatusOK, "issue à rappeler", body)
	var rappel string
	if err := b.pool.QueryRow(b.ctx, `SELECT "id" FROM "scheduled_callbacks" WHERE "prospectId" = $1`, prospect).Scan(&rappel); err != nil {
		t.Fatal(err)
	}

	for _, action := range []string{"snooze", "cancel"} {
		chemin := "/api/v1/phase2/callbacks/" + rappel + "/" + action
		statut, body := qualificationEnvoi(voisin, http.MethodPost, chemin, nil)
		voisin.attend(statut, http.StatusForbidden, action+" du rappel d’un collègue", body)
		if body["code"] != "NOT_OWNER" {
			t.Fatalf("%s : code %v", action, body["code"])
		}
		statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, nil)
		superviseur.attend(statut, http.StatusForbidden, action+" refusé au superviseur", body)
	}
	statut, body = qualificationEnvoi(administrateur, http.MethodPost, "/api/v1/phase2/callbacks/"+rappel+"/snooze", nil)
	administrateur.attend(statut, http.StatusOK, "report par l’admin", body)
}

func TestPorteeReaffectationVersUnTiers(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	destinataire := autreCompte(b, "COMMERCIAL")
	superviseur := autreCompte(b, "SUPERVISEUR")
	nettoyerProspects(b, b.userID, destinataire.userID)
	id := creerProspect(b, "Gueye", numeroSenegalais(42))["id"].(string)
	corps := map[string]any{"prospectIds": []string{id}, "commercialId": destinataire.userID}

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects/reassign", corps, nil)
	b.attend(statut, http.StatusForbidden, "réaffectation vers un tiers par un téléconseiller", body)
	statut, body = appelJSON(superviseur, http.MethodPost, "/api/v1/prospects/reassign", corps, nil)
	superviseur.attend(statut, http.StatusOK, "réaffectation vers un tiers par le superviseur", body)
}

func TestPorteeParametreReserveEtTransitionForcee(t *testing.T) {
	b := nouveauBanc(t, "SUPERVISEUR")
	connecte(b)
	nettoyerProspects(b, b.userID)
	statut, body := appelJSON(b, http.MethodPatch, "/api/v1/parametres-chues",
		map[string]any{"emailChues": "superviseur@cpi.sn"}, nil)
	b.attend(statut, http.StatusForbidden, "paramètre réservé à l’admin", body)
	if body["code"] != "PARAMETRE_RESERVE_ADMIN" {
		t.Fatalf("code : %v", body["code"])
	}

	id := creerProspect(b, "Mbaye", numeroSenegalais(43))["id"].(string)
	statut, body = appelJSON(b, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"statut": "CONVERTI"}, nil)
	b.attend(statut, http.StatusForbidden, "NOUVEAU vers CONVERTI par le superviseur", body)
	if body["code"] != "PROSPECT_STATUT_TRANSITION_REFUSED" {
		t.Fatalf("code : %v", body["code"])
	}
	administrateur := autreCompte(b, "ADMIN")
	statut, body = appelJSON(administrateur, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"statut": "CONVERTI"}, nil)
	administrateur.attend(statut, http.StatusOK, "transition forcée par l’admin", body)
}

func TestPorteeVisitesArchivees(t *testing.T) {
	for role, attendu := range map[string]int{
		"ACCUEIL": http.StatusForbidden, "COMMERCIAL": http.StatusForbidden,
		"ADMIN": http.StatusForbidden, "DIRECTION": http.StatusOK,
	} {
		b := nouveauBanc(t, role)
		connecte(b)
		statut, body := appelRegistre(b, http.MethodGet, "/api/v1/visites?archivees=true", nil)
		b.attend(statut, attendu, "visites archivées pour "+role, body)
	}
}

func TestPorteeDispositionMontantsEtEnrolement(t *testing.T) {
	sonde := nouveauBanc(t, "ADMIN")
	if sonde.pool.QueryRow(sonde.ctx, `SELECT 1 FROM "app_settings" WHERE "key" = $1`,
		admin.CleDispositionDefaut("grand-public")).Scan(new(int)) == nil {
		t.Skip("une disposition par défaut réglée en base remplace la disposition d’usine")
	}
	for role, attendu := range map[string][2]bool{
		"ADMIN": {true, true}, "DIRECTION": {true, false},
		"SUPERVISEUR": {false, false}, "ACCUEIL": {false, false},
	} {
		b := nouveauBanc(t, role)
		connecte(b)
		statut, body := appelJSON(b, http.MethodGet, "/api/v1/tableaux-de-bord/grand-public/disposition", nil, nil)
		b.attend(statut, http.StatusOK, "disposition pour "+role, body)
		montants, enrolement := false, false
		widgets, _ := body["widgets"].([]any)
		for _, w := range widgets {
			source, _ := w.(map[string]any)["source"].(string)
			montants = montants || source == "encaisse"
			enrolement = enrolement || strings.HasPrefix(source, "enrolement-")
		}
		if montants != attendu[0] {
			t.Fatalf("%s : montants %v, attendu %v (%v)", role, montants, attendu[0], widgets)
		}
		if enrolement && !attendu[1] {
			t.Fatalf("%s : widgets d’enrôlement visibles (%v)", role, widgets)
		}
	}
}

func TestPorteeExportsDuTeleconseiller(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	voisin := autreCompte(b, "COMMERCIAL")
	jeu := exportSemer(voisin)

	statut, _, f := b.classeur("/api/v1/export/prospects.xlsx")
	b.attend(statut, http.StatusOK, "export prospects du téléconseiller", nil)
	exportAttendAbsent(t, f, jeu.prospect, jeu.nomRep)
	statut, _, f = b.classeur("/api/v1/export/representants.xlsx")
	b.attend(statut, http.StatusOK, "export représentants du téléconseiller", nil)
	exportAttendAbsent(t, f, jeu.representant, jeu.nomRep)

	b.exec(`UPDATE "prospects" SET "createdById" = $1, "deletedAt" = now() WHERE "id" = $2`, b.userID, jeu.prospect)
	statut, _, f = b.classeur("/api/v1/export/prospects.xlsx?includeDeleted=true")
	b.attend(statut, http.StatusOK, "export avec supprimées demandé par un téléconseiller", nil)
	exportAttendAbsent(t, f, jeu.prospect, "=SUM(1+1)")
}

func TestPorteeAnalyticsSupprimeesReserveesALAdmin(t *testing.T) {
	for role, attendu := range map[string]float64{"COMMERCIAL": 0, "SUPERVISEUR": 0, "ADMIN": 1} {
		t.Run(role, func(t *testing.T) {
			b := analyticsConnexion(t, role)
			jeu := analyticsSemer(b)
			fiche := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
			analyticsExec(b, `UPDATE "prospects" SET "deletedAt" = now() WHERE "id" = $1`, fiche)
			analyticsViderCache()
			statut, body := b.appel(http.MethodGet,
				"/api/v1/analytics/by-departement?includeDeleted=true&departementId="+jeu.departement, nil, false)
			b.attend(statut, http.StatusOK, "répartition avec supprimées", body)
			analyticsEgal(b, "fiche supprimée comptée", body["total"], attendu)
		})
	}
}

func TestPorteeReferentielsParListe(t *testing.T) {
	cas := []struct {
		role, methode, chemin string
		attendu               int
	}{
		{"COMMERCIAL", http.MethodGet, "/api/v1/referentiels/bank-rejection-reasons", http.StatusForbidden},
		{"BANQUE_FINANCE", http.MethodGet, "/api/v1/referentiels/bank-rejection-reasons", http.StatusOK},
		{"ACCUEIL", http.MethodGet, "/api/v1/referentiels/visite-objets", http.StatusOK},
		{"SUPERVISEUR", http.MethodPost, "/api/v1/referentiels/visite-objets", http.StatusForbidden},
		{"SUPERVISEUR", http.MethodPost, "/api/v1/referentiels/regions", http.StatusNotFound},
	}
	for _, c := range cas {
		b := nouveauBanc(t, c.role)
		connecte(b)
		statut, body := b.referentielsEnvoi(c.methode, c.chemin, map[string]any{"code": "X", "label": "X"})
		if c.methode == http.MethodGet {
			statut, body = appelJSON(b, c.methode, c.chemin, nil, nil)
		}
		b.attend(statut, c.attendu, c.role+" "+c.methode+" "+c.chemin, body)
	}
}
