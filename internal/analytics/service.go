package analytics

import (
	"context"
	"cpi-go/internal/shared/socle"
)

type service struct{ *socle.Deps }

func CreneauxOuValeursParDefaut(ctx context.Context, d *socle.Deps) []CreneauDeTravail {
	return (&service{d}).creneauxOuValeursParDefaut(ctx)
}
