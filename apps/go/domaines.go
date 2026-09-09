package main

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

const chaqueMinute = "*/1 * * * *"

type tache struct {
	nom  string
	cron string
	run  func(context.Context) error
}

// Chaque domaine expose monterX(api, s), gardeX et, s'il en a, tachesX(s).
// Les trois listes ci-dessous sont les seuls points d'ancrage partagés.
func monterDomaines(api huma.API, s *service) {
	monterAuth(api, s)
	monterLive(api, s)
	monterReferentiels(api, s)
	monterRepresentants(api, s)
	monterNotifications(api, s)
	monterImports(api, s)
	monterAdmin(api, s)
	monterAnalytics(api, s)
	monterProspects(api, s)
	monterFormulairePublic(api, s)
	monterAccueil(api, s)
	monterExports(api, s)
	// monter:
	monterBanque(api, s)
	monterCampagnes(api, s)
	monterQualification(api, s)
}

func gardesDomaines() []map[string][]Role {
	return []map[string][]Role{
		gardeAuth,
		gardeLive,
		gardeReferentiels,
		gardeRepresentants,
		gardeNotifications,
		gardeImports,
		gardeAdmin,
		gardeAnalytics,
		gardeProspects,
		gardeFormulairePublic,
		gardeAccueil,
		gardeExports,
		// garde:
		gardeBanque,
		gardeCampagnes,
		gardeQualification,
	}
}

func tachesDomaines(s *service) []tache {
	return []tache{
		{"cpi.sessions.purge", "0 4 * * *", s.q.PurgeExpiredSessions},
		{"cpi.notifications.due", chaqueMinute, s.expedierNotificationsDues},
		{"cpi.notifications.reminders", cronNotifications("NOTIFICATIONS_REMINDERS_AT", "08:00"), s.rappelsQuotidiens},
		{"cpi.notifications.daily-report", cronNotifications("NOTIFICATIONS_DAILY_REPORT_AT", "17:00"), s.compteRenduQuotidien},
		{"cpi.imports.sweep", chaqueMinute, s.balayerImports},
		{"cpi.enrolement.tirage", chaqueMinute, s.tirerEnrolement},
		{"cpi.db-dump.sweep", "*/10 * * * *", s.balayerDumps},
		// taches:
		{"cpi.notes-vocales.purge", "0 * * * *", s.balayerNotesVocales},
	}
}
