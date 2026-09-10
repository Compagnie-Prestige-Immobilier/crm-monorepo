package notifications

import (
	"time"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	marotoconfig "github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

var (
	courrielBordeauxPDF = props.Color{Red: 99, Green: 2, Blue: 16}
	courrielGrisPDF     = props.Color{Red: 110, Green: 110, Blue: 110}
	courrielZebrePDF    = props.Color{Red: 246, Green: 242, Blue: 243}
	courrielBlancPDF    = props.WhiteColor
)

func courrielPDF(c *Courriel, genereLe time.Time, tz *time.Location) ([]byte, error) {
	cfg := marotoconfig.NewBuilder().
		WithPageSize(pagesize.A4).
		WithLeftMargin(15).WithRightMargin(15).WithTopMargin(12).WithBottomMargin(12).
		WithCreationDate(genereLe).
		WithTitle(c.Titre, true).
		WithAuthor("CPI GO", true).
		Build()

	m := maroto.New(cfg)
	fond := &props.Cell{BackgroundColor: &courrielBordeauxPDF}
	m.AddRows(
		text.NewRow(7, "CPI GO", props.Text{Size: 9, Color: &courrielBlancPDF, Top: 1}).WithStyle(fond),
		text.NewRow(11, c.Titre, props.Text{Size: 17, Style: fontstyle.Bold, Color: &courrielBlancPDF}).WithStyle(fond),
		text.NewRow(7, genereLe.In(tz).Format("02/01/2006 à 15:04"), props.Text{Size: 9, Color: &courrielBlancPDF, Bottom: 2}).WithStyle(fond),
		text.NewRow(12, c.Intro, props.Text{Size: 10, Top: 4}),
	)
	libelle := props.Text{Size: 10, Style: fontstyle.Bold, Top: 1.5}
	valeur := props.Text{Size: 10, Top: 1.5}
	for i, ligne := range c.Lignes {
		row := m.AddRow(8, text.NewCol(4, ligne[0], libelle), text.NewCol(8, ligne[1], valeur))
		if i%2 == 1 {
			row.WithStyle(&props.Cell{BackgroundColor: &courrielZebrePDF})
		}
	}
	if c.Lien != "" {
		m.AddRows(text.NewRow(10, c.LibelleLien+" : "+c.Lien, props.Text{Size: 9, Color: &courrielGrisPDF, Top: 4}))
	}
	m.AddRows(text.NewRow(8, "Document généré automatiquement par CPI GO. Il ne remplace pas les pièces déposées sur la plateforme.",
		props.Text{Size: 8, Style: fontstyle.Italic, Color: &courrielGrisPDF, Top: 6}))
	doc, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return doc.GetBytes(), nil
}
