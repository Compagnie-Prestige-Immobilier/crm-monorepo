//go:build integration

package main

import (
	"fmt"
	"testing"
	"time"
)

// Le classeur des leads livre « p:+225… » à l'ancien format ivoirien et des
// numéros étrangers sans leur « + » : aucun ne doit refuser la ligne.
func TestImportLeadsGardeLesNumerosHorsNumerotation(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	base := time.Now().UnixNano() % 1_000_000
	nomClasseur := fmt.Sprintf("Suivi Campagne & Leads Oct 2026 telephones %d.xlsx", base)
	cas := []struct{ cellule, attendu string }{
		{fmt.Sprintf("p:+2255%07d ", base), fmt.Sprintf("+2255%07d", base)},
		{fmt.Sprintf(" 33 6 33 %02d %02d %02d", base/10000, base/100%100, base%100), fmt.Sprintf("+33633%02d%02d%02d", base/10000, base/100%100, base%100)},
		{fmt.Sprintf("212 629-%06d", base), fmt.Sprintf("+212629%06d", base)},
	}
	attendus := make([]string, 0, len(cas))
	lignes := make([][]any, 0, len(cas))
	for i, c := range cas {
		attendus = append(attendus, c.attendu)
		lignes = append(lignes, []any{"02/10/2026", fmt.Sprintf("Lead Étranger%d", i), c.cellule, canalMetaChuesTest})
	}
	b.nettoyerLeadsTest(attendus, nomClasseur)

	entete := []string{"Date", "Nom complet", "Téléphone", "Canal"}
	b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{{nom: "Leads 01 oct 2026", lignes: lignes}}), nomClasseur)
	for _, telephone := range attendus {
		b.ficheLeadTest(telephone)
	}
}

// Un numéro hors numérotation reste écrit tel quel, mais compacté : deux
// relevés du même lead aux séparateurs différents doivent se reconnaître
// comme un seul numéro plutôt que créer une fiche en double.
func TestImportLeadsNumeroHorsNumerotationSeDedoublonneMalgreLesSeparateurs(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	base := time.Now().UnixNano() % 1_000_000
	telephone := fmt.Sprintf("123%07d", base)
	nomClasseur := fmt.Sprintf("Suivi Campagne & Leads Oct 2026 telephones doublon %d.xlsx", base)
	b.nettoyerLeadsTest([]string{telephone}, nomClasseur)

	entete := []string{"Date", "Nom complet", "Téléphone", "Canal"}
	brutEspaces := telephone[:3] + " " + telephone[3:6] + " " + telephone[6:]
	brutPoints := telephone[:3] + "." + telephone[3:6] + "." + telephone[6:]
	lignes := [][]any{
		{"02/10/2026", "Lead Doublon", brutEspaces, canalMetaChuesTest},
		{"02/10/2026", "Lead Doublon", brutPoints, canalMetaChuesTest},
	}

	travail := b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{{nom: "Leads 01 oct 2026", lignes: lignes}}), nomClasseur)
	b.ficheLeadTest(telephone)
	if n := importCompterParTelephone(b, telephone); n != 1 {
		t.Fatalf("les deux lignes doivent se reconnaître comme le même numéro : %d fiche(s)", n)
	}
	b.attendRapportTest(travail, "total=2 created=1 updated=0 skipped=1 errors=0 warnings=1",
		map[string]float64{"PROSPECT_GP_IMPORT_LIGNE_REMPLACEE": 1})
}

func importCompterParTelephone(b *banc, telephone string) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL`, telephone).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}
