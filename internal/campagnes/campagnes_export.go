package campagnes

import (
	"archive/zip"
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/socle"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/danielgtaylor/huma/v2"
	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	marotoconfig "github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	LotMimeClasseur = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	FeuilleLot      = "Répartition"
	lotFormatDate   = "dd/mm/yyyy hh:mm"

	lotEnteteTeleconseiller = "Téléconseiller"
	lotEnteteBanque         = "Banque"
)

var (
	lotBordeauxPDF  = props.Color{Red: 99, Green: 2, Blue: 16}
	lotGrisPDF      = props.Color{Red: 138, Green: 138, Blue: 138}
	lotZebrePDF     = props.Color{Red: 246, Green: 242, Blue: 243}
	lotTeteTablePDF = props.Color{Red: 237, Green: 231, Blue: 232}
	lotBlancPDF     = props.WhiteColor

	lotMoisEnLettres = [...]string{
		"janvier", "février", "mars", "avril", "mai", "juin",
		"juillet", "août", "septembre", "octobre", "novembre", "décembre",
	}

	lotHorsAlphanum   = regexp.MustCompile(`[^a-z0-9]+`)
	lotPlieurAccents  = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	lotMotifTelephone = regexp.MustCompile(`^(\+221)(\d{2})(\d{3})(\d{2})(\d{2})$`)
)

func lotSlugTeleconseiller(nom string) string {
	plat, _, err := transform.String(lotPlieurAccents, nom)
	if err != nil {
		plat = nom
	}
	slug := strings.Trim(lotHorsAlphanum.ReplaceAllString(strings.ToLower(plat), "-"), "-")
	return lotSiVide(slug, "teleconseiller")
}

func lotTelephoneEspace(phoneE164 string) string {
	return lotMotifTelephone.ReplaceAllString(phoneE164, "$1 $2 $3 $4 $5")
}

func lotDateEnLettres(t time.Time, tz *time.Location) string {
	l := t.In(tz)
	return strconv.Itoa(l.Day()) + " " + lotMoisEnLettres[l.Month()-1] + " " + strconv.Itoa(l.Year())
}

func lotInstantEnLettres(t time.Time, tz *time.Location) string {
	return lotDateEnLettres(t, tz) + " à " + t.In(tz).Format("15:04")
}

func lotHeureMuraleDakar(t time.Time, tz *time.Location) time.Time {
	l := t.In(tz)
	return time.Date(l.Year(), l.Month(), l.Day(), l.Hour(), l.Minute(), l.Second(), 0, time.UTC)
}

type lotLigneProgramme struct {
	position      int
	fullName      string
	etablissement string
	phoneE164     string
}

type lotDonneesProgramme struct {
	teleconseiller string
	titre          string
	periode        string
	lotName        string
	cibleLabel     string
	genereLe       time.Time
	lignes         []lotLigneProgramme
}

func lotLignesDuProgramme(rows []db.LotItemsPourPdfJourRow) []lotLigneProgramme {
	lignes := make([]lotLigneProgramme, 0, len(rows))
	for index, row := range rows {
		ligne := lotLigneProgramme{position: index + 1}
		if row.RepName != nil {
			ligne.fullName = *row.RepName
			ligne.etablissement = lotValeurTexte(row.Etablissement)
			ligne.phoneE164 = lotValeurTexte(row.RepPhone)
		} else {
			ligne.fullName = lotNomEtPrenom(row.Nom, row.Prenom)
			ligne.phoneE164 = lotValeurTexte(row.ProspectPhone)
		}
		lignes = append(lignes, ligne)
	}
	return lignes
}

func (*service) lotProgrammeDe(row *db.LotParIdRow, rows []db.LotItemsPourPdfJourRow, titre, periode string) *lotDonneesProgramme {
	label := lotScopeLabel(string(row.Cible), lotLireFiltres(row.Filters))
	if !lotSurRepresentants(string(row.Cible)) {
		label = "Prospects : " + label
	}
	nom := exports.ExportEnteteTeleconseiller
	if len(rows) > 0 && rows[0].AssigneeName != nil {
		nom = *rows[0].AssigneeName
	}
	return &lotDonneesProgramme{
		teleconseiller: nom, titre: titre, periode: periode, lotName: row.Name,
		cibleLabel: label, genereLe: time.Now(), lignes: lotLignesDuProgramme(rows),
	}
}

func (s *service) lotDonneesProgrammeJour(ctx context.Context, id, teleconseillerID string, jour int) (*lotDonneesProgramme, error) {
	row, err := s.lot(ctx, id)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.LotItemsPourPdfJour(ctx, db.LotItemsPourPdfJourParams{
		LotId: id, AssigneeId: lotPointeurTexte(teleconseillerID), Day: lotInt32(jour),
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_PROGRAMME_INTROUVABLE",
			"Aucune fiche pour ce téléconseiller à cette journée.")
	}
	jours, err := s.lotNombreDeJours(ctx, row)
	if err != nil {
		return nil, err
	}
	periode := "Jour " + strconv.Itoa(jour) + " sur " + strconv.Itoa(jours)
	return s.lotProgrammeDe(row, rows, "Programme d’appel", periode), nil
}

func (s *service) lotNombreDeJours(ctx context.Context, row *db.LotParIdRow) (int, error) {
	if stored := lotLireFiltres(row.Filters).Distribution; stored.valide() {
		return stored.Jours, nil
	}
	jours, err := s.Q.LotJourMax(ctx, row.ID)
	return int(jours), err
}

// Les fiches arrivées après l'impression du programme, et que le destinataire
// tient encore. Une seule trace si `reaffectationId` est donné.
func (s *service) lotDonneesFichesRecues(ctx context.Context, id, teleconseillerID, reaffectationID string) (*lotDonneesProgramme, error) {
	row, err := s.lot(ctx, id)
	if err != nil {
		return nil, err
	}
	traces, err := s.Q.LotReaffectationsRecues(ctx, db.LotReaffectationsRecuesParams{
		LotId: id, ToAssigneeId: teleconseillerID, ReaffectationID: lotPointeurTexte(reaffectationID),
	})
	if err != nil {
		return nil, err
	}
	var positions []int32
	for _, trace := range traces {
		positions = append(positions, trace.Positions...)
	}
	var rows []db.LotItemsPourPdfJourRow
	if len(positions) > 0 {
		lignes, err := s.Q.LotItemsPourPdfPositions(ctx, db.LotItemsPourPdfPositionsParams{
			LotId: id, AssigneeId: lotPointeurTexte(teleconseillerID),
			Column3: slices.Compact(slices.Sorted(slices.Values(positions))),
		})
		if err != nil {
			return nil, err
		}
		rows = make([]db.LotItemsPourPdfJourRow, 0, len(lignes))
		for _, ligne := range lignes {
			rows = append(rows, db.LotItemsPourPdfJourRow(ligne))
		}
	}
	if len(rows) == 0 {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_FICHES_RECUES_INTROUVABLES",
			"Ce téléconseiller ne tient plus aucune fiche reçue.")
	}
	derniere := time.Now()
	if len(traces) > 0 {
		derniere = traces[0].CreatedAt
	}
	periode := "Reçues le " + lotDateEnLettres(derniere, s.Cfg.TimeZone)
	return s.lotProgrammeDe(row, rows, "Fiches reçues", periode), nil
}

func (s *service) lotProgrammePDF(d *lotDonneesProgramme) ([]byte, error) {
	cfg := marotoconfig.NewBuilder().
		WithPageSize(pagesize.A4).
		WithLeftMargin(15).WithRightMargin(15).WithTopMargin(12).WithBottomMargin(12).
		WithPageNumber(props.PageNumber{
			Pattern: "Page {current} / {total}", Place: props.LeftBottom,
			Size: 9, Color: &lotGrisPDF,
		}).
		WithCreationDate(d.genereLe).
		WithTitle(d.titre+" : "+d.teleconseiller+", "+d.periode, true).
		WithAuthor("CRM Prospection CPI", true).
		Build()

	m := maroto.New(cfg)
	if err := m.RegisterHeader(s.lotBandeauProgramme(d)...); err != nil {
		return nil, err
	}
	m.AddRows(lotEnteteColonnes())
	for index, ligne := range d.lignes {
		m.AddRows(lotLigneTable(ligne, index))
	}
	if len(d.lignes) == 0 {
		m.AddRows(text.NewRow(10, "Aucune fiche pour cette journée.",
			props.Text{Size: 11, Style: fontstyle.Italic, Color: &lotGrisPDF}))
	}
	doc, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return doc.GetBytes(), nil
}

func (s *service) lotBandeauProgramme(d *lotDonneesProgramme) []core.Row {
	titre := text.NewRow(6, d.titre, props.Text{Size: 9, Color: &lotBlancPDF, Top: 1})
	nom := text.NewRow(10, d.teleconseiller, props.Text{Size: 18, Style: fontstyle.Bold, Color: &lotBlancPDF})
	repere := text.NewRow(6, d.periode+"   ·   "+lotInstantEnLettres(d.genereLe, s.Cfg.TimeZone),
		props.Text{Size: 9, Color: &lotBlancPDF})
	origine := text.NewRow(7, d.lotName+"   ·   "+d.cibleLabel, props.Text{Size: 8, Color: &lotBlancPDF, Bottom: 2})
	fond := &props.Cell{BackgroundColor: &lotBordeauxPDF}
	return []core.Row{
		titre.WithStyle(fond), nom.WithStyle(fond), repere.WithStyle(fond), origine.WithStyle(fond),
	}
}

func lotEnteteColonnes() core.Row {
	gras := props.Text{Size: 9, Style: fontstyle.Bold, Color: &lotBordeauxPDF, Top: 1.5}
	return maroto.New().AddRow(8,
		text.NewCol(1, "N°", gras),
		text.NewCol(4, "Nom complet", gras),
		text.NewCol(4, "Établissement", gras),
		text.NewCol(3, "Téléphone", gras),
	).WithStyle(&props.Cell{BackgroundColor: &lotTeteTablePDF})
}

func lotLigneTable(ligne lotLigneProgramme, index int) core.Row {
	corps := props.Text{Size: 10, Top: 1.5}
	row := maroto.New().AddRow(7,
		text.NewCol(1, strconv.Itoa(ligne.position), corps),
		text.NewCol(4, ligne.fullName, corps),
		text.NewCol(4, ligne.etablissement, corps),
		text.NewCol(3, lotTelephoneEspace(ligne.phoneE164), corps),
	)
	if index%2 == 1 {
		return row.WithStyle(&props.Cell{BackgroundColor: &lotZebrePDF})
	}
	return row
}

type CampagnePieceOutput struct {
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
	CacheControl       string `header:"Cache-Control"`
	Body               []byte
}

func lotEnPieceJointe(mime, nom string, corps []byte) *CampagnePieceOutput {
	return &CampagnePieceOutput{
		ContentType: mime, ContentDisposition: `attachment; filename="` + nom + `"`,
		CacheControl: "no-store", Body: corps,
	}
}

type CampagneProgrammeInput struct {
	ID               string `path:"id" format:"uuid"`
	TeleconseillerID string `query:"teleconseillerId" required:"true" maxLength:"64"`
	Jour             int    `query:"jour" minimum:"1" maximum:"10" default:"1"`
}

// Le programme est assemblé AVANT toute écriture : une fois la réponse
// commencée, le 404 du couple téléconseiller / journée ne partirait plus.
func (s *service) campagneProgramme(ctx context.Context, in *CampagneProgrammeInput) (*CampagnePieceOutput, error) {
	d, err := s.lotDonneesProgrammeJour(ctx, in.ID, in.TeleconseillerID, in.Jour)
	if err != nil {
		return nil, err
	}
	corps, err := s.lotProgrammePDF(d)
	if err != nil {
		return nil, err
	}
	nom := "programme-" + lotSlugTeleconseiller(d.teleconseiller) + "-jour-" + strconv.Itoa(in.Jour) + ".pdf"
	return lotEnPieceJointe("application/pdf", nom, corps), nil
}

type CampagneFichesRecuesInput struct {
	ID               string `path:"id" format:"uuid"`
	TeleconseillerID string `query:"teleconseillerId" required:"true" maxLength:"64"`
	ReaffectationID  string `query:"reaffectationId" format:"uuid"`
}

func (s *service) campagneFichesRecues(ctx context.Context, in *CampagneFichesRecuesInput) (*CampagnePieceOutput, error) {
	d, err := s.lotDonneesFichesRecues(ctx, in.ID, in.TeleconseillerID, in.ReaffectationID)
	if err != nil {
		return nil, err
	}
	corps, err := s.lotProgrammePDF(d)
	if err != nil {
		return nil, err
	}
	return lotEnPieceJointe("application/pdf", "fiches-recues-"+lotSlugTeleconseiller(d.teleconseiller)+".pdf", corps), nil
}

func (s *service) lotProgrammesZip(ctx context.Context, in *CampagneIDInput) (*CampagnePieceOutput, error) {
	paires, err := s.Q.LotProgrammes(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if len(paires) == 0 {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_PROGRAMME_INTROUVABLE",
			"Cette campagne ne porte aucun programme.")
	}
	var tampon bytes.Buffer
	archive := zip.NewWriter(&tampon)
	pris := map[string]bool{}
	for _, paire := range paires {
		agent := lotValeurTexte(paire.AssigneeId)
		d, err := s.lotDonneesProgrammeJour(ctx, in.ID, agent, int(paire.Day))
		if err != nil {
			return nil, err
		}
		corps, err := s.lotProgrammePDF(d)
		if err != nil {
			return nil, err
		}
		nom := "programme-" + lotSlugTeleconseiller(d.teleconseiller) + "-jour-" + strconv.Itoa(int(paire.Day)) + ".pdf"
		if pris[nom] {
			nom = agent + "-" + nom
		}
		pris[nom] = true
		entree, err := archive.Create(nom)
		if err != nil {
			return nil, err
		}
		if _, err := entree.Write(corps); err != nil {
			return nil, err
		}
	}
	if err := archive.Close(); err != nil {
		return nil, err
	}
	return lotEnPieceJointe("application/zip", "campagne-"+in.ID+"-programmes.zip", tampon.Bytes()), nil
}

var lotColonnesRepresentants = []struct {
	entete  string
	largeur float64
}{
	{exports.ExportEnteteTeleconseiller, 26},
	{exports.ExportEnteteJour, 8},
	{exports.ExportEnteteNomComplet, 30},
	{exports.ExportEnteteTelephone, 20},
	{exports.ExportEnteteDepartement, 24},
	{exports.ExportEnteteIef, 26},
	{lotEnteteTeleconseiller, 26},
	{exports.ExportEnteteNotes, 40},
	{exports.ExportEnteteSaisiLe, 20},
}

var lotColonnesProspects = []struct {
	entete  string
	largeur float64
}{
	{exports.ExportEnteteTeleconseiller, 26},
	{exports.ExportEnteteJour, 8},
	{exports.ExportEnteteNom, 24},
	{exports.ExportEntetePrenom, 24},
	{exports.ExportEnteteTelephone, 20},
	{lotEnteteBanque, 24},
	{exports.ExportEnteteSyndicat, 20},
	{exports.ExportEnteteRepresentant, 26},
	{exports.ExportEnteteDepartement, 24},
	{lotEnteteTeleconseiller, 26},
	{exports.ExportEnteteDateSaisie, 20},
}

// Le classeur du lot : la répartition d'abord, la fiche ensuite. L'ordre est
// celui du tourniquet, pas celui des positions : chacun imprime son bloc.
func (s *service) lotEcrireClasseur(ctx context.Context, row *db.LotParIdRow, sortie huma.Context) error {
	classeur := excelize.NewFile()
	defer func() { _ = classeur.Close() }()
	if err := classeur.SetSheetName("Sheet1", FeuilleLot); err != nil {
		return err
	}
	styleEntete, err := classeur.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: exports.ExportTypeRemplissage, Pattern: 1, Color: []string{"FF630210"}},
	})
	if err != nil {
		return err
	}
	styleDate, err := classeur.NewStyle(&excelize.Style{CustomNumFmt: &[]string{lotFormatDate}[0]})
	if err != nil {
		return err
	}
	flux, err := classeur.NewStreamWriter(FeuilleLot)
	if err != nil {
		return err
	}
	rang := lotLireFiltres(row.Filters).Distribution.TeleconseillerIds
	if lotSurRepresentants(string(row.Cible)) {
		err = s.lotFeuilleRepresentants(ctx, row.ID, rang, flux, styleEntete, styleDate)
	} else {
		err = s.lotFeuilleProspects(ctx, row.ID, rang, flux, styleEntete, styleDate)
	}
	if err != nil {
		return err
	}
	if err := flux.Flush(); err != nil {
		return err
	}
	return classeur.Write(sortie.BodyWriter())
}

func lotEcrireEntete(flux *excelize.StreamWriter, colonnes []struct {
	entete  string
	largeur float64
}, style int,
) error {
	cellules := make([]any, 0, len(colonnes))
	for index, colonne := range colonnes {
		if err := flux.SetColWidth(index+1, index+1, colonne.largeur); err != nil {
			return err
		}
		cellules = append(cellules, excelize.Cell{StyleID: style, Value: colonne.entete})
	}
	if err := flux.SetPanes(&excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: exports.ExportVoletActif}); err != nil {
		return err
	}
	return flux.SetRow("A1", cellules)
}

// Le rang du téléconseiller dans la distribution EST son ordre d'impression ;
// un compte absent de la distribution passe après, sans casser le tri.
func lotRangDe(rang []string, agent *string) int {
	if agent == nil {
		return len(rang) + 1
	}
	if index := slices.Index(rang, *agent); index >= 0 {
		return index
	}
	return len(rang)
}

func (s *service) lotFeuilleRepresentants(ctx context.Context, id string, rang []string,
	flux *excelize.StreamWriter, styleEntete, styleDate int,
) error {
	lignes, err := s.Q.LotLignesRepresentants(ctx, id)
	if err != nil {
		return err
	}
	sort.SliceStable(lignes, func(i, j int) bool {
		return lotOrdreImpression(rang, lignes[i].AssigneeId, lignes[i].Day, lignes[i].Position,
			lignes[j].AssigneeId, lignes[j].Day, lignes[j].Position)
	})
	if err := lotEcrireEntete(flux, lotColonnesRepresentants, styleEntete); err != nil {
		return err
	}
	for index := range lignes {
		ligne := &lignes[index]
		cellules := []any{
			lotValeurTexte(ligne.AssigneeName), int(ligne.Day), ligne.FullName, ligne.PhoneE164,
			ligne.Departement, lotValeurTexte(ligne.Ief), ligne.Commercial, lotValeurTexte(ligne.Notes),
			excelize.Cell{StyleID: styleDate, Value: lotHeureMuraleDakar(ligne.ClientCreatedAt, s.Cfg.TimeZone)},
		}
		if err := flux.SetRow("A"+strconv.Itoa(index+2), cellules); err != nil {
			return err
		}
	}
	return nil
}

func (s *service) lotFeuilleProspects(ctx context.Context, id string, rang []string,
	flux *excelize.StreamWriter, styleEntete, styleDate int,
) error {
	lignes, err := s.Q.LotLignesProspects(ctx, id)
	if err != nil {
		return err
	}
	sort.SliceStable(lignes, func(i, j int) bool {
		return lotOrdreImpression(rang, lignes[i].AssigneeId, lignes[i].Day, lignes[i].Position,
			lignes[j].AssigneeId, lignes[j].Day, lignes[j].Position)
	})
	if err := lotEcrireEntete(flux, lotColonnesProspects, styleEntete); err != nil {
		return err
	}
	for index := range lignes {
		ligne := &lignes[index]
		cellules := []any{
			lotValeurTexte(ligne.AssigneeName), int(ligne.Day), ligne.Nom, ligne.Prenom, ligne.PhoneE164,
			lotValeurTexte(ligne.Banque), lotValeurTexte(ligne.Syndicat), lotValeurTexte(ligne.Representant),
			lotValeurTexte(ligne.Departement), ligne.Commercial,
			excelize.Cell{StyleID: styleDate, Value: lotHeureMuraleDakar(ligne.ClientCreatedAt, s.Cfg.TimeZone)},
		}
		if err := flux.SetRow("A"+strconv.Itoa(index+2), cellules); err != nil {
			return err
		}
	}
	return nil
}

func lotOrdreImpression(rang []string, agentG *string, jourG, positionG int32,
	agentD *string, jourD, positionD int32,
) bool {
	if r1, r2 := lotRangDe(rang, agentG), lotRangDe(rang, agentD); r1 != r2 {
		return r1 < r2
	}
	if jourG != jourD {
		return jourG < jourD
	}
	return positionG < positionD
}

func monterCampagnesExport(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "downloadLotExportProgramme", Method: http.MethodGet,
		Path: "/api/v1/lots-export/{id}/programme.pdf",
	}, s.campagneProgramme)
	huma.Register(api, huma.Operation{
		OperationID: "downloadLotExportFichesRecues", Method: http.MethodGet,
		Path: "/api/v1/lots-export/{id}/fiches-recues.pdf",
	}, s.campagneFichesRecues)
	huma.Register(api, huma.Operation{
		OperationID: "downloadLotExportProgrammesZip", Method: http.MethodGet,
		Path: "/api/v1/lots-export/{id}/programmes.zip",
	}, s.lotProgrammesZip)
	huma.Register(api, huma.Operation{
		OperationID: "downloadLotExportXlsx", Method: http.MethodGet,
		Path: "/api/v1/lots-export/{id}/export.xlsx",
	}, func(ctx context.Context, in *CampagneIDInput) (*huma.StreamResponse, error) {
		row, err := s.lot(ctx, in.ID)
		if err != nil {
			return nil, err
		}
		return &huma.StreamResponse{Body: func(sortie huma.Context) {
			sortie.SetHeader("Content-Type", LotMimeClasseur)
			sortie.SetHeader("Content-Disposition", `attachment; filename="campagne-`+in.ID+`.xlsx"`)
			sortie.SetHeader("Cache-Control", "no-store")
			if err := s.lotEcrireClasseur(ctx, row, sortie); err != nil {
				sortie.SetStatus(http.StatusInternalServerError)
			}
		}}, nil
	})
}
