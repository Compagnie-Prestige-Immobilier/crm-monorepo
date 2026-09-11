package main

import (
	"cpi-go/internal/accueil"
	"cpi-go/internal/admin"
	"cpi-go/internal/analytics"
	"cpi-go/internal/auth"
	"cpi-go/internal/banque"
	"cpi-go/internal/campagnes"
	"cpi-go/internal/exports"
	"cpi-go/internal/imports"
	"cpi-go/internal/notifications"
	"cpi-go/internal/prospects"
	"cpi-go/internal/qualification"
	"cpi-go/internal/referentiels"
	"cpi-go/internal/representants"
	"cpi-go/internal/shared/socle"

	"github.com/danielgtaylor/huma/v2"
)

// Chaque domaine expose Monter(api, deps), Garde et, s'il en a, Taches(deps).
// Les trois listes ci-dessous sont les seuls points d'ancrage partagés.
func monterDomaines(api huma.API, d *socle.Deps) error {
	if err := auth.Monter(api, d); err != nil {
		return err
	}
	socle.MonterLive(api, d.Live)
	referentiels.Monter(api, d)
	representants.Monter(api, d)
	notifications.Monter(api, d)
	imports.Monter(api, d)
	admin.Monter(api, d)
	analytics.Monter(api, d)
	prospects.Monter(api, d)
	prospects.MonterFormulairePublic(api, d)
	accueil.Monter(api, d)
	exports.Monter(api, d)
	banque.Monter(api, d)
	campagnes.Monter(api, d)
	qualification.Monter(api, d)
	return nil
}

func gardesDomaines() []map[string][]socle.Role {
	return []map[string][]socle.Role{
		auth.Garde,
		socle.GardeLive,
		referentiels.Garde,
		representants.Garde,
		notifications.Garde,
		notifications.GardeCourriels,
		imports.Garde,
		admin.Garde,
		analytics.Garde,
		prospects.Garde,
		prospects.GardeFormulairePublic,
		accueil.Garde,
		exports.Garde,
		banque.Garde,
		campagnes.Garde,
		qualification.Garde,
	}
}

func tachesDomaines(d *socle.Deps) []socle.Tache {
	taches := []socle.Tache{{Nom: "cpi.sessions.purge", Cron: "0 4 * * *", Run: d.Q.PurgeExpiredSessions}}
	for _, t := range [][]socle.Tache{notifications.Taches(d), imports.Taches(d), admin.Taches(d)} {
		taches = append(taches, t...)
	}
	return taches
}
