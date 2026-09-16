//go:build integration

package main

import (
	"cpi-go/internal/analytics"
	"fmt"
	"net/http"
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
	methode := any(nil)
	if issue == "METHOD_OBTAINED" {
		methode = "WHATSAPP"
	}
	analyticsExec(b, `INSERT INTO "call_attempts" ("id","prospectId","performedById","outcome","method","clientCreatedAt")
		VALUES ($1,$2,$3,$4::"CallOutcome",$5::"EnrollmentMethod",$6::timestamp)`,
		uuid.NewString(), prospect, b.userID, issue, methode, instantAnalytics)
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
	analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	portee := "?commercialId=" + b.userID + "&departementId=" + jeu.departement

	statut, body := b.appel(http.MethodGet, "/api/v1/analytics/funnel"+portee, nil, false)
	b.attend(statut, http.StatusOK, "entonnoir", body)
	etapes := analyticsListe(b, "étapes", body["etapes"], 4)
	sommet := analyticsObjet(b, "sommet", etapes[0])
	methode := analyticsObjet(b, "méthode obtenue", etapes[1])
	dossier := analyticsObjet(b, "dossier ouvert", etapes[2])
	analyticsEgal(b, "prospects saisis", sommet["count"], 2)
	analyticsEgal(b, "méthodes obtenues", methode["count"], 1)
	analyticsEgal(b, "taux global de la deuxième étape", methode["tauxGlobal"], 50)
	analyticsNonNul(b, "taux d'une étape précédente non vide", dossier["tauxEtapePrecedente"])

	finance := analyticsObjet(b, "finance", body["finance"])
	analyticsTexte(b, "montant encaissé sans dossier", finance["montantEncaisse"], "0")
	analyticsNul(b, "délai moyen sans dossier clos", finance["delaiMoyenJours"])
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

func TestSupervisionCreneauxOrdonnesEtSansChevauchement(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "app_settings" WHERE "key" = 'supervision.creneaux'`)
	})

	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/creneaux", nil, false)
	b.attend(statut, http.StatusOK, "créneaux", body)
	analyticsListe(b, "matin et après-midi", body["shifts"], 2)

	refus := []struct {
		quoi   string
		statut int
		corps  map[string]string
	}{
		{"créneaux qui se chevauchent", http.StatusBadRequest, map[string]string{
			"morningStart": "09:00", "morningEnd": "16:00", "afternoonStart": "15:00", "afternoonEnd": "18:00",
		}},
		{"créneau inversé", http.StatusBadRequest, map[string]string{
			"morningStart": "14:00", "morningEnd": "09:00", "afternoonStart": "15:00", "afternoonEnd": "18:00",
		}},
		{"arité de deux créneaux exigée", http.StatusUnprocessableEntity, map[string]string{
			"morningStart": "09:00", "morningEnd": "12:00",
		}},
		{"heure hors format", http.StatusUnprocessableEntity, map[string]string{
			"morningStart": "9h", "morningEnd": "12:00", "afternoonStart": "15:00", "afternoonEnd": "18:00",
		}},
	}
	for _, cas := range refus {
		statut, body = b.appel(http.MethodPut, "/api/v1/supervision/creneaux", cas.corps, true)
		b.attend(statut, cas.statut, cas.quoi, body)
	}

	valide := map[string]string{
		"morningStart": "08:00", "morningEnd": "12:00",
		"afternoonStart": "13:00", "afternoonEnd": "17:00",
	}
	statut, body = b.appel(http.MethodPut, "/api/v1/supervision/creneaux", valide, true)
	b.attend(statut, http.StatusOK, "créneaux acceptés", body)
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/creneaux", nil, false)
	b.attend(statut, http.StatusOK, "relecture", body)
	matin := analyticsObjet(b, "matin", analyticsListe(b, "créneaux relus", body["shifts"], 2)[0])
	analyticsTexte(b, "début du matin", matin["start"], "08:00")
	analyticsTexte(b, "fin du matin", matin["end"], "12:00")
	analyticsNonNul(b, "date de mise à jour", body["updatedAt"])
}

func TestSupervisionActiviteDeLaFenetre(t *testing.T) {
	b := analyticsConnexion(t, "SUPERVISEUR")
	jeu := analyticsSemer(b)
	joint := analyticsProspect(b, &jeu, b.userID, instantAnalytics, true)
	perdu := analyticsProspect(b, &jeu, b.userID, instantAnalytics, false)
	analyticsAppel(b, joint, "METHOD_OBTAINED")
	analyticsAppel(b, perdu, "UNREACHABLE")

	fenetre := "?commercialId=" + b.userID + "&actFrom=" + jourAnalytics + "&actTo=" + jourAnalytics
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite"+fenetre, nil, false)
	b.attend(statut, http.StatusOK, "activité", body)
	totaux := analyticsObjet(b, "totaux", body["totals"])
	analyticsEgal(b, "appels", totaux["calls"], 2)
	analyticsEgal(b, "méthodes obtenues", totaux["methodObtained"], 1)
	analyticsEgal(b, "injoignables", totaux["unreachable"], 1)
	analyticsEgal(b, "seule l'issue UNREACHABLE sort du numérateur", totaux["reachRate"], 50)
	analyticsEgal(b, "fiches de la fenêtre", totaux["fiches"], 2)
	analyticsEgal(b, "fiches jointes", totaux["fichesJointes"], 1)
	analyticsEgal(b, "fiches saisies", totaux["prospectsCreated"], 2)

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
