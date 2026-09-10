package main

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Même forme que le seed Prisma de la v1 : 20 upsert de référentiels dans
// une transaction, contrôle bloquant sur le nombre de départements, admin et
// fixtures créés seulement s'ils sont absents.
func semer(ctx context.Context, pool *pgxpool.Pool, _ *socle.Config) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)

	etapes := []func(context.Context, *db.Queries) error{
		seedSemerGeographie,
		seedSemerBanques,
		seedSemerSyndicats,
		seedSemerCanauxProvenance,
		seedSemerProfessions,
		seedSemerIncomeBands,
		seedSemerOffers,
		seedSemerEmployeurs,
		seedSemerPays,
		seedSemerBankCaseStages,
		seedSemerBankRejectionReasons,
		seedSemerCallOutcomeReasons,
		seedSemerStatutsQualification,
		seedSemerVisiteReferentiels,
		seedSemerAdmin,
	}
	for _, etape := range etapes {
		if err := etape(ctx, q); err != nil {
			return err
		}
	}
	if err := seedSemerFixtures(ctx, q, tx); err != nil {
		return err
	}
	if socle.Env("NODE_ENV", "") == "development" {
		if err := seedFactory(ctx, tx); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func seedNouvelID() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

// seedSemerListe factorise le patron commun aux référentiels : un identifiant
// v7 par ligne, puis l'upsert propre à la table.
func seedSemerListe[T any](ctx context.Context, elements []T, appliquer func(context.Context, string, T) error) error {
	for _, element := range elements {
		id, err := seedNouvelID()
		if err != nil {
			return err
		}
		if err := appliquer(ctx, id, element); err != nil {
			return err
		}
	}
	return nil
}

func seedSemerGeographie(ctx context.Context, q *db.Queries) error {
	departementIDParCode := map[string]string{}
	for _, region := range seedRegions {
		regionID, err := seedNouvelID()
		if err != nil {
			return err
		}
		savedRegionID, err := q.SeedUpsertRegion(ctx, db.SeedUpsertRegionParams{ID: regionID, Code: region.code, Name: region.name})
		if err != nil {
			return err
		}
		for _, departement := range region.departements {
			departementID, err := seedNouvelID()
			if err != nil {
				return err
			}
			savedDepartementID, err := q.SeedUpsertDepartement(ctx, db.SeedUpsertDepartementParams{
				ID: departementID, Code: departement.code, Name: departement.name, RegionId: savedRegionID,
			})
			if err != nil {
				return err
			}
			departementIDParCode[departement.code] = savedDepartementID
		}
	}
	nombre, err := q.SeedCountDepartements(ctx)
	if err != nil {
		return err
	}
	if attendu := int64(seedDepartementCount()); nombre < attendu {
		return fmt.Errorf("seed géographique incomplet : %d/%d", nombre, attendu)
	}
	slog.Info("seed géographie", "régions", len(seedRegions), "départements", nombre)
	return seedSemerIefs(ctx, q, departementIDParCode)
}

func seedSemerIefs(ctx context.Context, q *db.Queries, departementIDParCode map[string]string) error {
	for _, ief := range seedIefs {
		departementID, ok := departementIDParCode[ief.departementCode]
		if !ok {
			return fmt.Errorf("IEF %s : département %s introuvable", ief.code, ief.departementCode)
		}
		id, err := seedNouvelID()
		if err != nil {
			return err
		}
		if err := q.SeedUpsertIef(ctx, db.SeedUpsertIefParams{ID: id, Code: ief.code, Name: ief.name, DepartementId: departementID}); err != nil {
			return err
		}
	}
	nombre, err := q.SeedCountIefs(ctx)
	if err != nil {
		return err
	}
	if attendu := int64(len(seedIefs)); nombre < attendu {
		return fmt.Errorf("seed IEF incomplet : %d/%d", nombre, attendu)
	}
	slog.Info("seed IEF", "total", nombre)
	return nil
}

func seedSemerBanques(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedBanques, func(ctx context.Context, id string, b seedBanque) error {
		return q.SeedUpsertBanque(ctx, db.SeedUpsertBanqueParams{ID: id, Name: b.name, ShortName: b.shortName, SortOrder: b.sortOrder})
	})
}

func seedSemerSyndicats(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedSyndicats, func(ctx context.Context, id string, s seedSyndicat) error {
		return q.SeedUpsertSyndicat(ctx, db.SeedUpsertSyndicatParams{ID: id, Name: s.name, Sigle: s.sigle, Secteur: &s.secteur, SortOrder: s.sortOrder})
	})
}

func seedSemerCanauxProvenance(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedCanauxProvenance, func(ctx context.Context, id string, c seedCanalProvenance) error {
		return q.SeedUpsertCanalProvenance(ctx, db.SeedUpsertCanalProvenanceParams{ID: id, Code: c.code, Label: c.label, Position: c.position})
	})
}

func seedSemerProfessions(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedProfessionsListe(), func(ctx context.Context, id string, p seedProfession) error {
		return q.SeedUpsertProfession(ctx, db.SeedUpsertProfessionParams{ID: id, Code: p.code, Label: p.label, IsTeaching: p.isTeaching, Position: p.position})
	})
}

func seedSemerIncomeBands(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedIncomeBands, func(ctx context.Context, id string, b seedIncomeBand) error {
		return q.SeedUpsertIncomeBand(ctx, db.SeedUpsertIncomeBandParams{ID: id, Code: b.code, Label: b.label, MinXof: b.minXof, MaxXof: b.maxXof, Position: b.position})
	})
}

func seedSemerOffers(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedOffers, func(ctx context.Context, id string, o seedOffer) error {
		return q.SeedUpsertOffer(ctx, db.SeedUpsertOfferParams{ID: id, Code: o.code, Label: o.label, Position: o.position})
	})
}

func seedSemerEmployeurs(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedEmployeursListe(), func(ctx context.Context, id string, e seedEmployeur) error {
		return q.SeedUpsertEmployeur(ctx, db.SeedUpsertEmployeurParams{ID: id, Code: e.code, Label: e.label, Type: e.typ, Position: e.position})
	})
}

func seedSemerPays(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedPaysListe(), func(ctx context.Context, id string, p seedPaysEntree) error {
		return q.SeedUpsertPays(ctx, db.SeedUpsertPaysParams{ID: id, Code: p.code, Label: p.label, Indicatif: p.indicatif, Position: p.position})
	})
}

func seedSemerBankCaseStages(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedBankStages, func(ctx context.Context, id string, s seedBankStage) error {
		return q.SeedUpsertBankCaseStage(ctx, db.SeedUpsertBankCaseStageParams{
			ID: id, Code: s.code, Label: s.label, Position: s.position, Color: s.color, Type: s.typ, IsInitial: s.isInitial, IsSystem: s.isSystem,
		})
	})
}

func seedSemerBankRejectionReasons(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedBankRejectionReasons, func(ctx context.Context, id string, r seedBankRejectionReason) error {
		return q.SeedUpsertBankRejectionReason(ctx, db.SeedUpsertBankRejectionReasonParams{ID: id, Code: r.code, Label: r.label, SortOrder: r.sortOrder})
	})
}

func seedSemerCallOutcomeReasons(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedCallOutcomeReasons, func(ctx context.Context, id string, r seedCallOutcomeReason) error {
		return q.SeedUpsertCallOutcomeReason(ctx, db.SeedUpsertCallOutcomeReasonParams{
			ID: id, Code: r.code, Label: r.label, Effect: r.effect, RequiresComment: r.requiresComment,
			RequiresCallback: r.requiresCallback, CountsAsReached: r.countsAsReached, Color: &r.color,
			SortOrder: r.sortOrder, IsSystem: true, MinPayloadVersion: 1,
		})
	})
}

func seedSemerStatutsQualification(ctx context.Context, q *db.Queries) error {
	return seedSemerListe(ctx, seedStatutsQualification, func(ctx context.Context, id string, s seedStatutQualification) error {
		return q.SeedUpsertStatutQualification(ctx, db.SeedUpsertStatutQualificationParams{
			ID: id, Code: s.code, Label: s.label, Effect: s.effect, RequiresCallback: s.requiresCallback,
			RequiresComment: s.requiresComment, RetryAfterMinutes: s.retryAfterMinutes, Priorite: s.priorite,
			RelationStatus: s.relationStatus, SortOrder: s.sortOrder, IsSystem: true, MinPayloadVersion: s.minPayloadVersion,
		})
	})
}

func seedSemerVisiteReferentiels(ctx context.Context, q *db.Queries) error {
	if err := seedSemerListe(ctx, seedVisiteEntreprises, func(ctx context.Context, id string, v seedVisiteReferentiel) error {
		return q.SeedUpsertVisiteEntreprise(ctx, db.SeedUpsertVisiteEntrepriseParams{ID: id, Code: v.code, Label: v.label, SortOrder: v.sortOrder})
	}); err != nil {
		return err
	}
	if err := seedSemerListe(ctx, seedVisiteDirections, func(ctx context.Context, id string, v seedVisiteReferentiel) error {
		return q.SeedUpsertVisiteDirection(ctx, db.SeedUpsertVisiteDirectionParams{ID: id, Code: v.code, Label: v.label, SortOrder: v.sortOrder})
	}); err != nil {
		return err
	}
	if err := seedSemerListe(ctx, seedVisiteDestinataires, func(ctx context.Context, id string, v seedVisiteReferentiel) error {
		return q.SeedUpsertVisiteDestinataire(ctx, db.SeedUpsertVisiteDestinataireParams{ID: id, Code: v.code, Label: v.label, SortOrder: v.sortOrder})
	}); err != nil {
		return err
	}
	return seedSemerListe(ctx, seedVisiteObjets, func(ctx context.Context, id string, v seedVisiteReferentiel) error {
		return q.SeedUpsertVisiteObjet(ctx, db.SeedUpsertVisiteObjetParams{ID: id, Code: v.code, Label: v.label, SortOrder: v.sortOrder})
	})
}

func seedDefautDev(nom string, autoriseDefaut bool, defaut string) string {
	if v := os.Getenv(nom); v != "" {
		return v
	}
	if autoriseDefaut {
		return defaut
	}
	return ""
}

func seedSemerAdmin(ctx context.Context, q *db.Queries) error {
	autoriseDefaut := socle.Env("NODE_ENV", "") == "development"
	email := seedDefautDev("SEED_ADMIN_EMAIL", autoriseDefaut, "admin@cpi.sn")
	username := seedDefautDev("SEED_ADMIN_USERNAME", autoriseDefaut, "admin")
	password := seedDefautDev("SEED_ADMIN_PASSWORD", autoriseDefaut, "ChangeMoiEnProd2026")
	fullName := socle.Env("SEED_ADMIN_FULL_NAME", "Administrateur CPI")

	if email == "" || username == "" || password == "" {
		slog.Warn("seed admin ignoré : SEED_ADMIN_EMAIL / _USERNAME / _PASSWORD absents")
		return nil
	}
	if len(password) < 12 {
		return errors.New("SEED_ADMIN_PASSWORD doit faire au moins 12 caractères")
	}
	condensat, err := database.HacherMotDePasse(password)
	if err != nil {
		return err
	}
	id, err := seedNouvelID()
	if err != nil {
		return err
	}
	lignes, err := q.SeedInsertAdmin(ctx, db.SeedInsertAdminParams{ID: id, Email: email, Username: username, FullName: fullName, PasswordHash: condensat})
	if err != nil {
		return err
	}
	if lignes == 0 {
		slog.Info("seed admin", "email", email, "statut", "existe déjà, inchangé")
		return nil
	}
	slog.Info("seed admin", "email", email, "statut", "créé")
	return nil
}

// Jamais en production : le seed tourne à chaque démarrage du conteneur et ne
// doit pas réactiver ou re-hacher les comptes fixtures. Une base qui les porte
// déjà les voit fermés ; ils ne se suppriment pas, des fiches peuvent les citer.
func seedSemerFixtures(ctx context.Context, q *db.Queries, tx pgx.Tx) error {
	emails := make([]string, len(seedFixtureUsers))
	for i, f := range seedFixtureUsers {
		emails[i] = f.email
	}
	if socle.Env("NODE_ENV", "") == "production" {
		desactives, err := q.SeedDisableFixtureUsers(ctx, emails)
		if err != nil {
			return err
		}
		slog.Info("seed fixtures", "statut", "aucune en production", "désactivés", desactives)
		return nil
	}
	password := socle.Env("SEED_FIXTURE_PASSWORD", "ChangeMoi123456")
	if len(password) < 12 {
		return errors.New("SEED_FIXTURE_PASSWORD doit faire au moins 12 caractères")
	}
	condensat, err := database.HacherMotDePasse(password)
	if err != nil {
		return err
	}
	var crees int64
	for _, f := range seedFixtureUsers {
		id, err := seedNouvelID()
		if err != nil {
			return err
		}
		lignes, err := q.SeedInsertFixtureUser(ctx, db.SeedInsertFixtureUserParams{
			ID: id, Email: f.email, Username: f.username, FullName: f.fullName, PasswordHash: condensat, Role: f.role,
		})
		if err != nil {
			return err
		}
		crees += lignes
	}
	if err := seedInsererDonneesDemo(ctx, tx); err != nil {
		return err
	}
	slog.Info("seed fixtures", "total", len(seedFixtureUsers), "créés", crees)
	return nil
}

func seedInsererDonneesDemo(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
	INSERT INTO "prospects" (
		"id", "nom", "prenom", "phoneE164", "banqueId", "syndicatId", "createdById",
		"clientCreatedAt", "updatedAt", "projet"
	)
	SELECT donnees.id, donnees.nom, donnees.prenom, donnees.phone, comptes.banque_id,
		CASE WHEN donnees.est_chues THEN comptes.syndicat_id ELSE NULL END,
		comptes.auteur, now(), now(), donnees.projet
	FROM (VALUES
		('00000000-0000-7000-0000-000000000101', 'Diop', 'Aminata', '+221770000101', 'CHUES'::"Projet", true),
		('00000000-0000-7000-0000-000000000102', 'Ndiaye', 'Mamadou', '+221770000102', 'CHUES'::"Projet", true),
		('00000000-0000-7000-0000-000000000103', 'Fall', 'Fatou', '+221770000103', 'GRAND_PUBLIC'::"Projet", false)
	) AS donnees(id, nom, prenom, phone, projet, est_chues)
	CROSS JOIN (
		SELECT
			(SELECT "id" FROM "users" WHERE "email" = 'fixture.awa@cpi.sn') AS auteur,
			(SELECT "id" FROM "banques" WHERE "shortName" = 'CBAO') AS banque_id,
			(SELECT "id" FROM "syndicats" WHERE "sigle" = 'CHUES') AS syndicat_id
	) comptes
	WHERE comptes.auteur IS NOT NULL
	ON CONFLICT DO NOTHING;

	UPDATE "prospects"
	SET "phase2Status" = 'METHOD_OBTAINED',
		"enrollmentMethod" = 'PLATFORM',
		"enrollmentCapturedAt" = now(),
		"enrollmentCapturedById" = (SELECT "id" FROM "users" WHERE "email" = 'fixture.awa@cpi.sn'),
		"updatedAt" = now()
	WHERE "id" IN (
		'00000000-0000-7000-0000-000000000101',
		'00000000-0000-7000-0000-000000000102',
		'00000000-0000-7000-0000-000000000103'
	);

INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "updatedAt")
SELECT
	'00000000-0000-7000-0000-000000000201', "id", 'CHUES'::"Projet", now()
FROM "prospects"
WHERE "id" = '00000000-0000-7000-0000-000000000101'
ON CONFLICT ("prospectId", "projet") DO NOTHING;

INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "updatedAt")
SELECT
	'00000000-0000-7000-0000-000000000202', "id", 'CHUES'::"Projet", now()
FROM "prospects"
WHERE "id" = '00000000-0000-7000-0000-000000000102'
ON CONFLICT ("prospectId", "projet") DO NOTHING;

INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "updatedAt")
SELECT
	'00000000-0000-7000-0000-000000000203', "id", 'GRAND_PUBLIC'::"Projet", now()
FROM "prospects"
WHERE "id" = '00000000-0000-7000-0000-000000000103'
ON CONFLICT ("prospectId", "projet") DO NOTHING;

INSERT INTO "bank_cases" (
	"id", "reference", "referenceKey", "prospectId", "customerName", "customerPhoneE164",
	"processingBankId", "currentStageId", "createdById", "updatedAt"
)
SELECT
	'00000000-0000-7000-0000-000000000301', 'DEMO-BANQUE-001', 'DEMO-BANQUE-001',
	p."id", concat(p."prenom", ' ', p."nom"), p."phoneE164", comptes.banque_id,
	(SELECT "id" FROM "bank_case_stages" WHERE "code" = 'A_TRAITER'), comptes.banque, now()
FROM "prospects" p
CROSS JOIN (SELECT
	(SELECT "id" FROM "users" WHERE "email" = 'fixture.banque@cpi.sn') AS banque,
	(SELECT "id" FROM "banques" WHERE "shortName" = 'CBAO') AS banque_id
) comptes
WHERE p."id" = '00000000-0000-7000-0000-000000000101'
  AND comptes.banque IS NOT NULL
	AND (SELECT "id" FROM "bank_case_stages" WHERE "code" = 'A_TRAITER') IS NOT NULL
ON CONFLICT ("referenceKey") WHERE "deletedAt" IS NULL DO NOTHING`)
	return err
}
