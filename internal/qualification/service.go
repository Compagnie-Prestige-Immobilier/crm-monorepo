package qualification

import (
	"context"
	"cpi-go/internal/shared/socle"
)

type service struct{ *socle.Deps }

func Taches(d *socle.Deps) []socle.Tache {
	s := &service{d}
	return []socle.Tache{{Nom: "cpi.notes-vocales.purge", Cron: "0 * * * *", Run: s.balayerNotesVocales}}
}

func BalayerNotesVocales(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).balayerNotesVocales(ctx)
}
