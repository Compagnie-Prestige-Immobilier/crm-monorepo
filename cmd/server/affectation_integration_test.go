//go:build integration

package main

import (
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
)

// L'encadrement pose le motif sans appel : la fiche suit l'effet du motif,
// aucun appel n'est ajouté, et le rappel promis revient au dernier appelant.
func TestRequalificationParMotifSansAppel(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(b)
	appel := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "HESITANT"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "hésitant consigné", body)

	chemin := "/api/v1/prospects/" + fiche + "/statut-qualification"
	interesse := map[string]any{"reasonCode": "INTERESSE"}
	statut, body = qualificationEnvoi(b, http.MethodPost, chemin, interesse)
	b.attend(statut, http.StatusForbidden, "requalification hors encadrement", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, interesse)
	superviseur.attend(statut, http.StatusOK, "intéressé posé sans appel", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "INTERESTED" {
		t.Fatalf("la fiche suit le motif posé : %s", lu)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1`, fiche); n != 1 {
		t.Fatalf("aucun appel ne s'ajoute : %d", n)
	}
	if _, ids := qualificationTotalProspects(b, "&phase2Status=INTERESTED"); !slices.Contains(ids, fiche) {
		t.Fatalf("onglet Intéressés : %v", ids)
	}

	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"reasonCode": "CALLBACK"})
	superviseur.attend(statut, http.StatusBadRequest, "un rappel exige sa date", body)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"reasonCode": "CALLBACK", "callbackAt": quand})
	superviseur.attend(statut, http.StatusOK, "rappel posé", body)
	if lu := qualificationStatutPhase2(b, fiche); lu != "PENDING" {
		t.Fatalf("à rappeler rouvre la fiche : %s", lu)
	}
	var assigne string
	if err := b.pool.QueryRow(b.ctx, `SELECT "assignedToId" FROM "scheduled_callbacks" WHERE "prospectId" = $1 AND "status" = 'PENDING'`, fiche).Scan(&assigne); err != nil {
		t.Fatal(err)
	}
	if assigne != b.userID {
		t.Fatalf("le rappel revient au dernier appelant : %s", assigne)
	}
}

func TestRequalificationRepresentantParStatut(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	rep := qualificationRepresentant(b)
	chemin := "/api/v1/representants/" + rep + "/statut-qualification"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rep)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "representant_relation_changes" WHERE "representantId" = $1`, rep)
	})
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"statutQualificationId": qualificationStatutID(b, "A_RAPPELER")})
	superviseur.attend(statut, http.StatusBadRequest, "à rappeler sans date", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"statutQualificationId": qualificationStatutID(b, "REFUSE")})
	superviseur.attend(statut, http.StatusOK, "refusé posé sans appel", body)
	var code string
	if err := b.pool.QueryRow(b.ctx, `SELECT sq."code" FROM "representants" r JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId" WHERE r."id" = $1`, rep).Scan(&code); err != nil {
		t.Fatal(err)
	}
	if code != "REFUSE" {
		t.Fatalf("la fiche porte le statut posé : %s", code)
	}
	if n := qualificationCompte(b, `SELECT count(*) FROM "rep_call_attempts" WHERE "representantId" = $1`, rep); n != 0 {
		t.Fatalf("aucun appel ne s'ajoute : %d", n)
	}
}

// Un rendez-vous téléphonique n'est pas un rendez-vous : l'onglet l'écarte.
func TestRubriqueRendezVousEcarteLeTelephonique(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	physique, telephonique := qualificationProspect(b), qualificationProspect(b)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	appels := []map[string]any{
		qualificationCorpsTentative(physique, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}),
		qualificationCorpsTentative(telephonique, map[string]any{"reasonCode": "RDV_TELEPHONIQUE", "callbackAt": quand}),
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" IN ($1, $2)`, physique, telephonique)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2)`, physique, telephonique)
	})
	for _, appel := range appels {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "rendez-vous consigné", body)
	}
	_, ids := qualificationTotalProspects(b, "&phase2Status=APPOINTMENT&sansMotif=RDV_TELEPHONIQUE")
	if !slices.Contains(ids, physique) || slices.Contains(ids, telephonique) {
		t.Fatalf("onglet Rendez-vous : %v", ids)
	}
}

// Le filtre « Résultat de l'appel » suit le statut du formulaire, précisions comprises.
func TestFiltreResultatSuitLeStatutDuFormulaire(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	partenariat, information, rendezVous := qualificationProspect(b), qualificationProspect(b), qualificationProspect(b)
	quand := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "scheduled_callbacks" WHERE "prospectId" = $1`, rendezVous)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2, $3)`, partenariat, information, rendezVous)
	})
	for _, appel := range []map[string]any{
		qualificationCorpsTentative(partenariat, map[string]any{"reasonCode": "PARTENARIAT"}),
		qualificationCorpsTentative(information, map[string]any{"reasonCode": "DEMANDE_INFORMATION"}),
		qualificationCorpsTentative(rendezVous, map[string]any{"reasonCode": "RV_CPI", "callbackAt": quand}),
	} {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "appel consigné", body)
	}
	for motif, attendu := range map[string]string{"PARTENARIAT": partenariat, "RENDEZ_VOUS": rendezVous} {
		total, ids := qualificationTotalProspects(b, "&motif="+motif)
		if total != 1 || !slices.Equal(ids, []string{attendu}) {
			t.Fatalf("motif %s : %d fiche(s) %v", motif, total, ids)
		}
	}
}

// « Affecter à » change le titulaire ; la campagne en cours et le rappel promis
// suivent, l'appel passé reste à son auteur.
func TestAffectationDUneFicheSuitCampagneEtRappel(t *testing.T) {
	avant := qualificationConnecte(t, "COMMERCIAL")
	apres := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	fiche := qualificationProspect(avant)
	lot := uuid.NewString()
	qualificationExec(avant, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                          VALUES ($1,'Campagne affectation','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, superviseur.userID)
	qualificationExec(avant, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, fiche, avant.userID)
	rappelPromis(avant, fiche, avant.userID)
	t.Cleanup(func() {
		_, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "audit_logs" WHERE "entityId" IN ($1, $2)`, fiche, lot)
		_, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	chemin := "/api/v1/prospects/" + fiche + "/affecter"
	corps := map[string]any{"teleconseillerId": apres.userID}
	statut, body := qualificationEnvoi(avant, http.MethodPost, chemin, corps)
	avant.attend(statut, http.StatusForbidden, "affectation hors encadrement", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, corps)
	superviseur.attend(statut, http.StatusOK, "fiche affectée", body)
	if n, _ := body["campagnes"].(float64); n != 1 {
		t.Fatalf("la campagne en cours suit : %v", body["campagnes"])
	}
	var titulaire, attributaire, rappel string
	if err := avant.pool.QueryRow(avant.ctx, `SELECT p."createdById", i."assigneeId", c."assignedToId"
		FROM "prospects" p
		JOIN "lot_export_items" i ON i."prospectId" = p."id" AND i."lotId" = $2
		JOIN "scheduled_callbacks" c ON c."prospectId" = p."id" AND c."status" = 'PENDING'
		WHERE p."id" = $1`, fiche, lot).Scan(&titulaire, &attributaire, &rappel); err != nil {
		t.Fatal(err)
	}
	if titulaire != apres.userID || attributaire != apres.userID || rappel != apres.userID {
		t.Fatalf("titulaire, campagne et rappel suivent : %s %s %s", titulaire, attributaire, rappel)
	}
	if n := qualificationCompte(avant, `SELECT count(*) FROM "lot_export_reaffectations" WHERE "lotId" = $1 AND "toAssigneeId" = $2`, lot, apres.userID); n != 1 {
		t.Fatalf("la réaffectation de campagne est tracée : %d", n)
	}
	if n := qualificationCompte(avant, `SELECT count(*) FROM "call_attempts" WHERE "prospectId" = $1 AND "performedById" = $2`, fiche, avant.userID); n != 1 {
		t.Fatalf("l'appel passé reste à son auteur : %d", n)
	}
}

func TestAffectationDUnRepresentant(t *testing.T) {
	avant := qualificationConnecte(t, "COMMERCIAL")
	apres := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	rep := qualificationRepresentant(avant)
	t.Cleanup(func() { _, _ = avant.pool.Exec(avant.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, rep) })
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, "/api/v1/representants/"+rep+"/affecter",
		map[string]any{"teleconseillerId": apres.userID})
	superviseur.attend(statut, http.StatusOK, "représentant affecté", body)
	var titulaire string
	if err := avant.pool.QueryRow(avant.ctx, `SELECT "createdById" FROM "representants" WHERE "id" = $1`, rep).Scan(&titulaire); err != nil {
		t.Fatal(err)
	}
	if titulaire != apres.userID {
		t.Fatalf("le titulaire change : %s", titulaire)
	}
}

// Affecter à une campagne : la fiche y entre, va au membre le moins chargé et
// passe en tête de son reste à appeler.
func TestAffectationAUneCampagneVaAuMoinsCharge(t *testing.T) {
	charge := qualificationConnecte(t, "COMMERCIAL")
	libre := qualificationConnecte(t, "COMMERCIAL")
	superviseur := qualificationConnecte(t, "SUPERVISEUR")
	ancienne, nouvelle := qualificationProspect(charge), qualificationProspect(superviseur)
	// Plus récente que la fiche affectée : sans priorité, elle passerait devant.
	propre := qualificationProspect(libre)
	lot := uuid.NewString()
	filtres := `{"distribution":{"teleconseillerIds":["` + charge.userID + `","` + libre.userID + `"]}}`
	qualificationExec(charge, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                           VALUES ($1,'Campagne équipe','PROSPECTS','CHUES',$2::jsonb,1,$3)`, lot, filtres, superviseur.userID)
	qualificationExec(charge, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, ancienne, charge.userID)
	t.Cleanup(func() {
		_, _ = charge.pool.Exec(charge.ctx, `DELETE FROM "audit_logs" WHERE "entityId" IN ($1, $2)`, nouvelle, lot)
		_, _ = charge.pool.Exec(charge.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	chemin := "/api/v1/prospects/" + nouvelle + "/affecter"
	statut, body := qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"teleconseillerId": libre.userID, "campagneId": lot})
	superviseur.attend(statut, http.StatusBadRequest, "une seule destination", body)
	statut, body = qualificationEnvoi(superviseur, http.MethodPost, chemin, map[string]any{"campagneId": lot})
	superviseur.attend(statut, http.StatusOK, "affectée à la campagne", body)
	if vers, _ := body["teleconseillerId"].(string); vers != libre.userID {
		t.Fatalf("le membre le moins chargé reçoit la fiche : %s", vers)
	}
	var attributaire string
	var position int
	if err := charge.pool.QueryRow(charge.ctx, `SELECT "assigneeId", "position" FROM "lot_export_items" WHERE "lotId" = $1 AND "prospectId" = $2`,
		lot, nouvelle).Scan(&attributaire, &position); err != nil {
		t.Fatal(err)
	}
	if attributaire != libre.userID || position != 2 {
		t.Fatalf("la fiche entre dans la campagne chez le moins chargé : %s %d", attributaire, position)
	}
	if n := qualificationCompte(charge, `SELECT "itemCount" FROM "lots_export" WHERE "id" = $1`, lot); n != 2 {
		t.Fatalf("la campagne compte la fiche : %d", n)
	}
	_, ids := qualificationTotalProspects(libre, "&resteAAppeler=true")
	if len(ids) < 2 || ids[0] != nouvelle || !slices.Contains(ids, propre) {
		t.Fatalf("la fiche affectée passe en tête du reste à appeler : %v", ids)
	}
}

// Celui qui joint le prospect le garde : un appel injoignable ne change rien,
// le premier appel où la personne répond fait du collègue le titulaire.
func TestCeluiQuiJointLeProspectLeGarde(t *testing.T) {
	titulaire := qualificationConnecte(t, "COMMERCIAL")
	collegue := qualificationConnecte(t, "COMMERCIAL")
	fiche := qualificationProspect(titulaire)
	lot := uuid.NewString()
	qualificationExec(titulaire, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	                              VALUES ($1,'Relance injoignables','PROSPECTS','CHUES','{}'::jsonb,1,$2)`, lot, titulaire.userID)
	qualificationExec(titulaire, `INSERT INTO "lot_export_items" ("lotId","prospectId","position","assigneeId","day") VALUES ($1,$2,1,$3,1)`,
		lot, fiche, collegue.userID)
	t.Cleanup(func() {
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" = $1`, fiche)
		_, _ = titulaire.pool.Exec(titulaire.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})
	proprietaire := func() string {
		var id string
		if err := titulaire.pool.QueryRow(titulaire.ctx, `SELECT "createdById" FROM "prospects" WHERE "id" = $1`, fiche).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	// Importée par l'admin, la fiche n'a pas encore de suivi : le premier appel la prend.
	admin := qualificationConnecte(t, "ADMIN")
	qualificationExec(admin, `UPDATE "prospects" SET "createdById" = $2 WHERE "id" = $1`, fiche, admin.userID)
	statut, body := qualificationEnvoi(collegue, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, nil))
	collegue.attend(statut, http.StatusOK, "premier appel, injoignable", body)
	if proprietaire() != collegue.userID {
		t.Fatal("une fiche importée va au premier qui l'appelle")
	}
	// La relance suivante confie la fiche à un autre.
	qualificationExec(admin, `UPDATE "lot_export_items" SET "assigneeId" = $2 WHERE "lotId" = $1`, lot, titulaire.userID)
	statut, body = qualificationEnvoi(titulaire, http.MethodPost, "/api/v1/phase2/call-attempts", qualificationCorpsTentative(fiche, nil))
	titulaire.attend(statut, http.StatusOK, "injoignable consigné", body)
	if proprietaire() != collegue.userID {
		t.Fatal("un appel injoignable ne change pas de titulaire")
	}
	statut, body = qualificationEnvoi(titulaire, http.MethodPost, "/api/v1/phase2/call-attempts",
		qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "HESITANT"}))
	titulaire.attend(statut, http.StatusOK, "joint consigné", body)
	if proprietaire() != titulaire.userID {
		t.Fatal("celui qui joint le prospect le garde")
	}
}

// « Mes contacts » montre le parcours du téléconseiller jusqu'à la vente, y
// compris une vente posée depuis le classeur des ventes.
func TestPipelineDesContactsJusquALaVente(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	autre := qualificationConnecte(t, "COMMERCIAL")
	vendue, injoignable := qualificationProspect(b), qualificationProspect(b)
	appels := []map[string]any{
		qualificationCorpsTentative(vendue, map[string]any{"reasonCode": "INTERESSE"}),
		qualificationCorpsTentative(injoignable, nil),
	}
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "prospectId" IN ($1, $2)`, vendue, injoignable)
	})
	for _, appel := range appels {
		statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
		b.attend(statut, http.StatusOK, "appel consigné", body)
	}
	qualificationExec(b, `UPDATE "prospects" SET "statut" = 'VENDU' WHERE "id" = $1`, vendue)

	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/pipeline?appelePar="+autre.userID, nil)
	b.attend(statut, http.StatusOK, "pipeline", body)
	if body["appelees"] != float64(2) || body["joignables"] != float64(1) || body["vendues"] != float64(1) {
		t.Fatalf("le téléconseiller voit son propre parcours, quel que soit l'appelePar demandé : %v", body)
	}
	statut, body = qualificationEnvoi(autre, http.MethodGet, "/api/v1/prospects/pipeline", nil)
	autre.attend(statut, http.StatusOK, "pipeline d'un autre", body)
	if body["appelees"] != float64(0) {
		t.Fatalf("les fiches d'un collègue ne comptent pas : %v", body)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/clients", nil)
	b.attend(statut, http.StatusOK, "clients", body)
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("la fiche vendue est un client, sans vente rapprochée : %v", body)
	}
	client, _ := items[0].(map[string]any)
	if rapprochee, _ := client["vente"].(bool); client["id"] != vendue || rapprochee {
		t.Fatalf("client sans vente rapprochée : %v", items[0])
	}
}

// Une vente saisie vaut conversion : la fiche jointe passe vendue sans passer
// par la conversion, et la vente se lit dans les clients du téléconseiller.
func TestVenteSaisieVendLaFicheJointe(t *testing.T) {
	b := qualificationConnecte(t, "COMMERCIAL")
	direction := qualificationConnecte(t, "DIRECTION")
	fiche := qualificationProspect(b)
	// Un numéro mobile sénégalais valide : la saisie normalise le téléphone avant le rapprochement.
	telephone := "+22177" + strconv.FormatInt(time.Now().UnixNano()%10_000_000+1_000_000, 10)[:7]
	qualificationExec(b, `UPDATE "prospects" SET "phoneE164" = $2 WHERE "id" = $1`, fiche, telephone)
	appel := qualificationCorpsTentative(fiche, map[string]any{"reasonCode": "INTERESSE"})
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "ventes" WHERE "telephone" = $1`, telephone)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "audit_logs" WHERE "entityId" = $1`, fiche)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "call_attempts" WHERE "id" = $1`, appel["id"])
	})
	statut, body := qualificationEnvoi(b, http.MethodPost, "/api/v1/phase2/call-attempts", appel)
	b.attend(statut, http.StatusOK, "intéressé consigné", body)

	vente := map[string]any{
		"canal": "CPI", "dateSouscription": "2026-09-18", "client": "CLIENT " + fiche[:8],
		"telephone": telephone, "site": "THIEO", "nombreLots": 1, "numerosLots": "2001",
		"superficie": "225 m²", "prixUnitaire": 2800000, "acompte": 500000, "modePaiement": "COMPTANT",
	}
	statut, body = qualificationEnvoi(direction, http.MethodPost, "/api/v1/ventes", vente)
	direction.attend(statut, http.StatusCreated, "vente saisie", body)

	var statutFiche, parcours string
	if err := b.pool.QueryRow(b.ctx, `SELECT p."statut"::text, j."statut"::text FROM "prospects" p
		JOIN "prospect_journeys" j ON j."prospectId" = p."id" AND j."projet" = p."projet" WHERE p."id" = $1`, fiche).Scan(&statutFiche, &parcours); err != nil {
		t.Fatal(err)
	}
	if statutFiche != "VENDU" || parcours != "VENDU" {
		t.Fatalf("une vente vaut conversion : %s %s", statutFiche, parcours)
	}
	statut, body = qualificationEnvoi(b, http.MethodGet, "/api/v1/prospects/clients", nil)
	b.attend(statut, http.StatusOK, "clients", body)
	items, _ := body["items"].([]any)
	client, _ := items[0].(map[string]any)
	rapprochee, _ := client["vente"].(bool)
	if len(items) != 1 || !rapprochee || client["site"] != "THIEO" || client["prixTotal"] != float64(2800000) {
		t.Fatalf("la vente se lit chez le téléconseiller : %v", items)
	}
}

func TestComptageSepareLesRequalifications(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	connecte(b)
	requalifiee, premiere := qualificationProspect(b), qualificationProspect(b)
	t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "ouvertures_fiche" WHERE "openedById" = $1`, b.userID) })
	ouvrir := func(prospect string, ilYA time.Duration, tentative any) {
		qualificationExec(b, `INSERT INTO "ouvertures_fiche" ("id","openedById","prospectId","openedAt","closedAt","closingAttemptId","updatedAt")
		                      VALUES ($1,$2,$3,now() - $4::interval,now() - $4::interval + interval '1 minute',$5,now())`,
			uuid.NewString(), b.userID, prospect, fmt.Sprintf("%d seconds", int(ilYA.Seconds())), tentative)
	}
	ouvrir(requalifiee, 3*time.Hour, uuid.NewString())
	ouvrir(requalifiee, 2*time.Hour, uuid.NewString())
	ouvrir(requalifiee, time.Hour, nil)
	ouvrir(premiere, time.Hour, uuid.NewString())

	statut, body := qualificationEnvoi(b, http.MethodGet, "/api/v1/ouvertures/comptage", nil)
	b.attend(statut, http.StatusOK, "comptage des ouvertures", body)
	totaux := map[string]float64{}
	for _, ligne := range body["items"].([]any) {
		for cle, valeur := range ligne.(map[string]any) {
			if nombre, ok := valeur.(float64); ok {
				totaux[cle] += nombre
			}
		}
	}
	attendus := map[string]float64{"ouvertures": 4, "qualifiees": 3, "ouverturesDejaQualifiees": 2, "requalifiees": 1}
	for cle, attendu := range attendus {
		if totaux[cle] != attendu {
			t.Fatalf("%s = %v, attendu %v (%v)", cle, totaux[cle], attendu, totaux)
		}
	}
}
