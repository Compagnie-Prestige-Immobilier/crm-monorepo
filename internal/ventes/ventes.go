package ventes

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"errors"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xuri/excelize/v2"
)

type service struct{ *socle.Deps }

var lecteurs = []socle.Role{socle.Admin, socle.Direction}

var Garde = map[string][]socle.Role{
	"GET /api/v1/ventes":                  lecteurs,
	"POST /api/v1/ventes/classeur":        lecteurs,
	"GET /api/v1/ventes/classeur/fichier": lecteurs,
}

const codeIllisible = "VENTES_CLASSEUR_ILLISIBLE"

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "listVentes", Method: http.MethodGet, Path: "/api/v1/ventes",
		Summary: "Les ventes et leurs versements, lus dans le dernier classeur déposé.",
	}, s.lister)
	huma.Register(api, huma.Operation{
		OperationID: "deposerClasseurVentes", Method: http.MethodPost, Path: "/api/v1/ventes/classeur",
		MaxBodyBytes: 20 << 20,
		Summary:      "Remplace le classeur des ventes, en ne gardant que les ventes souscrites depuis la date donnée.",
	}, s.deposer)
	huma.Register(api, huma.Operation{
		OperationID: "telechargerClasseurVentes", Method: http.MethodGet, Path: "/api/v1/ventes/classeur/fichier",
		Summary: "Le classeur déposé, tel quel.",
	}, s.telecharger)
}

type VersementDTO struct {
	Date    string `json:"date"`
	Montant int64  `json:"montant"`
}

type VenteDTO struct {
	Numero           int32          `json:"numero"`
	Canal            string         `json:"canal"`
	DateSouscription *string        `json:"dateSouscription"`
	Client           string         `json:"client"`
	Telephone        string         `json:"telephone"`
	Site             string         `json:"site"`
	NombreLots       int32          `json:"nombreLots"`
	NumerosLots      string         `json:"numerosLots"`
	Superficie       string         `json:"superficie"`
	PrixUnitaire     int64          `json:"prixUnitaire"`
	PrixTotal        int64          `json:"prixTotal"`
	Acompte          int64          `json:"acompte"`
	Reliquat         int64          `json:"reliquat"`
	PartProprietaire int64          `json:"partProprietaire"`
	PartApporteur    int64          `json:"partApporteur"`
	PartCpi          int64          `json:"partCpi"`
	Versements       []VersementDTO `json:"versements"`
}

type ClasseurDTO struct {
	NomFichier string  `json:"nomFichier"`
	Depuis     *string `json:"depuis"`
	ImporteLe  string  `json:"importeLe"`
	ImportePar string  `json:"importePar"`
}

type VentesOutput struct {
	Body struct {
		Classeur *ClasseurDTO `json:"classeur"`
		Ventes   []VenteDTO   `json:"ventes"`
	}
}

type DepotInput struct {
	Depuis  string `query:"depuis" format:"date"`
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"true"`
	}]
}

type FichierOutput struct {
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
	CacheControl       string `header:"Cache-Control"`
	Body               []byte
}

func (s *service) lister(ctx context.Context, _ *struct{}) (*VentesOutput, error) {
	out := &VentesOutput{}
	out.Body.Ventes = []VenteDTO{}
	classeur, err := s.Q.ClasseurVentes(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	out.Body.Classeur = &ClasseurDTO{
		NomFichier: classeur.NomFichier, Depuis: jourOuNul(classeur.Depuis),
		ImporteLe: classeur.ImporteLe.UTC().Format(time.RFC3339), ImportePar: classeur.ImportePar,
	}
	ventes, err := s.Q.ListerVentes(ctx)
	if err != nil {
		return nil, err
	}
	versements, err := s.Q.ListerVersementsVentes(ctx)
	if err != nil {
		return nil, err
	}
	parVente := map[int64][]VersementDTO{}
	for _, v := range versements {
		parVente[v.VenteId] = append(parVente[v.VenteId], VersementDTO{Date: jour(v.Date), Montant: v.Montant})
	}
	for i := range ventes {
		out.Body.Ventes = append(out.Body.Ventes, venteDTO(&ventes[i], parVente[ventes[i].ID]))
	}
	return out, nil
}

func venteDTO(v *db.Vente, versements []VersementDTO) VenteDTO {
	if versements == nil {
		versements = []VersementDTO{}
	}
	return VenteDTO{
		Numero: v.Numero, Canal: v.Canal, DateSouscription: jourOuNul(v.DateSouscription), Client: v.Client,
		Telephone: v.Telephone, Site: v.Site, NombreLots: v.NombreLots, NumerosLots: v.NumerosLots,
		Superficie: v.Superficie, PrixUnitaire: v.PrixUnitaire, PrixTotal: v.PrixTotal, Acompte: v.Acompte,
		Reliquat: v.Reliquat, PartProprietaire: v.PartProprietaire, PartApporteur: v.PartApporteur,
		PartCpi: v.PartCpi, Versements: versements,
	}
}

func (s *service) deposer(ctx context.Context, in *DepotInput) (*VentesOutput, error) {
	fichier := in.RawBody.Data().File
	contenu, err := io.ReadAll(fichier)
	if err != nil {
		return nil, err
	}
	depuis, err := dateDepuis(in.Depuis)
	if err != nil {
		return nil, err
	}
	lues, err := lireClasseur(contenu, depuis)
	if err != nil {
		return nil, err
	}
	nom := fichier.Filename
	if nom == "" {
		nom = "ventes.xlsx"
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.SupprimerClasseursVentes(ctx); err != nil {
			return err
		}
		if err := q.InsererClasseurVentes(ctx, db.InsererClasseurVentesParams{
			ID: id.String(), NomFichier: nom, Contenu: contenu, Depuis: depuis,
			ImporteParId: socle.UtilisateurCourant(ctx).ID,
		}); err != nil {
			return err
		}
		return insererVentes(ctx, q, id.String(), lues)
	})
	if err != nil {
		return nil, err
	}
	return s.lister(ctx, nil)
}

func insererVentes(ctx context.Context, q *db.Queries, classeurID string, lues []venteLue) error {
	for i := range lues {
		v := &lues[i]
		v.ligne.ClasseurId = classeurID
		venteID, err := q.InsererVente(ctx, v.ligne)
		if err != nil {
			return err
		}
		for rang, versement := range v.versements {
			if err := q.InsererVersementVente(ctx, db.InsererVersementVenteParams{
				VenteId: venteID, Rang: int32(rang + 1), Date: dateSQL(versement.date), Montant: versement.montant,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *service) telecharger(ctx context.Context, _ *struct{}) (*FichierOutput, error) {
	fichier, err := s.Q.FichierClasseurVentes(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTES_AUCUN_CLASSEUR", "Aucun classeur n’a été déposé.")
	}
	if err != nil {
		return nil, err
	}
	return &FichierOutput{
		ContentType:        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		ContentDisposition: `attachment; filename*=UTF-8''` + url.PathEscape(fichier.NomFichier),
		CacheControl:       "no-store", Body: fichier.Contenu,
	}, nil
}

type versementLu struct {
	date    time.Time
	montant int64
}

type venteLue struct {
	ligne      db.InsererVenteParams
	versements []versementLu
}

func lireClasseur(contenu []byte, depuis pgtype.Date) ([]venteLue, error) {
	// Le type déclaré par le client ne prouve rien : un xlsx est une archive ZIP.
	if !bytes.HasPrefix(contenu, []byte("PK\x03\x04")) {
		return nil, socle.Problem(http.StatusBadRequest, codeIllisible, "Ce fichier n’est pas un classeur Excel.")
	}
	classeur, err := excelize.OpenReader(bytes.NewReader(contenu))
	if err != nil {
		return nil, socle.Problem(http.StatusBadRequest, codeIllisible, "Ce classeur ne peut pas être lu.")
	}
	defer func() { _ = classeur.Close() }()
	ventes, err := lireOnglet(classeur, "TABLEAU DES VENTES")
	if err != nil {
		return nil, err
	}
	echeances, err := lireOnglet(classeur, "ECHEANCES")
	if err != nil {
		return nil, err
	}
	versements := lireVersements(echeances)
	lues := []venteLue{}
	lignes := lireVentes(ventes)
	for i := range lignes {
		date := lignes[i].DateSouscription
		if depuis.Valid && (!date.Valid || date.Time.Before(depuis.Time)) {
			continue
		}
		lues = append(lues, venteLue{ligne: lignes[i], versements: versements[lignes[i].Numero]})
	}
	return lues, nil
}

func lireOnglet(classeur *excelize.File, fragment string) ([][]string, error) {
	for _, nom := range classeur.GetSheetList() {
		if !strings.Contains(strings.ToUpper(nom), fragment) {
			continue
		}
		return classeur.GetRows(nom, excelize.Options{RawCellValue: true})
	}
	message := "Le classeur n’a pas d’onglet « " + fragment + " »."
	return nil, socle.Problem(http.StatusBadRequest, "VENTES_ONGLET_ABSENT", message)
}

var colonnesVentes = []string{
	"NBR.", "CANAL", "DATE SOUSCRIPT.", "PRENOM & NOM CLIENT", "TELEPHONE", "SITE", "NBR. LOTS",
	"NUMERO LOT", "SUPERFICIE", "PRIX VENTE UNITAIRE", "PRIX TOTAL", "ACOMPTE VERSE", "RELIQUAT",
	"PART PROPRIETAIRE", "PART APPORTEUR", "PART CPI",
}

// Les colonnes se retrouvent par leur intitulé : une colonne ajoutée au
// classeur ne décale pas la lecture.
func positionsColonnes(entete []string) map[string]int {
	positions := map[string]int{}
	for i, cellule := range entete {
		texte := strings.ToUpper(strings.TrimSpace(cellule))
		for _, nom := range colonnesVentes {
			if _, deja := positions[nom]; !deja && strings.HasPrefix(texte, nom) {
				positions[nom] = i
				break
			}
		}
	}
	return positions
}

func lireVentes(lignes [][]string) []db.InsererVenteParams {
	ventes := []db.InsererVenteParams{}
	var col map[string]int
	for _, ligne := range lignes {
		if col == nil {
			if positions := positionsColonnes(ligne); len(positions) == len(colonnesVentes) {
				col = positions
			}
			continue
		}
		cellule := func(nom string) string { return celluleA(ligne, col[nom]) }
		client := strings.TrimSpace(cellule("PRENOM & NOM CLIENT"))
		if client == "" {
			continue
		}
		// Une vente sans date reste une vente : l'écarter fausserait les totaux.
		date := pgtype.Date{}
		if lue, ok := dateExcel(cellule("DATE SOUSCRIPT.")); ok {
			date = dateSQL(lue)
		}
		ventes = append(ventes, db.InsererVenteParams{
			Numero: entier32(cellule("NBR.")), Canal: strings.TrimSpace(cellule("CANAL")),
			DateSouscription: date, Client: client, Telephone: strings.TrimSpace(cellule("TELEPHONE")),
			Site: strings.TrimSpace(cellule("SITE")), NombreLots: entier32(cellule("NBR. LOTS")),
			NumerosLots: texteNombre(cellule("NUMERO LOT")), Superficie: texteNombre(cellule("SUPERFICIE")),
			PrixUnitaire: entier(cellule("PRIX VENTE UNITAIRE")), PrixTotal: entier(cellule("PRIX TOTAL")),
			Acompte: entier(cellule("ACOMPTE VERSE")), Reliquat: entier(cellule("RELIQUAT")),
			PartProprietaire: entier(cellule("PART PROPRIETAIRE")),
			PartApporteur:    entier(cellule("PART APPORTEUR")), PartCpi: entier(cellule("PART CPI")),
		})
	}
	return ventes
}

// Une ligne d'échéances : numéro de la vente, client, téléphone, puis des
// paires date et montant. « SOLDE » à la place de la première date : rien à suivre.
func lireVersements(lignes [][]string) map[int32][]versementLu {
	parVente := map[int32][]versementLu{}
	for _, ligne := range lignes {
		numero := entier32(celluleA(ligne, 0))
		if numero == 0 {
			continue
		}
		for i := 3; i+1 < len(ligne); i += 2 {
			date, ok := dateExcel(ligne[i])
			if !ok {
				continue
			}
			parVente[numero] = append(parVente[numero], versementLu{date: date, montant: entier(ligne[i+1])})
		}
	}
	return parVente
}

func celluleA(ligne []string, i int) string {
	if i < len(ligne) {
		return ligne[i]
	}
	return ""
}

func entier(texte string) int64 {
	valeur, err := strconv.ParseFloat(strings.TrimSpace(texte), 64)
	if err != nil {
		return 0
	}
	return int64(math.Round(valeur))
}

// « 1065.0 » redevient « 1065 », « 1416 - 1417 » reste tel quel.
func texteNombre(texte string) string {
	texte = strings.TrimSpace(texte)
	if valeur, err := strconv.ParseFloat(texte, 64); err == nil {
		return strconv.FormatFloat(valeur, 'f', -1, 64)
	}
	return texte
}

func dateExcel(texte string) (time.Time, bool) {
	serie, err := strconv.ParseFloat(strings.TrimSpace(texte), 64)
	if err != nil || serie < 1 {
		return time.Time{}, false
	}
	date, err := excelize.ExcelDateToTime(serie, false)
	return date, err == nil
}

func dateDepuis(texte string) (pgtype.Date, error) {
	if texte == "" {
		return pgtype.Date{}, nil
	}
	date, err := time.Parse(time.DateOnly, texte)
	if err != nil {
		return pgtype.Date{}, socle.Problem(http.StatusBadRequest, "VENTES_DATE_INVALIDE", "La date de début est invalide.")
	}
	return dateSQL(date), nil
}

func dateSQL(date time.Time) pgtype.Date {
	return pgtype.Date{Time: date, Valid: true}
}

// Un numéro ou un nombre de lots hors bornes est une saisie aberrante : il vaut zéro.
func entier32(texte string) int32 {
	valeur := entier(texte)
	if valeur < 0 || valeur > math.MaxInt32 {
		return 0
	}
	return int32(valeur)
}

func jour(date pgtype.Date) string {
	return date.Time.Format(time.DateOnly)
}

func jourOuNul(date pgtype.Date) *string {
	if !date.Valid {
		return nil
	}
	texte := jour(date)
	return &texte
}
