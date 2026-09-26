package accueil

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

const (
	importMaxOctets      = 25 * 1024 * 1024
	importTTL            = 24 * time.Hour
	importMaxLignes      = 20000
	importMaxDifferences = 5000
	importMaxErreurs     = 200
	importFeuille        = "Registre"
	importPremiereLigne  = 3
	appliquerDelai       = 60 * time.Second

	enteteNumero               = "N° REGISTRE"
	EnteteDate                 = "DATE VISITE"
	EnteteHeure                = "HEURE VISITE"
	EnteteNom                  = "PRENOM ET NOMS"
	enteteTelephone            = "TELEPHONES"
	enteteEntreprise           = "ENTREPRISE"
	enteteDirection            = "DIRECTION"
	EnteteDestinataire         = "DESTINATAIRES"
	enteteObjet                = "OBJET VISITE"
	EnteteObjetMalOrthographie = "OBJECT VISITE"
	enteteCommentaire          = "COMMENTAIRES / NOTES"

	celluleFeuille = "#feuille"
	celluleLigne   = "#ligne"

	codeNumeroInconnu = "VISITE_IMPORT_REGISTRE_NUMERO_INCONNU"
	codeIllisible     = "IMPORT_FILE_UNREADABLE"
	codeColonnes      = "VISITE_IMPORT_COLONNES_DECALEES"
)

// L'aller-retour Excel du registre : la directrice exporte, corrige dans le
// classeur, redépose. `N° REGISTRE` vide = création ; renseigné et inconnu =
// ligne REFUSÉE, jamais repliée sur une création.
var enTetesRegistre = []struct {
	cle, entete string
	obligatoire bool
	alias       []string
}{
	{"numero", enteteNumero, false, nil},
	{champDate, EnteteDate, true, nil},
	{champHeure, EnteteHeure, false, nil},
	{champNom, EnteteNom, true, nil},
	{champTelephone, enteteTelephone, false, nil},
	{champEntreprise, enteteEntreprise, true, nil},
	{champDirection, enteteDirection, false, nil},
	{champDestinataire, EnteteDestinataire, false, nil},
	{champObjet, enteteObjet, true, []string{EnteteObjetMalOrthographie}},
	{champCommentaire, enteteCommentaire, false, nil},
	{"saisieLe", "SAISIE LE", false, nil},
}

// Les colonnes comparées, dans l'ordre du classeur.
var champsCompares = []string{
	champDate, champHeure, champNom, champTelephone, champEntreprise,
	champDirection, champDestinataire, champObjet, champCommentaire,
}

var libellesChamps = map[string]string{
	champDate: EnteteDate, champHeure: EnteteHeure, champNom: EnteteNom,
	champTelephone: enteteTelephone, champEntreprise: enteteEntreprise, champDirection: enteteDirection,
	champDestinataire: EnteteDestinataire, champObjet: enteteObjet, champCommentaire: enteteCommentaire,
}

var listesRegistre = map[string]string{
	champEntreprise: "ENTREPRISES", champDirection: "DIRECTIONS &/OU NIVEAU",
	champDestinataire: EnteteDestinataire, champObjet: "OBJECT VISITE",
}

var codesInconnu = map[string]string{
	champEntreprise: "VISITE_IMPORT_ENTREPRISE_INCONNUE", champDirection: "VISITE_IMPORT_DIRECTION_INCONNUE",
	champDestinataire: "VISITE_IMPORT_DESTINATAIRE_INCONNU", champObjet: "VISITE_IMPORT_OBJET_INCONNU",
}

var (
	dateFR       = regexp.MustCompile(`^(\d{1,2})/(\d{1,2})/(\d{4})$`)
	dateISO      = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}`)
	heureMinute  = regexp.MustCompile(`^(\d{1,2})\s*[h:]\s*(\d{2})\s*[hH]?$`)
	heureSeule   = regexp.MustCompile(`^(\d{1,2})\s*[hH]?$`)
	ressembleTel = regexp.MustCompile(`^\+?\d[\d\s.-]{5,}$`)
)

type ImportJobSortie struct {
	ID            string         `json:"id"`
	Kind          string         `json:"kind"`
	Status        string         `json:"status"`
	Mode          string         `json:"mode"`
	RequestedByID string         `json:"requestedById"`
	FileName      string         `json:"fileName"`
	FileBytes     int32          `json:"fileBytes"`
	TotalRows     *int32         `json:"totalRows"`
	ProcessedRows int32          `json:"processedRows"`
	CreatedRows   int32          `json:"createdRows"`
	UpdatedRows   int32          `json:"updatedRows"`
	SkippedRows   int32          `json:"skippedRows"`
	ErrorRows     int32          `json:"errorRows"`
	Report        *RapportImport `json:"report"`
	FailureCode   *string        `json:"failureCode"`
	FailureMsg    *string        `json:"failureMsg"`
	StartedAt     *string        `json:"startedAt"`
	FinishedAt    *string        `json:"finishedAt"`
	ExpiresAt     string         `json:"expiresAt"`
	CreatedAt     string         `json:"createdAt"`
	UpdatedAt     string         `json:"updatedAt"`
}

type ErreurLigneRegistre struct {
	RowNumber int     `json:"rowNumber"`
	Column    *string `json:"column"`
	Code      string  `json:"code"`
	Message   string  `json:"message"`
}

type RapportImport struct {
	Kind              string                `json:"kind"`
	Mode              string                `json:"mode"`
	TotalRows         int                   `json:"totalRows"`
	ProcessedRows     int                   `json:"processedRows"`
	CreatedRows       int                   `json:"createdRows"`
	UpdatedRows       int                   `json:"updatedRows"`
	SkippedRows       int                   `json:"skippedRows"`
	ErrorRows         int                   `json:"errorRows"`
	Truncated         bool                  `json:"truncated"`
	MaxReportedErrors int                   `json:"maxReportedErrors"`
	Errors            []ErreurLigneRegistre `json:"errors"`
}

type ChampChangeImport struct {
	Field  string `json:"field"`
	Label  string `json:"label"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type ChangeImportSortie struct {
	ID        string              `json:"id"`
	Sheet     string              `json:"sheet"`
	RowNumber int32               `json:"rowNumber"`
	Kind      string              `json:"kind"`
	Reference *string             `json:"reference"`
	VisiteID  *string             `json:"visiteId"`
	Label     string              `json:"label"`
	Fields    []ChampChangeImport `json:"fields"`
	Selected  bool                `json:"selected"`
}

type ImportRegistreOutput struct {
	Body ImportJobSortie
}

func monterAccueilImport(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "createVisitesRegistreImport", Method: http.MethodPost, Path: "/api/v1/visites/import",
		DefaultStatus: http.StatusCreated, MaxBodyBytes: importMaxOctets,
		Summary: "Dépose le classeur du registre exporté puis corrigé, et détecte les différences.",
	}, s.deposerImportRegistre)
	huma.Register(api, huma.Operation{
		OperationID: "getVisitesRegistreImport", Method: http.MethodGet, Path: "/api/v1/visites/import/{id}",
		Summary: "État du travail, et son rapport quand il est terminé.",
	}, s.etatImportRegistre)
	huma.Register(api, huma.Operation{
		OperationID: "getVisitesRegistreImportRevue", Method: http.MethodGet, Path: "/api/v1/visites/import/{id}/revue",
		Summary: "Les différences détectées, page par page.",
	}, s.revueImportRegistre)
	huma.Register(api, huma.Operation{
		OperationID: "setVisitesRegistreImportSelection", Method: http.MethodPatch, Path: "/api/v1/visites/import/{id}/revue",
		Summary: "Coche ou décoche les lignes désignées.",
	}, s.selectionImportRegistre)
	huma.Register(api, huma.Operation{
		OperationID: "applyVisitesRegistreImport", Method: http.MethodPost, Path: "/api/v1/visites/import/{id}/apply",
		Summary: "Applique la revue : le même fichier est relu, et ce qui reste coché est écrit.",
	}, s.appliquerImportRegistre)
}

type DepotRegistreInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"true"`
	}]
}

// Jamais un nom client dans un chemin : le fichier porte l'identifiant du
// travail, ouvert sous une racine que la traversée ne peut pas quitter.
func rangerClasseur(jobID string, contenu []byte) (string, error) {
	dossier := socle.Env("IMPORTS_DIR", "./storage/imports")
	if err := os.MkdirAll(dossier, 0o700); err != nil {
		return "", err
	}
	racine, err := os.OpenRoot(dossier)
	if err != nil {
		return "", err
	}
	defer func() { _ = racine.Close() }()
	nom := jobID + ".xlsx"
	cible, err := racine.OpenFile(nom, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", err
	}
	if _, err := cible.Write(contenu); err != nil {
		_ = cible.Close()
		return "", err
	}
	if err := cible.Close(); err != nil {
		return "", err
	}
	return filepath.Join(dossier, nom), nil
}

func lireClasseurRange(chemin string) ([]byte, error) {
	racine, err := os.OpenRoot(filepath.Dir(chemin))
	if err != nil {
		return nil, err
	}
	defer func() { _ = racine.Close() }()
	fichier, err := racine.Open(filepath.Base(chemin))
	if err != nil {
		return nil, err
	}
	defer func() { _ = fichier.Close() }()
	return io.ReadAll(fichier)
}

func (s *service) deposerImportRegistre(ctx context.Context, in *DepotRegistreInput) (*ImportRegistreOutput, error) {
	fichier := in.RawBody.Data().File
	contenu, err := io.ReadAll(fichier)
	if err != nil {
		return nil, err
	}
	// Le type déclaré par le client ne prouve rien : un xlsx est une archive ZIP
	// que excelize doit savoir ouvrir (audits/go-securite.md §3).
	if !bytes.HasPrefix(contenu, []byte("PK\x03\x04")) {
		return nil, socle.Problem(http.StatusBadRequest, codeIllisible, "Ce fichier n’est pas un classeur Excel.")
	}
	classeur, err := excelize.OpenReader(bytes.NewReader(contenu))
	if err != nil {
		return nil, socle.Problem(http.StatusBadRequest, codeIllisible, "Ce classeur ne peut pas être lu.")
	}
	if err := classeur.Close(); err != nil {
		return nil, err
	}

	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	chemin, err := rangerClasseur(id.String(), contenu)
	if err != nil {
		return nil, err
	}

	// Le nom d'origine est conservé POUR ÊTRE AFFICHÉ, jamais joint à un chemin.
	nom := fichier.Filename
	if nom == "" {
		nom = "import.xlsx"
	}
	err = s.Q.InsererImportRegistre(ctx, db.InsererImportRegistreParams{
		ID: id.String(), RequestedById: socle.UtilisateurCourant(ctx).ID,
		FileName: tronquerRegistre(nom, 255), FileBytes: entier32(len(contenu)),
		StoragePath: chemin, ExpiresAt: time.Now().Add(importTTL),
	})
	if err != nil {
		_ = os.Remove(chemin)
		return nil, err
	}
	s.Live.Emettre("imports")

	if err := s.simulerImportRegistre(ctx, id.String(), contenu); err != nil {
		return nil, err
	}
	s.Live.Emettre("imports")
	return s.etatImportRegistre(ctx, &IDImportRegistreInput{ID: id.String()})
}

type IDImportRegistreInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) etatImportRegistre(ctx context.Context, in *IDImportRegistreInput) (*ImportRegistreOutput, error) {
	job, err := s.travailRegistre(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &ImportRegistreOutput{Body: versImportJobSortie(&job)}, nil
}

// 404 et jamais 403 : un import d'une autre nature ne doit même pas se laisser deviner.
func (s *service) travailRegistre(ctx context.Context, id string) (db.ImportJob, error) {
	job, err := s.Q.ImportRegistre(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return job, socle.Problem(http.StatusNotFound, "IMPORT_JOB_NOT_FOUND", "Ce travail d’import n’existe pas.")
	}
	return job, err
}

func versImportJobSortie(job *db.ImportJob) ImportJobSortie {
	sortie := ImportJobSortie{
		ID: job.ID, Kind: string(job.Kind), Status: string(job.Status), Mode: string(job.Mode),
		RequestedByID: job.RequestedById, FileName: job.FileName, FileBytes: job.FileBytes,
		TotalRows: job.TotalRows, ProcessedRows: job.ProcessedRows, CreatedRows: job.CreatedRows,
		UpdatedRows: job.UpdatedRows, SkippedRows: job.SkippedRows, ErrorRows: job.ErrorRows,
		FailureCode: job.FailureCode, FailureMsg: job.FailureMsg,
		ExpiresAt: instantRegistre(job.ExpiresAt), CreatedAt: instantRegistre(job.CreatedAt), UpdatedAt: instantRegistre(job.UpdatedAt),
	}
	if job.StartedAt != nil {
		debut := instantRegistre(*job.StartedAt)
		sortie.StartedAt = &debut
	}
	if job.FinishedAt != nil {
		fin := instantRegistre(*job.FinishedAt)
		sortie.FinishedAt = &fin
	}
	if len(job.Report) > 0 {
		var rapport RapportImport
		if json.Unmarshal(job.Report, &rapport) == nil {
			sortie.Report = &rapport
		}
	}
	return sortie
}

type RevueInput struct {
	ID       string `path:"id" format:"uuid"`
	Page     int    `query:"page" minimum:"1" default:"1"`
	PageSize int    `query:"pageSize" minimum:"1" maximum:"500" default:"50"`
}

type RevueOutput struct {
	Body struct {
		Items []ChangeImportSortie `json:"items"`
		Meta  PageRegistre         `json:"meta"`
	}
}

func (s *service) revueImportRegistre(ctx context.Context, in *RevueInput) (*RevueOutput, error) {
	if _, err := s.travailRegistre(ctx, in.ID); err != nil {
		return nil, err
	}
	total, err := s.Q.CompterVisiteImportChanges(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListerVisiteImportChanges(ctx, db.ListerVisiteImportChangesParams{
		ImportJobId: in.ID, Limit: entier32(in.PageSize), Offset: entier32((in.Page - 1) * in.PageSize),
	})
	if err != nil {
		return nil, err
	}
	out := &RevueOutput{}
	out.Body.Items = []ChangeImportSortie{}
	for index := range rows {
		row := &rows[index]
		out.Body.Items = append(out.Body.Items, ChangeImportSortie{
			ID: row.ID, Sheet: row.Sheet, RowNumber: row.RowNumber, Kind: string(row.Kind),
			Reference: row.Reference, VisiteID: row.VisiteId, Label: row.Label,
			Fields: champsDuChange(row.Fields), Selected: row.Selected,
		})
	}
	out.Body.Meta = PageRegistre{
		Total: int(total), Page: in.Page, PageSize: in.PageSize,
		PageCount: max(1, (int(total)+in.PageSize-1)/in.PageSize),
	}
	return out, nil
}

func champsDuChange(brut []byte) []ChampChangeImport {
	champs := []ChampChangeImport{}
	if json.Unmarshal(brut, &champs) != nil {
		return []ChampChangeImport{}
	}
	return champs
}

type SelectionInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IDs      []string `json:"ids" minItems:"1" maxItems:"5000" format:"uuid"`
		Selected bool     `json:"selected"`
	}
}

type OkRegistreOutput struct {
	Body struct {
		Ok bool `json:"ok"`
	}
}

func (s *service) selectionImportRegistre(ctx context.Context, in *SelectionInput) (*OkRegistreOutput, error) {
	if _, err := s.travailRegistre(ctx, in.ID); err != nil {
		return nil, err
	}
	err := s.Q.SelectionnerVisiteImportChanges(ctx, db.SelectionnerVisiteImportChangesParams{
		ImportJobId: in.ID, Selected: in.Body.Selected, Ids: in.Body.IDs,
	})
	if err != nil {
		return nil, err
	}
	out := &OkRegistreOutput{}
	out.Body.Ok = true
	return out, nil
}

type ligneRegistre struct {
	numeroLigne  int
	feuille      string
	reference    string
	date         string
	heure        string
	nom          string
	telephone    string
	phoneE164    *string
	entreprise   entreeRef
	objet        entreeRef
	direction    *entreeRef
	destinataire *entreeRef
	commentaire  string
}

type entreeRef struct {
	id    string
	label string
}

type refsVisite struct {
	index         map[string]map[string]entreeRef
	proprietaires map[string]string
}

func (l *ligneRegistre) champs() map[string]string {
	champs := map[string]string{
		champDate: l.date, champHeure: l.heure, champNom: l.nom, champTelephone: l.telephone,
		champEntreprise: l.entreprise.label, champObjet: l.objet.label, champCommentaire: l.commentaire,
		champDirection: "", champDestinataire: "",
	}
	if l.direction != nil {
		champs[champDirection] = l.direction.label
	}
	if l.destinataire != nil {
		champs[champDestinataire] = l.destinataire.label
	}
	return champs
}

func (l *ligneRegistre) etiquette() string {
	jour := l.date[8:10] + "/" + l.date[5:7]
	if l.heure == "" {
		return l.nom + ", " + jour + "/" + l.date[0:4]
	}
	return l.nom + ", " + jour + " " + l.heure
}

func champsVisite(v *db.VisitesParReferencesRow, tz *time.Location) map[string]string {
	mural := v.VisitedAt.In(tz)
	heure := ""
	if v.TimeKnown {
		heure = mural.Format("15:04")
	}
	return map[string]string{
		champDate: mural.Format("2006-01-02"), champHeure: heure, champNom: v.VisitorName,
		champTelephone: derefTexte(v.Phone), champEntreprise: v.EntrepriseLabel,
		champDirection: derefTexte(v.DirectionLabel), champDestinataire: derefTexte(v.DestinataireLabel),
		champObjet: v.ObjetLabel, champCommentaire: derefTexte(v.Comment),
	}
}

func differences(avant, apres map[string]string) []ChampChangeImport {
	diffs := []ChampChangeImport{}
	for _, champ := range champsCompares {
		if avant[champ] != apres[champ] {
			diffs = append(diffs, ChampChangeImport{
				Field: champ, Label: libellesChamps[champ], Before: avant[champ], After: apres[champ],
			})
		}
	}
	return diffs
}

func empreinteChamps(champs map[string]string) string {
	cles := append([]string(nil), champsCompares...)
	sort.Strings(cles)
	morceaux := make([]string, 0, len(cles))
	for _, cle := range cles {
		morceaux = append(morceaux, cle+"="+champs[cle])
	}
	somme := sha256.Sum256([]byte(strings.Join(morceaux, "|")))
	return hex.EncodeToString(somme[:])
}

func (s *service) chargerRefsVisite(ctx context.Context) (refsVisite, error) {
	refs := refsVisite{index: map[string]map[string]entreeRef{}, proprietaires: map[string]string{}}
	rows, err := s.Q.ListerReferentielsVisite(ctx, true)
	if err != nil {
		return refs, err
	}
	kinds := map[string]string{
		listeEntreprises: champEntreprise, listeDirections: champDirection,
		listeDestinataires: champDestinataire, listeObjets: champObjet,
	}
	proprios := map[string]string{
		listeEntreprises: listeEntreprises, listeDirections: listeDirections,
		listeDestinataires: listeDestinataires, listeObjets: "objets de visite",
	}
	for _, row := range rows {
		kind := kinds[row.Kind]
		if refs.index[kind] == nil {
			refs.index[kind] = map[string]entreeRef{}
		}
		for _, cle := range []string{normaliserCle(row.Label), normaliserCle(row.Code)} {
			if cle == "" {
				continue
			}
			refs.index[kind][cle] = entreeRef{id: row.ID, label: row.Label}
			if _, vu := refs.proprietaires[cle]; !vu {
				refs.proprietaires[cle] = proprios[row.Kind]
			}
		}
	}
	return refs, nil
}

// Ce que la cellule contient VRAIMENT : dire « inconnu » ferait chercher une
// entrée à ajouter alors que la ligne est décalée d'un cran.
func (r refsVisite) motifAbsence(brut, kind string) (code, message string) {
	if brut == "" {
		return codesInconnu[kind], "la colonne " + listesRegistre[kind] + " est vide, elle est obligatoire."
	}
	if ressembleTel.MatchString(brut) {
		quoi := "une " + kind
		if kind == "objet" {
			quoi = "un objet de visite"
		}
		return "VISITE_IMPORT_COLONNES_DECALEES",
			"« " + brut + " » est un numéro de téléphone, pas " + quoi + ". Les colonnes de cette ligne sont décalées."
	}
	if proprio, vu := r.proprietaires[normaliserCle(brut)]; vu {
		return "VISITE_IMPORT_COLONNES_DECALEES",
			"« " + brut + " » appartient à la liste des " + proprio + ", pas à " + listesRegistre[kind] + ". Les colonnes de cette ligne sont décalées."
	}
	return codesInconnu[kind],
		"« " + brut + " » ne figure pas dans la liste " + listesRegistre[kind] + ". Corrigez la cellule, ou ajoutez l’entrée à la liste avant de relancer."
}

func lireDateRegistre(brut string) string {
	coupe := strings.TrimSpace(brut)
	if dateISO.MatchString(coupe) {
		return dateExistante(coupe[:10])
	}
	if m := dateFR.FindStringSubmatch(coupe); m != nil {
		jour, _ := strconv.Atoi(m[1])
		mois, _ := strconv.Atoi(m[2])
		return dateExistante(m[3] + "-" + pad2(mois) + "-" + pad2(jour))
	}
	// Le classeur porte des dates numériques : le rang Excel, styles ignorés.
	if rang, err := strconv.Atoi(coupe); err == nil && rang >= 61 && rang <= 2958465 {
		return time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC).AddDate(0, 0, rang).Format("2006-01-02")
	}
	return ""
}

// « 31/04 » a la forme d'une date sans en être une.
func dateExistante(iso string) string {
	if _, err := time.Parse(time.DateOnly, iso); err != nil {
		return ""
	}
	return iso
}

// Une heure retapée devient une fraction de journée sous la plume d'Excel :
// `0,604166…` pour 14:30. Essayée EN PREMIER.
func lireHeureRegistre(brut string) string {
	coupe := strings.TrimSpace(brut)
	if strings.ContainsAny(coupe, ".,") {
		if fraction, err := strconv.ParseFloat(strings.ReplaceAll(coupe, ",", "."), 64); err == nil && fraction >= 0 && fraction < 1 {
			minutes := min(int(fraction*1440+0.5), 1439)
			return pad2(minutes/60) + ":" + pad2(minutes%60)
		}
	}
	if m := heureMinute.FindStringSubmatch(coupe); m != nil {
		heure, _ := strconv.Atoi(m[1])
		minute, _ := strconv.Atoi(m[2])
		if heure < 24 && minute < 60 {
			return pad2(heure) + ":" + pad2(minute)
		}
		return ""
	}
	if m := heureSeule.FindStringSubmatch(coupe); m != nil {
		if heure, _ := strconv.Atoi(m[1]); heure < 24 {
			return pad2(heure) + ":00"
		}
	}
	return ""
}

func pad2(valeur int) string {
	if valeur < 10 {
		return "0" + strconv.Itoa(valeur)
	}
	return strconv.Itoa(valeur)
}

type classeurError struct{ raison string }

func (e classeurError) Error() string { return e.raison }

// Les colonnes sont retrouvées par leur en-tête, ONGLET PAR ONGLET : le
// classeur de l'accueil gagne des colonnes en cours d'année.
func lireLignesClasseur(contenu []byte) ([]map[string]string, error) {
	// Sans ce motif, excelize rend une date au format court natif en « mm-dd-yy ».
	classeur, err := excelize.OpenReader(bytes.NewReader(contenu), excelize.Options{ShortDatePattern: "dd/mm/yyyy"})
	if err != nil {
		return nil, classeurError{"Ce classeur ne peut pas être lu."}
	}
	defer func() { _ = classeur.Close() }()

	noms := classeur.GetSheetList()
	lignes := []map[string]string{}
	apparies := 0
	for _, nom := range noms {
		if !strings.HasPrefix(strings.ToLower(nom), strings.ToLower(importFeuille)) {
			continue
		}
		apparies++
		projetees, err := projeterOnglet(classeur, nom)
		if err != nil {
			return nil, err
		}
		lignes = append(lignes, projetees...)
	}
	if apparies == 0 {
		return nil, classeurError{"Aucun onglet de ce classeur ne porte de données à importer. Onglets trouvés : " + strings.Join(noms, ", ") + "."}
	}
	if len(lignes) > importMaxLignes {
		return nil, classeurError{"Ce classeur dépasse " + strconv.Itoa(importMaxLignes) + " lignes."}
	}
	return lignes, nil
}

func projeterOnglet(classeur *excelize.File, nom string) ([]map[string]string, error) {
	rows, err := classeur.GetRows(nom)
	if err != nil {
		return nil, classeurError{"L’onglet « " + nom + " » ne peut pas être lu."}
	}
	if len(rows) == 0 {
		return nil, classeurError{"L’onglet « " + nom + " » n’a pas de ligne 1 : ses colonnes sont introuvables."}
	}
	positions, err := positionsColonnes(rows[0], nom)
	if err != nil {
		return nil, err
	}
	lignes := make([]map[string]string, 0, len(rows))
	for index := importPremiereLigne - 1; index < len(rows); index++ {
		cellules := map[string]string{celluleFeuille: nom, celluleLigne: strconv.Itoa(index + 1)}
		vide := true
		for cle, position := range positions {
			valeur := ""
			if position >= 0 && position < len(rows[index]) {
				valeur = strings.TrimSpace(rows[index][position])
			}
			cellules[cle] = valeur
			if valeur != "" {
				vide = false
			}
		}
		if !vide {
			lignes = append(lignes, cellules)
		}
	}
	return lignes, nil
}

func positionsColonnes(entete []string, feuille string) (map[string]int, error) {
	trouves := map[string]int{}
	for position, cellule := range entete {
		cle := normaliserCle(cellule)
		if cle == "" {
			continue
		}
		if _, vu := trouves[cle]; !vu {
			trouves[cle] = position
		}
	}
	positions := map[string]int{}
	for _, colonne := range enTetesRegistre {
		position := -1
		for _, libelle := range append([]string{colonne.entete}, colonne.alias...) {
			if p, vu := trouves[normaliserCle(libelle)]; vu {
				position = p
				break
			}
		}
		if position < 0 && colonne.obligatoire {
			return nil, classeurError{"Onglet « " + feuille + " » : la colonne « " + colonne.entete + " » est introuvable en ligne 1."}
		}
		positions[colonne.cle] = position
	}
	return positions, nil
}

func (s *service) analyserLignes(cellules []map[string]string, refs refsVisite) ([]ligneRegistre, []ErreurLigneRegistre) {
	lignes := []ligneRegistre{}
	erreurs := []ErreurLigneRegistre{}
	refuser := func(numero int, colonne, code, message string) {
		entete := colonne
		erreurs = append(erreurs, ErreurLigneRegistre{RowNumber: numero, Column: &entete, Code: code, Message: message})
	}
	for _, c := range cellules {
		numero, _ := strconv.Atoi(c[celluleLigne])
		ligne, err := s.analyserLigne(c, numero, refs)
		if err != nil {
			refuser(numero, err.colonne, err.code, err.message)
			continue
		}
		lignes = append(lignes, ligne)
	}
	return lignes, erreurs
}

type refusLigne struct{ colonne, code, message string }

func (s *service) analyserLigne(c map[string]string, numero int, refs refsVisite) (ligneRegistre, *refusLigne) {
	var ligne ligneRegistre
	if c[champDate] == "" {
		return ligne, &refusLigne{EnteteDate, "VISITE_IMPORT_DATE_ABSENTE", "la date de la visite manque."}
	}
	date := lireDateRegistre(c[champDate])
	if date == "" {
		return ligne, &refusLigne{
			EnteteDate, "VISITE_IMPORT_DATE_ILLISIBLE",
			"« " + c[champDate] + " » n’est pas une date. Écrivez jj/mm/aaaa, ou laissez une vraie date Excel.",
		}
	}
	heure := ""
	if c[champHeure] != "" {
		if heure = lireHeureRegistre(c[champHeure]); heure == "" {
			return ligne, &refusLigne{
				EnteteHeure, "VISITE_IMPORT_HEURE_ILLISIBLE",
				"« " + c[champHeure] + " » ne se lit pas comme une heure. Écrivez 14:30, ou laissez vide.",
			}
		}
	}
	if len(c[champNom]) < 2 {
		return ligne, &refusLigne{EnteteNom, "VISITE_IMPORT_NOM_ABSENT", "le nom du visiteur manque."}
	}

	obligatoires := map[string]entreeRef{}
	for _, kind := range []string{"entreprise", "objet"} {
		entree, vu := refs.index[kind][normaliserCle(c[kind])]
		if !vu {
			code, message := refs.motifAbsence(c[kind], kind)
			return ligne, &refusLigne{libellesChamps[kind], code, message}
		}
		obligatoires[kind] = entree
	}
	facultatifs := map[string]*entreeRef{}
	for _, kind := range []string{"direction", "destinataire"} {
		if c[kind] == "" {
			continue
		}
		entree, vu := refs.index[kind][normaliserCle(c[kind])]
		if !vu {
			code, message := refs.motifAbsence(c[kind], kind)
			return ligne, &refusLigne{libellesChamps[kind], code, message}
		}
		facultatifs[kind] = &entreeRef{id: entree.id, label: entree.label}
	}

	telephone := tronquerRegistre(c[champTelephone], 40)
	return ligneRegistre{
		numeroLigne: numero, feuille: c[celluleFeuille], reference: c["numero"], date: date, heure: heure,
		nom: tronquerRegistre(c[champNom], 160), telephone: telephone,
		phoneE164:  database.TelephoneOptionnel(&telephone, s.Cfg.PhoneRegion),
		entreprise: obligatoires["entreprise"], objet: obligatoires["objet"],
		direction: facultatifs["direction"], destinataire: facultatifs["destinataire"],
		commentaire: tronquerRegistre(c[champCommentaire], 2000),
	}, nil
}

func tronquerRegistre(valeur string, taille int) string {
	runes := []rune(valeur)
	if len(runes) <= taille {
		return valeur
	}
	return string(runes[:taille])
}

// Calcule les différences et les PERSISTE : la revue doit survivre à la requête
// HTTP qui l'a demandée.
func (s *service) simulerImportRegistre(ctx context.Context, jobID string, contenu []byte) error {
	if err := s.Q.DemarrerImportRegistre(ctx, jobID); err != nil {
		return err
	}
	cellules, err := lireLignesClasseur(contenu)
	if err != nil {
		return s.echouerImport(ctx, jobID, codeIllisible, err.Error())
	}
	refs, err := s.chargerRefsVisite(ctx)
	if err != nil {
		return err
	}
	lignes, erreurs := s.analyserLignes(cellules, refs)

	existantes, err := visitesDesLignes(ctx, s.Q, lignes)
	if err != nil {
		return err
	}

	var creations, reecritures, identiques int
	for index := range lignes {
		verdict, err := s.detecterDifference(ctx, jobID, &lignes[index], existantes)
		if err != nil {
			return err
		}
		switch {
		case verdict.refus != nil:
			erreurs = append(erreurs, *verdict.refus)
		case verdict.creation:
			creations++
		case verdict.reecriture:
			reecritures++
		default:
			identiques++
		}
	}

	total, err := s.Q.CompterVisiteImportChanges(ctx, jobID)
	if err != nil {
		return err
	}
	if int(total) > importMaxDifferences {
		return s.echouerImport(ctx, jobID, "VISITE_IMPORT_REGISTRE_TROP_DE_DIFFERENCES",
			strconv.Itoa(int(total))+" différences détectées. Ce n’est plus une revue. Réexportez une période plus courte.")
	}
	return terminerImport(ctx, s.Q, jobID, "DRY_RUN", len(cellules), creations, reecritures, identiques, erreurs)
}

// Les visites que les numéros du classeur désignent, lues en un appel.
func visitesDesLignes(ctx context.Context, q *db.Queries, lignes []ligneRegistre) (map[string]db.VisitesParReferencesRow, error) {
	refsLues := make([]string, 0, len(lignes))
	for index := range lignes {
		if lignes[index].reference != "" {
			refsLues = append(refsLues, lignes[index].reference)
		}
	}
	return visitesParReferences(ctx, q, refsLues)
}

type verdictLigne struct {
	creation   bool
	reecriture bool
	refus      *ErreurLigneRegistre
}

func (s *service) detecterDifference(ctx context.Context, jobID string, ligne *ligneRegistre,
	existantes map[string]db.VisitesParReferencesRow,
) (verdictLigne, error) {
	apres := ligne.champs()
	if ligne.reference == "" {
		diffs := differences(map[string]string{}, apres)
		return verdictLigne{creation: true}, s.ecrireChange(ctx, jobID, ligne, db.VisiteImportChangeKindCREATE, nil, diffs, nil)
	}
	visite, vue := existantes[ligne.reference]
	if !vue {
		return verdictLigne{refus: refusRegistre(ligne, codeNumeroInconnu,
			"« "+ligne.reference+" » ne figure pas au registre. Vérifiez le numéro, ou laissez la colonne vide pour créer une visite.")}, nil
	}
	avant := champsVisite(&visite, s.Cfg.TimeZone)
	diffs := differences(avant, apres)
	if len(diffs) == 0 {
		return verdictLigne{}, nil
	}
	empreinte := empreinteChamps(avant)
	return verdictLigne{reecriture: true},
		s.ecrireChange(ctx, jobID, ligne, db.VisiteImportChangeKindUPDATE, &visite.ID, diffs, &empreinte)
}

func (s *service) ecrireChange(ctx context.Context, jobID string, ligne *ligneRegistre, kind db.VisiteImportChangeKind,
	visiteID *string, diffs []ChampChangeImport, empreinte *string,
) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	champs, err := json.Marshal(diffs)
	if err != nil {
		return err
	}
	var reference *string
	if ligne.reference != "" {
		reference = &ligne.reference
	}
	return s.Q.UpsertVisiteImportChange(ctx, db.UpsertVisiteImportChangeParams{
		ID: id.String(), ImportJobId: jobID, Sheet: ligne.feuille, RowNumber: entier32(ligne.numeroLigne),
		Kind: kind, Reference: reference, VisiteId: visiteID, Label: ligne.etiquette(),
		Fields: champs, RowHash: empreinte,
	})
}

func (s *service) echouerImport(ctx context.Context, jobID, code, message string) error {
	return s.Q.EchouerImportRegistre(ctx, db.EchouerImportRegistreParams{ID: jobID, FailureCode: &code, FailureMsg: &message})
}

func terminerImport(ctx context.Context, q *db.Queries, jobID, mode string,
	total, crees, reecrits, ignores int, erreurs []ErreurLigneRegistre,
) error {
	rapport := RapportImport{
		Kind: "VISITES_REGISTRE", Mode: mode, TotalRows: total, ProcessedRows: total,
		CreatedRows: crees, UpdatedRows: reecrits, SkippedRows: ignores, ErrorRows: len(erreurs),
		Truncated: len(erreurs) > importMaxErreurs, MaxReportedErrors: importMaxErreurs,
		Errors: erreurs[:min(len(erreurs), importMaxErreurs)],
	}
	corps, err := json.Marshal(rapport)
	if err != nil {
		return err
	}
	lignes := entier32(total)
	return q.TerminerImportRegistre(ctx, db.TerminerImportRegistreParams{
		ID: jobID, TotalRows: &lignes, ProcessedRows: lignes, CreatedRows: entier32(crees),
		UpdatedRows: entier32(reecrits), SkippedRows: entier32(ignores), ErrorRows: entier32(len(erreurs)), Report: corps,
	})
}

func entier32(valeur int) int32 {
	if valeur > math.MaxInt32 {
		return math.MaxInt32
	}
	if valeur < math.MinInt32 {
		return math.MinInt32
	}
	return int32(valeur)
}

// Relit le MÊME fichier et écrit ce qui reste coché, dans UNE transaction. Une
// correction faite au comptoir depuis la revue n'est jamais écrasée en silence.
func (s *service) appliquerImportRegistre(ctx context.Context, in *IDImportRegistreInput) (*ImportRegistreOutput, error) {
	job, err := s.travailRegistre(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	bascules, err := s.Q.BasculerImportRegistreEnApplication(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if bascules != 1 {
		return nil, socle.Problem(http.StatusConflict, "IMPORT_NOT_APPLICABLE",
			"Seule une simulation TERMINÉE et non échue peut être appliquée. Ce travail est « "+
				string(job.Status)+" » en mode « "+string(job.Mode)+" », et son échéance est le "+instantRegistre(job.ExpiresAt)+".")
	}
	s.Live.Emettre("imports")

	contenu, err := lireClasseurRange(job.StoragePath)
	if err != nil {
		if err := s.echouerImport(ctx, in.ID, codeIllisible, "Le classeur déposé n’est plus lisible."); err != nil {
			return nil, err
		}
		return s.etatImportRegistre(ctx, in)
	}

	borne, annuler := context.WithTimeout(ctx, appliquerDelai)
	defer annuler()
	if err := s.ecrireImportRegistre(borne, &job, contenu); err != nil {
		return nil, err
	}
	s.Live.Emettre("imports")
	return s.etatImportRegistre(ctx, in)
}

func (s *service) ecrireImportRegistre(ctx context.Context, job *db.ImportJob, contenu []byte) error {
	cellules, err := lireLignesClasseur(contenu)
	if err != nil {
		return s.echouerImport(ctx, job.ID, codeIllisible, err.Error())
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)

	refs, err := s.chargerRefsVisite(ctx)
	if err != nil {
		return err
	}
	lignes, erreurs := s.analyserLignes(cellules, refs)

	parLigne, refsCochees, err := changesDuJob(ctx, q, job.ID)
	if err != nil {
		return err
	}
	actuelles, err := visitesParReferences(ctx, q, refsCochees)
	if err != nil {
		return err
	}

	tri, err := s.trierLignesAAppliquer(ctx, q, job.RequestedById, lignes, parLigne, actuelles)
	if err != nil {
		return err
	}
	erreurs = append(erreurs, tri.refus...)
	crees, err := s.creerLignes(ctx, q, job.RequestedById, tri.aCreer)
	if err != nil {
		return err
	}
	ignores := tri.ignores + len(tri.aCreer) - crees

	if err := terminerImport(ctx, q, job.ID, "APPLY", len(cellules), crees, tri.reecrits, ignores, erreurs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Une passe sur le classeur relu : ce qui reste coché est réécrit tout de
// suite, les créations attendent l'allocation des références.
type triLignes struct {
	reecrits int
	ignores  int
	aCreer   []ligneRegistre
	refus    []ErreurLigneRegistre
}

func (s *service) trierLignesAAppliquer(ctx context.Context, q *db.Queries, auteur string, lignes []ligneRegistre,
	parLigne map[string]db.VisiteImportChange, actuelles map[string]db.VisitesParReferencesRow,
) (triLignes, error) {
	tri := triLignes{aCreer: []ligneRegistre{}, refus: []ErreurLigneRegistre{}}
	for index := range lignes {
		ligne := &lignes[index]
		change, vu := parLigne[ligne.feuille+" "+strconv.Itoa(ligne.numeroLigne)]
		if !vu || !change.Selected {
			tri.ignores++
			continue
		}
		if change.Kind == db.VisiteImportChangeKindCREATE {
			tri.aCreer = append(tri.aCreer, *ligne)
			continue
		}
		refuse, err := s.reecrireLigne(ctx, q, auteur, ligne, &change, actuelles)
		if err != nil {
			return tri, err
		}
		if refuse != nil {
			tri.refus = append(tri.refus, *refuse)
			continue
		}
		tri.reecrits++
	}
	return tri, nil
}

// La revue, indexée par sa ligne de classeur, et les numéros restés cochés.
func changesDuJob(ctx context.Context, q *db.Queries, jobID string) (parLigne map[string]db.VisiteImportChange, refsCochees []string, err error) {
	changes, err := q.VisiteImportChangesDuJob(ctx, jobID)
	if err != nil {
		return nil, nil, err
	}
	parLigne = make(map[string]db.VisiteImportChange, len(changes))
	refsCochees = make([]string, 0, len(changes))
	for index := range changes {
		change := &changes[index]
		parLigne[change.Sheet+" "+strconv.Itoa(int(change.RowNumber))] = *change
		if change.Selected && change.Kind == db.VisiteImportChangeKindUPDATE && change.Reference != nil {
			refsCochees = append(refsCochees, *change.Reference)
		}
	}
	return parLigne, refsCochees, nil
}

func visitesParReferences(ctx context.Context, q *db.Queries, refsLues []string) (parReference map[string]db.VisitesParReferencesRow, err error) {
	parReference = map[string]db.VisitesParReferencesRow{}
	if len(refsLues) == 0 {
		return parReference, nil
	}
	rows, err := q.VisitesParReferences(ctx, refsLues)
	if err != nil {
		return nil, err
	}
	for index := range rows {
		parReference[rows[index].Reference] = rows[index]
	}
	return parReference, nil
}

func refusRegistre(ligne *ligneRegistre, code, message string) *ErreurLigneRegistre {
	colonne := "N° REGISTRE"
	return &ErreurLigneRegistre{RowNumber: ligne.numeroLigne, Column: &colonne, Code: code, Message: message}
}

func (s *service) reecrireLigne(ctx context.Context, q *db.Queries, auteur string, ligne *ligneRegistre,
	change *db.VisiteImportChange, actuelles map[string]db.VisitesParReferencesRow,
) (*ErreurLigneRegistre, error) {
	visite, vue := actuelles[derefTexte(change.Reference)]
	if !vue || change.VisiteId == nil || visite.ID != *change.VisiteId {
		return refusRegistre(ligne, codeNumeroInconnu, "« "+ligne.reference+" » ne figure plus au registre."), nil
	}
	avant := champsVisite(&visite, s.Cfg.TimeZone)
	if empreinteChamps(avant) != derefTexte(change.RowHash) {
		return refusRegistre(ligne, "VISITE_IMPORT_REGISTRE_MODIFIEE_DEPUIS",
			change.Label+" a été corrigée à l’accueil depuis votre revue. Sa ligne n’a pas été écrite. Réexportez pour la revoir."), nil
	}

	instant, err := s.instantVisite(ligne.date, texteRegistre(&ligne.heure))
	if err != nil {
		return nil, err
	}
	err = q.MettreAJourVisite(ctx, db.MettreAJourVisiteParams{
		ID: visite.ID, VisitedAt: instant, TimeKnown: ligne.heure != "",
		VisitorName: ligne.nom, Phone: texteRegistre(&ligne.telephone), PhoneE164: ligne.phoneE164,
		EntrepriseId: ligne.entreprise.id, ObjetId: ligne.objet.id,
		DirectionId: identifiantOuNil(ligne.direction), DestinataireId: identifiantOuNil(ligne.destinataire),
		Comment: texteRegistre(&ligne.commentaire),
	})
	if err != nil {
		return nil, err
	}

	avantJournal := map[string]string{}
	apresJournal := map[string]string{}
	for _, diff := range differences(avant, ligne.champs()) {
		avantJournal[diff.Label] = diff.Before
		apresJournal[diff.Label] = diff.After
	}
	return nil, database.Auditer(ctx, q, auteur, "visite.registre_correction", "visite", visite.ID, avantJournal, apresJournal)
}

func (s *service) creerLignes(ctx context.Context, q *db.Queries, auteur string, lignes []ligneRegistre) (int, error) {
	if len(lignes) == 0 {
		return 0, nil
	}
	// Le rang du registre court par ANNÉE et plusieurs lignes du même lot le
	// consomment : la suite est allouée en mémoire, dans la transaction.
	suivants := map[int]int{}
	crees := 0
	for index := range lignes {
		ligne := &lignes[index]
		annee, err := strconv.Atoi(ligne.date[:4])
		if err != nil {
			continue
		}
		if _, vu := suivants[annee]; !vu {
			instant, _ := time.ParseInLocation("2006-01-02", ligne.date, s.Cfg.TimeZone)
			reference, err := s.prochaineReferenceTx(ctx, q, instant)
			if err != nil {
				return crees, err
			}
			suivants[annee] = reference
		}
		id, err := uuid.NewV7()
		if err != nil {
			return crees, err
		}
		instant, err := s.instantVisite(ligne.date, texteRegistre(&ligne.heure))
		if err != nil {
			return crees, err
		}
		err = q.InsererVisite(ctx, db.InsererVisiteParams{
			ID: id.String(), Reference: "V-" + strconv.Itoa(annee) + "-" + formaterRang(suivants[annee]),
			VisitedAt: instant, TimeKnown: ligne.heure != "",
			VisitorName: ligne.nom, Phone: texteRegistre(&ligne.telephone), PhoneE164: ligne.phoneE164,
			EntrepriseId: ligne.entreprise.id, ObjetId: ligne.objet.id,
			DirectionId: identifiantOuNil(ligne.direction), DestinataireId: identifiantOuNil(ligne.destinataire),
			Comment: texteRegistre(&ligne.commentaire), CreatedById: auteur,
		})
		if err != nil {
			return crees, err
		}
		suivants[annee]++
		crees++
	}
	return crees, nil
}

func (s *service) prochaineReferenceTx(ctx context.Context, q *db.Queries, instant time.Time) (int, error) {
	prefixe := "V-" + strconv.Itoa(instant.In(s.Cfg.TimeZone).Year()) + "-"
	derniere, err := q.DerniereReferenceVisite(ctx, prefixe)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	if strings.HasPrefix(derniere, prefixe) && len(derniere) == len(prefixe)+6 {
		if n, convErr := strconv.Atoi(derniere[len(prefixe):]); convErr == nil {
			return n + 1, nil
		}
	}
	return 1, nil
}

func formaterRang(rang int) string {
	texte := strconv.Itoa(rang)
	return strings.Repeat("0", max(0, 6-len(texte))) + texte
}

func identifiantOuNil(entree *entreeRef) *string {
	if entree == nil {
		return nil
	}
	return &entree.id
}
