package support

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	cheminKairo        = "/api/v1/admin/kairo"
	cheminKairoPause   = cheminKairo + "/pause"
	cheminKairoReprise = cheminKairo + "/reprise"
	cheminKairoRelance = cheminKairo + "/tickets/{id}/relance"
)

var clientKairo = &http.Client{Timeout: 5 * time.Second}

type TicketKairo struct {
	ID            int     `json:"id"`
	Projet        string  `json:"projet"`
	Statut        string  `json:"statut"`
	Essais        int     `json:"essais"`
	MajLe         string  `json:"majLe"`
	Lien          string  `json:"lien"`
	Resume        string  `json:"resume,omitempty"`
	Cause         string  `json:"cause,omitempty"`
	Notes         string  `json:"notes,omitempty"`
	PRURL         string  `json:"prUrl,omitempty"`
	Fichiers      string  `json:"fichiers,omitempty"`
	DureeSecondes int     `json:"dureeSecondes,omitempty"`
	JevCategorie  string  `json:"jevCategorie,omitempty"`
	JevConfiance  float64 `json:"jevConfiance,omitempty"`
	Consigne      string  `json:"consigne,omitempty"`
}

type EtatKairo struct {
	Sain                    bool          `json:"sain"`
	PauseDepuis             *string       `json:"pauseDepuis"`
	DerniereLectureSecondes int           `json:"derniereLectureSecondes"`
	IntervalleSecondes      int           `json:"intervalleSecondes"`
	Agents                  []string      `json:"agents"`
	Tickets                 []TicketKairo `json:"tickets"`
	MTTRSecondes            int           `json:"mttrSecondes,omitempty"`
	JevActif                bool          `json:"jevActif,omitempty"`
}

type UsageModele struct {
	Modele string `json:"modele"`
	Nombre int32  `json:"nombre"`
}

type ReformulationRecente struct {
	ID                   string    `json:"id"`
	CreeLe               time.Time `json:"creeLe"`
	ReformulePar         *string   `json:"reformulePar"`
	Description          string    `json:"description"`
	Contexte             string    `json:"contexte"`
	DescriptionTransmise string    `json:"descriptionTransmise"`
}

type ReformulationIA struct {
	Active       bool                   `json:"active"`
	Fournisseurs []string               `json:"fournisseurs"`
	ParModele    []UsageModele          `json:"parModele" doc:"Signalements des 30 derniers jours ; un modèle vide = texte d'origine transmis."`
	Recentes     []ReformulationRecente `json:"recentes"`
}

type TableauKairoOutput struct {
	Body struct {
		Kairo         *EtatKairo      `json:"kairo"`
		KairoErreur   string          `json:"kairoErreur,omitempty"`
		Reformulation ReformulationIA `json:"reformulation"`
	}
}

type RelanceTicketKairoInput struct {
	ID   int `path:"id" minimum:"1"`
	Body *struct {
		Consigne string `json:"consigne,omitempty"`
		Action   string `json:"action,omitempty"`
	}
}

func monterKairo(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "tableauKairo", Method: http.MethodGet, Path: cheminKairo,
		Summary: "État de Kairo et usage de la reformulation IA des signalements.",
	}, s.tableauKairo)
	huma.Register(api, huma.Operation{
		OperationID: "pauseKairo", Method: http.MethodPost, Path: cheminKairoPause, DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		return nil, commanderKairo(ctx, "/pause", nil)
	})
	huma.Register(api, huma.Operation{
		OperationID: "repriseKairo", Method: http.MethodPost, Path: cheminKairoReprise, DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		return nil, commanderKairo(ctx, "/reprise", nil)
	})
	huma.Register(api, huma.Operation{
		OperationID: "relanceTicketKairo", Method: http.MethodPost, Path: cheminKairoRelance, DefaultStatus: http.StatusNoContent,
		Summary: "Remet à Kairo un ticket en échec ou escaladé.",
	}, func(ctx context.Context, in *RelanceTicketKairoInput) (*struct{}, error) {
		var corps any
		if in.Body != nil {
			corps = in.Body
		}
		return nil, commanderKairo(ctx, fmt.Sprintf("/tickets/%d/relance", in.ID), corps)
	})
}

func (s *service) tableauKairo(ctx context.Context, _ *struct{}) (*TableauKairoOutput, error) {
	out := &TableauKairoOutput{}
	parModele, err := s.Q.SupportReformulationsParModele(ctx)
	if err != nil {
		return nil, err
	}
	recentes, err := s.Q.SupportDernieresReformulations(ctx)
	if err != nil {
		return nil, err
	}
	r := &out.Body.Reformulation
	r.Active, r.Fournisseurs = reformulationActive(), []string{}
	r.ParModele, r.Recentes = []UsageModele{}, []ReformulationRecente{}
	for _, f := range fournisseursConfigures() {
		r.Fournisseurs = append(r.Fournisseurs, f.nom)
	}
	for _, ligne := range parModele {
		r.ParModele = append(r.ParModele, UsageModele{Modele: ligne.Modele, Nombre: ligne.Nombre})
	}
	for _, ligne := range recentes {
		r.Recentes = append(r.Recentes, ReformulationRecente{
			ID: ligne.ID, CreeLe: ligne.CreatedAt, ReformulePar: ligne.ReformulePar,
			Description: ligne.Description, Contexte: ligne.Contexte, DescriptionTransmise: ligne.DescriptionTransmise,
		})
	}
	out.Body.Kairo, err = lireKairo(ctx)
	var probleme huma.StatusError
	switch {
	case err == nil:
	case errors.As(err, &probleme):
		out.Body.KairoErreur = probleme.Error()
	default:
		slog.Warn("état de Kairo illisible", "err", err)
		out.Body.KairoErreur = "Kairo ne répond pas. Vérifiez qu'il tourne sur Dokploy."
	}
	return out, nil
}

func appelKairo(ctx context.Context, methode, chemin string, corps any) (*http.Response, error) {
	base, jeton := socle.Env("KAIRO_URL", ""), socle.Env("KAIRO_ADMIN_TOKEN", "")
	if base == "" || jeton == "" {
		return nil, socle.Problem(http.StatusServiceUnavailable, "KAIRO_NON_CONFIGURE", "Kairo n'est pas relié à ce serveur. Renseignez KAIRO_URL et KAIRO_ADMIN_TOKEN sur Dokploy.")
	}
	var reader io.Reader = http.NoBody
	if corps != nil {
		b, err := json.Marshal(corps)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, methode, strings.TrimRight(base, "/")+chemin, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jeton)
	if corps != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return clientKairo.Do(req)
}

func lireKairo(ctx context.Context) (*EtatKairo, error) {
	resp, err := appelKairo(ctx, http.MethodGet, "/etat", nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kairo : HTTP %d", resp.StatusCode)
	}
	var etat EtatKairo
	return &etat, json.NewDecoder(resp.Body).Decode(&etat)
}

func commanderKairo(ctx context.Context, chemin string, corps any) error {
	resp, err := appelKairo(ctx, http.MethodPost, chemin, corps)
	if err != nil {
		var probleme huma.StatusError
		if errors.As(err, &probleme) {
			return err
		}
		return socle.Problem(http.StatusBadGateway, "KAIRO_INJOIGNABLE", "Kairo ne répond pas. Réessayez dans un instant.")
	}
	defer func() { _ = resp.Body.Close() }()
	switch resp.StatusCode {
	case http.StatusNoContent:
		return nil
	case http.StatusConflict:
		return socle.Problem(http.StatusConflict, "KAIRO_RELANCE_IMPOSSIBLE", "Seul un ticket en échec ou escaladé se relance.")
	default:
		return socle.Problem(http.StatusBadGateway, "KAIRO_REFUS", fmt.Sprintf("Kairo a refusé la commande (HTTP %d).", resp.StatusCode))
	}
}
