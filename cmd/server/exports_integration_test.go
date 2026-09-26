//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/exports"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// Variante binaire de `b.appel` : un classeur ne se décode pas en JSON.
func (b *banc) classeur(chemin string) (statut int, disposition string, fichier *excelize.File) {
	b.t.Helper()
	req, err := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+chemin, http.NoBody)
	if err != nil {
		b.t.Fatal(err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var corps bytes.Buffer
	if _, err := corps.ReadFrom(resp.Body); err != nil {
		b.t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode, "", nil
	}
	f, err := excelize.OpenReader(bytes.NewReader(corps.Bytes()))
	if err != nil {
		b.t.Fatalf("classeur illisible (%d octets) : %v", corps.Len(), err)
	}
	b.t.Cleanup(func() { _ = f.Close() })
	return resp.StatusCode, resp.Header.Get("Content-Disposition"), f
}

func (b *banc) exec(requete string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, requete, args...); err != nil {
		b.t.Fatal(err)
	}
}

type exportJeu struct {
	region       string
	departement  string
	representant string
	prospect     string
	entreprise   string
	objet        string
	visite       string
	nomRep       string
	nomDep       string
	nomEnt       string
	reference    string
}

// Une ligne par feuille : représentant, prospect au nom piégé, visite. Libellés
// suffixés, la base de test étant partagée et soumise à des unicités.
func exportSemer(b *banc) exportJeu {
	b.t.Helper()
	j := exportJeu{
		region: uuid.NewString(), departement: uuid.NewString(), representant: uuid.NewString(),
		prospect: uuid.NewString(), entreprise: uuid.NewString(), objet: uuid.NewString(),
		visite: uuid.NewString(),
	}
	suffixe := j.prospect[:8]
	j.nomRep, j.nomDep, j.nomEnt = "Fatou "+suffixe, "Département "+suffixe, "CPI "+suffixe
	j.reference = "V-2026-" + suffixe
	b.exec(`INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$2,$3,now())`,
		j.region, "REG-"+suffixe, "Région "+suffixe)
	b.exec(`INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$2,$3,$4,now())`,
		j.departement, "DEP-"+suffixe, j.nomDep, j.region)
	b.exec(`INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
	        VALUES ($1,$2,$3,$4,$5,now(),now())`, j.representant, j.nomRep, "+2217712"+suffixe[:4], j.departement, b.userID)
	// Nom commençant par « = » : Excel ne doit jamais l'évaluer (audits/go-securite.md §3).
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","representantId","createdById","clientCreatedAt","updatedAt")
	        VALUES ($1,'=SUM(1+1)','Aminata',$2,$3,$4,now(),now())`, j.prospect, "+2217798"+suffixe[:4], j.representant, b.userID)
	b.exec(`INSERT INTO "prospect_journeys" ("id","prospectId","projet","statut","updatedAt")
	        VALUES ($1,$2,'CHUES','NOUVEAU',now())`, uuid.NewString(), j.prospect)
	b.exec(`INSERT INTO "visite_entreprises" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`,
		j.entreprise, "ENT-"+suffixe, j.nomEnt)
	b.exec(`INSERT INTO "visite_objets" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`,
		j.objet, "OBJ-"+suffixe, "SUIVI "+suffixe)
	b.exec(`INSERT INTO "visites" ("id","reference","visitedAt","visitorName","entrepriseId","objetId","createdById","updatedAt")
	        VALUES ($1,$2,'2026-01-06 14:30:00','MOUHAMED FALL',$3,$4,$5,now())`,
		j.visite, j.reference, j.entreprise, j.objet, b.userID)

	b.t.Cleanup(func() {
		for _, requete := range []string{
			`DELETE FROM "visites" WHERE "id" = $1`,
		} {
			_, _ = b.pool.Exec(b.ctx, requete, j.visite)
		}
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "visite_objets" WHERE "id" = $1`, j.objet)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "visite_entreprises" WHERE "id" = $1`, j.entreprise)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_journeys" WHERE "prospectId" = $1`, j.prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = $1`, j.prospect)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "id" = $1`, j.representant)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "departements" WHERE "id" = $1`, j.departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, j.region)
	})
	return j
}

func exportCellule(t *testing.T, f *excelize.File, feuille, ref string) string {
	t.Helper()
	valeur, err := f.GetCellValue(feuille, ref)
	if err != nil {
		t.Fatalf("%s!%s : %v", feuille, ref, err)
	}
	return valeur
}

func exportEntetes(t *testing.T, f *excelize.File, feuille string) []string {
	t.Helper()
	lignes, err := f.GetRows(feuille)
	if err != nil {
		t.Fatalf("%s : %v", feuille, err)
	}
	if len(lignes) == 0 {
		t.Fatalf("%s : feuille vide", feuille)
	}
	return lignes[0]
}

func exportAttendFeuilles(t *testing.T, f *excelize.File, attendues ...string) {
	t.Helper()
	feuilles := f.GetSheetList()
	if len(feuilles) != len(attendues) {
		t.Fatalf("feuilles : %v, %v attendues", feuilles, attendues)
	}
	for i, nom := range attendues {
		if feuilles[i] != nom {
			t.Fatalf("feuille %d : %q, %q attendu", i, feuilles[i], nom)
		}
	}
}

func exportAttendFichier(t *testing.T, disposition, attendu string) {
	t.Helper()
	if !strings.Contains(disposition, attendu) {
		t.Fatalf("Content-Disposition %q, %q attendu", disposition, attendu)
	}
}

// La ligne dont la première cellule commence par « = » : la fiche semée.
func exportLignePiegee(t *testing.T, f *excelize.File, feuille string) []string {
	t.Helper()
	lignes, err := f.GetRows(feuille)
	if err != nil {
		t.Fatal(err)
	}
	for _, ligne := range lignes {
		if len(ligne) > 2 && strings.HasPrefix(ligne[0], "=") {
			return ligne
		}
	}
	t.Fatalf("la fiche semée est absente de %s", feuille)
	return nil
}

// Un texte reste un texte : aucune cellule ne doit porter de formule.
func exportAttendAucuneFormule(t *testing.T, f *excelize.File, feuille string) {
	t.Helper()
	lignes, err := f.GetRows(feuille)
	if err != nil {
		t.Fatal(err)
	}
	for rang := range lignes {
		ref, _ := excelize.CoordinatesToCellName(1, rang+1)
		formule, err := f.GetCellFormula(feuille, ref)
		if err != nil {
			t.Fatal(err)
		}
		if formule != "" {
			t.Fatalf("%s est écrite en formule : %q", ref, formule)
		}
	}
}

func TestExportProspectsFeuillesEtInjectionDeFormule(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	j := exportSemer(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, disposition, f := b.classeur("/api/v1/export/prospects.xlsx")
	b.attend(statut, http.StatusOK, "export prospects", nil)
	exportAttendFichier(t, disposition, "cpi-prospects-"+time.Now().UTC().Format("2006-01-02")+".xlsx")
	exportAttendFeuilles(t, f, "Prospects", "Représentants", "Synthèse")

	entetes := exportEntetes(t, f, "Prospects")
	if len(entetes) != len(exports.ExportEntetesProspects) || entetes[0] != "Nom" || entetes[11] != "Date de saisie" {
		t.Fatalf("en-têtes : %v", entetes)
	}
	exportAttendFicheSemee(t, f, &j)
	exportAttendAucuneFormule(t, f, "Prospects")

	if entete := exportEntetes(t, f, "Représentants"); entete[0] != "Représentant" || entete[4] != "Prospects" {
		t.Fatalf("feuille Représentants : %v", entete)
	}
	if titre := exportCellule(t, f, "Synthèse", "A2"); titre != "Vue d’ensemble" {
		t.Fatalf("Synthèse A2 : %q", titre)
	}
	if libelle := exportCellule(t, f, "Synthèse", "A3"); libelle != "Prospects exportés" {
		t.Fatalf("Synthèse A3 : %q", libelle)
	}
}

func exportAttendFicheSemee(t *testing.T, f *excelize.File, j *exportJeu) {
	t.Helper()
	ligne := exportLignePiegee(t, f, "Prospects")
	if ligne[0] != "=SUM(1+1)" {
		t.Fatalf("le nom doit sortir tel quel : %q", ligne[0])
	}
	if ligne[3] != "CHUES" || ligne[4] != "CHUES : Nouveau" {
		t.Fatalf("parcours et statut : %v", ligne[:5])
	}
	if ligne[7] != j.nomRep || ligne[9] != j.nomDep {
		t.Fatalf("représentant et département : %v", ligne)
	}
}

func TestExportProspectsConsolideCinqFeuilles(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	exportSemer(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, disposition, f := b.classeur("/api/v1/export/prospects.xlsx?mode=consolidated")
	b.attend(statut, http.StatusOK, "export consolidé", nil)
	exportAttendFichier(t, disposition, "cpi-prospects-consolide-")
	exportAttendFeuilles(t, f, "Consolidé", "BDD1", "BDD2", "BDD3", "BDD4")
}

func TestExportRefuseParRole(t *testing.T) {
	b := nouveauBanc(t, "SUPERVISEUR")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, _, _ = b.classeur("/api/v1/export/prospects.xlsx")
	b.attend(statut, http.StatusOK, "prospects pour un superviseur", nil)
	statut, _, _ = b.classeur("/api/v1/export/prospects-modele.xlsx")
	b.attend(statut, http.StatusForbidden, "modèle réservé à l'admin", nil)
	statut, _, _ = b.classeur("/api/v1/export/bank-cases.xlsx")
	b.attend(statut, http.StatusOK, "dossiers bancaires pour un superviseur", nil)
	statut, disposition, _ := b.classeur("/api/v1/export/representants.xlsx")
	b.attend(statut, http.StatusOK, "annuaire des représentants", nil)
	exportAttendFichier(t, disposition, "representants-cpi-")
}

func TestExportRepresentantsColonnes(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	j := exportSemer(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, _, f := b.classeur("/api/v1/export/representants.xlsx")
	b.attend(statut, http.StatusOK, "export représentants", nil)
	exportAttendFeuilles(t, f, "Représentants")
	entetes := exportEntetes(t, f, "Représentants")
	if len(entetes) != 11 || entetes[0] != "Nom complet" || entetes[10] != "Créé en base le" {
		t.Fatalf("en-têtes : %v", entetes)
	}
	ligne := exportChercherLigne(t, f, "Représentants", j.nomRep)
	if ligne[3] != j.nomDep || ligne[7] != "1" {
		t.Fatalf("ligne : %v", ligne)
	}
}

func TestExportVisitesRegistre(t *testing.T) {
	b := nouveauBanc(t, "ACCUEIL")
	j := exportSemer(b)
	archivee, referenceArchivee := uuid.NewString(), j.reference+"-ARCH"
	b.exec(`INSERT INTO "visites" ("id","reference","visitedAt","visitorName","entrepriseId","objetId","createdById","updatedAt","deletedAt")
	        VALUES ($1,$2,'2026-01-06 15:00:00','VISITE ARCHIVEE',$3,$4,$5,now(),now())`,
		archivee, referenceArchivee, j.entreprise, j.objet, b.userID)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "visites" WHERE "id" = $1`, archivee) })
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, disposition, f := b.classeur("/api/v1/export/visites.xlsx")
	b.attend(statut, http.StatusOK, "export visites", nil)
	exportAttendFichier(t, disposition, "registre-visites-cpi-")
	entetes := exportEntetes(t, f, "Registre")
	if len(entetes) != 11 || entetes[0] != "N° REGISTRE" || entetes[8] != "OBJET VISITE" {
		t.Fatalf("en-têtes : %v", entetes)
	}
	if rappel := exportCellule(t, f, "Registre", "A2"); !strings.HasPrefix(rappel, "N° REGISTRE vide") {
		t.Fatalf("ligne de rappel : %q", rappel)
	}
	ligne := exportChercherLigne(t, f, "Registre", j.reference)
	if ligne[2] != "14:30" || ligne[3] != "MOUHAMED FALL" || ligne[5] != j.nomEnt {
		t.Fatalf("ligne de visite : %v", ligne)
	}
	lignes, err := f.GetRows("Registre")
	if err != nil {
		t.Fatal(err)
	}
	for _, ligne := range lignes {
		if len(ligne) > 0 && ligne[0] == referenceArchivee {
			t.Fatal("une visite archivée ne sort pas dans le registre")
		}
	}
}

// La ligne dont la première cellule porte la référence cherchée.
func exportChercherLigne(t *testing.T, f *excelize.File, feuille, reference string) []string {
	t.Helper()
	lignes, err := f.GetRows(feuille)
	if err != nil {
		t.Fatal(err)
	}
	for _, ligne := range lignes {
		if len(ligne) > 5 && ligne[0] == reference {
			return ligne
		}
	}
	t.Fatalf("%s : la ligne %q est absente de %v", feuille, reference, lignes)
	return nil
}

func exportComptesTableauDeBord(t *testing.T, f *excelize.File) map[string]string {
	t.Helper()
	lignes, err := f.GetRows("Tableau de bord")
	if err != nil {
		t.Fatal(err)
	}
	comptes := map[string]string{}
	for _, ligne := range lignes {
		if len(ligne) >= 3 {
			comptes[ligne[0]+"/"+ligne[1]] = ligne[2]
		}
	}
	return comptes
}

func TestExportGlobalDouzeFeuillesEtTableauDeBord(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	exportSemer(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, disposition, f := b.classeur("/api/v1/export/global.xlsx")
	b.attend(statut, http.StatusOK, "export global", nil)
	exportAttendFichier(t, disposition, "cpi-global-")
	exportAttendFeuilles(t, f, "Tableau de bord", "Représentants", "Relances", "Prospects", "Parcours",
		"Conversions", "Appels", "Campagnes", "Affectations", "Commentaires", "Historique", "Suggestions")

	if entete := exportEntetes(t, f, "Prospects"); entete[0] != "Identifiant" || entete[1] != "Identifiant représentant" || entete[12] != "Téléconseiller" {
		t.Fatalf("en-têtes Prospects : %v", entete)
	}
	if groupe := exportCellule(t, f, "Tableau de bord", "A2"); groupe != "Groupe" {
		t.Fatalf("Tableau de bord A2 : %q", groupe)
	}
	comptes := exportComptesTableauDeBord(t, f)
	if comptes["Totaux/Représentants"] == "" || comptes["Totaux/Représentants"] == "0" {
		t.Fatalf("le tableau de bord ne compte aucun représentant : %v", comptes)
	}
	if comptes["Totaux/Prospects"] == "" || comptes["Totaux/Prospects"] == "0" {
		t.Fatalf("le tableau de bord ne compte aucun prospect : %v", comptes)
	}
	if comptes["Parcours par statut/Nouveau"] == "" {
		t.Fatalf("les parcours ne sont pas comptés : %v", comptes)
	}
}

func TestExportModeleProspectsListesDeroulantes(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	statut, disposition, f := b.classeur("/api/v1/export/prospects-modele.xlsx")
	b.attend(statut, http.StatusOK, "modèle prospects", nil)
	exportAttendFichier(t, disposition, "modele-import-prospects-")
	exportAttendFeuilles(t, f, "Prospects", "Listes", "Instructions")
	entetes := exportEntetes(t, f, "Prospects")
	if len(entetes) != 7 || entetes[0] != "Nom" || entetes[6] != "Méthode d’enrôlement" {
		t.Fatalf("en-têtes : %v", entetes)
	}
	if exemple := exportCellule(t, f, "Prospects", "A2"); exemple != "Ndiaye" {
		t.Fatalf("ligne d'exemple : %q", exemple)
	}
	visible, err := f.GetSheetVisible("Listes")
	if err != nil {
		t.Fatal(err)
	}
	if visible {
		t.Fatal("la feuille Listes doit rester masquée")
	}
	if methode := exportCellule(t, f, "Listes", "C2"); methode != "Enrôlement sur place" {
		t.Fatalf("liste des méthodes : %q", methode)
	}
	if aide := exportCellule(t, f, "Instructions", "B2"); aide != "Oui" {
		t.Fatalf("Instructions : la colonne Nom est obligatoire, lu %q", aide)
	}
}

func exportVente(b *banc, site, client, date string, prix, acompte int64, archivee bool) int64 {
	b.t.Helper()
	var id int64
	if err := b.pool.QueryRow(b.ctx, `INSERT INTO "ventes" ("origine", "numero", "canal", "dateSouscription", "client", "telephone",
		"site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte", "reliquat",
		"partProprietaire", "partApporteur", "partCpi", "representant", "archiveeLe")
		VALUES ('SAISIE', 0, 'CPI', $1::date, $2, '77 000 00 55', $3, 1, '1416', '', $4::bigint, $4, $5::bigint, $4 - $5,
		$4 / 2, $4 / 20, $4 - $4 / 2 - $4 / 20, 'Awa Ndiaye', CASE WHEN $6::boolean THEN now() END) RETURNING "id"`,
		date, client, site, prix, acompte, archivee).Scan(&id); err != nil {
		b.t.Fatal(err)
	}
	return id
}

// Deux ventes du site dans la période, une avant, une archivée, une sur un autre site.
func TestExportSommesDuesParSite(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	suffixe := strings.ToUpper(b.userID[:8])
	site, autre, client := "SITE DU "+suffixe, "AUTRE SITE "+suffixe, "CLIENT DU "+suffixe
	t.Cleanup(func() { b.exec(`DELETE FROM "ventes" WHERE "client" LIKE $1`, client+"%") })
	premiere := exportVente(b, site, client+" A", "2026-09-05", 1000000, 100000, false)
	b.exec(`INSERT INTO "ventes_versements" ("venteId", "rang", "date", "montant") VALUES ($1, 1, '2026-09-10', 200000)`, premiere)
	b.exec(`UPDATE "ventes" SET "reliquat" = 700000 WHERE "id" = $1`, premiere)
	exportVente(b, site, client+" B", "2026-09-20", 2000000, 0, false)
	exportVente(b, site, client+" AVANT", "2026-08-31", 1000000, 0, false)
	exportVente(b, site, client+" ARCHIVEE", "2026-09-06", 1000000, 0, true)
	exportVente(b, autre, client+" AUTRE", "2026-09-07", 1000000, 0, false)

	chemin := "/api/v1/export/ventes-sommes-dues.xlsx?du=2026-09-01&au=2026-09-30"
	statut, disposition, f := b.classeur(chemin + "&site=" + url.QueryEscape(strings.ToLower(site)))
	b.attend(statut, http.StatusOK, "sommes dues d'un site", nil)
	exportAttendFichier(t, disposition, "sommes-dues-cpi-2026-09-01-2026-09-30")
	lignes, err := f.GetRows("Sommes dues", excelize.Options{RawCellValue: true})
	if err != nil {
		t.Fatal(err)
	}
	attendues := [][]string{
		{site, "0", "46270", client + " A", "1", "1416", "1000000", "500000", "50000", "Awa Ndiaye", "450000", "300000", "700000"},
		{site, "0", "46285", client + " B", "1", "1416", "2000000", "1000000", "100000", "Awa Ndiaye", "900000", "0", "2000000"},
		{"Sous-total " + site, "", "", "", "", "", "3000000", "1500000", "150000", "", "1350000", "300000", "2700000"},
		{"Total", "", "", "", "", "", "3000000", "1500000", "150000", "", "1350000", "300000", "2700000"},
	}
	if len(lignes) != len(attendues)+1 || lignes[0][9] != "Représentant" {
		t.Fatalf("en-tête et quatre lignes attendus : %v", lignes)
	}
	for i, attendue := range attendues {
		if strings.Join(lignes[i+1], "|") != strings.Join(attendue, "|") {
			t.Fatalf("ligne %d : %v, attendu %v", i+2, lignes[i+1], attendue)
		}
	}

	statut, _, f = b.classeur(chemin)
	b.attend(statut, http.StatusOK, "sommes dues de tous les sites", nil)
	for _, sousTotal := range []string{"Sous-total " + site, "Sous-total " + autre} {
		exportChercherLigne(t, f, "Sommes dues", sousTotal)
	}
	statut, _, _ = b.classeur("/api/v1/export/ventes-sommes-dues.xlsx?du=2026-09-30&au=2026-09-01")
	b.attend(statut, http.StatusBadRequest, "période à l'envers", nil)
	superviseur := nouveauBanc(t, "SUPERVISEUR")
	connecte(superviseur)
	statut, _, _ = superviseur.classeur(chemin)
	superviseur.attend(statut, http.StatusForbidden, "sans ventes.lire", nil)
}
