//go:build integration

package main

import (
	"net/http"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
)

// Le parcours entier contre Postgres : la base est créée, elle apparaît dans le
// sélecteur de connexion, ses comptes de démonstration existent, et elle
// disparaît vraiment du serveur Postgres à la suppression.
func TestBaseDemonstrationCreeeServieEtSupprimee(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	nom := "essai-audit"
	baseSQL := prefixeBaseSQL + "essai_audit"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bases_demonstration" WHERE "nom" = $1`, nom)
		_ = detruireBaseSQL(b.ctx, b.dsn, baseSQL)
	})

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases", map[string]any{"nom": nom}, nil)
	b.attend(statut, http.StatusCreated, "création de la base", body)

	statut, body = appelJSON(b, http.MethodGet, "/api/v1/auth/bases", nil, nil)
	b.attend(statut, http.StatusOK, "sélecteur de bases", body)
	if !contientBase(body["bases"], nom) {
		t.Fatalf("la base créée doit apparaître dans le sélecteur : %v", body["bases"])
	}

	if n := compterDansBase(t, b, baseSQL, `SELECT COUNT(*) FROM "users" WHERE "email" LIKE 'fixture.%'`); n == 0 {
		t.Fatal("une base de démonstration doit porter les comptes fixtures")
	}
	if n := compterDansBase(t, b, baseSQL, `SELECT COUNT(*) FROM "representants"`); n == 0 {
		t.Fatal("une base de démonstration doit porter le jeu d’essai")
	}

	statut, body = appelJSON(b, http.MethodDelete, "/api/v1/admin/bases/"+nom, nil, nil)
	b.attend(statut, http.StatusOK, "suppression de la base", body)

	statut, body = appelJSON(b, http.MethodGet, "/api/v1/auth/bases", nil, nil)
	b.attend(statut, http.StatusOK, "sélecteur après suppression", body)
	if contientBase(body["bases"], nom) {
		t.Fatalf("la base supprimée ne doit plus être proposée : %v", body["bases"])
	}
	if baseSQLExiste(t, b, baseSQL) {
		t.Fatal("la base Postgres doit avoir disparu du serveur")
	}
}

// Rafraîchir doit remettre la base à l'état d'une base neuve : le semis
// revient, et ce qu'on avait tapé dedans depuis sa création disparaît.
func TestBaseDemonstrationRafraichieRepartDuSemis(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	nom := "essai-refresh"
	baseSQL := prefixeBaseSQL + "essai_refresh"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bases_demonstration" WHERE "nom" = $1`, nom)
		_ = detruireBaseSQL(b.ctx, b.dsn, baseSQL)
	})

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases", map[string]any{"nom": nom}, nil)
	b.attend(statut, http.StatusCreated, "création de la base", body)

	url, err := urlPourBase(b.dsn, baseSQL)
	if err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(b.ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(b.ctx,
		`INSERT INTO "banques" ("id", "name", "shortName") VALUES ('essai-refresh-banque', 'Trace à effacer', 'TAE')`,
	); err != nil {
		_ = conn.Close(b.ctx)
		t.Fatal(err)
	}
	_ = conn.Close(b.ctx)

	statut, body = appelJSON(b, http.MethodPost, "/api/v1/admin/bases/"+nom+"/rafraichir", nil, nil)
	b.attend(statut, http.StatusOK, "rafraîchissement de la base", body)

	if n := compterDansBase(t, b, baseSQL,
		`SELECT COUNT(*) FROM "banques" WHERE "id" = 'essai-refresh-banque'`); n != 0 {
		t.Fatal("la trace laissée avant le rafraîchissement doit avoir disparu")
	}
	if n := compterDansBase(t, b, baseSQL, `SELECT COUNT(*) FROM "representants"`); n == 0 {
		t.Fatal("une base rafraîchie doit reporter son jeu d'essai")
	}
}

// Rafraîchir tout doit rejouer le rafraîchissement sur chaque base en une
// requête : c'est ce qui évite d'en oublier une entre deux migrations quand
// on les rafraîchirait une à une depuis le panneau.
func TestBasesDemonstrationRafraichiesToutesEnsemble(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	noms := []string{"essai-tout-a", "essai-tout-b"}
	basesSQL := []string{prefixeBaseSQL + "essai_tout_a", prefixeBaseSQL + "essai_tout_b"}
	t.Cleanup(func() {
		for i := range noms {
			_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bases_demonstration" WHERE "nom" = $1`, noms[i])
			_ = detruireBaseSQL(b.ctx, b.dsn, basesSQL[i])
		}
	})

	for i := range noms {
		statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases",
			map[string]any{"nom": noms[i]}, nil)
		b.attend(statut, http.StatusCreated, "création de la base", body)

		url, err := urlPourBase(b.dsn, basesSQL[i])
		if err != nil {
			t.Fatal(err)
		}
		conn, err := pgx.Connect(b.ctx, url)
		if err != nil {
			t.Fatal(err)
		}
		_, err = conn.Exec(b.ctx,
			`INSERT INTO "banques" ("id", "name", "shortName") VALUES ($1, 'Trace à effacer', 'TAE')`,
			"essai-tout-banque-"+noms[i])
		_ = conn.Close(b.ctx)
		if err != nil {
			t.Fatal(err)
		}
	}

	statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases/rafraichir", nil, nil)
	b.attend(statut, http.StatusOK, "rafraîchissement de toutes les bases", body)

	for i := range noms {
		if n := compterDansBase(t, b, basesSQL[i],
			`SELECT COUNT(*) FROM "banques" WHERE "id" = 'essai-tout-banque-`+noms[i]+`'`); n != 0 {
			t.Fatalf("la trace laissée dans %s avant le rafraîchissement doit avoir disparu", noms[i])
		}
		if n := compterDansBase(t, b, basesSQL[i], `SELECT COUNT(*) FROM "representants"`); n == 0 {
			t.Fatalf("%s rafraîchie doit reporter son jeu d'essai", noms[i])
		}
	}
}

// Créer une base monte une instance, donc reconstruisait la carte GLOBALE des
// gardes que la garde d'accès lit à chaque requête. Sous trafic, cela plantait
// le processus sur « concurrent map read and map write ». À lancer avec -race.
func TestBaseDemonstrationCreeeSousTraficNeCourtPas(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)
	nom := "essai-course"
	baseSQL := prefixeBaseSQL + "essai_course"
	t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "bases_demonstration" WHERE "nom" = $1`, nom)
		_ = detruireBaseSQL(b.ctx, b.dsn, baseSQL)
	})

	arret := make(chan struct{})
	var trafic sync.WaitGroup
	for range 8 {
		trafic.Add(1)
		go func() {
			defer trafic.Done()
			for {
				select {
				case <-arret:
					return
				default:
					appelJSON(b, http.MethodGet, "/api/v1/auth/me", nil, nil)
				}
			}
		}()
	}
	statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases", map[string]any{"nom": nom}, nil)
	close(arret)
	trafic.Wait()
	b.attend(statut, http.StatusCreated, "création sous trafic", body)
}

// La base principale ne se supprime pas, et un nom hors de l'expression n'entre
// jamais dans un `CREATE DATABASE`.
func TestBaseDemonstrationRefuseLesNomsEtLaBasePrincipale(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	connecte(b)

	// Une majuscule est normalisée et non refusée : c'est `avec espace`, le
	// point-virgule et le guillemet qui ne doivent jamais atteindre le SQL.
	for _, nom := range []string{"public", "ab", "avec espace", `x"; DROP DATABASE crm; --`, "1chiffre"} {
		statut, body := appelJSON(b, http.MethodPost, "/api/v1/admin/bases", map[string]any{"nom": nom}, nil)
		if statut == http.StatusCreated {
			t.Fatalf("le nom %q ne doit pas être accepté : %v", nom, body)
		}
	}
	statut, body := appelJSON(b, http.MethodDelete, "/api/v1/admin/bases/public", nil, nil)
	if statut != http.StatusForbidden {
		t.Fatalf("la base principale ne se supprime pas : %d %v", statut, body)
	}
}

// Se connecter pour de bon à la base créée : le seul moyen de prouver qu'elle
// porte bien son schéma et son semis, et pas seulement une ligne en table.
func compterDansBase(t *testing.T, b *banc, baseSQL, requete string) int {
	t.Helper()
	url, err := urlPourBase(b.dsn, baseSQL)
	if err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(b.ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(b.ctx) }()
	var n int
	if err := conn.QueryRow(b.ctx, requete).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func baseSQLExiste(t *testing.T, b *banc, baseSQL string) bool {
	t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx,
		`SELECT COUNT(*) FROM pg_database WHERE datname = $1`, baseSQL).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n > 0
}

func contientBase(valeur any, nom string) bool {
	items, ok := valeur.([]any)
	if !ok {
		return false
	}
	for _, i := range items {
		if s, _ := i.(string); s == nom {
			return true
		}
	}
	return false
}
