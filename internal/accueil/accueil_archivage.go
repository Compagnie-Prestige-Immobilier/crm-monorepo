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
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		lignes, err := q.ArchiverVisite(ctx, db.ArchiverVisiteParams{ID: in.ID, DeletedById: &acteur})
		if err != nil {
			return err
		}
		if lignes == 0 {
			return socle.Problem(http.StatusNotFound, "VISITE_NOT_FOUND", "Visite introuvable.")
		}
		return database.Auditer(ctx, q, acteur, "visite.archive", "visite", in.ID,
			map[string]any{"reference": avant.Reference, "visiteur": avant.VisitorName}, nil)
	}); err != nil {
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
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		lignes, err := q.DetruireVisite(ctx, db.DetruireVisiteParams{ID: in.ID, DelaiJours: delaiDestructionVisite})
		if err != nil {
			return err
		}
		if lignes == 0 {
			return socle.Problem(http.StatusConflict, "ARCHIVE_TROP_RECENTE",
				"Une archive ne se détruit qu'au bout de trente jours.")
		}
		return database.Auditer(ctx, q, acteur, "visite.destruction", "visite", in.ID,
			map[string]any{"reference": archive.Reference, "visiteur": archive.VisitorName}, nil)
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre("visites")
	return &struct{}{}, nil
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
