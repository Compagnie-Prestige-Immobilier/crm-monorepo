//go:build integration

package main

import (
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Le courriel de démonstration semé par le factory, seule ligne dont l'identité
// est fixe et donc citable depuis un test.
const courrielFactory = "0199f100-0000-701e-8000-000000000001"

type baseDemo struct {
	nom     string
	baseSQL string
	admin   string
}

func creerBaseDemo(b *banc, suffixe string) *baseDemo {
	b.t.Helper()
	nom := "isole-" + suffixe
	d := &baseDemo{nom: nom, baseSQL: prefixeBaseSQL + strings.ReplaceAll(nom, "-", "_")}
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bases_demonstration" WHERE "nom" = $1`, nom)
		_ = detruireBaseSQL(b.ctx, b.dsn, d.baseSQL)
	})
	statut, body := appelJSON(b, http.MethodPost, cheminBases, map[string]any{"nom": nom}, nil)
	b.attend(statut, http.StatusCreated, "création de la base "+nom, body)
	d.admin = adminDansBase(b, d.baseSQL)
	return d
}

// Le semis d'administrateur dépend de SEED_ADMIN_*, absent du banc d'essai : on
// pose le compte à la main pour entrer dans la base par la vraie connexion.
func adminDansBase(b *banc, baseSQL string) string {
	b.t.Helper()
	email := "admin-" + uuid.NewString() + "@cpi.sn"
	condensat, err := database.HacherMotDePasse("motdepasse")
	if err != nil {
		b.t.Fatal(err)
	}
	execDansBase(b, baseSQL,
		`INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
		 VALUES ($1,$2,$3,$4,'Admin isolation','ADMIN',now())`,
		uuid.NewString(), email, strings.Split(email, "@")[0], condensat)
	return email
}

func connexionDansBase(b *banc, d *baseDemo) {
	b.t.Helper()
	basculer(b, d.nom)
	statut, body := b.connexion(d.admin, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion dans "+d.nom, body)
}

func basculer(b *banc, base string) {
	b.t.Helper()
	b.client.Jar.SetCookies(mustURL(b.t, b.ts.URL),
		[]*http.Cookie{{Name: socle.NomCookieBase, Value: base, Path: "/"}})
}

func execDansBase(b *banc, baseSQL, requete string, args ...any) {
	b.t.Helper()
	url, err := urlPourBase(b.dsn, baseSQL)
	if err != nil {
		b.t.Fatal(err)
	}
	conn, err := pgx.Connect(b.ctx, url)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = conn.Close(b.ctx) }()
	if _, err := conn.Exec(b.ctx, requete, args...); err != nil {
		b.t.Fatal(err)
	}
}

func valeurDansBase(b *banc, baseSQL, requete string) string {
	b.t.Helper()
	url, err := urlPourBase(b.dsn, baseSQL)
	if err != nil {
		b.t.Fatal(err)
	}
	conn, err := pgx.Connect(b.ctx, url)
	if err != nil {
		b.t.Fatal(err)
	}
	defer func() { _ = conn.Close(b.ctx) }()
	var valeur string
	if err := conn.QueryRow(b.ctx, requete).Scan(&valeur); err != nil {
		b.t.Fatal(err)
	}
	return valeur
}

func comptePublic(b *banc, requete string, args ...any) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, requete, args...).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

// Une écriture faite depuis une base de démonstration ne doit atteindre aucune
// ligne de la base principale : c'est la seule garantie qui compte.
func TestBaseDemoNEcritPasDansLaBasePublique(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "ecriture")

	avant := comptePublic(b, `SELECT count(*) FROM "client_creation_requests"`)
	connexionDansBase(b, d)

	// La banque se lit dans la base de démonstration : ses référentiels ont
	// leurs propres identifiants, ceux de la base publique n'y existent pas.
	banqueID := valeurDansBase(b, d.baseSQL, `SELECT "id" FROM "banques" ORDER BY "id" LIMIT 1`)
	telephone := fmt.Sprintf("+22177%07d", uuid.New().ID()%10000000)
	nom := "Isolation" + uuid.NewString()[:8]
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/client-requests", map[string]any{
		"nom": nom, "prenom": "Demo", "phone": telephone, "banqueId": banqueID,
	}, nil)
	b.attend(statut, http.StatusCreated, "demande créée dans la base de démonstration", body)

	if n := comptePublic(b, `SELECT count(*) FROM "client_creation_requests" WHERE "nom" = $1`, nom); n != 0 {
		t.Fatalf("la demande a fui dans la base publique : %d ligne(s)", n)
	}
	if n := comptePublic(b, `SELECT count(*) FROM "client_creation_requests"`); n != avant {
		t.Fatalf("la base publique est passée de %d à %d demandes", avant, n)
	}
	if n := compterDansBase(t, b, d.baseSQL,
		`SELECT count(*) FROM "client_creation_requests" WHERE "nom" = '`+nom+`'`); n != 1 {
		t.Fatalf("la demande devait rester dans la base de démonstration : %d ligne(s)", n)
	}
}

// Le cookie de base est fourni par le navigateur, donc par n'importe qui. Une
// session ouverte sur une base de démonstration ne doit rien valoir ailleurs.
func TestBaseDemoSessionNeVautRienSurLaBasePublique(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "session")
	connexionDansBase(b, d)

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/auth/me", nil, nil)
	b.attend(statut, http.StatusOK, "session valide dans sa base", body)

	basculer(b, socle.BasePublique)
	statut, body = appelJSON(b, http.MethodGet, "/api/v1/auth/me", nil, nil)
	if statut != http.StatusUnauthorized {
		t.Fatalf("la session de démonstration ne doit pas ouvrir la base publique : %d %v", statut, body)
	}
}

// Les adresses d'une base de démonstration sont celles de vrais clients. Le
// renvoi d'un courriel partait pourtant chez Brevo sans passer par la garde.
func TestBaseDemoNExpedieAucunCourriel(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "courriel")
	connexionDansBase(b, d)

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/courriels/"+courrielFactory+"/renvoyer", nil, nil)
	b.attend(statut, http.StatusOK, "renvoi depuis la base de démonstration", body)

	erreur, _ := body["erreur"].(string)
	if !strings.Contains(erreur, "démonstration") {
		t.Fatalf("le courriel devait être retenu, pas expédié : %v", body)
	}
	if statutCourriel, _ := body["statut"].(string); statutCourriel == "ENVOYE" {
		t.Fatalf("un courriel a été marqué envoyé depuis une base de démonstration : %v", body)
	}
}

// Une base de démonstration ne doit pouvoir ni en créer, ni en supprimer une
// autre : sinon un compte de démonstration commande le serveur Postgres.
func TestBaseDemoNeGereAucuneBase(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "gestion")
	connexionDansBase(b, d)

	for _, appel := range []struct {
		methode, chemin string
		corps           map[string]any
	}{
		{http.MethodPost, cheminBases, map[string]any{"nom": "issue-demo"}},
		{http.MethodDelete, cheminBases + "/" + d.nom, nil},
		{http.MethodGet, cheminBases, nil},
	} {
		statut, body := appelJSON(b, appel.methode, appel.chemin, appel.corps, nil)
		if statut != http.StatusForbidden {
			t.Fatalf("%s %s depuis une base de démonstration : 403 attendu, %d reçu %v",
				appel.methode, appel.chemin, statut, body)
		}
	}
}

// Les tâches relèveraient le vrai classeur SharePoint et écriraient aux vraies
// adresses : aucune ne doit être planifiée hors de la base principale.
func TestBaseDemoNePlanifieAucuneTache(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "taches")

	statut, body := appelJSON(b, http.MethodGet, "/api/v1/admin/exploitation", nil, nil)
	b.attend(statut, http.StatusOK, "exploitation de la base publique", body)
	publiques, _ := body["taches"].([]any)
	if len(publiques) == 0 {
		t.Fatal("la base principale doit porter les tâches planifiées")
	}

	connexionDansBase(b, d)
	statut, body = appelJSON(b, http.MethodGet, "/api/v1/admin/exploitation", nil, nil)
	b.attend(statut, http.StatusOK, "exploitation de la base de démonstration", body)
	if taches, _ := body["taches"].([]any); len(taches) != 0 {
		t.Fatalf("aucune tâche ne doit être planifiée sur une base de démonstration : %v", taches)
	}
}

// La suppression lance un DROP DATABASE : il faut prouver qu'il tombe sur la
// base jetable et sur rien d'autre.
func TestBaseDemoSupprimeeLaisseLaBasePubliqueIntacte(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	d := creerBaseDemo(b, "suppression")

	avant := map[string]int{}
	for _, table := range []string{"users", "prospects", "representants", "courriels", "visites"} {
		avant[table] = comptePublic(b, `SELECT count(*) FROM `+pgx.Identifier{table}.Sanitize())
	}

	statut, body := appelJSON(b, http.MethodDelete, cheminBases+"/"+d.nom, nil, nil)
	b.attend(statut, http.StatusOK, "suppression de la base", body)

	for table, compte := range avant {
		if n := comptePublic(b, `SELECT count(*) FROM `+pgx.Identifier{table}.Sanitize()); n != compte {
			t.Fatalf("%s : %d lignes avant la suppression, %d après", table, compte, n)
		}
	}
	if baseSQLExiste(t, b, d.baseSQL) {
		t.Fatal("la base de démonstration doit avoir disparu du serveur")
	}
	if !baseSQLExiste(t, b, basePublique(t, b)) {
		t.Fatal("la base principale doit être intacte")
	}
	statut, body = appelJSON(b, http.MethodGet, "/api/v1/auth/me", nil, nil)
	b.attend(statut, http.StatusOK, "la session publique survit à la suppression", body)
}

func basePublique(t *testing.T, b *banc) string {
	t.Helper()
	var nom string
	if err := b.pool.QueryRow(b.ctx, `SELECT current_database()`).Scan(&nom); err != nil {
		t.Fatal(err)
	}
	return nom
}
