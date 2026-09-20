package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const prospectIssueReporte = "REPORTE"

type ProspectSuiviRendezVousInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Issue          string     `json:"issue" enum:"HONORE,NON_HONORE,REPORTE"`
		ReporteAt      *time.Time `json:"reporteAt,omitempty" format:"date-time"`
		SuiteRencontre *string    `json:"suiteRencontre,omitempty" enum:"TRES_CHAUD,CHAUD,A_SUIVRE"`
	}
}

func (s *service) prospectSuivreRendezVous(ctx context.Context, in *ProspectSuiviRendezVousInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	b := &in.Body
	if (b.Issue == prospectIssueReporte) != (b.ReporteAt != nil) {
		return nil, socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_REPORT", "Un rendez-vous reporté demande sa nouvelle date, et seulement lui.")
	}
	if b.SuiteRencontre != nil && b.Issue != "HONORE" {
		return nil, socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_SUITE_SANS_RENCONTRE", "La suite après rencontre se note sur un rendez-vous honoré.")
	}
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	var reporteAt *time.Time
	if b.ReporteAt != nil {
		utc := b.ReporteAt.UTC()
		reporteAt = &utc
	}
	err := s.prospectTx(ctx, func(q *db.Queries) error {
		avant, err := q.SuivreRendezVous(ctx, db.SuivreRendezVousParams{Issue: b.Issue, ReporteAt: reporteAt, Suite: b.SuiteRencontre, ID: in.ID})
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, "RENDEZ_VOUS_ABSENT", "Cette fiche n'est pas classée en rendez-vous.")
		}
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.suivi_rendez_vous", prospectEntite, in.ID,
			map[string]any{"issue": avant.IssueAvant, "suiteRencontre": avant.SuiteAvant},
			map[string]any{"issue": b.Issue, "suiteRencontre": b.SuiteRencontre, "reporteAt": reporteAt})
	})
	if err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func prospectMonterRendezVous(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "suivreRendezVousProspect", Method: http.MethodPost,
		Path: "/api/v1/prospects/{id}/suivi-rendez-vous",
	}, s.prospectSuivreRendezVous)
}
