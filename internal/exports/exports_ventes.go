package exports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xuri/excelize/v2"
)

const (
	cheminExportSommesDues = "/api/v1/export/ventes-sommes-dues.xlsx"
	sommesDuesMax          = 5000
)

var entetesSommesDues = []string{
	"Site", "N° vente", exportEnteteDate, exportEnteteClient, "Lots", "N° des lots", "Prix total", "Part propriétaire",
	"Part apporteur", "Représentant", "Part CPI", "Encaissé", "Reliquat",
}

type ExportSommesDuesInput struct {
	Du   string `query:"du" required:"true" format:"date" doc:"Premier jour de souscription, AAAA-MM-JJ."`
	Au   string `query:"au" required:"true" format:"date" doc:"Dernier jour de souscription, inclus, AAAA-MM-JJ."`
	Site string `query:"site" maxLength:"120" doc:"Nom du site ; absent : tous les sites."`
}

// Prix, parts, encaissé et reliquat : les colonnes qui se totalisent.
type sommesDues [6]int64

func (s *sommesDues) ajouter(v *db.VentesSommesDuesRow) {
	for i, montant := range []int64{v.PrixTotal, v.PartProprietaire, v.PartApporteur, v.PartCpi, v.Encaisse, v.Reliquat} {
		s[i] += montant
	}
}

func (c *exportClasseur) ligneSommes(f *exportFeuille, libelle string, s *sommesDues) error {
	montant := func(i int) excelize.Cell { return excelize.Cell{StyleID: c.monnaie, Value: s[i]} }
	return f.ecrire(excelize.Cell{StyleID: c.section, Value: libelle}, "", "", "", "", "",
		montant(0), montant(1), montant(2), "", montant(3), montant(4), montant(5))
}

func (s *service) exportSommesDues(ctx context.Context, in *ExportSommesDuesInput) (*huma.StreamResponse, error) {
	du, errDu := time.Parse(time.DateOnly, in.Du)
	au, errAu := time.Parse(time.DateOnly, in.Au)
	if errDu != nil || errAu != nil || au.Before(du) {
		return nil, socle.Problem(http.StatusBadRequest, "JOUR_INVALIDE", "La période va du premier au dernier jour, écrits AAAA-MM-JJ.")
	}
	var site *string
	if nom := strings.ToUpper(strings.TrimSpace(in.Site)); nom != "" {
		site = &nom
	}
	ventes, err := s.Q.VentesSommesDues(ctx, db.VentesSommesDuesParams{
		Du: pgtype.Date{Time: du, Valid: true}, Au: pgtype.Date{Time: au, Valid: true}, Site: site, Limite: sommesDuesMax + 1,
	})
	if err != nil {
		return nil, err
	}
	tronque := len(ventes) > sommesDuesMax
	ventes = ventes[:min(len(ventes), sommesDuesMax)]
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	f, err := c.nouvelleFeuille("Sommes dues", entetesSommesDues,
		[]float64{20, 10, 12, 30, 8, 16, 16, 18, 16, 24, 16, 16, 16}, map[int]int{6: c.texte})
	if err != nil {
		return nil, err
	}
	if err := c.lignesSommesDues(f, ventes); err != nil {
		return nil, err
	}
	if tronque {
		avis := "Export limité aux " + strconv.Itoa(sommesDuesMax) + " premières ventes. Réduire la période pour voir les suivantes."
		if err := f.ecrire(avis); err != nil {
			return nil, err
		}
	}
	if err := f.fermer(false); err != nil {
		return nil, err
	}
	return exportReponseClasseur(c, "sommes-dues-cpi-"+in.Du+"-"+in.Au+".xlsx"), nil
}

// Les ventes arrivent triées par site : un sous-total clôt chaque site, le total la feuille.
func (c *exportClasseur) lignesSommesDues(f *exportFeuille, ventes []db.VentesSommesDuesRow) error {
	var parSite, total sommesDues
	for i := range ventes {
		v := &ventes[i]
		if err := f.ecrire(v.Site, v.Numero, excelize.Cell{StyleID: c.jour, Value: v.DateSouscription.Time}, v.Client,
			v.NombreLots, v.NumerosLots, excelize.Cell{StyleID: c.monnaie, Value: v.PrixTotal},
			excelize.Cell{StyleID: c.monnaie, Value: v.PartProprietaire}, excelize.Cell{StyleID: c.monnaie, Value: v.PartApporteur},
			v.Representant, excelize.Cell{StyleID: c.monnaie, Value: v.PartCpi},
			excelize.Cell{StyleID: c.monnaie, Value: v.Encaisse}, excelize.Cell{StyleID: c.monnaie, Value: v.Reliquat}); err != nil {
			return err
		}
		parSite.ajouter(v)
		total.ajouter(v)
		if i+1 < len(ventes) && ventes[i+1].Site == v.Site {
			continue
		}
		if err := c.ligneSommes(f, "Sous-total "+v.Site, &parSite); err != nil {
			return err
		}
		parSite = sommesDues{}
	}
	return c.ligneSommes(f, "Total", &total)
}
