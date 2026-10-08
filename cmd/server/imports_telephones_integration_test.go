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
