//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/imports"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

func serviceDesImports(b *banc) *socle.Deps {
	b.t.Helper()
	cfg, err := socle.LireConfig()
	if err != nil {
		b.t.Fatal(err)
	}
	s := nouveauDeps(b.pool, cfg, socle.NouvelAnnuaire(cfg.Base))
	return s
}

// Un département actif : sans lui l'adaptateur refuse les 1 200 lignes.
func (b *banc) departementImport() (identifiant, nom string) {
	b.t.Helper()
	region, departement := uuid.NewString(), uuid.NewString()
	nom = "Département " + departement[:8]
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$2,$3,now())`,
		region, "R"+region[:8], "Région "+region[:8]); err != nil {
		b.t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$2,$3,$4,now())`,
		departement, "D"+departement[:8], nom, region); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "rep_call_attempts" WHERE "representantId" IN (SELECT "id" FROM "representants" WHERE "departementId" = $1)`, departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "departementId" = $1`, departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "departements" WHERE "id" = $1`, departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, region)
	})
	return departement, nom
}

func (b *banc) connecterImport() {
	b.t.Helper()
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
}

func (b *banc) purgerTravauxImport() {
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "requestedById" = $1`, b.userID)
	})
}

// En-tête en ligne 1, exemple en ligne 2, données à partir de la ligne 3.
func classeurRepresentants(t *testing.T, lignes [][]string) []byte {
	t.Helper()
	fichier := excelize.NewFile()
	defer func() { _ = fichier.Close() }()
	feuille := fichier.GetSheetName(0)
	for rang := range imports.ColonnesRepresentantsImport {
		cellule, _ := excelize.CoordinatesToCellName(rang+1, 1)
		if err := fichier.SetCellStr(feuille, cellule, imports.EnteteRepresentantImport(rang)); err != nil {
			t.Fatal(err)
		}
	}
	for index, ligne := range lignes {
		for rang, valeur := range ligne {
			cellule, _ := excelize.CoordinatesToCellName(rang+1, index+imports.PremiereLigneImport)
			if err := fichier.SetCellStr(feuille, cellule, valeur); err != nil {
				t.Fatal(err)
			}
		}
	}
	var tampon bytes.Buffer
	if err := fichier.Write(&tampon); err != nil {
		t.Fatal(err)
	}
	return tampon.Bytes()
}

func lignesRepresentants(departement string, nombre int, doublons map[int]int) [][]string {
	lignes := make([][]string, 0, nombre)
	for index := range nombre {
		source := index
		if origine, duplique := doublons[index]; duplique {
			source = origine
		}
		lignes = append(lignes, []string{
			fmt.Sprintf("Représentant %04d", index),
			fmt.Sprintf("77%07d", 1_000_000+source),
			departement,
		})
	}
	return lignes
}

func (b *banc) deposerClasseur(chemin, nom string, contenu []byte) (statut int, reponse map[string]any) {
	b.t.Helper()
	var corps bytes.Buffer
	ecrivain := multipart.NewWriter(&corps)
	partie, err := ecrivain.CreateFormFile("file", nom)
	if err != nil {
		b.t.Fatal(err)
	}
	if _, err := partie.Write(contenu); err != nil {
		b.t.Fatal(err)
	}
	if err := ecrivain.Close(); err != nil {
		b.t.Fatal(err)
	}
	requete, err := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+chemin, &corps)
	if err != nil {
		b.t.Fatal(err)
	}
	requete.Header.Set("Content-Type", ecrivain.FormDataContentType())
	requete.Header.Set("Origin", b.ts.URL)
	reponseHTTP, err := b.client.Do(requete)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = reponseHTTP.Body.Close() }()
	var corpsLu map[string]any
	_ = json.NewDecoder(reponseHTTP.Body).Decode(&corpsLu)
	return reponseHTTP.StatusCode, corpsLu
}

func (b *banc) attendreImport(identifiant, attendu string) map[string]any {
	b.t.Helper()
	for range 400 {
		statut, body := b.appel(http.MethodGet, "/api/v1/imports/"+identifiant, nil, false)
		b.attend(statut, http.StatusOK, "état de l’import", body)
		if body["status"] == attendu {
			return body
		}
		if body["status"] == "failed" && attendu != "failed" {
			b.t.Fatalf("import échoué : %v %v", body["failureCode"], body["failureMsg"])
		}
		time.Sleep(25 * time.Millisecond)
	}
	b.t.Fatalf("l’import n’a pas atteint l’état %q", attendu)
	return nil
}

func (b *banc) travailImport(chemin, mode string, traitees int) string {
	b.t.Helper()
	identifiant := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx, `INSERT INTO "import_jobs"
		("id","kind","status","mode","requestedById","fileName","fileBytes","storagePath",
		 "processedRows","expiresAt","updatedAt")
		VALUES ($1,'REPRESENTANTS','queued',$2,$3,'classeur.xlsx',0,$4,$5,now() + interval '1 hour',now())`,
		identifiant, mode, b.userID, chemin, traitees); err != nil {
		b.t.Fatal(err)
	}
	return identifiant
}

func (b *banc) compteRepresentants(departement string) int {
	b.t.Helper()
	var nombre int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "representants" WHERE "departementId" = $1`, departement).Scan(&nombre); err != nil {
		b.t.Fatal(err)
	}
	return nombre
}

func (b *banc) etatTravailImport(identifiant string) (statut string, creees, traitees int32) {
	b.t.Helper()
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "status","createdRows","processedRows" FROM "import_jobs" WHERE "id" = $1`,
		identifiant).Scan(&statut, &creees, &traitees); err != nil {
		b.t.Fatal(err)
	}
	return statut, creees, traitees
}

func ecrireClasseurSurDisque(t *testing.T, dossier string, contenu []byte) string {
	t.Helper()
	chemin := filepath.Join(dossier, uuid.NewString()+".xlsx")
	if err := os.WriteFile(chemin, contenu, 0o600); err != nil {
		t.Fatal(err)
	}
	return chemin
}

func TestImportRefuseUnFichierQuiNEstPasUnClasseur(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	b.connecterImport()
	b.purgerTravauxImport()

	statut, body := b.deposerClasseur("/api/v1/imports/representants", "faux.xlsx", []byte("nom;telephone\nFatou;770000000\n"))
	b.attend(statut, http.StatusBadRequest, "fichier refusé par son contenu", body)
	if body["code"] != "IMPORT_FILE_UNREADABLE" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestImportRepresentantsCompteLesDoublonsDuFichier(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	b.connecterImport()
	b.purgerTravauxImport()
	_, departement := b.departementImport()

	doublons := map[int]int{100: 0, 600: 1, 1100: 2}
	contenu := classeurRepresentants(t, lignesRepresentants(departement, 1_200, doublons))
	statut, body := b.deposerClasseur("/api/v1/imports/representants", "representants.xlsx", contenu)
	b.attend(statut, http.StatusCreated, "dépôt du classeur", body)
	if body["mode"] != "DRY_RUN" {
		t.Fatalf("un import naît en simulation : %v", body["mode"])
	}

	final := b.attendreImport(body["id"].(string), "succeeded")
	if final["createdRows"] != float64(1_197) || final["skippedRows"] != float64(3) || final["processedRows"] != float64(1_200) {
		t.Fatalf("compteurs : créées %v, ignorées %v, traitées %v", final["createdRows"], final["skippedRows"], final["processedRows"])
	}
	rapport, ok := final["report"].(map[string]any)
	if !ok {
		t.Fatalf("rapport absent : %v", final)
	}
	erreurs, _ := rapport["errors"].([]any)
	if len(erreurs) != 3 {
		t.Fatalf("le rapport doit nommer les 3 doublons : %v", erreurs)
	}
	for _, brute := range erreurs {
		erreur := brute.(map[string]any)
		if erreur["code"] != "DUPLICATE_IN_FILE" || erreur["rowNumber"] == float64(0) {
			t.Fatalf("erreur de ligne incomplète : %v", erreur)
		}
	}
}

func (b *banc) exigerTravailImport(identifiant, statut string, creees, traitees int32, quoi string) {
	b.t.Helper()
	vuStatut, vuCreees, vuTraitees := b.etatTravailImport(identifiant)
	if vuStatut != statut || vuCreees != creees || vuTraitees != traitees {
		b.t.Fatalf("%s : %s, %d créées, %d traitées", quoi, vuStatut, vuCreees, vuTraitees)
	}
}

func TestImportBailVivantPuisBailExpire(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.purgerTravauxImport()
	identifiantDepartement, departement := b.departementImport()
	moteur := serviceDesImports(b)

	chemin := ecrireClasseurSurDisque(t, t.TempDir(), classeurRepresentants(t, lignesRepresentants(departement, 6, nil)))
	travail := b.travailImport(chemin, "APPLY", 0)

	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "import_jobs" SET "status"='running', "claimToken"='vole', "claimedAt"=now() WHERE "id" = $1`, travail); err != nil {
		t.Fatal(err)
	}
	if err := imports.CourirImport(b.ctx, moteur, travail); err != nil {
		t.Fatal(err)
	}
	if compte := b.compteRepresentants(identifiantDepartement); compte != 0 {
		t.Fatalf("un bail vivant interdit toute écriture : %d fiches", compte)
	}

	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "import_jobs" SET "claimedAt" = now() - interval '20 minutes' WHERE "id" = $1`, travail); err != nil {
		t.Fatal(err)
	}
	if err := imports.CourirImport(b.ctx, moteur, travail); err != nil {
		t.Fatal(err)
	}
	b.exigerTravailImport(travail, "succeeded", 6, 6, "bail expiré repris")
}

// Reprise à `processedRows` : les deux dernières lignes sont rejouées et aucune
// fiche n'est recréée.
func TestImportRepriseParTranchesSansDoublon(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.purgerTravauxImport()
	identifiantDepartement, departement := b.departementImport()
	moteur := serviceDesImports(b)

	chemin := ecrireClasseurSurDisque(t, t.TempDir(), classeurRepresentants(t, lignesRepresentants(departement, 6, nil)))
	complet := b.travailImport(chemin, "APPLY", 0)
	if err := imports.CourirImport(b.ctx, moteur, complet); err != nil {
		t.Fatal(err)
	}
	b.exigerTravailImport(complet, "succeeded", 6, 6, "première passe")

	reprise := b.travailImport(chemin, "APPLY", 4)
	if err := imports.CourirImport(b.ctx, moteur, reprise); err != nil {
		t.Fatal(err)
	}
	b.exigerTravailImport(reprise, "succeeded", 0, 6, "reprise")
	if compte := b.compteRepresentants(identifiantDepartement); compte != 6 {
		t.Fatalf("la reprise a dupliqué des fiches : %d", compte)
	}
}

func TestImportDeuxBalayagesNeTraitentPasDeuxFoisLeMemeTravail(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	dossier := t.TempDir()
	b.purgerTravauxImport()
	identifiantDepartement, departement := b.departementImport()
	moteur := serviceDesImports(b)

	chemin := ecrireClasseurSurDisque(t, dossier, classeurRepresentants(t, lignesRepresentants(departement, 6, nil)))
	travail := b.travailImport(chemin, "APPLY", 0)

	fini := make(chan error, 2)
	for range 2 {
		go func() { fini <- imports.CourirImport(b.ctx, moteur, travail) }()
	}
	for range 2 {
		if err := <-fini; err != nil {
			t.Fatal(err)
		}
	}
	statut, creees, traitees := b.etatTravailImport(travail)
	if statut != "succeeded" || creees != 6 || traitees != 6 {
		t.Fatalf("un seul travailleur doit aboutir : %s, %d créées, %d traitées", statut, creees, traitees)
	}
	if compte := b.compteRepresentants(identifiantDepartement); compte != 6 {
		t.Fatalf("le travail a été traité deux fois : %d fiches", compte)
	}
}

func TestImportEchuEstExpireEtSonClasseurDetruit(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	dossier := t.TempDir()
	b.purgerTravauxImport()
	moteur := serviceDesImports(b)

	chemin := ecrireClasseurSurDisque(t, dossier, []byte("PK\x03\x04 classeur"))
	travail := b.travailImport(chemin, "DRY_RUN", 0)
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "import_jobs" SET "expiresAt" = now() - interval '1 hour', "report" = '{"errors":[]}'::jsonb WHERE "id" = $1`, travail); err != nil {
		t.Fatal(err)
	}
	if err := imports.BalayerImports(b.ctx, moteur); err != nil {
		t.Fatal(err)
	}

	var statut string
	var rapport []byte
	if err := b.pool.QueryRow(b.ctx, `SELECT "status","report" FROM "import_jobs" WHERE "id" = $1`, travail).Scan(&statut, &rapport); err != nil {
		t.Fatal(err)
	}
	if statut != "expired" || rapport != nil {
		t.Fatalf("échéance : statut %s, rapport %s", statut, rapport)
	}
	if _, err := os.Stat(chemin); !os.IsNotExist(err) {
		t.Fatalf("le classeur échu doit être détruit : %v", err)
	}
}

// Numéros propres à la course : l'index d'unicité du téléphone est global, et
// plusieurs exécutions partagent la base.
func lignesRepresentantsDeCourse(departement string, nombre, doublon int) [][]string {
	base := int(time.Now().UnixNano() % 3_000_000)
	lignes := make([][]string, 0, nombre)
	for index := range nombre {
		rang := index
		if index == doublon {
			rang = 0
		}
		lignes = append(lignes, []string{
			fmt.Sprintf("Représentant %04d", rang),
			fmt.Sprintf("77%07d", 3_000_000+base+rang),
			departement,
		})
	}
	return lignes
}

func rapportImportRepresentants(b *banc, requete string, contenu []byte) map[string]any {
	b.t.Helper()
	statut, body := b.deposerClasseur("/api/v1/representants/import"+requete, "representants.xlsx", contenu)
	b.attend(statut, http.StatusOK, "rapport d’import", body)
	return body
}

func exigerApercuImport(b *banc, rapport map[string]any, departement string) {
	b.t.Helper()
	apercu, _ := rapport["preview"].([]any)
	if len(apercu) != 3 {
		b.t.Fatalf("aperçu : %v", rapport["preview"])
	}
	premiere := apercu[0].(map[string]any)
	if numero, _ := premiere["phoneE164"].(string); numero == "" {
		b.t.Fatalf("la ligne d’aperçu doit porter le numéro normalisé : %v", premiere)
	}
	exigerChampsJSON(b, premiere, map[string]string{
		"departementName": departement, "relationStatus": "INCONNU", "whatsappStatus": "NON_DEMANDE",
	}, "ligne d’aperçu")
	erreurs, _ := rapport["errors"].([]any)
	if len(erreurs) != 1 {
		b.t.Fatalf("erreurs : %v", rapport["errors"])
	}
	exigerChampsJSON(b, erreurs[0].(map[string]any), map[string]string{"code": "DUPLICATE_IN_FILE"}, "erreur de doublon")
}

func TestImportRepresentantsRapportSynchrone(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.connecterImport()
	identifiant, departement := b.departementImport()
	contenu := classeurRepresentants(t, lignesRepresentantsDeCourse(departement, 4, 3))

	simulation := rapportImportRepresentants(b, "", contenu)
	exigerChampsJSON(b, simulation, map[string]string{
		"dryRun": "true", "totalRows": "4", "valid": "3",
		"duplicates": "1", "rejected": "1", "created": "0",
	}, "simulation")
	exigerApercuImport(b, simulation, departement)
	if compte := b.compteRepresentants(identifiant); compte != 0 {
		t.Fatalf("une simulation n’écrit rien : %d fiches", compte)
	}

	applique := rapportImportRepresentants(b, "?dryRun=false", contenu)
	exigerChampsJSON(b, applique, map[string]string{"dryRun": "false", "created": "3", "valid": "3"}, "application")
	if compte := b.compteRepresentants(identifiant); compte != 3 {
		t.Fatalf("les trois fiches doivent être écrites : %d", compte)
	}

	rejoue := rapportImportRepresentants(b, "?dryRun=false&enrichir=true", contenu)
	exigerChampsJSON(b, rejoue, map[string]string{
		"created": "0", "valid": "0", "duplicates": "4", "enriched": "0",
	}, "rejeu du même classeur")
	if compte := b.compteRepresentants(identifiant); compte != 3 {
		t.Fatalf("le rejeu ne doit rien ajouter : %d", compte)
	}
}

func TestImportRepresentantsRapportInterditAuTeleconseiller(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	b.connecterImport()

	statut, body := b.deposerClasseur("/api/v1/representants/import", "representants.xlsx", []byte("PK\x03\x04"))
	b.attend(statut, http.StatusForbidden, "import par un téléconseiller", body)
}

func TestImportInterditAuTeleconseiller(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	b.connecterImport()

	statut, body := b.deposerClasseur("/api/v1/imports/representants", "representants.xlsx", []byte("PK\x03\x04"))
	b.attend(statut, http.StatusForbidden, "dépôt par un téléconseiller", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/imports", nil, false)
	b.attend(statut, http.StatusForbidden, "liste par un téléconseiller", body)
}

// La forme d'un export de campagne : en-tête en ligne 1, données dès la ligne 2.
func classeurLeads(t *testing.T, telephone string) []byte {
	t.Helper()
	fichier := excelize.NewFile()
	feuille := fichier.GetSheetName(0)
	lignes := [][]string{
		{"Date", "Nom complet", "Email", "Téléphone", "Canal"},
		{"10/09/2026", "Fatou Relevée", "fatou." + telephone[4:] + "@example.sn", telephone, "https://monespace.cpi.sn/"},
	}
	for rang, ligne := range lignes {
		for index, valeur := range ligne {
			cellule, _ := excelize.CoordinatesToCellName(index+1, rang+1)
			_ = fichier.SetCellValue(feuille, cellule, valeur)
		}
	}
	var buf bytes.Buffer
	if err := fichier.Write(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// Le lien SharePoint, joué en local : une redirection qui pose un cookie, puis
// le classeur, comme le vrai. Le nom du classeur est propre au test : le vrai
// relevé écrit dans la même base.
func (b *banc) lienDesLeads(classeur []byte, nomFichier string) string {
	b.t.Helper()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/partage" {
			http.SetCookie(w, &http.Cookie{Name: "FedAuth", Value: "jeton"})
			http.Redirect(w, r, "/sites/CPI/"+url.PathEscape(nomFichier)+"?ga=1", http.StatusFound)
			return
		}
		if c, err := r.Cookie("FedAuth"); err != nil || c.Value != "jeton" {
			http.Error(w, "connexion requise", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		_, _ = w.Write(classeur)
	}))
	b.t.Cleanup(source.Close)
	return source.URL + "/partage?e=abc"
}

func (b *banc) ficheDuLead(telephone string) (projet, canal string, travail *string) {
	b.t.Helper()
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."projet"::text, COALESCE(c."label", ''), p."importJobId"
		   FROM "prospects" p LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
		  WHERE p."phoneE164" = $1`, telephone).Scan(&projet, &canal, &travail); err != nil {
		b.t.Fatalf("la fiche du lead doit exister : %v", err)
	}
	return projet, canal, travail
}

func (b *banc) travauxDuClasseur(nom string) int {
	b.t.Helper()
	var travaux int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "import_jobs" WHERE "fileName" = $1`, nom).Scan(&travaux); err != nil {
		b.t.Fatal(err)
	}
	return travaux
}

func TestImportReleveLesLeadsDepuisLeLien(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	telephone := fmt.Sprintf("+22177%07d", time.Now().UnixNano()%10_000_000)
	nomClasseurLeads := "Leads test " + telephone[6:] + ".xlsx"
	t.Setenv("IMPORT_LEADS_URL", b.lienDesLeads(classeurLeads(t, telephone), nomClasseurLeads))
	// L'empreinte est un réglage unique : celle du vrai relevé est remise après.
	var empreinteAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`).Scan(&empreinteAvant)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = $1)`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "fileName" = $1`, nomClasseurLeads)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`)
		if empreinteAvant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('imports.leadsEmpreinte', $1, now())`, *empreinteAvant)
		}
	})
	moteur := serviceDesImports(b)

	if err := imports.ReleverLeads(b.ctx, moteur); err != nil {
		t.Fatal(err)
	}
	projet, canal, travail := b.ficheDuLead(telephone)
	if projet != "GRAND_PUBLIC" || canal != "Site web" || travail == nil {
		t.Fatalf("fiche %s, canal %q, import %v", projet, canal, travail)
	}
	if statut, creees, _ := b.etatTravailImport(*travail); statut != "succeeded" || creees != 1 {
		t.Fatalf("travail %s, %d créée(s)", statut, creees)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "courriels" WHERE "objetType" = 'import' AND "objetId" = $1`, *travail)
	})
	var sujet string
	if err := b.pool.QueryRow(b.ctx, `SELECT "sujet" FROM "courriels" WHERE "type" = 'IMPORT_LEADS' AND "objetId" = $1`, *travail).Scan(&sujet); err != nil {
		t.Fatalf("le bilan du relevé doit partir en courriel : %v", err)
	}
	if !strings.HasPrefix(sujet, "[Leads] Relevé des leads importé : ") {
		t.Fatalf("sujet : %s", sujet)
	}

	if err := imports.ReleverLeads(b.ctx, moteur); err != nil {
		t.Fatal(err)
	}
	if travaux := b.travauxDuClasseur(nomClasseurLeads); travaux != 1 {
		t.Fatalf("un classeur inchangé ne se rejoue pas : %d travaux", travaux)
	}
}
