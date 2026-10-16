package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	cheminOrphelins = "/api/v1/portefeuilles-orphelins"
	cheminReprise   = cheminOrphelins + "/{id}/reprise"
	// L'écran où l'encadrement reprend les portefeuilles laissés sans repreneur.
	routeOrphelins = "/teleconseil/orphelines"
)

// Reprendre un portefeuille, c'est réaffecter des fiches d'un téléconseiller à
// un autre : la même permission que la réaffectation fiche par fiche.
var GardeOrphelins = map[string]socle.Permission{
	"GET " + cheminOrphelins: socle.PermissionProspectsReaffecterTout,
	"POST " + cheminReprise:  socle.PermissionProspectsReaffecterTout,
}

type PortefeuilleOrphelin struct {
	ID            string    `json:"id"`
	FullName      string    `json:"fullName"`
	Role          string    `json:"role"`
	Supprime      bool      `json:"supprime" doc:"Le compte est supprimé : il ne sera jamais réactivé."`
	DepuisLe      time.Time `json:"depuisLe" doc:"Dernière modification du compte, en pratique sa désactivation."`
	Prospects     int       `json:"prospects"`
	Representants int       `json:"representants"`
}

type PortefeuillesOrphelinsOutput struct {
	Body struct {
		Items []PortefeuilleOrphelin `json:"items"`
	}
}

type RepriseOrphelinInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		HandoverToID string `json:"handoverToId" format:"uuid"`
	}
}

func monterOrphelins(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "listOrphanPortfolios", Method: http.MethodGet, Path: cheminOrphelins}, s.listerOrphelins)
	huma.Register(api, huma.Operation{OperationID: "takeOverOrphanPortfolio", Method: http.MethodPost, Path: cheminReprise}, s.reprendreOrphelin)
}

func (s *service) listerOrphelins(ctx context.Context, _ *struct{}) (*PortefeuillesOrphelinsOutput, error) {
	rows, err := s.Q.PortefeuillesOrphelins(ctx)
	if err != nil {
		return nil, err
	}
	out := &PortefeuillesOrphelinsOutput{}
	out.Body.Items = make([]PortefeuilleOrphelin, 0, len(rows))
	for _, r := range rows {
		out.Body.Items = append(out.Body.Items, PortefeuilleOrphelin{
			ID: r.ID, FullName: r.FullName, Role: r.Role, Supprime: r.Supprime,
			DepuisLe: r.UpdatedAt, Prospects: int(r.Prospects), Representants: int(r.Representants),
		})
	}
	return out, nil
}

// Un compte encore actif garde son portefeuille : le lui retirer passe par la
// désactivation, ou par la réaffectation fiche par fiche.
func (s *service) reprendreOrphelin(ctx context.Context, in *RepriseOrphelinInput) (*struct{}, error) {
	actif, err := s.Q.CompteActif(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Compte introuvable.")
	}
	if err != nil {
		return nil, err
	}
	if actif {
		return nil, socle.Problem(http.StatusConflict, "PORTFOLIO_OWNER_ACTIVE", "Ce compte est actif : son portefeuille n’est pas orphelin.")
	}
	repreneur := in.Body.HandoverToID
	return nil, s.reprisePortefeuille(ctx, in.ID, &repreneur, socle.UtilisateurCourant(ctx).ID)
}

// Désactivé sans repreneur, le portefeuille reste au compte parti ; l'encadrement
// en est averti pour le reprendre. Un avis manqué ne défait pas la désactivation.
func (s *service) signalerOrphelin(ctx context.Context, compte *Compte, compteurs db.CountPortfolioRow, acteurID string) {
	if compteurs.Prospects == 0 && compteurs.Representants == 0 {
		return
	}
	if err := database.Auditer(ctx, s.Q, acteurID, "portfolio.orphaned", "user", compte.ID, nil,
		map[string]any{"prospects": compteurs.Prospects, nomRepresentants: compteurs.Representants}); err != nil {
		slog.Warn("portefeuille orphelin : trace non écrite", "userId", compte.ID, "err", err)
	}
	_, err := notifications.Composer(ctx, s.Deps, acteurID, &notifications.CreationNotification{
		Title: "Portefeuille à reprendre",
		Body: fmt.Sprintf("Le compte de %s a été désactivé : %d prospect(s) et %d représentant(s) attendent un repreneur.",
			compte.FullName, compteurs.Prospects, compteurs.Representants),
		Route: routeOrphelins, Category: string(db.NotificationCategorySYSTEME),
		Audience: string(db.NotificationAudienceROLE), AudienceRole: string(socle.Superviseur),
	})
	if err != nil {
		slog.Warn("portefeuille orphelin : avis non envoyé", "userId", compte.ID, "err", err)
	}
}
