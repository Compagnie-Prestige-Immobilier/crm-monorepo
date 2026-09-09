//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

func appelRegistre(b *banc, methode, chemin string, corps any) (statut int, reponse map[string]any) {
	b.t.Helper()
	var tampon bytes.Buffer
	if corps != nil {
		if err := json.NewEncoder(&tampon).Encode(corps); err != nil {
			b.t.Fatal(err)
		}
	}
	req, err := http.NewRequestWithContext(b.ctx, methode, b.ts.URL+chemin, &tampon)
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

// Un banc connecté, ses quatre listes de référence et le nettoyage de tout ce
// que le test écrit dans le registre.
type bancRegistre struct {
	*banc
	entreprise, objet, direction, destinataire string
}

func nouveauBancRegistre(t *testing.T, role string) *bancRegistre {
	t.Helper()
	b := nouveauBanc(t, role)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	br := &bancRegistre{banc: b}
	suffixe := strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	for _, liste := range []struct {
		table, code string
		cible       *string
	}{
		{"visite_entreprises", "ENT_" + suffixe, &br.entreprise},
		{"visite_objets", "OBJ_" + suffixe, &br.objet},
		{"visite_directions", "DIR_" + suffixe, &br.direction},
		{"visite_destinataires", "DEST_" + suffixe, &br.destinataire},
	} {
		id := uuid.NewString()
		*liste.cible = id
		_, err := b.pool.Exec(b.ctx,
			`INSERT INTO "`+liste.table+`" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`,
			id, liste.code, "Test "+liste.code)
		if err != nil {
			t.Fatal(err)
		}
		table, valeur := liste.table, id
		t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "`+table+`" WHERE "id" = $1`, valeur) })
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "requestedById" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "visites" WHERE "createdById" = $1`, b.userID)
	})
	return br
}

func (br *bancRegistre) creerVisite(jour, heure, nom, telephone string) map[string]any {
	br.t.Helper()
	corps := map[string]any{
		"date": jour, "visitorName": nom,
		"entrepriseId": br.entreprise, "objetId": br.objet,
	}
	if heure != "" {
		corps["time"] = heure
	}
	if telephone != "" {
		corps["phone"] = telephone
	}
	statut, body := appelRegistre(br.banc, http.MethodPost, "/api/v1/visites", corps)
	br.attend(statut, http.StatusCreated, "création de visite", body)
	return body
}

func TestAccueilVisiteCreeeAvecReferenceUniqueEtTelephoneCanonique(t *testing.T) {
	br := nouveauBancRegistre(t, "ACCUEIL")
	premiere := br.creerVisite("2019-03-04", "11:08", "MOUHAMED FALL", "78 454 44 66")
	seconde := br.creerVisite("2019-03-04", "", "AMINATA SOW", "")

	if premiere["phoneE164"] != "+221784544466" {
		t.Fatalf("phoneE164 : %v", premiere["phoneE164"])
	}
	if premiere["time"] != "11:08" || seconde["time"] != nil {
		t.Fatalf("heure relevée puis absente : %v et %v", premiere["time"], seconde["time"])
	}
	refPremiere, _ := premiere["reference"].(string)
	refSeconde, _ := seconde["reference"].(string)
	if !strings.HasPrefix(refPremiere, "V-2019-") || len(refPremiere) != 13 {
		t.Fatalf("référence : %q", refPremiere)
	}
	rang1, err1 := strconv.Atoi(refPremiere[7:])
	rang2, err2 := strconv.Atoi(refSeconde[7:])
	if err1 != nil || err2 != nil || rang2 != rang1+1 {
		t.Fatalf("la suite du registre doit avancer d’un rang : %q puis %q", refPremiere, refSeconde)
	}

	statut, body := appelRegistre(br.banc, http.MethodGet, "/api/v1/visites?from=2019-03-04&to=2019-03-04", nil)
	br.attend(statut, http.StatusOK, "liste du jour", body)
	if meta := body["meta"].(map[string]any); meta["total"].(float64) != 2 {
		t.Fatalf("la liste filtrée doit rendre les deux visites : %v", meta)
	}
}

func TestAccueilCorrectionEffaceEtLaisseEnPlace(t *testing.T) {
	br := nouveauBancRegistre(t, "DIRECTION")
	visite := br.creerVisite("2019-04-10", "09:30", "FATOU DIOP", "781112233")
	id := visite["id"].(string)
	statut, body := appelRegistre(br.banc, http.MethodPatch, "/api/v1/visites/"+id,
		map[string]any{"destinataireId": br.destinataire, "comment": "Reçue au comptoir"})
	br.attend(statut, http.StatusOK, "destinataire et note posés", body)

	statut, body = appelRegistre(br.banc, http.MethodPatch, "/api/v1/visites/"+id,
		map[string]any{"time": nil, "destinataireId": nil})
	br.attend(statut, http.StatusOK, "heure et destinataire effacés", body)
	if body["time"] != nil || body["destinataire"] != nil {
		t.Fatalf("NUL doit effacer : %v et %v", body["time"], body["destinataire"])
	}
	if body["visitorName"] != "FATOU DIOP" || body["phone"] != "781112233" || body["comment"] != "Reçue au comptoir" {
		t.Fatalf("ABSENT doit laisser en place : %v, %v, %v", body["visitorName"], body["phone"], body["comment"])
	}
	if body["date"] != "2019-04-10" {
		t.Fatalf("effacer l’heure garde le jour : %v", body["date"])
	}
}

func TestAccueilReferentielRetireRefuse(t *testing.T) {
	br := nouveauBancRegistre(t, "ACCUEIL")
	if _, err := br.pool.Exec(br.ctx, `UPDATE "visite_objets" SET "isActive" = false WHERE "id" = $1`, br.objet); err != nil {
		t.Fatal(err)
	}
	statut, body := appelRegistre(br.banc, http.MethodPost, "/api/v1/visites", map[string]any{
		"date": "2019-05-02", "visitorName": "OUSMANE BA",
		"entrepriseId": br.entreprise, "objetId": br.objet,
	})
	br.attend(statut, http.StatusBadRequest, "entrée retirée des listes", body)
	if body["code"] != "VISITE_REFERENTIEL_UNAVAILABLE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestAccueilRegistreInterditAuCommercial(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	statut, body = appelRegistre(b, http.MethodGet, "/api/v1/visites", nil)
	b.attend(statut, http.StatusForbidden, "le registre n’est pas ouvert au COMMERCIAL", body)
	statut, body = appelRegistre(b, http.MethodPost, "/api/v1/visites/import", nil)
	b.attend(statut, http.StatusForbidden, "l’aller-retour Excel n’est ouvert qu’à ADMIN et DIRECTION", body)
}

func TestAccueilStatistiquesComptentParJour(t *testing.T) {
	br := nouveauBancRegistre(t, "ACCUEIL")
	br.creerVisite("2019-06-03", "10:00", "PREMIER VISITEUR", "")
	br.creerVisite("2019-06-03", "", "SECOND VISITEUR", "")
	br.creerVisite("2019-06-05", "14:30", "PREMIER VISITEUR", "")

	statut, body := appelRegistre(br.banc, http.MethodGet, "/api/v1/visites/statistiques?from=2019-06-01&to=2019-06-30", nil)
	br.attend(statut, http.StatusOK, "statistiques", body)
	if body["total"].(float64) != 3 || body["sansHeure"].(float64) != 1 {
		t.Fatalf("total et heures relevées : %v", body)
	}
	parJour := map[string]float64{}
	for _, point := range body["parJour"].([]any) {
		p := point.(map[string]any)
		parJour[p["date"].(string)] = p["count"].(float64)
	}
	if parJour["2019-06-03"] != 2 || parJour["2019-06-05"] != 1 {
		t.Fatalf("le widget par-jour compte mal : %v", parJour)
	}
	if len(body["parMois"].([]any)) != 1 || len(body["parHeure"].([]any)) != 24 {
		t.Fatalf("chaque mois de la période et les 24 heures : %v", body["parMois"])
	}
	recurrents := body["recurrents"].([]any)
	if len(recurrents) != 1 || recurrents[0].(map[string]any)["nom"] != "PREMIER VISITEUR" {
		t.Fatalf("le visiteur vu deux fois doit être récurrent : %v", recurrents)
	}
}

func TestAccueilStatistiquesRefusentUnePeriodeInverseeOuTropLarge(t *testing.T) {
	br := nouveauBancRegistre(t, "ACCUEIL")
	statut, body := appelRegistre(br.banc, http.MethodGet, "/api/v1/visites/statistiques?from=2019-06-30&to=2019-06-01", nil)
	br.attend(statut, http.StatusBadRequest, "période inversée", body)
	if body["code"] != "VISITE_STATS_RANGE_INVALID" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = appelRegistre(br.banc, http.MethodGet, "/api/v1/visites/statistiques?from=2019-01-01&to=2021-01-01", nil)
	br.attend(statut, http.StatusBadRequest, "période trop large", body)
	if body["code"] != "VISITE_STATS_RANGE_TOO_WIDE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func classeurRegistre(t *testing.T, lignes [][]string) []byte {
	t.Helper()
	f := excelize.NewFile()
	if err := f.SetSheetName(f.GetSheetName(0), "Registre"); err != nil {
		t.Fatal(err)
	}
	entetes := []string{
		"N° REGISTRE", "DATE VISITE", "HEURE VISITE", "PRENOM ET NOMS", "TELEPHONES",
		"ENTREPRISE", "DIRECTION", "DESTINATAIRES", "OBJET VISITE", "COMMENTAIRES / NOTES", "SAISIE LE",
	}
	ecrire := func(numero int, valeurs []string) {
		for index, valeur := range valeurs {
			cellule, err := excelize.CoordinatesToCellName(index+1, numero)
			if err != nil {
				t.Fatal(err)
			}
			if err := f.SetCellStr("Registre", cellule, valeur); err != nil {
				t.Fatal(err)
			}
		}
	}
	ecrire(1, entetes)
	ecrire(2, []string{"Rappel : ne renommez pas cet onglet."})
	for index, ligne := range lignes {
		ecrire(3+index, ligne)
	}
	var tampon bytes.Buffer
	if err := f.Write(&tampon); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return tampon.Bytes()
}

func (br *bancRegistre) deposer(contenu []byte) (statut int, reponse map[string]any) {
	br.t.Helper()
	var tampon bytes.Buffer
	formulaire := multipart.NewWriter(&tampon)
	partie, err := formulaire.CreateFormFile("file", "registre.xlsx")
	if err != nil {
		br.t.Fatal(err)
	}
	if _, err := partie.Write(contenu); err != nil {
		br.t.Fatal(err)
	}
	if err := formulaire.Close(); err != nil {
		br.t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(br.ctx, http.MethodPost, br.ts.URL+"/api/v1/visites/import", &tampon)
	if err != nil {
		br.t.Fatal(err)
	}
	req.Header.Set("Content-Type", formulaire.FormDataContentType())
	req.Header.Set("Origin", br.ts.URL)
	resp, err := br.client.Do(req)
	if err != nil {
		br.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func TestAccueilImportRefuseCeQuiNestPasUnClasseur(t *testing.T) {
	br := nouveauBancRegistre(t, "ADMIN")
	statut, body := br.deposer([]byte("date;nom\n2019-01-01;MOUSSA\n"))
	br.attend(statut, http.StatusBadRequest, "un CSV renommé en .xlsx", body)
	if body["code"] != "IMPORT_FILE_UNREADABLE" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = br.deposer(append([]byte("PK\x03\x04"), 0x00, 0x01, 0x02))
	br.attend(statut, http.StatusBadRequest, "une archive qui n’est pas un classeur", body)
	if body["code"] != "IMPORT_FILE_UNREADABLE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestAccueilImportNAppliqueQueLesLignesCochees(t *testing.T) {
	br := nouveauBancRegistre(t, "ADMIN")
	entreprise, objet := "Test "+codeDe(t, br, "visite_entreprises", br.entreprise), "Test "+codeDe(t, br, "visite_objets", br.objet)
	classeur := classeurRegistre(t, [][]string{
		{"", "07/07/2019", "09:15", "ADAMA NDIAYE", "", entreprise, "", "", objet, ""},
		{"", "07/07/2019", "10:45", "BINETA SARR", "", entreprise, "", "", objet, ""},
	})
	statut, job := br.deposer(classeur)
	br.attend(statut, http.StatusCreated, "dépôt du classeur", job)
	if job["status"] != "succeeded" || job["createdRows"].(float64) != 2 {
		t.Fatalf("la simulation doit annoncer deux créations : %v", job)
	}
	jobID := job["id"].(string)

	aRetirer := br.creationCochee(jobID, "BINETA SARR", 2)
	statut, body := appelRegistre(br.banc, http.MethodPatch, "/api/v1/visites/import/"+jobID+"/revue",
		map[string]any{"ids": []string{aRetirer}, "selected": false})
	br.attend(statut, http.StatusOK, "décocher une ligne", body)

	statut, applique := appelRegistre(br.banc, http.MethodPost, "/api/v1/visites/import/"+jobID+"/apply", nil)
	br.attend(statut, http.StatusOK, "validation", applique)
	if applique["createdRows"].(float64) != 1 || applique["skippedRows"].(float64) != 1 {
		t.Fatalf("seule la ligne cochée s’écrit : %v", applique)
	}
	if compteVisites(t, br) != 1 {
		t.Fatalf("une seule visite doit être au registre, %d trouvée(s)", compteVisites(t, br))
	}

	statut, body = appelRegistre(br.banc, http.MethodPost, "/api/v1/visites/import/"+jobID+"/apply", nil)
	br.attend(statut, http.StatusConflict, "seconde validation", body)
	if body["code"] != "IMPORT_NOT_APPLICABLE" || compteVisites(t, br) != 1 {
		t.Fatalf("une seconde validation ne duplique rien : %v, %d visite(s)", body["code"], compteVisites(t, br))
	}
}

func TestAccueilImportCorrigeEtJournaliseLaCorrection(t *testing.T) {
	br := nouveauBancRegistre(t, "ADMIN")
	visite := br.creerVisite("2019-08-12", "14:30", "MME LY SEYNABOU", "")
	entreprise, objet := "Test "+codeDe(t, br, "visite_entreprises", br.entreprise), "Test "+codeDe(t, br, "visite_objets", br.objet)
	classeur := classeurRegistre(t, [][]string{
		{visite["reference"].(string), "12/08/2019", "14:30", "MME LY SEYNABOU FALL", "", entreprise, "", "", objet, "Corrigé au bureau"},
	})
	statut, job := br.deposer(classeur)
	br.attend(statut, http.StatusCreated, "dépôt", job)
	if job["updatedRows"].(float64) != 1 {
		t.Fatalf("la simulation doit voir une réécriture : %v", job)
	}
	jobID := job["id"].(string)

	br.reecritureRevue(jobID, visite["id"].(string))

	statut, applique := appelRegistre(br.banc, http.MethodPost, "/api/v1/visites/import/"+jobID+"/apply", nil)
	br.attend(statut, http.StatusOK, "validation", applique)
	if applique["updatedRows"].(float64) != 1 {
		t.Fatalf("la correction doit s’appliquer : %v", applique)
	}
	statut, relue := appelRegistre(br.banc, http.MethodGet, "/api/v1/visites/"+visite["id"].(string), nil)
	br.attend(statut, http.StatusOK, "relecture", relue)
	if relue["visitorName"] != "MME LY SEYNABOU FALL" || relue["comment"] != "Corrigé au bureau" {
		t.Fatalf("la ligne corrigée : %v", relue)
	}

	action, entite, avant := br.audit(visite["id"].(string))
	if action != "visite.registre_correction" || entite != "visite" || !bytes.Contains(avant, []byte("MME LY SEYNABOU")) {
		t.Fatalf("la correction doit être journalisée avec son avant : %s %s %s", action, entite, avant)
	}
}

func TestAccueilImportRefuseUnNumeroInconnu(t *testing.T) {
	br := nouveauBancRegistre(t, "ADMIN")
	entreprise, objet := "Test "+codeDe(t, br, "visite_entreprises", br.entreprise), "Test "+codeDe(t, br, "visite_objets", br.objet)
	classeur := classeurRegistre(t, [][]string{
		{"V-2019-999998", "09/09/2019", "", "ABDOU KANE", "", entreprise, "", "", objet, ""},
	})
	statut, job := br.deposer(classeur)
	br.attend(statut, http.StatusCreated, "dépôt", job)
	if job["errorRows"].(float64) != 1 || job["createdRows"].(float64) != 0 {
		t.Fatalf("un numéro inconnu est refusé, jamais replié sur une création : %v", job)
	}
	rapport := job["report"].(map[string]any)
	erreur := rapport["errors"].([]any)[0].(map[string]any)
	if erreur["code"] != "VISITE_IMPORT_REGISTRE_NUMERO_INCONNU" {
		t.Fatalf("code : %v", erreur["code"])
	}
}

// Une réécriture désigne la visite existante et porte l'empreinte de l'état revu.
func (br *bancRegistre) reecritureRevue(jobID, visiteID string) {
	br.t.Helper()
	ligne := br.revue(jobID)[0].(map[string]any)
	if ligne["kind"] != "UPDATE" || ligne["visiteId"] != visiteID {
		br.t.Fatalf("la ligne doit désigner la visite existante : %v", ligne)
	}
	var empreinte *string
	err := br.pool.QueryRow(br.ctx, `SELECT "rowHash" FROM "visite_import_changes" WHERE "id" = $1`, ligne["id"]).Scan(&empreinte)
	if err != nil {
		br.t.Fatal(err)
	}
	if empreinte == nil || len(*empreinte) != 64 {
		br.t.Fatalf("une réécriture porte l’empreinte de l’état revu : %v", empreinte)
	}
}

// Les créations de la revue sont cochées et portent leurs champs ; rend
// l'identifiant de celle que le test veut retirer.
func (br *bancRegistre) creationCochee(jobID, etiquette string, attendues int) string {
	br.t.Helper()
	lignes := br.revue(jobID)
	if len(lignes) != attendues {
		br.t.Fatalf("la revue doit lister %d ligne(s) : %v", attendues, lignes)
	}
	vise := ""
	for _, ligne := range lignes {
		l := ligne.(map[string]any)
		coche, _ := l["selected"].(bool)
		if l["kind"] != "CREATE" || !coche || len(l["fields"].([]any)) == 0 {
			br.t.Fatalf("une création est cochée par défaut et porte ses champs : %v", l)
		}
		if strings.HasPrefix(l["label"].(string), etiquette) {
			vise = l["id"].(string)
		}
	}
	return vise
}

func (br *bancRegistre) revue(jobID string) []any {
	br.t.Helper()
	statut, body := appelRegistre(br.banc, http.MethodGet, "/api/v1/visites/import/"+jobID+"/revue", nil)
	br.attend(statut, http.StatusOK, "revue", body)
	return body["items"].([]any)
}

// L'audit de la correction : action, entité et état d'avant.
func (br *bancRegistre) audit(visiteID string) (action, entite string, avant []byte) {
	br.t.Helper()
	err := br.pool.QueryRow(br.ctx,
		`SELECT "action", "entity", "before" FROM "audit_logs" WHERE "userId" = $1 AND "entityId" = $2`,
		br.userID, visiteID).Scan(&action, &entite, &avant)
	if err != nil {
		br.t.Fatal(err)
	}
	return action, entite, avant
}

func codeDe(t *testing.T, br *bancRegistre, table, id string) string {
	t.Helper()
	var code string
	if err := br.pool.QueryRow(br.ctx, `SELECT "code" FROM "`+table+`" WHERE "id" = $1`, id).Scan(&code); err != nil {
		t.Fatal(err)
	}
	return code
}

func compteVisites(t *testing.T, br *bancRegistre) int {
	t.Helper()
	debut, err := time.Parse("2006-01-02", "2019-07-07")
	if err != nil {
		t.Fatal(err)
	}
	var total int
	err = br.pool.QueryRow(br.ctx,
		`SELECT count(*)::int FROM "visites" WHERE "createdById" = $1 AND "visitedAt" >= $2 AND "visitedAt" < $3`,
		br.userID, debut, debut.AddDate(0, 0, 1)).Scan(&total)
	if err != nil {
		t.Fatal(err)
	}
	return total
}
