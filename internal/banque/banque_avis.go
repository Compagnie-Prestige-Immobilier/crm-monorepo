package banque

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"fmt"
	"log/slog"
)

// L'échec d'un avis n'annule pas la demande, déjà écrite : la perdre sur une
// panne du canal d'alerte remettrait l'agent bancaire dans l'impasse que ce
// module lève.
func (s *service) banqueAviser(ctx context.Context, etape, auteur string, avis *notifications.CreationNotification) {
	if _, err := notifications.Composer(ctx, s.Deps, auteur, avis); err != nil {
		slog.Warn("notification non émise", "etape", etape, "err", err)
	}
}

func (s *service) banqueAviserDemandeur(ctx context.Context, auteur string, demande *DemandeClientBanque, accepte bool) {
	avis := notifications.CreationNotification{
		Title: "Demande de création refusée",
		Body: fmt.Sprintf("%s %s : %s.", demande.Prenom, demande.Nom,
			banqueMotifOuSans(demande.RejectionNote)),
		Category: string(db.NotificationCategorySYSTEME), Route: banqueRouteDemandes,
		Audience: string(db.NotificationAudienceUSERS), AudienceUserIDs: []string{demande.RequestedByID},
	}
	if accepte {
		avis.Title = "Client créé"
		avis.Body = fmt.Sprintf("%s %s est désormais en base : le dossier peut lui être rattaché.",
			demande.Prenom, demande.Nom)
		avis.Route = banqueRouteDossiers
	}
	s.banqueAviser(ctx, "arbitrage", auteur, &avis)
}

func banqueMotifOuSans(motif *string) string {
	if motif == nil {
		return "sans motif"
	}
	return *motif
}
