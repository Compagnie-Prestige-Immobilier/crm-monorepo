package support

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"cpi-go/web"
	"fmt"
	"html"
	imagerie "image"
	"image/color"
	"image/png"
	"io/fs"
	"maps"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/johnfercher/maroto/v2"
	marotoimage "github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	marotoconfig "github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/border"
	"github.com/johnfercher/maroto/v2/pkg/consts/extension"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/orientation"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
	"github.com/xuri/excelize/v2"
)

const (
	cheminExport        = cheminTickets + "/export"
	ticketsExportes     = 500
	numerosParRecherche = 40
	champDemandeur      = 4
	champNumero         = 2
	mimeClasseur        = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	feuilleTickets      = "Tickets"
	largeurUtilePDF     = 273
	motMaxPDF           = 100
	policeClasseur      = "Calibri"
)

var (
	typesTicket    = map[int]string{1: "Incident", 2: "Demande"}
	prioritesGlpi  = map[int]string{1: "Très basse", 2: "Basse", 3: "Moyenne", 4: "Haute", 5: "Très haute", 6: "Majeure"}
	entetesTickets = []string{"N°", "Titre", "Type", "Priorité", "Catégorie", "Ouvert le", "Description"}
	largeursPDF    = []int{11, 45, 17, 16, 32, 22, 130}
	largeursExcel  = []float64{8, 42, 11, 11, 28, 17, 100}

	finDeBloc     = regexp.MustCompile(`(?i)<br\s*/?>|</p>|</li>|</div>`)
	balise        = regexp.MustCompile(`<[^>]+>`)
	lignesVides   = regexp.MustCompile(`\n\s*\n+`)
	bordeauxPDF   = props.Color{Red: 0x63, Green: 0x02, Blue: 0x10}
	orPDF         = props.Color{Red: 0xc8, Green: 0x92, Blue: 0x1a}
	textePDF      = props.Color{Red: 0x1c, Green: 0x08, Blue: 0x10}
	fondPDF       = props.Color{Red: 0xf6, Green: 0xf6, Blue: 0xf6}
	sourdinePDF   = props.Color{Red: 0x6b, Green: 0x4a, Blue: 0x52}
	filetPDF      = props.Color{Red: 0xe5, Green: 0xd6, Blue: 0xd9}
	cheminLogo    = "dist/brand/cpi-logo.png"
	formatsSortis = map[string]string{"pdf": "application/pdf", "xlsx": mimeClasseur}
)

type ticketExporte struct {
	numero                                                      int
	titre, typeTicket, priorite, categorie, ouvert, description string
}

type ExportTicketsInput struct {
	Format string `query:"format" required:"true" enum:"pdf,xlsx"`
}

type ExportTicketsOutput struct {
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
	CacheControl       string `header:"Cache-Control"`
	Body               []byte
}

func monterExport(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "exporterTicketsSupport", Method: http.MethodGet, Path: cheminExport,
		Summary: "Les tickets GLPI de la personne connectée, en PDF ou en classeur.",
	}, s.exporter)
}

func (s *service) exporter(ctx context.Context, in *ExportTicketsInput) (*ExportTicketsOutput, error) {
	if !s.g.configure() {
		return nil, nonConfigure()
	}
	u := socle.UtilisateurCourant(ctx)
	tickets, plafond, err := s.ticketsDuDemandeur(ctx, &u)
	if err != nil {
		return nil, glpiInjoignable(err)
	}
	titre := "Tickets de " + u.FullName
	sousTitre := fmt.Sprintf("%d ticket%s · édité le %s", len(tickets), pluriel(len(tickets)), time.Now().In(s.Cfg.TimeZone).Format("02/01/2006"))
	if plafond {
		sousTitre = fmt.Sprintf("Les %d tickets les plus récents · édité le %s", len(tickets), time.Now().In(s.Cfg.TimeZone).Format("02/01/2006"))
	}
	var corps []byte
	if in.Format == "pdf" {
		corps, err = ticketsPDF(titre, sousTitre, tickets)
	} else {
		corps, err = ticketsClasseur(titre, sousTitre, tickets)
	}
	if err != nil {
		return nil, err
	}
	return &ExportTicketsOutput{
		ContentType:        formatsSortis[in.Format],
		ContentDisposition: `attachment; filename="tickets-support.` + in.Format + `"`,
		CacheControl:       "no-store", Body: corps,
	}, nil
}

// Les tickets dont la personne est demandeuse dans GLPI, plus ceux qu'elle a
// envoyés en administrateur : ceux-là partent au nom du compte de pilotage.
func (s *service) ticketsDuDemandeur(ctx context.Context, u *socle.Utilisateur) ([]ticketExporte, bool, error) {
	session, err := s.g.ouvrirSession(ctx)
	if err != nil {
		return nil, false, err
	}
	defer s.g.fermerSession(ctx, session)
	compte, err := s.g.idCompte(ctx, session, u.Username)
	if err != nil {
		return nil, false, err
	}
	numeros, err := s.Q.SupportNumerosPilotage(ctx, db.SupportNumerosPilotageParams{AuteurID: u.ID, Prendre: ticketsExportes})
	if err != nil {
		return nil, false, err
	}
	trouves := map[int]ticketExporte{}
	plafond := false
	if compte != 0 {
		total, lignes, err := s.g.chercherTickets(ctx, session, criteresTickets(champDemandeur, []int{compte}), ticketsExportes)
		if err != nil {
			return nil, false, err
		}
		plafond = total > len(lignes)
		ajouterTickets(trouves, lignes)
	}
	for paquet := range slices.Chunk(numeros, numerosParRecherche) {
		_, lignes, err := s.g.chercherTickets(ctx, session, criteresTickets(champNumero, paquet), numerosParRecherche)
		if err != nil {
			return nil, false, err
		}
		ajouterTickets(trouves, lignes)
	}
	tickets := slices.SortedFunc(maps.Values(trouves), func(a, b ticketExporte) int { return b.numero - a.numero })
	if len(tickets) > ticketsExportes {
		tickets, plafond = tickets[:ticketsExportes], true
	}
	slices.Reverse(tickets)
	return tickets, plafond, nil
}

func criteresTickets[T int | int32](champ int, valeurs []T) url.Values {
	criteres := url.Values{}
	for i, valeur := range valeurs {
		prefixe := fmt.Sprintf("criteria[%d]", i)
		if i > 0 {
			criteres.Set(prefixe+"[link]", "OR")
		}
		criteres.Set(prefixe+"[field]", strconv.Itoa(champ))
		criteres.Set(prefixe+"[searchtype]", "equals")
		criteres.Set(prefixe+"[value]", strconv.Itoa(int(valeur)))
	}
	return criteres
}

func ajouterTickets(trouves map[int]ticketExporte, lignes []map[string]any) {
	for _, l := range lignes {
		numero := entierGlpi(l["2"])
		ouvert := texteGlpi(l["15"])
		if date, err := time.Parse(time.DateTime, ouvert); err == nil {
			ouvert = date.Format("02/01/2006 15:04")
		}
		trouves[numero] = ticketExporte{
			numero: numero, titre: texteBrut(texteGlpi(l["1"])),
			typeTicket: typesTicket[entierGlpi(l["14"])], priorite: prioritesGlpi[entierGlpi(l["3"])],
			categorie: texteGlpi(l["7"]), ouvert: ouvert, description: texteBrut(texteGlpi(l["21"])),
		}
	}
}

func texteGlpi(v any) string {
	switch valeur := v.(type) {
	case string:
		return valeur
	case float64:
		return strconv.FormatFloat(valeur, 'f', -1, 64)
	}
	return ""
}

func entierGlpi(v any) int {
	n, _ := strconv.Atoi(texteGlpi(v))
	return n
}

// GLPI échappe le HTML qu'il stocke, parfois deux fois.
func texteBrut(contenu string) string {
	t := html.UnescapeString(html.UnescapeString(contenu))
	t = strings.ReplaceAll(t, "\r", "")
	t = balise.ReplaceAllString(finDeBloc.ReplaceAllString(t, "\n"), "")
	return strings.TrimSpace(lignesVides.ReplaceAllString(t, "\n"))
}

func pluriel(n int) string {
	if n > 1 {
		return "s"
	}
	return ""
}

func logoCPI() []byte {
	logo, _ := fs.ReadFile(web.Dist, cheminLogo)
	return logo
}

// Maroto ne dessine pas hors des marges : le bandeau est une image de fond
// posée en haut de la zone utile de chaque page.
func bandeauPNG() ([]byte, error) {
	img := imagerie.NewRGBA(imagerie.Rect(0, 0, largeurUtilePDF*4, 7*4))
	for y := range img.Bounds().Dy() {
		teinte := color.RGBA{R: 0x63, G: 0x02, B: 0x10, A: 255}
		if y >= 6*4 {
			teinte = color.RGBA{R: 0xc8, G: 0x92, B: 0x1a, A: 255}
		}
		for x := range img.Bounds().Dx() {
			img.Set(x, y, teinte)
		}
	}
	var tampon bytes.Buffer
	err := png.Encode(&tampon, img)
	return tampon.Bytes(), err
}

func ticketsPDF(titre, sousTitre string, tickets []ticketExporte) ([]byte, error) {
	bandeau, err := bandeauPNG()
	if err != nil {
		return nil, err
	}
	cfg := marotoconfig.NewBuilder().
		WithPageSize(pagesize.A4).WithOrientation(orientation.Horizontal).
		WithLeftMargin(12).WithRightMargin(12).WithTopMargin(0).WithBottomMargin(8).
		WithMaxGridSize(largeurUtilePDF).
		WithBackgroundImage(bandeau, extension.Png).
		WithPageNumber(props.PageNumber{Pattern: "Page {current} sur {total}", Place: props.RightBottom, Size: 7.5, Color: &sourdinePDF}).
		WithTitle(titre, true).WithAuthor("CPI", true).
		Build()
	m := maroto.New(cfg)
	if err := m.RegisterFooter(text.NewRow(5, "CPI · "+titre, props.Text{Size: 7.5, Color: &sourdinePDF})); err != nil {
		return nil, err
	}
	m.AddRows(row.New(12))
	if logo := logoCPI(); logo != nil {
		m.AddRows(marotoimage.NewFromBytesRow(16, logo, extension.Png, props.Rect{Percent: 100}))
	}
	m.AddRows(
		text.NewRow(11, titre, props.Text{Size: 17, Style: fontstyle.Bold, Color: &bordeauxPDF, Top: 3}),
		text.NewRow(6, sousTitre, props.Text{Size: 9, Color: &sourdinePDF}),
	)
	if err := m.RegisterHeader(row.New(12), enteteTicketsPDF()); err != nil {
		return nil, err
	}
	for i := range tickets {
		m.AddRows(lignesTicketPDF(&tickets[i], i)...)
	}
	doc, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return doc.GetBytes(), nil
}

func enteteTicketsPDF() core.Row {
	gras := props.Text{Size: 8, Style: fontstyle.Bold, Color: &props.WhiteColor, Top: 1.5, Bottom: 1.5, Left: 1, Right: 1}
	cols := make([]core.Col, 0, len(entetesTickets))
	for i, entete := range entetesTickets {
		cols = append(cols, text.NewCol(largeursPDF[i], entete, gras))
	}
	return row.New().Add(cols...).WithStyle(&props.Cell{
		BackgroundColor: &bordeauxPDF, BorderType: border.Bottom, BorderColor: &orPDF, BorderThickness: 0.5,
	})
}

// Maroto ignore les sauts de ligne d'un texte : chaque paragraphe de la
// description prend sa propre ligne, les autres colonnes restent sur la première.
func lignesTicketPDF(t *ticketExporte, index int) []core.Row {
	paragraphes := strings.Split(t.description, "\n")
	lignes := make([]core.Row, 0, len(paragraphes))
	for i, paragraphe := range paragraphes {
		corps := props.Text{Size: 7.5, Color: &textePDF, Top: 0.3, Bottom: 0.3, Left: 1, Right: 1}
		if i == 0 {
			corps.Top = 1.5
		}
		if i == len(paragraphes)-1 {
			corps.Bottom = 1.5
		}
		numero := corps
		numero.Style, numero.Color = fontstyle.Bold, &bordeauxPDF
		valeurs := []string{"", "", "", "", "", ""}
		if i == 0 {
			valeurs = []string{strconv.Itoa(t.numero), t.titre, t.typeTicket, t.priorite, t.categorie, t.ouvert}
		}
		cols := make([]core.Col, 0, len(largeursPDF))
		cols = append(cols, text.NewCol(largeursPDF[0], valeurs[0], numero))
		for j, valeur := range valeurs[1:] {
			cols = append(cols, text.NewCol(largeursPDF[j+1], valeur, corps))
		}
		cols = append(cols, text.NewCol(largeursPDF[6], couperMotsLongs(paragraphe), corps))
		style := &props.Cell{}
		if i == len(paragraphes)-1 {
			style.BorderType, style.BorderColor, style.BorderThickness = border.Bottom, &filetPDF, 0.15
		}
		if index%2 == 1 {
			style.BackgroundColor = &fondPDF
		}
		lignes = append(lignes, row.New().Add(cols...).WithStyle(style))
	}
	return lignes
}

// Maroto ne coupe qu'aux espaces : une adresse plus large que la colonne
// déborderait sur la page.
func couperMotsLongs(paragraphe string) string {
	mots := strings.Split(paragraphe, " ")
	for i, mot := range mots {
		lettres := []rune(mot)
		var coupe strings.Builder
		for len(lettres) > motMaxPDF {
			coupe.WriteString(string(lettres[:motMaxPDF]) + " ")
			lettres = lettres[motMaxPDF:]
		}
		coupe.WriteString(string(lettres))
		mots[i] = coupe.String()
	}
	return strings.Join(mots, " ")
}

func ticketsClasseur(titre, sousTitre string, tickets []ticketExporte) ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	if err := f.SetSheetName("Sheet1", feuilleTickets); err != nil {
		return nil, err
	}
	styles, err := stylesClasseur(f)
	if err != nil {
		return nil, err
	}
	if err := enTeteClasseur(f, titre, sousTitre, styles); err != nil {
		return nil, err
	}
	for i := range tickets {
		t := &tickets[i]
		ligne := strconv.Itoa(i + 5)
		valeurs := []any{t.numero, t.titre, t.typeTicket, t.priorite, t.categorie, t.ouvert, t.description}
		if err := f.SetSheetRow(feuilleTickets, "A"+ligne, &valeurs); err != nil {
			return nil, err
		}
		style, styleNumero := styles.ligne, styles.numero
		if i%2 == 1 {
			style, styleNumero = styles.ligneFond, styles.numeroFond
		}
		if err := f.SetCellStyle(feuilleTickets, "B"+ligne, "G"+ligne, style); err != nil {
			return nil, err
		}
		if err := f.SetCellStyle(feuilleTickets, "A"+ligne, "A"+ligne, styleNumero); err != nil {
			return nil, err
		}
	}
	derniere := strconv.Itoa(max(len(tickets)+4, 5))
	if err := f.AutoFilter(feuilleTickets, "A4:G"+derniere, nil); err != nil {
		return nil, err
	}
	if err := f.SetSheetProps(feuilleTickets, &excelize.SheetPropsOptions{FitToPage: new(true)}); err != nil {
		return nil, err
	}
	var tampon bytes.Buffer
	err = f.Write(&tampon)
	return tampon.Bytes(), err
}

type stylesTickets struct{ titre, sousTitre, entete, ligne, ligneFond, numero, numeroFond int }

func stylesClasseur(f *excelize.File) (stylesTickets, error) {
	filet := []excelize.Border{{Type: "bottom", Color: "E5D6D9", Style: 1}}
	haut := &excelize.Alignment{Vertical: "top", WrapText: true}
	fond := excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"F6F6F6"}}
	definitions := []*excelize.Style{
		{Font: &excelize.Font{Family: policeClasseur, Size: 16, Bold: true, Color: "630210"}},
		{Font: &excelize.Font{Family: policeClasseur, Size: 10, Color: "6B4A52"}},
		{
			Font:      &excelize.Font{Family: policeClasseur, Bold: true, Color: "FFFFFF"},
			Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"630210"}},
			Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
			Border:    []excelize.Border{{Type: "bottom", Color: "C8921A", Style: 2}},
		},
		{Font: &excelize.Font{Family: policeClasseur, Size: 10, Color: "1C0810"}, Alignment: haut, Border: filet},
		{Font: &excelize.Font{Family: policeClasseur, Size: 10, Color: "1C0810"}, Alignment: haut, Border: filet, Fill: fond},
		{Font: &excelize.Font{Family: policeClasseur, Size: 10, Bold: true, Color: "630210"}, Alignment: haut, Border: filet},
		{Font: &excelize.Font{Family: policeClasseur, Size: 10, Bold: true, Color: "630210"}, Alignment: haut, Border: filet, Fill: fond},
	}
	ids := make([]int, len(definitions))
	for i, d := range definitions {
		id, err := f.NewStyle(d)
		if err != nil {
			return stylesTickets{}, err
		}
		ids[i] = id
	}
	return stylesTickets{ids[0], ids[1], ids[2], ids[3], ids[4], ids[5], ids[6]}, nil
}

func enTeteClasseur(f *excelize.File, titre, sousTitre string, styles stylesTickets) error {
	_ = f.SetSheetView(feuilleTickets, 0, &excelize.ViewOptions{ShowGridLines: new(false)})
	if logo := logoCPI(); logo != nil {
		echelle := 50.0 / 170
		if err := f.AddPictureFromBytes(feuilleTickets, "A1", &excelize.Picture{
			Extension: ".png", File: logo,
			Format: &excelize.GraphicOptions{ScaleX: echelle, ScaleY: echelle},
		}); err != nil {
			return err
		}
	}
	for i, largeur := range largeursExcel {
		colonne := string(rune('A' + i))
		if err := f.SetColWidth(feuilleTickets, colonne, colonne, largeur); err != nil {
			return err
		}
	}
	cellules := []struct {
		ref    string
		valeur string
		style  int
	}{{"C1", titre, styles.titre}, {"C2", sousTitre, styles.sousTitre}}
	for _, c := range cellules {
		if err := f.SetCellValue(feuilleTickets, c.ref, c.valeur); err != nil {
			return err
		}
		if err := f.SetCellStyle(feuilleTickets, c.ref, c.ref, c.style); err != nil {
			return err
		}
	}
	for ligne, hauteur := range map[int]float64{1: 22, 2: 22, 4: 24} {
		if err := f.SetRowHeight(feuilleTickets, ligne, hauteur); err != nil {
			return err
		}
	}
	return miseEnPageClasseur(f, styles.entete)
}

func miseEnPageClasseur(f *excelize.File, styleEntete int) error {
	entetes := make([]any, len(entetesTickets))
	for i, e := range entetesTickets {
		entetes[i] = e
	}
	if err := f.SetSheetRow(feuilleTickets, "A4", &entetes); err != nil {
		return err
	}
	if err := f.SetCellStyle(feuilleTickets, "A4", "G4", styleEntete); err != nil {
		return err
	}
	if err := f.SetPanes(feuilleTickets, &excelize.Panes{Freeze: true, YSplit: 4, TopLeftCell: "A5", ActivePane: "bottomLeft"}); err != nil {
		return err
	}
	if err := f.SetDefinedName(&excelize.DefinedName{Name: "_xlnm.Print_Titles", RefersTo: feuilleTickets + "!$4:$4", Scope: feuilleTickets}); err != nil {
		return err
	}
	return f.SetPageLayout(feuilleTickets, &excelize.PageLayoutOptions{
		Orientation: new("landscape"), FitToWidth: new(1), FitToHeight: new(0),
	})
}
