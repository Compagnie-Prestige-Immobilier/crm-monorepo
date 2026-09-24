//go:build integration

package main

import (
	"fmt"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
)

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
