//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/admin"
	"cpi-go/internal/shared/database"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func adminAppel(b *banc, method, chemin string, corps any) (statut int, reponse map[string]any) {
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

func adminExec(b *banc, requete string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, requete, args...); err != nil {
		b.t.Fatal(err)
	}
}

func adminCompte(b *banc, role string) (id, email string) {
	b.t.Helper()
	id = uuid.NewString()
	email = "admin-test-" + id + "@cpi.sn"
	condensat, err := database.HacherMotDePasse("motdepasse")
	if err != nil {
		b.t.Fatal(err)
	}
	adminExec(b, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
		VALUES ($1,$2,$3,$4,'Compte de test',$5,now())`, id, email, "admin-test-"+id, condensat, role)
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	return id, email
}

// Une seconde session, cookies séparés, sur le même serveur.
func adminSession(b *banc, email string) *banc {
	b.t.Helper()
	jar, _ := cookiejar.New(nil)
	autre := &banc{t: b.t, ctx: b.ctx, pool: b.pool, ts: b.ts, client: &http.Client{Jar: jar}, email: email}
	statut, body := autre.connexion(email, "motdepasse")
	autre.attend(statut, http.StatusOK, "connexion "+email, body)
	return autre
}

func adminConnecte(t *testing.T) *banc {
	t.Helper()
	b := nouveauBanc(t, "ADMIN")
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion administrateur", body)
	return b
}

// Le comptage du dernier ADMIN porte sur toute la base : les administrateurs
// déjà présents sont mis de côté le temps du test, puis rétablis.
func adminIsolerAdmins(b *banc, gardes ...string) {
	b.t.Helper()
	rows, err := b.pool.Query(b.ctx,
		`UPDATE "users" SET "isActive" = false
		 WHERE "role" = 'ADMIN' AND "isActive" AND "deletedAt" IS NULL AND NOT ("id" = ANY($1::text[]))
		 RETURNING "id"`, gardes)
	if err != nil {
		b.t.Fatal(err)
	}
	var mis []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			b.t.Fatal(err)
		}
		mis = append(mis, id)
	}
	rows.Close()
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `UPDATE "users" SET "isActive" = true WHERE "id" = ANY($1::text[])`, mis)
	})
}

// Un numéro sénégalais valide : la plateforme le renvoie brut et le serveur le
// normalise en E.164, les deux doivent tomber sur la même chaîne.
func adminTelephone() string {
	return fmt.Sprintf("+22177%07d", rand.IntN(10_000_000))
}

func adminProspect(b *banc, proprietaire, projet, telephone string) string {
	b.t.Helper()
	id := uuid.NewString()
	adminExec(b, `INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","projet","updatedAt")
		VALUES ($1,'Diop','Awa',$2,$3,now(),$4::"Projet",now())`, id, telephone, proprietaire, projet)
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "id" = $1`, id) })
	return id
}

func adminCompterAudit(b *banc, action, entite string) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "audit_logs" WHERE "action" = $1 AND "entityId" = $2`, action, entite).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

// Deux administrateurs se rétrogradent l'un l'autre au même instant : sans le
// verrou sur toutes les lignes ADMIN, les deux passent et la plateforme se
// retrouve sans administrateur.
func TestAdminDerniereRetrogradationSimultanee(t *testing.T) {
	b := adminConnecte(t)
	autreID, autreEmail := adminCompte(b, "ADMIN")
	adminIsolerAdmins(b, b.userID, autreID)
	autre := adminSession(b, autreEmail)

	statuts := make([]int, 2)
	codes := make([]string, 2)
	var attente sync.WaitGroup
	attente.Add(2)
	go func() {
		defer attente.Done()
		statut, body := adminAppel(b, http.MethodPatch, "/api/v1/users/"+autreID, map[string]any{"role": "COMMERCIAL"})
		statuts[0], codes[0] = statut, texteDe(body["code"])
	}()
	go func() {
		defer attente.Done()
		statut, body := adminAppel(autre, http.MethodPatch, "/api/v1/users/"+b.userID, map[string]any{"role": "COMMERCIAL"})
		statuts[1], codes[1] = statut, texteDe(body["code"])
	}()
	attente.Wait()

	// Le perdant est refusé par le dernier admin, ou plus tôt : sa session et
	// son rôle tombent avec la rétrogradation que l'autre vient d'écrire.
	passees := 0
	for i, statut := range statuts {
		switch {
		case statut == http.StatusOK:
			passees++
		case statut >= http.StatusBadRequest:
		default:
			t.Fatalf("rétrogradation %d : statut %d, code %q", i, statut, codes[i])
		}
	}
	if passees != 1 {
		t.Fatalf("%d rétrogradations passées, une seule attendue (statuts %v, codes %v)", passees, statuts, codes)
	}
	var restants int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "users" WHERE "role" = 'ADMIN' AND "isActive" AND "deletedAt" IS NULL`).Scan(&restants); err != nil {
		t.Fatal(err)
	}
	if restants != 1 {
		t.Fatalf("%d administrateurs actifs restants, 1 attendu", restants)
	}
}

func texteDe(v any) string {
	s, _ := v.(string)
	return s
}

func vraiDe(v any) bool {
	b, _ := v.(bool)
	return b
}

func nombreDe(v any) float64 {
	n, _ := v.(float64)
	return n
}

func TestAdminDesactivationRevoqueLesSessions(t *testing.T) {
	b := adminConnecte(t)
	cibleID, cibleEmail := adminCompte(b, "COMMERCIAL")
	cible := adminSession(b, cibleEmail)

	statut, body := cible.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	cible.attend(statut, http.StatusOK, "session ouverte avant désactivation", body)

	statut, body = adminAppel(b, http.MethodPut, "/api/v1/users/"+cibleID+"/active", map[string]any{"isActive": false})
	b.attend(statut, http.StatusOK, "désactivation", body)

	statut, body = cible.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	cible.attend(statut, http.StatusUnauthorized, "session du compte désactivé", body)

	var actives int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "refresh_tokens" WHERE "userId" = $1 AND "revokedAt" IS NULL`, cibleID).Scan(&actives); err != nil {
		t.Fatal(err)
	}
	if actives != 0 {
		t.Fatalf("%d sessions encore vivantes après désactivation", actives)
	}
	statut, body = cible.connexion(cibleEmail, "motdepasse")
	cible.attend(statut, http.StatusUnauthorized, "reconnexion d’un compte désactivé", body)
}

func TestAdminRepriseDePortefeuilleExigeeEtTracee(t *testing.T) {
	b := adminConnecte(t)
	sortantID, _ := adminCompte(b, "COMMERCIAL")
	repreneurID, _ := adminCompte(b, "COMMERCIAL")
	prospectID := adminProspect(b, sortantID, "CHUES", adminTelephone())

	statut, body := adminAppel(b, http.MethodDelete, "/api/v1/users/"+sortantID, nil)
	b.attend(statut, http.StatusBadRequest, "suppression sans repreneur", body)
	if body["code"] != "HANDOVER_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = adminAppel(b, http.MethodDelete, "/api/v1/users/"+sortantID+"?handoverToId="+b.userID, nil)
	b.attend(statut, http.StatusBadRequest, "repreneur non téléconseiller", body)
	if body["code"] != "HANDOVER_TARGET_INVALID" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = adminAppel(b, http.MethodDelete, "/api/v1/users/"+sortantID+"?handoverToId="+repreneurID, nil)
	b.attend(statut, http.StatusOK, "suppression avec reprise", body)

	var proprietaire string
	var supprimeLe *time.Time
	if err := b.pool.QueryRow(b.ctx, `SELECT "createdById" FROM "prospects" WHERE "id" = $1`, prospectID).Scan(&proprietaire); err != nil {
		t.Fatal(err)
	}
	if proprietaire != repreneurID {
		t.Fatalf("la fiche est restée sur %s", proprietaire)
	}
	if err := b.pool.QueryRow(b.ctx, `SELECT "deletedAt" FROM "users" WHERE "id" = $1`, sortantID).Scan(&supprimeLe); err != nil {
		t.Fatal(err)
	}
	if supprimeLe == nil {
		t.Fatal("le compte n’est pas supprimé logiquement")
	}
	if n := adminCompterAudit(b, "portfolio.handover", sortantID); n != 1 {
		t.Fatalf("%d traces portfolio.handover", n)
	}
	if n := adminCompterAudit(b, "user.delete", sortantID); n != 1 {
		t.Fatalf("%d traces user.delete", n)
	}
}

func TestAdminReinitialisationDuMotDePasse(t *testing.T) {
	b := adminConnecte(t)
	cibleID, cibleEmail := adminCompte(b, "ACCUEIL")
	cible := adminSession(b, cibleEmail)

	statut, body := adminAppel(b, http.MethodPut, "/api/v1/users/"+cibleID+"/password", map[string]any{"password": "court"})
	b.attend(statut, http.StatusUnprocessableEntity, "mot de passe hors bornes", body)

	statut, body = adminAppel(b, http.MethodPut, "/api/v1/users/"+cibleID+"/password", map[string]any{"password": "REDACTED"})
	b.attend(statut, http.StatusOK, "réinitialisation", body)
	if !vraiDe(body["ok"]) {
		t.Fatalf("corps : %v", body)
	}

	statut, body = cible.appel(http.MethodGet, "/api/v1/auth/me", nil, false)
	cible.attend(statut, http.StatusUnauthorized, "session révoquée par la réinitialisation", body)
	statut, body = cible.connexion(cibleEmail, "motdepasse")
	cible.attend(statut, http.StatusUnauthorized, "ancien mot de passe refusé", body)
	statut, body = cible.connexion(cibleEmail, "REDACTED")
	cible.attend(statut, http.StatusOK, "nouveau mot de passe accepté", body)
	if n := adminCompterAudit(b, "user.reset_password", cibleID); n != 1 {
		t.Fatalf("%d traces user.reset_password", n)
	}
}

// Le premier administrateur est le plus ancien encore actif : le compte de test
// se place en tête, sinon la purge lui est refusée.
func adminPremier(b *banc) string {
	b.t.Helper()
	adminExec(b, `UPDATE "users" SET "createdAt" = '1970-01-01 00:00:00' WHERE "id" = $1`, b.userID)
	var username string
	if err := b.pool.QueryRow(b.ctx, `SELECT "username" FROM "users" WHERE "id" = $1`, b.userID).Scan(&username); err != nil {
		b.t.Fatal(err)
	}
	return username
}

func adminCataloguePurge(b *banc, username string) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/admin/purge", nil)
	b.attend(statut, http.StatusOK, "catalogue de purge", body)
	if !vraiDe(body["allowed"]) || body["confirmationHint"] != username {
		b.t.Fatalf("catalogue : allowed %v, hint %v", body["allowed"], body["confirmationHint"])
	}
	domaines, _ := body["domains"].([]any)
	if len(domaines) != 16 {
		b.t.Fatalf("%d domaines exposés, 16 attendus", len(domaines))
	}
	premier, _ := domaines[0].(map[string]any)
	if premier["key"] != "teleconseillers" || premier["label"] == "" || premier["requires"] == nil {
		b.t.Fatalf("premier domaine : %v", premier)
	}
}

func adminCompterTraces(b *banc) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "audit_logs"`).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func TestAdminPurgeConfirmeeEtTraceeApresLesSuppressions(t *testing.T) {
	b := adminConnecte(t)
	username := adminPremier(b)

	adminCataloguePurge(b, username)

	statut, body := adminAppel(b, http.MethodPost, "/api/v1/admin/purge",
		map[string]any{"domains": []string{"journal"}, "confirmation": "pas-le-bon"})
	b.attend(statut, http.StatusUnauthorized, "purge sans la bonne confirmation", body)
	if body["code"] != "PURGE_CONFIRMATION_MISMATCH" {
		t.Fatalf("code : %v", body["code"])
	}

	adminExec(b, `INSERT INTO "audit_logs" ("id","userId","action","entity","entityId") VALUES ($1,$2,'test.semis','database',$2)`,
		uuid.NewString(), b.userID)
	avant := adminCompterTraces(b)
	if avant == 0 {
		t.Fatal("aucune trace à purger")
	}

	statut, body = adminAppel(b, http.MethodPost, "/api/v1/admin/purge",
		map[string]any{"domains": []string{"journal"}, "confirmation": strings.ToUpper(username)})
	b.attend(statut, http.StatusOK, "purge du journal", body)
	supprimes, _ := body["deleted"].([]any)
	if len(supprimes) != 1 {
		t.Fatalf("domaines supprimés : %v", body["deleted"])
	}
	ligne, _ := supprimes[0].(map[string]any)
	if ligne["key"] != "journal" || nombreDe(ligne["rows"]) < float64(avant) {
		t.Fatalf("bilan de purge : %v", ligne)
	}
	if body["purgedAt"] == nil {
		t.Fatalf("horodatage absent : %v", body)
	}

	// La trace de purge est écrite APRÈS les suppressions, dans la même
	// transaction : c'est la seule qui doit rester.
	var action string
	if restantes := adminCompterTraces(b); restantes != 1 {
		t.Fatalf("%d traces restantes, 1 attendue", restantes)
	}
	if err := b.pool.QueryRow(b.ctx, `SELECT "action" FROM "audit_logs"`).Scan(&action); err != nil {
		t.Fatal(err)
	}
	if action != "DATABASE_PURGE" {
		t.Fatalf("trace restante : %s", action)
	}
}

func adminTelecharger(b *banc, chemin string) (statut int, corps []byte) {
	b.t.Helper()
	req, err := http.NewRequestWithContext(b.ctx, http.MethodGet, b.ts.URL+chemin, http.NoBody)
	if err != nil {
		b.t.Fatal(err)
	}
	// Le téléchargement du dump le consomme et le détruit : il exige l'origine
	// comme une écriture, sans quoi un lien suffirait à détruire la sauvegarde.
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if corps, err = io.ReadAll(resp.Body); err != nil {
		b.t.Fatal(err)
	}
	return resp.StatusCode, corps
}

func adminEtatDump(b *banc, attendu string, patience time.Duration) map[string]any {
	b.t.Helper()
	fin := time.Now().Add(patience)
	for {
		statut, body := adminAppel(b, http.MethodGet, "/api/v1/admin/database-dump", nil)
		b.attend(statut, http.StatusOK, "sondage de l’export", body)
		if body["status"] == attendu || body["status"] == "failed" || time.Now().After(fin) {
			return body
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func adminRepertoireVide(t *testing.T, repertoire string) {
	t.Helper()
	entrees, err := os.ReadDir(repertoire)
	if err != nil {
		t.Fatal(err)
	}
	if len(entrees) == 0 {
		return
	}
	noms := make([]string, 0, len(entrees))
	for _, e := range entrees {
		noms = append(noms, filepath.Join(repertoire, e.Name()))
	}
	t.Fatalf("le fichier survit au téléchargement : %v", noms)
}

func TestAdminExportDeLaBaseTelechargePuisDetruit(t *testing.T) {
	// `pg_dump` se connecte par les variables PG* dérivées de DATABASE_URL.
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/cpi_v2_dev?sslmode=disable"
	}
	t.Setenv("DATABASE_URL", dsn)
	b := adminConnecte(t)
	adminDumpDesactive(b)

	repertoire := t.TempDir()
	t.Setenv("DB_DUMP_ENABLED", "true")
	t.Setenv("DB_DUMP_DIR", repertoire)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = $1`, admin.CleDump) })
	adminExec(b, `DELETE FROM "app_settings" WHERE "key" = $1`, admin.CleDump)

	adminDemanderDump(b)
	adminAvisRecu(b)
	adminArchiveTelechargee(b)

	// La destruction suit le dernier octet écrit, côté serveur : elle peut
	// aboutir juste après que le client a fini de lire.
	body := adminEtatDump(b, "expired", 10*time.Second)
	if body["status"] != "expired" || vraiDe(body["downloadable"]) {
		t.Fatalf("état après téléchargement : %v", body)
	}
	adminRepertoireVide(t, repertoire)
	if n := adminCompterAudit(b, "DATABASE_DUMP_DOWNLOADED", b.userID); n != 1 {
		t.Fatalf("%d traces de téléchargement", n)
	}
	statut, archive := adminTelecharger(b, "/api/v1/admin/database-dump/download")
	if statut != http.StatusNotFound {
		t.Fatalf("second téléchargement : statut %d, %s", statut, archive)
	}
}

func adminDumpDesactive(b *banc) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/admin/database-dump", nil)
	b.attend(statut, http.StatusNotFound, "export désactivé", body)
	if body["code"] != "DATABASE_DUMP_DISABLED" {
		b.t.Fatalf("code : %v", body["code"])
	}
}

func adminDemanderDump(b *banc) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/admin/database-dump", nil)
	b.attend(statut, http.StatusAccepted, "demande d’export", body)
	if body["status"] != "queued" && body["status"] != "running" {
		b.t.Fatalf("état initial : %v", body["status"])
	}
	body = adminEtatDump(b, "ready", 90*time.Second)
	if body["status"] != "ready" {
		b.t.Fatalf("export non prêt : %v", body)
	}
	if !vraiDe(body["downloadable"]) || body["sha256"] == nil || body["fileSize"] == nil {
		b.t.Fatalf("état prêt incomplet : %v", body)
	}
	// Un export prêt dont personne n'a été prévenu doit se voir, pas se deviner.
	if body["noticeStatus"] != "INBOX_ONLY" {
		b.t.Fatalf("avis de fin : %v / %v", body["noticeStatus"], body["noticeDetail"])
	}
}

// L'avis de fin n'a qu'un canal : la boîte de réception du panneau.
func adminAvisRecu(b *banc) {
	b.t.Helper()
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "notification_deliveries" WHERE "userId" = $1`, b.userID)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "notifications" WHERE "createdById" = $1`, b.userID)
	})
	var titre string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT n."title" FROM "notification_deliveries" d
		 JOIN "notifications" n ON n."id" = d."notificationId"
		 WHERE d."userId" = $1 AND n."category" = 'SYSTEME'
		 ORDER BY n."createdAt" DESC LIMIT 1`, b.userID).Scan(&titre); err != nil {
		b.t.Fatalf("aucune livraison de l’avis d’export : %v", err)
	}
	if titre != "Export prêt" {
		b.t.Fatalf("avis déposé : %q", titre)
	}
}

func adminArchiveTelechargee(b *banc) {
	b.t.Helper()
	statut, archive := adminTelecharger(b, "/api/v1/admin/database-dump/download")
	if statut != http.StatusOK {
		b.t.Fatalf("téléchargement : statut %d", statut)
	}
	if len(archive) < 2 || archive[0] != 0x1f || archive[1] != 0x8b {
		b.t.Fatalf("l’archive n’est pas un gzip (%d octets)", len(archive))
	}
}

type appelPlateformeRecu struct {
	jeton  string
	limite string
}

func adminPlateformeGrandPublic(telephone string, recu *appelPlateformeRecu) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/integration/v1/clients":
			recu.jeton = r.Header.Get("Authorization")
			recu.limite = r.URL.Query().Get("limite")
			_, _ = w.Write([]byte(`{"data":[{"id":"4242","ref":"CPI-2026-00001","nom":"Awa Diop","email":"awa@example.sn",` +
				`"telephone":"` + telephone + `","etape_dossier":{"numero":2,"libelle":"Dépôt en banque"},` +
				`"inscrit_le":"2026-09-03T13:43:05+00:00","compte":{"statut":"valide"},` +
				`"demande":{"soumise":true,"soumise_le":"2026-09-04T09:00:00+00:00"},"pieces":[]}],"curseur_suivant":null}`))
		case "/integration/v1/suppressions":
			_, _ = w.Write([]byte(`{"data":[],"apres_suivant":null}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func adminInscriptionEcrite(b *banc, prospectID string) {
	b.t.Helper()
	var identifiant, statutDistant string
	var etape *int
	var rapproche *string
	var inscrite *time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "identifiantDistant", "statutDistant", "etapeDistante", "prospectId", "inscriteLe"
		 FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`).
		Scan(&identifiant, &statutDistant, &etape, &rapproche, &inscrite); err != nil {
		b.t.Fatal(err)
	}
	if identifiant != "4242" || statutDistant != "etape-2" || etape == nil || *etape != 2 {
		b.t.Fatalf("ligne écrite : %s %s %v", identifiant, statutDistant, etape)
	}
	if rapproche == nil || *rapproche != prospectID {
		b.t.Fatalf("rapprochement par téléphone manqué : %v", rapproche)
	}
	// « 2026-09-03 13:43:05 » n'a pas de fuseau : lu dans celui de la machine,
	// il changerait de jour.
	if inscrite == nil || inscrite.UTC().Format(time.DateOnly) != "2026-09-03" {
		b.t.Fatalf("date d’inscription : %v", inscrite)
	}
}

func TestAdminTirageEnrolementRapprocheParTelephone(t *testing.T) {
	b := adminConnecte(t)
	telephone := adminTelephone()
	prospectID := adminProspect(b, b.userID, "GRAND_PUBLIC", telephone)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'enrolement.GRAND_PUBLIC'`)
	})
	adminExec(b, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'GRAND_PUBLIC'`)

	recu := &appelPlateformeRecu{}
	plateforme := adminPlateformeGrandPublic(telephone, recu)
	t.Cleanup(plateforme.Close)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_URL", plateforme.URL)
	t.Setenv("PLATEFORME_GRAND_PUBLIC_TOKEN", "jeton-machine")

	adminReglagesLus(b)
	adminTirage(b, 1, 0)
	if recu.jeton != "Bearer jeton-machine" || recu.limite != "500" {
		t.Fatalf("appel plateforme : jeton %q, limite %q", recu.jeton, recu.limite)
	}
	adminInscriptionEcrite(b, prospectID)
	// Rejeu : la même inscription est mise à jour, jamais redéposée.
	adminTirage(b, 0, 1)

	inscrit := adminInscriptionRapprochee(b)
	adminIndicateursEnrolement(b)
	adminReglagesEcrits(b)

	statut, body := adminAppel(b, http.MethodDelete, "/api/v1/enrolement/GRAND_PUBLIC/inscriptions/"+texteDe(inscrit["id"]), nil)
	b.attend(statut, http.StatusOK, "suppression d’une inscription", body)
	statut, body = adminAppel(b, http.MethodDelete, "/api/v1/enrolement/GRAND_PUBLIC/inscriptions/"+texteDe(inscrit["id"]), nil)
	b.attend(statut, http.StatusNotFound, "suppression rejouée", body)
}

func adminReglagesLus(b *banc) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/enrolement/GRAND_PUBLIC/reglages", nil)
	b.attend(statut, http.StatusOK, "réglages", body)
	if !vraiDe(body["configuree"]) || nombreDe(body["frequenceMinutes"]) != 15 {
		b.t.Fatalf("réglages : %v", body)
	}
}

func adminTirage(b *banc, crees, misAJour float64) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/enrolement/GRAND_PUBLIC/tirage", nil)
	b.attend(statut, http.StatusCreated, "tirage", body)
	if body["erreur"] != nil {
		b.t.Fatalf("tirage en erreur : %v", body["erreur"])
	}
	if nombreDe(body["lus"]) != 1 || nombreDe(body["rapproches"]) != 1 {
		b.t.Fatalf("compteurs du tirage : %v", body)
	}
	if nombreDe(body["crees"]) != crees || nombreDe(body["misAJour"]) != misAJour {
		b.t.Fatalf("créations et mises à jour : %v", body)
	}
}

func adminInscriptionRapprochee(b *banc) map[string]any {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/enrolement/GRAND_PUBLIC/inscriptions?rapproche=true", nil)
	b.attend(statut, http.StatusOK, "liste des inscriptions rapprochées", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		b.t.Fatalf("%d inscriptions rapprochées", len(items))
	}
	inscrit, _ := items[0].(map[string]any)
	return inscrit
}

func adminIndicateursEnrolement(b *banc) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodGet, "/api/v1/enrolement/GRAND_PUBLIC/indicateurs?dateFrom=2026-09-01&dateTo=2026-09-30", nil)
	b.attend(statut, http.StatusOK, "indicateurs", body)
	if nombreDe(body["inscriptions"]) != 1 || nombreDe(body["rapprochees"]) != 1 || nombreDe(body["tauxRapprochement"]) != 100 {
		b.t.Fatalf("indicateurs : %v", body)
	}
	etapes, _ := body["parEtape"].([]any)
	if len(etapes) != 1 {
		b.t.Fatalf("répartition par étape : %v", body["parEtape"])
	}
	if etape, _ := etapes[0].(map[string]any); etape["label"] != "Étape 2 · Dépôt en banque" {
		b.t.Fatalf("libellé d’étape : %v", etapes[0])
	}
	if delais, _ := body["delais"].([]any); len(delais) != 2 {
		b.t.Fatalf("délais médians : %v", body["delais"])
	}
	if parJour, _ := body["parJour"].([]any); len(parJour) != 1 {
		b.t.Fatalf("série par jour : %v", body["parJour"])
	}
}

func adminReglagesEcrits(b *banc) {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodPut, "/api/v1/enrolement/GRAND_PUBLIC/reglages",
		map[string]any{"frequenceMinutes": 60, "repriseDepuis": "2026-01-01"})
	b.attend(statut, http.StatusOK, "réglages modifiés", body)
	if nombreDe(body["frequenceMinutes"]) != 60 || body["repriseDepuis"] == nil {
		b.t.Fatalf("réglages : %v", body)
	}
}

func adminPlateformeChuesAdhesionRejetee(demandeID string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/integration/v1/clients":
			_, _ = w.Write([]byte(`{"data":[],"curseur_suivant":null}`))
		case "/integration/v1/prises-de-contact":
			_, _ = w.Write([]byte(`{"data":[{"id":"` + demandeID + `","email":"rejetee@example.sn",` +
				`"prenom":"Awa","nom_famille":"Diop","nom":"Awa Diop","telephone":"+221771234567","statut":"rejected",` +
				`"statut_appel":"unreachable","cree_le":"2026-09-04T15:33:20+00:00","decidee_le":"2026-09-05T19:20:00+00:00",` +
				`"client_ref":null}],"curseur_suivant":null}`))
		case "/integration/v1/suppressions":
			_, _ = w.Write([]byte(`{"data":[],"apres_suivant":null}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func TestAdminTirageEnrolementChuesDemandeRejeteeSansCompteEstNegative(t *testing.T) {
	b := adminConnecte(t)
	demandeID := uuid.NewString()
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'enrolement.CHUES'`)
	})
	adminExec(b, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES'`)

	plateforme := adminPlateformeChuesAdhesionRejetee(demandeID)
	t.Cleanup(plateforme.Close)
	t.Setenv("PLATEFORME_CHUES_URL", plateforme.URL)
	t.Setenv("PLATEFORME_CHUES_TOKEN", "jeton-machine")

	statut, body := adminAppel(b, http.MethodPost, "/api/v1/enrolement/CHUES/tirage", nil)
	b.attend(statut, http.StatusCreated, "tirage CHUES", body)
	if body["erreur"] != nil {
		t.Fatalf("tirage en erreur : %v", body["erreur"])
	}
	if nombreDe(body["crees"]) != 1 {
		t.Fatalf("compteurs du tirage : %v", body)
	}

	var motif *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "motifNegatif" FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES' AND "identifiantDistant" = $1`,
		"adhesion-"+demandeID).Scan(&motif); err != nil {
		t.Fatal(err)
	}
	if motif == nil || *motif != "Refus des deux" {
		t.Fatalf("motif négatif : %v", motif)
	}

	statut, negatifs := adminAppel(b, http.MethodGet, "/api/v1/enrolement/CHUES/inscriptions?negatif=true", nil)
	b.attend(statut, http.StatusOK, "liste des inscriptions négatives", negatifs)
	items, _ := negatifs["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("%d inscriptions négatives : %v", len(items), negatifs)
	}
	if premiere, _ := items[0].(map[string]any); premiere["motifNegatif"] != "Refus des deux" {
		t.Fatalf("motif dans la liste : %v", items[0])
	}
}

func adminPlateformeChuesFlux(compteID, purgeID string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/integration/v1/clients":
			_, _ = w.Write([]byte(`{"data":[{"id":"` + compteID + `","ref":"CHUES-2026-00001","plateforme":"cpi-chues",` +
				`"nom":"Moussa Ndiaye","prenom":"Moussa","nom_famille":"Ndiaye","email":"moussa@example.sn",` +
				`"telephone":"+221770000123","inscrit_le":"2026-09-02T10:00:00+00:00",` +
				`"conseiller":{"id":"c1","nom":"Fatou Sarr","email":"fatou@example.sn"},` +
				`"compte":{"statut":"approved"},"dossier":{"id":"d1","statut":"submitted","soumis_le":"2026-09-06T08:00:00+00:00","decide_le":null},` +
				`"pieces":[{"code":"cni","libelle":"CNI","statut":"validated"}],"prise_de_contact":null}],"curseur_suivant":null}`))
		case "/integration/v1/prises-de-contact":
			_, _ = w.Write([]byte(`{"data":[{"id":"pdc-1","email":"MOUSSA@example.sn","prenom":"Moussa","nom_famille":"Ndiaye",` +
				`"statut":"released","statut_appel":"reached","cree_le":"2026-09-01T09:00:00+00:00","client_ref":"CHUES-2026-00001"}],"curseur_suivant":null}`))
		case "/integration/v1/suppressions":
			_, _ = w.Write([]byte(`{"data":[{"id":7,"client_id":"` + purgeID + `","ref":"CHUES-2026-00002","type":"purge","survenu_le":"2026-09-10T00:00:00+00:00"}],"apres_suivant":null}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// Le flux d'intégration : la fiche porte son dossier, la prise de contact déjà
// devenue compte n'est pas redéposée, et une purge efface la copie du CRM.
func TestAdminTirageEnrolementChuesFluxEtPurge(t *testing.T) {
	b := adminConnecte(t)
	compteID, purgeID := uuid.NewString(), uuid.NewString()
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES'`)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'enrolement.CHUES'`)
	})
	adminExec(b, `DELETE FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES'`)
	adminExec(b, `INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","statutDistant","chargeUtile","dernierTirageAt","updatedAt")
		VALUES ($1,'CHUES',$2,'Purgé','Client','submitted','{"email":"purge@example.sn"}'::jsonb,now(),now())`, uuid.NewString(), purgeID)

	plateforme := adminPlateformeChuesFlux(compteID, purgeID)
	t.Cleanup(plateforme.Close)
	t.Setenv("PLATEFORME_CHUES_URL", plateforme.URL)
	t.Setenv("PLATEFORME_CHUES_TOKEN", "jeton-machine")

	statut, body := adminAppel(b, http.MethodPost, "/api/v1/enrolement/CHUES/tirage", nil)
	b.attend(statut, http.StatusCreated, "tirage CHUES", body)
	if body["erreur"] != nil || nombreDe(body["lus"]) != 1 {
		t.Fatalf("tirage CHUES : %v", body)
	}
	var statutDistant, nom string
	var soumise *time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "statutDistant", "nom", "soumiseLe" FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES' AND "identifiantDistant" = $1`,
		compteID).Scan(&statutDistant, &nom, &soumise); err != nil {
		t.Fatal(err)
	}
	if statutDistant != "submitted" || nom != "Ndiaye" || soumise == nil {
		t.Fatalf("fiche CHUES écrite : %s %s %v", statutDistant, nom, soumise)
	}
	var restantes int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*) FROM "inscriptions_plateforme" WHERE "projet" = 'CHUES' AND "identifiantDistant" = ANY($1)`,
		[]string{purgeID, "adhesion-pdc-1"}).Scan(&restantes); err != nil {
		t.Fatal(err)
	}
	if restantes != 0 {
		t.Fatalf("la purge et la prise de contact rattachée ne doivent laisser aucune ligne : %d", restantes)
	}
}

func TestAdminSupervisionLitLaPresenceBattue(t *testing.T) {
	b := adminConnecte(t)
	teleID, teleEmail := adminCompte(b, "COMMERCIAL")
	_, financeEmail := adminCompte(b, "BANQUE_FINANCE")
	tele := adminSession(b, teleEmail)
	adminSession(b, financeEmail)

	statut, body := adminAppel(tele, http.MethodPost, "/api/v1/presence/beat", nil)
	tele.attend(statut, http.StatusNoContent, "battement de présence", body)
	// Le battement vient d'ouvrir la tranche de l'heure : on la garnit.
	adminExec(b, `INSERT INTO "agent_activity_slots" ("userId","slot","firstSeenAt","lastSeenAt","activeSeconds")
		VALUES ($1, date_trunc('hour', now()), now() - interval '20 minutes', now(), 1200)
		ON CONFLICT ("userId", "slot") DO UPDATE
		SET "firstSeenAt" = EXCLUDED."firstSeenAt", "lastSeenAt" = EXCLUDED."lastSeenAt", "activeSeconds" = 1200`, teleID)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "agent_activity_slots" WHERE "userId" = $1`, teleID) })

	statut, body = adminAppel(b, http.MethodGet, admin.CheminSupervision, nil)
	b.attend(statut, http.StatusOK, "supervision", body)
	adminEnteteSupervision(b, body)
	adminPresenceDuTeleconseiller(b, adminCompteSupervise(b, body, teleID))

	// L'écran est réservé à l'encadrement.
	statut, body = adminAppel(tele, http.MethodGet, admin.CheminSupervision, nil)
	tele.attend(statut, http.StatusForbidden, "supervision lue par un téléconseiller", body)
}

func adminEnteteSupervision(b *banc, body map[string]any) {
	b.t.Helper()
	if nombreDe(body["onlineWindowMinutes"]) != admin.FenetreConnecteMinutes || body["observedAt"] == nil {
		b.t.Fatalf("entête de supervision : %v", body)
	}
	if creneaux, _ := body["shifts"].([]any); len(creneaux) == 0 {
		b.t.Fatalf("créneaux absents : %v", body["shifts"])
	}
	if finances, _ := body["finances"].([]any); len(finances) == 0 {
		b.t.Fatal("le pôle Finances générales n’est pas supervisé")
	}
	counts, _ := body["counts"].(map[string]any)
	if nombreDe(counts["online"]) < 1 {
		b.t.Fatalf("comptage de présence : %v", counts)
	}
}

func adminPresenceDuTeleconseiller(b *banc, compte map[string]any) {
	b.t.Helper()
	if compte["presence"] != "ONLINE" || !vraiDe(compte["hasLiveSession"]) || nombreDe(compte["sessionCount"]) < 1 {
		b.t.Fatalf("présence du téléconseiller : %v", compte)
	}
	if compte["lastPullAt"] == nil || compte["lastSeenAt"] == nil {
		b.t.Fatalf("le battement n’est pas lu : %v", compte)
	}
	if nombreDe(compte["activeSecondsToday"]) != 1200 || nombreDe(compte["activeSecondsInShifts"]) > 1200 {
		b.t.Fatalf("tranches d’activité : %v", compte)
	}
	if compte["firstSeenToday"] == nil {
		b.t.Fatalf("première trace du jour : %v", compte)
	}
	score, _ := compte["score"].(map[string]any)
	if score == nil || (score["value"] == nil && score["reason"] == nil) {
		b.t.Fatalf("note de rendement : %v", compte["score"])
	}
}

func adminCompteSupervise(b *banc, body map[string]any, id string) map[string]any {
	b.t.Helper()
	lignes, _ := body["teleconseillers"].([]any)
	for _, ligne := range lignes {
		compte, _ := ligne.(map[string]any)
		if texteDe(compte["id"]) == id {
			return compte
		}
	}
	b.t.Fatalf("compte %s absent de la supervision", id)
	return nil
}

func TestAdminCreationEtListeDesComptes(t *testing.T) {
	b := adminConnecte(t)
	identifiant := "compte" + strings.ReplaceAll(uuid.NewString()[:8], "-", "")
	corps := map[string]any{
		"email": identifiant + "@cpi.sn", "username": identifiant,
		"fullName": "Fatou Ndiaye", "password": "REDACTED", "phone": "77 123 45 67",
	}
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/users", corps)
	b.attend(statut, http.StatusCreated, "création de compte", body)
	id := texteDe(body["id"])
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	if body["role"] != "COMMERCIAL" || body["phoneE164"] != "+221771234567" || body["prospectCount"].(float64) != 0 {
		t.Fatalf("compte créé : %v", body)
	}

	statut, body = adminAppel(b, http.MethodPost, "/api/v1/users", corps)
	b.attend(statut, http.StatusConflict, "e-mail déjà pris", body)
	if body["code"] != "USER_IDENTIFIER_TAKEN" {
		t.Fatalf("code : %v", body["code"])
	}

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/users?search="+identifiant+"&isActive=true", nil)
	b.attend(statut, http.StatusOK, "liste filtrée", body)
	items, _ := body["items"].([]any)
	meta, _ := body["meta"].(map[string]any)
	if len(items) != 1 || meta["total"].(float64) != 1 || meta["pageSize"].(float64) != 25 {
		t.Fatalf("liste : %v", body)
	}

	statut, body = adminAppel(b, http.MethodPatch, "/api/v1/users/"+id, map[string]any{"fullName": "Fatou Sow", "phone": ""})
	b.attend(statut, http.StatusOK, "modification", body)
	if body["fullName"] != "Fatou Sow" || body["phoneE164"] != nil {
		t.Fatalf("modification : %v", body)
	}
	statut, body = adminAppel(b, http.MethodGet, "/api/v1/users/"+id, nil)
	b.attend(statut, http.StatusOK, "détail", body)
	if body["fullName"] != "Fatou Sow" {
		t.Fatalf("détail : %v", body)
	}
	if n := adminCompterAudit(b, "user.create", id); n != 1 {
		t.Fatalf("%d traces user.create", n)
	}
}

func TestAdminDispositionParEcranEtParCompte(t *testing.T) {
	b := adminConnecte(t)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "dashboard_layouts" WHERE "userId" = $1`, b.userID) })

	statut, body := adminAppel(b, http.MethodPut, "/api/v1/tableaux-de-bord/chues/disposition",
		map[string]any{"widgets": []any{map[string]any{"source": "total-visites"}}})
	b.attend(statut, http.StatusUnprocessableEntity, "source étrangère à l’écran", body)

	statut, body = adminAppel(b, http.MethodPut, "/api/v1/tableaux-de-bord/chues/disposition",
		map[string]any{"widgets": []any{
			map[string]any{"source": "taux-de-rappel"},
			map[string]any{"source": "taux-de-rappel"},
		}})
	b.attend(statut, http.StatusUnprocessableEntity, "source en double", body)

	statut, body = adminAppel(b, http.MethodPut, "/api/v1/tableaux-de-bord/chues/disposition",
		map[string]any{"preset": "complet", "widgets": []any{
			map[string]any{"source": "taux-de-rappel"},
			map[string]any{"source": "par-teleconseiller", "marque": "camembert"},
		}})
	b.attend(statut, http.StatusOK, "enregistrement de la disposition", body)
	if body["source"] != "utilisateur" || body["preset"] != "complet" {
		t.Fatalf("réponse : %v", body)
	}
	widgets, _ := body["widgets"].([]any)
	if len(widgets) != 2 {
		t.Fatalf("%d widgets enregistrés", len(widgets))
	}
	premier, _ := widgets[0].(map[string]any)
	second, _ := widgets[1].(map[string]any)
	if premier["marque"] != "tuile" {
		t.Fatalf("marque par défaut : %v", premier)
	}
	// `camembert` n'est pas compatible avec un tableau : la marque retombe sur
	// le défaut de la source au lieu de casser l'écran.
	if second["marque"] != "tableau" {
		t.Fatalf("marque incompatible non corrigée : %v", second)
	}

	statut, body = adminAppel(b, http.MethodGet, "/api/v1/tableaux-de-bord/chues/disposition", nil)
	b.attend(statut, http.StatusOK, "relecture", body)
	if body["source"] != "utilisateur" || body["updatedAt"] == nil {
		t.Fatalf("relecture : %v", body)
	}

	_, autreEmail := adminCompte(b, "SUPERVISEUR")
	autre := adminSession(b, autreEmail)
	statut, body = adminAppel(autre, http.MethodGet, "/api/v1/tableaux-de-bord/chues/disposition", nil)
	autre.attend(statut, http.StatusOK, "disposition d’un autre compte", body)
	if body["source"] != "usine" {
		t.Fatalf("la disposition d’un autre compte est visible : %v", body["source"])
	}

	statut, body = adminAppel(b, http.MethodDelete, "/api/v1/tableaux-de-bord/chues/disposition", nil)
	b.attend(statut, http.StatusOK, "effacement", body)
	statut, body = adminAppel(b, http.MethodGet, "/api/v1/tableaux-de-bord/chues/disposition", nil)
	b.attend(statut, http.StatusOK, "retour à l’usine", body)
	if body["source"] != "usine" {
		t.Fatalf("source après effacement : %v", body["source"])
	}

	// La disposition posée par l'administrateur s'intercale entre la sienne et
	// celle d'usine, pour tous les comptes.
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = $1`, admin.CleDispositionDefaut("chues"))
	})
	statut, body = adminAppel(b, http.MethodPut, "/api/v1/tableaux-de-bord/chues/disposition/par-defaut",
		map[string]any{"widgets": []any{map[string]any{"source": "joints-non-joints"}}})
	b.attend(statut, http.StatusOK, "disposition par défaut", body)
	if body["source"] != "defaut" {
		t.Fatalf("réponse par défaut : %v", body)
	}
	statut, body = adminAppel(autre, http.MethodGet, "/api/v1/tableaux-de-bord/chues/disposition", nil)
	autre.attend(statut, http.StatusOK, "repli sur la disposition par défaut", body)
	if body["source"] != "defaut" {
		t.Fatalf("le repli par défaut ne joue pas : %v", body["source"])
	}
}
