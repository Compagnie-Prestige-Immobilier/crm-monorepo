//go:build integration

package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func verifierIdentiteKairo(t *testing.T, r *http.Request) bool {
	t.Helper()
	charge, signature, ok := strings.Cut(r.Header.Get("X-Kairos-Identite"), ".")
	mac := hmac.New(sha256.New, []byte("secret-essai"))
	_, _ = mac.Write([]byte(charge))
	sig, err := hex.DecodeString(signature)
	if !ok || err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		t.Error("signature Kairos invalide")
		return false
	}
	brut, err := base64.RawURLEncoding.DecodeString(charge)
	if err != nil {
		t.Error(err)
		return false
	}
	var id struct {
		Sub         string
		App         string
		WorkspaceID int64 `json:"workspaceId"`
		Exp         int64
	}
	if err := json.Unmarshal(brut, &id); err != nil {
		t.Error(err)
		return false
	}
	if id.Sub == "" || id.App != "crm" || id.WorkspaceID != 1 || id.Exp <= time.Now().Unix() || id.Exp > time.Now().Add(2*time.Minute).Unix() {
		t.Error("identité Kairos incorrecte")
		return false
	}
	return true
}

func kairoFactice(t *testing.T, recues *[]string) {
	kairo := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/sdk/taches" {
			if !verifierIdentiteKairo(t, r) {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"resultat": `{"description":"Le bouton Enregistrer reste sans effet.","contexte":""}`, "modele": "openrouter/modele-disponible"})
			return
		}
		if r.Header.Get("Authorization") != "Bearer jeton-kairo" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		*recues = append(*recues, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/etat":
			_, _ = w.Write([]byte(`{"sain":true,"pauseDepuis":null,"derniereLectureSecondes":3,"intervalleSecondes":30,"agents":["claude-primary"],"mttrSecondes":85,"tickets":[{"id":7,"projet":"crm","statut":"pr","essais":1,"majLe":"2026-09-22 01:00:00","lien":"https://glpi/7","resume":"Correction appliquée","cause":"Bug sur bouton","notes":"À tester en staging","prUrl":"https://github.com/cpi/crm/pull/42","fichiers":"support.go,carte.tsx","dureeSecondes":85,"jevCategorie":"CODE_DEFECT","jevConfiance":0.95}]}`))
		case "/tickets/7/relance":
			w.WriteHeader(http.StatusConflict)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(kairo.Close)
	t.Setenv("KAIRO_URL", kairo.URL)
	t.Setenv("KAIRO_ADMIN_TOKEN", "jeton-kairo")
}

func TestKairoRelaieLesCommandesEtTraceLeModeleDeReformulation(t *testing.T) {
	var enPanne atomic.Bool
	var appels atomic.Int32
	fournisseurIAFactice(t, &enPanne, &appels)
	var recues []string
	kairoFactice(t, &recues)
	b := bancSupport(t, "ADMIN")

	statut, body := b.signaler(uuid.NewString(), "bouton enregistrer marche pas", 0)
	b.attend(statut, http.StatusAccepted, "signalement reçu", body)
	id, _ := body["id"].(string)
	b.attendEtat(id, "reessai_planifie")
	var auteur *string
	if err := b.pool.QueryRow(b.ctx, `SELECT "reformulePar" FROM "support_signalements" WHERE "id" = $1`, id).Scan(&auteur); err != nil {
		t.Fatal(err)
	}
	if auteur == nil || *auteur != "openrouter/modele-disponible" {
		t.Fatalf("modèle retenu : %v", auteur)
	}

	statut, body = b.appelSupport(http.MethodGet, "/api/v1/admin/kairo", nil)
	b.attend(statut, http.StatusOK, "tableau Kairo", body)
	etat, _ := body["kairo"].(map[string]any)
	if sain, _ := etat["sain"].(bool); !sain {
		t.Fatalf("état de Kairo : %v", body)
	}
	verifierDetailTicket(t, etat)
	statut, body = b.appelSupport(http.MethodPost, "/api/v1/admin/kairo/pause", nil)
	b.attend(statut, http.StatusNoContent, "pause", body)
	statut, body = b.appelSupport(http.MethodPost, "/api/v1/admin/kairo/tickets/7/relance", nil)
	b.attend(statut, http.StatusConflict, "relance refusée par Kairo", body)
	if len(recues) != 3 || recues[1] != "POST /pause" {
		t.Fatalf("commandes reçues par Kairo : %v", recues)
	}

	t.Setenv("KAIRO_URL", "")
	statut, body = b.appelSupport(http.MethodGet, "/api/v1/admin/kairo", nil)
	b.attend(statut, http.StatusOK, "tableau sans Kairo", body)
	if body["kairo"] != nil || body["kairoErreur"] == "" {
		t.Fatalf("Kairo non relié : %v", body)
	}
}

func verifierDetailTicket(t *testing.T, etat map[string]any) {
	t.Helper()
	if mttr, _ := etat["mttrSecondes"].(float64); int(mttr) != 85 {
		t.Fatalf("mttrSecondes attendu 85, reçu : %v", etat["mttrSecondes"])
	}
	tickets, _ := etat["tickets"].([]any)
	if len(tickets) != 1 {
		t.Fatalf("tickets attendus : %v", tickets)
	}
	t0, _ := tickets[0].(map[string]any)
	if t0["resume"] != "Correction appliquée" || t0["prUrl"] != "https://github.com/cpi/crm/pull/42" || t0["fichiers"] != "support.go,carte.tsx" || t0["jevCategorie"] != "CODE_DEFECT" || t0["jevConfiance"] != 0.95 {
		t.Fatalf("champs de détail ticket : %v", t0)
	}
}
