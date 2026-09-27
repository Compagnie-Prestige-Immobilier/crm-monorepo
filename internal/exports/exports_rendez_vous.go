package exports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	cheminExportRendezVous = "/api/v1/export/rendez-vous.xlsx"
	rendezVousExportMax    = 5000
)

var entetesRendezVous = []string{
	"Rendez-vous le", "Prospect", "Téléphone", "Type", "Venue", "Pris le", "Pris par",
	"Site", "Point de rencontre", "Précision du point",
}

// Le comptoir emporte ce qu'il voit : les mêmes lignes, les mêmes filtres.
type ExportRendezVousInput struct {
	Type   string `query:"type" maxLength:"40"`
	Search string `query:"search" maxLength:"120"`
	Issue  string `query:"issue" enum:",HONORE,NON_HONORE,REPORTE,SANS"`
	Du     string `query:"du" doc:"Premier jour des rendez-vous, AAAA-MM-JJ."`
	Au     string `query:"au" doc:"Dernier jour des rendez-vous, inclus, AAAA-MM-JJ."`
}

var venues = map[string]string{
	"HONORE":     "Venu",
	"NON_HONORE": "Pas venu",
	"REPORTE":    "Reporté",
	"":           "À confirmer",
}

func (s *service) exportRendezVous(ctx context.Context, in *ExportRendezVousInput) (*huma.StreamResponse, error) {
	du, au, err := socle.BornesDuJour(in.Du, in.Au, s.Cfg.TimeZone)
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.RendezVousObtenus(ctx, db.RendezVousObtenusParams{
		TypeCode:  exportNarg(in.Type),
		Recherche: exportNarg(in.Search),
		Issue:     exportNarg(in.Issue),
		Du:        du,
		Au:        au,
		Prendre:   rendezVousExportMax,
		Sauter:    0,
	})
	if err != nil {
		return nil, err
	}
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	f, err := c.nouvelleFeuille("Rendez-vous", entetesRendezVous,
		[]float64{20, 30, 18, 16, 14, 20, 26, 20, 26, 30}, map[int]int{3: c.texte})
	if err != nil {
		return nil, err
	}
	for i := range lignes {
		ligne := &lignes[i]
		if err := f.ecrire(quandLisible(ligne.Quand, s.Cfg.TimeZone), ligne.Prenom+" "+ligne.Nom,
			exportCelluleTexte(ligne.PhoneE164), ligne.Type, venues[ligne.Issue],
			c.horodate(ligne.LastCallAt), ligne.PrisPar, ligne.Site, ligne.PointRencontre,
			ligne.PointRencontreCommentaire); err != nil {
			return nil, err
		}
	}
	if len(lignes) >= rendezVousExportMax {
		avis := "Export limité aux " + strconv.Itoa(rendezVousExportMax) + " premiers rendez-vous. Réduire la période pour voir les suivants."
		if err := f.ecrire(avis); err != nil {
			return nil, err
		}
	}
	if err := f.fermer(false); err != nil {
		return nil, err
	}
	return exportReponseClasseur(c, "rendez-vous-cpi-"+s.exportDateDuJour()+".xlsx"), nil
}

// La date arrive en texte ISO depuis la base : le classeur la rend lisible.
func quandLisible(iso string, zone *time.Location) string {
	if iso == "" {
		return ""
	}
	lu, err := time.Parse("2006-01-02T15:04:05Z", iso)
	if err != nil {
		return iso
	}
	return lu.In(zone).Format("02/01/2006 15:04")
}

func exportNarg(valeur string) *string {
	if valeur = strings.TrimSpace(valeur); valeur == "" {
		return nil
	}
	return &valeur
}
