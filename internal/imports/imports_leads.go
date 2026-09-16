package imports

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/socle"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
)

// Le classeur des leads du marketing, relevé sur son lien SharePoint « toute
// personne disposant du lien » : IMPORT_LEADS_URL. Sans lien, la tâche ne fait rien.
const (
	cleEmpreinteLeads        = "imports.leadsEmpreinte"
	cleReleveSilencieuxLeads = "imports.leadsReleveSilencieux"
	cleBilanLeads            = "imports.leadsBilan"
	nomLeadsParDefaut        = "leads-marketing.xlsx"
	delaiReleveLeads         = 2 * time.Minute
	libelleChampDate         = "Date"
)

var releveLeadsEnCours atomic.Bool

func (s *service) releverLeads(ctx context.Context) error {
	lien := strings.TrimSpace(os.Getenv("IMPORT_LEADS_URL"))
	if lien == "" || !releveLeadsEnCours.CompareAndSwap(false, true) {
		return nil
	}
	defer releveLeadsEnCours.Store(false)

	classeur, nom, err := telechargerLeads(ctx, lien, reglagesImports().maxOctets)
	if err != nil {
		return fmt.Errorf("relevé des leads : %w", err)
	}
	somme := sha256.Sum256(classeur)
	empreinte := hex.EncodeToString(somme[:])
	deja, err := s.Q.AppSettingParCle(ctx, cleEmpreinteLeads)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil && deja.Value == empreinte {
		return nil
	}
	demandeur, err := s.Q.ImportDemandeurSysteme(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("relevé des leads : aucun administrateur actif pour porter l’import")
	}
	if err != nil {
		return err
	}
	job, err := s.creerTravailImport(ctx, db.ImportKindPROSPECTSGRANDPUBLIC, demandeur, nom, bytes.NewReader(classeur))
	if err != nil {
		return fmt.Errorf("relevé des leads : %w", err)
	}
	// L'empreinte se retient avant l'issue : un classeur refusé se lit dans
	// l'écran Imports, il ne se rejoue pas tous les quarts d'heure.
	if err := s.Q.UpsertAppSetting(ctx, db.UpsertAppSettingParams{
		Key: cleEmpreinteLeads, Value: empreinte, UpdatedById: &demandeur,
	}); err != nil {
		return err
	}
	return s.simulerPuisAppliquerLeads(ctx, job.ID, nom)
}

func (s *service) simulerPuisAppliquerLeads(ctx context.Context, jobID, nom string) error {
	defer s.Live.Emettre("imports")
	if err := s.courirImport(ctx, jobID); err != nil {
		return err
	}
	remis, err := s.Q.RequeueImportJobForApply(ctx, db.RequeueImportJobForApplyParams{ID: jobID, Now: time.Now()})
	if err != nil {
		return err
	}
	if remis == 1 {
		if err := s.courirImport(ctx, jobID); err != nil {
			return err
		}
	} else {
		slog.Warn("relevé des leads : simulation refusée, voir l’écran Imports", "job", jobID, "fichier", nom)
	}
	if s.releveSilencieux(ctx) {
		return nil
	}
	job, err := s.Q.ImportJobByID(ctx, jobID)
	if err != nil {
		return err
	}
	if job.Status != db.ImportStatusSucceeded || job.Mode != db.ImportModeAPPLY {
		return nil
	}
	return s.noterBilanLeads(ctx, &job)
}

// Un relevé forcé après un déploiement relit un classeur déjà connu : il ne
// vaut pas un courriel. Le réglage ne sert qu'une fois.
func (s *service) releveSilencieux(ctx context.Context) bool {
	supprimes, err := s.Q.SupprimerAppSetting(ctx, cleReleveSilencieuxLeads)
	if err != nil {
		slog.Warn("relevé des leads : réglage de silence illisible", "err", err)
		return false
	}
	return supprimes > 0
}

func fichesCreeesLeads(creees int32) string {
	if creees == 1 {
		return fmt.Sprintf("%d nouvelle fiche", creees)
	}
	return fmt.Sprintf("%d nouvelles fiches", creees)
}

func resumeBilanLeads(bilan bilanLeads) string {
	if bilan.Creees > 0 {
		return fichesCreeesLeads(bilan.Creees)
	}
	if bilan.MisesAJour == 1 {
		return "1 fiche mise à jour"
	}
	return fmt.Sprintf("%d fiches mises à jour", bilan.MisesAJour)
}

type bilanLeads struct {
	Creees     int32  `json:"creees"`
	MisesAJour int32  `json:"misesAJour"`
	Travail    string `json:"travail"`
}

func (s *service) noterBilanLeads(ctx context.Context, job *db.ImportJob) error {
	bilan := bilanLeads{Travail: job.ID}
	existant, err := s.Q.AppSettingParCle(ctx, cleBilanLeads)
	if err == nil {
		if err := json.Unmarshal([]byte(existant.Value), &bilan); err != nil {
			return fmt.Errorf("bilan des leads illisible : %w", err)
		}
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	bilan.Creees += job.CreatedRows
	bilan.MisesAJour += job.UpdatedRows
	bilan.Travail = job.ID
	valeur, err := json.Marshal(bilan)
	if err != nil {
		return err
	}
	return s.Q.UpsertAppSetting(ctx, db.UpsertAppSettingParams{Key: cleBilanLeads, Value: string(valeur), UpdatedById: &job.RequestedById})
}

func (s *service) signalerBilanLeads(ctx context.Context) error {
	existant, err := s.Q.AppSettingParCle(ctx, cleBilanLeads)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	var bilan bilanLeads
	if err := json.Unmarshal([]byte(existant.Value), &bilan); err != nil {
		return fmt.Errorf("bilan des leads illisible : %w", err)
	}
	if bilan.Creees == 0 && bilan.MisesAJour == 0 {
		return nil
	}
	reglages, err := notifications.LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		return err
	}
	if err := notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          notifications.CourrielImportLeads,
		Sujet:         fmt.Sprintf("[Leads] %s, %s", resumeBilanLeads(bilan), time.Now().In(s.Cfg.TimeZone).Format("02/01/2006")),
		Destinataires: reglages.ImportLeads.Destinataires,
		Copies:        reglages.ImportLeads.Copies,
		ObjetType:     "import",
		ObjetID:       bilan.Travail,
		Titre:         "Bilan des leads",
		Intro:         "Les nouveaux leads sont disponibles pour le lancement d’une campagne.",
		Lignes: [][2]string{
			{"Leads créés", strconv.Itoa(int(bilan.Creees))},
			{"Fiches mises à jour", strconv.Itoa(int(bilan.MisesAJour))},
		},
		Lien:        socle.Env("PUBLIC_WEB_URL", "") + "/admin/imports",
		LibelleLien: "Voir le détail dans CPI GO",
	}); err != nil {
		return err
	}
	_, err = s.Q.SupprimerAppSetting(ctx, cleBilanLeads)
	return err
}

// SharePoint pose un cookie au premier passage et sert le classeur au second :
// le client suit les redirections en le gardant.
func telechargerLeads(ctx context.Context, lien string, maximum int64) (classeur []byte, nom string, err error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, "", err
	}
	client := &http.Client{Jar: jar, Timeout: delaiReleveLeads}
	//nolint:gosec // lien lu dans l'environnement par l'exploitant, jamais une entrée client
	requete, err := http.NewRequestWithContext(ctx, http.MethodGet, lienTelechargementLeads(lien), http.NoBody)
	if err != nil {
		return nil, "", err
	}
	reponse, err := client.Do(requete) //nolint:gosec // même lien, même raison
	if err != nil {
		return nil, "", err
	}
	defer func() { _ = reponse.Body.Close() }()
	if reponse.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("le lien répond %d : le partage « toute personne » a-t-il été retiré ?", reponse.StatusCode)
	}
	classeur, err = io.ReadAll(io.LimitReader(reponse.Body, maximum+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(classeur)) > maximum {
		return nil, "", fmt.Errorf("le classeur dépasse %d octets", maximum)
	}
	return classeur, nomLeads(reponse.Request.URL), nil
}

func lienTelechargementLeads(lien string) string {
	switch {
	case strings.Contains(lien, "download=1"):
		return lien
	case strings.Contains(lien, "?"):
		return lien + "&download=1"
	}
	return lien + "?download=1"
}

// Le nom vient de l'adresse finale : SharePoint n'envoie pas de Content-Disposition.
func nomLeads(finale *url.URL) string {
	nom := path.Base(finale.Path)
	if !strings.HasSuffix(strings.ToLower(nom), ".xlsx") {
		return nomLeadsParDefaut
	}
	return nom
}
