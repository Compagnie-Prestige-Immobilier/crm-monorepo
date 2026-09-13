package notifications

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

// Un gabarit ne se supprime pas : une notification déjà partie le cite, et le
// détruire priverait le journal de ce qui a été annoncé. Il se retire de la
// liste, comme une entrée de référentiel.
type GabaritActifInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IsActive bool `json:"isActive"`
	}
}

func (s *service) basculerGabaritActif(ctx context.Context, in *GabaritActifInput) (*NotificationModifierGabaritOutput, error) {
	avant, err := s.gabaritNotificationVisible(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	var gabarit db.NotificationTemplateRow
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		row, err := q.BasculerGabaritNotificationActif(ctx, db.BasculerGabaritNotificationActifParams{
			ID: in.ID, IsActive: in.Body.IsActive,
		})
		if err != nil {
			return err
		}
		gabarit = db.NotificationTemplateRow(row)
		return database.Auditer(ctx, q, socle.UtilisateurCourant(ctx).ID, "notification_template.active",
			"notification_template", in.ID, notificationGabaritJournal(&avant), notificationGabaritJournal(&gabarit))
	}); err != nil {
		return nil, err
	}
	return &NotificationModifierGabaritOutput{Body: notificationVersGabarit(&gabarit)}, nil
}

func monterGabaritActif(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "setNotificationTemplateActive", Method: http.MethodPost,
		Path: "/api/v1/notification-templates/{id}/active",
	}, s.basculerGabaritActif)
}
