//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/imports"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

// Le classeur des leads porte un onglet par jour et garde le nom de fichier du
// premier : « Leads du 10 sept 2026.xlsx » contenait aussi le 11 et le 12. Les
// trois jours se comptaient en un seul lot, et le sélecteur de campagne
// affichait trois fois la même date.
func TestImportLeadsSepareLesOngletsParJour(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
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
}

type ongletLeadsTest struct{ nom, telephone string }

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
			{"10/09/2026", "Fatou Onglet", "fatou." + onglet.telephone[5:] + "@example.sn", onglet.telephone, "https://monespace.cpi.sn/"},
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
