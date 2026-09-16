//go:build integration

package main

import (
	"bytes"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

// La direction dépose son tableau des ventes en ne gardant que les ventes
// souscrites depuis une date ; le fichier redescend octet pour octet.
func TestVentesDepuisUneDateEtClasseurIntact(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() { b.exec(`DELETE FROM "ventes_classeurs"`) })
	contenu := classeurVentesTest(t)

	statut, reponse := b.deposerClasseur("/api/v1/ventes/classeur?depuis=2026-09-10", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusOK, "dépôt", reponse)

	ventes, _ := reponse["ventes"].([]any)
	if len(ventes) != 1 {
		t.Fatalf("une vente depuis le 10 septembre attendue, %d reçues : %v", len(ventes), ventes)
	}
	vente, _ := ventes[0].(map[string]any)
	versements, _ := vente["versements"].([]any)
	if vente["client"] != "AWA SARR" || vente["prixTotal"] != float64(6_000_000) || len(versements) != 2 {
		t.Fatalf("vente mal lue : %v", vente)
	}

	// Sans date de début, une vente sans date de souscription compte : l'écarter
	// retirait 13 millions du chiffre d'affaires du vrai classeur.
	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusOK, "dépôt sans date de début", reponse)
	if toutes, _ := reponse["ventes"].([]any); len(toutes) != 3 {
		t.Fatalf("trois ventes attendues, dont une sans date : %v", toutes)
	}

	req, _ := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+"/api/v1/ventes/classeur/fichier", http.NoBody)
	resp, err := b.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	telecharge, _ := io.ReadAll(resp.Body)
	if !bytes.Equal(telecharge, contenu) {
		t.Fatalf("le classeur téléchargé diffère du dépôt (%d octets contre %d)", len(telecharge), len(contenu))
	}

	superviseur := nouveauBanc(t, "SUPERVISEUR")
	connecte(superviseur)
	statut, reponse = superviseur.appel(http.MethodGet, "/api/v1/ventes", nil, false)
	superviseur.attend(statut, http.StatusForbidden, "lecture par un superviseur", reponse)
}

func classeurVentesTest(t *testing.T) []byte {
	t.Helper()
	f := excelize.NewFile()
	ventes := "1. TABLEAU DES VENTES"
	echeances := "2. ECHEANCES MENSUELLES"
	_ = f.SetSheetName("Sheet1", ventes)
	if _, err := f.NewSheet(echeances); err != nil {
		t.Fatal(err)
	}
	lignes := [][]any{
		{},
		{
			"NBR.", "CANAL", "DATE SOUSCRIPT.", "PRENOM & NOM CLIENT", "TELEPHONE", "SITE", "NBR. LOTS", "NUMERO LOT",
			"SUPERFICIE EN M²", "PRIX VENTE UNITAIRE", "PRIX TOTAL ", "ACOMPTE VERSE", "RELIQUAT", "ECHEANCE",
			"PART PROPRIETAIRE", "PART APPORTEUR", "PART CPI",
		},
		{
			1, "CPI", time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC), "MODOU FALL", "77 000 00 01", "THIEO", 1, 1065, 225,
			2800000, 2800000, 500000, 2300000, nil, 1400000, 0, 1400000,
		},
		{
			2, "BDD PERSO.", time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC), "AWA SARR", "77 000 00 02", "NDAYANNE", 2,
			"1416 - 1417", 225, 3000000, 6000000, 1000000, 5000000, nil, 3000000, 0, 3000000,
		},
		{3, "BDD PERSO.", nil, "FATOU NDIAYE", nil, "SEBIKHOTANE", 2, "446-447", 300, 6500000, 13000000, 3820000},
		{2500},
	}
	for i, ligne := range lignes {
		cellule, _ := excelize.CoordinatesToCellName(1, i+1)
		_ = f.SetSheetRow(ventes, cellule, &ligne)
	}
	echeancesLignes := [][]any{
		{"TABLEAU DES ECHEANCES MENSUELLES"},
		{"NBR.", "PRENOM & NOM CLIENT", "TELEPHONE", "Versement 1 ", nil, "Versement 2"},
		{nil, nil, nil, "Date", "Montant", "Date", "Montant"},
		{1, "MODOU FALL", "77 000 00 01", "SOLDE"},
		{
			2, "AWA SARR", "77 000 00 02", time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC), 500000,
			time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), 500000,
		},
	}
	for i, ligne := range echeancesLignes {
		cellule, _ := excelize.CoordinatesToCellName(1, i+1)
		_ = f.SetSheetRow(echeances, cellule, &ligne)
	}
	var tampon bytes.Buffer
	if err := f.Write(&tampon); err != nil {
		t.Fatal(err)
	}
	return tampon.Bytes()
}
