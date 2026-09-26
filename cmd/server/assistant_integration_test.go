//go:build integration

package main

import (
	"bytes"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func bancAssistant(t *testing.T, role string) *banc {
	t.Helper()
	// Un seul fournisseur déclaré, sans clé : aucun appel réseau ne part d'un
	// test, même quand l'environnement du poste en porte une.
	t.Setenv("ASSISTANT_AI_PROVIDERS", "groq")
	t.Setenv("GROQ_API_KEY", "")
	b := nouveauBanc(t, role)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "assistant_questions" WHERE "userId" = $1`, b.userID)
	})
	return b
}

// Un fournisseur au format Groq qui répond par `repondre` et garde chaque
// message reçu : ce qui part chez le fournisseur se lit après coup.
type fauxFournisseur struct {
	mu       sync.Mutex
	recus    []string
	repondre func(entree map[string]any) string
}

func demarrerFauxFournisseur(t *testing.T, repondre func(entree map[string]any) string) *fauxFournisseur {
	t.Helper()
	f := &fauxFournisseur{repondre: repondre}
	serveur := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var requete struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&requete); err != nil {
			t.Error(err)
			return
		}
		var brut string
		for _, m := range requete.Messages {
			if m.Role == "user" {
				brut = m.Content
			}
		}
		entree := map[string]any{}
		_ = json.Unmarshal([]byte(brut), &entree)
		f.mu.Lock()
		f.recus = append(f.recus, brut)
		repondre := f.repondre
		f.mu.Unlock()
		corps, err := json.Marshal(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": repondre(entree)}}},
		})
		if err != nil {
			t.Error(err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(corps)
	}))
	t.Cleanup(serveur.Close)
	t.Setenv("ASSISTANT_AI_PROVIDERS", "groq")
	t.Setenv("GROQ_API_KEY", "jeton-essai")
	t.Setenv("GROQ_URL", serveur.URL)
	t.Setenv("GROQ_MODELS", "faux-modele")
	return f
}

func (f *fauxFournisseur) messages() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return slices.Clone(f.recus)
}

func (f *fauxFournisseur) changer(repondre func(entree map[string]any) string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.repondre = repondre
}

func enJSON(t *testing.T, v any) string {
	t.Helper()
	brut, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(brut)
}

func poserQuestion(b *banc, question string, precedent any) (statut int, reponse map[string]any) {
	b.t.Helper()
	corps := map[string]any{"question": question}
	if precedent != nil {
		corps["precedent"] = precedent
	}
	return appelJSON(b, http.MethodPost, "/api/v1/assistant/questions", corps, nil)
}

func (b *banc) questionsEnregistrees() []map[string]any {
	b.t.Helper()
	req, err := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+"/api/v1/assistant/questions-enregistrees", http.NoBody)
	if err != nil {
		b.t.Fatal(err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	b.attend(resp.StatusCode, http.StatusOK, "liste des questions", nil)
	var liste []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&liste); err != nil {
		b.t.Fatal(err)
	}
	return liste
}

func (b *banc) enregistrerQuestion(libelle, question string, partagee bool) int {
	b.t.Helper()
	corps, err := json.Marshal(map[string]any{"libelle": libelle, "question": question, "partagee": partagee})
	if err != nil {
		b.t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+"/api/v1/assistant/questions-enregistrees", bytes.NewReader(corps))
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode
}

func (b *banc) idQuestion(libelle string) string {
	b.t.Helper()
	for _, q := range b.questionsEnregistrees() {
		if q["libelle"] == libelle {
			return texteDe(q["id"])
		}
	}
	b.t.Fatalf("question %q introuvable", libelle)
	return ""
}

// Le téléconseiller n'a pas la permission : la garde refuse avant tout appel au modèle.
func TestAssistantRefuseSansPermission(t *testing.T) {
	b := bancAssistant(t, "COMMERCIAL")
	statut, body := b.appel(http.MethodPost, "/api/v1/assistant/questions", map[string]string{"question": "combien d'appels hier ?"}, true)
	b.attend(statut, http.StatusForbidden, "question sans permission", body)
}

// Sans clé Groq ni Gemini, l'écran doit dire quoi faire, pas planter.
func TestAssistantSansFournisseur(t *testing.T) {
	b := bancAssistant(t, "ADMIN")
	statut, body := b.appel(http.MethodPost, "/api/v1/assistant/questions", map[string]string{"question": "combien d'appels hier ?"}, true)
	b.attend(statut, http.StatusServiceUnavailable, "question sans fournisseur", body)
	if code, _ := body["code"].(string); code != "ASSISTANT_NON_CONFIGURE" {
		t.Fatalf("code attendu ASSISTANT_NON_CONFIGURE, reçu %v", body)
	}
}

// La direction et la supervision interrogent l'assistant ; la requête libre reste à l'ADMIN.
func TestAssistantOuvertALEncadrement(t *testing.T) {
	for _, role := range []string{"DIRECTION", "SUPERVISEUR"} {
		b := bancAssistant(t, role)
		statut, body := b.appel(http.MethodPost, "/api/v1/assistant/questions", map[string]string{"question": "combien d'appels hier ?"}, true)
		b.attend(statut, http.StatusServiceUnavailable, role+" sans fournisseur", body)
		if code, _ := body["code"].(string); code != "ASSISTANT_NON_CONFIGURE" {
			t.Fatalf("%s : ASSISTANT_NON_CONFIGURE attendu, reçu %v", role, body)
		}
	}

	faux := demarrerFauxFournisseur(t, func(entree map[string]any) string {
		if _, surSchema := entree["schema"]; surSchema {
			return `{"sql":"select 1"}`
		}
		return `{"outil":"","reponse":"Je ne sais pas."}`
	})
	superviseur := nouveauBanc(t, "SUPERVISEUR")
	connecte(superviseur)
	statut, body := poserQuestion(superviseur, "liste les comptes et leurs rôles", nil)
	superviseur.attend(statut, http.StatusOK, "question hors outils par la supervision", body)
	if body["requete"] != nil || body["resultat"] != nil {
		t.Fatalf("la supervision ne doit jamais recevoir de requête libre : %v", body)
	}
	for _, message := range faux.messages() {
		if strings.Contains(message, `"schema"`) {
			t.Fatal("le schéma de la base est parti chez le fournisseur pour la supervision")
		}
	}
}

type entreeEvaluation struct {
	Question string            `json:"question"`
	Choix    map[string]string `json:"choix"`
	Attendu  map[string]string `json:"attendu"`
}

func lireJeuEvaluation(t *testing.T) []entreeEvaluation {
	t.Helper()
	contenu, err := os.ReadFile("testdata/assistant-evaluation.json")
	if err != nil {
		t.Fatal(err)
	}
	var jeu []entreeEvaluation
	if err := json.Unmarshal(contenu, &jeu); err != nil {
		t.Fatal(err)
	}
	return jeu
}

func aujourdhuiDakar(t *testing.T) time.Time {
	t.Helper()
	dakar, err := time.LoadLocation("Africa/Dakar")
	if err != nil {
		t.Fatal(err)
	}
	maintenant := time.Now().In(dakar)
	return time.Date(maintenant.Year(), maintenant.Month(), maintenant.Day(), 0, 0, 0, 0, time.UTC)
}

// J, L (lundi), M (1er du mois), FM (fin du mois), A (1er janvier), FA (31 décembre),
// suivis d'un décalage en jours, mois ou années ; JUIN et FJUIN : le dernier juin passé.
func jourAttendu(jeton string, j time.Time) string {
	if _, err := time.Parse("2006-01-02", jeton); err == nil {
		return jeton
	}
	base, decalage := jeton, 0
	if i := strings.IndexAny(jeton, "+-"); i > 0 {
		base = jeton[:i]
		decalage, _ = strconv.Atoi(jeton[i:])
	}
	lundi := j.AddDate(0, 0, -((int(j.Weekday()) + 6) % 7))
	mois := time.Date(j.Year(), j.Month(), 1, 0, 0, 0, 0, time.UTC)
	annee := time.Date(j.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	juin := time.Date(j.Year(), 6, 1, 0, 0, 0, 0, time.UTC)
	if j.Month() < 6 {
		juin = juin.AddDate(-1, 0, 0)
	}
	jours := map[string]time.Time{
		"J": j.AddDate(0, 0, decalage), "L": lundi.AddDate(0, 0, decalage),
		"M": mois.AddDate(0, decalage, 0), "FM": mois.AddDate(0, decalage+1, -1),
		"A": annee.AddDate(decalage, 0, 0), "FA": annee.AddDate(decalage+1, 0, -1),
		"JUIN": juin, "FJUIN": juin.AddDate(0, 1, -1),
	}
	return jours[base].Format("2006-01-02")
}

func objetDe(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

// Les écarts entre une réponse et l'attendu du jeu ; vide quand tout concorde.
func ecartsEvaluation(e *entreeEvaluation, statut int, body map[string]any, j time.Time) []string {
	if statut != http.StatusOK {
		return []string{fmt.Sprintf("statut %d : %v", statut, body)}
	}
	attendu := e.Attendu
	var ecarts []string
	if texteDe(body["outil"]) != attendu["outil"] {
		ecarts = append(ecarts, fmt.Sprintf("outil %q au lieu de %q", body["outil"], attendu["outil"]))
	}
	if attendu["outil"] == "" {
		if body["resultat"] != nil || texteDe(body["texte"]) == "" {
			ecarts = append(ecarts, "hors périmètre : aucun chiffre et une phrase attendus")
		}
		return ecarts
	}
	parametres := objetDe(body["parametres"])
	comparaisons := [][3]string{
		{"du", texteDe(body["du"]), jourAttendu(attendu["du"], j)},
		{"au", texteDe(body["au"]), jourAttendu(attendu["au"], j)},
		{"projet", texteDe(parametres["projet"]), attendu["projet"]},
		{"axe", texteDe(parametres["axe"]), attendu["axe"]},
	}
	for _, c := range comparaisons {
		if c[1] != c[2] {
			ecarts = append(ecarts, fmt.Sprintf("%s %q au lieu de %q", c[0], c[1], c[2]))
		}
	}
	if body["resultat"] == nil || body["graphique"] == nil || !strings.HasPrefix(texteDe(objetDe(body["ecran"])["lien"]), "/") {
		ecarts = append(ecarts, "résultat, graphique et écran attendus")
	}
	du, _ := time.Parse("2006-01-02", texteDe(body["du"]))
	if !strings.Contains(texteDe(body["explication"]), du.Format("02/01/2006")) {
		ecarts = append(ecarts, "l'explication doit citer la période : "+texteDe(body["explication"]))
	}
	return ecarts
}

// Le faux fournisseur rend le choix écrit dans le jeu : le test prouve la
// résolution des périodes, les paramètres retenus et le refus hors périmètre.
func TestAssistantJeuEvaluation(t *testing.T) {
	jeu := lireJeuEvaluation(t)
	faux := demarrerFauxFournisseur(t, func(entree map[string]any) string {
		for _, e := range jeu {
			if e.Question == entree["question"] {
				brut, _ := json.Marshal(e.Choix)
				return string(brut)
			}
		}
		return `{"outil":""}`
	})
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	j := aujourdhuiDakar(t)
	for i := range jeu {
		statut, body := poserQuestion(b, jeu[i].Question, nil)
		for _, ecart := range ecartsEvaluation(&jeu[i], statut, body, j) {
			t.Errorf("%s : %s", jeu[i].Question, ecart)
		}
	}
	messages := faux.messages()
	if len(messages) != len(jeu) {
		t.Fatalf("%d questions posées, %d reçues par le fournisseur", len(jeu), len(messages))
	}
	var entree struct {
		Outils map[string]any `json:"outils"`
	}
	if err := json.Unmarshal([]byte(messages[0]), &entree); err != nil {
		t.Fatal(err)
	}
	if len(entree.Outils) != 12 {
		t.Fatalf("la direction doit disposer des douze outils, reçus %v", entree.Outils)
	}
}

// Le même jeu contre le vrai fournisseur, seulement sur demande et avec une clé.
func TestAssistantJeuEvaluationFournisseurReel(t *testing.T) {
	if os.Getenv("ASSISTANT_EVAL_REEL") != "1" {
		t.Skip("ASSISTANT_EVAL_REEL=1 rejoue le jeu contre le fournisseur réel")
	}
	if os.Getenv("GEMINI_API_KEY") == "" && os.Getenv("GROQ_API_KEY") == "" {
		t.Skip("aucune clé GEMINI_API_KEY ni GROQ_API_KEY")
	}
	jeu := lireJeuEvaluation(t)
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	j := aujourdhuiDakar(t)
	justes := 0
	for i := range jeu {
		statut, body := poserQuestion(b, jeu[i].Question, nil)
		ecarts := ecartsEvaluation(&jeu[i], statut, body, j)
		if len(ecarts) == 0 {
			justes++
			continue
		}
		t.Logf("%s (%s) : %s", jeu[i].Question, texteDe(body["reponduPar"]), strings.Join(ecarts, " ; "))
	}
	t.Logf("%d réponses justes sur %d", justes, len(jeu))
	if justes*5 < len(jeu)*4 {
		t.Errorf("moins de 80 %% de réponses justes : %d sur %d", justes, len(jeu))
	}
}

// Un modèle qui choisit un outil hors du rôle n'obtient rien : l'outil n'est
// ni proposé ni exécuté.
func TestAssistantOutilHorsDuRole(t *testing.T) {
	faux := demarrerFauxFournisseur(t, func(map[string]any) string {
		return `{"outil":"ventes","periode":"ce_mois"}`
	})
	b := nouveauBanc(t, "SUPERVISEUR")
	connecte(b)
	statut, body := poserQuestion(b, "Montant des ventes du mois", nil)
	b.attend(statut, http.StatusOK, "question sur les ventes par la supervision", body)
	if body["resultat"] != nil || texteDe(body["outil"]) != "" {
		t.Fatalf("un outil hors du rôle ne doit pas s'exécuter : %v", body)
	}
	var entree struct {
		Outils map[string]any `json:"outils"`
	}
	if err := json.Unmarshal([]byte(faux.messages()[0]), &entree); err != nil {
		t.Fatal(err)
	}
	proposes := make([]string, 0, len(entree.Outils))
	for nom := range entree.Outils {
		proposes = append(proposes, nom)
	}
	slices.Sort(proposes)
	attendus := []string{"appels", "appels_representants", "campagnes", "conversions_par_canal", "dossiers_bancaires", "objectifs", "prevision_conversions", "rappels"}
	if !slices.Equal(proposes, attendus) {
		t.Fatalf("outils proposés à la supervision : %v, attendus %v", proposes, attendus)
	}
}

// Un rôle sans « voir tous les portefeuilles » ne compte que ses appels, et l'explication le dit.
func TestAssistantPorteeDuRole(t *testing.T) {
	demarrerFauxFournisseur(t, func(map[string]any) string { return `{"outil":"appels","periode":"aujourdhui"}` })
	b := nouveauBanc(t, "COMMERCIAL")
	role := "ASSISTANT_PORTEE_" + strings.ToUpper(uuid.NewString()[:8])
	b.exec(`INSERT INTO "roles" ("id","libelle","roleDeBase") VALUES ($1,$1,'COMMERCIAL')`, role)
	b.exec(`INSERT INTO "role_permissions" ("roleId","permission") VALUES ($1,'panneau.acceder'),($1,'assistant.utiliser'),($1,'analytics.superviser')`, role)
	b.exec(`UPDATE "users" SET "roleId" = $1 WHERE "id" = $2`, role, b.userID)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `UPDATE "users" SET "roleId" = 'COMMERCIAL' WHERE "id" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "roles" WHERE "id" = $1`, role)
	})
	voisin := autreCompte(b, "COMMERCIAL")
	direction := autreCompte(b, "DIRECTION")
	nettoyerProspects(b, b.userID, voisin.userID)
	var motif string
	if err := b.pool.QueryRow(b.ctx, `SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'`).Scan(&motif); err != nil {
		t.Fatal(err)
	}
	for _, appelant := range []string{b.userID, b.userID, voisin.userID} {
		prospect := uuid.NewString()
		b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","projet","clientCreatedAt","updatedAt")
		        VALUES ($1,'Portée','Assistant',$2,$3,'CHUES',now(),now())`, prospect, telephoneAssistant(), appelant)
		b.exec(`INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		        VALUES ($1,$2,$3,$4,now())`, uuid.NewString(), prospect, appelant, motif)
	}
	connecte(b)

	statut, body := poserQuestion(b, "Combien d'appels aujourd'hui ?", nil)
	b.attend(statut, http.StatusOK, "appels d'un rôle limité à son portefeuille", body)
	lignes, _ := objetDe(objetDe(body["resultat"])["tableau"])["lignes"].([]any)
	total, _ := lignes[len(lignes)-1].([]any)
	if texteDe(total[1]) != "2" || !strings.Contains(texteDe(body["explication"]), "votre portefeuille") {
		t.Fatalf("seuls ses deux appels comptent : %v, %v", total, body["explication"])
	}

	statut, body = poserQuestion(direction, "Combien d'appels aujourd'hui ?", nil)
	direction.attend(statut, http.StatusOK, "appels vus par la direction", body)
	lignes, _ = objetDe(objetDe(body["resultat"])["tableau"])["lignes"].([]any)
	total, _ = lignes[len(lignes)-1].([]any)
	if n, _ := strconv.Atoi(texteDe(total[1])); n < 3 || !strings.Contains(texteDe(body["explication"]), "tous les téléconseillers") {
		t.Fatalf("la direction compte tous les appels : %v, %v", total, body["explication"])
	}
}

// Une question de suivi ne change qu'un paramètre ; une question reposée le
// même jour ne retourne pas chez le fournisseur.
func TestAssistantSuiviEtMemoire(t *testing.T) {
	faux := demarrerFauxFournisseur(t, func(entree map[string]any) string {
		if entree["precedent"] != nil {
			return `{"outil":"appels","periode":"hier","projet":"GRAND_PUBLIC"}`
		}
		return `{"outil":"appels","periode":"hier"}`
	})
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	statut, premiere := poserQuestion(b, "Combien d'appels hier ?", nil)
	b.attend(statut, http.StatusOK, "première question", premiere)
	statut, body := poserQuestion(b, "  COMBIEN d'appels HIER ", nil)
	b.attend(statut, http.StatusOK, "même question reposée", body)
	if n := len(faux.messages()); n != 1 {
		t.Fatalf("la même question le même jour ne repart pas chez le fournisseur : %d appels", n)
	}

	statut, suite := poserQuestion(b, "et pour le Grand Public ?", premiere["parametres"])
	b.attend(statut, http.StatusOK, "question de suivi", suite)
	messages := faux.messages()
	var entree struct {
		Precedent map[string]any `json:"precedent"`
	}
	if err := json.Unmarshal([]byte(messages[len(messages)-1]), &entree); err != nil {
		t.Fatal(err)
	}
	if entree.Precedent["outil"] != "appels" || entree.Precedent["periode"] != "hier" {
		t.Fatalf("le précédent doit partir avec la question de suivi : %v", entree.Precedent)
	}
	if objetDe(suite["parametres"])["projet"] != "GRAND_PUBLIC" || suite["du"] != premiere["du"] {
		t.Fatalf("seul le projet change : %v puis %v", premiere["parametres"], suite["parametres"])
	}
}

// Le classeur rejoue les paramètres d'une réponse, ou repose une question enregistrée.
func TestAssistantExportClasseur(t *testing.T) {
	demarrerFauxFournisseur(t, func(map[string]any) string {
		return `{"outil":"ventes","periode":"aujourdhui","axe":"site"}`
	})
	b := nouveauBanc(t, "DIRECTION")
	connecte(b)
	superviseur := autreCompte(b, "SUPERVISEUR")
	site := "SITE ASSISTANT " + strings.ToUpper(uuid.NewString()[:6])
	b.exec(`INSERT INTO "ventes" ("origine","numero","canal","client","telephone","site","nombreLots","numerosLots","superficie",
		"prixUnitaire","prixTotal","acompte","reliquat","partProprietaire","partApporteur","partCpi","dateSouscription")
		VALUES ('SAISIE',0,'CPI','CLIENT ASSISTANT','770000000',$1,2,'','',2500000,5000000,1000000,4000000,0,0,5000000,$2::date)`,
		site, jourAttendu("J", aujourdhuiDakar(t)))
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "ventes" WHERE "site" = $1`, site)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "assistant_questions" WHERE "userId" = $1`, b.userID)
	})
	jour := jourAttendu("J", aujourdhuiDakar(t))
	chemin := "/api/v1/assistant/export?outil=ventes&axe=site&du=" + jour + "&au=" + jour
	statut, _, classeur := b.classeur(chemin)
	b.attend(statut, http.StatusOK, "export des ventes par site", nil)
	lignes, err := classeur.GetRows(classeur.GetSheetName(0))
	if err != nil {
		t.Fatal(err)
	}
	trouve := false
	for _, ligne := range lignes {
		trouve = trouve || (len(ligne) > 3 && ligne[0] == site && ligne[3] == "5 000 000 FCFA")
	}
	if !trouve || lignes[0][0] != "Site" {
		t.Fatalf("la vente du jour doit sortir dans le classeur : %v", lignes)
	}
	if statut, _, _ := superviseur.classeur(chemin); statut != http.StatusForbidden {
		t.Fatalf("la supervision n'exporte pas les ventes : %d", statut)
	}

	if statut := b.enregistrerQuestion("Ventes du jour", "Ventes du jour par site", false); statut != http.StatusCreated {
		t.Fatalf("enregistrement : %d", statut)
	}
	statut, _, classeur = b.classeur("/api/v1/assistant/questions-enregistrees/" + b.idQuestion("Ventes du jour") + "/export")
	b.attend(statut, http.StatusOK, "export d'une question enregistrée", nil)
	if lignes, _ := classeur.GetRows(classeur.GetSheetName(0)); len(lignes) < 2 {
		t.Fatalf("la question enregistrée doit rendre son tableau : %v", lignes)
	}
	if statut, _, _ := superviseur.classeur("/api/v1/assistant/questions-enregistrees/" + b.idQuestion("Ventes du jour") + "/export"); statut != http.StatusNotFound {
		t.Fatalf("une question non partagée ne s'exporte pas par un autre compte : %d", statut)
	}
}

// Les questions types suivent les outils du rôle ; huit questions épinglées au plus.
func TestAssistantSuggestionsEtEpingles(t *testing.T) {
	direction := bancAssistant(t, "DIRECTION")
	superviseur := bancAssistant(t, "SUPERVISEUR")
	lireSuggestions := func(b *banc) []any {
		statut, body := appelJSON(b, http.MethodGet, "/api/v1/assistant/suggestions", nil, nil)
		b.attend(statut, http.StatusOK, "questions types", body)
		liste, _ := body["suggestions"].([]any)
		return liste
	}
	if n := len(lireSuggestions(direction)); n != 8 {
		t.Fatalf("huit questions types pour la direction, %d reçues", n)
	}
	for _, s := range lireSuggestions(superviseur) {
		if outil := texteDe(objetDe(s)["outil"]); outil == "ventes" || outil == "visites" || outil == "rendez_vous" {
			t.Fatalf("question type hors du rôle de la supervision : %v", s)
		}
	}

	for i := range 9 {
		if statut := direction.enregistrerQuestion(fmt.Sprintf("Épingle %d", i), "combien d'appels hier ?", false); statut != http.StatusCreated {
			t.Fatalf("enregistrement %d : %d", i, statut)
		}
	}
	epingler := func(b *banc, id string, valeur bool) (int, map[string]any) {
		return appelJSON(b, http.MethodPatch, "/api/v1/assistant/questions-enregistrees/"+id, map[string]any{"epinglee": valeur}, nil)
	}
	for i := range 8 {
		statut, body := epingler(direction, direction.idQuestion(fmt.Sprintf("Épingle %d", i)), true)
		direction.attend(statut, http.StatusOK, "épingler", body)
	}
	statut, body := epingler(direction, direction.idQuestion("Épingle 8"), true)
	direction.attend(statut, http.StatusUnprocessableEntity, "neuvième épingle", body)
	statut, body = epingler(superviseur, direction.idQuestion("Épingle 0"), false)
	superviseur.attend(statut, http.StatusNotFound, "épingle d'un autre compte", body)
	epinglees := 0
	for _, q := range direction.questionsEnregistrees() {
		if vraiDe(q["epinglee"]) {
			epinglees++
		}
	}
	if epinglees != 8 {
		t.Fatalf("huit questions épinglées attendues, %d lues", epinglees)
	}
}

type ficheResumee struct {
	id, nom, prenom, telephone, parrain, commentaire string
}

func semerFicheResumee(b *banc) ficheResumee {
	b.t.Helper()
	marque := strings.ToUpper(uuid.NewString()[:6])
	f := ficheResumee{
		id: uuid.NewString(), nom: "Diopresume" + marque, prenom: "Aminata" + marque, telephone: telephoneAssistant(),
		parrain: "Moussa Parrainresume" + marque, commentaire: "Confidentiel" + marque,
	}
	var nonJoint, joint string
	if err := b.pool.QueryRow(b.ctx, `SELECT (SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'),
		(SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'INTERESSE')`).Scan(&nonJoint, &joint); err != nil {
		b.t.Fatal(err)
	}
	parrain, appelParrain := uuid.NewString(), uuid.NewString()
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","email","createdById","projet","clientCreatedAt","updatedAt")
	        VALUES ($1,$2,$3,$4,'aminata@example.sn',$5,'CHUES',now(),now())`, f.id, f.nom, f.prenom, f.telephone, b.userID)
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","projet","clientCreatedAt","updatedAt")
	        VALUES ($1,$2,'Moussa',$3,$4,'CHUES',now(),now())`, parrain, "Parrainresume"+marque, telephoneAssistant(), b.userID)
	b.exec(`INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","comment","clientCreatedAt")
	        VALUES ($1,$2,$3,$4,$5,now() - interval '2 hours'), ($6,$2,$3,$7,$5,now() - interval '1 hour'),
	               ($8,$9,$3,$7,NULL,now())`,
		uuid.NewString(), f.id, b.userID, nonJoint, f.commentaire, uuid.NewString(), joint, appelParrain, parrain)
	b.exec(`INSERT INTO "prospect_suggestions" ("id","sourceProspectId","suggestedPhoneE164","suggestedById","resolvedProspectId","sourceAttemptId","clientCreatedAt")
	        VALUES ($1,$2,$3,$4,$5,$6,now())`, uuid.NewString(), parrain, f.telephone, b.userID, f.id, appelParrain)
	b.exec(`INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","sourceAttemptId","status","updatedAt")
	        SELECT $1,$2,$3,now() + interval '1 day',"id",'PENDING',now() FROM "call_attempts" WHERE "prospectId" = $2 LIMIT 1`,
		uuid.NewString(), f.id, b.userID)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, f.id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospect_suggestions" WHERE "resolvedProspectId" = $1`, f.id)
	})
	return f
}

func demanderResume(b *banc, id string) (statut int, reponse map[string]any) {
	b.t.Helper()
	return appelJSON(b, http.MethodPost, "/api/v1/prospects/"+id+"/resume", nil, nil)
}

func lignesDuResume(body map[string]any) []string {
	brutes, _ := body["lignes"].([]any)
	lignes := make([]string, 0, len(brutes))
	for _, l := range brutes {
		lignes = append(lignes, texteDe(l))
	}
	return lignes
}

// Sans fournisseur, le résumé se calcule ; la portée de la fiche s'applique ; chaque lecture se journalise.
func TestAssistantResumeFicheSansModele(t *testing.T) {
	b := bancAssistant(t, "COMMERCIAL")
	voisin := autreCompte(b, "COMMERCIAL")
	nettoyerProspects(b, b.userID)
	f := semerFicheResumee(b)

	statut, body := demanderResume(b, f.id)
	b.attend(statut, http.StatusOK, "résumé calculé", body)
	lignes := lignesDuResume(body)
	if len(lignes) != 3 || body["reponduPar"] != "calcul" ||
		!strings.HasPrefix(lignes[0], "2 appel(s), dont 1 joint(s)") ||
		!strings.Contains(lignes[1], "ecommandé par "+f.parrain) ||
		!strings.HasPrefix(lignes[2], "Prochaine étape : rappel prévu le") {
		t.Fatalf("résumé calculé inattendu : %v", body)
	}
	statut, body = demanderResume(voisin, f.id)
	voisin.attend(statut, http.StatusForbidden, "résumé de la fiche d'un autre", body)
	statut, body = demanderResume(b, uuid.NewString())
	b.attend(statut, http.StatusNotFound, "résumé d'une fiche inconnue", body)
	var journal int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "audit_logs" WHERE "action" = 'assistant.resume' AND "entityId" = $1`, f.id).Scan(&journal); err != nil {
		t.Fatal(err)
	}
	if journal != 1 {
		t.Fatalf("une lecture du résumé, une ligne de journal : %d", journal)
	}
}

// Le fournisseur ne reçoit que des événements anonymes ; un chiffre inventé
// fait garder le résumé calculé ; la même révision ne repart pas chez lui.
func TestAssistantResumeFicheAnonyme(t *testing.T) {
	faux := demarrerFauxFournisseur(t, func(map[string]any) string {
		return `{"lignes":["Deux appels, un seul joint.","Recommandé par [parrain], sans rendez-vous.","Rappeler demain comme promis."]}`
	})
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	f := semerFicheResumee(b)

	statut, body := demanderResume(b, f.id)
	b.attend(statut, http.StatusOK, "résumé rédigé", body)
	lignes := lignesDuResume(body)
	if body["reponduPar"] != "groq/faux-modele" || len(lignes) != 3 || lignes[1] != "Recommandé par "+f.parrain+", sans rendez-vous." {
		t.Fatalf("résumé rédigé inattendu : %v", body)
	}
	chiffresDuTelephone := strings.TrimPrefix(f.telephone, "+22178")
	for _, message := range faux.messages() {
		for _, interdit := range []string{f.nom, f.prenom, chiffresDuTelephone, f.commentaire, "Parrainresume", "aminata@"} {
			if strings.Contains(message, interdit) {
				t.Fatalf("%q est parti chez le fournisseur : %s", interdit, message)
			}
		}
	}
	if statut, _ := demanderResume(b, f.id); statut != http.StatusOK || len(faux.messages()) != 1 {
		t.Fatalf("la même révision se relit en mémoire : %d appels au fournisseur", len(faux.messages()))
	}

	faux.changer(func(map[string]any) string {
		return `{"lignes":["47 appels passés.","Rendez-vous le 31.","Rappeler."]}`
	})
	b.exec(`UPDATE "prospects" SET "rev" = "rev" + 1 WHERE "id" = $1`, f.id)
	statut, body = demanderResume(b, f.id)
	b.attend(statut, http.StatusOK, "résumé aux chiffres inventés", body)
	if body["reponduPar"] != "calcul" || len(faux.messages()) != 2 {
		t.Fatalf("un chiffre inventé fait garder le résumé calculé : %v", body)
	}
}

// Une campagne active dont aucune fiche n'a été appelée : le compte rendu doit la nommer.
func (b *banc) semerCampagneARelancer() string {
	b.t.Helper()
	nettoyerProspects(b, b.userID)
	lot, prospect := uuid.NewString(), uuid.NewString()
	campagne := "Campagne assistant " + strings.ToUpper(uuid.NewString()[:6])
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","projet","clientCreatedAt","updatedAt")
	        VALUES ($1,'Relance','Campagne',$2,$3,'CHUES',now(),now())`, prospect, telephoneAssistant(), b.userID)
	b.exec(`INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	        VALUES ($1,$2,'PROSPECTS','CHUES','{}'::jsonb,1,$3)`, lot, campagne, b.userID)
	b.exec(`INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId") VALUES ($1,$2,1,$3)`, lot, prospect, b.userID)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})
	return campagne
}

func (b *banc) compteRenduDuJour() string {
	b.t.Helper()
	b.notificationPurge()
	s := b.notificationService()
	if err := notifications.CompteRenduQuotidien(b.ctx, s); err != nil {
		b.t.Fatal(err)
	}
	var corps string
	if err := b.pool.QueryRow(b.ctx, `SELECT "body" FROM "notifications" WHERE "reminderKey" = $1 AND "period" = $2`,
		"daily-report:"+b.userID, notifications.JourNotification(s, time.Now())).Scan(&corps); err != nil {
		b.t.Fatal(err)
	}
	return corps
}

// Un numéro neuf à chaque appel : une fiche laissée par un autre test ne le porte pas.
func telephoneAssistant() string {
	return fmt.Sprintf("+22178%07d", time.Now().UnixNano()/1000%10_000_000)
}

// Le compte rendu de 17 h dit ce qui a changé à partir des chiffres, sans modèle.
func TestAssistantCompteRenduCeQuiAChange(t *testing.T) {
	t.Setenv("ASSISTANT_AI_PROVIDERS", "groq")
	t.Setenv("GROQ_API_KEY", "")
	b := nouveauBanc(t, "ADMIN")
	campagne := b.semerCampagneARelancer()
	corps := b.compteRenduDuJour()
	if !strings.Contains(corps, "Ce qui a changé : ") || !strings.Contains(corps, "Campagnes à relancer : "+campagne) {
		t.Fatalf("le compte rendu doit dire ce qui a changé et nommer la campagne à relancer : %s", corps)
	}
}

// Le modèle ne reçoit que des agrégats : les noms de campagne restent au serveur.
func TestAssistantCompteRenduRedigeSurAgregats(t *testing.T) {
	faux := demarrerFauxFournisseur(t, func(map[string]any) string {
		return `{"paragraphe":"Activité en recul, des rappels attendent."}`
	})
	b := nouveauBanc(t, "ADMIN")
	campagne := b.semerCampagneARelancer()
	corps := b.compteRenduDuJour()
	if !strings.Contains(corps, "Ce qui a changé : Activité en recul, des rappels attendent. Campagnes à relancer : "+campagne) {
		t.Fatalf("le paragraphe rédigé puis les campagnes à relancer : %s", corps)
	}
	for _, message := range faux.messages() {
		if strings.Contains(message, campagne) {
			t.Fatalf("un nom de campagne est parti chez le fournisseur : %s", message)
		}
	}
}

// Un lecteur limité à son portefeuille ne doit compter que ses fiches.
func TestAssistantPorteeParTeleconseiller(t *testing.T) {
	b := bancAssistant(t, "ADMIN")
	voisin := nouveauBanc(t, "COMMERCIAL")
	q := db.New(b.pool)
	canal := "Assistant " + uuid.NewString()[:8]
	idCanal := uuid.NewString()
	b.exec(`INSERT INTO "canaux_provenance" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`, idCanal, "ASSIST_"+uuid.NewString()[:8], canal)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "canalProvenanceId" = $1`, idCanal)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "canaux_provenance" WHERE "id" = $1`, idCanal)
	})

	creer := func(proprietaire, statut string) {
		b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","statut","projet","canalProvenanceId","clientCreatedAt","updatedAt")
		        VALUES ($1,'Essai','Assistant',$2,$3,$4::"ProspectStatut",'CHUES',$5,now(),now())`,
			uuid.NewString(), "+2217"+uuid.NewString()[:8], proprietaire, statut, idCanal)
	}
	creer(b.userID, "CONVERTI")
	creer(b.userID, "PERDU")
	creer(voisin.userID, "CONVERTI")

	lire := func(teleconseiller *string) db.AssistantConversionsParCanalRow {
		lignes, err := q.AssistantConversionsParCanal(b.ctx, db.AssistantConversionsParCanalParams{
			Du: time.Now().Add(-time.Hour), Au: time.Now().Add(time.Hour), Teleconseiller: teleconseiller,
		})
		if err != nil {
			t.Fatal(err)
		}
		for _, ligne := range lignes {
			if ligne.Canal == canal {
				return ligne
			}
		}
		t.Fatalf("canal %s absent des conversions", canal)
		return db.AssistantConversionsParCanalRow{}
	}

	if tout := lire(nil); tout.Prospects != 3 || tout.Convertis != 2 || tout.Perdus != 1 {
		t.Fatalf("sans limite de portefeuille : 3 fiches, 2 converties, 1 perdue attendues, reçu %+v", tout)
	}
	if sien := lire(&b.userID); sien.Prospects != 2 || sien.Convertis != 1 {
		t.Fatalf("limité à son portefeuille : 2 fiches et 1 conversion attendues, reçu %+v", sien)
	}
}

// Une question non partagée reste invisible aux autres ; une partagée se voit sans être supprimable.
func TestAssistantQuestionsEnregistrees(t *testing.T) {
	auteur := bancAssistant(t, "ADMIN")
	autre := bancAssistant(t, "ADMIN")

	if statut := auteur.enregistrerQuestion("Appels du mois", "combien d'appels ce mois-ci ?", false); statut != http.StatusCreated {
		t.Fatalf("enregistrement : 201 attendu, %d reçu", statut)
	}
	if statut := auteur.enregistrerQuestion("Canaux partagés", "quel canal convertit le mieux ?", true); statut != http.StatusCreated {
		t.Fatalf("enregistrement partagé : 201 attendu, %d reçu", statut)
	}

	libelles := map[string]bool{}
	for _, q := range auteur.questionsEnregistrees() {
		libelle, _ := q["libelle"].(string)
		mienne, _ := q["miennes"].(bool)
		if mienne {
			libelles[libelle] = true
		}
	}
	if !libelles["Appels du mois"] || !libelles["Canaux partagés"] {
		t.Fatalf("l'auteur ne retrouve pas ses questions : %v", libelles)
	}

	vues := map[string]bool{}
	var idPartagee string
	for _, q := range autre.questionsEnregistrees() {
		libelle, _ := q["libelle"].(string)
		vues[libelle] = true
		if libelle == "Canaux partagés" {
			idPartagee, _ = q["id"].(string)
		}
	}
	if vues["Appels du mois"] {
		t.Fatal("une question non partagée est visible par un autre compte")
	}
	if !vues["Canaux partagés"] {
		t.Fatal("une question partagée n'est pas visible par les autres")
	}

	statut, body := autre.appel(http.MethodDelete, "/api/v1/assistant/questions-enregistrees/"+idPartagee, nil, true)
	autre.attend(statut, http.StatusNotFound, "suppression de la question d'un autre", body)
}

// Un outil vide envoie un ADMIN vers la requête SQL libre ; la question qui
// porte le schéma reçoit la requête fournie par le test.
func fauxModeleSQL(t *testing.T, sql string) {
	t.Helper()
	demarrerFauxFournisseur(t, func(entree map[string]any) string {
		if _, surSchema := entree["schema"]; surSchema {
			return enJSON(t, map[string]string{"sql": sql})
		}
		return `{"outil":""}`
	})
}

// `select *` et la ligne entière passent le filtre de texte : seul le rôle de lecture les arrête.
func TestAssistantSQLNeLitPasLesHachages(t *testing.T) {
	essais := []struct{ nom, sql string }{
		{"hachage", `select "passwordHash" from users`},
		{"delai", `select set_config('statement_timeout','0',true)`},
		{"etoile", `select * from users`},
		{"ligne", `select u from users u`},
	}
	for _, essai := range essais {
		t.Run(essai.nom, func(t *testing.T) {
			fauxModeleSQL(t, essai.sql)
			b := nouveauBanc(t, "ADMIN")
			statut, body := b.connexion(b.email, "motdepasse")
			b.attend(statut, http.StatusOK, "connexion", body)

			statut, body = b.appel(http.MethodPost, "/api/v1/assistant/questions",
				map[string]string{"question": "peux-tu lire ceci pour moi ?"}, true)
			if statut != http.StatusUnprocessableEntity {
				t.Fatalf("requête interdite : 422 attendu, %d reçu %v", statut, body)
			}
			if code, _ := body["code"].(string); code != "ASSISTANT_REQUETE_REFUSEE" {
				t.Fatalf("code ASSISTANT_REQUETE_REFUSEE attendu, reçu %v", body)
			}
		})
	}
}
