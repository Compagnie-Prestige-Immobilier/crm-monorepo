//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/imports"
	"cpi-go/sql/migrations"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// Le classeur des leads porte un onglet par jour et garde le nom de fichier du
// premier : « Leads du 10 sept 2026.xlsx » contenait aussi le 11 et le 12. Les
// trois jours se comptaient en un seul lot, et le sélecteur de campagne
// affichait trois fois la même date.
func TestImportLeadsSepareLesOngletsParJour(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())

	base := time.Now().UnixNano() % 10_000_000
	dixSept := fmt.Sprintf("+22177%07d", base)
	onzeSept := fmt.Sprintf("+22177%07d", (base+1)%10_000_000)
	nomClasseur := fmt.Sprintf("Leads du 10 sept 2026 %d.xlsx", base)

	onglets := []ongletLeadsTest{
		{nom: "DEBUT CAMPAGNE 10 SEPT 26", telephone: dixSept},
		{nom: "Leads 11 sept 2026", telephone: onzeSept},
	}
	t.Setenv("IMPORT_LEADS_URL", b.lienDesLeads(classeurLeadsOnglets(t, onglets), nomClasseur))

	var empreinteAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`).Scan(&empreinteAvant)
	t.Cleanup(func() {
		for _, onglet := range onglets {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "phoneE164" = $1)`, onglet.telephone)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "phoneE164" = $1`, onglet.telephone)
		}
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "courriels" WHERE "objetType" = 'import' AND "objetId" IN (SELECT "id" FROM "import_jobs" WHERE "fileName" = $1)`, nomClasseur)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "fileName" = $1`, nomClasseur)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`)
		if empreinteAvant != nil {
			_, _ = b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ('imports.leadsEmpreinte', $1, now())`, *empreinteAvant)
		}
	})

	if err := imports.ReleverLeads(b.ctx, serviceDesImports(b)); err != nil {
		t.Fatal(err)
	}

	// L'onglet est retenu sur la fiche : sans lui, rien ne rattache une fiche à
	// son jour, le nom du classeur étant celui du premier.
	for _, onglet := range onglets {
		var feuille *string
		if err := b.pool.QueryRow(b.ctx,
			`SELECT "importFeuille" FROM "prospects" WHERE "phoneE164" = $1`, onglet.telephone).Scan(&feuille); err != nil {
			t.Fatalf("la fiche de %s doit exister : %v", onglet.nom, err)
		}
		if feuille == nil || *feuille != onglet.nom {
			t.Fatalf("onglet attendu %q, retenu %v", onglet.nom, feuille)
		}
	}

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/lots-export/imports?projet=GRAND_PUBLIC", nil, nil)
	b.attend(statut, http.StatusOK, "les imports du projet", body)
	libelles := libellesDesImports(b, body, nomClasseur)
	for _, attendu := range []string{"Leads 10 septembre 2026", "Leads 11 septembre 2026"} {
		if libelles[attendu] != 1 {
			t.Fatalf("un lot %q d'une fiche attendu, vu %v", attendu, libelles)
		}
	}

	rattrapageRelitLeClasseur(b, onglets, nomClasseur)
}

// Les fiches importées avant ce jour n'ont pas d'onglet : le geste du panneau
// relit leur classeur et le leur pose. À retirer avec le rattrapage lui-même.
func rattrapageRelitLeClasseur(b *banc, onglets []ongletLeadsTest, nomClasseur string) {
	b.t.Helper()
	for _, onglet := range onglets {
		if _, err := b.pool.Exec(b.ctx,
			`UPDATE "prospects" SET "importFeuille" = NULL WHERE "phoneE164" = $1`, onglet.telephone); err != nil {
			b.t.Fatal(err)
		}
	}

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/imports/rattraper-feuilles", nil, nil)
	b.attend(statut, http.StatusOK, "rattrapage des onglets", body)

	for _, onglet := range onglets {
		var feuille *string
		if err := b.pool.QueryRow(b.ctx,
			`SELECT "importFeuille" FROM "prospects" WHERE "phoneE164" = $1`, onglet.telephone).Scan(&feuille); err != nil {
			b.t.Fatal(err)
		}
		if feuille == nil || *feuille != onglet.nom {
			b.t.Fatalf("rattrapage de %s : onglet %v", onglet.nom, feuille)
		}
	}

	statut, body = appelJSON(b, http.MethodGet, "/api/v1/lots-export/imports?projet=GRAND_PUBLIC", nil, nil)
	b.attend(statut, http.StatusOK, "les imports apres rattrapage", body)
	if libelles := libellesDesImports(b, body, nomClasseur); libelles["Leads 11 septembre 2026"] != 1 {
		b.t.Fatalf("le lot doit retrouver son nom apres rattrapage : %v", libelles)
	}
}

type ongletLeadsTest struct{ nom, telephone string }

// La migration des dates rejoue la règle de l'onglet en SQL. Elle a déjà tourné
// ici : son texte Up se relance, et une seconde passe ne change rien.
type casDateOngletTest struct {
	feuille string
	avant   time.Time
	attendu time.Time
	regle   string
}

func TestMigrationCorrigeLesDatesDesLeadsDepuisLOnglet(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	base := time.Now().UnixNano() % 10_000_000
	quand := func(y int, m time.Month, d, h, mn int) time.Time { return time.Date(y, m, d, h, mn, 0, 0, time.UTC) }
	cas := []casDateOngletTest{
		{"Leads 12 sept 2026", quand(2026, time.December, 9, 8, 30), quand(2026, time.September, 12, 8, 30), "inversion"},
		{"Leads 12 sept", quand(2026, time.November, 9, 0, 0), quand(2026, time.September, 12, 12, 0), "onglet"},
		{"DEBUT CAMPAGNE 10 SEPT 26", quand(2026, time.September, 10, 15, 0), quand(2026, time.September, 10, 15, 0), ""},
		{"Feuil1", time.Now().UTC().AddDate(0, 0, 400), quand(2026, time.September, 13, 9, 0), "sans_onglet"},
	}
	ids := make([]string, len(cas))
	for i, c := range cas {
		ids[i] = uuid.NewString()
		adminExec(b, `INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","createdAt","importFeuille","updatedAt")
			VALUES ($1,'Diop','Awa',$2,$3,$4,$5,$6,now())`,
			ids[i], fmt.Sprintf("+22178%07d", (base+int64(i))%10_000_000), b.userID, c.avant, quand(2026, time.September, 13, 9, 0), c.feuille)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = ANY($1::text[])`, ids)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = ANY($1::text[])`, ids)
	})
	texte, err := migrations.FS.ReadFile("20260915200100_dates_leads_corrigees.sql")
	if err != nil {
		t.Fatal(err)
	}
	up, _, _ := strings.Cut(string(texte), "-- +goose Down")

	for passe := 1; passe <= 2; passe++ {
		if _, err := b.pool.Exec(b.ctx, up); err != nil {
			t.Fatalf("passe %d : %v", passe, err)
		}
		for i := range cas {
			verifierDateOngletTest(b, ids[i], &cas[i], passe)
		}
	}
	if n := adminCompterAudit(b, "prospect.date_corrigee", ids[0]); n != 1 {
		t.Fatalf("une seule trace par fiche, même après deux passes : %d", n)
	}
}

func verifierDateOngletTest(b *banc, id string, c *casDateOngletTest, passe int) {
	b.t.Helper()
	var apres time.Time
	var rev int
	if err := b.pool.QueryRow(b.ctx, `SELECT "clientCreatedAt", "rev" FROM "prospects" WHERE "id" = $1`, id).Scan(&apres, &rev); err != nil {
		b.t.Fatal(err)
	}
	revAttendu := 1
	if c.regle != "" {
		revAttendu = 2
	}
	if !apres.Equal(c.attendu) || rev != revAttendu {
		b.t.Fatalf("passe %d, onglet %q : %v (rev %d), attendu %v (rev %d)", passe, c.feuille, apres, rev, c.attendu, revAttendu)
	}
	var regle *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "after"->>'regle' FROM "audit_logs" WHERE "action" = 'prospect.date_corrigee' AND "entityId" = $1`, id).Scan(&regle)
	if (regle == nil && c.regle != "") || (regle != nil && *regle != c.regle) {
		b.t.Fatalf("onglet %q : règle %v, attendue %q", c.feuille, regle, c.regle)
	}
}

// Les libellés des lots du classeur, par nom, avec leur nombre de fiches.
func libellesDesImports(b *banc, body map[string]any, nomClasseur string) map[string]int {
	b.t.Helper()
	items, ok := body["items"].([]any)
	if !ok {
		b.t.Fatalf("liste des imports attendue : %v", body)
	}
	vus := map[string]int{}
	for _, brut := range items {
		item, _ := brut.(map[string]any)
		if nom, _ := item["fileName"].(string); nom != nomClasseur {
			continue
		}
		libelle, _ := item["libelle"].(string)
		fiches, _ := item["fiches"].(float64)
		vus[libelle] = int(fiches)
	}
	return vus
}

func classeurLeadsOnglets(t *testing.T, onglets []ongletLeadsTest) []byte {
	t.Helper()
	fichier := excelize.NewFile()
	for index, onglet := range onglets {
		if index == 0 {
			_ = fichier.SetSheetName(fichier.GetSheetName(0), onglet.nom)
		} else if _, err := fichier.NewSheet(onglet.nom); err != nil {
			t.Fatal(err)
		}
		lignes := [][]string{
			{"Date", "Nom complet", "Email", "Téléphone", "Canal"},
			// Un lead plateforme n'entre dans aucune campagne : celui-ci vient de Meta.
			{"10/09/2026", "Fatou Onglet", "fatou." + onglet.telephone[5:] + "@example.sn", onglet.telephone, "Meta CPI GRAND PUBLIC ( Facebook & Instagram )"},
		}
		for rang, ligne := range lignes {
			for colonne, valeur := range ligne {
				cellule, _ := excelize.CoordinatesToCellName(colonne+1, rang+1)
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

// Le marketing annonce un volume de lignes, le plateau appelle des numeros :
// sans un compte par onglet, l'ecart entre les deux se discute de memoire.
func TestRapportDImportCompteChaqueOnglet(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())

	base := time.Now().UnixNano() % 10_000_000
	treize := fmt.Sprintf("+22177%07d", base)
	quatorze := fmt.Sprintf("+22177%07d", (base+1)%10_000_000)
	nomClasseur := fmt.Sprintf("Leads onglets %d.xlsx", base)

	onglets := []ongletLignesTest{
		{nom: "Leads 13 sept 2026", lignes: []ligneLeadTest{
			{nom: "Fatou Treize", telephone: treize},
			{nom: "Fatou Treize", telephone: treize},
			{nom: "Mamadou Illisible", telephone: "07"},
		}},
		{nom: "Leads 14 sept 2026", lignes: []ligneLeadTest{
			{nom: "Fatou Treize", telephone: treize},
			{nom: "Awa Quatorze", telephone: quatorze},
		}},
	}
	t.Setenv("IMPORT_LEADS_URL", b.lienDesLeads(classeurLeadsLignes(t, onglets), nomClasseur))
	nettoyerClasseurTest(b, nomClasseur, []string{treize, quatorze})

	if err := imports.ReleverLeads(b.ctx, serviceDesImports(b)); err != nil {
		t.Fatal(err)
	}

	attendus := map[string]string{
		"Leads 13 sept 2026": "lignes=3 inedits=1 reLivres=0 doublons=1 inexploitables=1",
		"Leads 14 sept 2026": "lignes=2 inedits=1 reLivres=1 doublons=0 inexploitables=0",
	}
	vus := feuillesDuRapportTest(b, nomClasseur)
	for feuille, attendu := range attendus {
		if vus[feuille] != attendu {
			b.t.Fatalf("onglet %q : %q, attendu %q", feuille, vus[feuille], attendu)
		}
	}
	if len(vus) != len(attendus) {
		b.t.Fatalf("un onglet par jour attendu, vu %v", vus)
	}
}

func nettoyerClasseurTest(b *banc, nomClasseur string, telephones []string) {
	b.t.Helper()
	var empreinteAvant *string
	_ = b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = 'imports.leadsEmpreinte'`).Scan(&empreinteAvant)
	b.t.Cleanup(func() {
		for _, telephone := range telephones {
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

// Le panneau lit ce tableau : le rapport est relu par l'API, pas dans la base.
func feuillesDuRapportTest(b *banc, nomClasseur string) map[string]string {
	b.t.Helper()
	var travail string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "import_jobs" WHERE "fileName" = $1 ORDER BY "createdAt" DESC LIMIT 1`, nomClasseur).Scan(&travail); err != nil {
		b.t.Fatal(err)
	}
	rapport, _ := b.rapportImportTest(travail)
	feuilles, ok := rapport["feuilles"].([]any)
	if !ok {
		b.t.Fatalf("le rapport doit porter ses onglets : %v", rapport)
	}
	vus := map[string]string{}
	for _, brut := range feuilles {
		ligne := mapDe(brut)
		nom, _ := ligne["feuille"].(string)
		vus[nom] = fmt.Sprintf("lignes=%d inedits=%d reLivres=%d doublons=%d inexploitables=%d",
			entierDuRapport(ligne, "lignes"), entierDuRapport(ligne, "inedits"), entierDuRapport(ligne, "reLivres"),
			entierDuRapport(ligne, "doublons"), entierDuRapport(ligne, "inexploitables"))
	}
	return vus
}

type ligneLeadTest struct{ nom, telephone string }

type ongletLignesTest struct {
	nom    string
	lignes []ligneLeadTest
}

func classeurLeadsLignes(t *testing.T, onglets []ongletLignesTest) []byte {
	t.Helper()
	fichier := excelize.NewFile()
	for index, onglet := range onglets {
		if index == 0 {
			_ = fichier.SetSheetName(fichier.GetSheetName(0), onglet.nom)
		} else if _, err := fichier.NewSheet(onglet.nom); err != nil {
			t.Fatal(err)
		}
		lignes := [][]string{{"Date", "Nom complet", "Email", "Téléphone", "Canal"}}
		for _, ligne := range onglet.lignes {
			lignes = append(lignes, []string{
				"", ligne.nom, "", ligne.telephone, "Meta CPI GRAND PUBLIC ( Facebook & Instagram )",
			})
		}
		for rang, ligne := range lignes {
			for colonne, valeur := range ligne {
				cellule, _ := excelize.CoordinatesToCellName(colonne+1, rang+1)
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
