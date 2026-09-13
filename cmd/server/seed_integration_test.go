//go:build integration

package main

import (
	"context"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedTestPool(t *testing.T) (*pgxpool.Pool, *socle.Config, context.Context) {
	t.Helper()
	ctx := context.Background()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/cpi_v2_dev?sslmode=disable"
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrer(ctx, pool); err != nil {
		t.Fatal(err)
	}
	cfg, err := socle.LireConfig()
	if err != nil {
		t.Fatal(err)
	}
	return pool, cfg, ctx
}

func seedTestComptesReferentiels(t *testing.T, ctx context.Context, pool *pgxpool.Pool) map[string]int64 {
	t.Helper()
	tables := []string{
		"regions", "departements", "iefs", "banques", "syndicats", "canaux_provenance",
		"professions", "income_bands", "offers", "employeurs", "pays",
		"bank_case_stages", "bank_rejection_reasons", "call_outcome_reasons",
		"statuts_qualification", "visite_entreprises", "visite_directions",
		"visite_destinataires", "visite_objets",
	}
	comptes := make(map[string]int64, len(tables))
	for _, table := range tables {
		var n int64
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM "`+table+`"`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		comptes[table] = n
	}
	return comptes
}

func seedTestCompteAdmin(t *testing.T, ctx context.Context, pool *pgxpool.Pool, suffixe string) string {
	t.Helper()
	email := "test-seed-" + suffixe + "@cpi.sn"
	t.Setenv("SEED_ADMIN_EMAIL", email)
	t.Setenv("SEED_ADMIN_USERNAME", "test-seed-"+suffixe)
	t.Setenv("SEED_ADMIN_PASSWORD", "mot-de-passe-de-test-2026")
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM "users" WHERE "email" = $1`, email) })
	return email
}

func TestSeedEstIdempotent(t *testing.T) {
	pool, cfg, ctx := seedTestPool(t)
	seedTestCompteAdmin(t, ctx, pool, uuid.NewString())

	if err := semer(ctx, pool, cfg); err != nil {
		t.Fatalf("premier seed : %v", err)
	}
	avant := seedTestComptesReferentiels(t, ctx, pool)

	if err := semer(ctx, pool, cfg); err != nil {
		t.Fatalf("second seed : %v", err)
	}
	apres := seedTestComptesReferentiels(t, ctx, pool)

	for table, n := range avant {
		if apres[table] != n {
			t.Fatalf("%s : %d avant, %d après un second seed", table, n, apres[table])
		}
	}
}

// La regle des comptes de demonstration est fermee par defaut. L'ancienne les
// desactivait sur `NODE_ENV == "production"` : la variable etait absente en
// production, et les sept comptes y sont restes ouverts avec un mot de passe
// ecrit dans ce depot. Il faut desormais une raison POSITIVE de les semer.
func TestSeedComptesFixturesFermesParDefaut(t *testing.T) {
	pool, cfg, ctx := seedTestPool(t)
	seedTestCompteAdmin(t, ctx, pool, uuid.NewString())

	cas := []struct {
		nom     string
		base    string
		nodeEnv string
		semes   bool
	}{
		{"production, variable absente", socle.BasePublique, "", false},
		{"production declaree", socle.BasePublique, "production", false},
		{"poste de developpement", socle.BasePublique, "development", true},
		{"base de demonstration en production", "formation", "production", true},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			t.Setenv("NODE_ENV", c.nodeEnv)
			local := *cfg
			local.Base = c.base
			if err := semer(ctx, pool, &local); err != nil {
				t.Fatal(err)
			}
			var actifs int
			if err := pool.QueryRow(ctx,
				`SELECT COUNT(*) FROM "users" WHERE "email" LIKE 'fixture.%' AND "isActive"`).Scan(&actifs); err != nil {
				t.Fatal(err)
			}
			if c.semes && actifs == 0 {
				t.Fatal("les comptes de demonstration devraient etre ouverts")
			}
			if !c.semes && actifs != 0 {
				t.Fatalf("%d compte(s) de demonstration ouverts sur la base principale", actifs)
			}
		})
	}
}

func TestSeedGeographieComplete(t *testing.T) {
	pool, cfg, ctx := seedTestPool(t)
	seedTestCompteAdmin(t, ctx, pool, uuid.NewString())

	if err := semer(ctx, pool, cfg); err != nil {
		t.Fatal(err)
	}

	var regions, departements int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM "regions" WHERE "code" = ANY($1)`, seedCodesRegions()).Scan(&regions); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM "departements" WHERE "code" = ANY($1)`, seedCodesDepartements()).Scan(&departements); err != nil {
		t.Fatal(err)
	}
	if regions != 14 {
		t.Fatalf("régions : %d attendues, %d présentes", 14, regions)
	}
	if departements != 46 {
		t.Fatalf("départements : %d attendus, %d présents", 46, departements)
	}
}

func seedCodesRegions() []string {
	codes := make([]string, 0, len(seedRegions))
	for _, r := range seedRegions {
		codes = append(codes, r.code)
	}
	return codes
}

func seedCodesDepartements() []string {
	var codes []string
	for _, r := range seedRegions {
		for _, d := range r.departements {
			codes = append(codes, d.code)
		}
	}
	return codes
}

func TestSeedAdminExistantGardeSonMotDePasse(t *testing.T) {
	pool, cfg, ctx := seedTestPool(t)
	email := seedTestCompteAdmin(t, ctx, pool, uuid.NewString())

	if err := semer(ctx, pool, cfg); err != nil {
		t.Fatalf("premier seed : %v", err)
	}
	var condensat string
	if err := pool.QueryRow(ctx, `SELECT "passwordHash" FROM "users" WHERE "email" = $1`, email).Scan(&condensat); err != nil {
		t.Fatal(err)
	}

	t.Setenv("SEED_ADMIN_PASSWORD", "un-tout-autre-mot-de-passe-2026")
	if err := semer(ctx, pool, cfg); err != nil {
		t.Fatalf("second seed : %v", err)
	}
	var condensatApres string
	if err := pool.QueryRow(ctx, `SELECT "passwordHash" FROM "users" WHERE "email" = $1`, email).Scan(&condensatApres); err != nil {
		t.Fatal(err)
	}
	if condensatApres != condensat {
		t.Fatalf("le mot de passe de l'admin existant a été réécrit")
	}
}

func TestSeedAdminMotDePasseTropCourtRefuse(t *testing.T) {
	pool, cfg, ctx := seedTestPool(t)
	suffixe := uuid.NewString()
	email := "test-seed-" + suffixe + "@cpi.sn"
	t.Setenv("SEED_ADMIN_EMAIL", email)
	t.Setenv("SEED_ADMIN_USERNAME", "test-seed-"+suffixe)
	t.Setenv("SEED_ADMIN_PASSWORD", "court")
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM "users" WHERE "email" = $1`, email) })

	if err := semer(ctx, pool, cfg); err == nil {
		t.Fatal("un mot de passe admin de moins de 12 caractères doit être refusé")
	}

	var n int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM "users" WHERE "email" = $1`, email).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("le refus doit annuler toute la transaction, %d compte(s) créé(s)", n)
	}
}

func TestSeedFactoryTableauxDeBord(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	seedTestCompteAdmin(t, b.ctx, b.pool, uuid.NewString())
	statut, body := b.connexion(b.email, "motdepasse")
	b.attend(statut, http.StatusOK, "connexion", body)

	// Le jeu d'essai ne se sème plus sur `NODE_ENV=development` mais sur toute
	// base qui n'est pas la base principale.
	demo := &socle.Config{Base: "demonstration"}
	for passage := range 2 {
		if err := semer(b.ctx, b.pool, demo); err != nil {
			t.Fatal(err)
		}
		analyticsViderCache()
		jour := time.Now().UTC().Format(time.DateOnly)
		for _, projet := range []string{"CHUES", "GRAND_PUBLIC"} {
			seedVerifierTableau(b, projet, jour)
		}
		for table, attendu := range map[string]int{
			"prospects": 480, "representants": 240, "call_attempts": 480,
			"rep_call_attempts": 240, "visites": 180, "ouvertures_fiche": 480,
		} {
			var nombre int
			if err := b.pool.QueryRow(b.ctx, `SELECT count(*) FROM `+pgx.Identifier{table}.Sanitize()+` WHERE id LIKE '0199f100-%'`).Scan(&nombre); err != nil {
				t.Fatal(err)
			}
			if nombre != attendu {
				t.Fatalf("passage %d, %s : %d lignes attendues, %d présentes", passage, table, attendu, nombre)
			}
		}
	}
}

func seedVerifierTableau(b *banc, projet, jour string) {
	b.t.Helper()
	statut, body := b.appel(http.MethodGet, "/api/v1/supervision/activite?projet="+projet+"&actFrom="+jour+"T00:00:00Z&actTo="+jour+"T23:59:59Z", nil, false)
	b.attend(statut, http.StatusOK, "activité "+projet, body)
	totaux := analyticsObjet(b, "totaux", body["totals"])
	for _, champ := range []string{"calls", "methodObtained", "callback", "unreachable", "avgCallSeconds"} {
		if analyticsNombre(b, totaux[champ], champ) <= 0 {
			b.t.Fatalf("%s aujourd’hui : %s vide", projet, champ)
		}
	}
	if projet == "CHUES" && analyticsNombre(b, totaux["repFichesAcceptees"], "représentants qualifiés") <= 0 {
		b.t.Fatal("aucun représentant qualifié aujourd’hui")
	}
	statut, body = b.appel(http.MethodGet, "/api/v1/analytics/funnel?projet="+projet+"&dateFrom="+jour+"&dateTo="+jour, nil, false)
	b.attend(statut, http.StatusOK, "entonnoir "+projet, body)
	for _, etape := range analyticsListe(b, "étapes", body["etapes"], 4) {
		if analyticsNombre(b, analyticsObjet(b, "étape", etape)["count"], "effectif") <= 0 {
			b.t.Fatalf("%s : étape vide aujourd’hui : %v", projet, etape)
		}
	}
	statut, body = b.appel(http.MethodGet, "/api/v1/supervision/campagnes?projet="+projet+"&actFrom="+jour+"T00:00:00Z&actTo="+jour+"T23:59:59Z", nil, false)
	b.attend(statut, http.StatusOK, "campagnes "+projet, body)
	if analyticsNombre(b, analyticsObjet(b, "campagnes", body["totals"])["appelees"], "fiches appelées") <= 0 {
		b.t.Fatalf("%s : aucune fiche appelée dans les campagnes d’aujourd’hui", projet)
	}
}
