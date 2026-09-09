//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"math/rand/v2"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

type brevoRecu struct {
	Subject     string              `json:"subject"`
	To          []map[string]string `json:"to"`
	HTMLContent string              `json:"htmlContent"`
	TextContent string              `json:"textContent"`
}

type brevoFactice struct {
	*httptest.Server
	mu     sync.Mutex
	appels []brevoRecu
	delai  time.Duration
}

// Vrai serveur HTTP branché par BREVO_ENDPOINT : le transport passe par
// net/http de bout en bout, ce qu'un double en mémoire ne prouverait pas.
func brevoDeTest(t *testing.T) *brevoFactice {
	t.Helper()
	faux := &brevoFactice{}
	faux.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var recu brevoRecu
		_ = json.NewDecoder(r.Body).Decode(&recu)
		faux.mu.Lock()
		faux.appels = append(faux.appels, recu)
		attente := faux.delai
		faux.mu.Unlock()
		time.Sleep(attente)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"messageId":"<test@cpi>"}`))
	}))
	t.Cleanup(faux.Close)
	t.Setenv("BREVO_ENDPOINT", faux.URL)
	t.Setenv("BREVO_API_KEY", "cle-de-test")
	t.Setenv("BREVO_SENDER_EMAIL", "no-reply@cpi.sn")
	return faux
}

func (f *brevoFactice) pour(sujet string) []brevoRecu {
	f.mu.Lock()
	defer f.mu.Unlock()
	var retenus []brevoRecu
	for _, appel := range f.appels {
		if appel.Subject == sujet {
			retenus = append(retenus, appel)
		}
	}
	return retenus
}

func (b *banc) notificationAppel(method, chemin string, corps any) (statut int, reponse map[string]any) {
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

func (b *banc) notificationCompte(role, email string) string {
	b.t.Helper()
	id := uuid.NewString()
	condensat, err := database.HacherMotDePasse("motdepasse")
	if err != nil {
		b.t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
		 VALUES ($1,$2,$3,$4,$5,$6::"Role",now())`,
		id, email, "notif-"+id, condensat, "Compte "+role, role); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	return id
}

// Enregistré APRÈS la création des comptes : `t.Cleanup` est LIFO, les envois
// partent donc avant les comptes qu'ils référencent.
func (b *banc) notificationPurge(comptes ...string) {
	b.t.Helper()
	tous := append([]string{b.userID}, comptes...)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx,
			`DELETE FROM "notifications" WHERE "createdById" = ANY($1) OR "audienceUserIds" && $1
			 OR "id" IN (SELECT "notificationId" FROM "notification_deliveries" WHERE "userId" = ANY($1))`, tous)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "notification_templates" WHERE "createdById" = ANY($1)`, tous)
	})
}

func (b *banc) notificationLivraison(notificationID, userID string) (statut string, erreur *string, lue *time.Time) {
	b.t.Helper()
	err := b.pool.QueryRow(b.ctx,
		`SELECT "status"::text, "error", "readAt" FROM "notification_deliveries"
		 WHERE "notificationId" = $1 AND "userId" = $2`, notificationID, userID).Scan(&statut, &erreur, &lue)
	if err != nil {
		b.t.Fatalf("livraison %s/%s : %v", notificationID, userID, err)
	}
	return statut, erreur, lue
}

func (b *banc) notificationNombreLivraisons(notificationID string) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "notification_deliveries" WHERE "notificationId" = $1`,
		notificationID).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func (b *banc) notificationStatut(id string) string {
	b.t.Helper()
	var statut string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "status"::text FROM "notifications" WHERE "id" = $1`, id).Scan(&statut); err != nil {
		b.t.Fatal(err)
	}
	return statut
}

func (b *banc) notificationService() *socle.Deps {
	b.t.Helper()
	cfg, err := socle.LireConfig()
	if err != nil {
		b.t.Fatal(err)
	}
	s := nouveauDeps(b.pool, cfg)
	return s
}

func (b *banc) notificationAdminConnecte() {
	b.t.Helper()
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion admin", body)
}

func TestNotificationCompositionEcritUneLivraisonParDestinataireVise(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	vise := b.notificationCompte("COMMERCIAL", "vise-"+uuid.NewString()+"@cpi.sn")
	horsPublic := b.notificationCompte("ACCUEIL", "hors-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(vise, horsPublic)
	b.notificationAdminConnecte()

	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notifications", map[string]any{
		"title": "Réunion de plateau", "body": "Rendez-vous à 9h.",
		"audience": "USERS", "audienceUserIds": []string{vise},
	})
	b.attend(statut, http.StatusCreated, "composition immédiate", body)
	id := body["id"].(string)

	if n := b.notificationNombreLivraisons(id); n != 1 {
		t.Fatalf("une livraison par destinataire visé : %d écrites", n)
	}
	b.notificationLivraison(id, vise)
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "notification_deliveries" WHERE "notificationId" = $1 AND "userId" = $2`,
		id, horsPublic).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("un compte hors public a reçu %d livraison(s)", n)
	}
}

func TestNotificationProgrammeePuisAnnuleeNestJamaisExpediee(t *testing.T) {
	faux := brevoDeTest(t)
	b := nouveauBanc(t, "ADMIN")
	destinataire := b.notificationCompte("COMMERCIAL", "prog-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(destinataire)
	b.notificationAdminConnecte()

	sujet := "Annonce programmée " + uuid.NewString()
	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notifications", map[string]any{
		"title": sujet, "body": "Ne doit jamais partir.",
		"audience": "USERS", "audienceUserIds": []string{destinataire},
		"scheduledFor": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
	})
	b.attend(statut, http.StatusCreated, "composition programmée", body)
	id := body["id"].(string)
	if got := b.notificationStatut(id); got != "SCHEDULED" {
		t.Fatalf("statut après programmation : %s", got)
	}

	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/notifications/"+id+"/cancel", nil)
	b.attend(statut, http.StatusCreated, "annulation", body)
	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/notifications/"+id+"/cancel", nil)
	b.attend(statut, http.StatusConflict, "seconde annulation", body)
	if body["code"] != "NOTIFICATION_NOT_SCHEDULED" {
		t.Fatalf("code : %v", body["code"])
	}

	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "notifications" SET "scheduledFor" = now() - interval '5 minutes' WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}
	if err := notifications.ExpedierDues(b.ctx, b.notificationService()); err != nil {
		t.Fatal(err)
	}
	if got := b.notificationStatut(id); got != "CANCELLED" {
		t.Fatalf("une notification annulée a été reprise : %s", got)
	}
	if etat, _, _ := b.notificationLivraison(id, destinataire); etat != "PENDING" {
		t.Fatalf("livraison d'un envoi annulé : %s", etat)
	}
	if appels := faux.pour(sujet); len(appels) != 0 {
		t.Fatalf("%d e-mail(s) partis pour un envoi annulé", len(appels))
	}
}

func TestNotificationDeuxExpediteursConcurrentsNenvoientQuUneFois(t *testing.T) {
	faux := brevoDeTest(t)
	b := nouveauBanc(t, "ADMIN")
	destinataire := b.notificationCompte("COMMERCIAL", "concurrent-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(destinataire)
	b.notificationAdminConnecte()

	sujet := "Vague unique " + uuid.NewString()
	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notifications", map[string]any{
		"title": sujet, "body": "Une seule remise attendue.",
		"audience": "USERS", "audienceUserIds": []string{destinataire},
		"scheduledFor": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
	})
	b.attend(statut, http.StatusCreated, "composition programmée", body)
	id := body["id"].(string)
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "notifications" SET "scheduledFor" = now() - interval '5 minutes' WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}

	// Brevo tient la ligne le temps que le second expéditeur lise : sans ce
	// délai les deux passages se suivent au lieu de se chevaucher, et le test
	// ne prouverait plus rien du bail.
	faux.mu.Lock()
	faux.delai = 300 * time.Millisecond
	faux.mu.Unlock()

	s := b.notificationService()
	depart := make(chan struct{})
	var attente sync.WaitGroup
	tenues := make([]bool, 2)
	erreurs := make([]error, 2)
	maintenant := time.Now()
	for i := range 2 {
		attente.Add(1)
		go func() {
			defer attente.Done()
			<-depart
			pris, err := notifications.Expedier(b.ctx, s, []string{id}, maintenant)
			tenues[i], erreurs[i] = pris[id], err
		}()
	}
	close(depart)
	attente.Wait()
	for _, err := range erreurs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if tenues[0] == tenues[1] {
		t.Fatalf("un seul expéditeur doit tenir le bail : %v", tenues)
	}
	if appels := faux.pour(sujet); len(appels) != 1 {
		t.Fatalf("le bail doit rendre l'expédition unique : %d appel(s) Brevo", len(appels))
	}
	if etat, _, _ := b.notificationLivraison(id, destinataire); etat != "SENT" {
		t.Fatalf("livraison après expédition : %s", etat)
	}
}

func TestNotificationLectureHorodateEtBoiteNeMontreQueLesSiennes(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	autre := b.notificationCompte("SUPERVISEUR", "autre-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(autre)
	b.notificationAdminConnecte()

	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notifications", map[string]any{
		"title": "Note interne", "body": "Pour deux comptes.",
		"audience": "USERS", "audienceUserIds": []string{b.userID, autre},
	})
	b.attend(statut, http.StatusCreated, "composition", body)
	id := body["id"].(string)

	statut, body = b.notificationAppel(http.MethodGet, "/api/v1/notifications/mine?page=1&pageSize=50", nil)
	b.attend(statut, http.StatusOK, "boîte de réception", body)
	for _, item := range body["items"].([]any) {
		ligne := item.(map[string]any)
		lue, _ := ligne["isRead"].(bool)
		if ligne["notificationId"] == id && lue {
			t.Fatal("une notification neuve ne peut pas être lue")
		}
	}
	if body["unreadCount"].(float64) < 1 {
		t.Fatalf("compteur de non lues : %v", body["unreadCount"])
	}

	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/notifications/"+id+"/read", nil)
	b.attend(statut, http.StatusCreated, "marquage lu", body)
	if _, _, lue := b.notificationLivraison(id, b.userID); lue == nil {
		t.Fatal("readAt non écrit sur la livraison de l'appelant")
	}
	if _, _, lueAutre := b.notificationLivraison(id, autre); lueAutre != nil {
		t.Fatal("la lecture d'un compte a horodaté la livraison d'un autre")
	}

	statut, body = b.notificationAppel(http.MethodGet, "/api/v1/notifications/mine?unreadOnly=true&page=1&pageSize=50", nil)
	b.attend(statut, http.StatusOK, "boîte filtrée sur les non lues", body)
	for _, item := range body["items"].([]any) {
		if item.(map[string]any)["notificationId"] == id {
			t.Fatal("une notification lue reste dans le filtre « non lues »")
		}
	}
}

func TestNotificationGabaritRenduAvecSesVariables(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.notificationPurge()
	b.notificationAdminConnecte()

	nom := "Relance " + uuid.NewString()
	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notification-templates", map[string]any{
		"name": nom, "titleTemplate": "Bonjour {{nom}}",
		"bodyTemplate": "Vous avez {{nombre}} dossier(s) et {{reste}}.",
	})
	b.attend(statut, http.StatusCreated, "création du gabarit", body)
	id := body["id"].(string)
	variables := body["variables"].([]any)
	if len(variables) != 3 || variables[0] != "nom" {
		t.Fatalf("variables déduites du texte : %v", variables)
	}

	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/notification-templates/"+id+"/render", map[string]any{
		"variables": map[string]string{"nom": "Awa", "nombre": "4"},
	})
	b.attend(statut, http.StatusCreated, "rendu", body)
	if body["title"] != "Bonjour Awa" {
		t.Fatalf("titre rendu : %v", body["title"])
	}
	if body["body"] != "Vous avez 4 dossier(s) et {{reste}}." {
		t.Fatalf("le marqueur d'une variable absente doit rester visible : %v", body["body"])
	}
	manquantes := body["missing"].([]any)
	if len(manquantes) != 1 || manquantes[0] != "reste" {
		t.Fatalf("variables manquantes : %v", manquantes)
	}

	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/notification-templates", map[string]any{
		"name": nom, "titleTemplate": "x", "bodyTemplate": "y",
	})
	b.attend(statut, http.StatusConflict, "nom déjà pris", body)
	if body["code"] != "NOTIFICATION_TEMPLATE_NAME_CONFLICT" {
		t.Fatalf("code : %v", body["code"])
	}
}

func TestNotificationRappelQuotidienIdempotentSurLaPeriode(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	b.notificationPurge()
	s := b.notificationService()

	for range 2 {
		if err := notifications.CompteRenduQuotidien(b.ctx, s); err != nil {
			t.Fatal(err)
		}
	}
	cle := "daily-report:" + b.userID
	periode := notifications.JourNotification(s, time.Now())
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*)::int FROM "notifications" WHERE "reminderKey" = $1 AND "period" = $2`,
		cle, periode).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("(reminderKey, period) doit tenir le rappel à un seul envoi : %d", n)
	}
	var titre string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "title" FROM "notifications" WHERE "reminderKey" = $1 AND "period" = $2`,
		cle, periode).Scan(&titre); err != nil {
		t.Fatal(err)
	}
	if titre != "Compte rendu du "+periode {
		t.Fatalf("titre du compte rendu : %q", titre)
	}
}

// Une session de plus sur le même serveur : `notificationCompte` pose un
// condensat argon2 utilisable, le compte peut donc se connecter.
func (b *banc) notificationSession(userID, email string) *banc {
	b.t.Helper()
	jar, _ := cookiejar.New(nil)
	autre := &banc{
		t: b.t, ctx: b.ctx, pool: b.pool, ts: b.ts, userID: userID, email: email,
		client: &http.Client{Jar: jar},
	}
	statut, body := autre.connexion(email, "motdepasse")
	autre.attend(statut, http.StatusOK, "connexion "+email, body)
	return autre
}

func (b *banc) notificationParTitre(titre string) (id, route, categorie string) {
	b.t.Helper()
	err := b.pool.QueryRow(b.ctx,
		`SELECT "id", COALESCE("route", ''), "category"::text FROM "notifications"
		 WHERE "title" = $1 ORDER BY "createdAt" DESC, "id" DESC LIMIT 1`,
		titre).Scan(&id, &route, &categorie)
	if err != nil {
		b.t.Fatalf("notification « %s » : %v", titre, err)
	}
	return id, route, categorie
}

// Un numéro sénégalais libre : l'index partiel d'unicité refuse un doublon, et
// deux exécutions de suite ne doivent pas se marcher dessus.
func notificationNumeroDeTest() string {
	chiffres := strconv.FormatInt(rand.Int64N(10_000_000), 10)
	return "77" + strings.Repeat("0", 7-len(chiffres)) + chiffres
}

// Les référentiels que le formulaire CHUES exige : banque, syndicat, tranche de
// revenu. Noms tirés de l'identifiant, deux tests peuvent tourner de suite.
func (b *banc) notificationReferentiels() (banque, syndicat, revenu string) {
	b.t.Helper()
	banque, syndicat, revenu = uuid.NewString(), uuid.NewString(), uuid.NewString()
	ecrire := func(sql string, args ...any) {
		if _, err := b.pool.Exec(b.ctx, sql, args...); err != nil {
			b.t.Fatal(err)
		}
	}
	ecrire(`INSERT INTO "banques" ("id","name","shortName","updatedAt") VALUES ($1,$2,$3,now())`,
		banque, "Banque avis "+banque[:8], "BA"+banque[:6])
	ecrire(`INSERT INTO "syndicats" ("id","name","sigle","updatedAt") VALUES ($1,$2,$2,now())`,
		syndicat, "Syndicat "+syndicat[:8])
	ecrire(`INSERT INTO "income_bands" ("id","code","label","updatedAt") VALUES ($1,$2,$2,now())`,
		revenu, "REV-"+revenu[:8])
	b.t.Cleanup(func() {
		for _, ordre := range []struct {
			sql string
			id  string
		}{
			{`DELETE FROM "income_bands" WHERE "id" = $1`, revenu},
			{`DELETE FROM "syndicats" WHERE "id" = $1`, syndicat},
			{`DELETE FROM "banques" WHERE "id" = $1`, banque},
		} {
			_, _ = b.pool.Exec(b.ctx, ordre.sql, ordre.id)
		}
	})
	return banque, syndicat, revenu
}

func TestNotificationAvisDepotFormulairePublic(t *testing.T) {
	t.Setenv("TURNSTILE_ALLOW_DEGRADED", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	superviseur := b.notificationCompte("SUPERVISEUR", "sup-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(superviseur)
	banque, syndicat, revenu := b.notificationReferentiels()
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "createdById" = $1`, b.userID) })

	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/formulaire-public/"+b.userID, map[string]any{
		"nom": "Sow", "prenom": "Fatou", "phone": notificationNumeroDeTest(),
		"profession": "Enseignante", "dureeEtablissementMois": 24, "fonctionnaire": true,
		"syndicatId": syndicat, "banqueId": banque, "engagementEnCours": false, "incomeBandId": revenu,
	})
	b.attend(statut, http.StatusCreated, "dépôt public", body)

	var prospect string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "prospects" WHERE "createdById" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
		b.userID).Scan(&prospect); err != nil {
		t.Fatal(err)
	}
	id, route, categorie := b.notificationParTitre("Demande reçue du formulaire public : Fatou Sow")
	if route != "/chues/prospects/"+prospect || categorie != "SYSTEME" {
		t.Fatalf("route et catégorie de l'avis : %s / %s", route, categorie)
	}
	// L'encadrement et le compte qui a partagé le lien, tous deux dans la boîte.
	for _, compte := range []string{b.userID, superviseur} {
		if etat, _, _ := b.notificationLivraison(id, compte); etat == "" {
			t.Fatalf("livraison manquante pour %s", compte)
		}
	}
}

func TestNotificationAvisDemandeClientBanque(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	demandeurEmail := "banque-" + uuid.NewString() + "@cpi.sn"
	demandeur := b.notificationCompte("BANQUE_FINANCE", demandeurEmail)
	b.notificationPurge(demandeur)
	banque, syndicat, _ := b.notificationReferentiels()
	region, departement, representant := uuid.NewString(), uuid.NewString(), uuid.NewString()
	ecrire := func(sql string, args ...any) {
		if _, err := b.pool.Exec(b.ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	ecrire(`INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$2,$2,now())`, region, region[:8])
	ecrire(`INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$2,$2,$3,now())`,
		departement, departement[:8], region)
	ecrire(`INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
		VALUES ($1,'Représentant avis',$2,$3,$4,now(),now())`, representant, "+2217"+representant[:8], departement, b.userID)
	t.Cleanup(func() {
		for _, ordre := range []struct {
			sql string
			id  string
		}{
			{`DELETE FROM "client_creation_requests" WHERE "requestedById" = $1`, demandeur},
			{`DELETE FROM "prospects" WHERE "representantId" = $1`, representant},
			{`DELETE FROM "representants" WHERE "id" = $1`, representant},
			{`DELETE FROM "departements" WHERE "id" = $1`, departement},
			{`DELETE FROM "regions" WHERE "id" = $1`, region},
		} {
			_, _ = b.pool.Exec(b.ctx, ordre.sql, ordre.id)
		}
	})

	agent := b.notificationSession(demandeur, demandeurEmail)
	statut, body := agent.notificationAppel(http.MethodPost, "/api/v1/client-requests", map[string]any{
		"nom": "Ba", "prenom": "Moussa",
		"phone": notificationNumeroDeTest(), "banqueId": banque,
	})
	b.attend(statut, http.StatusCreated, "dépôt de la demande", body)
	demande := body["id"].(string)

	depot, route, categorie := b.notificationParTitre("Demande de création de client")
	if route != "/demandes-clients" || categorie != "SYSTEME" {
		t.Fatalf("route et catégorie du dépôt : %s / %s", route, categorie)
	}
	if etat, _, _ := b.notificationLivraison(depot, b.userID); etat == "" {
		t.Fatal("le dépôt doit atteindre les ADMIN")
	}

	b.notificationAdminConnecte()
	statut, body = b.notificationAppel(http.MethodPost, "/api/v1/client-requests/"+demande+"/approve",
		map[string]any{"representantId": representant, "syndicatId": syndicat})
	b.attend(statut, http.StatusOK, "approbation", body)

	arbitrage, route, _ := b.notificationParTitre("Client créé")
	if route != "/dossiers" {
		t.Fatalf("route de l'arbitrage : %s", route)
	}
	if etat, _, _ := b.notificationLivraison(arbitrage, demandeur); etat == "" {
		t.Fatal("le demandeur doit être averti de l'arbitrage")
	}
}

func TestNotificationEmailReserveAuTeleconseiller(t *testing.T) {
	faux := brevoDeTest(t)
	b := nouveauBanc(t, "ADMIN")
	emailCommercial := "tc-" + uuid.NewString() + "@cpi.sn"
	commercial := b.notificationCompte("COMMERCIAL", emailCommercial)
	superviseur := b.notificationCompte("SUPERVISEUR", "sup-"+uuid.NewString()+"@cpi.sn")
	b.notificationPurge(commercial, superviseur)
	b.notificationAdminConnecte()

	sujet := "Consigne du jour " + uuid.NewString()
	statut, body := b.notificationAppel(http.MethodPost, "/api/v1/notifications", map[string]any{
		"title": sujet, "body": "À lire avant la prise de poste.",
		"audience": "USERS", "audienceUserIds": []string{commercial, superviseur},
	})
	b.attend(statut, http.StatusCreated, "composition immédiate", body)
	id := body["id"].(string)

	appels := faux.pour(sujet)
	if len(appels) != 1 {
		t.Fatalf("un seul appel Brevo attendu, %d reçu(s)", len(appels))
	}
	if len(appels[0].To) != 1 || appels[0].To[0]["email"] != emailCommercial {
		t.Fatalf("seul le téléconseiller est servi par e-mail : %v", appels[0].To)
	}
	if etat, _, _ := b.notificationLivraison(id, commercial); etat != "SENT" {
		t.Fatalf("livraison du téléconseiller : %s", etat)
	}
	etat, erreur, _ := b.notificationLivraison(id, superviseur)
	if etat != "PENDING" || erreur == nil || *erreur != "INBOX_ONLY" {
		t.Fatalf("le superviseur lit dans l'application : %s / %v", etat, erreur)
	}
	if got := b.notificationStatut(id); got != "SENT" {
		t.Fatalf("l'envoi doit se refermer une fois tout tranché : %s", got)
	}
}
