//go:build integration

package main

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// Le classeur d'octobre 2026 ajoute six questions du formulaire Meta : les
// réponses arrivent sur la fiche telles quelles, même saisies dans la mauvaise
// case, et le relevé suivant les remplace.
func TestImportLeadsGardeLesReponsesAuFormulaire(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	b.canalSiteWeb()
	t.Setenv("IMPORTS_DIR", t.TempDir())
	base := time.Now().UnixNano() % 10_000_000
	telephone := fmt.Sprintf("+22177%07d", base)
	nomClasseur := fmt.Sprintf("Suivi Campagne & Leads Oct 2026 %d.xlsx", base)
	b.nettoyerLeadsTest([]string{telephone}, nomClasseur)
	// Les en-têtes exacts de l'export Meta : majuscules, apostrophe typographique.
	entete := []string{
		"Date", "Nom complet", "Email", "Provenance", "Téléphone", "Canal", "JOB_TITLE", "COMPANY_NAME",
		"Quel est votre projet ?", "Dans quelle zone recherchez-vous ?", "BUDGET / SALAIRE",
		"Quelle modalité de paiement vous convient le mieux ?", "Quand souhaitez-vous concrétiser votre projet ?",
		"Quel est votre rôle dans la décision d’achat ?",
	}
	ligne := func(zone string) []any {
		return []any{
			"02/10/2026", "Adama Sarr", "", "", "p:" + telephone, canalMetaChuesTest, "Néant", "enseignante",
			"un toit", zone, "120000f", "Oui", "", "Partenaire",
		}
	}

	b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{{nom: "Leads 01 oct 2026", lignes: [][]any{ligne("Oui")}}}), nomClasseur)
	fiche := b.ficheLeadTest(telephone)
	attendu := map[string]any{
		"projet": "un toit", "zone": "Oui", "budget": "120000f", "modalitePaiement": "Oui",
		"echeance": nil, "roleDecision": "Partenaire",
	}
	verifierReponsesFormulaireTest(b, fiche.id, attendu)

	b.releverLeadsTest(classeurLeadsBrut(t, entete, []ongletLeadsBrutTest{{nom: "Leads 01 oct 2026", lignes: [][]any{ligne("Dakar")}}}), nomClasseur)
	attendu["zone"] = "Dakar"
	verifierReponsesFormulaireTest(b, fiche.id, attendu)
}

func verifierReponsesFormulaireTest(b *banc, prospectID string, attendu map[string]any) {
	b.t.Helper()
	statut, fiche := adminAppel(b, http.MethodGet, "/api/v1/prospects/"+prospectID, nil)
	reponses, _ := fiche["reponsesFormulaire"].(map[string]any)
	if statut != http.StatusOK || reponses == nil {
		b.t.Fatalf("réponses au formulaire absentes : %d %v", statut, fiche)
	}
	for cle, valeur := range attendu {
		if reponses[cle] != valeur {
			b.t.Fatalf("réponse %q : %v, attendu %v (%v)", cle, reponses[cle], valeur, reponses)
		}
	}
}
