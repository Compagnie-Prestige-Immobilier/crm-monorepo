//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

func serviceDesImports(b *banc) *service {
	b.t.Helper()
	cfg, err := lireConfig()
	if err != nil {
		b.t.Fatal(err)
	}
	s, err := nouveauService(b.pool, cfg)
	if err != nil {
		b.t.Fatal(err)
	}
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
	for rang, colonne := range colonnesRepresentantsImport {
		cellule, _ := excelize.CoordinatesToCellName(rang+1, 1)
		if err := fichier.SetCellStr(feuille, cellule, colonne.entete); err != nil {
			t.Fatal(err)
		}
	}
	for index, ligne := range lignes {
		for rang, valeur := range ligne {
			cellule, _ := excelize.CoordinatesToCellName(rang+1, index+premiereLigneImport)
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
	if err := moteur.courirImport(b.ctx, travail); err != nil {
		t.Fatal(err)
	}
	if compte := b.compteRepresentants(identifiantDepartement); compte != 0 {
		t.Fatalf("un bail vivant interdit toute écriture : %d fiches", compte)
	}

	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "import_jobs" SET "claimedAt" = now() - interval '20 minutes' WHERE "id" = $1`, travail); err != nil {
		t.Fatal(err)
	}
	if err := moteur.courirImport(b.ctx, travail); err != nil {
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
	if err := moteur.courirImport(b.ctx, complet); err != nil {
		t.Fatal(err)
	}
	b.exigerTravailImport(complet, "succeeded", 6, 6, "première passe")

	reprise := b.travailImport(chemin, "APPLY", 4)
	if err := moteur.courirImport(b.ctx, reprise); err != nil {
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
		go func() { fini <- moteur.courirImport(b.ctx, travail) }()
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
	if err := moteur.balayerImports(b.ctx); err != nil {
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

func TestImportInterditAuTeleconseiller(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	b.connecterImport()

	statut, body := b.deposerClasseur("/api/v1/imports/representants", "representants.xlsx", []byte("PK\x03\x04"))
	b.attend(statut, http.StatusForbidden, "dépôt par un téléconseiller", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/imports", nil, false)
	b.attend(statut, http.StatusForbidden, "liste par un téléconseiller", body)
}
