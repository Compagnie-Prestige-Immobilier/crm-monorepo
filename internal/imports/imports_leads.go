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
	libelleChampDate  = "Date"
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
func fichesCreeesLeads(creees int32) string {
	if creees <= 1 {
		return fmt.Sprintf("%d nouvelle fiche", creees)
	}
	return fmt.Sprintf("%d nouvelles fiches", creees)
}

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
	dateStr := time.Now().In(s.Cfg.TimeZone).Format("02/01/2006 à 15:04")
	valeurs := map[string]string{
		"fichier": job.FileName, "date": dateStr,
		"lues": strconv.Itoa(int(lues)), "creees": strconv.Itoa(int(job.CreatedRows)),
		"refusees": strconv.Itoa(int(job.ErrorRows)),
	}

	// Une ligne sans téléphone suffit à faire monter ErrorRows, et le classeur du
	// marketing en porte toujours une : exiger zéro anomalie titrait « Échec » un
	// relevé qui avait créé 167 fiches, et le privait de ses destinataires.
	estSucces := job.Status == db.ImportStatusSucceeded && job.Mode == db.ImportModeAPPLY

	// Le lecteur de ce relevé lance des campagnes, il ne corrige pas de classeur :
	// les lignes lues et refusées ne lui servent qu'à s'inquiéter. Elles restent
	// dans l'écran Imports et dans le courriel d'échec, qui part aux personnes en
	// copie. Le nom du fichier ne bouge jamais d'un jour à l'autre : en objet, il
	// donnait chaque matin le même message.
	if estSucces {
		return notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
			Type:          notifications.CourrielImportLeads,
			Sujet:         fmt.Sprintf("[Leads] %s, %s", fichesCreeesLeads(job.CreatedRows), time.Now().In(s.Cfg.TimeZone).Format("02/01/2006")),
			Destinataires: reglages.ImportLeads.Destinataires,
			Copies:        reglages.ImportLeads.Copies,
			ObjetType:     "import",
			ObjetID:       job.ID,
			Titre:         "Relevé des leads",
			Intro:         "Les nouveaux leads sont disponibles pour le lancement d’une campagne.",
			Lignes: [][2]string{
				{libelleChampDate, dateStr},
				{"Leads créés", valeurs["creees"]},
			},
			Lien:        socle.Env("PUBLIC_WEB_URL", "") + "/admin/imports",
			LibelleLien: "Voir le détail dans CPI GO",
		})
	}

	// Rien n'a été appliqué : seules les personnes en Cc sont prévenues, ce sont
	// elles qui corrigent le classeur.
	raisonErreur := "Simulation refusée ou anomalies détectées sur le fichier."
	if job.FailureMsg != nil && *job.FailureMsg != "" {
		raisonErreur = *job.FailureMsg
	} else if job.ErrorRows > 0 {
		raisonErreur = fmt.Sprintf("%d ligne(s) d'anomalie détectée(s) dans le classeur.", job.ErrorRows)
	}

	return notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          notifications.CourrielImportLeads,
		Sujet:         "[Leads] Échec du relevé des leads : " + job.FileName,
		Destinataires: reglages.ImportLeads.Copies, // Envoi uniquement aux personnes en Cc
		Copies:        nil,
		ObjetType:     "import",
		ObjetID:       job.ID,
		Titre:         "Échec du relevé des leads",
		Intro: fmt.Sprintf("Le traitement du fichier %s du %s n’a pas permis d’importer correctement le classeur des leads. Aucune campagne ne doit pouvoir être lancée à partir de ce fichier tant que l’import n’a pas été effectué avec succès.",
			job.FileName, dateStr),
		Lignes: [][2]string{
			{"Fichier", job.FileName},
			{libelleChampDate, dateStr},
			{"Leads lus", valeurs["lues"]},
			{"Leads créés", valeurs["creees"]},
			{"Statut", "Échec / Refusé"},
			{"Erreur", raisonErreur},
		},
		Lien:        socle.Env("PUBLIC_WEB_URL", "") + "/admin/imports",
		LibelleLien: "Consulter l'échec dans CPI GO",
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
