package imports

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

const (
	PremiereLigneImport           = 3
	maxErreursImport              = 200
	bailImport                    = 10 * time.Minute
	toleranceHorlogeImport        = 5 * time.Minute
	jobsParBalayageImport         = 3
	lotTelephonesImport           = 1000
	dureeTrancheImport            = 60 * time.Second
	feuilleImport                 = "#feuille"
	messageDoublonFichierImport   = "Ce numéro figure déjà à la ligne %d du fichier."
	messageDejaEnBaseImport       = "Ce numéro est déjà celui d’une fiche existante."
	messageValeursTronqueesImport = "%s, … (%d au total)"
)

var (
	limiteurImports           = socle.NouveauLimiteur(5)
	balayageImportsEnCours    atomic.Bool
	espacesRepetesImport      = regexp.MustCompile(`\s+`)
	finDimensionFeuilleImport = regexp.MustCompile(`(\d+)$`)
	scientifiqueImport        = regexp.MustCompile(`^\d(?:\.\d+)?[eE]\+?\d+$`)
)

var Garde = map[string][]socle.Role{
	"GET /api/v1/imports":                         socle.AdminSeul,
	"POST /api/v1/imports/representants":          socle.AdminSeul,
	"POST /api/v1/imports/prospects":              socle.AdminSeul,
	"POST /api/v1/imports/prospects-grand-public": socle.AdminSeul,
	"POST /api/v1/imports/visites":                socle.AdminSeul,
	"GET /api/v1/imports/{id}":                    socle.AdminSeul,
	"POST /api/v1/imports/{id}/apply":             socle.AdminSeul,
	"POST /api/v1/representants/import":           socle.AdminSeul,
	cheminRattrapageFeuilles:                      socle.AdminSeul,
}

type reglagesImport struct {
	dir       string
	maxOctets int64
	tranche   int
	ttl       time.Duration
	balayage  bool
}

func entierImport(nom string, defaut, maximum int) int {
	n, err := strconv.Atoi(os.Getenv(nom))
	if err != nil || n <= 0 || n > maximum {
		return defaut
	}
	return n
}

func reglagesImports() reglagesImport {
	return reglagesImport{
		dir:       socle.Env("IMPORTS_DIR", "./storage/imports"),
		maxOctets: int64(entierImport("IMPORTS_MAX_BYTES", 25*1024*1024, 268_435_456)),
		tranche:   entierImport("IMPORTS_CHUNK_SIZE", 500, 5_000),
		ttl:       time.Duration(entierImport("IMPORTS_TTL_HOURS", 24, 168)) * time.Hour,
		balayage:  socle.Env("IMPORTS_SWEEP_ENABLED", socle.Vrai) != socle.Faux,
	}
}

func pointeurImport[T any](v T) *T { return &v }

func entier32Import(valeur int64) int32 {
	switch {
	case valeur > math.MaxInt32:
		return math.MaxInt32
	case valeur < math.MinInt32:
		return math.MinInt32
	default:
		return int32(valeur)
	}
}

type erreurLigneImport struct {
	RowNumber int     `json:"rowNumber"`
	Column    *string `json:"column"`
	Code      string  `json:"code"`
	Message   string  `json:"message"`
}

type RapportImportDTO struct {
	Kind              string              `json:"kind"`
	Mode              string              `json:"mode"`
	TotalRows         int                 `json:"totalRows"`
	ProcessedRows     int                 `json:"processedRows"`
	CreatedRows       int                 `json:"createdRows"`
	UpdatedRows       int                 `json:"updatedRows"`
	SkippedRows       int                 `json:"skippedRows"`
	ErrorRows         int                 `json:"errorRows"`
	Truncated         bool                `json:"truncated"`
	MaxReportedErrors int                 `json:"maxReportedErrors"`
	Errors            []erreurLigneImport `json:"errors"`
}

type ImportJobDTO struct {
	ID            string            `json:"id" format:"uuid"`
	Kind          string            `json:"kind" enum:"REPRESENTANTS,PROSPECTS,VISITES,PROSPECTS_GRAND_PUBLIC,VISITES_REGISTRE"`
	Status        string            `json:"status" enum:"queued,running,succeeded,failed,expired"`
	Mode          string            `json:"mode" enum:"DRY_RUN,APPLY"`
	RequestedByID string            `json:"requestedById"`
	FileName      string            `json:"fileName"`
	FileBytes     int32             `json:"fileBytes"`
	TotalRows     *int32            `json:"totalRows"`
	ProcessedRows int32             `json:"processedRows"`
	CreatedRows   int32             `json:"createdRows"`
	UpdatedRows   int32             `json:"updatedRows"`
	SkippedRows   int32             `json:"skippedRows"`
	ErrorRows     int32             `json:"errorRows"`
	Report        *RapportImportDTO `json:"report"`
	FailureCode   *string           `json:"failureCode"`
	FailureMsg    *string           `json:"failureMsg"`
	StartedAt     *time.Time        `json:"startedAt"`
	FinishedAt    *time.Time        `json:"finishedAt"`
	ExpiresAt     time.Time         `json:"expiresAt"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
}

type MetaPageImports struct {
	Total     int64 `json:"total"`
	Page      int   `json:"page"`
	PageSize  int   `json:"pageSize"`
	PageCount int   `json:"pageCount"`
}

type ImportJobOutput struct {
	Status int
	Body   ImportJobDTO
}

type ListeImportsOutput struct {
	Body struct {
		Items []ImportJobDTO  `json:"items"`
		Meta  MetaPageImports `json:"meta"`
	}
}

func versImportJobDTO(job *db.ImportJob) ImportJobDTO {
	dto := ImportJobDTO{
		ID: job.ID, Kind: string(job.Kind), Status: string(job.Status), Mode: string(job.Mode),
		RequestedByID: job.RequestedById, FileName: job.FileName, FileBytes: job.FileBytes,
		TotalRows: job.TotalRows, ProcessedRows: job.ProcessedRows, CreatedRows: job.CreatedRows,
		UpdatedRows: job.UpdatedRows, SkippedRows: job.SkippedRows, ErrorRows: job.ErrorRows,
		FailureCode: job.FailureCode, FailureMsg: job.FailureMsg, StartedAt: job.StartedAt,
		FinishedAt: job.FinishedAt, ExpiresAt: job.ExpiresAt, CreatedAt: job.CreatedAt, UpdatedAt: job.UpdatedAt,
	}
	var rapport RapportImportDTO
	if len(job.Report) > 0 && json.Unmarshal(job.Report, &rapport) == nil {
		if rapport.Errors == nil {
			rapport.Errors = []erreurLigneImport{}
		}
		dto.Report = &rapport
	}
	return dto
}

// ---------------------------------------------------------------- dépôt

type DepotImportInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file"`
	}]
}

type IDImportInput struct {
	ID string `path:"id" format:"uuid"`
}

type ListeImportsInput struct {
	Kind     string `query:"kind" enum:"REPRESENTANTS,PROSPECTS,VISITES,PROSPECTS_GRAND_PUBLIC,VISITES_REGISTRE"`
	Status   string `query:"status" enum:"queued,running,succeeded,failed,expired"`
	Page     int    `query:"page" minimum:"1" default:"1"`
	PageSize int    `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

// La limite multipart de huma ne s'applique pas au flux multipart : sans ce
// `MaxBytesReader`, un envoi de 500 Mo est écrit sur le disque temporaire avant
// le moindre contrôle.
func bornerDepotImport(ctx huma.Context, suite func(huma.Context)) {
	r, w := humago.Unwrap(ctx)
	maximum := reglagesImports().maxOctets
	r.Body = http.MaxBytesReader(w, r.Body, maximum)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		message := fmt.Sprintf("Le fichier dépasse %d Mo.", maximum/1_048_576)
		socle.EcrireProblem(w, r, socle.Problem(http.StatusRequestEntityTooLarge, "IMPORT_FILE_TOO_LARGE", message))
		return
	}
	suite(ctx)
}

func (s *service) deposerImport(kind db.ImportKind) func(context.Context, *DepotImportInput) (*ImportJobOutput, error) {
	return func(ctx context.Context, in *DepotImportInput) (*ImportJobOutput, error) {
		adresse, _ := ctx.Value(socle.CleAdresse{}).(string)
		if !limiteurImports.Autorise(adresse) {
			return nil, socle.Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
		}
		fichier := in.RawBody.Data().File
		if !fichier.IsSet {
			return nil, socle.Problem(http.StatusBadRequest, "IMPORT_FILE_MISSING", "Aucun fichier reçu. Envoyez le classeur dans un champ `file`.")
		}
		defer func() { _ = fichier.Close() }()

		job, err := s.creerTravailImport(ctx, kind, socle.UtilisateurCourant(ctx).ID, fichier.Filename, fichier)
		if err != nil {
			return nil, err
		}
		s.Live.Emettre("imports")
		go s.executerImport(context.WithoutCancel(ctx), job.ID)
		return &ImportJobOutput{Status: http.StatusCreated, Body: versImportJobDTO(&job)}, nil
	}
}

func (s *service) creerTravailImport(ctx context.Context, kind db.ImportKind, demandeur, nom string, source io.Reader) (db.ImportJob, error) {
	reglages := reglagesImports()
	identifiant, err := uuid.NewV7()
	if err != nil {
		return db.ImportJob{}, err
	}
	if err := os.MkdirAll(reglages.dir, 0o750); err != nil {
		return db.ImportJob{}, err
	}
	chemin := filepath.Join(reglages.dir, identifiant.String()+".xlsx")
	octets, err := ecrireClasseurImport(chemin, source, reglages.maxOctets)
	if err != nil {
		_ = os.Remove(chemin)
		return db.ImportJob{}, err
	}
	if nom == "" {
		nom = "import.xlsx"
	}
	job, err := s.Q.InsertImportJob(ctx, db.InsertImportJobParams{
		ID: identifiant.String(), Kind: kind, RequestedByID: demandeur,
		FileName: tronquerImport(nom, 255), FileBytes: entier32Import(octets), StoragePath: chemin,
		ExpiresAt: time.Now().Add(reglages.ttl),
	})
	if err != nil {
		_ = os.Remove(chemin)
		return db.ImportJob{}, err
	}
	return job, nil
}

// Le type est établi par le CONTENU : `import-file.store.ts:37` ne testait rien.
func ecrireClasseurImport(chemin string, source io.Reader, maximum int64) (int64, error) {
	tete := make([]byte, 4)
	if _, err := io.ReadFull(source, tete); err != nil || !bytes.Equal(tete, []byte("PK\x03\x04")) {
		return 0, socle.Problem(http.StatusBadRequest, "IMPORT_FILE_UNREADABLE", "Ce fichier n’est pas un classeur Excel (.xlsx).")
	}
	cible, err := os.OpenFile(filepath.Clean(chemin), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return 0, err
	}
	defer func() { _ = cible.Close() }()
	ecrits, err := io.Copy(cible, io.MultiReader(bytes.NewReader(tete), io.LimitReader(source, maximum)))
	if err != nil {
		return 0, err
	}
	return ecrits, nil
}

func tronquerImport(valeur string, maximum int) string {
	if len(valeur) <= maximum {
		return valeur
	}
	return valeur[:maximum]
}

// ---------------------------------------------------------------- lecture

func (s *service) obtenirImport(ctx context.Context, in *IDImportInput) (*ImportJobOutput, error) {
	job, err := s.Q.ImportJobByID(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "IMPORT_JOB_NOT_FOUND", "Ce travail d’import n’existe pas.")
	}
	if err != nil {
		return nil, err
	}
	return &ImportJobOutput{Status: http.StatusOK, Body: versImportJobDTO(&job)}, nil
}

func (s *service) listerImports(ctx context.Context, in *ListeImportsInput) (*ListeImportsOutput, error) {
	var kind *db.ImportKind
	if in.Kind != "" {
		kind = pointeurImport(db.ImportKind(in.Kind))
	}
	var statut *db.ImportStatus
	if in.Status != "" {
		statut = pointeurImport(db.ImportStatus(in.Status))
	}
	total, err := s.Q.CountImportJobs(ctx, db.CountImportJobsParams{Kind: kind, Status: statut})
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.ListImportJobs(ctx, db.ListImportJobsParams{
		Kind: kind, Status: statut,
		Skip: entier32Import(int64((in.Page - 1) * in.PageSize)), Take: entier32Import(int64(in.PageSize)),
	})
	if err != nil {
		return nil, err
	}
	out := &ListeImportsOutput{}
	out.Body.Items = make([]ImportJobDTO, 0, len(lignes))
	for index := range lignes {
		out.Body.Items = append(out.Body.Items, versImportJobDTO(&lignes[index]))
	}
	pages := int((total + int64(in.PageSize) - 1) / int64(in.PageSize))
	out.Body.Meta = MetaPageImports{Total: total, Page: in.Page, PageSize: in.PageSize, PageCount: max(1, pages)}
	return out, nil
}

// Un fichier, un travail : créer une seconde ligne ferait détruire le classeur
// sous l'autre à la première échéance.
func (s *service) appliquerImport(ctx context.Context, in *IDImportInput) (*ImportJobOutput, error) {
	maintenant := time.Now()
	remise, err := s.Q.RequeueImportJobForApply(ctx, db.RequeueImportJobForApplyParams{ID: in.ID, Now: maintenant})
	if err != nil {
		return nil, err
	}
	if remise != 1 {
		reprise, err := s.Q.ResumeFailedImportApply(ctx, db.ResumeFailedImportApplyParams{ID: in.ID, Now: maintenant})
		if err != nil {
			return nil, err
		}
		if reprise != 1 {
			return nil, s.refusAppliquerImport(ctx, in.ID)
		}
	}
	go s.executerImport(context.WithoutCancel(ctx), in.ID)
	return s.obtenirImport(ctx, in)
}

func (s *service) refusAppliquerImport(ctx context.Context, id string) error {
	job, err := s.Q.ImportJobByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return socle.Problem(http.StatusNotFound, "IMPORT_JOB_NOT_FOUND", "Ce travail d’import n’existe pas.")
	}
	if err != nil {
		return err
	}
	return socle.Problem(http.StatusConflict, "IMPORT_NOT_APPLICABLE", fmt.Sprintf(
		"Seule une simulation TERMINÉE et non échue peut être appliquée. Ce travail est « %s » en mode « %s », et son échéance est le %s.",
		job.Status, job.Mode, job.ExpiresAt.Format("2006-01-02T15:04:05.000Z")))
}

// ---------------------------------------------------------------- moteur

type bailPerduImportError struct{}

func (bailPerduImportError) Error() string { return "bail d’import repris par un autre travailleur" }

type echecImportError struct{ code, message string }

func (e echecImportError) Error() string { return e.message }

type classeurImportError struct{ motif string }

func (e classeurImportError) Error() string { return e.motif }

type contexteImport struct {
	jobID     string
	demandeur string
	region    string
	appliquer bool
}

type bilanTrancheImport struct {
	crees, misAJour, ignorees int
	erreurs                   []erreurLigneImport
}

type totauxImport struct {
	traitees, crees, misAJour, ignorees, refusees int32
	erreurs                                       []erreurLigneImport
}

type adaptateurImport struct {
	maxLignes int
	colonnes  []colonneImport
	feuilles  *dispositionFeuilleImport
	preparer  func(context.Context, *db.Queries, contexteImport) (any, error)
	lire      func(cellules map[string]string, ligne int, etat any) (any, *erreurLigneImport)
	ecrire    func(context.Context, *db.Queries, contexteImport, []any, any) (bilanTrancheImport, error)
}

func (s *service) executerImport(ctx context.Context, jobID string) {
	if err := s.courirImport(ctx, jobID); err != nil {
		slog.Error("import", "job", jobID, "err", err)
	}
}

func (s *service) courirImport(ctx context.Context, jobID string) error {
	maintenant := time.Now()
	jeton := uuid.NewString()
	job, err := s.Q.ClaimImportJob(ctx, db.ClaimImportJobParams{
		ID: jobID, Token: jeton, Now: maintenant,
		LeaseExpired:    maintenant.Add(-bailImport),
		ClockJumpedBack: maintenant.Add(toleranceHorlogeImport),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	adaptateur, connu := adaptateursImport[job.Kind]
	if !connu {
		return s.echouerTravailImport(ctx, job.ID, jeton, "IMPORT_ADAPTER_MISSING",
			fmt.Sprintf("Aucun adaptateur n’est enregistré pour « %s ».", job.Kind))
	}

	err = s.consommerImport(ctx, &job, jeton, adaptateur)
	var perdu bailPerduImportError
	var echec echecImportError
	var illisible classeurImportError
	switch {
	case err == nil, errors.As(err, &perdu):
		return nil
	case errors.As(err, &echec):
		return s.echouerTravailImport(ctx, job.ID, jeton, echec.code, echec.message)
	case errors.As(err, &illisible):
		return s.echouerTravailImport(ctx, job.ID, jeton, "IMPORT_FILE_UNREADABLE", illisible.motif)
	default:
		return s.echouerTravailImport(ctx, job.ID, jeton, "IMPORT_FAILED", err.Error())
	}
}

// L'état d'UNE course : il ne peut pas vivre sur l'adaptateur, que deux imports
// simultanés partagent.
type courseImport struct {
	s          *service
	job        *db.ImportJob
	jeton      string
	adaptateur adaptateurImport
	contexte   contexteImport
	etat       any
	totaux     totauxImport
	saut       int
	tranche    int
	vues       int
	consommees int
	tampon     []any
}

func (s *service) consommerImport(ctx context.Context, job *db.ImportJob, jeton string, a adaptateurImport) error {
	classeur, err := ouvrirClasseurImport(job.StoragePath, a)
	if err != nil {
		return err
	}
	defer func() { _ = classeur.fermer() }()
	if classeur.declarees != nil && int(*classeur.declarees) > a.maxLignes {
		return plafondImportDepasse(a.maxLignes)
	}

	maintenant := time.Now()
	rangs, err := s.Q.MarkImportRunning(ctx, db.MarkImportRunningParams{
		Now: maintenant, TotalRows: classeur.declarees, ID: job.ID, Token: jeton,
	})
	if err := barriereImport(rangs, err); err != nil {
		return err
	}
	s.Live.Emettre("imports")

	course := &courseImport{
		s: s, job: job, jeton: jeton, adaptateur: a,
		contexte: contexteImport{
			jobID: job.ID, demandeur: job.RequestedById,
			region: s.Cfg.PhoneRegion, appliquer: job.Mode == db.ImportModeAPPLY,
		},
		totaux: totauxImport{
			traitees: job.ProcessedRows, crees: job.CreatedRows, misAJour: job.UpdatedRows,
			ignorees: job.SkippedRows, refusees: job.ErrorRows, erreurs: erreursDuRapportImport(job.Report),
		},
		saut: int(job.ProcessedRows), tranche: reglagesImports().tranche,
	}
	if course.etat, err = a.preparer(ctx, s.Q, course.contexte); err != nil {
		return err
	}
	if err := classeur.parcourir(func(numero int, cellules map[string]string) error {
		return course.consommerLigne(ctx, numero, cellules)
	}); err != nil {
		return err
	}
	if course.consommees > 0 {
		if err := course.ecrireTranche(ctx); err != nil {
			return err
		}
	}
	return s.terminerImport(ctx, job, jeton, course.totaux, course.vues)
}

func (c *courseImport) consommerLigne(ctx context.Context, numero int, cellules map[string]string) error {
	c.vues++
	if c.vues > c.adaptateur.maxLignes {
		return plafondImportDepasse(c.adaptateur.maxLignes)
	}
	if c.vues <= c.saut {
		return nil
	}
	valeur, refus := c.adaptateur.lire(cellules, numero, c.etat)
	if refus != nil {
		c.totaux.refusees++
		c.totaux.erreurs = bornerErreursImport(c.totaux.erreurs, []erreurLigneImport{*refus})
	} else if valeur != nil {
		c.tampon = append(c.tampon, valeur)
	}
	c.consommees++
	if c.consommees < c.tranche {
		return nil
	}
	return c.ecrireTranche(ctx)
}

func plafondImportDepasse(maximum int) error {
	return echecImportError{"IMPORT_TOO_MANY_ROWS", fmt.Sprintf("Le fichier dépasse le plafond de %d lignes. Découpez-le.", maximum)}
}

// `processedRows` avance DANS la transaction de la tranche : une reprise ne peut
// donc ni rejouer ni sauter des lignes.
func (c *courseImport) ecrireTranche(ctx context.Context) error {
	tctx, annuler := context.WithTimeout(ctx, dureeTrancheImport)
	defer annuler()
	tx, err := c.s.Pool.Begin(tctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(tctx)) }()
	if _, err := tx.Exec(tctx, "SET LOCAL statement_timeout = '60s'"); err != nil {
		return err
	}
	q := c.s.Q.WithTx(tx)

	bilan, err := c.adaptateur.ecrire(tctx, q, c.contexte, c.tampon, c.etat)
	if err != nil {
		return err
	}
	maintenant := time.Now()
	rangs, err := q.AdvanceImportJob(tctx, db.AdvanceImportJobParams{
		ProcessedRows: c.totaux.traitees + entier32Import(int64(c.consommees)),
		CreatedRows:   c.totaux.crees + entier32Import(int64(bilan.crees)),
		UpdatedRows:   c.totaux.misAJour + entier32Import(int64(bilan.misAJour)),
		SkippedRows:   c.totaux.ignorees + entier32Import(int64(bilan.ignorees)),
		ErrorRows:     c.totaux.refusees + entier32Import(int64(len(bilan.erreurs))),
		Now:           maintenant, ID: c.job.ID, Token: c.jeton,
	})
	if err := barriereImport(rangs, err); err != nil {
		return err
	}
	if err := tx.Commit(tctx); err != nil {
		return err
	}

	c.totaux.traitees += entier32Import(int64(c.consommees))
	c.totaux.crees += entier32Import(int64(bilan.crees))
	c.totaux.misAJour += entier32Import(int64(bilan.misAJour))
	c.totaux.ignorees += entier32Import(int64(bilan.ignorees))
	c.totaux.refusees += entier32Import(int64(len(bilan.erreurs)))
	c.totaux.erreurs = bornerErreursImport(c.totaux.erreurs, bilan.erreurs)
	c.tampon, c.consommees = nil, 0
	c.s.Live.Emettre("imports")
	return nil
}

func (s *service) terminerImport(ctx context.Context, job *db.ImportJob, jeton string, totaux totauxImport, vues int) error {
	rapport, err := json.Marshal(RapportImportDTO{
		Kind: string(job.Kind), Mode: string(job.Mode), TotalRows: vues,
		ProcessedRows: int(totaux.traitees), CreatedRows: int(totaux.crees),
		UpdatedRows: int(totaux.misAJour), SkippedRows: int(totaux.ignorees),
		ErrorRows: int(totaux.refusees), Truncated: int(totaux.refusees) > len(totaux.erreurs),
		MaxReportedErrors: maxErreursImport, Errors: totaux.erreurs,
	})
	if err != nil {
		return err
	}
	maintenant := time.Now()
	rangs, err := s.Q.FinishImportJob(ctx, db.FinishImportJobParams{
		ProcessedRows: totaux.traitees, CreatedRows: totaux.crees, UpdatedRows: totaux.misAJour,
		SkippedRows: totaux.ignorees, ErrorRows: totaux.refusees, TotalRows: entier32Import(int64(vues)),
		Report: rapport, Now: maintenant, ID: job.ID, Token: jeton,
	})
	if err := barriereImport(rangs, err); err != nil {
		return err
	}
	s.Live.Emettre("imports")
	return nil
}

func (s *service) echouerTravailImport(ctx context.Context, jobID, jeton, code, message string) error {
	maintenant := time.Now()
	_, err := s.Q.FailImportJob(ctx, db.FailImportJobParams{
		FailureCode: &code, FailureMsg: pointeurImport(tronquerImport(message, 2_000)),
		Now: maintenant, ID: jobID, Token: jeton,
	})
	if err != nil {
		return err
	}
	s.Live.Emettre("imports")
	return nil
}

func barriereImport(rangs int64, err error) error {
	if err != nil {
		return err
	}
	if rangs != 1 {
		return bailPerduImportError{}
	}
	return nil
}

func bornerErreursImport(courantes, entrantes []erreurLigneImport) []erreurLigneImport {
	if len(courantes) >= maxErreursImport {
		return courantes
	}
	fusion := make([]erreurLigneImport, 0, len(courantes)+len(entrantes))
	fusion = append(fusion, courantes...)
	fusion = append(fusion, entrantes...)
	if len(fusion) > maxErreursImport {
		return fusion[:maxErreursImport]
	}
	return fusion
}

func erreursDuRapportImport(brut []byte) []erreurLigneImport {
	var rapport RapportImportDTO
	if len(brut) == 0 || json.Unmarshal(brut, &rapport) != nil {
		return nil
	}
	return rapport.Errors
}

// ---------------------------------------------------------------- balayage

// L'ordre compte : échéances d'abord, sans quoi un travail repris perdrait son
// classeur dans la seconde et se plaindrait d'un fichier illisible.
func (s *service) balayerImports(ctx context.Context) error {
	if !reglagesImports().balayage || !balayageImportsEnCours.CompareAndSwap(false, true) {
		return nil
	}
	defer balayageImportsEnCours.Store(false)

	maintenant := time.Now()
	if err := s.expirerImports(ctx, maintenant); err != nil {
		return err
	}
	candidats, err := s.Q.ClaimableImportJobs(ctx, db.ClaimableImportJobsParams{
		Now:             maintenant,
		LeaseExpired:    maintenant.Add(-bailImport),
		ClockJumpedBack: maintenant.Add(toleranceHorlogeImport),
		Take:            jobsParBalayageImport,
	})
	if err != nil {
		return err
	}
	// Un échec avalé laissait `cron_runs.ok` à vrai : tous les imports pouvaient
	// échouer et l'écran Exploitation restait vert.
	var echecs []error
	for _, id := range candidats {
		if err := s.courirImport(ctx, id); err != nil {
			slog.Warn("import", "job", id, "err", err)
			echecs = append(echecs, fmt.Errorf("job %s : %w", id, err))
		}
	}
	return errors.Join(echecs...)
}

// La ligne d'abord, le fichier ensuite : l'inverse laisse un travail vivant sans
// classeur.
func (s *service) expirerImports(ctx context.Context, maintenant time.Time) error {
	echus, err := s.Q.DueImportJobs(ctx, maintenant)
	if err != nil {
		return err
	}
	for _, job := range echus {
		if _, err := s.Q.ExpireImportJob(ctx, db.ExpireImportJobParams{ID: job.ID, Now: maintenant}); err != nil {
			return err
		}
		if err := os.Remove(job.StoragePath); err != nil && !os.IsNotExist(err) {
			slog.Warn("import", "job", job.ID, "err", err)
		}
		s.Live.Emettre("imports")
	}
	return nil
}

// ---------------------------------------------------------------- classeur

type colonneImport struct {
	entete  string
	alias   []string
	requise bool
}

type dispositionFeuilleImport struct {
	motif                 *regexp.Regexp
	ligneEntete           int
	premiereDonnee        int
	repliFeuillesRemplies bool
	exemples              []string
}

// Sans disposition, l'en-tête et la ligne d'exemple du modèle sont sautés par
// leur position.
func (d *dispositionFeuilleImport) premiereLigne() int {
	if d == nil || d.premiereDonnee == 0 {
		return PremiereLigneImport
	}
	return d.premiereDonnee
}

type classeurImport struct {
	fichier    *excelize.File
	adaptateur adaptateurImport
	declarees  *int32
}

func ouvrirClasseurImport(chemin string, a adaptateurImport) (*classeurImport, error) {
	fichier, err := excelize.OpenFile(chemin)
	if err != nil {
		return nil, classeurImportError{"Le fichier n’est pas un classeur Excel lisible (.xlsx). " + err.Error()}
	}
	feuilles := fichier.GetSheetList()
	if len(feuilles) == 0 {
		_ = fichier.Close()
		return nil, classeurImportError{"Le classeur ne contient aucune feuille."}
	}
	classeur := &classeurImport{fichier: fichier, adaptateur: a}
	if a.feuilles == nil {
		classeur.declarees = lignesDeclareesImport(fichier, feuilles[0])
	}
	return classeur, nil
}

func (c *classeurImport) fermer() error { return c.fichier.Close() }

// Plusieurs onglets : le dénominateur ne se connaît qu'en les ayant traversés,
// c'est-à-dire trop tard pour servir de jauge.
func lignesDeclareesImport(fichier *excelize.File, feuille string) *int32 {
	dimension, err := fichier.GetSheetDimension(feuille)
	if err != nil {
		return nil
	}
	_, fin, trouve := strings.Cut(dimension, ":")
	if !trouve {
		return nil
	}
	rang := finDimensionFeuilleImport.FindString(fin)
	bas, err := strconv.Atoi(rang)
	if err != nil || bas < PremiereLigneImport {
		return nil
	}
	return pointeurImport(entier32Import(int64(bas - PremiereLigneImport + 1)))
}

func (c *classeurImport) parcourir(sur func(ligne int, cellules map[string]string) error) error {
	feuilles := c.fichier.GetSheetList()
	if c.adaptateur.feuilles == nil || c.adaptateur.feuilles.motif == nil {
		return c.parcourirFeuille(feuilles[0], false, sur)
	}
	apparies := 0
	for _, nom := range feuilles {
		if !c.adaptateur.feuilles.motif.MatchString(nom) {
			continue
		}
		apparies++
		if err := c.parcourirFeuille(nom, true, sur); err != nil {
			return err
		}
	}
	if apparies == 0 {
		if c.adaptateur.feuilles.repliFeuillesRemplies {
			return c.parcourirFeuillesRemplies(feuilles, sur)
		}
		return classeurImportError{"Aucun onglet de ce classeur ne porte de données à importer. Onglets trouvés : " + strings.Join(feuilles, ", ") + "."}
	}
	return nil
}

// Un export de campagne n'a pas d'onglet nommé : tous ceux qui portent quelque
// chose sont lus, une feuille ajoutée par le marketing comprise.
func (c *classeurImport) parcourirFeuillesRemplies(feuilles []string, sur func(int, map[string]string) error) error {
	for _, nom := range feuilles {
		if c.feuilleVide(nom) {
			continue
		}
		if err := c.parcourirFeuille(nom, true, sur); err != nil {
			return err
		}
	}
	return nil
}

// Une feuille sans en-tête est vide, pas fautive : Excel en laisse souvent une.
func (c *classeurImport) feuilleVide(nom string) bool {
	lignes, err := c.fichier.Rows(nom)
	if err != nil {
		return false
	}
	defer func() { _ = lignes.Close() }()
	for numero := 1; lignes.Next(); numero++ {
		cellules, err := lignes.Columns(excelize.Options{RawCellValue: true})
		if err != nil {
			return false
		}
		if strings.TrimSpace(strings.Join(cellules, "")) != "" {
			return false
		}
		if numero >= c.adaptateur.feuilles.ligneEntete {
			return true
		}
	}
	return true
}

func (c *classeurImport) parcourirFeuille(nom string, nomme bool, sur func(int, map[string]string) error) error {
	lignes, err := c.fichier.Rows(nom)
	if err != nil {
		return classeurImportError{"Onglet « " + nom + " » illisible. " + err.Error()}
	}
	defer func() { _ = lignes.Close() }()

	disposition := c.adaptateur.feuilles
	premiere := disposition.premiereLigne()
	var rangs []int
	numero := 0
	for lignes.Next() {
		numero++
		entete := disposition != nil && numero == disposition.ligneEntete
		if !entete && numero < premiere {
			continue
		}
		cellules, err := lignes.Columns(excelize.Options{RawCellValue: true})
		if err != nil {
			return classeurImportError{"Onglet « " + nom + " » illisible. " + err.Error()}
		}
		if entete {
			if rangs, err = apparierEntetesImport(cellules, c.adaptateur.colonnes, nom, disposition.ligneEntete); err != nil {
				return err
			}
			continue
		}
		if err := c.projeterEtLivrer(cellules, rangs, nom, nomme, numero, sur); err != nil {
			return err
		}
	}
	return lignes.Error()
}

func (c *classeurImport) projeterEtLivrer(cellules []string, rangs []int, nom string, nomme bool,
	numero int, sur func(int, map[string]string) error,
) error {
	disposition := c.adaptateur.feuilles
	if disposition != nil && rangs == nil {
		return classeurImportError{fmt.Sprintf("L’onglet « %s » n’a pas de ligne %d : ses colonnes sont introuvables.", nom, disposition.ligneEntete)}
	}
	projetees := projeterLigneImport(cellules, c.adaptateur.colonnes, rangs, nomme, nom)
	if ligneVideImport(projetees) || ligneExempleImport(projetees, c.adaptateur.colonnes, disposition, rangs) {
		return nil
	}
	return sur(numero, projetees)
}

// La ligne d'exemple du modèle porte les valeurs que le modèle a écrites : elle
// se reconnaît, au lieu d'être sautée par sa position.
func ligneExempleImport(projetees map[string]string, colonnes []colonneImport,
	d *dispositionFeuilleImport, rangs []int,
) bool {
	if d == nil || d.exemples == nil {
		return false
	}
	comparees := 0
	for i, colonne := range colonnes {
		if d.exemples[i] == "" || (len(rangs) > i && rangs[i] == 0) {
			continue
		}
		if projetees[colonne.entete] != d.exemples[i] {
			return false
		}
		comparees++
	}
	return comparees > 0
}

// Les colonnes sont retrouvées par leur en-tête, ONGLET PAR ONGLET : le classeur
// de l'accueil gagne deux colonnes au mois d'août.
func apparierEntetesImport(cellules []string, colonnes []colonneImport, feuille string, ligneEntete int) ([]int, error) {
	trouvees := map[string]int{}
	for index, cellule := range cellules {
		cle := cleImport(cellule)
		if cle == "" {
			continue
		}
		if _, deja := trouvees[cle]; !deja {
			trouvees[cle] = index + 1
		}
	}
	rangs := make([]int, len(colonnes))
	for i, colonne := range colonnes {
		rang := 0
		for _, libelle := range append([]string{colonne.entete}, colonne.alias...) {
			if trouve, ok := trouvees[cleImport(libelle)]; ok {
				rang = trouve
				break
			}
		}
		if rang == 0 && colonne.requise {
			return nil, classeurImportError{fmt.Sprintf("Onglet « %s » : la colonne « %s » est introuvable en ligne %d.", feuille, colonne.entete, ligneEntete)}
		}
		rangs[i] = rang
	}
	return rangs, nil
}

func projeterLigneImport(cellules []string, colonnes []colonneImport, rangs []int, nomme bool, feuille string) map[string]string {
	projetees := make(map[string]string, len(colonnes)+1)
	if nomme {
		projetees[feuilleImport] = feuille
	}
	for i, colonne := range colonnes {
		rang := i + 1
		if rangs != nil {
			rang = rangs[i]
		}
		valeur := ""
		if rang > 0 && rang <= len(cellules) {
			valeur = entierLisibleImport(strings.TrimSpace(cellules[rang-1]))
		}
		projetees[colonne.entete] = valeur
	}
	return projetees
}

// Un numéro saisi comme un nombre revient en notation scientifique : la feuille
// affiche « 221772663841 », le classeur stocke « 2.21772663841E11 ».
func entierLisibleImport(valeur string) string {
	if !scientifiqueImport.MatchString(valeur) {
		return valeur
	}
	nombre, err := strconv.ParseFloat(valeur, 64)
	if err != nil || nombre != math.Trunc(nombre) || math.Abs(nombre) >= 1e18 {
		return valeur
	}
	return strconv.FormatInt(int64(nombre), 10)
}

func ligneVideImport(cellules map[string]string) bool {
	for cle, valeur := range cellules {
		if cle != feuilleImport && valeur != "" {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------- montage

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	depots := []struct {
		chemin    string
		operation string
		kind      db.ImportKind
	}{
		{"representants", "createRepresentantsImport", db.ImportKindREPRESENTANTS},
		{socle.NomProspects, "createProspectsImport", db.ImportKindPROSPECTS},
		{"prospects-grand-public", "createProspectsGrandPublicImport", db.ImportKindPROSPECTSGRANDPUBLIC},
		{"visites", "createVisitesImport", db.ImportKindVISITES},
	}
	for _, depot := range depots {
		huma.Register(api, huma.Operation{
			OperationID:   depot.operation,
			Method:        http.MethodPost,
			Path:          "/api/v1/imports/" + depot.chemin,
			Summary:       "Dépose un classeur et inscrit le travail. Rend immédiatement, en mode DRY_RUN.",
			DefaultStatus: http.StatusCreated,
			MaxBodyBytes:  reglagesImports().maxOctets,
			Middlewares:   huma.Middlewares{bornerDepotImport},
		}, s.deposerImport(depot.kind))
	}
	huma.Register(api, huma.Operation{
		OperationID: "listImportJobs", Method: http.MethodGet, Path: "/api/v1/imports",
		Summary: "Liste paginée des travaux d’import, filtrable par entité et par état.",
	}, s.listerImports)
	huma.Register(api, huma.Operation{
		OperationID: "getImportJob", Method: http.MethodGet, Path: "/api/v1/imports/{id}",
		Summary: "État d’un travail d’import, et son rapport quand il est terminé.",
	}, s.obtenirImport)
	huma.Register(api, huma.Operation{
		OperationID: "applyImportJob", Method: http.MethodPost, Path: "/api/v1/imports/{id}/apply",
		Summary: "Applique une simulation terminée : le même fichier est réécrit en base.",
	}, s.appliquerImport)
	rattrapageMonterRoute(api, s)
	representantsMonterRoutes(api, s)
}
