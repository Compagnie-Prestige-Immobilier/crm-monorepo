package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"cpi-go/db"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

const (
	cleDump        = "admin.database.dump"
	dureeDeVieDump = 6 * time.Hour
	dureeMaxDump   = 30 * time.Minute

	dumpEnAttente = "queued"
	dumpEnCours   = "running"
	dumpPret      = "ready"
	dumpEchoue    = "failed"
	dumpExpire    = "expired"

	motifInterrompu = "L’export a été interrompu, probablement par un redémarrage du serveur. " +
		"Aucun fichier n’a été produit. Vous pouvez le relancer."
	pasPret = "DATABASE_DUMP_NOT_READY"
)

// Un seul binaire tourne : la ligne `app_settings` porte l'état entre deux
// démarrages, ce verrou arbitre les demandes concurrentes du même processus.
var verrouDump sync.Mutex

type travailDump struct {
	ID              string     `json:"id"`
	Status          string     `json:"status"`
	RequestedByID   string     `json:"requestedById"`
	RequestedByName string     `json:"requestedByName"`
	RequestedAt     time.Time  `json:"requestedAt"`
	StartedAt       *time.Time `json:"startedAt"`
	FinishedAt      *time.Time `json:"finishedAt"`
	FileName        string     `json:"fileName"`
	FileSize        *int64     `json:"fileSize"`
	Sha256          string     `json:"sha256"`
	ExpiresAt       *time.Time `json:"expiresAt"`
	FailureReason   string     `json:"failureReason"`
	NoticeStatus    string     `json:"noticeStatus"`
	NoticeDetail    string     `json:"noticeDetail"`
}

type EtatDump struct {
	ID              *string    `json:"id"`
	Status          string     `json:"status" enum:"idle,queued,running,ready,failed,expired"`
	RequestedByName *string    `json:"requestedByName"`
	RequestedAt     *time.Time `json:"requestedAt"`
	FinishedAt      *time.Time `json:"finishedAt"`
	FileSize        *int64     `json:"fileSize"`
	Sha256          *string    `json:"sha256"`
	ExpiresAt       *time.Time `json:"expiresAt"`
	FailureReason   *string    `json:"failureReason"`
	NoticeStatus    *string    `json:"noticeStatus"`
	NoticeDetail    *string    `json:"noticeDetail"`
	Downloadable    bool       `json:"downloadable"`
}

type EtatDumpOutput struct {
	Body EtatDump
}

func monterDump(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "getDatabaseDump", Method: http.MethodGet, Path: cheminDump}, s.etatDump)
	huma.Register(api, huma.Operation{OperationID: "requestDatabaseDump", Method: http.MethodPost, Path: cheminDump, DefaultStatus: http.StatusAccepted}, s.demanderDump)
	huma.Register(api, huma.Operation{OperationID: "downloadDatabaseDump", Method: http.MethodGet, Path: cheminDump + "/download"}, s.telechargerDump)
}

func dumpActif() error {
	if env("DB_DUMP_ENABLED", "false") == vrai {
		return nil
	}
	return problem(http.StatusNotFound, "DATABASE_DUMP_DISABLED", "L’export intégral n’est pas activé sur ce déploiement.")
}

func repertoireDump() string {
	return env("DB_DUMP_DIR", "./storage/db-dumps")
}

func texteDump(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

// Dit l'état réel horloge en main ; détruire le fichier revient à l'appelant.
func statutEffectifDump(t *travailDump, maintenant time.Time) string {
	if t.Status == dumpPret {
		if t.ExpiresAt == nil || !t.ExpiresAt.After(maintenant) {
			return dumpExpire
		}
		return dumpPret
	}
	if t.Status != dumpEnAttente && t.Status != dumpEnCours {
		return t.Status
	}
	depuis := t.RequestedAt
	if t.StartedAt != nil {
		depuis = *t.StartedAt
	}
	age := maintenant.Sub(depuis)
	if age > dureeMaxDump || age < -5*time.Minute {
		return dumpEchoue
	}
	return t.Status
}

// Une ligne illisible vaut « aucun export » : elle ne doit pas bloquer les suivants.
func travailStocke(valeur string) (travailDump, bool) {
	var t travailDump
	if json.Unmarshal([]byte(valeur), &t) != nil || t.ID == "" {
		return travailDump{}, false
	}
	return t, true
}

func (s *service) lireTravailDump(ctx context.Context) (travailDump, bool, error) {
	ligne, existe, err := s.reglage(ctx, cleDump)
	if err != nil || !existe {
		return travailDump{}, false, err
	}
	t, lisible := travailStocke(ligne.Value)
	return t, lisible, nil
}

func (s *service) ecrireTravailDump(ctx context.Context, t *travailDump, acteurID *string) error {
	brut, err := json.Marshal(t)
	if err != nil {
		return err
	}
	if _, err := s.q.UpsertSetting(ctx, db.UpsertSettingParams{Key: cleDump, Value: string(brut), UpdatedById: acteurID}); err != nil {
		return err
	}
	s.live.emettre("db-dump")
	return nil
}

func retirerFichierDump(t *travailDump) {
	if t.FileName == "" {
		return
	}
	if err := os.Remove(filepath.Join(repertoireDump(), filepath.Base(t.FileName))); err != nil && !errors.Is(err, os.ErrNotExist) {
		slog.Error("export de la base : fichier non détruit", "err", err)
	}
}

// Seul endroit qui détruit sur échéance et enterre un travail mort.
func (s *service) reconcilierDump(ctx context.Context) (travailDump, bool, error) {
	t, existe, err := s.lireTravailDump(ctx)
	if err != nil || !existe {
		return t, false, err
	}
	statut := statutEffectifDump(&t, time.Now())
	if statut == t.Status {
		return t, true, nil
	}
	if statut == dumpExpire {
		retirerFichierDump(&t)
		t.Status, t.FileName, t.FileSize, t.ExpiresAt = dumpExpire, "", nil, nil
		err := s.ecrireTravailDump(ctx, &t, nil)
		return t, true, err
	}
	fin := time.Now()
	t.Status, t.FinishedAt, t.FailureReason = statut, &fin, motifInterrompu
	err = s.ecrireTravailDump(ctx, &t, nil)
	return t, true, err
}

func versEtatDump(t *travailDump) EtatDump {
	etat := EtatDump{
		ID: &t.ID, Status: t.Status, RequestedByName: &t.RequestedByName,
		RequestedAt: &t.RequestedAt, FinishedAt: t.FinishedAt, Downloadable: t.Status == dumpPret,
	}
	if t.Status == dumpPret {
		etat.FileSize, etat.Sha256, etat.ExpiresAt = t.FileSize, texteDump(t.Sha256), t.ExpiresAt
	}
	if t.Status == dumpEchoue {
		etat.FailureReason = texteDump(t.FailureReason)
	}
	etat.NoticeStatus, etat.NoticeDetail = texteDump(t.NoticeStatus), texteDump(t.NoticeDetail)
	return etat
}

// L'avis part APRÈS `ready` : qui clique dans la seconde doit trouver un
// fichier. `INBOX_ONLY` est l'issue nominale, aucun e-mail ne part vers un
// ADMIN. Un avis manqué ne fait pas échouer un export réussi, mais il se voit.
func (s *service) aviserExportPret(ctx context.Context, t *travailDump, acteurID string) {
	_, err := s.composerNotification(ctx, acteurID, &CreationNotification{
		Title: "Export prêt", Body: "Téléchargez-le dans Paramètres > Export intégral.",
		Route: "/parametres", Category: string(db.NotificationCategorySYSTEME), Audience: string(db.NotificationAudienceUSERS), AudienceUserIDs: []string{acteurID},
	})
	if err != nil {
		t.NoticeStatus, t.NoticeDetail = "FAILED", err.Error()
		slog.Warn("export de la base : avis de fin non envoyé", "err", err)
		return
	}
	t.NoticeStatus, t.NoticeDetail = "INBOX_ONLY", ""
}

func reponseDump(t *travailDump, existe bool) *EtatDumpOutput {
	if !existe {
		return &EtatDumpOutput{Body: EtatDump{Status: "idle"}}
	}
	return &EtatDumpOutput{Body: versEtatDump(t)}
}

func (s *service) etatDump(ctx context.Context, _ *struct{}) (*EtatDumpOutput, error) {
	if err := dumpActif(); err != nil {
		return nil, err
	}
	t, existe, err := s.reconcilierDump(ctx)
	if err != nil {
		return nil, err
	}
	return reponseDump(&t, existe), nil
}

func (s *service) demanderDump(ctx context.Context, _ *struct{}) (*EtatDumpOutput, error) {
	if err := dumpActif(); err != nil {
		return nil, err
	}
	acteur := utilisateurCourant(ctx)
	verrouDump.Lock()
	defer verrouDump.Unlock()

	courant, existe, err := s.reconcilierDump(ctx)
	if err != nil {
		return nil, err
	}
	if existe && (courant.Status == dumpEnAttente || courant.Status == dumpEnCours) {
		return reponseDump(&courant, true), nil
	}
	// Une archive prête n'est pas remplacée en silence : cela tuerait le
	// transfert en cours et ferait réattendre celui qui a recliqué.
	if existe && courant.Status == dumpPret {
		return nil, problem(http.StatusConflict, "DATABASE_DUMP_ALREADY_READY",
			"Un export est déjà prêt au téléchargement. Téléchargez-le, ou attendez son échéance, avant d’en demander un autre.")
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	t := travailDump{
		ID: id.String(), Status: dumpEnAttente, RequestedByID: acteur.ID,
		RequestedByName: acteur.FullName, RequestedAt: time.Now(),
	}
	if err := s.ecrireTravailDump(ctx, &t, &acteur.ID); err != nil {
		return nil, err
	}
	if err := auditer(ctx, s.q, acteur.ID, "DATABASE_DUMP_REQUESTED", "database", acteur.ID, nil, map[string]any{"jobId": t.ID}); err != nil {
		return nil, err
	}
	balayerOrphelins("")
	// La copie appartient à la goroutine : le handler sérialise la sienne.
	copie := t
	go s.executerDump(context.WithoutCancel(ctx), &copie, acteur.ID)
	return reponseDump(&t, true), nil
}

func nomFichierDump(id string, at time.Time) string {
	return "cpi-base-" + at.UTC().Format("20060102150405") + "-" + id + ".sql.gz"
}

func (s *service) executerDump(ctx context.Context, t *travailDump, acteurID string) {
	debut := time.Now()
	t.Status, t.StartedAt, t.FileName = dumpEnCours, &debut, nomFichierDump(t.ID, debut)
	if err := s.ecrireTravailDump(ctx, t, &acteurID); err != nil {
		slog.Error("export de la base : état non écrit", "err", err)
		return
	}
	chemin := filepath.Join(repertoireDump(), t.FileName)
	taille, condensat, err := lancerPgDump(ctx, s.cfg.DatabaseURL, chemin)
	fin := time.Now()
	t.FinishedAt = &fin
	if err == nil {
		echeance := fin.Add(dureeDeVieDump)
		t.Status, t.FileSize, t.Sha256, t.ExpiresAt = dumpPret, &taille, condensat, &echeance
		s.aviserExportPret(ctx, t, acteurID)
	} else {
		// Un `.sql.gz` tronqué est indiscernable d'un export valide sur le volume.
		if err := os.Remove(chemin); err != nil && !errors.Is(err, os.ErrNotExist) {
			slog.Error("export de la base : fichier partiel non détruit", "err", err)
		}
		t.Status, t.FileName, t.FailureReason = dumpEchoue, "", err.Error()
		slog.Error("export de la base : échec", "err", err)
	}
	if err := s.ecrireTravailDump(ctx, t, &acteurID); err != nil {
		slog.Error("export de la base : état final non écrit", "err", err)
	}
}

// `pg_dump` sans shell, arguments constants, connexion par variables PG* :
// `DATABASE_URL` ne passe jamais en argument, où `ps` la lirait.
func lancerPgDump(ctx context.Context, dsn, destination string) (taille int64, condensat string, err error) {
	environnement, err := variablesPg(dsn)
	if err != nil {
		return 0, "", err
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
		return 0, "", err
	}
	//nolint:gosec // destination = répertoire de configuration + nom produit par le serveur, jamais une entrée client
	fichier, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return 0, "", err
	}
	defer func() { _ = fichier.Close() }()

	empreinte := sha256.New()
	gz, err := gzip.NewWriterLevel(io.MultiWriter(fichier, empreinte), gzip.BestCompression)
	if err != nil {
		return 0, "", err
	}
	var journal bytes.Buffer
	cmd := exec.CommandContext(ctx, "pg_dump", "--format=plain", "--no-owner", "--no-privileges", "--schema=public")
	cmd.Env = environnement
	cmd.Stdout = gz
	cmd.Stderr = &journal
	if err := cmd.Run(); err != nil {
		_ = gz.Close()
		return 0, "", errors.New("pg_dump : " + err.Error() + " " + tronquerJournal(journal.String(), 4000))
	}
	if err := gz.Close(); err != nil {
		return 0, "", err
	}
	info, err := fichier.Stat()
	if err != nil {
		return 0, "", err
	}
	return info.Size(), hex.EncodeToString(empreinte.Sum(nil)), nil
}

func tronquerJournal(v string, n int) string {
	v = strings.TrimSpace(v)
	if len(v) <= n {
		return v
	}
	return v[:n]
}

func variablesPg(dsn string) ([]string, error) {
	u, err := url.Parse(dsn)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		return nil, errors.New("DATABASE_URL n’est pas une URL postgresql://")
	}
	base := strings.TrimPrefix(u.Path, "/")
	if base == "" {
		return nil, errors.New("DATABASE_URL ne nomme aucune base de données")
	}
	port := u.Port()
	if port == "" {
		port = "5432"
	}
	mdp, _ := u.User.Password()
	environnement := []string{"PATH=" + os.Getenv("PATH")}
	// Une variable vide n'est pas posée : libpq retomberait sur elle plutôt que
	// sur ses propres défauts.
	for nom, valeur := range map[string]string{
		"PGHOST": u.Hostname(), "PGPORT": port, "PGUSER": u.User.Username(),
		"PGPASSWORD": mdp, "PGDATABASE": base, "PGSSLMODE": u.Query().Get("sslmode"),
	} {
		if valeur != "" {
			environnement = append(environnement, nom+"="+valeur)
		}
	}
	return environnement, nil
}

func (s *service) telechargerDump(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
	if err := dumpActif(); err != nil {
		return nil, err
	}
	acteur := utilisateurCourant(ctx)
	verrouDump.Lock()
	defer verrouDump.Unlock()

	t, existe, err := s.reconcilierDump(ctx)
	if err != nil {
		return nil, err
	}
	if !existe || t.Status != dumpPret || t.FileName == "" {
		return nil, problem(http.StatusNotFound, pasPret, "Aucun export n’est disponible au téléchargement.")
	}
	nom := filepath.Base(t.FileName)
	//nolint:gosec // nom relu de la ligne d'état, ramené à son basename : aucune entrée client
	fichier, err := os.Open(filepath.Join(repertoireDump(), nom))
	if err != nil {
		return nil, s.oublierFichierDump(ctx, &t)
	}
	info, err := fichier.Stat()
	if err != nil {
		_ = fichier.Close()
		return nil, err
	}
	travail := t
	return &huma.StreamResponse{Body: func(hctx huma.Context) {
		defer func() { _ = fichier.Close() }()
		hctx.SetHeader("Content-Type", "application/gzip")
		hctx.SetHeader("Content-Disposition", `attachment; filename="`+nom+`"`)
		hctx.SetHeader("Content-Length", strconv.FormatInt(info.Size(), 10))
		hctx.SetHeader("Cache-Control", "no-store")
		if _, err := io.Copy(hctx.BodyWriter(), fichier); err != nil {
			// Un envoi coupé garde le fichier : il reste re-téléchargeable.
			slog.Warn("export de la base : téléchargement interrompu", "err", err)
			return
		}
		s.consommerDump(context.WithoutCancel(ctx), &travail, acteur.ID, nom, info.Size())
	}}, nil
}

// La ligne annonce un fichier que le disque n'a pas : on remet l'état d'accord.
func (s *service) oublierFichierDump(ctx context.Context, t *travailDump) error {
	retirerFichierDump(t)
	t.Status, t.FileName = dumpExpire, ""
	if err := s.ecrireTravailDump(ctx, t, nil); err != nil {
		return err
	}
	return problem(http.StatusNotFound, pasPret, "Le fichier d’export n’est plus disponible. Relancez un export.")
}

// La trace est écrite APRÈS le dernier octet : un flux mort au premier octet
// laisserait une ligne affirmant que l'administrateur détient la base.
func (s *service) consommerDump(ctx context.Context, t *travailDump, acteurID, nom string, taille int64) {
	if err := auditer(ctx, s.q, acteurID, "DATABASE_DUMP_DOWNLOADED", "database", acteurID, nil,
		map[string]any{"jobId": t.ID, "fileName": nom, "fileSize": taille, "sha256": t.Sha256}); err != nil {
		slog.Error("export de la base : trace de téléchargement non écrite", "err", err)
	}
	retirerFichierDump(t)
	t.Status, t.FileName, t.FileSize, t.ExpiresAt = dumpExpire, "", nil, nil
	if err := s.ecrireTravailDump(ctx, t, &acteurID); err != nil {
		slog.Error("export de la base : état non écrit après téléchargement", "err", err)
	}
}

func balayerOrphelins(garder string) {
	entrees, err := os.ReadDir(repertoireDump())
	if err != nil {
		return
	}
	for _, entree := range entrees {
		if entree.Name() == garder {
			continue
		}
		if err := os.Remove(filepath.Join(repertoireDump(), entree.Name())); err != nil {
			slog.Warn("export de la base : orphelin non détruit", "err", err)
		}
	}
}

// Une échéance qui survit à un redémarrage ne peut pas tenir dans un minuteur.
func (s *service) balayerDumps(ctx context.Context) error {
	verrouDump.Lock()
	defer verrouDump.Unlock()
	t, existe, err := s.reconcilierDump(ctx)
	if err != nil {
		return err
	}
	garder := ""
	if existe && (t.Status == dumpPret || t.Status == dumpEnCours) {
		garder = filepath.Base(t.FileName)
	}
	balayerOrphelins(garder)
	return nil
}
