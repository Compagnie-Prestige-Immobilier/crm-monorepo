package admin

import (
	"cpi-go/internal/shared/socle"
)

type service struct{ *socle.Deps }

func Taches(d *socle.Deps) []socle.Tache {
	s := &service{d}
	return []socle.Tache{
		{Nom: "cpi.enrolement.tirage", Cron: socle.ChaqueMinute, Run: s.tirerEnrolement},
		{Nom: "cpi.db-dump.sweep", Cron: "*/10 * * * *", Run: s.balayerDumps},
	}
}
