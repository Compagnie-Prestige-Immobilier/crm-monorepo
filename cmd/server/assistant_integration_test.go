//go:build integration

package main

import (
	"bytes"
	"cpi-go/db"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

// Format Groq : un outil vide envoie un ADMIN vers la requête SQL libre, puis
// la question qui porte le schéma reçoit la requête fournie par le test.
func fauxModeleSQL(t *testing.T, sql string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var requete struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&requete); err != nil {
			t.Fatal(err)
		}
		var entree map[string]any
		for _, m := range requete.Messages {
			if m.Role == "user" {
				_ = json.Unmarshal([]byte(m.Content), &entree)
			}
		}
		contenu := `{"outil":""}`
		if _, surSchema := entree["schema"]; surSchema {
			reponse, err := json.Marshal(map[string]string{"sql": sql})
			if err != nil {
				t.Fatal(err)
			}
			contenu = string(reponse)
		}
		corps, err := json.Marshal(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": contenu}}},
		})
		if err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(corps)
	}))
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
			faux := fauxModeleSQL(t, essai.sql)
			t.Cleanup(faux.Close)
			t.Setenv("ASSISTANT_AI_PROVIDERS", "groq")
			t.Setenv("GROQ_API_KEY", "jeton-essai")
			t.Setenv("GROQ_URL", faux.URL)

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
