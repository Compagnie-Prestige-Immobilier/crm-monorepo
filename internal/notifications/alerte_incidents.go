package notifications

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

const CourrielIncident = "INCIDENT"

// Rien ne prévenait personne : une tâche en échec ou un courriel définitivement
// refusé n'existaient que dans l'écran Exploitation, qu'il faut penser à ouvrir.
// Les destinataires sont les comptes ADMIN actifs, pas un réglage de plus.
func (s *service) alerterIncidents(ctx context.Context) error {
	incidents, err := s.Q.IncidentsDesDernieresHeures(ctx, tentativesCourrielMax)
	if err != nil || len(incidents) == 0 {
		return err
	}
	adresses, err := s.Q.AdminsActifsEmails(ctx)
	if err != nil {
		return err
	}
	if len(adresses) == 0 {
		slog.Error("alerte d’incident non expédiée", "cause", "aucun compte ADMIN actif avec une adresse")
		return nil
	}
	lignes := make([][2]string, 0, len(incidents))
	for i := range incidents {
		quoi := ""
		if incidents[i].Quoi != nil {
			quoi = *incidents[i].Quoi
		}
		lignes = append(lignes, [2]string{
			incidents[i].Genre + " " + quoi,
			resumeIncident(incidents[i].Quand, incidents[i].Erreur),
		})
	}
	return EnvoyerCourriel(ctx, s.Deps, &Courriel{
		Type:          CourrielIncident,
		Sujet:         fmt.Sprintf("[CPI] %d incident(s) sur les dernières 24 h", len(incidents)),
		Destinataires: adresses,
		ObjetType:     "exploitation",
		ObjetID:       time.Now().Format(time.DateOnly),
		Titre:         "Incidents des dernières 24 heures",
		Intro: "Les tâches planifiées et les courriels ci-dessous ont échoué. " +
			"Le détail complet est dans l’écran Exploitation.",
		Lignes: lignes,
	})
}

func resumeIncident(quand *time.Time, erreur *string) string {
	horodatage := ""
	if quand != nil {
		horodatage = quand.Format("02/01 15:04") + " "
	}
	if erreur == nil || *erreur == "" {
		return horodatage + "cause non consignée"
	}
	detail := *erreur
	if len(detail) > 300 {
		detail = detail[:300] + "…"
	}
	return horodatage + detail
}
