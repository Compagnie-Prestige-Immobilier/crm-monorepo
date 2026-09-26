//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/imports"
	"cpi-go/internal/shared/socle"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
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
	"github.com/jackc/pgx/v5"
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

func (b *banc) attendreImportReussi(identifiant string) map[string]any {
	b.t.Helper()
	for range 400 {
		statut, body := b.appel(http.MethodGet, "/api/v1/imports/"+identifiant, nil, false)
		b.attend(statut, http.StatusOK, "état de l’import", body)
		if body["status"] == "succeeded" {
			return body
		}
		if body["status"] == "failed" {
			b.t.Fatalf("import échoué : %v %v", body["failureCode"], body["failureMsg"])
		}
		time.Sleep(25 * time.Millisecond)
	}
	b.t.Fatalf("l’import %s n’a pas abouti", identifiant)
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

	final := b.attendreImportReussi(body["id"].(string))
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
	if statut != "expired" || rapport == nil {
		t.Fatalf("échéance : statut %s, le rapport doit survivre au classeur, reçu %s", statut, rapport)
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
		{"10/09/2026", "Fatou Relevée", "fatou." + telephone[4:] + "@example.sn", telephone, "Site web"},
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

// Le lien SharePoint joué en local : une redirection qui pose un cookie, puis le
// classeur. Le nom est propre au test, le vrai relevé écrit dans la même base.
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

// Les règles de provenance posées par migration visent « Site web », que seul le
// seed crée : la base de la CI n'a que le schéma et les migrations.
func (b *banc) canalSiteWeb() {
	b.t.Helper()
	var cree string
	err := b.pool.QueryRow(b.ctx,
		`INSERT INTO "canaux_provenance" ("id","code","label","position","updatedAt")
		 VALUES (gen_random_uuid()::text, 'SITE_WEB', 'Site web', 60, now())
		 ON CONFLICT DO NOTHING RETURNING "id"`).Scan(&cree)
	if errors.Is(err, pgx.ErrNoRows) {
		return
	}
	if err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "canaux_provenance" WHERE "id" = $1`, cree) })
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

// La ligne est écrite quelle que soit l'heure : hors heures ouvrables, elle
// attend le rejeu au lieu de partir.
func (b *banc) bilanDuReleveEnCourriel(travail string) {
	b.t.Helper()
	var sujet string
	if err := b.pool.QueryRow(b.ctx, `SELECT "sujet" FROM "courriels" WHERE "type" = 'IMPORT_LEADS' AND "objetId" = $1`, travail).Scan(&sujet); err != nil {
		b.t.Fatalf("le bilan du relevé doit être consigné : %v", err)
	}
	if !strings.HasPrefix(sujet, "[Leads] 1 nouvelle fiche, ") {
		b.t.Fatalf("sujet : %s", sujet)
	}
}

func (b *banc) courrielsDuBilanLeads(travail string) int {
	b.t.Helper()
	var courriels int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "courriels" WHERE "type" = 'IMPORT_LEADS' AND "objetId" = $1`, travail).Scan(&courriels); err != nil {
		b.t.Fatal(err)
	}
	return courriels
}

func (b *banc) signalerBilanLeads() {
	b.t.Helper()
	if err := imports.SignalerBilanLeads(b.ctx, serviceDesImports(b)); err != nil {
		b.t.Fatal(err)
	}
}

func TestImportReleveLesLeadsDepuisLeLien(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	telephone := fmt.Sprintf("+22177%07d", time.Now().UnixNano()%10_000_000)
	nomClasseurLeads := "Leads test " + telephone[6:] + ".xlsx"
	t.Setenv("IMPORT_LEADS_URL", b.lienDesLeads(classeurLeads(t, telephone), nomClasseurLeads))
	// L'empreinte est un réglage unique : celle du vrai relevé est remise après.
	var empreinteAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`).Scan(&empreinteAvant)
	var bilanAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsBilan'`).Scan(&bilanAvant)
	_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'imports.leadsBilan'`)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = $1)`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "fileName" = $1`, nomClasseurLeads)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" IN ('imports.leadsEmpreinte', 'imports.leadsBilan')`)
		if empreinteAvant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('imports.leadsEmpreinte', $1, now())`, *empreinteAvant)
		}
		if bilanAvant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('imports.leadsBilan', $1, now())`, *bilanAvant)
		}
	})
	travail := b.releverLeadsTest(classeurLeads(t, telephone), nomClasseurLeads)
	projet, canal, travailFiche := b.ficheDuLead(telephone)
	if projet != "GRAND_PUBLIC" || canal != "Site web" || travailFiche == nil {
		t.Fatalf("fiche %s, canal %q, import %v", projet, canal, travailFiche)
	}
	if statut, creees, _ := b.etatTravailImport(travail); statut != "succeeded" || creees != 1 {
		t.Fatalf("travail %s, %d créée(s)", statut, creees)
	}
	if courriels := b.courrielsDuBilanLeads(travail); courriels != 0 {
		t.Fatalf("le relevé horaire doit rester silencieux : %d courriel(s)", courriels)
	}
	b.signalerBilanLeads()
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "courriels" WHERE "objetType" = 'import' AND "objetId" = $1`, travail)
	})
	b.bilanDuReleveEnCourriel(travail)
	b.signalerBilanLeads()
	if courriels := b.courrielsDuBilanLeads(travail); courriels != 1 {
		t.Fatalf("un bilan ne doit partir qu'une fois : %d courriel(s)", courriels)
	}

	b.releverLeadsTest(classeurLeads(t, telephone), nomClasseurLeads)
	if travaux := b.travauxDuClasseur(nomClasseurLeads); travaux != 1 {
		t.Fatalf("un classeur inchangé ne se rejoue pas : %d travaux", travaux)
	}
}

type ongletLeadsBrutTest struct {
	nom    string
	lignes [][]any
}

// Le classeur tel que le marketing le rend : un en-tête libre, une cellule `float64`
// vaut un rang Excel, comme une date saisie dans une cellule au format date.
func classeurLeadsBrut(t *testing.T, entete []string, onglets []ongletLeadsBrutTest) []byte {
	t.Helper()
	fichier := excelize.NewFile()
	for index, onglet := range onglets {
		if index == 0 {
			_ = fichier.SetSheetName(fichier.GetSheetName(0), onglet.nom)
		} else if _, err := fichier.NewSheet(onglet.nom); err != nil {
			t.Fatal(err)
		}
		for colonne, valeur := range entete {
			cellule, _ := excelize.CoordinatesToCellName(colonne+1, 1)
			_ = fichier.SetCellValue(onglet.nom, cellule, valeur)
		}
		for rang, ligne := range onglet.lignes {
			for colonne, valeur := range ligne {
				cellule, _ := excelize.CoordinatesToCellName(colonne+1, rang+2)
				_ = fichier.SetCellValue(onglet.nom, cellule, valeur)
			}
		}
	}
	var buf bytes.Buffer
	if err := fichier.Write(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func rangExcelTest(quand time.Time) float64 {
	return quand.Sub(time.Date(1899, time.December, 30, 0, 0, 0, 0, time.UTC)).Hours() / 24
}

// Un relevé du classeur donné, puis l'identifiant du travail appliqué.
func (b *banc) releverLeadsTest(classeur []byte, nomClasseur string) string {
	b.t.Helper()
	b.t.Setenv("IMPORT_LEADS_URL", b.lienDesLeads(classeur, nomClasseur))
	if err := imports.ReleverLeads(b.ctx, serviceDesImports(b)); err != nil {
		b.t.Fatal(err)
	}
	var travail string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "import_jobs" WHERE "fileName" = $1 AND "mode" = 'APPLY' ORDER BY "createdAt" DESC LIMIT 1`,
		nomClasseur).Scan(&travail); err != nil {
		b.t.Fatalf("le relevé doit laisser un travail appliqué : %v", err)
	}
	return travail
}

type ficheLeadTest struct {
	id, projet, canal string
	creeLe            time.Time
	remarque          *string
}

func (b *banc) ficheLeadTest(telephone string) ficheLeadTest {
	b.t.Helper()
	var f ficheLeadTest
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."id", p."projet"::text, COALESCE(c."label", ''), p."clientCreatedAt", p."remarqueImport"
		   FROM "prospects" p LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
		  WHERE p."phoneE164" = $1`, telephone).Scan(&f.id, &f.projet, &f.canal, &f.creeLe, &f.remarque); err != nil {
		b.t.Fatalf("la fiche %s doit exister : %v", telephone, err)
	}
	return f
}

// Le rapport du travail, tel que l'écran Imports le lit.
func (b *banc) rapportImportTest(travail string) (rapport map[string]any, compteurs map[string]float64) {
	b.t.Helper()
	statut, body := appelJSON(b, http.MethodGet, "/api/v1/imports/"+travail, nil, nil)
	b.attend(statut, http.StatusOK, "le travail d'import", body)
	rapport, _ = body["report"].(map[string]any)
	compteurs = map[string]float64{}
	for code, n := range mapDe(rapport["compteurs"]) {
		compteurs[code], _ = n.(float64)
	}
	return rapport, compteurs
}

func mapDe(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func entierDuRapport(rapport map[string]any, cle string) int {
	n, _ := rapport[cle].(float64)
	return int(n)
}

func (b *banc) nettoyerLeadsTest(telephones []string, nomClasseur string) {
	b.t.Helper()
	var empreinteAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`).Scan(&empreinteAvant)
	b.t.Cleanup(func() {
		for _, telephone := range telephones {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = $1)`, telephone)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = $1)`, telephone)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, telephone)
		}
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "courriels" WHERE "objetType" = 'import' AND "objetId" IN (SELECT "id" FROM "import_jobs" WHERE "fileName" = $1)`, nomClasseur)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "fileName" = $1`, nomClasseur)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`)
		if empreinteAvant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('imports.leadsEmpreinte', $1, now())`, *empreinteAvant)
		}
	})
}

const (
	canalMetaChuesTest = "Meta CPI-CHUES ( Facebook & Instagram )"
	canalMetaGPTest    = "Meta CPI GRAND PUBLIC ( Facebook & Instagram )"
	libelleMetaTest    = "Meta (Facebook et Instagram)"
)

// docs/decisions/import-leads.md : l'onglet corrige la date, « Canal » décide du
// projet, le classeur relu met la fiche à jour sans toucher projet ni campagne.
func TestImportLeadsCorrigeDatesEtCanaux(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	base := time.Now().UnixNano() % 10_000_000
	tels := []string{
		fmt.Sprintf("+22177%07d", base), fmt.Sprintf("+22177%07d", (base+1)%10_000_000), fmt.Sprintf("+22177%07d", (base+2)%10_000_000),
	}
	nomClasseur := fmt.Sprintf("Leads du 12 sept 2026 %d.xlsx", base)
	b.nettoyerLeadsTest(tels, nomClasseur)
	entete := []string{"Date", "Nom complet", "Email", "Provenance", "Téléphone", "Canal", "Réponse du prospect"}
	douze := ongletLeadsBrutTest{nom: "Leads 12 sept 2026", lignes: [][]any{
		// Excel en réglage US a rangé « 12/09/2026 08:30 » au 9 décembre.
		{rangExcelTest(time.Date(2026, time.December, 9, 8, 30, 0, 0, time.UTC)), "Aminata Diop", "aminata." + tels[0][5:] + "@example.sn", "Payé", tels[0], canalMetaChuesTest, "à rappeler"},
		{"12/09/2026", "Moussa Ndiaye", "", "Direct", tels[1], "https://monespace.cpi.sn/", ""},
		{"", "Awa Sow", "", "fb", tels[2], "", ""},
		{"", "", "seule." + tels[0][5:] + "@example.sn", "", "", "", ""},
	}}

	travail := b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{douze}), nomClasseur)
	a := verifierPremierReleveLeadsTest(b, travail, tels)

	lotID := uuid.NewString()
	adminExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
		VALUES ($1,'Campagne CHUES test','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lotID, b.userID)
	adminExec(b, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`, lotID, a.id, b.userID)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, lotID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lotID)
	})

	// Le téléconseiller de la campagne a promis un rappel : il le tient, fiche hors projet ou non.
	commercialID, commercialEmail := adminCompte(b, "COMMERCIAL")
	rappelPromis(b, a.id, commercialID)

	treize := ongletLeadsBrutTest{nom: "Leads 13 sept 2026", lignes: [][]any{
		{"13/09/2026", "Aminata Diop", "", "Payé", tels[0], canalMetaGPTest, "oui"},
	}}
	travail = b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{douze, treize}), nomClasseur)
	verifierSecondReleveLeadsTest(b, travail, tels[0], lotID)

	commercial := adminSession(b, commercialEmail)
	statut, body := adminAppel(commercial, http.MethodPost, "/api/v1/ouvertures", ouvertureFiche(a.id))
	if statut/100 != 2 {
		t.Fatalf("le rappel promis doit rester ouvrable par le téléconseiller : %d %v", statut, body)
	}
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "prospectId" = $1`, a.id) })
}

// « oct », « nov » et « déc » font reconnaître l'onglet, qui corrige alors l'inversion jour/mois.
func TestImportLeadsOngletOctobreCorrigeLInversion(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	anPasse := time.Now().UTC().Year() - 1
	base := time.Now().UnixNano() % 10_000_000
	telephone := fmt.Sprintf("+22177%07d", base)
	nomClasseur := fmt.Sprintf("Leads du 1 oct %d %d.xlsx", anPasse, base)
	b.nettoyerLeadsTest([]string{telephone}, nomClasseur)
	entete := []string{"Date", "Nom complet", "Email", "Provenance", "Téléphone", "Canal", "Réponse du prospect"}
	nomOnglet := fmt.Sprintf("Leads 1 oct %d", anPasse)
	// Excel a rangé « 01/10 » au 10 janvier : jour et mois inversés.
	premierOctobre := ongletLeadsBrutTest{nom: nomOnglet, lignes: [][]any{
		{rangExcelTest(time.Date(anPasse, time.January, 10, 9, 0, 0, 0, time.UTC)), "Aminata Diop", "aminata." + telephone[5:] + "@example.sn", "Payé", telephone, canalMetaChuesTest, "à rappeler"},
	}}

	travail := b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{premierOctobre}), nomClasseur)
	a := b.ficheLeadTest(telephone)
	if !a.creeLe.UTC().Equal(time.Date(anPasse, time.October, 1, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("date corrigée sur l'onglet d'octobre : %v", a.creeLe.UTC())
	}
	b.attendRapportTest(travail, "total=1 created=1 updated=0 skipped=0 errors=0 warnings=1", map[string]float64{
		"PROSPECT_GP_IMPORT_DATE_CORRIGEE": 1,
	})
}

// Un onglet sans année relevé avant le jour qu'il annonce garde l'année courante.
func TestImportLeadsOngletSansAnneeGardeLAnneeCourante(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	maintenant := time.Now().UTC()
	annee := maintenant.Year()
	demain := maintenant.AddDate(0, 0, 1)
	anneeOctobre := annee
	if time.Date(annee, time.October, 1, 0, 0, 0, 0, time.UTC).After(maintenant.AddDate(0, 6, 0)) {
		anneeOctobre--
	}
	base := time.Now().UnixNano() % 10_000_000
	tels := []string{fmt.Sprintf("+22177%07d", base), fmt.Sprintf("+22177%07d", (base+1)%10_000_000)}
	nomClasseur := fmt.Sprintf("Leads sans année %d.xlsx", base)
	b.nettoyerLeadsTest(tels, nomClasseur)
	entete := []string{"Date", "Nom complet", "Email", "Provenance", "Téléphone", "Canal", "Réponse du prospect"}
	onglets := []ongletLeadsBrutTest{
		{nom: fmt.Sprintf("Leads %d %s", demain.Day(), socle.MoisEnLettres[demain.Month()-1]), lignes: [][]any{
			{"", "Aminata Diop", "", "Payé", tels[0], canalMetaChuesTest, ""},
		}},
		{nom: "Leads 1 oct", lignes: [][]any{
			{"", "Moussa Ndiaye", "", "Payé", tels[1], canalMetaChuesTest, ""},
		}},
	}

	b.releverLeadsTest(classeurLeadsBrut(t, entete, onglets), nomClasseur)
	attendus := []time.Time{
		time.Date(annee, demain.Month(), demain.Day(), 0, 0, 0, 0, time.UTC),
		time.Date(anneeOctobre, time.October, 1, 0, 0, 0, 0, time.UTC),
	}
	for i, telephone := range tels {
		if lue := b.ficheLeadTest(telephone).creeLe.UTC(); !lue.Equal(attendus[i]) {
			t.Fatalf("onglet « %s » : %v, attendu %v", onglets[i].nom, lue, attendus[i])
		}
	}
}

// « projet | canal | créée le | note », lisible d'un coup dans l'échec.
func (f *ficheLeadTest) resume() string {
	remarque := ""
	if f.remarque != nil {
		remarque = *f.remarque
	}
	return strings.Join([]string{f.projet, f.canal, f.creeLe.UTC().Format(time.RFC3339), remarque}, " | ")
}

func resumeRapportTest(rapport map[string]any) string {
	return fmt.Sprintf("total=%d created=%d updated=%d skipped=%d errors=%d warnings=%d",
		entierDuRapport(rapport, "totalRows"), entierDuRapport(rapport, "createdRows"), entierDuRapport(rapport, "updatedRows"),
		entierDuRapport(rapport, "skippedRows"), entierDuRapport(rapport, "errorRows"), entierDuRapport(rapport, "warningRows"))
}

func (b *banc) attendRapportTest(travail, attendu string, compteursAttendus map[string]float64) {
	b.t.Helper()
	rapport, compteurs := b.rapportImportTest(travail)
	if resume := resumeRapportTest(rapport); resume != attendu {
		b.t.Fatalf("rapport : %s, attendu %s", resume, attendu)
	}
	for code, n := range compteursAttendus {
		if compteurs[code] != n {
			b.t.Fatalf("compteur %s : %v, attendu %v (%v)", code, compteurs[code], n, compteurs)
		}
	}
}

func verifierPremierReleveLeadsTest(b *banc, travail string, tels []string) ficheLeadTest {
	b.t.Helper()
	a, c := b.ficheLeadTest(tels[0]), b.ficheLeadTest(tels[2])
	if a.resume() != "CHUES | "+libelleMetaTest+" | 2026-09-12T08:30:00Z | à rappeler" {
		b.t.Fatalf("A : %s", a.resume())
	}
	// B cite monespace.cpi.sn : la personne n'existe que sur la plateforme.
	if n := qualificationCompte(b, `SELECT count(*) FROM "prospects" WHERE "phoneE164" = $1`, tels[1]); n != 0 {
		b.t.Fatalf("la ligne plateforme ne doit créer aucune fiche : %d", n)
	}
	if c.resume() != "GRAND_PUBLIC | "+libelleMetaTest+" | 2026-09-12T00:00:00Z | " {
		b.t.Fatalf("C : %s", c.resume())
	}
	b.attendRapportTest(travail, "total=4 created=2 updated=0 skipped=2 errors=0 warnings=4", map[string]float64{
		"PROSPECT_GP_IMPORT_DATE_CORRIGEE": 1, "PROSPECT_GP_IMPORT_CANAL_A_VERIFIER": 1,
		"PROSPECT_GP_IMPORT_LIGNE_SANS_IDENTITE": 1, "PROSPECT_GP_IMPORT_LIGNE_PLATEFORME": 1,
	})
	return a
}

func verifierSecondReleveLeadsTest(b *banc, travail, telephone, lotID string) {
	b.t.Helper()
	a := b.ficheLeadTest(telephone)
	if a.resume() != "CHUES | "+libelleMetaTest+" | 2026-09-12T08:30:00Z | oui" {
		b.t.Fatalf("A relue : %s", a.resume())
	}
	if parcours := projetsDesParcoursTest(b, a.id); strings.Join(parcours, ",") != "CHUES" {
		b.t.Fatalf("le parcours garde son projet : %v", parcours)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "lot_export_items" WHERE "lotId" = $1`, lotID); n != 1 {
		b.t.Fatalf("la fiche recodifiée doit rester dans sa campagne : %d", n)
	}
	statut, body := appelJSON(b, http.MethodGet, "/api/v1/lots-export/"+lotID+"/fiches", nil, nil)
	b.attend(statut, http.StatusOK, "fiches de la campagne", body)
	if items, _ := body["items"].([]any); len(items) != 1 {
		b.t.Fatalf("la fiche recodifiée doit paraître dans sa campagne : %v", body["items"])
	}
	// Quatre lignes ignorées, plus la date de A et le canal de C signalés une seconde fois.
	b.attendRapportTest(travail, "total=5 created=0 updated=1 skipped=4 errors=0 warnings=6", map[string]float64{
		"PROSPECT_GP_IMPORT_DEJA_EN_BASE": 2, "PROSPECT_GP_IMPORT_LIGNE_PLATEFORME": 1,
		"PROSPECT_GP_IMPORT_DATE_CORRIGEE": 1, "PROSPECT_GP_IMPORT_CANAL_A_VERIFIER": 1,
	})
}

func projetsDesParcoursTest(b *banc, prospectID string) []string {
	b.t.Helper()
	rows, err := b.pool.Query(b.ctx, `SELECT "projet"::text FROM "prospect_journeys" WHERE "prospectId" = $1`, prospectID)
	if err != nil {
		b.t.Fatal(err)
	}
	defer rows.Close()
	var parcours []string
	for rows.Next() {
		var projet string
		if err := rows.Scan(&projet); err != nil {
			b.t.Fatal(err)
		}
		parcours = append(parcours, projet)
	}
	return parcours
}

// Une ligne de lead sans téléphone n'écrit aucune fiche, et le rapport la signale.
func TestImportLeadsIgnoreEtSignaleUneLigneSansTelephone(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	base := time.Now().UnixNano() % 10_000_000
	courriel := fmt.Sprintf("serigne.%d@example.sn", base)
	nomClasseur := fmt.Sprintf("Leads du 14 sept 2026 %d.xlsx", base)
	b.nettoyerLeadsTest(nil, nomClasseur)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "email" = $1)`, courriel)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "email" = $1`, courriel)
	})

	entete := []string{"Date", "Nom complet", "Email", "Provenance", "Téléphone", "Canal", "Réponse du prospect"}
	classeur := classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{{nom: "Leads 14 sept 2026", lignes: [][]any{
		{"14/09/2026", "Serigne Mbaye Dramé", courriel, "Payé", "", canalMetaChuesTest, ""},
	}}})

	travail := b.releverLeadsTest(classeur, nomClasseur)
	if n := importCompterParCourriel(b, courriel); n != 0 {
		t.Fatalf("une ligne sans téléphone n'écrit rien : %d fiche(s)", n)
	}
	b.attendRapportTest(travail, "total=1 created=0 updated=0 skipped=1 errors=0 warnings=1",
		map[string]float64{"PROSPECT_GP_IMPORT_LIGNE_SANS_TELEPHONE": 1})
}

func importCompterParCourriel(b *banc, courriel string) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "prospects" WHERE "email" = $1 AND "deletedAt" IS NULL`, courriel).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

// Deux fiches vivantes sans numéro ne peuvent pas porter la même adresse sur un
// projet : la base le refuse, comme elle refuse deux fois le même numéro.
func TestProspectSansNumeroUneSeuleFicheParAdresseEtProjet(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	courriel := fmt.Sprintf("garde.%d@example.sn", time.Now().UnixNano()%10_000_000)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "email" = $1`, courriel) })
	ecrire := func() error {
		_, err := b.pool.Exec(b.ctx,
			`INSERT INTO "prospects" ("id","nom","prenom","email","projet","createdById","clientCreatedAt","updatedAt")
			 VALUES (gen_random_uuid()::text,'Dramé','Serigne',$1,'CHUES',$2,now(),now())`, courriel, b.userID)
		return err
	}
	if err := ecrire(); err != nil {
		t.Fatalf("la première fiche sans numéro s'écrit : %v", err)
	}
	if err := ecrire(); err == nil {
		t.Fatal("la seconde fiche sans numéro au même courriel doit être refusée")
	}
}

// Le modèle rempli avec ses propres listes se relit sans perte ; une banque ou
// une méthode hors liste refuse la ligne au lieu d'être effacée en silence.
func TestImportProspectsRelitLeModele(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	b.connecterImport()
	b.purgerTravauxImport()
	debut := time.Now()
	banque := uuid.NewString()
	sigle := "BT" + strings.ToUpper(banque[:6])
	b.exec(`INSERT INTO "banques" ("id","name","shortName","updatedAt") VALUES ($1,$2,$3,now())`, banque, "Banque "+sigle, sigle)
	base := time.Now().UnixNano() % 10_000_000
	telephones := []string{fmt.Sprintf("+22177%07d", base), fmt.Sprintf("+22176%07d", base), fmt.Sprintf("+22178%07d", base)}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = ANY($1))`, telephones)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = ANY($1)`, telephones)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "banques" WHERE "id" = $1`, banque)
	})

	classeur := b.modeleProspectsRempli([][]string{
		{"Ndiaye", "Awa", telephones[0], "", sigle, "", "Enrôlement sur place"},
		{"Sow", "Binta", telephones[1], "", "BANQUE-INCONNUE", "", ""},
		{"Fall", "Modou", telephones[2], "", sigle, "", "Pigeon voyageur"},
	})

	statut, body := b.deposerClasseur("/api/v1/imports/prospects", "prospects.xlsx", classeur)
	b.attend(statut, http.StatusCreated, "dépôt du modèle rempli", body)
	simulation := b.attendreImportReussi(body["id"].(string))
	rapport, _ := simulation["report"].(map[string]any)
	if total := entierDuRapport(rapport, "totalRows"); total != 3 {
		t.Fatalf("la ligne d'exemple du modèle ne se lit pas : %d lignes au lieu de 3", total)
	}
	erreurs, _ := rapport["errors"].([]any)
	codes := map[string]bool{}
	for _, brute := range erreurs {
		codes[texteDe(brute.(map[string]any)["code"])] = true
	}
	if len(erreurs) != 2 || !codes["PROSPECT_IMPORT_BANQUE_INCONNUE"] || !codes["PROSPECT_IMPORT_METHODE_INCONNUE"] {
		t.Fatalf("banque et méthode inconnues doivent refuser leur ligne : %v", erreurs)
	}

	statut, body = b.appel(http.MethodPost, "/api/v1/imports/"+texteDe(body["id"])+"/apply", nil, true)
	b.attend(statut, http.StatusOK, "application", body)
	b.attendreImportReussi(texteDe(body["id"]))
	var phase, methode, banqueLue string
	if err := b.pool.QueryRow(b.ctx, `SELECT "phase2Status"::text, "enrollmentMethod"::text, "banqueId" FROM "prospects" WHERE "phoneE164" = $1`,
		telephones[0]).Scan(&phase, &methode, &banqueLue); err != nil {
		t.Fatal(err)
	}
	if phase != "METHOD_OBTAINED" || methode != "APPOINTMENT" || banqueLue != banque {
		t.Fatalf("« Enrôlement sur place » relu : %s, %s, banque %s", phase, methode, banqueLue)
	}
	var refusees int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "prospects" WHERE "phoneE164" = ANY($1)`, telephones[1:]).Scan(&refusees); err != nil {
		t.Fatal(err)
	}
	if refusees != 0 {
		t.Fatalf("les lignes refusées ne s'écrivent pas : %d fiches", refusees)
	}
	var exemples int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "prospects" WHERE "phoneE164" = '+221771234567' AND "createdAt" >= $1`,
		debut).Scan(&exemples); err != nil {
		t.Fatal(err)
	}
	if exemples != 0 {
		t.Fatalf("la ligne d'exemple a créé %d fiche(s)", exemples)
	}
}

func (b *banc) modeleProspectsRempli(lignes [][]string) []byte {
	statut, _, modele := b.classeur("/api/v1/export/prospects-modele.xlsx")
	b.attend(statut, http.StatusOK, "modèle prospects", nil)
	for index, ligne := range lignes {
		for rang, valeur := range ligne {
			cellule, _ := excelize.CoordinatesToCellName(rang+1, index+imports.PremiereLigneImport)
			if err := modele.SetCellStr("Prospects", cellule, valeur); err != nil {
				b.t.Fatal(err)
			}
		}
	}
	var tampon bytes.Buffer
	if err := modele.Write(&tampon); err != nil {
		b.t.Fatal(err)
	}
	return tampon.Bytes()
}

// Chaque ligne porte une note aléatoire pour dépasser 1 Mo sans se compresser :
// c'est ce dépassement qui fait écrire le multipart sur le disque temporaire.
func classeurRepresentantsVolumineux(t *testing.T, departement string, lignes int) []byte {
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
	for index := range lignes {
		ligne := index + imports.PremiereLigneImport
		valeurs := []string{
			fmt.Sprintf("Représentant %04d", index),
			fmt.Sprintf("77%07d", 1_000_000+index),
			departement,
		}
		for rang, valeur := range valeurs {
			cellule, _ := excelize.CoordinatesToCellName(rang+1, ligne)
			if err := fichier.SetCellStr(feuille, cellule, valeur); err != nil {
				t.Fatal(err)
			}
		}
		bourrage := make([]byte, 24_000)
		if _, err := rand.Read(bourrage); err != nil {
			t.Fatal(err)
		}
		noteCellule, _ := excelize.CoordinatesToCellName(5, ligne)
		if err := fichier.SetCellStr(feuille, noteCellule, base64.StdEncoding.EncodeToString(bourrage)); err != nil {
			t.Fatal(err)
		}
	}
	var tampon bytes.Buffer
	if err := fichier.Write(&tampon); err != nil {
		t.Fatal(err)
	}
	return tampon.Bytes()
}

// Au-delà de 1 Mo, `ParseMultipartForm` écrit sur le disque : le dépôt ne doit
// laisser aucun `multipart-*` derrière lui.
func TestImportNeLaissePasDeFichierTemporaire(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	t.Setenv("IMPORTS_DIR", t.TempDir())
	dossierTemporaire := t.TempDir()
	t.Setenv("TMPDIR", dossierTemporaire)
	b.connecterImport()
	b.purgerTravauxImport()
	_, departement := b.departementImport()

	classeur := classeurRepresentantsVolumineux(t, departement, 100)
	if len(classeur) <= 1<<20 {
		t.Fatalf("le classeur de test doit dépasser 1 Mo pour forcer l'écriture sur disque, %d octets produits", len(classeur))
	}
	statut, body := b.deposerClasseur("/api/v1/imports/representants", "gros-classeur.xlsx", classeur)
	b.attend(statut, http.StatusCreated, "dépôt d’un classeur de plus de 1 Mo", body)
	b.attendreImportReussi(body["id"].(string))

	restes, err := os.ReadDir(dossierTemporaire)
	if err != nil {
		t.Fatal(err)
	}
	for _, entree := range restes {
		if strings.HasPrefix(entree.Name(), "multipart-") {
			t.Fatalf("fichier temporaire du dépôt jamais supprimé : %s", entree.Name())
		}
	}
}
