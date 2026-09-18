//go:build integration

package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

const retourGlpiEssai = "https://glpi.essai/plugins/singlesignon/front/callback.php/provider/1"

func (b *banc) autoriserGlpi() *url.URL {
	b.t.Helper()
	requete := url.Values{"client_id": {"crm"}, "redirect_uri": {retourGlpiEssai}, "state": {"etat"}, "response_type": {"code"}}
	sansSuivre := *b.client
	sansSuivre.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	req, _ := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+"/api/v1/auth/glpi/autoriser?"+requete.Encode(), http.NoBody)
	resp, err := sansSuivre.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusFound {
		b.t.Fatalf("autoriser : 302 attendu, %d reçu", resp.StatusCode)
	}
	return mustURL(b.t, resp.Header.Get("Location"))
}

func (b *banc) jetonGlpi(code, secret string) (statut int, reponse map[string]any) {
	b.t.Helper()
	corps := url.Values{"grant_type": {"authorization_code"}, "client_id": {"crm"}, "client_secret": {secret}, "code": {code}, "redirect_uri": {retourGlpiEssai}}
	req, _ := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+"/api/v1/auth/glpi/jeton", strings.NewReader(corps.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func TestGlpiOuvreLaPlateformeAvecLaSessionDuPanneau(t *testing.T) {
	t.Setenv("GLPI_URL", "https://glpi.essai")
	t.Setenv("GLPI_SSO_CLIENT_ID", "crm")
	t.Setenv("GLPI_SSO_SECRET", "secret-essai")
	b := nouveauBanc(t, "SUPERVISEUR")

	if vers := b.autoriserGlpi(); vers.Path != "/connexion" || !strings.HasPrefix(vers.Query().Get("suite"), "/api/v1/auth/glpi/autoriser?") {
		t.Fatalf("sans session : renvoi vers la connexion attendu, %s reçu", vers)
	}
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	vers := b.autoriserGlpi()
	code := vers.Query().Get("code")
	if !strings.HasPrefix(vers.String(), retourGlpiEssai+"?") || code == "" || vers.Query().Get("state") != "etat" {
		t.Fatalf("retour vers GLPI avec code et état attendu, %s reçu", vers)
	}

	statut, body = b.jetonGlpi(code, "mauvais")
	b.attend(statut, http.StatusUnauthorized, "secret faux", body)
	statut, body = b.jetonGlpi(code, "secret-essai")
	b.attend(statut, http.StatusOK, "échange du code", body)
	acces := texteDe(body["access_token"])
	statut, body = b.jetonGlpi(code, "secret-essai")
	b.attend(statut, http.StatusBadRequest, "code rejoué", body)

	req, _ := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+"/api/v1/auth/glpi/profil", http.NoBody)
	req.Header.Set("Authorization", "Bearer "+acces)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var profil map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&profil)
	if resp.StatusCode != http.StatusOK || profil["email"] != b.email || profil["id"] != b.userID {
		t.Fatalf("profil : %d %v", resp.StatusCode, profil)
	}

	b.exec(`UPDATE "users" SET "role" = 'COMMERCIAL', "roleId" = 'COMMERCIAL' WHERE "id" = $1`, b.userID)
	if refus := b.autoriserGlpi(); refus.Query().Get("error") != "access_denied" || refus.Query().Get("code") != "" {
		t.Fatalf("rôle sans la permission : refus attendu, %s reçu", refus)
	}
}
