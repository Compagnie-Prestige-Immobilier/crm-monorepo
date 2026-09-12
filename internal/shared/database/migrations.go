package database

import (
	"context"
	"cpi-go/sql/migrations"
	"errors"

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
	sqlDB := stdlib.OpenDBFromPool(pool)
	fournisseur, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS,
		goose.WithSessionLocker(verrou), goose.WithLogger(goose.NopLogger()))
	if err != nil {
		return errors.Join(err, sqlDB.Close())
	}
	_, err = fournisseur.Up(ctx)
	return errors.Join(err, sqlDB.Close())
}
