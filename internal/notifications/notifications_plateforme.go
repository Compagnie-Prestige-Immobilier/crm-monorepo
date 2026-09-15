package notifications

import (
	"context"
	"cpi-go/internal/shared/socle"
	"errors"
	"strconv"
	"time"
)

const routeFichesPlateforme = "/teleconseil/plateforme"

// Chaque matin, les CCP apprennent ce qui est arrivé la veille et ce qui
// attend encore un premier appel ; au-delà du seuil réglé pour le projet,
// l'encadrement l'apprend aussi (docs/decisions/fiches-plateforme.md).
func (s *service) rappelerFichesPlateformeNotification(ctx context.Context, maintenant time.Time) error {
	groupes, err := s.Q.FichesPlateformeDuJour(ctx, maintenant.Add(-24*time.Hour))
	if err != nil || len(groupes) == 0 {
		return err
	}
	nouvelles, aAppeler := 0, 0
	for _, groupe := range groupes {
		nouvelles += int(groupe.Nouvelles)
		aAppeler += int(groupe.AAppeler)
	}
	var erreurs []error
	if nouvelles > 0 || aAppeler > 0 {
		candidats, err := s.candidatsParRolesNotification(ctx, []string{string(socle.CCP)}, map[string]string{
			"nouvelles": strconv.Itoa(nouvelles), "aAppeler": strconv.Itoa(aAppeler),
		})
		if err != nil {
			return err
		}
		erreurs = append(erreurs, s.emettreRappelNotification(ctx, notificationCleFichesPlateforme, maintenant, candidats,
			"Fiches plateforme", "{{nouvelles}} nouvelle(s) fiche(s) depuis hier, {{aAppeler}} attendent un premier appel.",
			routeFichesPlateforme, "RAPPEL"))
	}
	for _, groupe := range groupes {
		erreurs = append(erreurs, s.signalerAttentePlateforme(ctx, maintenant, string(groupe.Projet), int(groupe.AAppeler)))
	}
	return errors.Join(erreurs...)
}

func (s *service) signalerAttentePlateforme(ctx context.Context, maintenant time.Time, projet string, aAppeler int) error {
	seuil, err := socle.SeuilAttentePlateforme(ctx, s.Q, projet)
	if err != nil || seuil == 0 || aAppeler <= seuil {
		return err
	}
	candidats, err := s.candidatsParRolesNotification(ctx, []string{string(socle.Superviseur), string(socle.Admin)},
		map[string]string{"fiches": strconv.Itoa(aAppeler), "projet": projet, "seuil": strconv.Itoa(seuil)})
	if err != nil {
		return err
	}
	return s.emettreRappelNotification(ctx, notificationCleAttentePlateforme+":"+projet, maintenant, candidats,
		"Fiches plateforme en attente",
		"{{fiches}} fiche(s) {{projet}} venue(s) de la plateforme attendent un premier appel, au-delà du seuil de {{seuil}}. Les chargés de clientèle plateforme ont besoin de renfort.",
		routeFichesPlateforme, "RAPPEL")
}
