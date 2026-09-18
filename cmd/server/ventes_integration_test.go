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

	// Une date de début postérieure à toutes les ventes vidait l'espace sans prévenir.
	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur?depuis=2030-01-01", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusBadRequest, "dépôt qui ne garderait aucune vente", reponse)
	statut, reponse = b.appel(http.MethodGet, "/api/v1/ventes", nil, false)
	if toutes, _ := reponse["ventes"].([]any); statut != http.StatusOK || len(toutes) != 3 {
		t.Fatalf("le classeur en place doit rester intact : %d %v", statut, reponse)
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

func TestProspectVenteFermeLeParcoursEtRapprocheLeClasseur(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	direction := nouveauBanc(t, "DIRECTION")
	connecte(direction)
	nettoyerProspects(b, b.userID)

	id := creerProspect(b, "Diouf", numeroSenegalais(22))["id"].(string)
	if _, err := b.pool.Exec(b.ctx, `UPDATE "prospects" SET "statut" = 'CONVERTI' WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects/"+id+"/vendre", nil, nil)
	b.attend(statut, http.StatusOK, "vente d'une fiche convertie", body)
	if body["statut"] != "VENDU" {
		t.Fatalf("statut après vente : %v", body["statut"])
	}
	statut, journal := appelJSON(b, http.MethodGet, "/api/v1/prospects/"+id+"/journal", nil, nil)
	b.attend(statut, http.StatusOK, "journal de la fiche", journal)
	items, _ := journal["items"].([]any)
	trouve := false
	for _, it := range items {
		entree, _ := it.(map[string]any)
		if entree["action"] == "prospect.vendre" {
			trouve = true
		}
	}
	if !trouve {
		t.Fatalf("le journal doit garder l'action prospect.vendre : %v", items)
	}
	statut, body = appelJSON(b, http.MethodPost, "/api/v1/prospects/"+id+"/vendre", nil, nil)
	b.attend(statut, http.StatusUnprocessableEntity, "revente d'une fiche déjà vendue", body)

	autreID := creerProspect(b, "Sarr", "77 000 00 02")["id"].(string)
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "prospects" SET "statut" = 'CONVERTI', "lastCallById" = $2 WHERE "id" = $1`, autreID, b.userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { direction.exec(`DELETE FROM "ventes_classeurs"`) })
	statut, reponse := direction.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", classeurVentesTest(t))
	direction.attend(statut, http.StatusOK, "dépôt du classeur", reponse)

	var apres string
	if err := b.pool.QueryRow(b.ctx, `SELECT "statut" FROM "prospects" WHERE "id" = $1`, autreID).Scan(&apres); err != nil {
		t.Fatal(err)
	}
	if apres != "VENDU" {
		t.Fatalf("la fiche dont le téléphone correspond doit passer vendue : %s", apres)
	}

	statut, ventes := direction.appel(http.MethodGet, "/api/v1/ventes", nil, false)
	direction.attend(statut, http.StatusOK, "lecture des ventes", ventes)
	items2, _ := ventes["ventes"].([]any)
	var teleconseiller any
	for _, it := range items2 {
		vente, _ := it.(map[string]any)
		if vente["client"] == "AWA SARR" {
			teleconseiller = vente["teleconseiller"]
		}
	}
	if teleconseiller != "Test Intégration" {
		t.Fatalf("le téléconseiller doit apparaître sur la vente rapprochée : %v", teleconseiller)
	}
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
