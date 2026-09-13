package accueil

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

// Une visite saisie par erreur restait au registre pour toujours. L'archivage
// est immédiat et réversible en base ; la destruction est définitive, donc
// réservée à la direction et refusée tant que l'archive n'a pas vieilli.
const (
	delaiDestructionVisite = 30
	cheminVisite           = "/api/v1/visites/{id}"
)

type VisiteIDInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) archiverVisite(ctx context.Context, in *VisiteIDInput) (*struct{}, error) {
	avant, err := s.Q.VisiteParId(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VISITE_NOT_FOUND", "Visite introuvable.")
	}
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.ArchiverVisite(ctx, db.ArchiverVisiteParams{ID: in.ID, DeletedById: pointeurID(ctx)})
	if err != nil {
		return nil, err
	}
	if lignes == 0 {
		return nil, socle.Problem(http.StatusNotFound, "VISITE_NOT_FOUND", "Visite introuvable.")
	}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := database.Auditer(ctx, s.Q, acteur, "visite.archive", "visite", in.ID,
		map[string]any{"reference": avant.Reference, "visiteur": avant.VisitorName}, nil); err != nil {
		return nil, err
	}
	s.Live.Emettre("visites")
	return &struct{}{}, nil
}

func (s *service) detruireVisite(ctx context.Context, in *VisiteIDInput) (*struct{}, error) {
	archive, err := s.Q.VisiteArchivee(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusConflict, "VISITE_NON_ARCHIVEE",
			"Cette visite doit d'abord être archivée.")
	}
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.DetruireVisite(ctx, db.DetruireVisiteParams{ID: in.ID, DelaiJours: delaiDestructionVisite})
	if err != nil {
		return nil, err
	}
	if lignes == 0 {
		return nil, socle.Problem(http.StatusConflict, "ARCHIVE_TROP_RECENTE",
			"Une archive ne se détruit qu'au bout de trente jours.")
	}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := database.Auditer(ctx, s.Q, acteur, "visite.destruction", "visite", in.ID,
		map[string]any{"reference": archive.Reference, "visiteur": archive.VisitorName}, nil); err != nil {
		return nil, err
	}
	s.Live.Emettre("visites")
	return &struct{}{}, nil
}

func pointeurID(ctx context.Context) *string {
	id := socle.UtilisateurCourant(ctx).ID
	return &id
}

func monterArchivageVisites(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "archiverVisite", Method: http.MethodDelete,
		Path: cheminVisite, DefaultStatus: http.StatusNoContent,
	}, s.archiverVisite)
	huma.Register(api, huma.Operation{
		OperationID: "detruireVisite", Method: http.MethodDelete,
		Path: cheminVisite + "/definitif", DefaultStatus: http.StatusNoContent,
	}, s.detruireVisite)
}
