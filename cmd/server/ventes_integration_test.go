//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/shared/socle"
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

	ventes := ventesImportees(reponse)
	if len(ventes) != 1 {
		t.Fatalf("une vente importée depuis le 10 septembre attendue, %d reçues : %v", len(ventes), ventes)
	}
	vente := ventes[0]
	versements, _ := vente["versements"].([]any)
	if vente["client"] != "AWA SARR" || vente["prixTotal"] != float64(6_000_000) || len(versements) != 2 {
		t.Fatalf("vente mal lue : %v", vente)
	}

	// Sans date de début, une vente sans date de souscription compte : l'écarter
	// retirait 13 millions du chiffre d'affaires du vrai classeur.
	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusOK, "dépôt sans date de début", reponse)
	if toutes := ventesImportees(reponse); len(toutes) != 3 {
		t.Fatalf("trois ventes attendues, dont une sans date : %v", toutes)
	}

	// Une date de début postérieure à toutes les ventes vidait l'espace sans prévenir.
	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur?depuis=2030-01-01", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusBadRequest, "dépôt qui ne garderait aucune vente", reponse)
	statut, reponse = b.appel(http.MethodGet, "/api/v1/ventes", nil, false)
	if toutes := ventesImportees(reponse); statut != http.StatusOK || len(toutes) != 3 {
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

// Au-delà du plafond, ce sont les ventes les plus anciennes qui manquent, et la réponse le dit.
func TestVentesListeTronqueeAuxPlusRecentes(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	client := "CLIENT PLAFOND " + strings.ToUpper(b.userID[:8])
	t.Cleanup(func() { b.exec(`DELETE FROM "ventes" WHERE "client" = $1`, client) })
	b.exec(`INSERT INTO "ventes" ("origine", "numero", "canal", "dateSouscription", "client", "telephone", "site", "nombreLots",
		"numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte", "reliquat", "partProprietaire", "partApporteur", "partCpi")
		SELECT 'SAISIE', 0, 'CPI', DATE '2090-01-01' - i, $1, '770000004', 'THIEO', 1, '', '', 1, 1, 0, 1, 0, 0, 1
		FROM generate_series(0, 5000) i`, client)
	statut, liste := appelJSON(b, http.MethodGet, "/api/v1/ventes", nil, nil)
	b.attend(statut, http.StatusOK, "liste des ventes", liste)
	ventes, _ := liste["ventes"].([]any)
	if tronque, _ := liste["tronque"].(bool); !tronque || len(ventes) != 5000 || ventes[0].(map[string]any)["dateSouscription"] != "2090-01-01" {
		t.Fatalf("5 000 ventes, les plus récentes d’abord, et l’indication de troncature : %v, %d ventes", liste["tronque"], len(ventes))
	}
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

// Corriger une vente sans toucher site, lots ni prix garde ses parts, même si la règle du site a changé.
func TestVenteCorrectionGardeSesParts(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	site := map[string]any{
		"nom": "SITE PARTS " + b.userID[:8], "ordre": 99, "superficieDefaut": "", "prixUnitaireDefaut": 1000000,
		"partProprietaireParLot": 500000, "partApporteurMode": "POURCENTAGE_PROPRIETAIRE", "partApporteurValeur": 10,
	}
	statut, siteCree := appelJSON(b, http.MethodPost, "/api/v1/ventes/sites", site, nil)
	b.attend(statut, http.StatusOK, "ajout du site", siteCree)
	siteID := fmt.Sprint(siteCree["id"])
	nomSite := fmt.Sprint(siteCree["nom"])
	var venteID int64
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		if venteID != 0 {
			b.exec(`DELETE FROM "ventes" WHERE "id" = $1`, venteID)
		}
		b.exec(`DELETE FROM "ventes_sites" WHERE "id" = $1`, siteID)
	})

	corps := map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-18", "client": "CLIENT PARTS " + b.userID[:8],
		"telephone": "77 111 00 88", "site": nomSite, "nombreLots": 1, "numerosLots": "", "superficie": "",
		"prixUnitaire": 1000000, "acompte": 0, "modePaiement": "COMPTANT",
	}
	statut, vente := appelJSON(b, http.MethodPost, "/api/v1/ventes", corps, nil)
	b.attend(statut, http.StatusCreated, "création de la vente sur le site", vente)
	venteID = int64(vente["id"].(float64))
	// Site à 500 000 propriétaire, 10 % apporteur : 50 000 apporteur, 450 000 CPI.
	if vente["partProprietaire"] != float64(500000) || vente["partApporteur"] != float64(50000) || vente["partCpi"] != float64(450000) {
		t.Fatalf("parts à la création : %v", vente)
	}

	site["partApporteurValeur"] = 50
	statut, siteModifie := appelJSON(b, http.MethodPatch, "/api/v1/ventes/sites/"+siteID, site, nil)
	b.attend(statut, http.StatusOK, "règle apporteur relevée à 50 %", siteModifie)

	corps["client"] = "CLIENT PARTS MODIFIE " + b.userID[:8]
	statut, vente = appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), corps, nil)
	b.attend(statut, http.StatusOK, "correction sans toucher site, lots ni prix", vente)
	if vente["partProprietaire"] != float64(500000) || vente["partApporteur"] != float64(50000) || vente["partCpi"] != float64(450000) {
		t.Fatalf("les parts doivent rester celles de la saisie malgré la nouvelle règle du site : %v", vente)
	}
}

// Le classeur fait foi pour ses ventes : le panneau ne les corrige pas, ne les archive pas et n'y verse rien.
func TestVenteImporteeRefuseLesEcrituresDuPanneau(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes_classeurs"`)
	})
	statut, reponse := b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", classeurVentesTest(t))
	b.attend(statut, http.StatusOK, "dépôt", reponse)
	vente := ventesImportees(reponse)[0]
	chemin := fmt.Sprintf("/api/v1/ventes/%d", int64(vente["id"].(float64)))
	correction := map[string]any{
		"canal": vente["canal"], "dateSouscription": "2026-09-05", "client": vente["client"], "telephone": "77 000 00 01",
		"site": vente["site"], "nombreLots": vente["nombreLots"], "numerosLots": "", "superficie": "",
		"prixUnitaire": vente["prixUnitaire"], "acompte": 0, "modePaiement": "COMPTANT",
	}
	for _, ecriture := range []struct {
		methode, chemin string
		corps           map[string]any
	}{
		{http.MethodPatch, chemin, correction},
		{http.MethodPost, chemin + "/versements", map[string]any{"date": "2026-09-19", "montant": 500000}},
		{http.MethodDelete, chemin, nil},
		{http.MethodPost, chemin + "/restaurer", nil},
	} {
		statut, corps := appelJSON(b, ecriture.methode, ecriture.chemin, ecriture.corps, nil)
		b.attend(statut, http.StatusConflict, ecriture.methode+" "+ecriture.chemin, corps)
		if corps["code"] != "VENTE_DU_CLASSEUR" {
			t.Fatalf("%s %s : code %v", ecriture.methode, ecriture.chemin, corps["code"])
		}
	}
}

// Un versement saisi au panneau et absent du nouveau classeur bloque le dépôt ; sa seule trace au journal ne bloque plus rien.
func TestDepotClasseurNeFaitPasDisparaitreUnVersement(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes_classeurs"`)
	})
	contenu := classeurVentesTest(t)
	statut, reponse := b.deposerClasseur("/api/v1/ventes/classeur", "ventes-versement.xlsx", contenu)
	b.attend(statut, http.StatusOK, "premier dépôt", reponse)
	var venteID int64
	for _, vente := range ventesImportees(reponse) {
		if vente["numero"] == float64(2) {
			venteID = int64(vente["id"].(float64))
		}
	}
	b.exec(`INSERT INTO "ventes_versements" ("venteId", "rang", "date", "montant") VALUES ($1, 3, '2026-09-19', 250000)`, venteID)
	b.exec(`INSERT INTO "audit_logs" ("id", "userId", "action", "entity", "entityId", "before")
		VALUES (gen_random_uuid()::text, $1, 'vente.versement_ajouter', 'vente', $2::bigint::text, '{"montant": 250000}')`, b.userID, venteID)

	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur", "ventes-versement.xlsx", contenu)
	b.attend(statut, http.StatusConflict, "redépôt qui effacerait le versement saisi au panneau", reponse)
	if reponse["code"] != "VENTES_VERSEMENTS_HORS_CLASSEUR" || !strings.Contains(fmt.Sprint(reponse["message"]), "n° 2 ") {
		t.Fatalf("le refus nomme la vente en cause : %v", reponse)
	}
	if n := venteCompteTest(t, b, `SELECT count(*)::int FROM "ventes_versements" WHERE "venteId" = $1`, venteID); n != 3 {
		t.Fatalf("le versement saisi hors classeur ne doit pas disparaître : %d", n)
	}

	b.exec(`DELETE FROM "ventes_versements" WHERE "venteId" = $1 AND "rang" = 3`, venteID)
	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur", "ventes-versement.xlsx", contenu)
	b.attend(statut, http.StatusOK, "redépôt une fois le versement retiré, malgré son ancienne trace", reponse)
	remplacees := venteCompteTest(t, b, `SELECT jsonb_array_length("before"->'ventes') FROM "audit_logs"
		WHERE "userId" = $1 AND "action" = 'vente.importer' ORDER BY "at" DESC, "id" DESC LIMIT 1`, b.userID)
	versements := venteCompteTest(t, b, `SELECT jsonb_array_length(v->'versements') FROM "audit_logs" a,
		jsonb_array_elements(a."before"->'ventes') v
		WHERE a."userId" = $1 AND a."action" = 'vente.importer' AND (v->>'id')::bigint = $2`, b.userID, venteID)
	if remplacees != 3 || versements != 2 {
		t.Fatalf("la trace du dépôt garde les ventes remplacées et leurs versements : %d ventes, %d versements", remplacees, versements)
	}
}

// Un dépôt numérote ses ventes sous le même verrou qu'une saisie.
func TestDepotAttendLeVerrouDeNumerotation(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	client := "CLIENT NUMERO " + strings.ToUpper(b.userID[:8])
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "client" = $1`, client)
		b.exec(`DELETE FROM "ventes_classeurs"`)
	})
	contenu := classeurVentesTest(t)
	deposer := func() int {
		statut, _ := b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", contenu)
		return statut
	}
	creer := func() int {
		statut, _ := appelJSON(b, http.MethodPost, "/api/v1/ventes", venteComptant(client), nil)
		return statut
	}
	statuts := sousVerrou(b, `SELECT pg_advisory_xact_lock(hashtext('ventes.numero'))`, nil, deposer, creer)
	if statuts[0] != http.StatusOK || statuts[1] != http.StatusCreated {
		t.Fatalf("dépôt puis saisie aboutissent : %v", statuts)
	}
}

// « - », « #N/A » et cellule vide valent zéro ; un montant vraiment illisible refuse le dépôt en nommant sa ligne.
func TestDepotClasseurMontantsVidesOuIllisibles(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes_classeurs"`)
	})
	contenu := classeurModifie(t, map[string]string{"P3": "-", "Q4": "#N/A"}, map[string]string{"E5": "#N/A"})
	statut, reponse := b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", contenu)
	b.attend(statut, http.StatusOK, "dépôt avec « - » et « #N/A »", reponse)
	for _, vente := range ventesImportees(reponse) {
		versements, _ := vente["versements"].([]any)
		if vente["numero"] == float64(2) && (vente["partCpi"] != float64(0) || len(versements) != 1) {
			t.Fatalf("« #N/A » vaut zéro dans une part et aucun versement dans les échéances : %v", vente)
		}
	}

	statut, reponse = b.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", classeurModifie(t, map[string]string{"K4": "1 500 000"}, nil))
	b.attend(statut, http.StatusBadRequest, "dépôt avec un montant illisible", reponse)
	if !strings.Contains(fmt.Sprint(reponse["message"]), "ligne 4") {
		t.Fatalf("le refus nomme la ligne : %v", reponse)
	}
}

// Un rôle qui ne fait que lire les ventes ne saisit rien et ne dépose aucun classeur.
func TestVentesLecteurNePeutPasEcrire(t *testing.T) {
	admin := adminConnecte(t)
	roleID := creerRolePersonnalise(admin, "Lecteur ventes "+admin.userID[:8], socle.Direction,
		[]string{string(socle.PermissionPanneauAcceder), string(socle.PermissionVentesLire)})
	_, email := compteDuRole(admin, roleID)
	lecteur := adminSession(admin, email)
	statut, corps := appelJSON(lecteur, http.MethodPost, "/api/v1/ventes", venteComptant("CLIENT LECTEUR"), nil)
	lecteur.attend(statut, http.StatusForbidden, "saisie par un lecteur", corps)
	statut, corps = lecteur.deposerClasseur("/api/v1/ventes/classeur", "ventes.xlsx", classeurVentesTest(t))
	lecteur.attend(statut, http.StatusForbidden, "dépôt par un lecteur", corps)
}

func classeurModifie(t *testing.T, ventes, echeances map[string]string) []byte {
	t.Helper()
	f, err := excelize.OpenReader(bytes.NewReader(classeurVentesTest(t)))
	if err != nil {
		t.Fatal(err)
	}
	for feuille, cellules := range map[string]map[string]string{"1. TABLEAU DES VENTES": ventes, "2. ECHEANCES MENSUELLES": echeances} {
		for cellule, valeur := range cellules {
			if err := f.SetCellStr(feuille, cellule, valeur); err != nil {
				t.Fatal(err)
			}
		}
	}
	var tampon bytes.Buffer
	if err := f.Write(&tampon); err != nil {
		t.Fatal(err)
	}
	return tampon.Bytes()
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
	if vente["telephone"] == "770000001" || vente["jourVersement"] != nil || vente["partCpi"] != float64(5000000) {
		t.Fatalf("vente ancienne corrigée : %v", vente)
	}
}

// Une ancienne vente dont la part CPI est négative se corrige encore, tant que ses parts ne sont pas recalculées.
func TestVenteAncienneAPartCpiNegativeResteCorrigeable(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	var venteID int64
	if err := b.pool.QueryRow(b.ctx, `INSERT INTO "ventes" ("origine", "numero", "canal", "client", "telephone",
		"site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte", "reliquat",
		"partProprietaire", "partApporteur", "partCpi", "modePaiement")
		VALUES ('SAISIE', 0, 'CPI', 'CLIENT PARTS NEGATIVES', '770000003', 'THIEO', 1, '', '', 1000000, 1000000, 0, 1000000,
		900000, 200000, -100000, 'COMPTANT') RETURNING "id"`).Scan(&venteID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "id" = $1`, venteID)
	})
	statut, vente := appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-01", "client": "CLIENT PARTS NEGATIVES", "telephone": "77 000 00 03",
		"site": "THIEO", "nombreLots": 1, "numerosLots": "", "superficie": "", "prixUnitaire": 1000000, "acompte": 0,
		"modePaiement": "COMPTANT", "email": "client.parts@exemple.sn",
	}, nil)
	b.attend(statut, http.StatusOK, "correction de l’e-mail", vente)
	if vente["email"] != "client.parts@exemple.sn" || vente["partCpi"] != float64(-100000) {
		t.Fatalf("e-mail corrigé, parts inchangées : %v", vente)
	}
}

func venteComptant(client string) map[string]any {
	return map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-18", "client": client, "telephone": "77 000 00 77",
		"site": "THIEO", "nombreLots": 1, "numerosLots": "", "superficie": "", "prixUnitaire": 1000000,
		"acompte": 0, "modePaiement": "COMPTANT", "partProprietaire": 0, "partApporteur": 0,
	}
}

func TestVenteRefusePartsSuperieuresAuPrix(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	t.Cleanup(func() { b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID) })
	for quoi, parts := range map[string]map[string]any{
		"somme des parts au-dessus du prix": {"partProprietaire": 900000, "partApporteur": 200000},
		"part CPI négative":                 {"partCpi": -1},
	} {
		corps := venteComptant("CLIENT PARTS " + b.userID[:8])
		for cle, valeur := range parts {
			corps[cle] = valeur
		}
		statut, body := appelJSON(b, http.MethodPost, "/api/v1/ventes", corps, nil)
		b.attend(statut, http.StatusBadRequest, quoi, body)
		if body["code"] != "VENTE_PARTS_INVALIDES" {
			t.Fatalf("%s : code %v", quoi, body["code"])
		}
	}
}

// Deux versements et deux saisies partent ensemble : rangs et numéros distincts, reliquat juste.
func TestVersementsSimultanesMemeVente(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	client := "CLIENT VERSEMENTS " + strings.ToUpper(b.userID[:8])
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "client" = $1`, client)
	})
	creer := func() int {
		statut, _ := appelJSON(b, http.MethodPost, "/api/v1/ventes", venteComptant(client), nil)
		return statut
	}
	statuts := sousVerrou(b, `SELECT pg_advisory_xact_lock(hashtext('ventes.numero'))`, nil, creer, creer)
	if statuts[0] != http.StatusCreated || statuts[1] != http.StatusCreated {
		t.Fatalf("les deux saisies aboutissent : %v", statuts)
	}
	var venteID int64
	var numeros int
	if err := b.pool.QueryRow(b.ctx, `SELECT min("id"), count(DISTINCT "numero")::int FROM "ventes" WHERE "client" = $1`,
		client).Scan(&venteID, &numeros); err != nil {
		t.Fatal(err)
	}
	if numeros != 2 {
		t.Fatalf("deux saisies simultanées reçoivent deux numéros, %d distinct(s)", numeros)
	}

	verser := func(montant int) func() int {
		return func() int {
			statut, _ := appelJSON(b, http.MethodPost, fmt.Sprintf("/api/v1/ventes/%d/versements", venteID),
				map[string]any{"date": "2026-09-19", "montant": montant}, nil)
			return statut
		}
	}
	statuts = sousVerrou(b, `SELECT 1 FROM "ventes" WHERE "id" = $1 FOR UPDATE`, []any{venteID}, verser(100000), verser(200000))
	if statuts[0] != http.StatusCreated || statuts[1] != http.StatusCreated {
		t.Fatalf("les deux versements aboutissent : %v", statuts)
	}
	var rangs, reliquat int64
	if err := b.pool.QueryRow(b.ctx, `SELECT (SELECT sum("rang") FROM "ventes_versements" WHERE "venteId" = $1), "reliquat"
		FROM "ventes" WHERE "id" = $1`, venteID).Scan(&rangs, &reliquat); err != nil {
		t.Fatal(err)
	}
	if rangs != 3 || reliquat != 700000 {
		t.Fatalf("rangs 1 et 2, reliquat 700000 attendus : somme des rangs %d, reliquat %d", rangs, reliquat)
	}
}

// Un site ou un canal renommé emporte ses ventes : les corriger ensuite ne répond plus 400.
func TestRenommerSiteSuitLesVentes(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	suffixe := strings.ToUpper(b.userID[:8])
	statut, site := appelJSON(b, http.MethodPost, "/api/v1/ventes/sites", map[string]any{
		"nom": "SITE AVANT " + suffixe, "ordre": 99, "superficieDefaut": "", "prixUnitaireDefaut": 1000000,
		"partProprietaireParLot": 0, "partApporteurMode": "AUCUNE", "partApporteurValeur": 0,
	}, nil)
	b.attend(statut, http.StatusOK, "ajout d’un site", site)
	statut, canal := appelJSON(b, http.MethodPost, "/api/v1/ventes/canaux", map[string]any{"libelle": "CANAL AVANT " + suffixe, "ordre": 99}, nil)
	b.attend(statut, http.StatusOK, "ajout d’un canal", canal)
	corps := venteComptant("CLIENT RENOMME " + suffixe)
	corps["site"], corps["canal"] = site["nom"], canal["libelle"]
	statut, vente := appelJSON(b, http.MethodPost, "/api/v1/ventes", corps, nil)
	b.attend(statut, http.StatusCreated, "vente sur le site", vente)
	venteID, siteID, canalID := int64(vente["id"].(float64)), fmt.Sprint(site["id"]), fmt.Sprint(canal["id"])
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "id" = $1`, venteID)
		b.exec(`DELETE FROM "ventes_sites" WHERE "id" = $1`, siteID)
		b.exec(`DELETE FROM "ventes_canaux" WHERE "id" = $1`, canalID)
	})

	statut, site = appelJSON(b, http.MethodPatch, "/api/v1/ventes/sites/"+siteID, map[string]any{
		"nom": "SITE APRES " + suffixe, "ordre": 99, "superficieDefaut": "", "prixUnitaireDefaut": 1000000,
		"partProprietaireParLot": 0, "partApporteurMode": "AUCUNE", "partApporteurValeur": 0,
	}, nil)
	b.attend(statut, http.StatusOK, "renommage du site", site)
	statut, canal = appelJSON(b, http.MethodPatch, "/api/v1/ventes/canaux/"+canalID,
		map[string]any{"libelle": "CANAL APRES " + suffixe, "ordre": 99}, nil)
	b.attend(statut, http.StatusOK, "renommage du canal", canal)

	var siteVente, canalVente string
	if err := b.pool.QueryRow(b.ctx, `SELECT "site", "canal" FROM "ventes" WHERE "id" = $1`, venteID).Scan(&siteVente, &canalVente); err != nil {
		t.Fatal(err)
	}
	if siteVente != site["nom"] || canalVente != canal["libelle"] {
		t.Fatalf("la vente suit le site et le canal renommés : %s, %s", siteVente, canalVente)
	}
	corps["site"], corps["canal"] = siteVente, canalVente
	statut, vente = appelJSON(b, http.MethodPatch, fmt.Sprintf("/api/v1/ventes/%d", venteID), corps, nil)
	b.attend(statut, http.StatusOK, "correction après renommage", vente)
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
	statut, vente = appelJSON(b, http.MethodPost, "/api/v1/ventes/999999999999/restaurer", nil, nil)
	b.attend(statut, http.StatusNotFound, "restauration d’une vente inconnue", vente)
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

func venteCompteTest(t *testing.T, b *banc, requete string, args ...any) int {
	t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, requete, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
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

// La base locale peut porter des ventes saisies à la main : seules celles du classeur comptent.
func ventesImportees(reponse map[string]any) []map[string]any {
	toutes, _ := reponse["ventes"].([]any)
	var importees []map[string]any
	for _, brute := range toutes {
		if v, _ := brute.(map[string]any); v["origine"] == "IMPORT" {
			importees = append(importees, v)
		}
	}
	return importees
}

// Stock de trois lots : une saisie et une correction simultanées ne le dépassent pas.
func TestVenteStockDuSite(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	suffixe := strings.ToUpper(b.userID[:8])
	reglage := map[string]any{
		"nom": "SITE STOCK " + suffixe, "ordre": 99, "totalLots": 3, "superficieDefaut": "", "prixUnitaireDefaut": 1000000,
		"partProprietaireParLot": 0, "partApporteurMode": "AUCUNE", "partApporteurValeur": 0,
	}
	statut, site := appelJSON(b, http.MethodPost, "/api/v1/ventes/sites", reglage, nil)
	b.attend(statut, http.StatusOK, "site avec stock", site)
	nom, siteID := fmt.Sprint(site["nom"]), fmt.Sprint(site["id"])
	t.Cleanup(func() {
		b.exec(`DELETE FROM "audit_logs" WHERE "userId" = $1`, b.userID)
		b.exec(`DELETE FROM "ventes" WHERE "site" = $1`, nom)
		b.exec(`DELETE FROM "ventes_sites" WHERE "id" = $1`, siteID)
	})
	if site["lotsVendus"] != float64(0) || site["lotsRestants"] != float64(3) {
		t.Fatalf("site neuf : %v vendus, %v restants", site["lotsVendus"], site["lotsRestants"])
	}
	vente := func(client string, lots int) map[string]any {
		corps := venteComptant(client + " " + suffixe)
		corps["site"], corps["nombreLots"] = nom, lots
		return corps
	}
	statut, premiere := appelJSON(b, http.MethodPost, "/api/v1/ventes", vente("CLIENT A", 1), nil)
	b.attend(statut, http.StatusCreated, "premier lot", premiere)
	cheminA := fmt.Sprintf("/api/v1/ventes/%v", premiere["id"])

	statuts := sousVerrou(b, `SELECT pg_advisory_xact_lock(hashtext('ventes.numero'))`, nil,
		func() int {
			statut, _ := appelJSON(b, http.MethodPost, "/api/v1/ventes", vente("CLIENT B", 2), nil)
			return statut
		},
		func() int {
			statut, _ := appelJSON(b, http.MethodPatch, cheminA, vente("CLIENT A", 2), nil)
			return statut
		})
	if (statuts[0] == http.StatusConflict) == (statuts[1] == http.StatusConflict) {
		t.Fatalf("une seule des deux écritures tient dans le stock : %v", statuts)
	}
	vendus := venteCompteTest(t, b, `SELECT COALESCE(sum("nombreLots"), 0)::int FROM "ventes" WHERE "site" = $1`, nom)
	if lu := stockDuSite(t, b, siteID); vendus != 3 || lu["lotsVendus"] != float64(3) || lu["lotsRestants"] != float64(0) {
		t.Fatalf("trois lots vendus attendus : %d en base, %v", vendus, lu)
	}

	statut, refus := appelJSON(b, http.MethodPost, "/api/v1/ventes", vente("CLIENT C", 1), nil)
	b.attend(statut, http.StatusConflict, "stock épuisé", refus)
	if refus["code"] != "VENTE_STOCK_EPUISE" {
		t.Fatalf("code %v", refus["code"])
	}
	reglage["totalLots"] = 1
	statut, site = appelJSON(b, http.MethodPatch, "/api/v1/ventes/sites/"+siteID, reglage, nil)
	b.attend(statut, http.StatusOK, "stock abaissé", site)
	if site["lotsRestants"] != float64(-2) {
		t.Fatalf("stock dépassé de deux lots : %v", site["lotsRestants"])
	}
	lotsA := venteCompteTest(t, b, `SELECT "nombreLots" FROM "ventes" WHERE "id" = $1`, premiere["id"])
	statut, corrigee := appelJSON(b, http.MethodPatch, cheminA, vente("CLIENT A CORRIGE", lotsA), nil)
	b.attend(statut, http.StatusOK, "correction sans lot de plus sur un stock dépassé", corrigee)
	statut, _ = appelJSON(b, http.MethodDelete, cheminA, nil, nil)
	b.attend(statut, http.StatusNoContent, "archivage", nil)
	if lu := stockDuSite(t, b, siteID); lu["lotsVendus"] != float64(3-lotsA) {
		t.Fatalf("une vente archivée ne compte plus : %v", lu)
	}
}

func stockDuSite(t *testing.T, b *banc, id string) map[string]any {
	t.Helper()
	statut, configuration := appelJSON(b, http.MethodGet, "/api/v1/ventes/configuration", nil, nil)
	b.attend(statut, http.StatusOK, "configuration", configuration)
	for _, s := range configuration["sites"].([]any) {
		if site := s.(map[string]any); site["id"] == id {
			return site
		}
	}
	t.Fatalf("site %s absent de la configuration", id)
	return nil
}
