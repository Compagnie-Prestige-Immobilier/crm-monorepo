//go:build integration

package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

// La direction dépose son tableau des ventes en ne gardant que les ventes
// souscrites depuis une date ; le fichier redescend octet pour octet.
func TestVentesDepuisUneDateEtClasseurIntact(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes_classeurs"`)
	})
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

func TestVenteSaisieModificationEncaissementArchivageEtConfiguration(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	client := "CLIENT SAISIE " + b.userID[:8]
	var venteID int64
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		if venteID != 0 {
			b.exec(`DELETE FROM "ventes" WHERE "id" = $1`, venteID)
		}
	})

	statut, configuration := appelJSON(b, http.MethodGet, "/api/v1/ventes/configuration", nil, nil)
	b.attend(statut, http.StatusOK, "configuration des ventes", configuration)
	if len(configuration["sites"].([]any)) == 0 || len(configuration["canaux"].([]any)) == 0 {
		t.Fatalf("la configuration doit proposer des sites et des canaux : %v", configuration)
	}
	exigerCanauxVentes(t, configuration["canaux"].([]any))

	corps := map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-18", "client": client,
		"telephone": "77 000 00 88", "site": "THIEO", "nombreLots": 2,
		"numerosLots": "2001 - 2002", "superficie": "225 m²", "prixUnitaire": 2800000,
		"acompte": 500000, "modePaiement": "CREDIT", "nombreEcheances": 12,
		"periodiciteMois": 2, "jourVersement": 10, "premierVersement": "2026-10-10",
		"email": "Client.Saisie@Exemple.sn", "numeroCni": "1 234 1990 01234", "dateDelivranceCni": "2021-03-04",
		"demeurantA": "Dakar, Sacré-Cœur", "profession": "Enseignant", "representant": "Awa Ndiaye",
		"nomTeleconseiller": "Moussa Diop", "responsableClosing": "Fatou Sarr",
	}
	venteID = venteSaisieCalculee(t, b, corps)

	statut, liste := appelJSON(b, http.MethodGet, "/api/v1/ventes", nil, nil)
	b.attend(statut, http.StatusOK, "lecture de la vente saisie", liste)
	if len(liste["ventes"].([]any)) == 0 {
		t.Fatalf("la vente saisie doit apparaître dans la liste : %v", liste)
	}

	corps["client"] = client + " MODIFIE"
	corps["acompte"] = 900000
	corps["autrePiece"] = "Passeport A0123456"
	statut, vente := appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), corps, nil)
	b.attend(statut, http.StatusOK, "modification de la vente", vente)
	if !strings.EqualFold(fmt.Sprint(vente["client"]), client+" MODIFIE") || vente["acompte"] != float64(900000) {
		t.Fatalf("vente modifiée : %v", vente)
	}
	exigerIdentiteClient(t, vente)

	statut, vente = appelJSON(b, http.MethodPost, fmt.Sprintf("/api/v1/ventes/%d/versements", venteID), map[string]any{
		"date": "2026-09-19", "montant": 4700000,
	}, nil)
	b.attend(statut, http.StatusCreated, "ajout du versement dans le détail", vente)
	versements, _ := vente["versements"].([]any)
	if soldee, _ := vente["soldee"].(bool); len(versements) != 1 || !soldee || vente["reliquat"] != float64(0) {
		t.Fatalf("vente soldée après le versement : %v", vente)
	}
	venteArchiveePuisSoldee(t, b, venteID, corps)

	// Des ventes saisies en production ont changé sans que personne ne sache qui
	// avait touché quoi : chaque geste garde l'état avant et après.
	exigerTrace(t, b, "vente", strconv.FormatInt(venteID, 10), "acompte", []string{
		"vente.creer  500000", "vente.corriger 500000 900000", "vente.versement_ajouter  ",
		"vente.archiver 900000 ", "vente.restaurer  900000", "vente.corriger 900000 100000",
	})
}

// Changer la règle d'un site change les parts des ventes suivantes : l'ancienne valeur reste lisible.
func TestReglageSiteVenteTrace(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	corps := map[string]any{
		"nom": "SITE TRACE " + b.userID[:8], "ordre": 99, "superficieDefaut": "", "prixUnitaireDefaut": 1000000,
		"partProprietaireParLot": 500000, "partApporteurMode": "POURCENTAGE_PROPRIETAIRE", "partApporteurValeur": 10,
	}
	statut, site := appelJSON(b, http.MethodPost, "/api/v1/ventes/sites", corps, nil)
	b.attend(statut, http.StatusOK, "ajout d’un site", site)
	id := fmt.Sprint(site["id"])
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes_sites" WHERE "id" = $1`, id)
	})
	corps["partApporteurValeur"] = 5
	statut, site = appelJSON(b, http.MethodPatch, "/api/v1/ventes/sites/"+id, corps, nil)
	b.attend(statut, http.StatusOK, "modification de la règle apporteur", site)
	exigerTrace(t, b, "vente_site", id, "partApporteurValeur", []string{
		"vente_site.creer  10", "vente_site.modifier 10 5",
	})
}

func exigerTrace(t *testing.T, b *banc, entite, id, champ string, attendu []string) {
	t.Helper()
	lignes, err := b.pool.Query(b.ctx, `SELECT "action" || ' ' || COALESCE("before"->>$3, '') || ' ' || COALESCE("after"->>$3, '')
		FROM "audit_logs" WHERE "entity" = $1 AND "entityId" = $2 ORDER BY "at", "id"`, entite, id, champ)
	if err != nil {
		t.Fatal(err)
	}
	var trace []string
	for lignes.Next() {
		var ligne string
		if err := lignes.Scan(&ligne); err != nil {
			t.Fatal(err)
		}
		trace = append(trace, ligne)
	}
	if strings.Join(trace, " | ") != strings.Join(attendu, " | ") {
		t.Fatalf("trace de %s %s :\n reçue   %q\n attendue %q", entite, id, trace, attendu)
	}
}

// Une vente saisie avant l'échéancier, sur un site et un canal retirés depuis,
// reste corrigeable sans changer de site ni inventer de date.
func TestVenteAncienneCorrigeableSurSiteEtCanalRetires(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	var venteID int64
	if err := b.pool.QueryRow(b.ctx, `INSERT INTO "ventes" ("origine", "numero", "canal", "client", "telephone",
		"site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte", "reliquat",
		"partProprietaire", "partApporteur", "partCpi", "modePaiement", "nombreEcheances")
		VALUES ('SAISIE', 0, 'DMN', 'CLIENT ANCIEN', '770000001', 'NOFLAYE', 1, '', '', 5000000, 5000000, 0, 5000000,
		0, 0, 5000000, 'CREDIT', 10) RETURNING "id"`).Scan(&venteID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "id" = $1`, venteID)
	})

	statut, vente := appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), map[string]any{
		"canal": "DMN", "dateSouscription": "2026-09-01", "client": "CLIENT ANCIEN", "telephone": "77 000 00 02",
		"site": "NOFLAYE", "nombreLots": 1, "numerosLots": "", "superficie": "", "prixUnitaire": 5000000,
		"acompte": 0, "modePaiement": "CREDIT", "nombreEcheances": 10,
	}, nil)
	b.attend(statut, http.StatusOK, "correction d’une ancienne vente", vente)
	if vente["telephone"] == "770000001" || vente["jourVersement"] != nil {
		t.Fatalf("vente ancienne corrigée : %v", vente)
	}
}

func exigerIdentiteClient(t *testing.T, vente map[string]any) {
	t.Helper()
	if vente["email"] != "client.saisie@exemple.sn" || vente["dateDelivranceCni"] != "2021-03-04" ||
		vente["autrePiece"] != "Passeport A0123456" || vente["responsableClosing"] != "Fatou Sarr" {
		t.Fatalf("identité du client et suivi de la vente : %v", vente)
	}
}

func venteSaisieCalculee(t *testing.T, b *banc, corps map[string]any) int64 {
	t.Helper()
	statut, vente := appelJSON(b, http.MethodPost, "/api/v1/ventes", corps, nil)
	b.attend(statut, http.StatusCreated, "création d’une vente", vente)
	versements, _ := vente["versements"].([]any)
	if vente["origine"] != "SAISIE" || vente["prixTotal"] != float64(5600000) || vente["reliquat"] != float64(5100000) || vente["modePaiement"] != "CREDIT" || vente["nombreEcheances"] != float64(12) || vente["periodiciteMois"] != float64(2) ||
		vente["jourVersement"] != float64(10) || vente["premierVersement"] != "2026-10-10" || len(versements) != 0 {
		t.Fatalf("calcul de la vente : %v", vente)
	}
	return int64(vente["id"].(float64))
}

func venteArchiveePuisSoldee(t *testing.T, b *banc, venteID int64, corps map[string]any) {
	t.Helper()
	statut, _ := appelJSON(b, http.MethodDelete, fmt.Sprintf("/api/v1/ventes/%d", venteID), nil, nil)
	b.attend(statut, http.StatusNoContent, "archivage de la vente", nil)
	statut, liste := appelJSON(b, http.MethodGet, "/api/v1/ventes", nil, nil)
	b.attend(statut, http.StatusOK, "liste après archivage", liste)
	if venteDansListe(liste["ventes"].([]any), venteID) {
		t.Fatalf("la vente archivée ne doit plus être active : %v", liste)
	}

	statut, vente := appelJSON(b, http.MethodPost, fmt.Sprintf("/api/v1/ventes/%d/restaurer", venteID), nil, nil)
	b.attend(statut, http.StatusOK, "restauration de la vente", vente)
	if int64(vente["id"].(float64)) != venteID {
		t.Fatalf("vente restaurée : %v", vente)
	}
	corps["modePaiement"] = "COMPTANT"
	delete(corps, "nombreEcheances")
	corps["acompte"] = 100000
	corps["marquerSoldee"] = true
	statut, vente = appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), corps, nil)
	b.attend(statut, http.StatusOK, "forçage explicite du statut soldée", vente)
	soldee, _ := vente["soldee"].(bool)
	manuellement, _ := vente["soldeeManuellement"].(bool)
	if !soldee || !manuellement {
		t.Fatalf("la vente doit être soldée après confirmation explicite : %v", vente)
	}
}

func venteDansListe(elements []any, id int64) bool {
	for _, element := range elements {
		if element.(map[string]any)["id"] == float64(id) {
			return true
		}
	}
	return false
}

func exigerCanauxVentes(t *testing.T, elements []any) {
	t.Helper()
	canaux := map[string]bool{}
	for _, element := range elements {
		canal := element.(map[string]any)
		canaux[canal["libelle"].(string)] = canal["actif"].(bool)
	}
	if canaux["DMN"] {
		t.Fatalf("le canal DMN ne doit plus être proposé : %v", canaux)
	}
	for _, libelle := range []string{"CPI", "BDD CPI", "BDD PERSO.", "SPONTANNE", "MARKETING", "BDD DEPLOIEMENT"} {
		if !canaux[libelle] {
			t.Fatalf("canal manquant dans la configuration : %s (%v)", libelle, canaux)
		}
	}
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
