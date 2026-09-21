package analytics

import (
	"context"
	"cpi-go/db"

	"github.com/danielgtaylor/huma/v2"
)

type CanalDeProvenance struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Label     string `json:"label"`
	Prospects int    `json:"prospects"`
	Joints    int    `json:"joints"`
	Convertis int    `json:"convertis"`
}

type MotifDAppel struct {
	Label  string `json:"label"`
	Effect string `json:"effect"`
	Count  int    `json:"count"`
}

type QualiteDuMarketing struct {
	Total         int                 `json:"total"`
	AvecCanal     int                 `json:"avecCanal"`
	Eprouves      int                 `json:"eprouves"`
	NonDistribues int                 `json:"nonDistribues"`
	Joints        int                 `json:"joints"`
	Convertis     int                 `json:"convertis"`
	Score         *int                `json:"score"`
	ParCanal      []CanalDeProvenance `json:"parCanal"`
	ParMotif      []MotifDAppel       `json:"parMotif"`
}

type MarketingOutput struct{ Body QualiteDuMarketing }

// Meme lecture que la base representants : la joignabilite se compte sur les
// fiches deja appelees, la conversion sur tout ce qui a ete amene.
func scoreMarketing(q db.QualiteMarketingRow) *int {
	if q.Total == 0 || q.Eprouves == 0 {
		return nil
	}
	joignabilite := float64(q.Joints) / float64(q.Eprouves)
	conversion := float64(q.Convertis) / float64(q.Total)
	valeur := int((joignabilite + conversion) / 2 * 100)
	return &valeur
}

func (s *service) qualiteDuMarketing(ctx context.Context, _ *struct{}) (*MarketingOutput, error) {
	cle := s.Cfg.Base + ":supervision/prospects/marketing:" + porteeDeCache(ctx)
	corps, err := avecCache(cle, ttlAnalyses, func() (QualiteDuMarketing, error) {
		return s.lireMarketing(ctx)
	})
	if err != nil {
		return nil, err
	}
	return &MarketingOutput{Body: corps}, nil
}

func (s *service) lireMarketing(ctx context.Context) (QualiteDuMarketing, error) {
	vide := QualiteDuMarketing{}
	compte, err := s.Q.QualiteMarketing(ctx)
	if err != nil {
		return vide, err
	}
	canaux, err := s.Q.MarketingParCanal(ctx)
	if err != nil {
		return vide, err
	}
	motifs, err := s.Q.ProspectsParMotifDAppel(ctx)
	if err != nil {
		return vide, err
	}
	marketing := QualiteDuMarketing{
		Total:         int(compte.Total),
		AvecCanal:     int(compte.AvecCanal),
		Eprouves:      int(compte.Eprouves),
		NonDistribues: int(compte.NonDistribues),
		Joints:        int(compte.Joints),
		Convertis:     int(compte.Convertis),
		Score:         scoreMarketing(compte),
		ParCanal:      make([]CanalDeProvenance, 0, len(canaux)),
		ParMotif:      make([]MotifDAppel, 0, len(motifs)),
	}
	for _, ligne := range canaux {
		marketing.ParCanal = append(marketing.ParCanal, CanalDeProvenance{
			ID: ligne.ID, Code: ligne.Code, Label: ligne.Label, Prospects: int(ligne.Prospects),
			Joints: int(ligne.Joints), Convertis: int(ligne.Convertis),
		})
	}
	for _, ligne := range motifs {
		marketing.ParMotif = append(marketing.ParMotif,
			MotifDAppel{Label: ligne.Label, Effect: ligne.Effect, Count: int(ligne.Count)})
	}
	return marketing, nil
}

func monterQualiteDuMarketing(api huma.API, s *service) {
	routeDeLecture(api, "getSupervisionProspectsMarketing",
		"/api/v1/supervision/prospects/marketing", s.qualiteDuMarketing)
}
