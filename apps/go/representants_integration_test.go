//go:build integration

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func representantJSON(b *banc, method, chemin string, corps any) (statut int, reponse map[string]any) {
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

func representantExec(b *banc, sql string, args ...any) {
	b.t.Helper()
	if _, err := b.pool.Exec(b.ctx, sql, args...); err != nil {
		b.t.Fatal(err)
	}
}

// Un département et sa région, plus le ménage de tout ce que les tests
// accrochent dessus. À appeler APRÈS les comptes : le ménage se joue en ordre
// inverse, et un compte se supprime seulement une fois ses fiches parties.
func representantDepartementDeTest(b *banc) string {
	b.t.Helper()
	region, departement := uuid.NewString(), uuid.NewString()
	representantExec(b, `INSERT INTO "regions" ("id","code","name","updatedAt") VALUES ($1,$2,$3,now())`, region, region[:8], "Région test "+region[:8])
	representantExec(b, `INSERT INTO "departements" ("id","code","name","regionId","updatedAt") VALUES ($1,$2,$3,$4,now())`, departement, departement[:8], "Département test "+departement[:8], region)
	b.t.Cleanup(func() {
		const cibles = `SELECT "id" FROM "representants" WHERE "departementId" = $1`
		for _, sql := range []string{
			`DELETE FROM "audit_logs" WHERE "entity" = 'representant' AND "entityId" IN (` + cibles + `)`,
			`DELETE FROM "prospects" WHERE "representantId" IN (` + cibles + `)`,
			`DELETE FROM "representant_comments" WHERE "representantId" IN (` + cibles + `)`,
			`DELETE FROM "representant_relation_changes" WHERE "representantId" IN (` + cibles + `)`,
			`DELETE FROM "lot_export_items" WHERE "representantId" IN (` + cibles + `)`,
			`DELETE FROM "representants" WHERE "departementId" = $1`,
			`DELETE FROM "departements" WHERE "id" = $1`,
		} {
			_, _ = b.pool.Exec(b.ctx, sql, departement)
		}
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "regions" WHERE "id" = $1`, region)
	})
	return departement
}

func representantCompteDeTest(b *banc, role, nom string) (id, email string) {
	b.t.Helper()
	id = uuid.NewString()
	email = "rep-" + id + "@cpi.sn"
	condensat, err := hacherMotDePasse("motdepasse")
	if err != nil {
		b.t.Fatal(err)
	}
	representantExec(b, `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())`,
		id, email, "rep-"+id, condensat, nom, role)
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	return id, email
}

func representantSessionDeTest(b *banc, email string) *banc {
	b.t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		b.t.Fatal(err)
	}
	autre := &banc{t: b.t, ctx: b.ctx, pool: b.pool, ts: b.ts, client: &http.Client{Jar: jar}, email: email}
	statut, body := autre.connexion(email, "motdepasse")
	autre.attend(statut, http.StatusOK, "connexion "+email, body)
	return autre
}

func representantCreer(b *banc, departement, nom, phone string) map[string]any {
	b.t.Helper()
	statut, fiche := representantJSON(b, http.MethodPost, "/api/v1/representants", map[string]any{
		"fullName": nom, "phone": phone, "departementId": departement,
	})
	b.attend(statut, http.StatusCreated, "création de "+nom, fiche)
	return fiche
}

func representantChargeErreur(b *banc, body map[string]any) map[string]any {
	b.t.Helper()
	erreurs, ok := body["errors"].([]any)
	if !ok || len(erreurs) == 0 {
		b.t.Fatalf("erreur sans charge utile : %v", body)
	}
	detail, ok := erreurs[0].(map[string]any)
	if !ok {
		b.t.Fatalf("détail illisible : %v", erreurs[0])
	}
	return detail
}

func representantIdentifiantsListe(b *banc, body map[string]any) []string {
	b.t.Helper()
	items, ok := body["items"].([]any)
	if !ok {
		b.t.Fatalf("liste sans items : %v", body)
	}
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.(map[string]any)["id"].(string))
	}
	return ids
}

func TestRepresentantDoublonDeTelephoneNommeLaFicheEtSonProprietaire(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	fiche := representantCreer(b, departement, "Awa Diop", "77 123 45 67")
	if fiche["phoneE164"] != "+221771234567" || fiche["createdById"] != b.userID || fiche["rev"] != float64(1) {
		t.Fatalf("fiche créée : %v", fiche)
	}

	statut, conflit := representantJSON(b, http.MethodPost, "/api/v1/representants", map[string]any{
		"fullName": "Awa D.", "phone": "+221 77 123 45 67", "departementId": departement,
	})
	b.attend(statut, http.StatusConflict, "même numéro saisi autrement", conflit)
	if conflit["code"] != "REPRESENTANT_PHONE_CONFLICT" {
		t.Fatalf("code : %v", conflit["code"])
	}
	existante := representantChargeErreur(b, conflit)["value"].(map[string]any)
	if existante["id"] != fiche["id"] || existante["ownedByCommercialName"] != "Test Intégration" {
		t.Fatalf("la fiche existante et son propriétaire doivent être nommés : %v", existante)
	}

	var lignes int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "representants" WHERE "phoneE164" = '+221771234567' AND "deletedAt" IS NULL`).Scan(&lignes); err != nil {
		t.Fatal(err)
	}
	if lignes != 1 {
		t.Fatalf("%d fiches sur le même numéro", lignes)
	}
}

func TestRepresentantRevPerimeRefuseLaSecondeEcriture(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	fiche := representantCreer(b, departement, "Moussa Fall", "77 222 33 44")
	chemin := "/api/v1/representants/" + fiche["id"].(string)

	statut, modifiee := representantJSON(b, http.MethodPatch, chemin, map[string]any{"rev": 1, "notes": "premier passage"})
	b.attend(statut, http.StatusOK, "première écriture", modifiee)
	if modifiee["rev"] != float64(2) || modifiee["notes"] != "premier passage" {
		t.Fatalf("écriture : %v", modifiee)
	}

	statut, refus := representantJSON(b, http.MethodPatch, chemin, map[string]any{"rev": 1, "notes": "second passage"})
	b.attend(statut, http.StatusConflict, "révision périmée", refus)
	if refus["code"] != "REV_CONFLICT" {
		t.Fatalf("code : %v", refus["code"])
	}

	var notes string
	if err := b.pool.QueryRow(b.ctx, `SELECT "notes" FROM "representants" WHERE "id" = $1`, fiche["id"]).Scan(&notes); err != nil {
		t.Fatal(err)
	}
	if notes != "premier passage" {
		t.Fatalf("la seconde écriture ne doit rien changer : %q", notes)
	}
}

func TestRepresentantPorteeParRole(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	autreID, autreEmail := representantCompteDeTest(b, "COMMERCIAL", "Autre téléconseiller")
	_, superviseurEmail := representantCompteDeTest(b, "SUPERVISEUR", "Superviseur")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	sienne := representantCreer(b, departement, "Fiche du téléconseiller", "77 300 00 01")

	autre := representantSessionDeTest(b, autreEmail)
	etrangere := representantCreer(autre, departement, "Fiche d’un collègue", "77 300 00 02")
	confiee := representantCreer(autre, departement, "Fiche confiée en campagne", "77 300 00 03")

	lot := uuid.NewString()
	representantExec(b, `INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById") VALUES ($1,'Lot test','REPRESENTANTS','CHUES','{}',1,$2)`, lot, autreID)
	representantExec(b, `INSERT INTO "lot_export_items" ("lotId","representantId","position","assigneeId") VALUES ($1,$2,1,$3)`, lot, confiee["id"], b.userID)
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lot_export_items" WHERE "lotId" = $1`, lot)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "lots_export" WHERE "id" = $1`, lot)
	})

	annuaire := "/api/v1/representants?pageSize=200&departementId=" + departement
	statut, liste := representantJSON(b, http.MethodGet, annuaire, nil)
	b.attend(statut, http.StatusOK, "annuaire du téléconseiller", liste)
	vues := representantIdentifiantsListe(b, liste)
	if len(vues) != 2 || !representantContient(vues, sienne["id"].(string)) || !representantContient(vues, confiee["id"].(string)) {
		t.Fatalf("un téléconseiller ne voit que ses fiches et celles confiées : %v", vues)
	}

	statut, refus := representantJSON(b, http.MethodGet, "/api/v1/representants/"+etrangere["id"].(string), nil)
	b.attend(statut, http.StatusNotFound, "fiche hors périmètre", refus)

	superviseur := representantSessionDeTest(b, superviseurEmail)
	statut, tout := representantJSON(superviseur, http.MethodGet, annuaire, nil)
	superviseur.attend(statut, http.StatusOK, "annuaire du superviseur", tout)
	if len(representantIdentifiantsListe(superviseur, tout)) != 3 {
		t.Fatalf("le superviseur voit tout : %v", tout)
	}
	statut, borne := representantJSON(superviseur, http.MethodGet, annuaire+"&mesFiches=true", nil)
	superviseur.attend(statut, http.StatusOK, "écran d’appel du superviseur", borne)
	if len(representantIdentifiantsListe(superviseur, borne)) != 0 {
		t.Fatalf("mesFiches borne aussi l’encadrement : %v", borne)
	}
}

func representantContient(liste []string, cible string) bool {
	for _, v := range liste {
		if v == cible {
			return true
		}
	}
	return false
}

func TestRepresentantCommentaireRejoueNeDoublePas(t *testing.T) {
	b := nouveauBanc(t, "CHARGE_CLIENTELE")
	_, adminEmail := representantCompteDeTest(b, "ADMIN", "Administrateur")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	fiche := representantCreer(b, departement, "Fatou Sarr", "77 444 55 66")
	chemin := "/api/v1/representants/" + fiche["id"].(string) + "/comments"

	commentaire := map[string]any{"id": uuid.NewString(), "body": "Rappeler après 18 h"}
	statut, pose := representantJSON(b, http.MethodPost, chemin, commentaire)
	b.attend(statut, http.StatusCreated, "commentaire", pose)
	statut, rejeu := representantJSON(b, http.MethodPost, chemin, commentaire)
	b.attend(statut, http.StatusCreated, "rejeu du même identifiant", rejeu)
	if rejeu["id"] != pose["id"] || rejeu["createdAt"] != pose["createdAt"] {
		t.Fatalf("le rejeu doit rendre la ligne déjà enregistrée : %v puis %v", pose, rejeu)
	}

	statut, liste := representantJSON(b, http.MethodGet, chemin, nil)
	b.attend(statut, http.StatusOK, "fil", liste)
	if len(representantIdentifiantsListe(b, liste)) != 1 {
		t.Fatalf("le fil doit porter une seule ligne : %v", liste)
	}

	admin := representantSessionDeTest(b, adminEmail)
	statut, supprime := representantJSON(admin, http.MethodDelete, chemin+"/"+pose["id"].(string), nil)
	admin.attend(statut, http.StatusOK, "suppression douce", supprime)
	var efface *string
	if err := b.pool.QueryRow(b.ctx, `SELECT "deletedAt"::text FROM "representant_comments" WHERE "id" = $1`, pose["id"]).Scan(&efface); err != nil {
		t.Fatal(err)
	}
	if efface == nil {
		t.Fatal("la ligne doit rester en base, marquée supprimée")
	}
}

func TestRepresentantSuppressionExigeLaCascadeQuandDesProspectsPendent(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	fiche := representantCreer(b, departement, "Ibrahima Ndiaye", "77 555 66 77")
	chemin := "/api/v1/representants/" + fiche["id"].(string)

	prospect := uuid.NewString()
	representantExec(b, `INSERT INTO "prospects" ("id","nom","prenom","phoneE164","representantId","createdById","clientCreatedAt","updatedAt") VALUES ($1,'Diallo','Aminata','+221770000099',$2,$3,now(),now())`,
		prospect, fiche["id"], b.userID)

	statut, refus := representantJSON(b, http.MethodDelete, chemin, nil)
	b.attend(statut, http.StatusConflict, "suppression sans cascade", refus)
	if refus["code"] != "REPRESENTANT_HAS_PROSPECTS" || representantChargeErreur(b, refus)["value"] != float64(1) {
		t.Fatalf("le refus doit compter les prospects : %v", refus)
	}

	statut, ok := representantJSON(b, http.MethodDelete, chemin+"?cascade=true", nil)
	b.attend(statut, http.StatusOK, "suppression en cascade", ok)
	var vivants int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM "prospects" p JOIN "representants" r ON r."id" = p."representantId" WHERE p."id" = $1 AND (p."deletedAt" IS NULL OR r."deletedAt" IS NULL)`, prospect).Scan(&vivants); err != nil {
		t.Fatal(err)
	}
	if vivants != 0 {
		t.Fatal("la cascade doit marquer la fiche ET ses prospects")
	}
	statut, absente := representantJSON(b, http.MethodGet, chemin, nil)
	b.attend(statut, http.StatusNotFound, "fiche supprimée", absente)
}

func TestRepresentantJournalDeFicheEtBasculeDeRelation(t *testing.T) {
	b := nouveauBanc(t, "COMMERCIAL")
	departement := representantDepartementDeTest(b)
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)
	fiche := representantCreer(b, departement, "Ndeye Gueye", "77 666 77 88")
	chemin := "/api/v1/representants/" + fiche["id"].(string)

	statut, modifiee := representantJSON(b, http.MethodPatch, chemin, map[string]any{
		"rev": 1, "notes": "a promis dix fiches", "relationStatus": "CONTACTE", "relationReason": "premier appel",
	})
	b.attend(statut, http.StatusOK, "qualification", modifiee)
	if modifiee["relationStatus"] != "CONTACTE" || modifiee["rev"] != float64(3) {
		t.Fatalf("la bascule de relation compte pour une révision de plus : %v", modifiee)
	}

	statut, refus := representantJSON(b, http.MethodPatch, chemin, map[string]any{"rev": 3, "relationStatus": "INCONNU"})
	b.attend(statut, http.StatusForbidden, "retour en arrière de relation", refus)
	if refus["code"] != "REPRESENTANT_RELATION_TRANSITION_REFUSED" {
		t.Fatalf("code : %v", refus["code"])
	}

	statut, bascules := representantJSON(b, http.MethodGet, chemin+"/relation-history", nil)
	b.attend(statut, http.StatusOK, "histoire de la relation", bascules)
	if len(representantIdentifiantsListe(b, bascules)) != 1 {
		t.Fatalf("une seule bascule écrite : %v", bascules)
	}

	statut, versions := representantJSON(b, http.MethodGet, chemin+"/fiche-history", nil)
	b.attend(statut, http.StatusOK, "journal de fiche", versions)
	items := versions["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("création puis modification : %v", versions)
	}
	derniere := items[0].(map[string]any)
	if derniere["source"] != "WEB" || derniere["changedByName"] != "Test Intégration" {
		t.Fatalf("version : %v", derniere)
	}
	champs := derniere["champs"].([]any)
	if len(champs) != 1 || champs[0].(map[string]any)["apres"] != "a promis dix fiches" {
		t.Fatalf("seul le champ modifié est journalisé : %v", champs)
	}
	creation := items[1].(map[string]any)["champs"].([]any)
	if nom, _ := representantChampJournal(b, creation, "departementId")["apres"].(string); !strings.HasPrefix(nom, "Département test") {
		t.Fatalf("le département se lit par son nom : %v", creation)
	}
}

func representantChampJournal(b *banc, champs []any, nom string) map[string]any {
	b.t.Helper()
	for _, champ := range champs {
		ligne := champ.(map[string]any)
		if ligne["champ"] == nom {
			return ligne
		}
	}
	b.t.Fatalf("champ %s absent du journal : %v", nom, champs)
	return nil
}
