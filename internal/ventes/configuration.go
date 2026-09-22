package ventes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

type SiteVenteDTO struct {
	ID                     string           `json:"id"`
	Nom                    string           `json:"nom"`
	Actif                  bool             `json:"actif"`
	Ordre                  int32            `json:"ordre"`
	TotalLots              *int32           `json:"totalLots"`
	SuperficieDefaut       string           `json:"superficieDefaut"`
	PrixUnitaireDefaut     int64            `json:"prixUnitaireDefaut"`
	PartProprietaireParLot int64            `json:"partProprietaireParLot"`
	PartApporteurMode      string           `json:"partApporteurMode"`
	PartApporteurValeur    int64            `json:"partApporteurValeur"`
	Superficies            []SuperficieSite `json:"superficies"`
}

type SuperficieSite struct {
	Superficie string `json:"superficie" minLength:"1" maxLength:"80"`
	Prix       int64  `json:"prix" minimum:"1"`
}

type CanalVenteDTO struct {
	ID      string `json:"id"`
	Libelle string `json:"libelle"`
	Actif   bool   `json:"actif"`
	Ordre   int32  `json:"ordre"`
}

type VentesConfigurationOutput struct {
	Body struct {
		Sites  []SiteVenteDTO  `json:"sites"`
		Canaux []CanalVenteDTO `json:"canaux"`
	}
}

type siteVenteInput struct {
	Body struct {
		Nom                    string           `json:"nom" minLength:"1" maxLength:"120"`
		Ordre                  int32            `json:"ordre" minimum:"0"`
		TotalLots              *int32           `json:"totalLots,omitempty" minimum:"0"`
		SuperficieDefaut       string           `json:"superficieDefaut" maxLength:"80"`
		PrixUnitaireDefaut     int64            `json:"prixUnitaireDefaut" minimum:"0"`
		PartProprietaireParLot int64            `json:"partProprietaireParLot" minimum:"0"`
		PartApporteurMode      string           `json:"partApporteurMode"`
		PartApporteurValeur    int64            `json:"partApporteurValeur" minimum:"0"`
		Superficies            []SuperficieSite `json:"superficies,omitempty" maxItems:"20"`
	}
}

type siteVenteIDInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Actif bool `json:"actif"`
	}
}

type canalVenteInput struct {
	Body struct {
		Libelle string `json:"libelle" minLength:"1" maxLength:"80"`
		Ordre   int32  `json:"ordre" minimum:"0"`
	}
}

type canalVenteIDInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Actif bool `json:"actif"`
	}
}

func monterConfiguration(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "createVenteSite", Method: http.MethodPost, Path: "/api/v1/ventes/sites", Summary: "Ajoute un site de vente."}, s.creerSite)
	huma.Register(api, huma.Operation{OperationID: "updateVenteSite", Method: http.MethodPatch, Path: "/api/v1/ventes/sites/{id}", Summary: "Modifie la configuration d’un site."}, s.modifierSite)
	huma.Register(api, huma.Operation{OperationID: "setVenteSiteActive", Method: http.MethodPost, Path: "/api/v1/ventes/sites/{id}/active", Summary: "Active ou retire un site de la saisie."}, s.activerSite)
	huma.Register(api, huma.Operation{OperationID: "createVenteCanal", Method: http.MethodPost, Path: "/api/v1/ventes/canaux", Summary: "Ajoute un canal de vente."}, s.creerCanal)
	huma.Register(api, huma.Operation{OperationID: "updateVenteCanal", Method: http.MethodPatch, Path: "/api/v1/ventes/canaux/{id}", Summary: "Modifie un canal de vente."}, s.modifierCanal)
	huma.Register(api, huma.Operation{OperationID: "setVenteCanalActive", Method: http.MethodPost, Path: "/api/v1/ventes/canaux/{id}/active", Summary: "Active ou retire un canal de la saisie."}, s.activerCanal)
}

func (s *service) configuration(ctx context.Context, _ *struct{}) (*VentesConfigurationOutput, error) {
	sites, err := s.Q.ListerSitesVentes(ctx)
	if err != nil {
		return nil, err
	}
	canaux, err := s.Q.ListerCanauxVentes(ctx)
	if err != nil {
		return nil, err
	}
	out := &VentesConfigurationOutput{}
	for i := range sites {
		dto, err := siteDTO(&sites[i])
		if err != nil {
			return nil, err
		}
		out.Body.Sites = append(out.Body.Sites, dto)
	}
	for i := range canaux {
		out.Body.Canaux = append(out.Body.Canaux, canalDTO(&canaux[i]))
	}
	return out, nil
}

func (s *service) creerSite(ctx context.Context, in *siteVenteInput) (*SiteVenteOutput, error) {
	corps := in.Body
	if err := verifierModePartage(corps.PartApporteurMode, corps.PartApporteurValeur); err != nil {
		return nil, err
	}
	superficies, err := superficiesJSON(corps.Superficies)
	if err != nil {
		return nil, err
	}
	row, err := s.Q.InsererSiteVente(ctx, db.InsererSiteVenteParams{
		Nom: strings.ToUpper(strings.TrimSpace(corps.Nom)), Ordre: corps.Ordre, TotalLots: corps.TotalLots,
		SuperficieDefaut: strings.TrimSpace(corps.SuperficieDefaut), PrixUnitaireDefaut: corps.PrixUnitaireDefaut,
		PartProprietaireParLot: corps.PartProprietaireParLot, PartApporteurMode: corps.PartApporteurMode,
		PartApporteurValeur: corps.PartApporteurValeur, Superficies: superficies,
	})
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return sortieSite(&row)
}

func (s *service) modifierSite(ctx context.Context, in *siteVenteModifyInput) (*SiteVenteOutput, error) {
	corps := in.Body
	if err := verifierModePartage(corps.PartApporteurMode, corps.PartApporteurValeur); err != nil {
		return nil, err
	}
	superficies, err := superficiesJSON(corps.Superficies)
	if err != nil {
		return nil, err
	}
	row, err := s.Q.ModifierSiteVente(ctx, db.ModifierSiteVenteParams{
		ID: in.ID, Nom: strings.ToUpper(strings.TrimSpace(corps.Nom)), Ordre: corps.Ordre,
		TotalLots: corps.TotalLots, SuperficieDefaut: strings.TrimSpace(corps.SuperficieDefaut),
		PrixUnitaireDefaut: corps.PrixUnitaireDefaut, PartProprietaireParLot: corps.PartProprietaireParLot,
		PartApporteurMode: corps.PartApporteurMode, PartApporteurValeur: corps.PartApporteurValeur,
		Superficies: superficies,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_SITE_NOT_FOUND", "Site introuvable.")
	}
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return sortieSite(&row)
}

type siteVenteModifyInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Nom                    string           `json:"nom" minLength:"1" maxLength:"120"`
		Ordre                  int32            `json:"ordre" minimum:"0"`
		TotalLots              *int32           `json:"totalLots,omitempty" minimum:"0"`
		SuperficieDefaut       string           `json:"superficieDefaut" maxLength:"80"`
		PrixUnitaireDefaut     int64            `json:"prixUnitaireDefaut" minimum:"0"`
		PartProprietaireParLot int64            `json:"partProprietaireParLot" minimum:"0"`
		PartApporteurMode      string           `json:"partApporteurMode"`
		PartApporteurValeur    int64            `json:"partApporteurValeur" minimum:"0"`
		Superficies            []SuperficieSite `json:"superficies,omitempty" maxItems:"20"`
	}
}

type SiteVenteOutput struct{ Body SiteVenteDTO }

func (s *service) activerSite(ctx context.Context, in *siteVenteIDInput) (*SiteVenteOutput, error) {
	row, err := s.Q.ActiverSiteVente(ctx, db.ActiverSiteVenteParams{ID: in.ID, Actif: in.Body.Actif})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_SITE_NOT_FOUND", "Site introuvable.")
	}
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return sortieSite(&row)
}

type CanalVenteOutput struct{ Body CanalVenteDTO }

func (s *service) creerCanal(ctx context.Context, in *canalVenteInput) (*CanalVenteOutput, error) {
	row, err := s.Q.InsererCanalVente(ctx, db.InsererCanalVenteParams{Libelle: strings.TrimSpace(in.Body.Libelle), Ordre: in.Body.Ordre})
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return &CanalVenteOutput{Body: canalDTO(&row)}, nil
}

func (s *service) modifierCanal(ctx context.Context, in *canalVenteModifyInput) (*CanalVenteOutput, error) {
	row, err := s.Q.ModifierCanalVente(ctx, db.ModifierCanalVenteParams{ID: in.ID, Libelle: strings.TrimSpace(in.Body.Libelle), Ordre: in.Body.Ordre})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_CANAL_NOT_FOUND", "Canal introuvable.")
	}
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return &CanalVenteOutput{Body: canalDTO(&row)}, nil
}

type canalVenteModifyInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Libelle string `json:"libelle" minLength:"1" maxLength:"80"`
		Ordre   int32  `json:"ordre" minimum:"0"`
	}
}

func (s *service) activerCanal(ctx context.Context, in *canalVenteIDInput) (*CanalVenteOutput, error) {
	row, err := s.Q.ActiverCanalVente(ctx, db.ActiverCanalVenteParams{ID: in.ID, Actif: in.Body.Actif})
	return reponseActivation(err, "VENTE_CANAL_NOT_FOUND", "Canal introuvable.", CanalVenteOutput{Body: canalDTO(&row)}, s.Live.Emettre)
}

func reponseActivation[T any](err error, code, message string, sortie T, emettre func(string)) (*T, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, code, message)
	}
	if err != nil {
		return nil, err
	}
	emettre("ventes")
	return &sortie, nil
}

func siteDTO(site *db.VentesSite) (SiteVenteDTO, error) {
	superficies := []SuperficieSite{}
	if err := json.Unmarshal(site.Superficies, &superficies); err != nil {
		return SiteVenteDTO{}, err
	}
	return SiteVenteDTO{
		ID: site.ID, Nom: site.Nom, Actif: site.Actif, Ordre: site.Ordre, TotalLots: site.TotalLots,
		SuperficieDefaut: site.SuperficieDefaut, PrixUnitaireDefaut: site.PrixUnitaireDefaut,
		PartProprietaireParLot: site.PartProprietaireParLot, PartApporteurMode: site.PartApporteurMode,
		PartApporteurValeur: site.PartApporteurValeur, Superficies: superficies,
	}, nil
}

func sortieSite(site *db.VentesSite) (*SiteVenteOutput, error) {
	dto, err := siteDTO(site)
	if err != nil {
		return nil, err
	}
	return &SiteVenteOutput{Body: dto}, nil
}

func superficiesJSON(superficies []SuperficieSite) ([]byte, error) {
	propres := make([]SuperficieSite, 0, len(superficies))
	for _, s := range superficies {
		propres = append(propres, SuperficieSite{Superficie: strings.TrimSpace(s.Superficie), Prix: s.Prix})
	}
	return json.Marshal(propres)
}

func canalDTO(canal *db.VentesCanaux) CanalVenteDTO {
	return CanalVenteDTO{ID: canal.ID, Libelle: canal.Libelle, Actif: canal.Actif, Ordre: canal.Ordre}
}

func verifierModePartage(mode string, valeur int64) error {
	switch mode {
	case "AUCUNE":
		if valeur != 0 {
			return socle.Problem(http.StatusBadRequest, "VENTE_REGLE_INVALIDE", "Une règle sans apporteur doit avoir une valeur nulle.")
		}
	case "POURCENTAGE_PROPRIETAIRE":
		if valeur < 0 || valeur > 100 {
			return socle.Problem(http.StatusBadRequest, "VENTE_REGLE_INVALIDE", "Le pourcentage doit être compris entre 0 et 100.")
		}
	case "MONTANT_PAR_LOT", "MONTANT_TOTAL":
		if valeur < 0 {
			return socle.Problem(http.StatusBadRequest, "VENTE_REGLE_INVALIDE", "Le montant ne peut pas être négatif.")
		}
	default:
		return socle.Problem(http.StatusBadRequest, "VENTE_REGLE_INVALIDE", "Le mode de partage est inconnu.")
	}
	return nil
}
