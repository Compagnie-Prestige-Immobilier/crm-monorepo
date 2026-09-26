package analytics

import (
	"context"
	"cpi-go/db"
	"math"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

type ObjectifSuivi struct {
	Cible                     int     `json:"cible"`
	Realisations              int     `json:"realisations"`
	TauxAvancement            float64 `json:"tauxAvancement"`
	CadenceQuotidienneRequise float64 `json:"cadenceQuotidienneRequise"`
	CadenceQuotidienneReelle  float64 `json:"cadenceQuotidienneReelle"`
}

type Campaigne2026Objectifs struct {
	DateDebut              string        `json:"dateDebut"`
	DateFin                string        `json:"dateFin"`
	JoursEcoules           int           `json:"joursEcoules"`
	JoursTotaux            int           `json:"joursTotaux"`
	TauxAvancementTemporel float64       `json:"tauxAvancementTemporel"`
	Chues                  ObjectifSuivi `json:"chues"`
	GrandPublic            ObjectifSuivi `json:"grandPublic"`
	LeadsMarketing         ObjectifSuivi `json:"leadsMarketing"`
}

type ObjectifsOutput struct{ Body Campaigne2026Objectifs }

func (s *service) suiveObjectifs2026(ctx context.Context, _ *struct{}) (*ObjectifsOutput, error) {
	cle := s.Cfg.Base + ":supervision/objectifs:" + porteeDeCache(ctx)
	corps, err := avecCache(cle, ttlAnalyses, func() (Campaigne2026Objectifs, error) {
		return Objectifs2026(ctx, s.Q, s.Cfg.TimeZone)
	})
	if err != nil {
		return nil, err
	}
	return &ObjectifsOutput{Body: corps}, nil
}

func Objectifs2026(ctx context.Context, q *db.Queries, zone *time.Location) (Campaigne2026Objectifs, error) {
	debut, _ := time.Parse("2006-01-02", "2026-09-10")
	maintenant := time.Now().In(zone)

	joursTotaux := 105
	joursEcoules := int(math.Max(1, math.Min(float64(joursTotaux), maintenant.Sub(debut).Hours()/24)))
	tauxTemps := math.Round((float64(joursEcoules)/float64(joursTotaux)*100)*10) / 10

	chuesTotal, err := q.StockRepresentants(ctx)
	if err != nil {
		return Campaigne2026Objectifs{}, err
	}
	realisedChues := int(chuesTotal.Total)

	marketingQual, err := q.QualiteMarketing(ctx)
	if err != nil {
		return Campaigne2026Objectifs{}, err
	}
	realisedGP := int(marketingQual.Convertis)
	realisedLeads := int(marketingQual.Total)

	calculerObjectif := func(cible, realises int) ObjectifSuivi {
		taux := 0.0
		if cible > 0 {
			taux = math.Round((float64(realises)/float64(cible)*100)*10) / 10
		}
		req := math.Round((float64(cible)/float64(joursTotaux))*10) / 10
		reel := math.Round((float64(realises)/float64(joursEcoules))*10) / 10
		return ObjectifSuivi{
			Cible:                     cible,
			Realisations:              realises,
			TauxAvancement:            taux,
			CadenceQuotidienneRequise: req,
			CadenceQuotidienneReelle:  reel,
		}
	}

	return Campaigne2026Objectifs{
		DateDebut:              "2026-09-10",
		DateFin:                "2026-12-23",
		JoursEcoules:           joursEcoules,
		JoursTotaux:            joursTotaux,
		TauxAvancementTemporel: tauxTemps,
		Chues:                  calculerObjectif(2500, realisedChues),
		GrandPublic:            calculerObjectif(2000, realisedGP),
		LeadsMarketing:         calculerObjectif(200000, realisedLeads),
	}, nil
}

func monterObjectifs(api huma.API, s *service) {
	routeDeLecture(api, "getSupervisionObjectifs",
		"/api/v1/supervision/objectifs", s.suiveObjectifs2026)
}
