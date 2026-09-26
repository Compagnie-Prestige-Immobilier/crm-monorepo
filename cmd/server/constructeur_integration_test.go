//go:build integration

package main

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
)

const (
	cheminCalculs      = "/api/v1/tableaux-de-bord/calculs"
	cheminPilotage     = "/api/v1/tableaux-de-bord/pilotage/disposition"
	sourceJoignabilite = "taux-de-joignabilite"
	refusConstructeur  = "Je ne sais pas encore calculer"
)

var catalogueEssai = []map[string]string{
	{"id": sourceJoignabilite, "libelle": "Taux de joignabilité des prospects", "description": "Prospects joints ÷ prospects appelés, sur le dernier appel de la période.", "forme": "scalaire", "groupe": "Appels aux prospects"},
	{"id": "methodes-d-adhesion", "libelle": "Méthodes d’adhésion", "description": "Prospects par méthode d’adhésion choisie.", "forme": "composition", "groupe": "Résultats"},
}

func construire(b *banc, demande string, proposition any) map[string]any {
	b.t.Helper()
	corps := map[string]any{"demande": demande, "catalogue": catalogueEssai}
	if proposition != nil {
		corps["proposition"] = proposition
	}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/tableaux-de-bord/pilotage/construire", corps, nil)
	b.attend(statut, http.StatusOK, "constructeur : "+demande, body)
	return body
}

func calculs(b *banc, corps map[string]any) []any {
	b.t.Helper()
	statut, body := appelJSON(b, http.MethodPost, cheminCalculs, corps, nil)
	b.attend(statut, http.StatusOK, "calculs", body)
	resultats, _ := body["resultats"].([]any)
	return resultats
}

func calculDe(proposition any) map[string]any {
	return objetDe(objetDe(proposition)["calcul"])
}

func exigerRefus(b *banc, body map[string]any, quoi string) {
	b.t.Helper()
	if body["proposition"] != nil || !strings.HasPrefix(texteDe(body["interpretation"]), refusConstructeur) {
		b.t.Fatalf("%s : refus attendu, reçu %v", quoi, body)
	}
}

// Un calcul enregistré se relit tel quel, deux calculs du même outil cohabitent,
// et sa marque suit la forme de ses données.
func TestTableauWidgetCalculEnregistreEtRelu(t *testing.T) {
	b := adminConnecte(t)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "dashboard_layouts" WHERE "userId" = $1`, b.userID) })
	encaisse := map[string]any{
		"source": "calcul", "titre": "Encaissé du mois", "marque": "camembert",
		"calcul": map[string]any{"outil": "ventes", "mesures": []string{"Encaissé"}, "periode": "ce-mois"},
	}
	parSite := map[string]any{"source": "calcul", "calcul": map[string]any{"outil": "ventes", "axe": "site", "periode": "ecran"}}

	statut, body := adminAppel(b, http.MethodPut, cheminPilotage, map[string]any{"widgets": []any{encaisse, encaisse}})
	b.attend(statut, http.StatusUnprocessableEntity, "calcul en double", body)
	statut, body = adminAppel(b, http.MethodPut, cheminPilotage, map[string]any{"widgets": []any{
		map[string]any{"source": "calcul", "calcul": map[string]any{"outil": "ventes", "axe": "banque", "periode": "ce-mois"}},
	}})
	b.attend(statut, http.StatusUnprocessableEntity, "axe inconnu de l'outil", body)

	statut, body = adminAppel(b, http.MethodPut, cheminPilotage, map[string]any{"widgets": []any{encaisse, parSite, map[string]any{"source": sourceJoignabilite}}})
	b.attend(statut, http.StatusOK, "enregistrement de deux calculs", body)
	statut, body = adminAppel(b, http.MethodGet, cheminPilotage, nil)
	b.attend(statut, http.StatusOK, "relecture", body)
	widgets, _ := body["widgets"].([]any)
	if body["source"] != "utilisateur" || len(widgets) != 3 {
		t.Fatalf("relecture : %v", body)
	}
	premier, second := objetDe(widgets[0]), objetDe(widgets[1])
	if premier["titre"] != "Encaissé du mois" || premier["marque"] != "tuile" || calculDe(premier)["periode"] != "ce-mois" {
		t.Fatalf("un total se montre en tuile, titre et période gardés : %v", premier)
	}
	if second["marque"] != "barres-horizontales" || calculDe(second)["axe"] != "site" {
		t.Fatalf("une répartition par site se montre en barres : %v", second)
	}
}

// Les données d'un calcul suivent la portée du rôle, la période se résout à
// Dakar et un outil hors du rôle n'empêche pas les autres calculs.
func TestTableauCalculsPorteeEtPeriode(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	role := "CALCULS_PORTEE_" + strings.ToUpper(uuid.NewString()[:8])
	b.exec(`INSERT INTO "roles" ("id","libelle","roleDeBase") VALUES ($1,$1,'COMMERCIAL')`, role)
	b.exec(`INSERT INTO "role_permissions" ("roleId","permission") VALUES ($1,'panneau.acceder'),($1,'assistant.utiliser'),($1,'analytics.superviser')`, role)
	b.exec(`UPDATE "users" SET "roleId" = $1 WHERE "id" = $2`, role, b.userID)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `UPDATE "users" SET "roleId" = 'COMMERCIAL' WHERE "id" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "roles" WHERE "id" = $1`, role)
	})
	voisin := autreCompte(b, "COMMERCIAL")
	direction := autreCompte(b, "DIRECTION")
	accueil := autreCompte(b, "ACCUEIL")
	nettoyerProspects(b, b.userID, voisin.userID)
	for _, appelant := range []string{b.userID, b.userID, voisin.userID} {
		prospect := uuid.NewString()
		b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","projet","clientCreatedAt","updatedAt")
		        VALUES ($1,'Calcul','Portée',$2,$3,'CHUES',now(),now())`, prospect, telephoneAssistant(), appelant)
		b.exec(`INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		        VALUES ($1,$2,$3,(SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'),now())`, uuid.NewString(), prospect, appelant)
	}
	connecte(b)
	j := aujourdhuiDakar(t)
	corps := map[string]any{"du": "2026-01-05", "au": "2026-01-11", "calculs": []any{
		map[string]any{"outil": "appels", "periode": "aujourdhui"},
		map[string]any{"outil": "appels", "axe": "jour", "periode": "7-derniers-jours"},
		map[string]any{"outil": "ventes", "periode": "ce-mois"},
		map[string]any{"outil": "appels", "periode": "ecran"},
	}}
	statut, body := appelJSON(accueil, http.MethodPost, cheminCalculs, corps, nil)
	accueil.attend(statut, http.StatusForbidden, "calculs sans l'assistant", body)

	resultats := calculs(b, corps)
	jour := j.Format("2006-01-02")
	exigerChampsJSON(b, objetDe(resultats[0]), map[string]string{"forme": "scalaire", "du": jour, "au": jour}, "appels du jour")
	exigerChampsJSON(b, objetDe(objetDe(resultats[0])["donnee"]), map[string]string{"valeur": "2"}, "seuls ses deux appels comptent")
	exigerChampsJSON(b, objetDe(resultats[1]), map[string]string{"forme": "serie-temporelle", "du": j.AddDate(0, 0, -6).Format("2006-01-02"), "au": jour}, "sept derniers jours")
	exigerChampsJSON(b, objetDe(resultats[2]), map[string]string{"erreur": "Votre rôle ne donne pas accès à ces chiffres.", "donnee": "<nil>"}, "ventes hors du rôle")
	exigerChampsJSON(b, objetDe(resultats[3]), map[string]string{"du": "2026-01-05", "au": "2026-01-11"}, "période de l'écran")

	tous := objetDe(calculs(direction, corps)[0])
	if v, _ := objetDe(tous["donnee"])["valeur"].(float64); v < 3 {
		t.Fatalf("la direction compte tous les appels : %v", tous)
	}
	trop := make([]any, 21)
	for i := range trop {
		trop[i] = map[string]any{"outil": "appels", "periode": "aujourdhui"}
	}
	statut, body = appelJSON(b, http.MethodPost, cheminCalculs, map[string]any{"calculs": trop}, nil)
	b.attend(statut, http.StatusUnprocessableEntity, "plus de vingt calculs", body)
}

// Le modèle choisit ; le serveur ne garde que ce qui existe dans le catalogue
// transmis ou dans les outils du rôle, et ne lui envoie aucune donnée.
func TestConstructeurAvecFournisseur(t *testing.T) {
	reponse := `{"source":"taux-de-joignabilite","titre":"Joignabilité"}`
	faux := demarrerFauxFournisseur(t, func(map[string]any) string { return reponse })
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)

	body := construire(b, "le taux de joignabilité", nil)
	exigerChampsJSON(b, objetDe(body["proposition"]), map[string]string{"source": sourceJoignabilite, "forme": "scalaire"}, "source du catalogue")
	exigerChampsJSON(b, body, map[string]string{"parIA": "true", "interpretation": "Je comprends : « Taux de joignabilité des prospects » (Prospects joints ÷ prospects appelés, sur le dernier appel de la période). C'est bien ça ?"}, "interprétation")
	var entree map[string]any
	if err := json.Unmarshal([]byte(faux.messages()[0]), &entree); err != nil {
		t.Fatal(err)
	}
	cles := make([]string, 0, len(entree))
	for cle := range entree {
		cles = append(cles, cle)
	}
	slices.Sort(cles)
	if !slices.Equal(cles, []string{"catalogue", "demande", "outils", "periodes"}) || strings.Contains(faux.messages()[0], "groupe") {
		t.Fatalf("seuls la demande, le catalogue et les outils partent : %v", cles)
	}

	reponse = `{"source":"","calcul":{"outil":"ventes","axe":"site","mesures":["Encaissé"],"periode":"ce-mois"},"titre":"Encaissé par site"}`
	body = construire(b, "les encaissements par site", nil)
	exigerChampsJSON(b, calculDe(body["proposition"]), map[string]string{"outil": "ventes", "axe": "site"}, "calcul des ventes par site")
	exigerChampsJSON(b, objetDe(body["proposition"]), map[string]string{"forme": "classement"}, "forme d'une répartition")

	reponse = `{"source":"","calcul":{"outil":"ventes","axe":"site","mesures":["Encaissé"],"periode":"mois-dernier"},"titre":"Encaissé par site"}`
	body = construire(b, "le mois dernier", body["proposition"])
	exigerChampsJSON(b, calculDe(body["proposition"]), map[string]string{"periode": "mois-dernier"}, "ajustement de la période")
	if !strings.Contains(faux.messages()[2], `"proposition"`) {
		t.Fatalf("l'ajustement part avec la proposition courante : %s", faux.messages()[2])
	}

	reponse = `{"source":"chiffre-invente","titre":"Inventé"}`
	exigerRefus(b, construire(b, "le chiffre inventé", nil), "source hors catalogue")

	superviseur := nouveauBanc(t, "SUPERVISEUR")
	connecte(superviseur)
	reponse = `{"source":"","calcul":{"outil":"ventes","periode":"ce-mois"},"titre":"Ventes"}`
	exigerRefus(superviseur, construire(superviseur, "les ventes du mois", nil), "outil hors du rôle")
}

// Sans fournisseur, la recherche par mots répond : catalogue d'abord, calculs
// pour qui a l'assistant, ajustement des paramètres, refus sinon.
func TestConstructeurSansFournisseur(t *testing.T) {
	b := bancAssistant(t, "ADMIN")

	body := construire(b, "Taux de joignabilité", nil)
	exigerChampsJSON(b, objetDe(body["proposition"]), map[string]string{"source": sourceJoignabilite}, "source du catalogue")
	exigerChampsJSON(b, body, map[string]string{"parIA": "false"}, "repli sans modèle")
	body = construire(b, "Les encaissements des ventes du mois", nil)
	exigerChampsJSON(b, calculDe(body["proposition"]), map[string]string{"outil": "ventes", "mesures": "[Encaissé]", "periode": "ce-mois"}, "encaissé des ventes du mois")
	body = construire(b, "par site le mois dernier", body["proposition"])
	exigerChampsJSON(b, calculDe(body["proposition"]), map[string]string{"axe": "site", "mesures": "[Encaissé]", "periode": "mois-dernier"}, "ajustement sans modèle")
	exigerRefus(b, construire(b, "la météo de demain", nil), "demande hors sujet")
	exigerRefus(b, construire(bancAssistant(t, "ACCUEIL"), "Les ventes du mois", nil), "calcul sans l'assistant")
}

// Le pilotage s'ouvre sur l'argent et les objectifs, sans représentants ni
// détail d'appels ; chaque calcul d'usine se calcule, et un rôle sans l'outil ne le voit pas.
func TestPilotageDispositionUsine(t *testing.T) {
	b := adminConnecte(t)
	statut, body := adminAppel(b, http.MethodGet, cheminPilotage, nil)
	b.attend(statut, http.StatusOK, "pilotage de l'administrateur", body)
	exigerChampsJSON(b, body, map[string]string{"source": "usine"}, "disposition d'usine du pilotage")
	widgets, _ := body["widgets"].([]any)
	demandes, lus := resumeWidgets(widgets)
	if !strings.HasPrefix(lus, "calcul:ventes") || strings.Contains(lus, "representants") || strings.Contains(lus, "par-teleconseiller") || !strings.Contains(lus, "calcul:risques") || !strings.Contains(lus, "calcul:objectifs") {
		t.Fatalf("les ventes en tête, objectifs et risques, ni représentants ni détail par téléconseiller : %s", lus)
	}
	for _, r := range calculs(b, map[string]any{"calculs": demandes}) {
		if objetDe(r)["erreur"] != nil || objetDe(r)["forme"] == nil {
			t.Fatalf("un calcul d'usine ne se calcule pas : %v", r)
		}
	}

	_, email := adminCompte(b, "SUPERVISEUR")
	superviseur := adminSession(b, email)
	statut, body = adminAppel(superviseur, http.MethodGet, cheminPilotage, nil)
	superviseur.attend(statut, http.StatusOK, "pilotage de la supervision", body)
	widgets, _ = body["widgets"].([]any)
	if _, lus = resumeWidgets(widgets); strings.Contains(lus, "calcul:ventes") || strings.Contains(lus, "calcul:risques") {
		t.Fatalf("la supervision ne voit pas un calcul hors de son rôle : %s", lus)
	}
}

// Les calculs d'une disposition, et chaque widget lu « source:outil ».
func resumeWidgets(widgets []any) (demandes []any, lus string) {
	vus := make([]string, 0, len(widgets))
	for _, w := range widgets {
		vus = append(vus, texteDe(objetDe(w)["source"])+":"+texteDe(calculDe(w)["outil"]))
		if c := calculDe(w); c != nil {
			demandes = append(demandes, c)
		}
	}
	return demandes, strings.Join(vus, " ")
}
