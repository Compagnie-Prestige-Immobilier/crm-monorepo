//go:build integration

package main

import (
	"bufio"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestAssistantFluxProgressifEtAnnulation(t *testing.T) {
	b := bancAssistant(t, "ADMIN")
	coupe := make(chan struct{})
	amont := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !verifierIdentiteKairo(t, r) {
			http.Error(w, "identité refusée", http.StatusUnauthorized)
			return
		}
		if r.Header.Get("X-Kairos-Request-ID") != "requete-stable" {
			t.Error("clé de rejeu perdue")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("event: texte\ndata: {\"texte\":\"Début\"}\n\n"))
		if err := http.NewResponseController(w).Flush(); err != nil {
			t.Error(err)
			return
		}
		<-r.Context().Done()
		close(coupe)
	}))
	defer amont.Close()
	t.Setenv("KAIRO_URL", amont.URL)
	t.Setenv("KAIRO_SDK_SECRET", "secret-essai")
	t.Setenv("KAIRO_WORKSPACE_ID", "1")
	t.Setenv("KAIRO_APPLICATION", "crm")
	ctx, annuler := context.WithTimeout(b.ctx, 5*time.Second)
	defer annuler()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.ts.URL+"/api/v1/assistant/kairos/conversation", strings.NewReader(`{"conversation":"c","messages":[],"contexte":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", b.ts.URL)
	req.Header.Set("X-Kairos-Request-ID", "requete-stable")
	resp, err := b.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("flux : HTTP %d", resp.StatusCode)
	}
	ligne, err := bufio.NewReader(resp.Body).ReadString('\n')
	if err != nil || ligne != "event: texte\n" {
		t.Fatalf("premier fragment absent : %q, %v", ligne, err)
	}
	annuler()
	select {
	case <-coupe:
	case <-time.After(2 * time.Second):
		t.Fatal("le fournisseur continue après annulation")
	}
}

func TestAssistantLectureKairosRefuseSignatureAbsente(t *testing.T) {
	b := bancAssistant(t, "ADMIN")
	statut, corps := b.appel(http.MethodPost, "/api/v1/assistant/kairos/lire", map[string]string{"question": "Combien d’appels hier ?"}, false)
	b.attend(statut, http.StatusUnauthorized, "signature requise même avec une session", corps)
}

func TestAssistantLectureKairosRelitCompte(t *testing.T) {
	b := bancAssistant(t, "ADMIN")
	t.Setenv("KAIRO_SDK_SECRET", "secret-essai")
	t.Setenv("KAIRO_WORKSPACE_ID", "1")
	t.Setenv("KAIRO_APPLICATION", "crm")
	for _, essai := range []struct {
		nom     string
		espace  int
		actif   bool
		attendu int
	}{
		{"identité admise avant validation de la question", 1, true, http.StatusBadRequest},
		{"autre espace refusé", 2, true, http.StatusUnauthorized},
		{"compte désactivé refusé", 1, false, http.StatusUnauthorized},
	} {
		t.Run(essai.nom, func(t *testing.T) {
			if _, err := b.pool.Exec(b.ctx, `UPDATE users SET "isActive"=$1 WHERE id=$2`, essai.actif, b.userID); err != nil {
				t.Fatal(err)
			}
			req := requeteLectureSignee(t, b, essai.espace)
			resp, err := b.client.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = resp.Body.Close() }()
			corps, _ := io.ReadAll(resp.Body)
			if resp.StatusCode != essai.attendu {
				t.Fatalf("HTTP %d, attendu %d : %s", resp.StatusCode, essai.attendu, corps)
			}
		})
	}
}

func requeteLectureSignee(t *testing.T, b *banc, espace int) *http.Request {
	t.Helper()
	signer := func(texte string) string {
		mac := hmac.New(sha256.New, []byte("secret-essai"))
		_, _ = mac.Write([]byte(texte))
		return hex.EncodeToString(mac.Sum(nil))
	}
	charge := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"sub":%q,"app":"crm","org":"crm","workspaceId":%d,"exp":%d}`, b.userID, espace, time.Now().Add(time.Minute).Unix())))
	corps := `{"question":""}`
	chemin := "/api/v1/assistant/kairos/lire"
	horodatage := strconv.FormatInt(time.Now().Unix(), 10)
	req, err := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+chemin, strings.NewReader(corps))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Kairos-Identite", charge+"."+signer(charge))
	req.Header.Set("X-Kairos-Horodatage", horodatage)
	req.Header.Set("X-Kairos-Signature", signer(horodatage+"\nPOST\n"+chemin+"\n"+corps))
	return req
}
