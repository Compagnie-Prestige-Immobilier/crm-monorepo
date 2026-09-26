//go:build integration

package main

import (
	"bytes"
	"cpi-go/internal/prospects"
	"cpi-go/internal/shared/database"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// Les corps de ce domaine portent des nombres, des objets et des `null` : le
// `map[string]string` du banc d'authentification ne les exprime pas.
func appelJSON(b *banc, method, chemin string, corps any, entetes map[string]string) (statut int, reponse map[string]any) {
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
	for cle, valeur := range entetes {
		req.Header.Set(cle, valeur)
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

// Comparaison par le rendu : un corps JSON décodé porte ses nombres en float64,
// et chaque test réécrirait sinon la même cascade de conversions.
func exigerChampsJSON(b *banc, vu map[string]any, attendus map[string]string, quoi string) {
	b.t.Helper()
	for cle, valeur := range attendus {
		if fmt.Sprint(vu[cle]) != valeur {
			b.t.Fatalf("%s : %s vaut %v, attendu %q", quoi, cle, vu[cle], valeur)
		}
	}
}

func connecte(b *banc) {
	b.t.Helper()
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
}

// Un second compte, avec sa propre session : le cloisonnement ne se prouve
// qu'entre deux téléconseillers distincts.
func autreCompte(b *banc, role string) *banc {
	b.t.Helper()
	id := uuid.NewString()
	email := "test-" + id + "@cpi.sn"
	condensat, _ := database.HacherMotDePasse("motdepasse")
	_, err := b.pool.Exec(b.ctx,
		`INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())`,
		id, email, "test-"+id, condensat, "Autre "+role, role)
	if err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	jar, _ := cookiejar.New(nil)
	autre := &banc{t: b.t, ctx: b.ctx, pool: b.pool, ts: b.ts, client: &http.Client{Jar: jar}, userID: id, email: email}
	connecte(autre)
	return autre
}

func nettoyerProspects(b *banc, userIDs ...string) {
	b.t.Cleanup(func() {
		for _, id := range userIDs {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "userId" = $1`, id)
			_, _ = b.pool.Exec(b.ctx,
				`DELETE FROM "call_attempts" WHERE "prospectId" IN (SELECT "id" FROM "prospects" WHERE "createdById" = $1)`, id)
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "createdById" = $1`, id)
		}
	})
}

// Le formulaire public n'exige que ce que l'administrateur a réglé : le
// catalogue d'usine rend obligatoires la banque, le syndicat et le revenu, que
// ce dépôt de test ne peuple pas. Le réglage précédent est remis en place.
func reglagesPublicsSansObligation(b *banc) {
	b.t.Helper()
	cle := "conversion.champs.CHUES"
	var avant *string
	if err := b.pool.QueryRow(b.ctx, `SELECT "value" FROM "app_settings" WHERE "key" = $1`, cle).Scan(&avant); err != nil {
		avant = nil
	}
	champs := make([]map[string]any, 0, len(prospects.FormulaireChampsPublics))
	for _, champ := range prospects.FormulaireChampsPublics {
		champs = append(champs, map[string]any{"champ": champ, "visible": true, "obligatoire": false})
	}
	valeur, err := json.Marshal(map[string]any{"champs": champs, "libres": []any{}})
	if err != nil {
		b.t.Fatal(err)
	}
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "app_settings" ("key","value","updatedAt") VALUES ($1,$2,now())
		 ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`, cle, string(valeur)); err != nil {
		b.t.Fatal(err)
	}
	b.t.Cleanup(func() {
		if avant == nil {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = $1`, cle)
			return
		}
		_, _ = b.pool.Exec(b.ctx, `UPDATE "app_settings" SET "value" = $2 WHERE "key" = $1`, cle, *avant)
	})
}

func creerProspect(b *banc, nom, telephone string) map[string]any {
	b.t.Helper()
	corps := map[string]any{"nom": nom, "phone": telephone}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects", corps, nil)
	b.attend(statut, http.StatusCreated, "création de "+nom, body)
	return body
}

// Un numéro de test qui reste valide pour libphonenumber : 77 puis 7 chiffres.
func numeroSenegalais(suffixe int) string {
	return "+2217712345" + string(rune('0'+suffixe/10%10)) + string(rune('0'+suffixe%10))
}

func TestProspectDoublonNommeLeProprietaire(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	autre := autreCompte(b, "COMMERCIAL")
	nettoyerProspects(b, b.userID, autre.userID)

	telephone := numeroSenegalais(11)
	creerProspect(b, "Diallo", telephone)

	statut, body := appelJSON(autre, http.MethodPost, "/api/v1/prospects",
		map[string]any{"nom": "Diallo bis", "phone": telephone}, nil)
	autre.attend(statut, http.StatusConflict, "doublon de numéro", body)
	if body["code"] != "PROSPECT_PHONE_CONFLICT" {
		t.Fatalf("code : %v", body["code"])
	}
	existante := chargeUtile(t, body)
	if existante["ownedByCommercialName"] != "Test Intégration" {
		t.Fatalf("le 409 doit nommer le propriétaire : %v", existante)
	}
	if _, visible := existante["nom"]; visible {
		t.Fatalf("l’identité d’une fiche d’autrui ne sort pas : %v", existante)
	}

	statut, body = appelJSON(b, http.MethodPost, "/api/v1/prospects",
		map[string]any{"nom": "Diallo ter", "phone": telephone}, nil)
	b.attend(statut, http.StatusConflict, "doublon sur sa propre fiche", body)
	if sienne := chargeUtile(t, body); sienne["nom"] != "Diallo" {
		t.Fatalf("le propriétaire doit voir sa fiche : %v", sienne)
	}
}

func chargeUtile(t *testing.T, body map[string]any) map[string]any {
	t.Helper()
	erreurs, ok := body["errors"].([]any)
	if !ok || len(erreurs) == 0 {
		t.Fatalf("le corps doit porter errors[] : %v", body)
	}
	detail, ok := erreurs[0].(map[string]any)
	if !ok {
		t.Fatalf("errors[0] illisible : %v", erreurs[0])
	}
	valeur, ok := detail["value"].(map[string]any)
	if !ok {
		t.Fatalf("errors[0].value illisible : %v", detail)
	}
	return valeur
}

func TestProspectPorteeDeLecture(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	autre := autreCompte(b, "COMMERCIAL")
	charge := autreCompte(b, "CHARGE_CLIENTELE")
	nettoyerProspects(b, b.userID, autre.userID, charge.userID)

	fiche := creerProspect(b, "Ndiaye", numeroSenegalais(12))
	id := fiche["id"].(string)

	statut, body := appelJSON(autre, http.MethodGet, "/api/v1/prospects/"+id, nil, nil)
	autre.attend(statut, http.StatusForbidden, "fiche d’un autre téléconseiller", body)
	if body["code"] != "NOT_OWNER" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = appelJSON(charge, http.MethodGet, "/api/v1/prospects/"+id, nil, nil)
	charge.attend(statut, http.StatusForbidden, "fiche non convertie d’un autre", body)

	if _, err := b.pool.Exec(b.ctx, `UPDATE "prospects" SET "statut" = 'CONVERTI' WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}
	statut, body = appelJSON(charge, http.MethodGet, "/api/v1/prospects/"+id, nil, nil)
	charge.attend(statut, http.StatusOK, "demande convertie relue par le chargé de clientèle", body)
	statut, body = appelJSON(autre, http.MethodGet, "/api/v1/prospects/"+id, nil, nil)
	autre.attend(statut, http.StatusForbidden, "le COMMERCIAL voisin reste dehors", body)
}

func TestProspectTransitionDeStatutRefusee(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	id := creerProspect(b, "Sow", numeroSenegalais(13))["id"].(string)

	statut, body := appelJSON(b, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"statut": "CONVERTI"}, nil)
	b.attend(statut, http.StatusForbidden, "NOUVEAU vers CONVERTI", body)
	if body["code"] != "PROSPECT_STATUT_TRANSITION_REFUSED" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = appelJSON(b, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"statut": "CONTACTE"}, nil)
	b.attend(statut, http.StatusOK, "NOUVEAU vers CONTACTE", body)

	statut, body = appelJSON(b, http.MethodPatch, "/api/v1/prospects/"+id, map[string]any{"statut": "CONVERTI"}, nil)
	b.attend(statut, http.StatusForbidden, "conversion par PATCH", body)
	if body["code"] != "PROSPECT_CONVERSION_REQUIRES_CONFIRMATION" {
		t.Fatalf("code : %v", body["code"])
	}
	var enBase string
	if err := b.pool.QueryRow(b.ctx, `SELECT "statut" FROM "prospects" WHERE "id" = $1`, id).Scan(&enBase); err != nil {
		t.Fatal(err)
	}
	if enBase != "CONTACTE" {
		t.Fatalf("la fiche ne doit pas avoir bougé : %s", enBase)
	}
}

func TestProspectConversionGrandPublicExigeLeConsentement(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	id := creerProspect(b, "Ba", numeroSenegalais(14))["id"].(string)

	// Libellé et code uniques : la table les indexe tous deux, et l'offre reste
	// retenue par la conversion signée tant que la fiche vit.
	offre := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "offers" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`,
		offre, "TEST-"+offre[:8], "Offre test "+offre[:8]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx,
			`DELETE FROM "prospect_conversions" WHERE "journeyId" IN (SELECT "id" FROM "prospect_journeys" WHERE "prospectId" = $1)`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "offers" WHERE "id" = $1`, offre)
	})

	chemin := "/api/v1/prospects/" + id + "/parcours/grand-public/conversion"
	statut, body := appelJSON(b, http.MethodPost, chemin, map[string]any{"offerId": offre}, nil)
	b.attend(statut, http.StatusBadRequest, "conversion sans parcours Grand Public", body)
	if body["code"] != "GRAND_PUBLIC_CONSENT_REQUIRED" {
		t.Fatalf("code : %v", body["code"])
	}

	consentement := "/api/v1/prospects/" + id + "/parcours/grand-public/consentement"
	statut, body = appelJSON(b, http.MethodPatch, consentement, map[string]any{"consent": "REFUSE"}, nil)
	b.attend(statut, http.StatusOK, "refus consigné", body)
	statut, body = appelJSON(b, http.MethodPost, chemin, map[string]any{"offerId": offre}, nil)
	b.attend(statut, http.StatusBadRequest, "conversion après refus", body)

	statut, body = appelJSON(b, http.MethodPatch, consentement, map[string]any{"consent": "INTERESSE"}, nil)
	b.attend(statut, http.StatusOK, "accord consigné", body)
	statut, body = appelJSON(b, http.MethodPost, chemin,
		map[string]any{"offerId": offre, "paymentMode": "COMPTANT", "amountXof": 150000}, nil)
	b.attend(statut, http.StatusOK, "conversion Grand Public", body)
	if body["statut"] != "CONVERTI" {
		t.Fatalf("la fiche doit être convertie : %v", body["statut"])
	}
	var conversions int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*) FROM "prospect_conversions" c JOIN "prospect_journeys" j ON j."id" = c."journeyId" WHERE j."prospectId" = $1`,
		id).Scan(&conversions); err != nil {
		t.Fatal(err)
	}
	if conversions != 1 {
		t.Fatalf("une conversion signée doit exister : %d", conversions)
	}
}

func TestProspectRequalificationParLEncadrement(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	superviseur := autreCompte(b, "SUPERVISEUR")
	nettoyerProspects(b, b.userID, superviseur.userID)
	id := creerProspect(b, "Sow", numeroSenegalais(21))["id"].(string)
	consentement := "/api/v1/prospects/" + id + "/parcours/grand-public/consentement"
	statut, body := appelJSON(b, http.MethodPatch, consentement, map[string]any{"consent": "REFUSE"}, nil)
	b.attend(statut, http.StatusOK, "refus consigné", body)
	if _, err := b.pool.Exec(b.ctx,
		`UPDATE "prospect_journeys" SET "statut" = 'PERDU' WHERE "prospectId" = $1 AND "projet" = 'GRAND_PUBLIC'`, id); err != nil {
		t.Fatal(err)
	}

	statut, body = appelJSON(superviseur, http.MethodPut, "/api/v1/prospects/"+id+"/methode", map[string]any{"methode": "PLATFORM"}, nil)
	superviseur.attend(statut, http.StatusOK, "méthode du projet principal", body)

	chemin := "/api/v1/prospects/" + id + "/requalifier"
	corps := map[string]any{"projet": "GRAND_PUBLIC", "statut": "NOUVEAU"}
	statut, body = appelJSON(b, http.MethodPost, chemin, corps, nil)
	b.attend(statut, http.StatusForbidden, "requalification hors encadrement", body)
	statut, body = appelJSON(superviseur, http.MethodPost, chemin, corps, nil)
	superviseur.attend(statut, http.StatusOK, "requalification par le superviseur", body)

	var etat, consent, phase2 string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "statut"::text, "consent"::text, "phase2Status"::text FROM "prospect_journeys" WHERE "prospectId" = $1 AND "projet" = 'GRAND_PUBLIC'`,
		id).Scan(&etat, &consent, &phase2); err != nil {
		t.Fatal(err)
	}
	if etat != "NOUVEAU" || consent != "NON_DEMANDE" || phase2 != "PENDING" {
		t.Fatalf("le parcours doit revenir à traiter : %s, %s, %s", etat, consent, phase2)
	}
	var remise *time.Time
	var methode *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "remiseATraiterAt", "phase2Status"::text, "enrollmentMethod"::text FROM "prospects" WHERE "id" = $1`,
		id).Scan(&remise, &phase2, &methode); err != nil {
		t.Fatal(err)
	}
	if remise == nil {
		t.Fatal("la fiche doit revenir dans le reste à appeler")
	}
	if phase2 != "METHOD_OBTAINED" || methode == nil || *methode != "PLATFORM" {
		t.Fatalf("le projet principal garde sa méthode : %s, %v", phase2, methode)
	}
}

func TestProspectMethodeModifieeParLEncadrement(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	superviseur := autreCompte(b, "SUPERVISEUR")
	nettoyerProspects(b, b.userID, superviseur.userID)
	id := creerProspect(b, "Ba", numeroSenegalais(22))["id"].(string)
	chemin := "/api/v1/prospects/" + id + "/methode"

	statut, body := appelJSON(b, http.MethodPut, chemin, map[string]any{"methode": "PLATFORM"}, nil)
	b.attend(statut, http.StatusForbidden, "méthode hors encadrement", body)

	statut, body = appelJSON(superviseur, http.MethodPut, chemin, map[string]any{"methode": "PLATFORM"}, nil)
	superviseur.attend(statut, http.StatusOK, "méthode posée par le superviseur", body)
	if body["enrollmentMethod"] != "PLATFORM" || body["phase2Status"] != "METHOD_OBTAINED" {
		t.Fatalf("méthode posée : %v, %v", body["enrollmentMethod"], body["phase2Status"])
	}

	statut, body = appelJSON(superviseur, http.MethodPut, chemin, map[string]any{"methode": "AUCUNE"}, nil)
	superviseur.attend(statut, http.StatusOK, "méthode retirée par le superviseur", body)
	if body["enrollmentMethod"] != nil || body["phase2Status"] != "REACHED" {
		t.Fatalf("sans méthode la fiche redevient jointe : %v, %v", body["enrollmentMethod"], body["phase2Status"])
	}
	var parcours *string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."enrollmentMethod"::text FROM "prospect_journeys" p JOIN "prospects" f ON f."id" = p."prospectId" AND f."projet" = p."projet" WHERE f."id" = $1`,
		id).Scan(&parcours); err != nil {
		t.Fatal(err)
	}
	if parcours != nil {
		t.Fatalf("le parcours du projet garde la méthode %s", *parcours)
	}
}

func TestProspectFusionDeplaceLesTentatives(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	cible := creerProspect(b, "Fall cible", numeroSenegalais(15))["id"].(string)
	source := creerProspect(b, "Fall source", numeroSenegalais(16))["id"].(string)

	tentative := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		 SELECT $1,$2,$3,"id",now() FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'`,
		tentative, source, b.userID); err != nil {
		t.Fatal(err)
	}

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects/merge",
		map[string]any{"targetId": cible, "sourceId": source}, nil)
	b.attend(statut, http.StatusOK, "fusion", body)

	var porteur string
	if err := b.pool.QueryRow(b.ctx, `SELECT "prospectId" FROM "call_attempts" WHERE "id" = $1`, tentative).Scan(&porteur); err != nil {
		t.Fatal(err)
	}
	if porteur != cible {
		t.Fatalf("la tentative doit suivre la fusion : %s", porteur)
	}
	var supprimee *time.Time
	if err := b.pool.QueryRow(b.ctx, `SELECT "deletedAt" FROM "prospects" WHERE "id" = $1`, source).Scan(&supprimee); err != nil {
		t.Fatal(err)
	}
	if supprimee == nil {
		t.Fatal("la source doit être supprimée logiquement")
	}
	var parcours int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "prospect_journeys" WHERE "prospectId" = $1`, source).Scan(&parcours); err != nil {
		t.Fatal(err)
	}
	if parcours != 0 {
		t.Fatalf("aucun parcours ne reste sur la fiche absorbée : %d", parcours)
	}
}

func TestProspectReaffectationEstAuditee(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	destinataire := autreCompte(b, "COMMERCIAL")
	nettoyerProspects(b, b.userID, destinataire.userID)
	id := creerProspect(b, "Cissé", numeroSenegalais(17))["id"].(string)
	second := creerProspect(b, "Sow", numeroSenegalais(23))["id"].(string)

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects/reassign",
		map[string]any{"prospectIds": []string{id, second}, "commercialId": destinataire.userID}, nil)
	b.attend(statut, http.StatusOK, "réaffectation", body)
	if body["updated"] != float64(2) {
		t.Fatalf("deux fiches doivent être réaffectées : %v", body["updated"])
	}
	var proprietaire string
	if err := b.pool.QueryRow(b.ctx, `SELECT "createdById" FROM "prospects" WHERE "id" = $1`, id).Scan(&proprietaire); err != nil {
		t.Fatal(err)
	}
	if proprietaire != destinataire.userID {
		t.Fatalf("le propriétaire doit avoir changé : %s", proprietaire)
	}
	var traces, sansListe int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(DISTINCT "entityId"), count(*) FILTER (WHERE NOT "after" ? 'prospectIds' AND "after"->>'nombre' = '2')
		 FROM "audit_logs" WHERE "action" = 'prospect.reassign' AND "userId" = $1`, b.userID).Scan(&traces, &sansListe); err != nil {
		t.Fatal(err)
	}
	if traces != 2 || sansListe != 2 {
		t.Fatalf("chaque fiche réaffectée laisse une trace sans la liste du lot : %d traces, %d sans liste", traces, sansListe)
	}
}

func TestProspectFormulairePublicRefuseSansCleTurnstile(t *testing.T) {
	t.Setenv("API_TRUST_PROXY_HEADERS", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	visiteur := map[string]string{"X-Forwarded-For": "10.0.0.1"}

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/formulaire-public/formulaire", nil, visiteur)
	b.attend(statut, http.StatusOK, "composition de la page", body)
	if _, ok := body["champs"].([]any); !ok {
		t.Fatalf("le formulaire doit rendre ses champs : %v", body)
	}

	demande := map[string]any{"nom": "Robot", "prenom": "Test", "phone": numeroSenegalais(18)}
	statut, body = appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+jetonFormulaire(b), demande, visiteur)
	b.attend(statut, http.StatusServiceUnavailable, "envoi sans clé Turnstile", body)
	if body["code"] != "CAPTCHA_INDISPONIBLE" {
		t.Fatalf("code : %v", body["code"])
	}
	var fiches int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "prospects" WHERE "createdById" = $1`, b.userID).Scan(&fiches); err != nil {
		t.Fatal(err)
	}
	if fiches != 0 {
		t.Fatalf("rien ne doit être écrit sans vérification anti-robot : %d", fiches)
	}
}

func TestProspectFormulairePublicRendLaCleDeSite(t *testing.T) {
	t.Setenv("TURNSTILE_SITE_KEY", "0x4AAAAAAA-cle-de-site")
	b := nouveauBanc(t, "COMMERCIAL")

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/formulaire-public/formulaire", nil, nil)
	b.attend(statut, http.StatusOK, "composition de la page", body)
	if body["turnstileSiteKey"] != "0x4AAAAAAA-cle-de-site" {
		t.Fatalf("la clé de site doit être servie à la requête : %v", body["turnstileSiteKey"])
	}
}

func TestProspectFormulairePublicJetonEtCadence(t *testing.T) {
	t.Setenv("API_TRUST_PROXY_HEADERS", "true")
	t.Setenv("TURNSTILE_ALLOW_DEGRADED", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	nettoyerProspects(b, b.userID)
	visiteur := map[string]string{"X-Forwarded-For": "10.0.0.2"}
	inconnu := uuid.NewString()

	piege := map[string]any{"nom": "Robot", "prenom": "Test", "phone": numeroSenegalais(19), "site": "rempli"}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+inconnu, piege, visiteur)
	b.attend(statut, http.StatusCreated, "champ piège rempli", body)

	demande := map[string]any{"nom": "Sarr", "prenom": "Awa", "phone": numeroSenegalais(20)}
	for i := range 4 {
		statut, body = appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+inconnu, demande, visiteur)
		b.attend(statut, http.StatusNotFound, "jeton inconnu", body)
		if body["code"] != "LIEN_INVALIDE" {
			t.Fatalf("envoi %d, code : %v", i, body["code"])
		}
	}
	statut, body = appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+inconnu, demande, visiteur)
	b.attend(statut, http.StatusTooManyRequests, "sixième envoi de la minute", body)
	if body["code"] != "RATE_LIMITED" {
		t.Fatalf("code : %v", body["code"])
	}

	var fiches int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "prospects" WHERE "createdById" = $1`, b.userID).Scan(&fiches); err != nil {
		t.Fatal(err)
	}
	if fiches != 0 {
		t.Fatalf("un lien mort n’écrit rien : %d", fiches)
	}
}

// Le lien public porte un jeton propre au compte, régénérable, et non plus
// l'identifiant du compte qui ne se révoquait qu'en fermant le compte.
func jetonFormulaire(b *banc) string {
	b.t.Helper()
	var jeton string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "formulaireJeton" FROM "users" WHERE "id" = $1`, b.userID).Scan(&jeton); err != nil {
		b.t.Fatal(err)
	}
	return jeton
}

func TestProspectFormulairePublicCreeEtRapproche(t *testing.T) {
	t.Setenv("API_TRUST_PROXY_HEADERS", "true")
	t.Setenv("TURNSTILE_ALLOW_DEGRADED", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	nettoyerProspects(b, b.userID)
	reglagesPublicsSansObligation(b)
	visiteur := map[string]string{"X-Forwarded-For": "10.0.0.3"}
	telephone := numeroSenegalais(21)

	demande := map[string]any{"nom": "Gueye", "prenom": "Fatou", "phone": telephone}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+jetonFormulaire(b), demande, visiteur)
	b.attend(statut, http.StatusCreated, "demande publique", body)

	var id, nom string
	var origine *string
	var aRevoir *time.Time
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id", "nom", "origin", "aRevoirAt" FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL`,
		telephone).Scan(&id, &nom, &origine, &aRevoir); err != nil {
		t.Fatal(err)
	}
	if origine == nil || *origine != "FORMULAIRE_PUBLIC" || aRevoir == nil {
		t.Fatalf("la fiche doit porter sa provenance et sa marque à revoir : %v, %v", origine, aRevoir)
	}

	// Le même numéro revient : la fiche n'est pas dupliquée et son identité, déjà
	// renseignée, n'est pas réécrite par une saisie non vérifiée.
	seconde := map[string]any{"nom": "Usurpateur", "prenom": "Faux", "phone": telephone}
	statut, body = appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+jetonFormulaire(b), seconde, visiteur)
	b.attend(statut, http.StatusCreated, "second envoi du même numéro", body)

	var fiches int
	var nomFinal string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*), max("nom") FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL`,
		telephone).Scan(&fiches, &nomFinal); err != nil {
		t.Fatal(err)
	}
	if fiches != 1 || nomFinal != "Gueye" {
		t.Fatalf("le rapprochement ne duplique ni ne réécrit : %d fiches, nom %q", fiches, nomFinal)
	}
}

// `shortName` et `sigle` sont uniques dans toute la base : CBAO et CHUES sont
// repris s'ils existent déjà, et ne sont supprimés que par celui qui les crée.
func referentielSegment(b *banc, table, colonne, valeur string) string {
	b.t.Helper()
	id := uuid.NewString()
	var retenu string
	requete := `INSERT INTO "` + table + `" ("id","name","` + colonne + `","updatedAt") VALUES ($1,$2,$3,now())
		ON CONFLICT ("` + colonne + `") DO UPDATE SET "updatedAt" = now() RETURNING "id"`
	if err := b.pool.QueryRow(b.ctx, requete, id, "Test "+id[:8], valeur).Scan(&retenu); err != nil {
		b.t.Fatal(err)
	}
	if retenu == id {
		b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "`+table+`" WHERE "id" = $1`, id) })
	}
	return retenu
}

// Un numéro propre à la course : plusieurs exécutions simultanées partagent la
// même base, et l'index d'unicité du téléphone est global.
func numeroDeCourse(suffixe int) string {
	return fmt.Sprintf("+22177%07d", (time.Now().UnixNano()+int64(suffixe))%10_000_000)
}

func exigerRefusSegment(b *banc, chemin string, corps map[string]any, attendu int, code string) {
	b.t.Helper()
	statut, body := appelJSON(b, http.MethodPatch, chemin, corps, nil)
	b.attend(statut, attendu, "bascule refusée "+code, body)
	if body["code"] != code {
		b.t.Fatalf("code : %v", body["code"])
	}
}

func TestProspectBasculeDeSegmentLaisseUneTrace(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	nettoyerProspects(b, b.userID)
	chues := referentielSegment(b, "syndicats", "sigle", "CHUES")
	cbao := referentielSegment(b, "banques", "shortName", "CBAO")
	autreBanque := referentielSegment(b, "banques", "shortName", "B"+uuid.NewString()[:8])

	id := creerProspect(b, "Camara", numeroDeCourse(1))["id"].(string)
	statut, body := appelJSON(b, http.MethodPatch, "/api/v1/prospects/"+id,
		map[string]any{"banqueId": autreBanque, "syndicatId": chues}, nil)
	b.attend(statut, http.StatusOK, "banque et syndicat de départ", body)
	exigerChampsJSON(b, body, map[string]string{"segment": "BDD2"}, "segment de départ")
	rev := body["rev"].(float64)

	chemin := "/api/v1/prospects/" + id + "/segment"
	statut, body = appelJSON(b, http.MethodPatch, chemin,
		map[string]any{"banqueId": cbao, "reason": "Compte ouvert à la CBAO", "expectedRev": rev}, nil)
	b.attend(statut, http.StatusOK, "bascule de segment", body)
	exigerChampsJSON(b, body, map[string]string{"segment": "BDD1", "rev": fmt.Sprint(rev + 1)}, "fiche basculée")

	exigerRefusSegment(b, chemin, map[string]any{"banqueId": cbao, "reason": "Deux fois le même geste"},
		http.StatusUnprocessableEntity, "PROSPECT_SEGMENT_UNCHANGED")
	exigerRefusSegment(b, chemin, map[string]any{"banqueId": autreBanque, "reason": "Révision périmée", "expectedRev": rev},
		http.StatusConflict, "PROSPECT_REV_CONFLICT")
	exigerRefusSegment(b, chemin, map[string]any{"banqueId": uuid.NewString(), "reason": "Banque inventée"},
		http.StatusUnprocessableEntity, "PROSPECT_BANQUE_NOT_FOUND")

	statut, body = appelJSON(b, http.MethodGet, "/api/v1/prospects/"+id+"/segment-history", nil, nil)
	b.attend(statut, http.StatusOK, "historique des bascules", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("une seule bascule doit être tracée : %v", body["items"])
	}
	exigerChampsJSON(b, items[0].(map[string]any), map[string]string{
		"fromSegment": "BDD2", "toSegment": "BDD1", "source": "WEB",
		"reason": "Compte ouvert à la CBAO", "changedByName": "Test Intégration",
		"fromBanqueId": autreBanque, "toBanqueId": cbao,
		"fromSyndicatId": chues, "toSyndicatId": chues,
	}, "trace de bascule")
}

func TestProspectBasculeDeSegmentRefuseeSansSegment(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	autre := autreCompte(b, "COMMERCIAL")
	nettoyerProspects(b, b.userID, autre.userID)

	id := creerProspect(b, "Sylla", numeroDeCourse(2))["id"].(string)
	chemin := "/api/v1/prospects/" + id + "/segment"
	exigerRefusSegment(b, chemin, map[string]any{"banqueId": uuid.NewString(), "reason": "Fiche sans segment"},
		http.StatusUnprocessableEntity, "PROSPECT_SEGMENT_UNAVAILABLE")

	statut, body := appelJSON(autre, http.MethodPatch, chemin,
		map[string]any{"banqueId": uuid.NewString(), "reason": "Hors encadrement"}, nil)
	autre.attend(statut, http.StatusForbidden, "bascule par un téléconseiller", body)
}

func appelEtRappelEnAttente(b *banc, prospect, motif string, quand time.Time) string {
	b.t.Helper()
	tentative, rappel := uuid.NewString(), uuid.NewString()
	qualificationExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		SELECT $1,$2,$3,"id",$4 FROM "call_outcome_reasons" WHERE "code" = $5`, tentative, prospect, b.userID, quand, motif)
	qualificationExec(b, `UPDATE "prospects" SET "lastCallAt" = $2, "lastCallById" = $3,
		"lastReasonId" = (SELECT "id" FROM "call_outcome_reasons" WHERE "code" = $4) WHERE "id" = $1`, prospect, quand, b.userID, motif)
	qualificationExec(b, `INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","sourceAttemptId","updatedAt")
		VALUES ($1,$2,$3,$4,$5,now())`, rappel, prospect, b.userID, quand.Add(24*time.Hour), tentative)
	return rappel
}

func fusionnerEnArrierePlan(b *banc, corps []byte, statuts chan<- int) {
	req, err := http.NewRequestWithContext(b.ctx, http.MethodPost, b.ts.URL+"/api/v1/prospects/merge", bytes.NewReader(corps))
	if err != nil {
		statuts <- 0
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", b.ts.URL)
	resp, err := b.client.Do(req)
	if err != nil {
		statuts <- 0
		return
	}
	_ = resp.Body.Close()
	statuts <- resp.StatusCode
}

func attendreFusionsBloquees(b *banc, nombre int) {
	b.t.Helper()
	for range 100 {
		var bloquees int
		if err := b.pool.QueryRow(b.ctx,
			`SELECT count(*) FROM pg_stat_activity
			 WHERE "datname" = current_database() AND "wait_event_type" = 'Lock' AND "query" LIKE '%VerrouillerFichesAFusionner%'`).Scan(&bloquees); err != nil {
			b.t.Fatal(err)
		}
		if bloquees >= nombre {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	b.t.Fatalf("%d fusions attendues en attente du verrou", nombre)
}

// Le test tient la source verrouillée pour que deux fusions identiques se suivent :
// la seconde trouve la source déjà absorbée.
func TestFusionDeuxRappelsEnAttente(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	cible := creerProspect(b, "Kane cible", numeroDeCourse(3))["id"].(string)
	source := creerProspect(b, "Kane source", numeroDeCourse(4))["id"].(string)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = ANY($1)`, []string{cible, source})
	})
	rappelCible := appelEtRappelEnAttente(b, cible, "PAS_DE_REPONSE", time.Now().UTC().Add(-2*time.Hour))
	rappelSource := appelEtRappelEnAttente(b, source, "MESSAGERIE", time.Now().UTC().Add(-time.Hour))

	verrou, err := b.pool.Begin(b.ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = verrou.Rollback(b.ctx) }()
	if _, err := verrou.Exec(b.ctx, `SELECT 1 FROM "prospects" WHERE "id" = $1 FOR UPDATE`, source); err != nil {
		t.Fatal(err)
	}
	corps, err := json.Marshal(map[string]any{"targetId": cible, "sourceId": source})
	if err != nil {
		t.Fatal(err)
	}
	statuts := make(chan int, 2)
	for i := range 2 {
		go fusionnerEnArrierePlan(b, corps, statuts)
		attendreFusionsBloquees(b, i+1)
	}
	if err := verrou.Rollback(b.ctx); err != nil {
		t.Fatal(err)
	}
	premier, second := <-statuts, <-statuts
	if premier+second != http.StatusOK+http.StatusConflict || premier*second != http.StatusOK*http.StatusConflict {
		t.Fatalf("une fusion aboutit, la seconde trouve la source absorbée : %d, %d", premier, second)
	}

	if n := qualificationCompte(b, `SELECT count(*) FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`,
		cible); n != 1 || qualificationCompte(b, `SELECT count(*) FROM "scheduled_callbacks" WHERE "id" = $1 AND "status" = 'PENDING'`, rappelCible) != 1 {
		t.Fatalf("le rappel en attente de la cible doit rester seul : %d", n)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'SUPERSEDED' AND "id" = $2`,
		cible, rappelSource); n != 1 {
		t.Fatalf("le rappel de la source doit suivre la fusion, supplanté : %d", n)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "prospects" p JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
		WHERE p."id" = $1 AND r."code" = 'MESSAGERIE' AND p."lastCallById" = $2`, cible, b.userID); n != 1 {
		t.Fatal("la cible doit porter le dernier appel, celui de la source")
	}
}

// Deux fusions croisées attendent les mêmes verrous : la seconde trouve sa cible absorbée au lieu d'un interblocage.
func TestFusionCroiseeSansInterblocage(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	premiere := creerProspect(b, "Kane", numeroDeCourse(5))["id"].(string)
	seconde := creerProspect(b, "Kane", numeroDeCourse(6))["id"].(string)

	verrou, err := b.pool.Begin(b.ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = verrou.Rollback(b.ctx) }()
	if _, err := verrou.Exec(b.ctx, `SELECT 1 FROM "prospects" WHERE "id" = ANY($1) FOR UPDATE`, []string{premiere, seconde}); err != nil {
		t.Fatal(err)
	}
	statuts := make(chan int, 2)
	for i, sens := range [][2]string{{premiere, seconde}, {seconde, premiere}} {
		corps, err := json.Marshal(map[string]any{"sourceId": sens[0], "targetId": sens[1]})
		if err != nil {
			t.Fatal(err)
		}
		go fusionnerEnArrierePlan(b, corps, statuts)
		attendreFusionsBloquees(b, i+1)
	}
	if err := verrou.Rollback(b.ctx); err != nil {
		t.Fatal(err)
	}
	premier, second := <-statuts, <-statuts
	if premier+second != http.StatusOK+http.StatusConflict || premier*second != http.StatusOK*http.StatusConflict {
		t.Fatalf("une fusion aboutit, l'autre trouve sa fiche absorbée : %d, %d", premier, second)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "prospects" WHERE "id" = ANY($1) AND "deletedAt" IS NULL`,
		[]string{premiere, seconde}); n != 1 {
		t.Fatalf("une seule des deux fiches doit survivre : %d", n)
	}
}

// Une fiche ne naît pas CONVERTI sans offre ni conversion signée.
func TestProspectCreationRefuseConverti(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	telephone := numeroSenegalais(24)

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/prospects",
		map[string]any{"nom": "Diagne", "phone": telephone, "statut": "CONVERTI"}, nil)
	b.attend(statut, http.StatusForbidden, "création directe en CONVERTI", body)
	if body["code"] != "PROSPECT_STATUT_TRANSITION_REFUSED" {
		t.Fatalf("code : %v", body["code"])
	}
	var fiches int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "prospects" WHERE "phoneE164" = $1`, telephone).Scan(&fiches); err != nil {
		t.Fatal(err)
	}
	if fiches != 0 {
		t.Fatalf("aucune fiche ne doit être créée : %d", fiches)
	}
}

// Une conversion Grand Public rejouée sur une fiche vendue n'écrase pas la conversion signée.
func TestConversionGrandPublicNeRegressePasUneVente(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	admin := autreCompte(b, "ADMIN")
	nettoyerProspects(b, b.userID, admin.userID)
	id := creerProspect(b, "Thiam", numeroSenegalais(25))["id"].(string)

	offre := uuid.NewString()
	if _, err := b.pool.Exec(b.ctx,
		`INSERT INTO "offers" ("id","code","label","updatedAt") VALUES ($1,$2,$3,now())`,
		offre, "TEST-"+offre[:8], "Offre test "+offre[:8]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx,
			`DELETE FROM "prospect_conversions" WHERE "journeyId" IN (SELECT "id" FROM "prospect_journeys" WHERE "prospectId" = $1)`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "offers" WHERE "id" = $1`, offre)
	})

	consentement := "/api/v1/prospects/" + id + "/parcours/grand-public/consentement"
	statut, body := appelJSON(b, http.MethodPatch, consentement, map[string]any{"consent": "INTERESSE"}, nil)
	b.attend(statut, http.StatusOK, "accord consigné", body)

	chemin := "/api/v1/prospects/" + id + "/parcours/grand-public/conversion"
	statut, body = appelJSON(b, http.MethodPost, chemin,
		map[string]any{"offerId": offre, "paymentMode": "COMPTANT", "amountXof": 150000}, nil)
	b.attend(statut, http.StatusOK, "première conversion", body)

	statut, body = appelJSON(b, http.MethodPost, "/api/v1/prospects/"+id+"/vendre", nil, nil)
	b.attend(statut, http.StatusOK, "vente", body)
	if body["statut"] != "VENDU" {
		t.Fatalf("la fiche doit être vendue : %v", body["statut"])
	}

	statut, body = appelJSON(admin, http.MethodPost, chemin,
		map[string]any{"offerId": offre, "paymentMode": "COMPTANT", "amountXof": 999999}, nil)
	admin.attend(statut, http.StatusUnprocessableEntity, "conversion rejouée sur une fiche vendue", body)
	if body["code"] != "PROSPECT_CONVERTI" {
		t.Fatalf("code : %v", body["code"])
	}

	var statutEnBase, auteur string
	var montant int32
	if err := b.pool.QueryRow(b.ctx,
		`SELECT p."statut"::text, c."confirmedById", c."amountXof" FROM "prospects" p
		 JOIN "prospect_journeys" j ON j."prospectId" = p."id" AND j."projet" = 'GRAND_PUBLIC'
		 JOIN "prospect_conversions" c ON c."journeyId" = j."id" WHERE p."id" = $1`,
		id).Scan(&statutEnBase, &auteur, &montant); err != nil {
		t.Fatal(err)
	}
	if statutEnBase != "VENDU" {
		t.Fatalf("la fiche ne doit pas régresser : %s", statutEnBase)
	}
	if auteur != b.userID || montant != 150000 {
		t.Fatalf("l’auteur et le montant de la conversion signée ne doivent pas être écrasés : %s, %d", auteur, montant)
	}
}

// Un long message accentué se tronque en caractères : la notification garde 500 caractères valides.
func TestFormulairePublicMessageAccentuePrevientLaSupervision(t *testing.T) {
	t.Setenv("API_TRUST_PROXY_HEADERS", "true")
	t.Setenv("TURNSTILE_ALLOW_DEGRADED", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	nettoyerProspects(b, b.userID)
	reglagesPublicsSansObligation(b)
	visiteur := map[string]string{"X-Forwarded-For": "10.0.0.4"}
	telephone := numeroSenegalais(88)

	message := strings.Repeat("é", 490)
	demande := map[string]any{"nom": "Sarr", "prenom": "Fatou", "phone": telephone, "message": message}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+jetonFormulaire(b), demande, visiteur)
	b.attend(statut, http.StatusCreated, "message accentué long", body)

	var id string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL`, telephone).Scan(&id); err != nil {
		t.Fatal(err)
	}
	route := "/chues/prospects/" + id
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "notifications" WHERE "route" = $1`, route) })

	var notifs int
	var corpsNotif string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT count(*), coalesce(max("body"), '') FROM "notifications" WHERE "route" = $1`, route).Scan(&notifs, &corpsNotif); err != nil {
		t.Fatal(err)
	}
	if notifs != 1 {
		t.Fatalf("la supervision doit recevoir une notification : %d", notifs)
	}
	if !utf8.ValidString(corpsNotif) || utf8.RuneCountInString(corpsNotif) != 500 {
		t.Fatalf("le corps tronqué doit garder 500 caractères valides : %d", utf8.RuneCountInString(corpsNotif))
	}
}

// Une demande publique sur une fiche venue d'ailleurs garde sa provenance, et
// l'accusé au visiteur entre au journal des courriels, qu'il parte ou attende l'heure ouvrable.
func TestFormulairePublicSurFicheExistante(t *testing.T) {
	t.Setenv("API_TRUST_PROXY_HEADERS", "true")
	t.Setenv("TURNSTILE_ALLOW_DEGRADED", "true")
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	nettoyerProspects(b, b.userID)
	reglagesPublicsSansObligation(b)
	telephone := numeroDeCourse(89)
	id := creerProspect(b, "Ndiaye", telephone)["id"].(string)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "courriels" WHERE "objetId" = $1`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "notifications" WHERE "route" = $1`, "/chues/prospects/"+id)
	})
	if _, err := b.pool.Exec(b.ctx, `UPDATE "prospects" SET "origin" = 'BANQUE' WHERE "id" = $1`, id); err != nil {
		t.Fatal(err)
	}

	email := "visiteur-" + id[:8] + "@exemple.sn"
	demande := map[string]any{"nom": "Ndiaye", "prenom": "Awa", "phone": telephone, "email": email}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/formulaire-public/"+jetonFormulaire(b), demande,
		map[string]string{"X-Forwarded-For": "10.0.0.5"})
	b.attend(statut, http.StatusCreated, "demande publique sur une fiche BANQUE", body)

	var origine string
	var accuses int
	if err := b.pool.QueryRow(b.ctx, `SELECT "origin", (SELECT count(*) FROM "courriels" WHERE "objetId" = $1 AND $2 = ANY ("destinataires"))
		FROM "prospects" WHERE "id" = $1`, id, email).Scan(&origine, &accuses); err != nil {
		t.Fatal(err)
	}
	if origine != "BANQUE" || accuses != 1 {
		t.Fatalf("provenance %q, accusés journalisés %d : attendu BANQUE et un accusé", origine, accuses)
	}
}
