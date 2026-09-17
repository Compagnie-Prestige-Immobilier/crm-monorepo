package main

import (
	"context"
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
	"cpi-go/internal/ventes"
	"errors"

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
	prospects.MonterLienFormulaire(api, d)
	accueil.Monter(api, d)
	exports.Monter(api, d)
	banque.Monter(api, d)
	campagnes.Monter(api, d)
	qualification.Monter(api, d)
	ventes.Monter(api, d)
	return nil
}

func gardesDomaines() []map[string]socle.Permission {
	return []map[string]socle.Permission{
		auth.Garde,
		socle.GardeLive,
		referentiels.Garde,
		representants.Garde,
		notifications.Garde,
		notifications.GardeCourriels,
		imports.Garde,
		admin.Garde,
		admin.GardeRoles,
		analytics.Garde,
		prospects.Garde,
		prospects.GardeFormulairePublic,
		prospects.GardeLienFormulaire,
		accueil.Garde,
		exports.Garde,
		banque.Garde,
		campagnes.Garde,
		qualification.Garde,
		ventes.Garde,
	}
}

func tachesDomaines(d *socle.Deps) []socle.Tache {
	taches := []socle.Tache{{Nom: "cpi.sessions.purge", Cron: "0 4 * * *", Run: func(ctx context.Context) error {
		// `cron_runs` gagne environ 4 600 lignes par jour et `metriques_http`
		// une ligne par route, par heure et par classe : sans échéance, les deux
		// tables d'exploitation finissent par peser plus que le métier.
		return errors.Join(d.Q.PurgeExpiredSessions(ctx), d.Q.PurgeCronRuns(ctx),
			d.Q.PurgeMetriquesHttp(ctx), d.Q.PurgeCourrielsPiecesJointes(ctx))
	}}}
	for _, t := range [][]socle.Tache{notifications.Taches(d), imports.Taches(d), admin.Taches(d)} {
		taches = append(taches, t...)
	}
	return taches
}
