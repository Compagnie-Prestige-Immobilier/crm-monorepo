package support

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	cheminAssistantKairos = "/api/v1/kairos"
	cheminIdentiteKairos  = cheminAssistantKairos + "/identite"
	validiteJetonKairos   = 5 * time.Minute
)

type AssistantKairos struct {
	Actif     bool   `json:"actif" doc:"Le panneau monte la bulle pour cet utilisateur."`
	URL       string `json:"url"`
	Configure bool   `json:"configure" doc:"KAIROS_URL et KAIROS_SDK_SECRET sont posées."`
	Affiche   bool   `json:"affiche"`
}

type AssistantKairosOutput struct{ Body AssistantKairos }

type AfficherKairosInput struct {
	Body struct {
		Affiche bool `json:"affiche"`
	}
}

type IdentiteKairosOutput struct {
	Body struct {
		Jeton string `json:"jeton"`
	}
}

func monterAssistantKairos(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "assistantKairos", Method: http.MethodGet, Path: cheminAssistantKairos,
		Summary: "Dit au panneau s'il monte l'assistant Kairos, et où le charger.",
	}, func(ctx context.Context, _ *struct{}) (*AssistantKairosOutput, error) {
		etat, err := s.assistantKairos(ctx)
		return &AssistantKairosOutput{Body: etat}, err
	})
	huma.Register(api, huma.Operation{
		OperationID: "afficherAssistantKairos", Method: http.MethodPut, Path: cheminAssistantKairos,
		Summary: "Affiche ou retire l'assistant Kairos du panneau pour tous.",
	}, s.afficherKairos)
	huma.Register(api, huma.Operation{
		OperationID: "identiteKairos", Method: http.MethodGet, Path: cheminIdentiteKairos,
		Summary: "Jeton signé qui dit à Kairos au nom de qui il agit.",
	}, s.identiteKairos)
}

func (s *service) assistantKairos(ctx context.Context) (AssistantKairos, error) {
	url, secret := socle.KairosConfigure()
	affiche, err := socle.AssistantKairosAffiche(ctx, s.Q)
	if err != nil {
		return AssistantKairos{}, err
	}
	u := socle.UtilisateurCourant(ctx)
	configure := url != "" && secret != "" && s.Cfg.Base == socle.BasePublique
	etat := AssistantKairos{Configure: configure, Affiche: affiche}
	etat.Actif = configure && affiche && u.Peut(socle.PermissionKairosAssistant)
	if etat.Actif {
		etat.URL = url
	}
	return etat, nil
}

func (s *service) afficherKairos(ctx context.Context, in *AfficherKairosInput) (*AssistantKairosOutput, error) {
	avant, err := socle.AssistantKairosAffiche(ctx, s.Q)
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		valeur := strconv.FormatBool(in.Body.Affiche)
		if _, err := q.UpsertSetting(ctx, db.UpsertSettingParams{Key: socle.CleReglageAssistantKairos, Value: valeur, UpdatedById: &u.ID}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "kairos.affiche", "app_settings", socle.CleReglageAssistantKairos, avant, in.Body.Affiche)
	})
	if err != nil {
		return nil, err
	}
	etat, err := s.assistantKairos(ctx)
	return &AssistantKairosOutput{Body: etat}, err
}

func (s *service) identiteKairos(ctx context.Context, _ *struct{}) (*IdentiteKairosOutput, error) {
	etat, err := s.assistantKairos(ctx)
	if err != nil {
		return nil, err
	}
	if !etat.Actif {
		return nil, socle.Problem(http.StatusForbidden, "KAIROS_INACTIF", "L'assistant Kairos n'est pas ouvert sur ce panneau.")
	}
	u := socle.UtilisateurCourant(ctx)
	_, secret := socle.KairosConfigure()
	out := &IdentiteKairosOutput{}
	out.Body.Jeton, err = socle.SignerIdentiteKairos(secret, socle.IdentiteKairos{
		Sub: u.ID, Role: string(u.Role), Org: s.Cfg.Base, Expire: time.Now().Add(validiteJetonKairos).Unix(),
	})
	return out, err
}
