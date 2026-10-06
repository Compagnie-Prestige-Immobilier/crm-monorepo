package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"strings"
)

const (
	dimensionTotal        = "total"
	dimensionReporte      = "reporte"
	dimensionEtape        = "etape"
	dimensionIssue        = "issue"
	dimensionConfirmation = "confirmation"
	dimensionType         = "type"
	dimensionSite         = "site"
)

type RendezVousDecompte struct {
	Code    string `json:"code"`
	Libelle string `json:"libelle"`
	Nombre  int64  `json:"nombre"`
}

type RendezVousSyntheseInput struct {
	Type string `query:"type" maxLength:"40" doc:"Code du type de rendez-vous."`
	Du   string `query:"du" doc:"Premier jour des rendez-vous, AAAA-MM-JJ."`
	Au   string `query:"au" doc:"Dernier jour des rendez-vous, inclus, AAAA-MM-JJ."`
}

type RendezVousSyntheseOutput struct {
	Body struct {
		Total           int64                `json:"total"`
		Reportes        int64                `json:"reportes"`
		ParEtape        map[string]int64     `json:"parEtape"`
		ParIssue        map[string]int64     `json:"parIssue" doc:"La clé vide compte les rendez-vous sans issue."`
		ParConfirmation map[string]int64     `json:"parConfirmation" doc:"La clé vide compte les rendez-vous sans confirmation."`
		ParType         []RendezVousDecompte `json:"parType"`
		ParSite         []RendezVousDecompte `json:"parSite" doc:"Les cinquante sites les plus demandés ; le code vide compte les rendez-vous sans site."`
	}
}

func (s *service) rendezVousSynthese(ctx context.Context, in *RendezVousSyntheseInput) (*RendezVousSyntheseOutput, error) {
	du, au, err := socle.BornesDuJour(in.Du, in.Au, s.Cfg.TimeZone)
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.RendezVousSynthese(ctx, db.RendezVousSyntheseParams{
		TypeCode: prospectVide(strings.TrimSpace(in.Type)), DebutJour: socle.DebutDuJour(s.Cfg.TimeZone), Du: du, Au: au,
	})
	if err != nil {
		return nil, err
	}
	out := &RendezVousSyntheseOutput{}
	out.Body.ParEtape = map[string]int64{}
	out.Body.ParIssue = map[string]int64{}
	out.Body.ParConfirmation = map[string]int64{}
	out.Body.ParType = []RendezVousDecompte{}
	out.Body.ParSite = []RendezVousDecompte{}
	for _, l := range lignes {
		switch l.Dimension {
		case dimensionTotal:
			out.Body.Total = l.Nombre
		case dimensionReporte:
			out.Body.Reportes = l.Nombre
		case dimensionEtape:
			out.Body.ParEtape[l.Code] = l.Nombre
		case dimensionIssue:
			out.Body.ParIssue[l.Code] = l.Nombre
		case dimensionConfirmation:
			out.Body.ParConfirmation[l.Code] = l.Nombre
		case dimensionType:
			out.Body.ParType = append(out.Body.ParType, RendezVousDecompte{Code: l.Code, Libelle: l.Libelle, Nombre: l.Nombre})
		case dimensionSite:
			out.Body.ParSite = append(out.Body.ParSite, RendezVousDecompte{Code: l.Code, Libelle: l.Libelle, Nombre: l.Nombre})
		}
	}
	return out, nil
}
