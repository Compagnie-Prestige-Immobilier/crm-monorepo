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
		detruireBaseSQL(b.ctx, b.dsn, baseSQL)
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
		detruireBaseSQL(b.ctx, b.dsn, baseSQL)
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
