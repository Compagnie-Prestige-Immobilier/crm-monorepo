package analytics

import (
	"context"
	"cpi-go/db"

	"github.com/danielgtaylor/huma/v2"
)

type StatutDeLaBase struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Effect string `json:"effect"`
	Count  int    `json:"count"`
}

type ChampRenseigne struct {
	Code  string `json:"code"`
	Count int    `json:"count"`
}

type DepartementDeLaBase struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Fiches    int    `json:"fiches"`
	Joints    int    `json:"joints"`
	Prospects int    `json:"prospects"`
}

type QualiteDeLaBase struct {
	Total             int                   `json:"total"`
	Eprouves          int                   `json:"eprouves"`
	Joints            int                   `json:"joints"`
	Productifs        int                   `json:"productifs"`
	ProspectsApportes int                   `json:"prospectsApportes"`
	Score             *int                  `json:"score"`
	ParStatut         []StatutDeLaBase      `json:"parStatut"`
	ParDepartement    []DepartementDeLaBase `json:"parDepartement"`
	Completude        []ChampRenseigne      `json:"completude"`
}

type QualiteOutput struct{ Body QualiteDeLaBase }

// Le score dit ce que vaut la liste remise, sur les deux seules promesses
// qu'elle porte : le representant repond, et il apporte des prospects. La
// joignabilite ne se mesure que sur les fiches deja appelees ; la productivite
// se mesure sur toute la base, un representant productif l'etant meme sans
// appel de notre part.
func score(q db.QualiteBaseRepresentantsRow) *int {
	if q.Total == 0 || q.Eprouves == 0 {
		return nil
	}
	joignabilite := float64(q.Joints) / float64(q.Eprouves)
	productivite := float64(q.Productifs) / float64(q.Total)
	valeur := int((joignabilite + productivite) / 2 * 100)
	return &valeur
}

func (s *service) qualiteDeLaBase(ctx context.Context, _ *struct{}) (*QualiteOutput, error) {
	cle := s.Cfg.Base + ":supervision/representants/qualite:" + porteeDeCache(ctx)
	corps, err := avecCache(cle, ttlAnalyses, func() (QualiteDeLaBase, error) {
		return s.lireQualite(ctx)
	})
	if err != nil {
		return nil, err
	}
	return &QualiteOutput{Body: corps}, nil
}

func (s *service) lireQualite(ctx context.Context) (QualiteDeLaBase, error) {
	vide := QualiteDeLaBase{}
	compte, err := s.Q.QualiteBaseRepresentants(ctx)
	if err != nil {
		return vide, err
	}
	statuts, err := s.Q.RepresentantsParStatut(ctx)
	if err != nil {
		return vide, err
	}
	departements, err := s.Q.QualiteParDepartement(ctx)
	if err != nil {
		return vide, err
	}
	champs, err := s.Q.ChampsRenseignesRepresentants(ctx)
	if err != nil {
		return vide, err
	}
	base := QualiteDeLaBase{
		Total:             int(compte.Total),
		Eprouves:          int(compte.Eprouves),
		Joints:            int(compte.Joints),
		Productifs:        int(compte.Productifs),
		ProspectsApportes: int(compte.ProspectsApportes),
		Score:             score(compte),
		ParStatut:         make([]StatutDeLaBase, 0, len(statuts)),
		ParDepartement:    make([]DepartementDeLaBase, 0, len(departements)),
		Completude:        champsRenseignes(champs),
	}
	for _, ligne := range statuts {
		base.ParStatut = append(base.ParStatut, StatutDeLaBase{
			Code: ligne.Code, Label: ligne.Label, Effect: ligne.Effect, Count: int(ligne.Count),
		})
	}
	for _, ligne := range departements {
		base.ParDepartement = append(base.ParDepartement, DepartementDeLaBase{
			ID: ligne.ID, Label: ligne.Label, Fiches: int(ligne.Fiches),
			Joints: int(ligne.Joints), Prospects: int(ligne.Prospects),
		})
	}
	return base, nil
}

func champsRenseignes(champs db.ChampsRenseignesRepresentantsRow) []ChampRenseigne {
	return []ChampRenseigne{
		{Code: "prenom", Count: int(champs.Prenom)},
		{Code: "etablissement", Count: int(champs.Etablissement)},
		{Code: "profession", Count: int(champs.Profession)},
		{Code: "syndicat", Count: int(champs.Syndicat)},
		{Code: "iefId", Count: int(champs.Ief)},
		{Code: "whatsappStatus", Count: int(champs.Whatsapp)},
	}
}

func monterQualiteDeLaBase(api huma.API, s *service) {
	routeDeLecture(api, "getSupervisionRepresentantsQualite",
		"/api/v1/supervision/representants/qualite", s.qualiteDeLaBase)
}
