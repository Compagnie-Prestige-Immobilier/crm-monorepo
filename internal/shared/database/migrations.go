package database

import (
	"context"
	"cpi-go/sql/migrations"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// Le verrou consultatif Postgres sérialise les migrations : un redéploiement qui
// chevauche l'ancien conteneur, ou deux bases sur le même schéma, appliqueraient
// sinon la même migration deux fois.
func Migrer(ctx context.Context, pool *pgxpool.Pool) error {
	verrou, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return err
	}
	// Connexion hors du pool applicatif, jamais rendue : un `lock_timeout` posé
	// sur une connexion empruntée au pool y resterait après le retour au pool,
	// et raccourcirait sans le vouloir les requêtes applicatives suivantes.
	connConfig := pool.Config().ConnConfig.Copy()
	if connConfig.RuntimeParams == nil {
		connConfig.RuntimeParams = map[string]string{}
	}
	// Une contrainte validée sous ACCESS EXCLUSIVE peut attendre une requête en
	// cours sur la même table : sans borne, elle gèle le panneau le temps de
	// cette requête plutôt que d'échouer et de laisser goose réessayer.
	connConfig.RuntimeParams["lock_timeout"] = "5s"
	sqlDB := stdlib.OpenDB(*connConfig)
	defer func() { _ = sqlDB.Close() }()
	fournisseur, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS,
		goose.WithSessionLocker(verrou), goose.WithLogger(goose.NopLogger()))
	if err != nil {
		return err
	}
	_, err = fournisseur.Up(ctx)
	return err
}
