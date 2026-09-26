//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/shared/socle"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
)

const (
	urlKairosTest    = "https://kairos.exemple.sn"
	secretKairosTest = "secret-kairos-de-test"
	cheminKairosTest = "/api/v1/kairos"
)

func bancKairos(t *testing.T) *banc {
	t.Helper()
	t.Setenv("KAIROS_URL", urlKairosTest)
	t.Setenv("KAIROS_SDK_SECRET", secretKairosTest)
	b := adminConnecte(t)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = $1`, socle.CleReglageAssistantKairos)
	})
	return b
}

type appelKairosTest struct {
	methode, chemin, corps string
	identite               socle.IdentiteKairos
	decalage               time.Duration
	secret                 string
}

func (b *banc) appelKairos(a *appelKairosTest) (statut int, reponse map[string]any) {
	b.t.Helper()
	if a.secret == "" {
		a.secret = secretKairosTest
	}
	jeton, err := socle.SignerIdentiteKairos(secretKairosTest, a.identite)
	if err != nil {
		b.t.Fatal(err)
	}
	horodatage := strconv.FormatInt(time.Now().Add(a.decalage).Unix(), 10)
	mac := hmac.New(sha256.New, []byte(a.secret))
	mac.Write([]byte(horodatage + "\n" + a.methode + "\n" + a.chemin + "\n" + a.corps))
	req, err := http.NewRequestWithContext(b.ctx, a.methode, b.ts.URL+a.chemin, bytes.NewBufferString(a.corps))
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Kairos-Identite", jeton)
	req.Header.Set("X-Kairos-Horodatage", horodatage)
	req.Header.Set("X-Kairos-Signature", hex.EncodeToString(mac.Sum(nil)))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	_ = json.NewDecoder(resp.Body).Decode(&reponse)
	return resp.StatusCode, reponse
}

func (b *banc) afficherKairos(affiche bool) map[string]any {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodPut, cheminKairosTest, map[string]bool{"affiche": affiche})
	b.attend(statut, http.StatusOK, "bascule de l'assistant", body)
	return body
}

func TestKairosIdentiteSuitLaBasculeEtLaPermission(t *testing.T) {
	b := bancKairos(t)
	statut, body := b.appel(http.MethodGet, cheminKairosTest+"/identite", nil, false)
	b.attend(statut, http.StatusForbidden, "identité, assistant retiré", body)

	etat := b.afficherKairos(true)
	if !vraiDe(etat["actif"]) || etat["url"] != urlKairosTest {
		t.Fatalf("assistant affiché : %v", etat)
	}
	statut, body = b.appel(http.MethodGet, cheminKairosTest+"/identite", nil, false)
	b.attend(statut, http.StatusOK, "identité", body)
	identite, err := socle.LireIdentiteKairos(secretKairosTest, texteDe(body["jeton"]), time.Now())
	if err != nil || identite.Sub != b.userID || identite.Role != "ADMIN" || identite.Org != socle.BasePublique {
		t.Fatalf("jeton %v : %+v", err, identite)
	}
	if _, err := socle.LireIdentiteKairos("autre-secret", texteDe(body["jeton"]), time.Now()); err == nil {
		t.Fatal("jeton accepté avec un autre secret")
	}

	roleID := creerRolePersonnalise(b, "Sans Kairos "+b.userID[:8], socle.Commercial, []string{string(socle.PermissionPanneauAcceder)})
	_, email := compteDuRole(b, roleID)
	sansKairos := adminSession(b, email)
	statut, body = sansKairos.appel(http.MethodGet, cheminKairosTest+"/identite", nil, false)
	sansKairos.attend(statut, http.StatusForbidden, "identité sans permission", body)
	statut, body = sansKairos.appel(http.MethodGet, cheminKairosTest, nil, false)
	sansKairos.attend(statut, http.StatusOK, "état sans permission", body)
	if vraiDe(body["actif"]) {
		t.Fatalf("assistant monté sans permission : %v", body)
	}

	t.Setenv("KAIROS_SDK_SECRET", "")
	statut, body = b.appel(http.MethodGet, cheminKairosTest+"/identite", nil, false)
	b.attend(statut, http.StatusForbidden, "identité sans secret", body)
}

func TestKairosAppelSigneAgitAuNomDeLUtilisateur(t *testing.T) {
	b := bancKairos(t)
	b.afficherKairos(true)
	id, _ := adminCompte(b, "COMMERCIAL")
	identite := socle.IdentiteKairos{Sub: id, Role: "COMMERCIAL", Org: socle.BasePublique, Expire: time.Now().Add(5 * time.Minute).Unix()}

	statut, body := b.appelKairos(&appelKairosTest{methode: http.MethodGet, chemin: "/api/v1/auth/me", identite: identite})
	b.attend(statut, http.StatusOK, "appel signé", body)
	if body["id"] != id {
		t.Fatalf("appel rendu au nom de %v", body["id"])
	}
	statut, body = b.appelKairos(&appelKairosTest{methode: http.MethodGet, chemin: "/api/v1/phase2/callbacks?scope=today&pageSize=5", identite: identite})
	b.attend(statut, http.StatusOK, "appel signé avec requête", body)
	statut, body = b.appelKairos(&appelKairosTest{methode: http.MethodPost, chemin: "/api/v1/notifications/" + uuid.NewString() + "/read", corps: "{}", identite: identite})
	b.attend(statut, http.StatusNotFound, "écriture signée sans origine", body)
	statut, body = b.appelKairos(&appelKairosTest{methode: http.MethodGet, chemin: "/api/v1/rendez-vous", identite: identite})
	b.attend(statut, http.StatusForbidden, "route hors des permissions du rôle", body)

	refus := map[string]appelKairosTest{
		"mauvaise signature":  {secret: "autre-secret", identite: identite},
		"horodatage périmé":   {decalage: -6 * time.Minute, identite: identite},
		"identité expirée":    {identite: socle.IdentiteKairos{Sub: id, Org: socle.BasePublique, Expire: time.Now().Add(-time.Second).Unix()}},
		"autre base":          {identite: socle.IdentiteKairos{Sub: id, Org: "demo", Expire: identite.Expire}},
		"utilisateur inconnu": {identite: socle.IdentiteKairos{Sub: "inconnu", Org: socle.BasePublique, Expire: identite.Expire}},
	}
	for quoi, appel := range refus {
		appel.methode, appel.chemin = http.MethodGet, "/api/v1/auth/me"
		statut, body = b.appelKairos(&appel)
		b.attend(statut, http.StatusUnauthorized, quoi, body)
	}

	b.afficherKairos(false)
	statut, body = b.appelKairos(&appelKairosTest{methode: http.MethodGet, chemin: "/api/v1/auth/me", identite: identite})
	b.attend(statut, http.StatusUnauthorized, "assistant retiré", body)
}
