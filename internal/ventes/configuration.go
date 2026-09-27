package ventes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
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
	LotsVendus             int32            `json:"lotsVendus" doc:"Lots des ventes non archivées du site."`
	LotsRestants           *int32           `json:"lotsRestants" doc:"Nul sans stock renseigné ; négatif si le classeur a vendu plus que le stock."`
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
	noms := make([]string, len(sites))
	for i := range sites {
		noms[i] = sites[i].Nom
	}
	vendus, err := lotsVendus(ctx, s.Q, noms, 0)
	if err != nil {
		return nil, err
	}
	out := &VentesConfigurationOutput{}
	for i := range sites {
		dto, err := siteDTO(&sites[i], vendus[sites[i].Nom])
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
	var row db.VentesSite
	err = s.tracer(ctx, "vente_site.creer", "vente_site", func(q *db.Queries) (string, any, any, error) {
		row, err = q.InsererSiteVente(ctx, db.InsererSiteVenteParams{
			Nom: strings.ToUpper(strings.TrimSpace(corps.Nom)), Ordre: corps.Ordre, TotalLots: corps.TotalLots,
			SuperficieDefaut: strings.TrimSpace(corps.SuperficieDefaut), PrixUnitaireDefaut: corps.PrixUnitaireDefaut,
			PartProprietaireParLot: corps.PartProprietaireParLot, PartApporteurMode: corps.PartApporteurMode,
			PartApporteurValeur: corps.PartApporteurValeur, Superficies: superficies,
		})
		return row.ID, nil, traceSite(&row), err
	})
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortieSite(ctx, &row)
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
	var row db.VentesSite
	err = s.tracer(ctx, "vente_site.modifier", "vente_site", func(q *db.Queries) (string, any, any, error) {
		avant, err := q.SiteVenteParID(ctx, in.ID)
		if err != nil {
			return "", nil, nil, err
		}
		row, err = q.ModifierSiteVente(ctx, db.ModifierSiteVenteParams{
			ID: in.ID, Nom: strings.ToUpper(strings.TrimSpace(corps.Nom)), Ordre: corps.Ordre,
			TotalLots: corps.TotalLots, SuperficieDefaut: strings.TrimSpace(corps.SuperficieDefaut),
			PrixUnitaireDefaut: corps.PrixUnitaireDefaut, PartProprietaireParLot: corps.PartProprietaireParLot,
			PartApporteurMode: corps.PartApporteurMode, PartApporteurValeur: corps.PartApporteurValeur,
			Superficies: superficies,
		})
		if err == nil && row.Nom != avant.Nom {
			err = q.RenommerSiteDesVentes(ctx, db.RenommerSiteDesVentesParams{Ancien: avant.Nom, Nouveau: row.Nom})
		}
		return in.ID, traceSite(&avant), traceSite(&row), err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_SITE_NOT_FOUND", "Site introuvable.")
	}
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortieSite(ctx, &row)
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
	var row db.VentesSite
	err := s.tracer(ctx, "vente_site.activer", "vente_site", func(q *db.Queries) (string, any, any, error) {
		var err error
		row, err = q.ActiverSiteVente(ctx, db.ActiverSiteVenteParams{ID: in.ID, Actif: in.Body.Actif})
		return in.ID, nil, map[string]any{"actif": in.Body.Actif}, err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_SITE_NOT_FOUND", "Site introuvable.")
	}
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortieSite(ctx, &row)
}

type CanalVenteOutput struct{ Body CanalVenteDTO }

func (s *service) creerCanal(ctx context.Context, in *canalVenteInput) (*CanalVenteOutput, error) {
	var row db.VentesCanaux
	err := s.tracer(ctx, "vente_canal.creer", "vente_canal", func(q *db.Queries) (string, any, any, error) {
		var err error
		row, err = q.InsererCanalVente(ctx, db.InsererCanalVenteParams{Libelle: strings.TrimSpace(in.Body.Libelle), Ordre: in.Body.Ordre})
		return row.ID, nil, canalDTO(&row), err
	})
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return &CanalVenteOutput{Body: canalDTO(&row)}, nil
}

func (s *service) modifierCanal(ctx context.Context, in *canalVenteModifyInput) (*CanalVenteOutput, error) {
	var row db.VentesCanaux
	err := s.tracer(ctx, "vente_canal.modifier", "vente_canal", func(q *db.Queries) (string, any, any, error) {
		avant, err := q.CanalVenteParID(ctx, in.ID)
		if err != nil {
			return "", nil, nil, err
		}
		row, err = q.ModifierCanalVente(ctx, db.ModifierCanalVenteParams{ID: in.ID, Libelle: strings.TrimSpace(in.Body.Libelle), Ordre: in.Body.Ordre})
		if err == nil && row.Libelle != avant.Libelle {
			err = q.RenommerCanalDesVentes(ctx, db.RenommerCanalDesVentesParams{Ancien: avant.Libelle, Nouveau: row.Libelle})
		}
		return in.ID, canalDTO(&avant), canalDTO(&row), err
	})
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
	var row db.VentesCanaux
	err := s.tracer(ctx, "vente_canal.activer", "vente_canal", func(q *db.Queries) (string, any, any, error) {
		var err error
		row, err = q.ActiverCanalVente(ctx, db.ActiverCanalVenteParams{ID: in.ID, Actif: in.Body.Actif})
		return in.ID, nil, map[string]any{"actif": in.Body.Actif}, err
	})
	return reponseActivation(err, "VENTE_CANAL_NOT_FOUND", "Canal introuvable.", CanalVenteOutput{Body: canalDTO(&row)}, s.Live.Emettre)
}

// Un réglage de vente ne s'écrit pas sans sa trace : les parts de chaque vente en dépendent.
func (s *service) tracer(ctx context.Context, action, entite string, ecrire func(q *db.Queries) (id string, avant, apres any, err error)) error {
	acteur := socle.UtilisateurCourant(ctx).ID
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		id, avant, apres, err := ecrire(q)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, action, entite, id, avant, apres)
	})
}

func traceSite(site *db.VentesSite) map[string]any {
	return map[string]any{
		"nom": site.Nom, "prixUnitaireDefaut": site.PrixUnitaireDefaut, "totalLots": site.TotalLots,
		"partProprietaireParLot": site.PartProprietaireParLot, "partApporteurMode": site.PartApporteurMode,
		"partApporteurValeur": site.PartApporteurValeur, "superficies": json.RawMessage(site.Superficies),
	}
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

func lotsVendus(ctx context.Context, q *db.Queries, sites []string, exclue int64) (map[string]int32, error) {
	lignes, err := q.LotsVendusParSite(ctx, db.LotsVendusParSiteParams{Sites: sites, Exclue: exclue})
	if err != nil {
		return nil, err
	}
	parSite := make(map[string]int32, len(lignes))
	for _, l := range lignes {
		parSite[l.Site] = l.Lots
	}
	return parSite, nil
}

func siteDTO(site *db.VentesSite, vendus int32) (SiteVenteDTO, error) {
	superficies := []SuperficieSite{}
	if err := json.Unmarshal(site.Superficies, &superficies); err != nil {
		return SiteVenteDTO{}, err
	}
	var restants *int32
	if site.TotalLots != nil {
		reste := *site.TotalLots - vendus
		restants = &reste
	}
	return SiteVenteDTO{
		LotsVendus: vendus, LotsRestants: restants,
		ID: site.ID, Nom: site.Nom, Actif: site.Actif, Ordre: site.Ordre, TotalLots: site.TotalLots,
		SuperficieDefaut: site.SuperficieDefaut, PrixUnitaireDefaut: site.PrixUnitaireDefaut,
		PartProprietaireParLot: site.PartProprietaireParLot, PartApporteurMode: site.PartApporteurMode,
		PartApporteurValeur: site.PartApporteurValeur, Superficies: superficies,
	}, nil
}

func (s *service) sortieSite(ctx context.Context, site *db.VentesSite) (*SiteVenteOutput, error) {
	vendus, err := lotsVendus(ctx, s.Q, []string{site.Nom}, 0)
	if err != nil {
		return nil, err
	}
	dto, err := siteDTO(site, vendus[site.Nom])
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
