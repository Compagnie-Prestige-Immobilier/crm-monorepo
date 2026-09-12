package imports

import (
	"context"
	"cpi-go/internal/shared/socle"
)

type service struct{ *socle.Deps }

func Taches(d *socle.Deps) []socle.Tache {
	s := &service{d}
	return []socle.Tache{
		{Nom: "cpi.imports.sweep", Cron: socle.ChaqueMinute, Run: s.balayerImports},
		{Nom: "cpi.imports.leads", Cron: "*/15 * * * *", Run: s.releverLeads},
	}
}

func CourirImport(ctx context.Context, d *socle.Deps, jobID string) error {
	return (&service{d}).courirImport(ctx, jobID)
}

func ReleverLeads(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).releverLeads(ctx)
}

func BalayerImports(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).balayerImports(ctx)
}
