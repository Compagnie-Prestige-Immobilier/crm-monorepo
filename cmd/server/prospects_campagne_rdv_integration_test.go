//go:build integration

package main

import (
	"encoding/binary"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func campagneNumeroEssai() string {
	u := uuid.New()
	return fmt.Sprintf("+2217%08d", binary.BigEndian.Uint32(u[:4])%100000000)
}

func campagneListe(b *banc, query string) []any {
	b.t.Helper()
	statut, body := appelJSON(b, http.MethodGet, "/api/v1/prospects?"+query, nil, nil)
	b.attend(statut, http.StatusOK, "liste prospects "+query, body)
	items, _ := body["items"].([]any)
	return items
}

func campagneIDs(items []any) map[string]bool {
	vus := map[string]bool{}
	for _, item := range items {
		if fiche, ok := item.(map[string]any); ok {
			if id, ok := fiche["id"].(string); ok {
				vus[id] = true
			}
		}
	}
	return vus
}

type campagneJeu struct {
	ficheA      string
	ficheB      string
	lot         string
	campagne    string
	commentaire string
	rdv         time.Time
}

// Deux fiches : l'une confiée à une campagne, commentée, avec un rendez-vous
// posé ; l'autre nue. De quoi prouver que la liste, ses filtres et l'export
// disent la même chose.
func semerCampagneRdv(b *banc) campagneJeu {
	b.t.Helper()
	suffixe := uuid.NewString()[:8]
	jeu := campagneJeu{
		ficheA:      uuid.NewString(),
		ficheB:      uuid.NewString(),
		lot:         uuid.NewString(),
		campagne:    "Campagne essai " + suffixe,
		commentaire: "Rappeler après 17 h " + suffixe,
		rdv:         time.Now().Add(72 * time.Hour).UTC().Truncate(time.Millisecond),
	}
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","updatedAt")
	        VALUES ($1,$2,'Awa',$3,$4,now(),now())`,
		jeu.ficheA, "Campagne Awa "+suffixe, campagneNumeroEssai(), b.userID)
	b.exec(`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","createdById","clientCreatedAt","updatedAt")
	        VALUES ($1,$2,'Moussa',$3,$4,now(),now())`,
		jeu.ficheB, "Campagne Moussa "+suffixe, campagneNumeroEssai(), b.userID)
	for _, fiche := range []string{jeu.ficheA, jeu.ficheB} {
		b.exec(`INSERT INTO "prospect_journeys" ("id","prospectId","projet","statut","updatedAt")
		        VALUES ($1,$2,'CHUES','NOUVEAU',now())`, uuid.NewString(), fiche)
	}
	b.exec(`INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById")
	        VALUES ($1,$2,'PROSPECTS','CHUES','{}',1,$3)`, jeu.lot, jeu.campagne, b.userID)
	b.exec(`INSERT INTO "lot_export_items" ("lotId","prospectId","position","day")
	        VALUES ($1,$2,1,1)`, jeu.lot, jeu.ficheA)
	var motif string
	if err := b.pool.QueryRow(b.ctx,
		`SELECT "id" FROM "call_outcome_reasons" WHERE "code" = 'PAS_DE_REPONSE'`).Scan(&motif); err != nil {
		b.t.Fatal(err)
	}
	b.exec(`INSERT INTO "call_attempts" ("id","prospectId","performedById","method","reasonId","comment","rendezVousAt","clientCreatedAt")
	        VALUES ($1,$2,$3,'APPOINTMENT',$4,$5,$6,now())`,
		uuid.NewString(), jeu.ficheA, b.userID, motif, jeu.commentaire, jeu.rdv)
	b.t.Cleanup(func() {
		b.exec(`DELETE FROM "lot_export_items" WHERE "lotId" = $1`, jeu.lot)
		b.exec(`DELETE FROM "lots_export" WHERE "id" = $1`, jeu.lot)
		b.exec(`DELETE FROM "call_attempts" WHERE "prospectId" IN ($1,$2)`, jeu.ficheA, jeu.ficheB)
		b.exec(`DELETE FROM "prospect_journeys" WHERE "prospectId" IN ($1,$2)`, jeu.ficheA, jeu.ficheB)
		b.exec(`DELETE FROM "prospects" WHERE "id" IN ($1,$2)`, jeu.ficheA, jeu.ficheB)
	})
	return jeu
}

func exigerFicheIsolee(b *banc, query, dedans, dehors string) {
	b.t.Helper()
	vus := campagneIDs(campagneListe(b, query))
	if !vus[dedans] || vus[dehors] {
		b.t.Fatalf("filtre %q : attendu %s sans %s", query, dedans[:8], dehors[:8])
	}
}

func TestProspectListeFiltreCampagneCommentaireRdv(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	jeu := semerCampagneRdv(b)

	statut, fiche := appelJSON(b, http.MethodGet, "/api/v1/prospects/"+jeu.ficheA, nil, nil)
	b.attend(statut, http.StatusOK, "lecture fiche A", fiche)
	if fmt.Sprint(fiche["campagne"]) != jeu.campagne {
		t.Fatalf("campagne affichée : %v", fiche["campagne"])
	}
	if rdvLu, _ := fiche["rendezVousAt"].(string); !strings.HasPrefix(rdvLu, jeu.rdv.Format("2006-01-02")) {
		t.Fatalf("RDV posé affiché : %v, attendu le %s", fiche["rendezVousAt"], jeu.rdv.Format("2006-01-02"))
	}
	if fmt.Sprint(fiche["lastComment"]) != jeu.commentaire {
		t.Fatalf("commentaire affiché : %v", fiche["lastComment"])
	}

	exigerFicheIsolee(b, "campagneId="+url.QueryEscape(jeu.lot), jeu.ficheA, jeu.ficheB)
	exigerFicheIsolee(b, "avecRdv=true", jeu.ficheA, jeu.ficheB)
	exigerFicheIsolee(b, "avecCommentaire=true", jeu.ficheA, jeu.ficheB)
	apres := jeu.rdv.Add(24 * time.Hour).Format("2006-01-02")
	avant := jeu.rdv.Add(-24 * time.Hour).Format("2006-01-02")
	exigerFicheIsolee(b, "rdvFrom="+avant+"&rdvTo="+apres, jeu.ficheA, jeu.ficheB)

	vus := campagneIDs(campagneListe(b, "avecRdv=false"))
	if vus[jeu.ficheA] || !vus[jeu.ficheB] {
		t.Fatal("le filtre sans RDV rend la fiche sans appel")
	}
	vus = campagneIDs(campagneListe(b, "rdvFrom="+apres))
	if vus[jeu.ficheA] {
		t.Fatal("une borne après le RDV écarte la fiche")
	}
}

func TestExportProspectsRendCampagneCommentaireEtRdv(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	jeu := semerCampagneRdv(b)

	statut, _, classeur := b.classeur("/api/v1/export/prospects.xlsx?campagneId=" + url.QueryEscape(jeu.lot))
	b.attend(statut, http.StatusOK, "export filtré par campagne", map[string]any{})
	lignes, err := classeur.GetRows("Prospects")
	if err != nil || len(lignes) < 2 {
		t.Fatalf("feuille Prospects illisible : %v", err)
	}
	entetes := map[string]int{}
	for i, entete := range lignes[0] {
		entetes[entete] = i
	}
	for _, attendu := range []string{
		"Campagne", "RDV posé", "Note du classeur", "Suivi du RDV", "Reporté au", "Suite rencontre",
		"Nb appels", "Email", "Établissement", "Revenu", "Paiement", "Type de bien",
		"Origine", "À revoir", "Revue le", "Revue par",
	} {
		if _, ok := entetes[attendu]; !ok {
			t.Fatalf("colonne %q absente de l'export : %v", attendu, lignes[0])
		}
	}
	ligne := lignes[1]
	if ligne[entetes["Campagne"]] != jeu.campagne {
		t.Fatalf("campagne exportée : %q", ligne[entetes["Campagne"]])
	}
	if ligne[entetes["Dernier commentaire"]] != jeu.commentaire {
		t.Fatalf("commentaire exporté : %q", ligne[entetes["Dernier commentaire"]])
	}
	if !strings.HasPrefix(ligne[entetes["RDV posé"]], jeu.rdv.Format("02/01/2006")) {
		t.Fatalf("RDV exporté : %q", ligne[entetes["RDV posé"]])
	}
}
