package ventes

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
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

var (
	lecteurs      = socle.PermissionVentesLire
	gestionnaires = socle.PermissionVentesGerer
)

var Garde = map[string]socle.Permission{
	"GET /api/v1/ventes":                     lecteurs,
	"POST /api/v1/ventes":                    gestionnaires,
	"PATCH /api/v1/ventes/{id}":              gestionnaires,
	"POST /api/v1/ventes/{id}/versements":    gestionnaires,
	"DELETE /api/v1/ventes/{id}":             gestionnaires,
	"POST /api/v1/ventes/{id}/restaurer":     gestionnaires,
	"POST /api/v1/ventes/classeur":           gestionnaires,
	"GET /api/v1/ventes/classeur/fichier":    lecteurs,
	"GET /api/v1/ventes/configuration":       lecteurs,
	"POST /api/v1/ventes/sites":              gestionnaires,
	"PATCH /api/v1/ventes/sites/{id}":        gestionnaires,
	"POST /api/v1/ventes/sites/{id}/active":  gestionnaires,
	"POST /api/v1/ventes/canaux":             gestionnaires,
	"PATCH /api/v1/ventes/canaux/{id}":       gestionnaires,
	"POST /api/v1/ventes/canaux/{id}/active": gestionnaires,
}

const (
	codeIllisible = "VENTES_CLASSEUR_ILLISIBLE"
	origineImport = "IMPORT"
)

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "listVentes", Method: http.MethodGet, Path: "/api/v1/ventes",
		Summary: "Les ventes actives et leurs versements.",
	}, s.lister)
	huma.Register(api, huma.Operation{
		OperationID: "createVente", Method: http.MethodPost, Path: "/api/v1/ventes",
		DefaultStatus: http.StatusCreated, Summary: "Enregistre une vente saisie dans le panneau.",
	}, s.creer)
	huma.Register(api, huma.Operation{
		OperationID: "updateVente", Method: http.MethodPatch, Path: "/api/v1/ventes/{id}",
		Summary: "Corrige une vente.",
	}, s.corriger)
	huma.Register(api, huma.Operation{
		OperationID: "addVenteVersement", Method: http.MethodPost, Path: "/api/v1/ventes/{id}/versements",
		DefaultStatus: http.StatusCreated, Summary: "Ajoute un versement au détail d’une vente.",
	}, s.ajouterVersement)
	huma.Register(api, huma.Operation{
		OperationID: "archiveVente", Method: http.MethodDelete, Path: "/api/v1/ventes/{id}",
		DefaultStatus: http.StatusNoContent,
		Summary:       "Archive une vente sans supprimer son historique.",
	}, s.archiver)
	huma.Register(api, huma.Operation{
		OperationID: "restoreVente", Method: http.MethodPost, Path: "/api/v1/ventes/{id}/restaurer",
		Summary: "Restaure une vente archivée.",
	}, s.restaurer)
	huma.Register(api, huma.Operation{
		OperationID: "deposerClasseurVentes", Method: http.MethodPost, Path: "/api/v1/ventes/classeur",
		MaxBodyBytes: 20 << 20,
		Summary:      "Remplace le classeur des ventes, en ne gardant que les ventes souscrites depuis la date donnée.",
	}, s.deposer)
	huma.Register(api, huma.Operation{
		OperationID: "telechargerClasseurVentes", Method: http.MethodGet, Path: "/api/v1/ventes/classeur/fichier",
		Summary: "Le classeur déposé, tel quel.",
	}, s.telecharger)
	huma.Register(api, huma.Operation{
		OperationID: "listVentesConfiguration", Method: http.MethodGet, Path: "/api/v1/ventes/configuration",
		Summary: "Les sites et canaux proposés à la saisie.",
	}, s.configuration)
	monterConfiguration(api, s)
}

type VersementDTO struct {
	Date    string `json:"date"`
	Montant int64  `json:"montant"`
}

type VenteDTO struct {
	ID                 int64          `json:"id"`
	Origine            string         `json:"origine"`
	Numero             int32          `json:"numero"`
	Canal              string         `json:"canal"`
	DateSouscription   *string        `json:"dateSouscription"`
	Client             string         `json:"client"`
	Telephone          string         `json:"telephone"`
	Site               string         `json:"site"`
	NombreLots         int32          `json:"nombreLots"`
	NumerosLots        string         `json:"numerosLots"`
	Superficie         string         `json:"superficie"`
	PrixUnitaire       int64          `json:"prixUnitaire"`
	PrixTotal          int64          `json:"prixTotal"`
	Acompte            int64          `json:"acompte"`
	Reliquat           int64          `json:"reliquat"`
	ModePaiement       string         `json:"modePaiement"`
	NombreEcheances    *int32         `json:"nombreEcheances"`
	PeriodiciteMois    int32          `json:"periodiciteMois"`
	JourVersement      *int32         `json:"jourVersement"`
	PremierVersement   *string        `json:"premierVersement"`
	SoldeeManuellement bool           `json:"soldeeManuellement"`
	Soldee             bool           `json:"soldee"`
	PartProprietaire   int64          `json:"partProprietaire"`
	PartApporteur      int64          `json:"partApporteur"`
	PartCpi            int64          `json:"partCpi"`
	Versements         []VersementDTO `json:"versements"`
	IdentiteClientDTO
	ProspectID     *string `json:"prospectId"`
	Teleconseiller *string `json:"teleconseiller"`
	// Nul si le client n'a pas été amené par un parrainage Grand Public.
	Parrain *string `json:"parrain"`
}

// Le classement par téléconseiller jusqu'à qui a amené le client : seules les
// ventes rattachées à une fiche comptent, les autres n'ont pas d'auteur à créditer.
type IdentiteClientDTO struct {
	Email                  string  `json:"email"`
	NumeroCni              string  `json:"numeroCni"`
	DateDelivranceCni      *string `json:"dateDelivranceCni"`
	AutrePiece             string  `json:"autrePiece"`
	DemeurantA             string  `json:"demeurantA"`
	Profession             string  `json:"profession"`
	AdresseProfessionnelle string  `json:"adresseProfessionnelle"`
	Representant           string  `json:"representant"`
	NomTeleconseiller      string  `json:"nomTeleconseiller"`
	ResponsableClosing     string  `json:"responsableClosing"`
}

type VenteParTeleconseillerDTO struct {
	Nom       string `json:"nom"`
	Ventes    int32  `json:"ventes"`
	PrixTotal int64  `json:"prixTotal"`
}

type ClasseurDTO struct {
	NomFichier string  `json:"nomFichier"`
	Depuis     *string `json:"depuis"`
	ImporteLe  string  `json:"importeLe"`
	ImportePar string  `json:"importePar"`
}

type VentesOutput struct {
	Body struct {
		Classeur          *ClasseurDTO                `json:"classeur"`
		Ventes            []VenteDTO                  `json:"ventes"`
		Tronque           bool                        `json:"tronque" doc:"Vrai si seules les ventes les plus récentes sont renvoyées."`
		ParTeleconseiller []VenteParTeleconseillerDTO `json:"parTeleconseiller"`
	}
}

const plafondVentes = 5000

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
	out.Body.ParTeleconseiller = []VenteParTeleconseillerDTO{}
	classeur, err := s.Q.ClasseurVentes(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		classeur = db.ClasseurVentesRow{}
		err = nil
	}
	if err != nil {
		return nil, err
	}
	if classeur.ID != "" {
		out.Body.Classeur = &ClasseurDTO{
			NomFichier: classeur.NomFichier, Depuis: jourOuNul(classeur.Depuis),
			ImporteLe: classeur.ImporteLe.UTC().Format(time.RFC3339), ImportePar: classeur.ImportePar,
		}
	}
	ventes, err := s.Q.ListerVentes(ctx, plafondVentes+1)
	if err != nil {
		return nil, err
	}
	out.Body.Tronque = len(ventes) > plafondVentes
	ventes = ventes[:min(len(ventes), plafondVentes)]
	ids := make([]int64, len(ventes))
	for i := range ventes {
		ids[i] = ventes[i].ID
	}
	versements, err := s.Q.ListerVersementsVentes(ctx, ids)
	if err != nil {
		return nil, err
	}
	parVente := versementsParVente(versements)
	telephones, parLigne := telephonesNormalises(ventes, s.Cfg.PhoneRegion)
	prospects, err := s.prospectsParTelephones(ctx, telephones)
	if err != nil {
		return nil, err
	}
	for i := range ventes {
		dto := venteDTO(&ventes[i], parVente[ventes[i].ID])
		if p, ok := prospects[parLigne[i]]; parLigne[i] != "" && ok {
			dto.ProspectID, dto.Teleconseiller = &p.ID, p.Teleconseiller
			dto.Parrain = nomParrain(p.ParrainNom, p.ParrainPrenom)
		}
		out.Body.Ventes = append(out.Body.Ventes, dto)
	}
	out.Body.ParTeleconseiller = agregerParTeleconseiller(out.Body.Ventes)
	return out, nil
}

func versementsParVente(versements []db.VentesVersement) map[int64][]VersementDTO {
	parVente := map[int64][]VersementDTO{}
	for _, v := range versements {
		parVente[v.VenteId] = append(parVente[v.VenteId], VersementDTO{Date: jour(v.Date), Montant: v.Montant})
	}
	return parVente
}

// Le téléphone est la seule clé commune au classeur et aux fiches : une
// vente sans correspondance reste affichée, simplement sans lien ni auteur.
func telephonesNormalises(ventes []db.Vente, region string) (telephones, parLigne []string) {
	uniques := map[string]bool{}
	parLigne = make([]string, len(ventes))
	for i := range ventes {
		e164, err := database.NormaliserTelephone(ventes[i].Telephone, region)
		if err != nil {
			continue
		}
		parLigne[i] = e164
		uniques[e164] = true
	}
	telephones = make([]string, 0, len(uniques))
	for e164 := range uniques {
		telephones = append(telephones, e164)
	}
	return telephones, parLigne
}

func (s *service) prospectsParTelephones(ctx context.Context, telephones []string) (map[string]db.ProspectsVivantsParTelephonesRow, error) {
	parTelephone := map[string]db.ProspectsVivantsParTelephonesRow{}
	if len(telephones) == 0 {
		return parTelephone, nil
	}
	lignes, err := s.Q.ProspectsVivantsParTelephones(ctx, telephones)
	if err != nil {
		return nil, err
	}
	for _, l := range lignes {
		if l.PhoneE164 != nil {
			parTelephone[*l.PhoneE164] = l
		}
	}
	return parTelephone, nil
}

func nomParrain(nom, prenom *string) *string {
	if nom == nil {
		return nil
	}
	complet := strings.TrimSpace(strings.TrimSpace(deref(prenom)) + " " + *nom)
	if complet == "" {
		return nil
	}
	return &complet
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func agregerParTeleconseiller(ventes []VenteDTO) []VenteParTeleconseillerDTO {
	parNom := map[string]*VenteParTeleconseillerDTO{}
	for i := range ventes {
		v := &ventes[i]
		if v.Teleconseiller == nil {
			continue
		}
		ligne, existe := parNom[*v.Teleconseiller]
		if !existe {
			ligne = &VenteParTeleconseillerDTO{Nom: *v.Teleconseiller}
			parNom[*v.Teleconseiller] = ligne
		}
		ligne.Ventes++
		ligne.PrixTotal += v.PrixTotal
	}
	lignes := make([]VenteParTeleconseillerDTO, 0, len(parNom))
	for _, ligne := range parNom {
		lignes = append(lignes, *ligne)
	}
	sort.Slice(lignes, func(i, j int) bool { return lignes[i].PrixTotal > lignes[j].PrixTotal })
	return lignes
}

func marquerProspectsVendus(ctx context.Context, q *db.Queries, userID string, telephones []string) error {
	if len(telephones) == 0 {
		return nil
	}
	prospects, err := q.ProspectsVivantsParTelephones(ctx, telephones)
	if err != nil {
		return err
	}
	// Une vente validée vaut conversion : la fiche passe vendue quel que soit son statut.
	for _, p := range prospects {
		lignes, err := q.MarquerProspectVendu(ctx, p.ID)
		if err != nil {
			return err
		}
		if lignes == 0 {
			continue
		}
		if err := q.MarquerParcoursVendu(ctx, p.ID); err != nil {
			return err
		}
		if err := database.Auditer(ctx, q, userID, "prospect.vendre", "prospect", p.ID,
			map[string]any{"statut": string(p.Statut)},
			map[string]any{"statut": string(db.ProspectStatutVENDU)}); err != nil {
			return err
		}
	}
	return nil
}

func venteDTO(v *db.Vente, versements []VersementDTO) VenteDTO {
	if versements == nil {
		versements = []VersementDTO{}
	}
	encaisse := v.Acompte
	for _, versement := range versements {
		encaisse += versement.Montant
	}
	return VenteDTO{
		ID: v.ID, Origine: v.Origine, Numero: v.Numero, Canal: v.Canal, DateSouscription: jourOuNul(v.DateSouscription), Client: v.Client,
		Telephone: v.Telephone, Site: v.Site, NombreLots: v.NombreLots, NumerosLots: v.NumerosLots,
		Superficie: v.Superficie, PrixUnitaire: v.PrixUnitaire, PrixTotal: v.PrixTotal, Acompte: v.Acompte,
		Reliquat: v.Reliquat, ModePaiement: v.ModePaiement, NombreEcheances: v.NombreEcheances,
		PeriodiciteMois: v.PeriodiciteMois, JourVersement: v.JourVersement, PremierVersement: jourOuNul(v.PremierVersement),
		SoldeeManuellement: v.SoldeeManuellement, Soldee: v.SoldeeManuellement || encaisse >= v.PrixTotal,
		PartProprietaire: v.PartProprietaire,
		PartApporteur:    v.PartApporteur, PartCpi: v.PartCpi, Versements: versements,
		IdentiteClientDTO: IdentiteClientDTO{
			Email: v.Email, NumeroCni: v.NumeroCni, DateDelivranceCni: jourOuNul(v.DateDelivranceCni),
			AutrePiece: v.AutrePiece, DemeurantA: v.DemeurantA, Profession: v.Profession,
			AdresseProfessionnelle: v.AdresseProfessionnelle, Representant: v.Representant,
			NomTeleconseiller: v.NomTeleconseiller, ResponsableClosing: v.ResponsableClosing,
		},
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
	classeur := db.InsererClasseurVentesParams{
		ID: id.String(), NomFichier: nom, Contenu: contenu, Depuis: depuis,
		ImporteParId: socle.UtilisateurCourant(ctx).ID,
	}
	telephones := telephonesDesVentesLues(lues, s.Cfg.PhoneRegion)
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		return remplacerClasseur(ctx, s.Q.WithTx(tx), &classeur, lues, telephones)
	})
	if err != nil {
		return nil, err
	}
	return s.lister(ctx, nil)
}

func remplacerClasseur(ctx context.Context, q *db.Queries, classeur *db.InsererClasseurVentesParams, lues []venteLue, telephones []string) error {
	if err := q.VerrouNumerotationVentes(ctx); err != nil {
		return err
	}
	if err := refuserSiVersementsPerdus(ctx, q, lues); err != nil {
		return err
	}
	remplacees, err := supprimerVentesImportees(ctx, q)
	if err != nil {
		return err
	}
	if err := q.SupprimerClasseursVentes(ctx); err != nil {
		return err
	}
	if err := q.InsererClasseurVentes(ctx, *classeur); err != nil {
		return err
	}
	if err := insererVentes(ctx, q, classeur.ID, lues); err != nil {
		return err
	}
	if err := marquerProspectsVendus(ctx, q, classeur.ImporteParId, telephones); err != nil {
		return err
	}
	return database.Auditer(ctx, q, classeur.ImporteParId, "vente.importer", "vente_classeur", classeur.ID,
		map[string]any{"ventes": remplacees}, map[string]any{"fichier": classeur.NomFichier, "ventes": len(lues)})
}

func refuserSiVersementsPerdus(ctx context.Context, q *db.Queries, lues []venteLue) error {
	var dansLeClasseur db.VentesAuxVersementsAbsentsDuClasseurParams
	for i := range lues {
		for _, versement := range lues[i].versements {
			dansLeClasseur.Numeros = append(dansLeClasseur.Numeros, lues[i].ligne.Numero)
			dansLeClasseur.Dates = append(dansLeClasseur.Dates, dateSQL(versement.date))
			dansLeClasseur.Montants = append(dansLeClasseur.Montants, versement.montant)
		}
	}
	numeros, err := q.VentesAuxVersementsAbsentsDuClasseur(ctx, dansLeClasseur)
	if err != nil || len(numeros) == 0 {
		return err
	}
	liste := make([]string, len(numeros))
	for i, numero := range numeros {
		liste[i] = strconv.Itoa(int(numero))
	}
	return socle.Problem(http.StatusConflict, "VENTES_VERSEMENTS_HORS_CLASSEUR", fmt.Sprintf(
		"Des versements saisis dans le panneau manquent à ce classeur, ventes n° %s : reportez-les dans l’onglet « Échéances », puis déposez-le à nouveau.",
		strings.Join(liste, ", ")))
}

func supprimerVentesImportees(ctx context.Context, q *db.Queries) ([]VenteDTO, error) {
	versements, err := q.SupprimerVersementsVentesImportees(ctx)
	if err != nil {
		return nil, err
	}
	ventes, err := q.SupprimerVentesImportees(ctx)
	if err != nil {
		return nil, err
	}
	parVente := versementsParVente(versements)
	remplacees := make([]VenteDTO, len(ventes))
	for i := range ventes {
		remplacees[i] = venteDTO(&ventes[i], parVente[ventes[i].ID])
	}
	return remplacees, nil
}

func telephonesDesVentesLues(lues []venteLue, region string) []string {
	uniques := map[string]bool{}
	for i := range lues {
		e164, err := database.NormaliserTelephone(lues[i].ligne.Telephone, region)
		if err != nil || uniques[e164] {
			continue
		}
		uniques[e164] = true
	}
	telephones := make([]string, 0, len(uniques))
	for e164 := range uniques {
		telephones = append(telephones, e164)
	}
	return telephones
}

func insererVentes(ctx context.Context, q *db.Queries, classeurID string, lues []venteLue) error {
	for i := range lues {
		v := &lues[i]
		v.ligne.ClasseurId = &classeurID
		v.ligne.Origine = origineImport
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
	versements, err := lireVersements(echeances)
	if err != nil {
		return nil, err
	}
	lignes, err := lireVentes(ventes)
	if err != nil {
		return nil, err
	}
	lues := []venteLue{}
	for i := range lignes {
		date := lignes[i].DateSouscription
		if depuis.Valid && (!date.Valid || date.Time.Before(depuis.Time)) {
			continue
		}
		lues = append(lues, venteLue{ligne: lignes[i], versements: versements[lignes[i].Numero]})
	}
	// Un dépôt qui ne garde rien remplacerait le classeur en place par un tableau vide.
	if len(lues) == 0 {
		return nil, socle.Problem(http.StatusBadRequest, "VENTES_AUCUNE_VENTE", aucuneVente(lignes, depuis))
	}
	return lues, nil
}

func aucuneVente(lignes []db.InsererVenteParams, depuis pgtype.Date) string {
	var premiere, derniere time.Time
	for i := range lignes {
		date := lignes[i].DateSouscription
		if !date.Valid {
			continue
		}
		if premiere.IsZero() || date.Time.Before(premiere) {
			premiere = date.Time
		}
		if date.Time.After(derniere) {
			derniere = date.Time
		}
	}
	if !depuis.Valid || premiere.IsZero() {
		return "Aucune vente lue dans l’onglet « Tableau des ventes »."
	}
	return fmt.Sprintf("Aucune vente souscrite depuis le %s : ce classeur va du %s au %s.",
		depuis.Time.Format("02/01/2006"), premiere.Format("02/01/2006"), derniere.Format("02/01/2006"))
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

var colonnesMontants = []string{
	"PRIX VENTE UNITAIRE", "PRIX TOTAL", "ACOMPTE VERSE", "RELIQUAT", "PART PROPRIETAIRE", "PART APPORTEUR", "PART CPI",
}

func lireVentes(lignes [][]string) ([]db.InsererVenteParams, error) {
	ventes := []db.InsererVenteParams{}
	var col map[string]int
	for n, ligne := range lignes {
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
		if nom, illisible := montantIllisible(ligne, col); illisible {
			return nil, montantRefuse(fmt.Sprintf("Onglet « Tableau des ventes », ligne %d, colonne « %s »", n+1, nom), cellule(nom))
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
	return ventes, nil
}

func montantIllisible(ligne []string, col map[string]int) (string, bool) {
	for _, nom := range colonnesMontants {
		if !montantLisible(celluleA(ligne, col[nom])) {
			return nom, true
		}
	}
	return "", false
}

// « 1 500 000 » saisi en texte serait lu zéro : mieux vaut refuser le dépôt.
func montantLisible(texte string) bool {
	if montantVide(texte) {
		return true
	}
	_, err := strconv.ParseFloat(strings.TrimSpace(texte), 64)
	return err == nil
}

// Le classeur écrit « - » ou « #N/A » là où il n'y a rien à compter.
func montantVide(texte string) bool {
	switch strings.TrimSpace(texte) {
	case "", "-", "#N/A":
		return true
	}
	return false
}

func montantRefuse(ou, valeur string) error {
	return socle.Problem(http.StatusBadRequest, "VENTES_MONTANT_ILLISIBLE", fmt.Sprintf(
		"%s : le montant « %s » n’est pas un nombre. Saisissez-le sans espace ni séparateur, puis déposez à nouveau le classeur.",
		ou, strings.TrimSpace(valeur)))
}

// Une ligne d'échéances : numéro de la vente, client, téléphone, puis des
// paires date et montant. « SOLDE » à la place de la première date : rien à suivre.
func lireVersements(lignes [][]string) (map[int32][]versementLu, error) {
	parVente := map[int32][]versementLu{}
	for n, ligne := range lignes {
		numero := entier32(celluleA(ligne, 0))
		if numero == 0 {
			continue
		}
		for i := 3; i+1 < len(ligne); i += 2 {
			date, ok := dateExcel(ligne[i])
			if !ok || montantVide(ligne[i+1]) {
				continue
			}
			if !montantLisible(ligne[i+1]) {
				return nil, montantRefuse(fmt.Sprintf("Onglet « Échéances », ligne %d", n+1), ligne[i+1])
			}
			parVente[numero] = append(parVente[numero], versementLu{date: date, montant: entier(ligne[i+1])})
		}
	}
	return parVente, nil
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
