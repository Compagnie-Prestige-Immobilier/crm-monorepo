package notifications

import (
	"context"
	"cpi-go/internal/shared/socle"
	"time"
)

type service struct{ *socle.Deps }

func Taches(d *socle.Deps) []socle.Tache {
	s := &service{d}
	return []socle.Tache{
		{Nom: "cpi.notifications.due", Cron: socle.ChaqueMinute, Run: s.expedierNotificationsDues},
		{Nom: "cpi.courriels.rejeu", Cron: "*/5 * * * *", Run: s.rejouerCourrielsEnEchec},
		{Nom: "cpi.exploitation.alerte", Cron: cronNotifications("ALERTE_INCIDENTS_AT", "07:00", 0), Run: s.alerterIncidents},
		// Rejoué d'heure en heure : un redémarrage sur l'heure pile ne perd pas les rappels du jour, la période les dédoublonne.
		{Nom: "cpi.notifications.reminders", Cron: cronNotifications("NOTIFICATIONS_REMINDERS_AT", "08:00", 3), Run: s.rappelsQuotidiens},
		{Nom: "cpi.notifications.daily-report", Cron: cronNotifications("NOTIFICATIONS_DAILY_REPORT_AT", "17:00", 0), Run: s.compteRenduQuotidien},
	}
}

func Composer(ctx context.Context, d *socle.Deps, auteur string, in *CreationNotification) (string, error) {
	return (&service{d}).composerNotification(ctx, auteur, in)
}

func ExpedierDues(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).expedierNotificationsDues(ctx)
}

func Expedier(ctx context.Context, d *socle.Deps, ids []string, maintenant time.Time) (map[string]bool, error) {
	return (&service{d}).expedierNotifications(ctx, ids, maintenant)
}

func CompteRenduQuotidien(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).compteRenduQuotidien(ctx)
}

func RappelerEcheancesVentes(ctx context.Context, d *socle.Deps) error {
	return (&service{d}).rappelerEcheancesVentesNotification(ctx, time.Now())
}

func JourNotification(d *socle.Deps, instant time.Time) string {
	return (&service{d}).jourNotification(instant)
}
