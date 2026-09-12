package imports

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/socle"
	"crypto/sha256"
	"encoding/hex"
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
	cleEmpreinteLeads = "imports.leadsEmpreinte"
	nomLeadsParDefaut = "leads-marketing.xlsx"
	delaiReleveLeads  = 2 * time.Minute
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
	return s.signalerReleveLeads(ctx, jobID)
}

// Le bilan du relevé part aux adresses réglées côté admin, appliqué ou refusé :
// un classeur refusé se corrige d'autant plus vite qu'on le sait.
func (s *service) signalerReleveLeads(ctx context.Context, jobID string) error {
	job, err := s.Q.ImportJobByID(ctx, jobID)
	if err != nil {
		return err
	}
	reglages, err := notifications.LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		return err
	}
	lues := int32(0)
	if job.TotalRows != nil {
		lues = *job.TotalRows
	}
	valeurs := map[string]string{
		"fichier": job.FileName, "date": time.Now().In(s.Cfg.TimeZone).Format("02/01/2006 à 15:04"),
		"lues": strconv.Itoa(int(lues)), "creees": strconv.Itoa(int(job.CreatedRows)),
		"refusees": strconv.Itoa(int(job.ErrorRows)),
	}
	issue := "appliqué"
	if job.Status != db.ImportStatusSucceeded || job.Mode != db.ImportModeAPPLY {
		issue = "refusé"
	}
	return notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          notifications.CourrielImportLeads,
		Sujet:         "[Leads] Relevé " + issue + " : " + job.FileName,
		Destinataires: reglages.ImportLeads.Destinataires, Copies: reglages.ImportLeads.Copies,
		ObjetType: "import", ObjetID: job.ID,
		Titre: "Relevé des leads " + issue,
		Intro: notifications.IntroCourriel(&reglages.ImportLeads, notifications.AideImportLeads(), valeurs),
		Lignes: [][2]string{
			{"Fichier", job.FileName},
			{"Lignes lues", valeurs["lues"]},
			{"Fiches créées", valeurs["creees"]},
			{"Lignes refusées", valeurs["refusees"]},
			{"Issue", issue},
		},
		Lien: socle.Env("PUBLIC_WEB_URL", "") + "/admin/imports", LibelleLien: "Voir le détail dans CPI GO",
	})
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
