//go:build integration

package main

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type banc struct {
	t      *testing.T
	ctx    context.Context
	pool   *pgxpool.Pool
	ts     *httptest.Server
	client *http.Client
	userID string
	email  string
}

func nouveauBanc(t *testing.T, role string) *banc {
	t.Helper()
	ctx := context.Background()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/cpi_v2_dev?sslmode=disable"
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrer(ctx, pool); err != nil {
		t.Fatal(err)
	}
	id := uuid.NewString()
	email := "test-" + id + "@cpi.sn"
	condensat, _ := database.HacherMotDePasse("motdepasse")
	if _, err := pool.Exec(ctx, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt") VALUES ($1,$2,$3,$4,'Test Intégration',$5,now())`, id, email, "test-"+id, condensat, role); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })

	cfg, err := socle.LireConfig()
	if err != nil {
		t.Fatal(err)
	}
	srv, _, _, err := serveur(cfg, pool)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(srv.Handler)
	t.Cleanup(ts.Close)
	jar, _ := cookiejar.New(nil)
	return &banc{t: t, ctx: ctx, pool: pool, ts: ts, client: &http.Client{Jar: jar}, userID: id, email: email}
}

func (b *banc) appel(method, chemin string, corps map[string]string, origine bool) (statut int, reponse map[string]any) {
	b.t.Helper()
	var buf bytes.Buffer
	if corps != nil {
		if err := json.NewEncoder(&buf).Encode(corps); err != nil {
			b.t.Fatal(err)
		}
	}
	req, err := http.NewRequestWithContext(b.ctx, method, b.ts.URL+chemin, &buf)
	if err != nil {
		b.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if origine {
		req.Header.Set("Origin", b.ts.URL)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func (b *banc) connexion(identifiant, motDePasse string) (statut int, reponse map[string]any) {
	b.t.Helper()
	return b.appel(http.MethodPost, "/api/v1/auth/login", map[string]string{"identifier": identifiant, "password": motDePasse}, true)
}

func (b *banc) attend(statut, attendu int, quoi string, body map[string]any) {
	b.t.Helper()
	if statut != attendu {
		b.t.Fatalf("%s : %d attendu, %d reçu %v", quoi, attendu, statut, body)
	}
}

func mustURL(t *testing.T, s string) *url.URL {
	t.Helper()
	u, err := url.Parse(s)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func (b *banc) compteSessions(revoquees bool) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "refresh_tokens" WHERE "userId" = $1 AND ("revokedAt" IS NOT NULL) = $2`, b.userID, revoquees).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func TestConnexionEcritUneSessionHacheeEtLastLogin(t *testing.T) {
	b := nouveauBanc(t, "SUPERVISEUR")
	statut, body := b.connexion("faux", "motdepasse")
	b.attend(statut, http.StatusUnauthorized, "identifiant inconnu", body)
	if body["code"] != "INVALID_CREDENTIALS" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = b.connexion("TEST-"+b.userID, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion par nom d'utilisateur insensible à la casse", body)
	if u := body["user"].(map[string]any); u["role"] != "SUPERVISEUR" || u["email"] != b.email {
		t.Fatalf("utilisateur renvoyé : %v", u)
	}

	var hash string
	var expire, lastLogin time.Time
	if err := b.pool.QueryRow(b.ctx, `SELECT rt."tokenHash", rt."expiresAt", u."lastLoginAt" FROM "refresh_tokens" rt JOIN "users" u ON u."id" = rt."userId" WHERE rt."userId" = $1`, b.userID).Scan(&hash, &expire, &lastLogin); err != nil {
		t.Fatal(err)
	}
	cookies := b.client.Jar.Cookies(mustURL(t, b.ts.URL))
	if len(cookies) != 1 || cookies[0].Value == hash || len(hash) != 64 {
		t.Fatalf("le jeton doit être stocké haché : cookie %v, hash %q", cookies, hash)
	}
	if d := time.Until(expire); d < 29*24*time.Hour || d > 31*24*time.Hour {
		t.Fatalf("expiration à %v", d)
	}
	if time.Since(lastLogin) > time.Minute {
		t.Fatalf("lastLoginAt non mis à jour : %v", lastLogin)
	}
}

func TestDeconnexionRevoqueSansSupprimer(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	statut, body := b.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	b.attend(statut, http.StatusUnauthorized, "me sans session", body)
	statut, body = b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	statut, body = b.appel(http.MethodPost, "/api/v1/auth/logout", nil, false)
	b.attend(statut, http.StatusForbidden, "écriture sans Origin", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	b.attend(statut, http.StatusOK, "me", body)
	statut, body = b.appel(http.MethodPost, "/api/v1/auth/logout", nil, true)
	b.attend(statut, http.StatusNoContent, "déconnexion", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	b.attend(statut, http.StatusUnauthorized, "me après déconnexion", body)
	if b.compteSessions(true) != 1 || b.compteSessions(false) != 0 {
		t.Fatalf("la session doit être révoquée, pas supprimée : %d révoquées, %d actives", b.compteSessions(true), b.compteSessions(false))
	}
}

func TestChangementDeMotDePasseRevoqueLesAutresSessions(t *testing.T) {
	b := nouveauBanc(t, "ACCUEIL")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "première session", body)
	autre := &banc{t: t, ctx: b.ctx, pool: b.pool, ts: b.ts, userID: b.userID, email: b.email}
	jar, _ := cookiejar.New(nil)
	autre.client = &http.Client{Jar: jar}
	statut, body = autre.connexion(b.email, "motdepasse")
	autre.attend(statut, http.StatusOK, "seconde session", body)

	statut, body = b.appel(http.MethodPost, "/api/v1/auth/password", map[string]string{"currentPassword": "faux", "newPassword": "REDACTED"}, true)
	b.attend(statut, http.StatusUnauthorized, "mot de passe actuel faux", body)
	statut, body = b.appel(http.MethodPost, "/api/v1/auth/password", map[string]string{"currentPassword": "motdepasse", "newPassword": "court"}, true)
	b.attend(statut, http.StatusUnprocessableEntity, "mot de passe trop court", body)
	statut, body = b.appel(http.MethodPost, "/api/v1/auth/password", map[string]string{"currentPassword": "motdepasse", "newPassword": "REDACTED"}, true)
	b.attend(statut, http.StatusNoContent, "changement", body)

	statut, body = b.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	b.attend(statut, http.StatusOK, "la session courante survit", body)
	statut, body = autre.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	autre.attend(statut, http.StatusUnauthorized, "l'autre session est révoquée", body)
	statut, body = autre.connexion(b.email, "motdepasse")
	autre.attend(statut, http.StatusUnauthorized, "ancien mot de passe refusé", body)
	statut, body = autre.connexion(b.email, "REDACTED")
	autre.attend(statut, http.StatusOK, "nouveau mot de passe accepté", body)
}

func TestCompteDesactiveCoupeALaRequeteSuivante(t *testing.T) {
	b := nouveauBanc(t, "DIRECTION")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	var avant time.Time
	if err := b.pool.QueryRow(b.ctx, `SELECT "updatedAt" FROM "users" WHERE "id" = $1`, b.userID).Scan(&avant); err != nil {
		t.Fatal(err)
	}
	time.Sleep(10 * time.Millisecond)
	if _, err := b.pool.Exec(b.ctx, `UPDATE "users" SET "isActive" = false WHERE "id" = $1`, b.userID); err != nil {
		t.Fatal(err)
	}
	var apres time.Time
	if err := b.pool.QueryRow(b.ctx, `SELECT "updatedAt" FROM "users" WHERE "id" = $1`, b.userID).Scan(&apres); err != nil {
		t.Fatal(err)
	}
	if !apres.After(avant) {
		t.Fatalf("le trigger updatedAt n'a pas joué : %v puis %v", avant, apres)
	}
	statut, body = b.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	b.attend(statut, http.StatusUnauthorized, "session d'un compte désactivé", body)
	statut, body = b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusUnauthorized, "connexion d'un compte désactivé", body)
	if body["code"] != "ACCOUNT_DISABLED" || b.compteSessions(false) != 1 {
		t.Fatalf("code %v, sessions actives %d : aucune session ne doit être créée", body["code"], b.compteSessions(false))
	}
}

func TestLimiteurDeConnexion(t *testing.T) {
	t.Setenv("AUTH_LOGIN_RATE_LIMIT", "3")
	b := nouveauBanc(t, "BANQUE_FINANCE")
	for range 3 {
		statut, body := b.connexion(b.email, "faux")
		b.attend(statut, http.StatusUnauthorized, "tentative refusée", body)
	}
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusTooManyRequests, "quatrième tentative", body)
	if body["code"] != "RATE_LIMITED" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestRouteInconnueEtChampInconnu(t *testing.T) {
	b := nouveauBanc(t, "CHARGE_CLIENTELE")
	statut, body := b.appel(http.MethodGet, "/api/v1/inconnue", nil, false)
	b.attend(statut, http.StatusNotFound, "route inconnue", body)
	statut, body = b.appel(http.MethodPost, "/api/v1/auth/login", map[string]string{"identifier": b.email, "password": "motdepasse", "role": "ADMIN"}, true)
	b.attend(statut, http.StatusUnprocessableEntity, "champ inconnu refusé", body)
	if body["code"] != "VALIDATION_FAILED" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestFluxEnDirectArriveAvantLaFinDeLaRequete(t *testing.T) {
	b := nouveauBanc(t, "CHARGE_CLIENTELE")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	ctx, annuler := context.WithTimeout(b.ctx, 3*time.Second)
	defer annuler()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.ts.URL+"/api/v1/live", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("content-type : %q", resp.Header.Get("Content-Type"))
	}
	ligne := make([]byte, 16)
	n, err := resp.Body.Read(ligne)
	if err != nil || !bytes.HasPrefix(ligne[:n], []byte(": ouvert")) {
		t.Fatalf("première ligne du flux : %q, %v", ligne[:n], err)
	}
}
