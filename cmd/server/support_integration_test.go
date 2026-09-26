//go:build integration

package main

import (
	"bytes"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"cpi-go/internal/support"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

// GLPI joignable du point de vue de la configuration, injoignable du point de
// vue du réseau : l'acceptation doit tenir sans lui.
const glpiInjoignable = "http://127.0.0.1:1"

func supportBalayer(b *banc) error {
	b.t.Helper()
	cfg, err := socle.LireConfig()
	if err != nil {
		return err
	}
	return support.Balayer(b.ctx, &socle.Deps{Q: db.New(b.pool), Pool: b.pool, Cfg: cfg})
}

func bancSupport(t *testing.T, role string) *banc {
	t.Helper()
	t.Setenv("GLPI_URL", glpiInjoignable)
	t.Setenv("GLPI_APP_TOKEN", "app-essai")
	t.Setenv("GLPI_USER_TOKEN", "user-essai")
	b := nouveauBanc(t, role)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "support_signalements" WHERE "auteurId" = $1`, b.userID)
	})
	return b
}

func (b *banc) signaler(cle, description string, images int) (statut int, reponse map[string]any) {
	b.t.Helper()
	var corps bytes.Buffer
	w := multipart.NewWriter(&corps)
	for nom, valeur := range map[string]string{
		"cle": cle, "description": description, "contexte": "Écran : essai",
		"urgence": "3", "categorie": "1",
	} {
		if err := w.WriteField(nom, valeur); err != nil {
			b.t.Fatal(err)
		}
	}
	for i := range images {
		entete := textproto.MIMEHeader{}
		entete.Set("Content-Disposition", `form-data; name="images"; filename="capture.png"`)
		entete.Set("Content-Type", "image/png")
		partie, err := w.CreatePart(entete)
		if err != nil {
			b.t.Fatal(err)
		}
		// En-tête PNG suivi d'un octet distinct : le serveur reconnaît le type
		// par le contenu, et deux images du même envoi restent distinctes.
		if _, err := partie.Write(append([]byte("\x89PNG\r\n\x1a\n"), byte(i))); err != nil {
			b.t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		b.t.Fatal(err)
	}
	req, _ := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+"/api/v1/support/tickets", &corps)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func (b *banc) appelSupport(methode, chemin string, corps any) (statut int, reponse map[string]any) {
	b.t.Helper()
	var buf bytes.Buffer
	if corps != nil {
		if err := json.NewEncoder(&buf).Encode(corps); err != nil {
			b.t.Fatal(err)
		}
	}
	req, _ := http.NewRequestWithContext(b.ctx, methode, b.ts.URL+chemin, &buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	lu, _ := io.ReadAll(resp.Body)
	var body map[string]any
	if bytes.HasPrefix(bytes.TrimSpace(lu), []byte("[")) {
		var liste []any
		_ = json.Unmarshal(lu, &liste)
		return resp.StatusCode, map[string]any{"items": liste}
	}
	_ = json.Unmarshal(lu, &body)
	return resp.StatusCode, body
}

func (b *banc) etatSignalement(id string) string {
	b.t.Helper()
	var etat string
	if err := b.pool.QueryRow(b.ctx, `SELECT "etat" FROM "support_signalements" WHERE "id" = $1`, id).Scan(&etat); err != nil {
		b.t.Fatal(err)
	}
	return etat
}

func (b *banc) attendEtat(id string, attendus ...string) {
	b.t.Helper()
	for range 100 {
		etat := b.etatSignalement(id)
		if slices.Contains(attendus, etat) {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	b.t.Fatalf("état %v jamais atteint, %q observé", attendus, b.etatSignalement(id))
}

func TestSupportAccepteSansGlpiEtSuitLaTransmission(t *testing.T) {
	b := bancSupport(t, "SUPERVISEUR")
	cle := uuid.NewString()

	debut := time.Now()
	statut, body := b.signaler(cle, "Le bouton Enregistrer ne répond plus", 2)
	b.attend(statut, http.StatusAccepted, "signalement reçu", body)
	if attente := time.Since(debut); attente > 3*time.Second {
		t.Fatalf("l'acceptation a attendu GLPI : %v", attente)
	}
	id, _ := body["id"].(string)
	if id == "" || body["etat"] != "en_attente" || body["numeroGlpi"] != nil {
		t.Fatalf("reçu : %v", body)
	}
	var images int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "support_signalement_images" WHERE "signalementId" = $1`, id).Scan(&images); err != nil {
		t.Fatal(err)
	}
	if images != 2 {
		t.Fatalf("les deux images doivent être durables : %d", images)
	}

	// Même clé, même contenu : le signalement déjà enregistré, pas un second.
	statut, body = b.signaler(cle, "Le bouton Enregistrer ne répond plus", 2)
	b.attend(statut, http.StatusAccepted, "même clé, même contenu", body)
	if body["id"] != id {
		t.Fatalf("un second signalement a été créé : %v", body)
	}
	statut, body = b.signaler(cle, "Autre chose", 0)
	b.attend(statut, http.StatusConflict, "même clé, contenu différent", body)
	if body["code"] != "SUPPORT_CLE_REUTILISEE" || b.etatSignalement(id) == "" {
		t.Fatalf("conflit : %v", body)
	}

	b.suivreApresEchecGlpi(id)
}

// GLPI injoignable : la transmission échoue, se replanifie, et le suivi le dit.
func (b *banc) suivreApresEchecGlpi(id string) {
	b.t.Helper()
	b.attendEtat(id, "reessai_planifie")
	var code string
	if err := b.pool.QueryRow(b.ctx, `SELECT "codeErreur" FROM "support_signalements" WHERE "id" = $1`, id).Scan(&code); err != nil {
		b.t.Fatal(err)
	}
	if code != "SUPPORT_GLPI_INJOIGNABLE" {
		b.t.Fatalf("code d'erreur : %q", code)
	}

	statut, body := b.appelSupport(http.MethodGet, "/api/v1/support/tickets", nil)
	b.attend(statut, http.StatusOK, "liste de l'auteur", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		b.t.Fatalf("un seul signalement attendu : %d", len(items))
	}
	ligne, _ := items[0].(map[string]any)
	if ligne["id"] != id || ligne["images"] != float64(2) || ligne["imagesTransmises"] != float64(0) {
		b.t.Fatalf("ligne de suivi : %v", ligne)
	}
}

// Sans configuration GLPI, le texte du signalant ne doit pas être perdu : il
// est conservé et l'échec nomme la cause au lieu d'un refus au clic.
func TestSupportConserveLeSignalementQuandGlpiNEstPasRelie(t *testing.T) {
	t.Setenv("GLPI_URL", "")
	t.Setenv("GLPI_APP_TOKEN", "")
	t.Setenv("GLPI_USER_TOKEN", "")
	b := nouveauBanc(t, "SUPERVISEUR")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "support_signalements" WHERE "auteurId" = $1`, b.userID)
	})

	statut, body = b.signaler(uuid.NewString(), "Plus aucun export ne se télécharge", 1)
	b.attend(statut, http.StatusAccepted, "signalement reçu sans GLPI relié", body)
	id, _ := body["id"].(string)
	b.attendEtat(id, "echec")

	var code string
	var tentatives int
	if err := b.pool.QueryRow(b.ctx, `SELECT "codeErreur", "tentatives" FROM "support_signalements" WHERE "id" = $1`, id).Scan(&code, &tentatives); err != nil {
		t.Fatal(err)
	}
	if code != "SUPPORT_NON_CONFIGURE" || tentatives != 1 {
		t.Fatalf("erreur permanente attendue sans répétition : %q après %d tentative(s)", code, tentatives)
	}
	statut, body = b.appelSupport(http.MethodGet, "/api/v1/support/tickets/"+id, nil)
	b.attend(statut, http.StatusOK, "suivi lisible", body)
	reprenable, _ := body["reprenable"].(bool)
	if body["erreur"] == nil || !reprenable {
		t.Fatalf("l'auteur doit lire la cause et pouvoir reprendre : %v", body)
	}
}

func TestSupportUneSeuleDemandePourDeuxEnvoisConcurrents(t *testing.T) {
	b := bancSupport(t, "SUPERVISEUR")
	cle := uuid.NewString()
	var attente sync.WaitGroup
	statuts := make([]int, 2)
	for i := range statuts {
		attente.Add(1)
		go func() {
			defer attente.Done()
			statuts[i], _ = b.signaler(cle, "Double clic sur Envoyer", 0)
		}()
	}
	attente.Wait()
	for _, statut := range statuts {
		if statut != http.StatusAccepted {
			t.Fatalf("les deux envois doivent être acceptés : %v", statuts)
		}
	}
	var demandes int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "support_signalements" WHERE "auteurId" = $1`, b.userID).Scan(&demandes); err != nil {
		t.Fatal(err)
	}
	if demandes != 1 {
		t.Fatalf("un seul signalement attendu, %d écrits", demandes)
	}
}

func TestSupportRepriseReconciliationEtCloisonnementDesAuteurs(t *testing.T) {
	b := bancSupport(t, "SUPERVISEUR")
	autre := bancSupport(t, "SUPERVISEUR")
	admin := bancSupport(t, "ADMIN")
	statut, body := b.signaler(uuid.NewString(), "Import bloqué depuis ce matin", 0)
	b.attend(statut, http.StatusAccepted, "signalement reçu", body)
	id, _ := body["id"].(string)
	chemin := "/api/v1/support/tickets/" + id
	b.attendEtat(id, "reessai_planifie")

	statut, body = autre.appelSupport(http.MethodGet, chemin, nil)
	autre.attend(statut, http.StatusNotFound, "signalement d'un autre auteur", body)
	if strings.Contains(strings.ToLower(texteDe(body["message"])), "import") {
		t.Fatalf("le refus ne doit rien laisser filtrer : %v", body)
	}

	// Tentatives épuisées : l'état devient terminal et la reprise redevient possible.
	b.exec(`UPDATE "support_signalements" SET "tentatives" = 5, "prochaineTentative" = now() - interval '1 minute', "etat" = 'en_attente' WHERE "id" = $1`, id)
	if err := supportBalayer(b); err != nil {
		t.Fatal(err)
	}
	if etat := b.etatSignalement(id); etat != "echec" {
		t.Fatalf("échec définitif attendu après cinq tentatives, %q observé", etat)
	}
	statut, body = b.appelSupport(http.MethodGet, chemin, nil)
	b.attend(statut, http.StatusOK, "suivi relu", body)
	reprenable, _ := body["reprenable"].(bool)
	if !reprenable || body["erreur"] == nil {
		t.Fatalf("un échec doit être repris ou expliqué : %v", body)
	}

	statut, body = autre.appelSupport(http.MethodPost, chemin+"/rattacher", map[string]any{"numeroGlpi": 4242})
	autre.attend(statut, http.StatusForbidden, "rattachement sans droit d'exploitation", body)

	statut, body = b.appelSupport(http.MethodPost, chemin+"/reprendre", nil)
	b.attend(statut, http.StatusOK, "reprise du même signalement", body)
	if body["numeroGlpi"] != nil {
		t.Fatalf("la reprise ne fabrique pas de numéro : %v", body)
	}

	b.attendEtat(id, "reessai_planifie")
	b.exec(`UPDATE "support_signalements" SET "etat" = 'a_verifier', "creationEngagee" = true WHERE "id" = $1`, id)
	statut, body = admin.appelSupport(http.MethodPost, chemin+"/rattacher", map[string]any{"numeroGlpi": 4242})
	admin.attend(statut, http.StatusOK, "numéro GLPI vérifié rattaché", body)
	if body["numeroGlpi"] != float64(4242) {
		t.Fatalf("numéro rattaché : %v", body)
	}
	// Le numéro connu interdit désormais toute nouvelle création distante.
	if err := supportBalayer(b); err != nil {
		t.Fatal(err)
	}
	var numero *int32
	if err := b.pool.QueryRow(b.ctx, `SELECT "numeroGlpi" FROM "support_signalements" WHERE "id" = $1`, id).Scan(&numero); err != nil {
		t.Fatal(err)
	}
	if numero == nil || *numero != 4242 {
		t.Fatalf("le numéro déjà obtenu doit survivre aux reprises : %v", numero)
	}
}

func fournisseurIAFactice(t *testing.T, enPanne *atomic.Bool, appels *atomic.Int32) {
	t.Helper()
	ia := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		appels.Add(1)
		var requete struct {
			Model string `json:"model"`
		}
		_ = json.NewDecoder(r.Body).Decode(&requete)
		if enPanne.Load() || requete.Model == "modele-en-panne" || r.Header.Get("Authorization") != "Bearer cle-essai" {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		contenu := `{"description": "Le bouton Enregistrer reste sans effet.", "contexte": ""}`
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"role": "assistant", "content": contenu}}}})
	}))
	t.Cleanup(ia.Close)
	t.Setenv("SUPPORT_AI_ENABLED", "true")
	t.Setenv("SUPPORT_AI_PROVIDERS", "openrouter")
	t.Setenv("OPENROUTER_API_KEY", "cle-essai")
	t.Setenv("OPENROUTER_URL", ia.URL)
	t.Setenv("OPENROUTER_MODELS", "modele-en-panne,modele-disponible")
}

func (b *banc) textesSignalement(id string) (description, contexte string, transmise, contexteTransmis *string) {
	b.t.Helper()
	if err := b.pool.QueryRow(b.ctx, `SELECT "description", "contexte", "descriptionTransmise", "contexteTransmis"
		FROM "support_signalements" WHERE "id" = $1`, id).Scan(&description, &contexte, &transmise, &contexteTransmis); err != nil {
		b.t.Fatal(err)
	}
	return description, contexte, transmise, contexteTransmis
}

// L'IA travaille après l'accusé de réception : le texte du signalant reste
// intact, le texte transmis est fixé une fois, et une panne laisse partir l'original.
func TestSupportReformuleApresReceptionSansToucherAuTexteDuSignalant(t *testing.T) {
	var enPanne atomic.Bool
	var appels atomic.Int32
	fournisseurIAFactice(t, &enPanne, &appels)
	b := bancSupport(t, "SUPERVISEUR")
	cle, saisie := uuid.NewString(), "bouton enregistrer marche pas"

	statut, body := b.signaler(cle, saisie, 0)
	b.attend(statut, http.StatusAccepted, "signalement reçu", body)
	id, _ := body["id"].(string)
	if body["description"] != saisie {
		t.Fatalf("le signalant doit relire son propre texte : %v", body["description"])
	}
	b.attendEtat(id, "reessai_planifie")
	description, contexte, transmise, contexteTransmis := b.textesSignalement(id)
	if description != saisie || contexte != "Écran : essai" {
		t.Fatalf("texte d'origine modifié : %q / %q", description, contexte)
	}
	if transmise == nil || *transmise != "Le bouton Enregistrer reste sans effet." || contexteTransmis == nil || *contexteTransmis != contexte {
		t.Fatalf("texte transmis : %v / %v", transmise, contexteTransmis)
	}

	statut, body = b.signaler(cle, saisie, 0)
	b.attend(statut, http.StatusAccepted, "renvoi après coupure réseau", body)
	if body["id"] != id {
		t.Fatalf("le renvoi doit retrouver le même signalement : %v", body)
	}

	avant := appels.Load()
	if _, err := b.pool.Exec(b.ctx, `UPDATE "support_signalements" SET "prochaineTentative" = now() WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}
	if err := supportBalayer(b); err != nil {
		t.Fatal(err)
	}
	if appels.Load() != avant {
		t.Fatalf("une reprise ne doit pas rappeler l'IA : %d appels de plus", appels.Load()-avant)
	}
}

func TestSupportTransmetLeTexteDOrigineQuandLIAEstEnPanne(t *testing.T) {
	var enPanne atomic.Bool
	var appels atomic.Int32
	enPanne.Store(true)
	fournisseurIAFactice(t, &enPanne, &appels)
	b := bancSupport(t, "SUPERVISEUR")

	statut, body := b.signaler(uuid.NewString(), "export vide depuis ce matin", 0)
	b.attend(statut, http.StatusAccepted, "signalement reçu pendant une panne IA", body)
	autre, _ := body["id"].(string)
	b.attendEtat(autre, "reessai_planifie")
	if _, _, transmise, _ := b.textesSignalement(autre); transmise == nil || *transmise != "export vide depuis ce matin" {
		t.Fatalf("une panne IA doit transmettre le texte d'origine : %v", transmise)
	}
}
