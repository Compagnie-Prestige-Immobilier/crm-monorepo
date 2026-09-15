package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"errors"
	"log/slog"
	"net/url"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *service) tirerLigne(ctx context.Context, projet, base string, ligne *inscriptionDistante, candidat *string,
	connus []string, tirageAt time.Time, bilan *BilanTirage,
) error {
	prospectID, err := s.rattacherPlateforme(ctx, projet, base, ligne, candidat, tirageAt)
	if err != nil {
		return err
	}
	if prospectID != nil {
		bilan.Rapproches++
	}
	if slices.Contains(connus, ligne.IdentifiantDistant) {
		bilan.MisAJour++
	} else {
		bilan.Crees++
	}
	return s.deposerInscription(ctx, projet, ligne, prospectID, tirageAt)
}

// Une inscription rapprochée fait de la fiche une fiche plateforme, qui sort
// des campagnes à l'instant (docs/decisions/fiches-plateforme.md). Sans fiche
// au numéro, une fiche neuve naît pour que les CCP voient chaque inscrit.
func (s *service) rattacherPlateforme(ctx context.Context, projet, base string, ligne *inscriptionDistante, prospectID *string, quand time.Time) (*string, error) {
	depuis := quand
	if ligne.InscriteLe != nil {
		depuis = *ligne.InscriteLe
	}
	if prospectID == nil {
		id, err := s.creerProspectPlateforme(ctx, projet, base, ligne, depuis)
		if err != nil || id == "" {
			return nil, err
		}
		prospectID = &id
	}
	marquee, err := s.Q.MarquerProspectPlateforme(ctx, db.MarquerProspectPlateformeParams{ID: *prospectID, Depuis: depuis})
	if err != nil || marquee == 0 {
		return prospectID, err
	}
	return prospectID, s.retirerDesCampagnes(ctx, *prospectID)
}

// Vide sans erreur : l'inscription n'a pas de numéro, ou aucun administrateur ne peut porter la fiche.
func (s *service) creerProspectPlateforme(ctx context.Context, projet, base string, ligne *inscriptionDistante, depuis time.Time) (string, error) {
	if ligne.PhoneE164 == nil {
		return "", nil
	}
	demandeur, err := s.Q.ImportDemandeurSysteme(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		slog.Warn("fiche plateforme non créée : aucun administrateur actif", "projet", projet)
		return "", nil
	}
	if err != nil {
		return "", err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	nom := ligne.Nom
	if nom == "" {
		nom = "Inscription plateforme"
	}
	cree, err := s.Q.CreerProspectPlateforme(ctx, db.CreerProspectPlateformeParams{
		ID: id.String(), Nom: nom, Prenom: ligne.Prenom, PhoneE164: ligne.PhoneE164, Email: ligne.Email,
		CreatedByID: demandeur, Depuis: depuis, Projet: db.Projet(projet), OriginLabel: hoteDe(base),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		existant, err := s.Q.ProspectParTelephone(ctx, ligne.PhoneE164)
		if err != nil {
			return "", err
		}
		return existant.ID, nil
	}
	if err != nil {
		return "", err
	}
	parcours, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	_, err = s.Q.OuvrirParcours(ctx, db.OuvrirParcoursParams{ID: parcours.String(), ProspectID: cree, Projet: projet})
	return cree, err
}

func (s *service) retirerDesCampagnes(ctx context.Context, prospectID string) error {
	lots, err := s.Q.LotsAttribuesDuProspect(ctx, &prospectID)
	if err != nil || len(lots) == 0 {
		return err
	}
	if err := s.Q.RetirerProspectDesCampagnes(ctx, &prospectID); err != nil {
		return err
	}
	demandeur, err := s.Q.ImportDemandeurSysteme(ctx)
	if err != nil {
		return err
	}
	for _, lot := range lots {
		if err := database.Auditer(ctx, s.Q, demandeur, "lot_export.plateforme", "lot_export", lot.LotId, nil,
			map[string]any{"prospectId": prospectID, "position": lot.Position, "teleconseillerId": lot.AssigneeId}); err != nil {
			return err
		}
	}
	return nil
}

func hoteDe(base string) *string {
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return nil
	}
	return &u.Host
}
