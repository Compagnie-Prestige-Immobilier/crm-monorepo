package main

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	sqlsource "cpi-go/sql"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	cheminBases       = "/api/v1/admin/bases"
	basesDemoMax      = 3
	prefixeBaseSQL    = "cpi_demo_"
	delaiCreationDemo = 5 * time.Minute
)

// Chaque base ouvre son propre pool ; à dix connexions par base et un
// `max_connections` à 100 partagé avec la production, le nombre se plafonne.
var nomBaseValide = regexp.MustCompile(`^[a-z][a-z0-9-]{2,20}$`)

var GardeBases = map[string]socle.Permission{
	"GET " + cheminBases:                        socle.PermissionBasesAdministrer,
	"POST " + cheminBases:                       socle.PermissionBasesAdministrer,
	"DELETE " + cheminBases + "/{nom}":          socle.PermissionBasesAdministrer,
	"POST " + cheminBases + "/{nom}/rafraichir": socle.PermissionBasesAdministrer,
}

type BaseDemoDto struct {
	Nom           string    `json:"nom"`
	CreatedAt     time.Time `json:"createdAt"`
	CreatedByName string    `json:"createdByName"`
}

type BasesOutput struct {
	Body struct {
		Items []BaseDemoDto `json:"items"`
		Max   int           `json:"max"`
	}
}

type BaseCreerInput struct {
	Body struct {
		Nom string `json:"nom" minLength:"3" maxLength:"21"`
	}
}

type BaseSupprimerInput struct {
	Nom string `path:"nom" maxLength:"21"`
}

type serviceBases struct {
	*socle.Deps
	reg *registre
}

// Les bases de démonstration ne se gèrent que depuis la base principale : la
// laisser se gérer depuis une base jetable reviendrait à donner à un compte de
// démonstration le droit d'en créer d'autres.
func (s *serviceBases) exigerBasePrincipale() error {
	if s.Cfg.Base != socle.BasePublique {
		return socle.Problem(http.StatusForbidden, "BASE_PRINCIPALE_REQUISE",
			"Les bases de démonstration se gèrent depuis la base principale.")
	}
	return nil
}

func (s *serviceBases) lister(ctx context.Context, _ *struct{}) (*BasesOutput, error) {
	if err := s.exigerBasePrincipale(); err != nil {
		return nil, err
	}
	lignes, err := s.Q.BasesDemonstration(ctx)
	if err != nil {
		return nil, err
	}
	out := &BasesOutput{}
	out.Body.Max = basesDemoMax
	out.Body.Items = make([]BaseDemoDto, 0, len(lignes))
	for i := range lignes {
		auteur := ""
		if lignes[i].CreatedByName != nil {
			auteur = *lignes[i].CreatedByName
		}
		out.Body.Items = append(out.Body.Items, BaseDemoDto{
			Nom: lignes[i].Nom, CreatedAt: lignes[i].CreatedAt, CreatedByName: auteur,
		})
	}
	return out, nil
}

func (s *serviceBases) creer(ctx context.Context, in *BaseCreerInput) (*BasesOutput, error) {
	if err := s.exigerBasePrincipale(); err != nil {
		return nil, err
	}
	nom := strings.ToLower(strings.TrimSpace(in.Body.Nom))
	if !nomBaseValide.MatchString(nom) || nom == socle.BasePublique {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "NOM_INVALIDE",
			"Le nom doit faire 3 à 21 caractères, en minuscules, chiffres et tirets, et commencer par une lettre.")
	}
	compte, err := s.Q.BasesDemonstrationCompte(ctx)
	if err != nil {
		return nil, err
	}
	if int(compte) >= basesDemoMax {
		return nil, socle.Problem(http.StatusConflict, "TROP_DE_BASES",
			fmt.Sprintf("Le maximum est de %d bases de démonstration. Supprimez-en une d'abord.", basesDemoMax))
	}
	if _, occupe := s.reg.garde(nom); occupe {
		return nil, socle.Problem(http.StatusConflict, "NOM_PRIS", "Ce nom est déjà utilisé.")
	}

	baseSQL := prefixeBaseSQL + strings.ReplaceAll(nom, "-", "_")
	travail, arreter := context.WithTimeout(context.WithoutCancel(ctx), delaiCreationDemo)
	defer arreter()
	if err := creerBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL); err != nil {
		return nil, err
	}
	pool, i, err := monterBaseDemo(travail, s.Cfg, s.reg, baseSQL, nom, true)
	if err != nil {
		_ = detruireBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL)
		return nil, err
	}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := s.Q.BaseDemonstrationInserer(ctx, db.BaseDemonstrationInsererParams{
		Nom: nom, BaseSql: baseSQL, CreatedById: &acteur,
	}); err != nil {
		pool.Close()
		_ = detruireBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL)
		return nil, err
	}
	s.reg.monter(nom, i, pool)
	slog.Info("base de démonstration créée", "nom", nom, "baseSql", baseSQL, "userId", acteur)
	return s.lister(ctx, nil)
}

// Nom de base à part : administrer une autre base que la principale reste
// interdit à trois endroits (supprimer, rafraîchir, et demain un quatrième),
// donc factorisé ici plutôt que triplé.
func (s *serviceBases) baseSQLPour(ctx context.Context, nom string) (string, error) {
	if nom == socle.BasePublique {
		return "", socle.Problem(http.StatusForbidden, "BASE_PRINCIPALE",
			"La base principale ne se gère pas comme une base de démonstration.")
	}
	lignes, err := s.Q.BasesDemonstration(ctx)
	if err != nil {
		return "", err
	}
	for i := range lignes {
		if lignes[i].Nom == nom {
			return lignes[i].BaseSql, nil
		}
	}
	return "", socle.Problem(http.StatusNotFound, "BASE_INTROUVABLE", "Cette base n'existe pas.")
}

func (s *serviceBases) supprimer(ctx context.Context, in *BaseSupprimerInput) (*BasesOutput, error) {
	if err := s.exigerBasePrincipale(); err != nil {
		return nil, err
	}
	nom := strings.ToLower(strings.TrimSpace(in.Nom))
	baseSQL, err := s.baseSQLPour(ctx, nom)
	if err != nil {
		return nil, err
	}
	// La ligne part EN DERNIER. Effacée d'abord, une destruction qui échoue
	// laisserait sur le disque une base que plus rien ne référence, invisible
	// depuis le panneau. Dans cet ordre, l'échec laisse la base listée, donc
	// visible et supprimable de nouveau.
	if pool := s.reg.demonter(nom); pool != nil {
		pool.Close()
	}
	travail, arreter := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)
	defer arreter()
	if err := detruireBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL); err != nil {
		return nil, socle.Problem(http.StatusServiceUnavailable, "SUPPRESSION_IMPOSSIBLE",
			"La base n'a pas pu être détruite. Elle reste listée, réessayez.")
	}
	if _, err := s.Q.BaseDemonstrationSupprimer(ctx, nom); err != nil {
		return nil, err
	}
	slog.Info("base de démonstration supprimée", "nom", nom, "baseSql", baseSQL,
		"userId", socle.UtilisateurCourant(ctx).ID)
	return s.lister(ctx, nil)
}

// Le schéma suit les migrations à chaque redémarrage, mais le semis, lui, ne
// rejoue jamais sur une base déjà montée (`monterBaseDemo`) : sans ce point
// d'entrée, rattraper une base créée avant une fonctionnalité récente voulait
// dire la supprimer puis la recréer à la main depuis le panneau.
func (s *serviceBases) rafraichir(ctx context.Context, in *BaseSupprimerInput) (*BasesOutput, error) {
	if err := s.exigerBasePrincipale(); err != nil {
		return nil, err
	}
	nom := strings.ToLower(strings.TrimSpace(in.Nom))
	baseSQL, err := s.baseSQLPour(ctx, nom)
	if err != nil {
		return nil, err
	}
	if pool := s.reg.demonter(nom); pool != nil {
		pool.Close()
	}
	travail, arreter := context.WithTimeout(context.WithoutCancel(ctx), delaiCreationDemo)
	defer arreter()
	if err := detruireBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL); err != nil {
		return nil, socle.Problem(http.StatusServiceUnavailable, "RAFRAICHISSEMENT_IMPOSSIBLE",
			"La base n'a pas pu être réinitialisée. Réessayez.")
	}
	if err := creerBaseSQL(travail, s.Cfg.DatabaseURL, baseSQL); err != nil {
		return nil, err
	}
	pool, i, err := monterBaseDemo(travail, s.Cfg, s.reg, baseSQL, nom, true)
	if err != nil {
		return nil, err
	}
	s.reg.monter(nom, i, pool)
	slog.Info("base de démonstration rafraîchie", "nom", nom, "baseSql", baseSQL,
		"userId", socle.UtilisateurCourant(ctx).ID)
	return s.lister(ctx, nil)
}

// `CREATE DATABASE` refuse toute transaction et n'accepte pas d'identifiant lié :
// c'est le SEUL endroit du dépôt où un identifiant est interpolé, et il ne l'est
// qu'après `nomBaseValide` et un préfixe fixe. `pgx.Identifier` cite la valeur.
func creerBaseSQL(ctx context.Context, dsn, baseSQL string) error {
	conn, err := connexionMaintenance(ctx, dsn)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close(ctx) }()
	_, err = conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{baseSQL}.Sanitize())
	if err == nil {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "permission denied") {
		return socle.Problem(http.StatusServiceUnavailable, "CREATEDB_MANQUANT",
			"Le compte Postgres de l'application n'a pas le droit de créer une base.")
	}
	return err
}

// Sans `FORCE`, une connexion résiduelle fait échouer la destruction et laisse
// une base orpheline que plus rien ne référence.
func detruireBaseSQL(ctx context.Context, dsn, baseSQL string) error {
	conn, err := connexionMaintenance(ctx, dsn)
	if err != nil {
		slog.Error("base de démonstration : destruction impossible", "baseSql", baseSQL, "err", err)
		return err
	}
	defer func() { _ = conn.Close(ctx) }()
	_, err = conn.Exec(ctx, "DROP DATABASE IF EXISTS "+pgx.Identifier{baseSQL}.Sanitize()+" WITH (FORCE)")
	if err != nil {
		slog.Error("base de démonstration : destruction impossible", "baseSql", baseSQL, "err", err)
	}
	return err
}

// `CREATE DATABASE` ne peut pas s'exécuter depuis la base qu'on quitte : la
// connexion de service vise `postgres`, toujours présente.
func connexionMaintenance(ctx context.Context, dsn string) (*pgx.Conn, error) {
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	cfg.Database = "postgres"
	return pgx.ConnectConfig(ctx, cfg)
}

// `pgx.ConnConfig.ConnString()` rend la chaîne d'ORIGINE : muter `Database` puis
// la relire ne change rien, et la connexion part sans nom de base.
func urlPourBase(dsn, baseSQL string) (string, error) {
	u, err := url.Parse(dsn)
	if err != nil {
		return "", err
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" {
		return "", fmt.Errorf("DATABASE_URL n'est pas une URL postgres : %s", u.Scheme)
	}
	u.Path = "/" + baseSQL
	return u.String(), nil
}

// Les migrations s'ajoutent au schéma de départ, elles ne le créent pas : sur
// une base neuve, la première d'entre elles échoue sur une table absente.
// Rejouée sur une base déjà remontée, cette fonction ne fait rien.
func poserSchemaSiVide(ctx context.Context, dsn string) error {
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close(ctx) }()
	var existe bool
	if err := conn.QueryRow(ctx,
		`SELECT to_regclass('public.users') IS NOT NULL`).Scan(&existe); err != nil {
		return err
	}
	if existe {
		return nil
	}
	_, err = conn.Exec(ctx, sqlsource.Schema)
	return err
}

// `semerAussi` n'est vrai qu'à la création. Le semis est idempotent, donc le
// rejouer ne casserait rien, mais il refabriquerait 240 représentants et leurs
// prospects à chaque démarrage, pour chaque base, avant la première requête.
func monterBaseDemo(ctx context.Context, principal *socle.Config, reg *registre,
	baseSQL, nom string, semerAussi bool,
) (*pgxpool.Pool, *instance, error) {
	dsn, err := urlPourBase(principal.DatabaseURL, baseSQL)
	if err != nil {
		return nil, nil, err
	}
	cfg := *principal
	cfg.Base, cfg.DatabaseURL = nom, dsn
	if err := poserSchemaSiVide(ctx, dsn); err != nil {
		return nil, nil, err
	}
	pool, err := ouvrirBase(ctx, dsn)
	if err != nil {
		return nil, nil, err
	}
	if semerAussi {
		if err := semer(ctx, pool, &cfg); err != nil {
			pool.Close()
			return nil, nil, fmt.Errorf("semis de %s : %w", nom, err)
		}
	}
	i, err := instancierBase(ctx, &cfg, pool, reg)
	if err != nil {
		pool.Close()
		return nil, nil, err
	}
	return pool, i, nil
}

// Au démarrage : ce que le panneau a créé doit revenir, sinon un redéploiement
// viderait le sélecteur en laissant les bases Postgres derrière lui.
func remonterBasesDemo(ctx context.Context, d *socle.Deps, reg *registre) {
	lignes, err := d.Q.BasesDemonstration(ctx)
	if err != nil {
		slog.Error("bases de démonstration non relues", "err", err)
		return
	}
	for i := range lignes {
		pool, inst, err := monterBaseDemo(ctx, d.Cfg, reg, lignes[i].BaseSql, lignes[i].Nom, false)
		if err != nil {
			slog.Error("base de démonstration non remontée", "nom", lignes[i].Nom, "err", err)
			continue
		}
		reg.monter(lignes[i].Nom, inst, pool)
		slog.Info("base de démonstration remontée", "nom", lignes[i].Nom)
	}
}

func monterBases(api huma.API, d *socle.Deps, reg *registre) {
	s := &serviceBases{Deps: d, reg: reg}
	huma.Register(api, huma.Operation{
		OperationID: "listerBasesDemo", Method: http.MethodGet, Path: cheminBases,
	}, s.lister)
	huma.Register(api, huma.Operation{
		OperationID: "creerBaseDemo", Method: http.MethodPost, Path: cheminBases,
		DefaultStatus: http.StatusCreated,
	}, s.creer)
	huma.Register(api, huma.Operation{
		OperationID: "supprimerBaseDemo", Method: http.MethodDelete, Path: cheminBases + "/{nom}",
	}, s.supprimer)
	huma.Register(api, huma.Operation{
		OperationID: "rafraichirBaseDemo", Method: http.MethodPost, Path: cheminBases + "/{nom}/rafraichir",
	}, s.rafraichir)
}
