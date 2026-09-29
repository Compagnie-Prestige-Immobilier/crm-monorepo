//go:build integration

package main

import (
	"cpi-go/internal/analytics"
	"fmt"
	"net/http"
	"slices"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
)

// Deux caracteres d'uuid ne donnaient que 256 telephones : la contrainte
// d'unicite sautait environ une execution sur neuf.
var compteurTelephoneAnalytics atomic.Int64

func telephoneAnalytics() string {
	return fmt.Sprintf("+22178%07d", compteurTelephoneAnalytics.Add(1))
}

const (
	jourAnalytics    = "2026-03-15"
	instantAnalytics = "2026-03-15T10:00:00Z"
	vieuxAnalytics   = "2020-01-01T10:00:00Z"
)

type jeuAnalytics struct {
	departement  string
	banque       string
	syndicat     string
	representant string
	prospects    []string
}

func analyticsExec(b *banc, sql string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, sql, args...); err != nil {
		b.t.Fatal(err)
	}
}

// Un jeu isolé par identifiants : la base de développement porte déjà des
// lignes, seul un filtre sur ces identifiants rend les comptes vérifiables.
func analyticsSemer(b *banc) jeuAnalytics {
	b.t.Helper()
	proprietaire := b.userID
	jeu := jeuAnalytics{
		departement:  uuid.NewString(),
		banque:       uuid.NewString(),
		syndicat:     uuid.NewString(),
		representant: uuid.NewString(),
	}
	region := uuid.NewString()
	analyticsExec(b, `INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$1,'Region test',now())`, region)
	analyticsExec(b, `INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$1,'Departement test',$2,now())`, jeu.departement, region)
	analyticsExec(b, `INSERT INTO "banques" ("id","name","shortName","updatedAt") VALUES ($1,'Banque test',$1,now())`, jeu.banque)
	analyticsExec(b, `INSERT INTO "syndicats" ("id","name","sigle","updatedAt") VALUES ($1,'Syndicat test',$1,now())`, jeu.syndicat)
	analyticsExec(b, `INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
		VALUES ($1,'Representant test',$2,$3,$4,$5::timestamp,now())`,
		jeu.representant, "+2217700000"+uuid.NewString()[:2], jeu.departement, proprietaire, instantAnalytics)

	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = ANY($1)`, jeu.prospects)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "prospects" WHERE "representantId" = $1`, jeu.representant)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "representantId" = $1`, jeu.representant)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "id" = $1`, jeu.representant)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "departements" WHERE "id" = $1`, jeu.departement)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, region)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "banques" WHERE "id" = $1`, jeu.banque)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "syndicats" WHERE "id" = $1`, jeu.syndicat)
	})
	return jeu
}

func analyticsProspect(b *banc, jeu *jeuAnalytics, proprietaire, quand string, methode bool) string {
	b.t.Helper()
	id := uuid.NewString()
	phase, enrolement, capture := "PENDING", any(nil), any(nil)
	if methode {
		phase, enrolement, capture = "METHOD_OBTAINED", "WHATSAPP", quand
	}
	analyticsExec(b, `INSERT INTO "prospects"
		("id","nom","prenom","phoneE164","banqueId","syndicatId","representantId","createdById",
		 "clientCreatedAt","updatedAt","phase2Status","enrollmentMethod","enrollmentCapturedAt")
		VALUES ($1,'Nom','Prenom',$2,$3,$4,$5,$6,$7::timestamp,now(),
		        $8::"Phase2Status",$9::"EnrollmentMethod",$10::timestamp)`,
		id, telephoneAnalytics(), jeu.banque, jeu.syndicat, jeu.representant,
		proprietaire, quand, phase, enrolement, capture)
	jeu.prospects = append(jeu.prospects, id)
	return id
}

func analyticsAppel(b *banc, prospect, issue string) {
	b.t.Helper()
	methode, motif := any(nil), "PAS_DE_REPONSE"
	switch issue {
	case "METHOD_OBTAINED":
		methode, motif = "WHATSAPP", "INTERESSE"
	case "REACHED":
		motif = "DEMANDE_INFORMATION"
	}
	analyticsExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","method","clientCreatedAt")
		SELECT $1,$2,$3,"id",$5::"EnrollmentMethod",$6::timestamp FROM "call_outcome_reasons" WHERE "code" = $4`,
		uuid.NewString(), prospect, b.userID, motif, methode, instantAnalytics)
}

func analyticsViderCache() {
	analytics.ViderCache()
}

func analyticsObjet(b *banc, quoi string, valeur any) map[string]any {
	b.t.Helper()
	objet, ok := valeur.(map[string]any)
	if !ok {
		b.t.Fatalf("%s : objet attendu, %v reçu", quoi, valeur)
	}
	return objet
}

func analyticsListe(b *banc, quoi string, valeur any, attendue int) []any {
	b.t.Helper()
	liste, ok := valeur.([]any)
	if !ok || len(liste) != attendue {
		b.t.Fatalf("%s : %d éléments attendus, %v reçu", quoi, attendue, valeur)
	}
	return liste
}

func analyticsNombre(b *banc, valeur any, quoi string) float64 {
	b.t.Helper()
	nombre, ok := valeur.(float64)
	if !ok {
		b.t.Fatalf("%s : nombre attendu, %v reçu", quoi, valeur)
	}
	return nombre
}

func analyticsEgal(b *banc, quoi string, valeur any, attendu float64) {
	b.t.Helper()
	if recu := analyticsNombre(b, valeur, quoi); recu != attendu {
		b.t.Fatalf("%s : %v attendu, %v reçu", quoi, attendu, recu)
	}
}

func analyticsTravailImport(b *banc, kind string) string {
	b.t.Helper()
	id := uuid.NewString()
	analyticsExec(b, `INSERT INTO "import_jobs" ("id","kind","status","mode","requestedById","fileName","fileBytes","storagePath","expiresAt","updatedAt")
		VALUES ($1,$2::"ImportKind",'succeeded','APPLY',$3,'classeur.xlsx',1,'/tmp/x',now() + interval '1 day',now())`, id, kind, b.userID)
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "import_jobs" WHERE "id" = $1`, id) })
	return id
}

func analyticsTotalMarketing(b *banc, quoi string) float64 {
	b.t.Helper()
	analyticsViderCache()
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/prospects/marketing", nil, false)
	b.attend(statut, http.StatusOK, quoi, body)
	return analyticsNombre(b, body["total"], quoi)
}

// Un lead inscrit sur la plateforme n'attend pas de distribution : il se compte à part.
func TestSupervisionMarketingCompteAPartLesInscritsDeLaPlateforme(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	releve := analyticsTravailImport(b, "PROSPECTS_GRAND_PUBLIC")
	lire := func(quoi string) map[string]any {
		analyticsViderCache()
		statut, body := b.appel(http.MethodGet, "/api/v1/supervision/prospects/marketing", nil, false)
		b.attend(statut, http.StatusOK, quoi, body)
		return body
	}
	lead := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsExec(b, `UPDATE "prospects" SET "importJobId" = $2 WHERE "id" = $1`, lead, releve)
	avant := lire("marketing avant l'inscription")

	inscription := uuid.NewString()
	analyticsExec(b, `INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","statutDistant","prospectId","chargeUtile","dernierTirageAt","updatedAt")
		VALUES ($1,'CHUES',$1,'Nom','Prenom','etape-0',$2,'{}'::jsonb,now(),now())`, inscription, lead)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "inscriptions_plateforme" WHERE "id" = $1`, inscription)
	})
	apres := lire("marketing après l'inscription")
	analyticsEgal(b, "pas encore distribuées", apres["nonDistribues"], analyticsNombre(b, avant["nonDistribues"], "avant")-1)
	analyticsEgal(b, "suivies sur la plateforme", apres["surPlateforme"], analyticsNombre(b, avant["surPlateforme"], "avant")+1)
	analyticsEgal(b, "total", apres["total"], analyticsNombre(b, avant["total"], "avant"))
}

// Le pôle marketing ne compte que les prospects qu'un canal amène ou qu'un relevé
// a apportés. Une fiche remise par un représentant ou un classeur CHUES déposé par
// le pôle déploiement reste hors du compte.
func TestSupervisionMarketingIgnoreLesFichesDuDeploiement(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	avant := analyticsTotalMarketing(b, "marketing avant le jeu")

	canal := uuid.NewString()
	analyticsExec(b, `INSERT INTO "canaux_provenance" ("id","code","label","updatedAt") VALUES ($1,$1,'Canal test',now())`, canal)
	// Laissé en base, ce canal au code aléatoire capterait « fb » au relevé d'un autre test.
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `UPDATE "prospects" SET "canalProvenanceId" = NULL WHERE "canalProvenanceId" = $1`, canal)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "canaux_provenance" WHERE "id" = $1`, canal)
	})
	releve := analyticsTravailImport(b, "PROSPECTS_GRAND_PUBLIC")
	classeurChues := analyticsTravailImport(b, "PROSPECTS")

	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	parCanal := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsExec(b, `UPDATE "prospects" SET "canalProvenanceId" = $2 WHERE "id" = $1`, parCanal, canal)
	parReleve := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsExec(b, `UPDATE "prospects" SET "importJobId" = $2 WHERE "id" = $1`, parReleve, releve)
	duDeploiement := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsExec(b, `UPDATE "prospects" SET "importJobId" = $2 WHERE "id" = $1`, duDeploiement, classeurChues)

	apres := analyticsTotalMarketing(b, "marketing après le jeu")
	if apres != avant+2 {
		t.Fatalf("le marketing compte le canal et le relevé, pas le représentant ni le classeur CHUES : %v puis %v", avant, apres)
	}
}

func analyticsTexte(b *banc, quoi string, valeur any, attendu string) {
	b.t.Helper()
	if valeur != attendu {
		b.t.Fatalf("%s : %q attendu, %v reçu", quoi, attendu, valeur)
	}
}

func analyticsNul(b *banc, quoi string, valeur any) {
	b.t.Helper()
	if valeur != nil {
		b.t.Fatalf("%s : valeur nulle attendue, %v reçue", quoi, valeur)
	}
}

func analyticsNonNul(b *banc, quoi string, valeur any) {
	b.t.Helper()
	if valeur == nil {
		b.t.Fatalf("%s : valeur attendue, nulle reçue", quoi)
	}
}

func analyticsConnexion(t *testing.T, role string) *banc {
	t.Helper()
	b := nouveauBanc(t, role)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	return b
}

// Les trois répartitions lisent la même population : un écart entre elles
// signale une jointure devenue interne.
func TestAnalyticsRepartitionsEtFiltres(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	analyticsProspect(b, &jeu, b.userID, vieuxAnalytics, false)

	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement
	for _, cas := range []struct{ chemin, id string }{
		{"/api/v1/analytics/by-departement", jeu.departement},
		{"/api/v1/analytics/by-banque", jeu.banque},
		{"/api/v1/analytics/by-syndicat", jeu.syndicat},
	} {
		statut, body := b.appel(http.MethodGet, cas.chemin+portee, nil, false)
		b.attend(statut, http.StatusOK, cas.chemin, body)
		ligne := analyticsObjet(b, cas.chemin, analyticsListe(b, cas.chemin, body["items"], 1)[0])
		analyticsTexte(b, cas.chemin+" id", ligne["id"], cas.id)
		analyticsEgal(b, cas.chemin+" prospects", ligne["prospects"], 3)
		analyticsEgal(b, cas.chemin+" part du seul groupe", ligne["share"], 100)
	}

	periode := portee + "&dateFrom=" + jourAnalytics + "&dateTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+periode, nil, false)
	b.attend(statut, http.StatusOK, "répartition bornée à la journée", body)
	analyticsEgal(b, "la borne de période écarte la fiche de 2020", body["total"], 2)

	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+portee+"&dateFrom=pas-une-date", nil, false)
	b.attend(statut, http.StatusBadRequest, "date invalide", body)
}

// `total` ne compte que les porteurs d'une méthode, et les quatre méthodes
// proposées sont rendues même à zéro.
func TestAnalyticsMethodesDEnrolement(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)

	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement
	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/by-enrollment-method"+portee, nil, false)
	b.attend(statut, http.StatusOK, "méthodes", body)
	analyticsEgal(b, "seuls les porteurs d'une méthode comptent", body["total"], 1)
	methodes := analyticsListe(b, "méthodes rendues", body["items"], 4)
	for _, brut := range methodes {
		ligne := analyticsObjet(b, "méthode", brut)
		if ligne["method"] != "WHATSAPP" {
			continue
		}
		analyticsEgal(b, "prospects WhatsApp", ligne["prospects"], 1)
		analyticsEgal(b, "part de la sous-population", ligne["share"], 100)
		return
	}
	t.Fatalf("la méthode obtenue doit figurer dans la répartition : %v", methodes)
}

func TestAnalyticsEntonnoirEtFinance(t *testing.T) {
	b := analyticsConnexion(t, "DIRECTION")
	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	avecDossiers := analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	analyticsDeuxDossiers(b, &jeu, avecDossiers)
	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement

	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/funnel"+portee, nil, false)
	b.attend(statut, http.StatusOK, "entonnoir", body)
	etapes := analyticsListe(b, "étapes", body["etapes"], 4)
	sommet := analyticsObjet(b, "sommet", etapes[0])
	methode := analyticsObjet(b, "méthode obtenue", etapes[1])
	dossier := analyticsObjet(b, "dossier ouvert", etapes[2])
	analyticsEgal(b, "prospects saisis, deux dossiers sur l'un d'eux", sommet["count"], 2)
	analyticsEgal(b, "méthodes obtenues", methode["count"], 1)
	analyticsEgal(b, "prospects au dossier ouvert", dossier["count"], 1)
	analyticsEgal(b, "taux global de la deuxième étape", methode["tauxGlobal"], 50)
	analyticsNonNul(b, "taux d'une étape précédente non vide", dossier["tauxEtapePrecedente"])

	finance := analyticsObjet(b, "finance", body["finance"])
	analyticsTexte(b, "montant encaissé sans dossier encaissé", finance["montantEncaisse"], "0")
	analyticsNul(b, "délai moyen sans dossier clos", finance["delaiMoyenJours"])
}

func analyticsDeuxDossiers(b *banc, jeu *jeuAnalytics, prospect string) {
	b.t.Helper()
	etape := uuid.NewString()
	analyticsExec(b, `INSERT INTO "bank_case_stages" ("id","code","label","position","color","type","updatedAt")
		VALUES ($1,$1,'Étude test',50,'info','OPEN',now())`, etape)
	for range 2 {
		id := uuid.NewString()
		analyticsExec(b, `INSERT INTO "bank_cases" ("id","reference","referenceKey","customerName","customerPhoneE164",
			"processingBankId","currentStageId","createdById","prospectId","updatedAt")
			VALUES ($1,$1,$1,'Nom Prenom','+221770000000',$2,$3,$4,$5,now())`, id, jeu.banque, etape, b.userID, prospect)
	}
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bank_cases" WHERE "currentStageId" = $1`, etape)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bank_case_stages" WHERE "id" = $1`, etape)
	})
}

func TestAnalyticsDelaisEtRendement(t *testing.T) {
	b := analyticsConnexion(t, "DIRECTION")
	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement

	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/delays"+portee, nil, false)
	b.attend(statut, http.StatusOK, "délais", body)
	troncons := analyticsListe(b, "tronçons", body["legs"], 3)
	premier := analyticsObjet(b, "saisie vers méthode", troncons[0])
	analyticsEgal(b, "couples exploitables", premier["sample"], 1)
	analyticsEgal(b, "médiane sur un couple simultané", premier["medianDays"], 0)
	dernier := analyticsObjet(b, "dossier vers encaissement", troncons[2])
	analyticsEgal(b, "tronçon sans couple", dernier["sample"], 0)
	analyticsNul(b, "médiane sans couple exploitable", dernier["medianDays"])

	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/departement-yield"+portee, nil, false)
	b.attend(statut, http.StatusOK, "rendement", body)
	ligne := analyticsObjet(b, "rendement", analyticsListe(b, "départements", body["items"], 1)[0])
	analyticsEgal(b, "prospects du département", ligne["prospects"], 2)
	analyticsEgal(b, "méthodes obtenues", ligne["methodObtained"], 1)
	analyticsEgal(b, "taux de méthode", ligne["methodRate"], 50)
	analyticsTexte(b, "montant encaissé", ligne["cashedAmountXof"], "0")
}

// Un téléconseiller ne lit que ses propres fiches et n'accède pas à la
// supervision : la portée est dans le SQL, pas dans l'écran.
func TestAnalyticsPorteeDuTeleconseiller(t *testing.T) {
	b := analyticsConnexion(t, "COMMERCIAL")
	// Le collègue est créé AVANT le jeu : `t.Cleanup` se dépile à l'envers, et
	// ses fiches doivent disparaître avant lui.
	autre := uuid.NewString()
	analyticsExec(b, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
		VALUES ($1,$2,$3,'x','Autre agent','COMMERCIAL',now())`, autre, autre+"@cpi.sn", autre)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, autre) })

	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsProspect(b, &jeu, autre, instantAnalytics, false)

	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/by-departement?departementId="+jeu.departement, nil, false)
	b.attend(statut, http.StatusOK, "répartition du téléconseiller", body)
	analyticsEgal(b, "le téléconseiller ne voit que sa fiche", body["total"], 1)

	statut, body = b.appel(http.MethodGet,
		"/api/v1/analytics/by-departement?departementId="+jeu.departement+"&commercialId="+autre, nil, false)
	b.attend(statut, http.StatusOK, "commercialId d'un collègue", body)
	analyticsEgal(b, "le portefeuille d'un collègue ne rend rien", body["total"], 0)

	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/activite", nil, false)
	b.attend(statut, http.StatusForbidden, "supervision fermée au téléconseiller", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/representants", nil, false)
	b.attend(statut, http.StatusForbidden, "stock fermé au téléconseiller", body)
}

// Les tableaux de bord lisent les créneaux ; un réglage chevauchant retombe sur les valeurs par défaut.
func TestSupervisionCreneauxLusEtRegleIncoherentIgnore(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'supervision.creneaux'`)
	})

	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/creneaux", nil, false)
	b.attend(statut, http.StatusOK, "créneaux", body)
	analyticsListe(b, "matin et après-midi", body["shifts"], 2)

	chevauchants := `{"shifts":[{"key":"morning","label":"Matin","start":"09:00","end":"16:00"},` +
		`{"key":"afternoon","label":"Après-midi","start":"15:00","end":"18:00"}]}`
	if _, err := b.pool.Exec(b.ctx, `INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES ('supervision.creneaux', $1, now())
		ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`, chevauchants); err != nil {
		t.Fatal(err)
	}
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/creneaux", nil, false)
	b.attend(statut, http.StatusOK, "relecture", body)
	matin := analyticsObjet(b, "matin", analyticsListe(b, "créneaux relus", body["shifts"], 2)[0])
	if matin["end"] == "16:00" {
		t.Fatalf("un réglage chevauchant doit retomber sur les valeurs par défaut : %v", matin)
	}
}

func TestSupervisionActiviteDeLaFenetre(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	joint := analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	perdu := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	sansSuite := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsAppel(b, joint, "METHOD_OBTAINED")
	analyticsAppel(b, perdu, "UNREACHABLE")
	analyticsAppel(b, sansSuite, "REACHED")

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "activité", body)
	totaux := analyticsObjet(b, "totaux", body["totals"])
	analyticsEgal(b, "appels", totaux["calls"], 3)
	analyticsEgal(b, "méthodes obtenues", totaux["methodObtained"], 1)
	analyticsEgal(b, "injoignables", totaux["unreachable"], 1)
	analyticsEgal(b, "seul un motif qui ne compte pas comme joint sort du numérateur", totaux["reachRate"], 66.7)
	analyticsEgal(b, "fiches de la fenêtre", totaux["fiches"], 3)
	analyticsEgal(b, "fiches jointes", totaux["fichesJointes"], 2)
	analyticsEgal(b, "fiches saisies", totaux["prospectsCreated"], 3)

	ligne := analyticsObjet(b, "ligne", analyticsListe(b, "une ligne par agent et par jour", body["items"], 1)[0])
	analyticsTexte(b, "téléconseiller de la ligne", ligne["teleconseillerId"], b.userID)
	analyticsTexte(b, "journée de la ligne", ligne["bucket"], jourAnalytics)
	analyticsTexte(b, "granularité", body["granularity"], "day")
	analyticsNonNul(b, "borne basse rendue", body["from"])
	analyticsNonNul(b, "borne haute rendue", body["to"])
	analyticsNonNul(b, "notes de rendement", body["scores"])

	vide := "?commercialId=" + b.userID + "&actFrom=2019-01-01&actTo=2019-01-02"
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/activite"+vide, nil, false)
	b.attend(statut, http.StatusOK, "fenêtre sans acte", body)
	totaux = analyticsObjet(b, "totaux hors fenêtre", body["totals"])
	analyticsEgal(b, "appels hors fenêtre", totaux["calls"], 0)
	analyticsNul(b, "sans appel le taux est nul, jamais 0", totaux["reachRate"])
}

func analyticsAppelMotif(b *banc, prospect, motif, quand string) {
	b.t.Helper()
	analyticsExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		SELECT $1,$2,$3,"id",$5::timestamp FROM "call_outcome_reasons" WHERE "code" = $4`,
		uuid.NewString(), prospect, b.userID, motif, quand)
}

// Un rendez-vous se pose en appel, par un statut de la famille « Rendez-vous »
// ou par la méthode datée. Un appel suivant ne l'efface pas, et la fiche compte
// une fois, chez qui l'a posée.
func TestSupervisionActiviteRendezVous(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	analyticsViderCache()
	t.Cleanup(analyticsViderCache)
	jeu := analyticsSemer(b)
	methode := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	telephone := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	site := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	autre := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	jointSansRdv := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsAppel(b, methode, "REACHED")
	analyticsAppel(b, autre, "UNREACHABLE")
	analyticsAppel(b, jointSansRdv, "REACHED")
	analyticsExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","method","rendezVousAt","clientCreatedAt")
		SELECT $1,$2,$3,"id",'RDV_CPI',$4::timestamp,$4::timestamp FROM "call_outcome_reasons" WHERE "code" = 'DEMANDE_INFORMATION'`,
		uuid.NewString(), methode, b.userID, "2026-03-15T11:00:00Z")
	analyticsAppelMotif(b, telephone, "RDV_TELEPHONIQUE", instantAnalytics)
	analyticsAppelMotif(b, telephone, "DEMANDE_INFORMATION", "2026-03-15T12:00:00Z")
	analyticsAppelMotif(b, site, "RV_SITE", instantAnalytics)
	// Le rappel de confirmation sonne dans le vide : la fiche n'est plus « jointe »
	// sur son dernier appel, mais son rendez-vous reste dans le dénominateur.
	analyticsAppelMotif(b, site, "PAS_DE_REPONSE", "2026-03-15T13:00:00Z")
	analyticsViderCache()

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "activité", body)
	totaux := analyticsObjet(b, "totaux", body["totals"])
	analyticsEgal(b, "rendez-vous posés", totaux["rendezVous"], 3)
	analyticsEgal(b, "dont téléphoniques", totaux["rendezVousTelephoniques"], 1)
	analyticsEgal(b, "prospects joints, rendez-vous compris", totaux["rendezVousBase"], 4)
	analyticsEgal(b, "taux sur les prospects joints, jamais au-delà de 100 %", totaux["rendezVousRate"], 75)

	ligne := analyticsObjet(b, "ligne", analyticsListe(b, "une ligne par agent et par jour", body["items"], 1)[0])
	analyticsEgal(b, "rendez-vous de la ligne", ligne["rendezVous"], 3)
	analyticsEgal(b, "téléphoniques de la ligne", ligne["rendezVousTelephoniques"], 1)
	analyticsEgal(b, "base de la ligne", ligne["rendezVousBase"], 4)
	analyticsEgal(b, "taux de la ligne", ligne["rendezVousRate"], 75)

	parType := analyticsObjet(b, "rendez-vous par type de la ligne", ligne["rendezVousParType"])
	analyticsEgal(b, "RV téléphonique", parType["RDV_TELEPHONIQUE"], 1)
	analyticsEgal(b, "RV site", parType["RV_SITE"], 1)
	analyticsEgal(b, "méthode datée sans statut de rendez-vous", parType["METHODE_RENDEZ_VOUS"], 1)
	analyticsEgal(b, "RV téléphonique de l'équipe",
		analyticsObjet(b, "par type de l'équipe", totaux["rendezVousParType"])["RDV_TELEPHONIQUE"], 1)

	types, _ := body["typesRendezVous"].([]any)
	codes := make([]string, 0, len(types))
	for _, t := range types {
		codes = append(codes, analyticsObjet(b, "type", t)["code"].(string))
	}
	for _, attendu := range []string{"RV_CPI", "RV_SITE", "RV_EXTERNE", "RDV_TELEPHONIQUE", "METHODE_RENDEZ_VOUS"} {
		if !slices.Contains(codes, attendu) {
			t.Fatalf("colonne %s absente de %v", attendu, codes)
		}
	}
	if slices.Contains(codes, "RENDEZ_VOUS") {
		t.Fatalf("le parent RENDEZ_VOUS ne doit pas avoir de colonne : %v", codes)
	}
}

func TestSupervisionCampagnesEtStock(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	lot := uuid.NewString()
	analyticsExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById","createdAt")
		VALUES ($1,'Campagne test','REPRESENTANTS','CHUES','{}'::jsonb,1,$2,$3::timestamp)`, lot, b.userID, instantAnalytics)
	analyticsExec(b, `INSERT INTO "lot_export_items" ("lotId","representantId","position","assigneeId","day")
		VALUES ($1,$2,1,$3,1)`, lot, jeu.representant, b.userID)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/campagnes"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "campagnes", body)
	campagne := analyticsObjet(b, "campagne", analyticsListe(b, "campagnes de la fenêtre", body["items"], 1)[0])
	analyticsTexte(b, "identifiant du lot", campagne["id"], lot)
	analyticsEgal(b, "fiches prévues", campagne["prevues"], 1)
	analyticsEgal(b, "fiches appelées", campagne["appelees"], 0)
	analyticsEgal(b, "une fiche confiée non appelée fait un taux de 0", campagne["contactRate"], 0)
	analyticsListe(b, "détail par téléconseiller", campagne["parTeleconseiller"], 1)

	tentative := uuid.NewString()
	analyticsExec(b, `INSERT INTO "rep_call_attempts" ("id","representantId","performedById","statutQualificationId","clientCreatedAt")
		SELECT $1,$2,$3,"id",$4::timestamp FROM "statuts_qualification" WHERE "code" = 'AUTRE_JOINT'`,
		tentative, jeu.representant, b.userID, instantAnalytics)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "rep_call_attempts" WHERE "id" = $1`, tentative)
	})
	analyticsViderCache()
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/campagnes"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "campagnes après l'appel", body)
	campagne = analyticsObjet(b, "campagne", analyticsListe(b, "campagnes de la fenêtre", body["items"], 1)[0])
	analyticsEgal(b, "la fiche appelée compte", campagne["appelees"], 1)
	analyticsEgal(b, "la seule fiche confiée est appelée", campagne["contactRate"], 100)

	// Le stock n'a pas de filtre : sa clé de cache ne porte que le rôle, et une
	// entrée d'un autre test la servirait.
	analyticsViderCache()
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/representants", nil, false)
	b.attend(statut, http.StatusOK, "stock", body)
	if analyticsNombre(b, body["total"], "stock total") < 1 {
		t.Fatalf("le représentant semé doit compter : %v", body)
	}
	analyticsNonNul(b, "répartition par département", body["parDepartement"])
}

// La clé porte la route, la portée et les filtres : deux filtres différents ne
// se servent jamais la même réponse, et l'entrée périmée est relue.
func TestAnalyticsCacheParFiltreEtExpiration(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)

	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement
	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+portee, nil, false)
	b.attend(statut, http.StatusOK, "premier appel", body)
	analyticsEgal(b, "total initial", body["total"], 1)

	analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+portee, nil, false)
	b.attend(statut, http.StatusOK, "second appel", body)
	analyticsEgal(b, "le TTL sert la charge utile précédente", body["total"], 1)

	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+portee+"&dateFrom=2000-01-01", nil, false)
	b.attend(statut, http.StatusOK, "autre filtre", body)
	analyticsEgal(b, "un filtre différent est une autre clé", body["total"], 2)

	analytics.PerimerCache()

	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/by-departement"+portee, nil, false)
	b.attend(statut, http.StatusOK, "après expiration", body)
	analyticsEgal(b, "l'entrée périmée est relue", body["total"], 2)
}

// Le filtre par campagne borne l'écran entier : deux fiches appelées, une seule
// dans la campagne regardée.
func TestSupervisionActiviteParCampagne(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	fiches := []string{
		analyticsProspect(b, &jeu, b.userID, instantAnalytics, true),
		analyticsProspect(b, &jeu, b.userID, instantAnalytics, true),
	}
	lots := []string{uuid.NewString(), uuid.NewString()}
	for indice, lot := range lots {
		analyticsExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById","createdAt")
			VALUES ($1,'Campagne prospects','PROSPECTS','CHUES','{}'::jsonb,1,$2,$3::timestamp)`, lot, b.userID, instantAnalytics)
		analyticsExec(b, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day")
			VALUES ($1,$2,1,$3,1)`, lot, fiches[indice], b.userID)
		analyticsAppel(b, fiches[indice], "METHOD_OBTAINED")
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = ANY($1)`, lots)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = ANY($1)`, lots)
	})

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "activité sans campagne", body)
	analyticsEgal(b, "les deux campagnes confondues", analyticsObjet(b, "totaux", body["totals"])["calls"], 2)

	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre+"&lotId="+lots[0], nil, false)
	b.attend(statut, http.StatusOK, "activité d'une campagne", body)
	totaux := analyticsObjet(b, "totaux de la campagne", body["totals"])
	analyticsEgal(b, "appels de la campagne regardée", totaux["calls"], 1)
	analyticsEgal(b, "fiches de la campagne regardée", totaux["fiches"], 1)

	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/campagnes"+fenetre+"&lotId="+lots[0], nil, false)
	b.attend(statut, http.StatusOK, "campagnes", body)
	campagne := analyticsObjet(b, "campagne", analyticsListe(b, "la campagne regardée seule", body["items"], 1)[0])
	analyticsTexte(b, "identifiant du lot", campagne["id"], lots[0])
}

// Une campagne d'appels représentants borne aussi l'écran : l'appel du
// représentant confié compte, celui d'un représentant hors campagne non.
func TestSupervisionActiviteParCampagneRepresentants(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	horsCampagne := uuid.NewString()
	analyticsExec(b, `INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","updatedAt")
		VALUES ($1,'Representant hors campagne',$2,$3,$4,$5::timestamp,now())`,
		horsCampagne, telephoneAnalytics(), jeu.departement, b.userID, instantAnalytics)
	lot := uuid.NewString()
	analyticsExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById","createdAt")
		VALUES ($1,'Campagne representants','REPRESENTANTS','CHUES','{}'::jsonb,1,$2,$3::timestamp)`, lot, b.userID, instantAnalytics)
	analyticsExec(b, `INSERT INTO "lot_export_items" ("lotId","representantId","position","assigneeId","day")
		VALUES ($1,$2,1,$3,1)`, lot, jeu.representant, b.userID)
	for _, representant := range []string{jeu.representant, horsCampagne} {
		analyticsExec(b, `INSERT INTO "rep_call_attempts" ("id","representantId","performedById","statutQualificationId","clientCreatedAt")
			SELECT $1,$2,$3,"id",$4::timestamp FROM "statuts_qualification" WHERE "code" = 'AUTRE_JOINT'`,
			uuid.NewString(), representant, b.userID, instantAnalytics)
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representants" WHERE "id" = $1`, horsCampagne)
	})

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "activité sans campagne", body)
	analyticsEgal(b, "les deux appels représentants", analyticsObjet(b, "totaux", body["totals"])["repCalls"], 2)

	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre+"&lotId="+lot, nil, false)
	b.attend(statut, http.StatusOK, "activité de la campagne représentants", body)
	totaux := analyticsObjet(b, "totaux de la campagne", body["totals"])
	analyticsEgal(b, "appels représentants de la campagne regardée", totaux["repCalls"], 1)
	analyticsEgal(b, "fiches représentants de la campagne regardée", totaux["repFiches"], 1)
}

// Un appel d'avant le référentiel du 7 septembre 2026 n'a pas de statut : son
// issue fait foi, sinon un représentant joint compte comme jamais atteint.
func TestQualiteBaseCompteUnAppelSansStatutPose(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	chemin := "/api/v1/supervision/representants/qualite"

	analytics.PerimerCache()
	statut, body := b.appel(http.MethodGet, chemin, nil, false)
	b.attend(statut, http.StatusOK, "qualité de la base", body)
	avant := analyticsNombre(b, body["joints"], "joints avant l'appel")

	analyticsExec(b, `UPDATE "representants" SET "lastCallAt" = now(), "lastCallById" = $2,
	                  "statutQualificationId" = (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'AUTRE_JOINT')
	                  WHERE "id" = $1`, jeu.representant, b.userID)
	analytics.PerimerCache()
	statut, body = b.appel(http.MethodGet, chemin, nil, false)
	b.attend(statut, http.StatusOK, "qualité après l'appel", body)
	analyticsEgal(b, "un appel abouti sans statut compte comme joint", body["joints"], avant+1)
}

func analyticsCompte(b *banc, role string, actif bool) string {
	b.t.Helper()
	id := uuid.NewString()
	analyticsExec(b, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","isActive","updatedAt")
		VALUES ($1,$1 || '@cpi.sn',$1,'x','Compte equipe',$2::"Role",$3,now())`, id, role, actif)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "performedById" = $1`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id)
	})
	return id
}

// Un compte désactivé reste au tableau d'équipe s'il a agi dans la période,
// sinon ses actes compteraient au total sans ligne qui les porte.
func TestSupervisionEquipeSansComptesHorsPlateau(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	enPoste := analyticsCompte(b, "COMMERCIAL", true)
	parti := analyticsCompte(b, "COMMERCIAL", false)
	partiApresAvoirAppele := analyticsCompte(b, "COMMERCIAL", false)
	direction := analyticsCompte(b, "DIRECTION", true)
	prospect := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","reasonId","clientCreatedAt")
		SELECT $1,$2,$3,"id",$4::timestamp FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'`,
		uuid.NewString(), prospect, partiApresAvoirAppele, instantAnalytics)
	analyticsViderCache()

	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite?actFrom="+jourAnalytics+"&actTo="+jourAnalytics, nil, false)
	b.attend(statut, http.StatusOK, "activité de l'équipe", body)
	membres, ok := body["teleconseillers"].([]any)
	if !ok {
		t.Fatalf("liste des téléconseillers attendue, %v reçu", body["teleconseillers"])
	}
	listes := map[any]bool{}
	for _, membre := range membres {
		listes[analyticsObjet(b, "membre", membre)["id"]] = true
	}
	attendus := map[string]bool{enPoste: true, parti: false, partiApresAvoirAppele: true, direction: false, b.userID: false}
	for id, attendu := range attendus {
		if listes[id] != attendu {
			t.Fatalf("compte %s listé=%v, attendu %v", id, listes[id], attendu)
		}
	}
}
