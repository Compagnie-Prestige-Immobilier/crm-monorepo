package main

import (
	"bytes"
	"context"
	"cpi-go/db"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const noteSuffixe = ".audio"

const noteBattementMinimum = 10 * time.Second

type noteReglages struct {
	dir       string
	maxOctets int64
	retention time.Duration
}

var noteConfig noteReglages

type noteCadence struct {
	mu  sync.Mutex
	vus map[string]time.Time
}

var noteBattements = &noteCadence{vus: map[string]time.Time{}}

func (c *noteCadence) tropTot(cle string, maintenant time.Time, minimum time.Duration) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, t := range c.vus {
		if maintenant.Sub(t) > time.Hour {
			delete(c.vus, k)
		}
	}
	if t, vu := c.vus[cle]; vu && maintenant.Sub(t) < minimum {
		return true
	}
	c.vus[cle] = maintenant
	return false
}

func noteMonterRoutes(api huma.API, s *service) {
	maxOctets, err := envInt("NOTE_VOCALE_MAX_SIZE_BYTES", 25_000_000)
	if err != nil {
		slog.Error("réglage des notes vocales", "err", err)
		maxOctets = 25_000_000
	}
	heures, err := envInt("NOTE_VOCALE_RETENTION_HOURS", 48)
	if err != nil {
		slog.Error("réglage des notes vocales", "err", err)
		heures = 48
	}
	noteConfig = noteReglages{
		dir:       env("NOTE_VOCALE_DIR", "./storage/notes-vocales"),
		maxOctets: int64(maxOctets),
		retention: time.Duration(heures) * time.Hour,
	}
	// huma répond 413 dès `MaxBodyBytes` atteint : la marge laisse le handler
	// voir le dépassement et rendre NOTE_VOCALE_TROP_LOURDE.
	huma.Register(api, huma.Operation{
		OperationID: "deposerNoteVocale", Method: http.MethodPost,
		Path:         "/api/v1/phase2/call-attempts/{id}/note-vocale",
		MaxBodyBytes: 2*noteConfig.maxOctets + 1,
	}, s.noteDeposer)
	huma.Register(api, huma.Operation{
		OperationID: "lireNoteVocale", Method: http.MethodGet,
		Path: "/api/v1/phase2/call-attempts/{id}/note-vocale",
	}, s.noteLire)
	huma.Register(api, huma.Operation{
		OperationID: "recordPresenceBeat", Method: http.MethodPost,
		Path: "/api/v1/presence/beat", DefaultStatus: http.StatusNoContent,
	}, s.notePresenceBattement)
}

var noteConteneurs = []struct {
	decalage int
	entete   []byte
	mime     string
}{
	{0, []byte{0x1a, 0x45, 0xdf, 0xa3}, "audio/webm"},
	{0, []byte("OggS"), "audio/ogg"},
	{4, []byte("ftyp"), "audio/mp4"},
}

// Le type déclaré par le navigateur ne fait pas foi : seules ces trois entêtes
// de conteneur sont acceptées, lues dans les douze premiers octets.
func noteTypeAudio(brut []byte) (string, bool) {
	for _, c := range noteConteneurs {
		fin := c.decalage + len(c.entete)
		if len(brut) >= fin && bytes.Equal(brut[c.decalage:fin], c.entete) {
			return c.mime, true
		}
	}
	return "", false
}

func noteNom(attemptID string) string {
	return filepath.Base(attemptID) + noteSuffixe
}

// `os.Root` enferme les accès dans le répertoire des notes : aucun nom, même
// forgé, n'en sort.
func noteRacine() (*os.Root, error) {
	if err := os.MkdirAll(noteConfig.dir, 0o700); err != nil {
		return nil, err
	}
	return os.OpenRoot(noteConfig.dir)
}

// L'auteur dépose et relit ; l'encadrement relit seulement.
func (s *service) noteAcces(ctx context.Context, attemptID string, depot bool) error {
	u := utilisateurCourant(ctx)
	auteur, err := s.q.AuteurDeLaTentative(ctx, attemptID)
	if errors.Is(err, pgx.ErrNoRows) {
		return problem(http.StatusNotFound, "CALL_ATTEMPT_NOT_FOUND", "Tentative d’appel introuvable.")
	}
	if err != nil {
		return err
	}
	if auteur == u.ID {
		return nil
	}
	if !depot && (u.Role == Admin || u.Role == Superviseur) {
		return nil
	}
	return problem(http.StatusForbidden, "NOTE_VOCALE_INTERDITE", "Cette note vocale ne vous appartient pas.")
}

type NoteVocaleInput struct {
	ID      string `path:"id" format:"uuid"`
	RawBody []byte `contentType:"audio/webm"`
}

type NoteVocaleOutput struct {
	Body struct {
		AttemptID string `json:"attemptId" format:"uuid"`
		Bytes     int64  `json:"bytes"`
	}
}

func noteResultat(attemptID string, octets int64) *NoteVocaleOutput {
	out := &NoteVocaleOutput{}
	out.Body.AttemptID, out.Body.Bytes = attemptID, octets
	return out
}

func (s *service) noteDeposer(ctx context.Context, in *NoteVocaleInput) (*NoteVocaleOutput, error) {
	if err := s.noteAcces(ctx, in.ID, true); err != nil {
		return nil, err
	}
	if int64(len(in.RawBody)) > noteConfig.maxOctets {
		return nil, problem(http.StatusBadRequest, "NOTE_VOCALE_TROP_LOURDE", "Cette note vocale dépasse la taille autorisée.")
	}
	if len(in.RawBody) == 0 {
		return nil, problem(http.StatusBadRequest, "NOTE_VOCALE_VIDE", "Cette note vocale est vide.")
	}
	if _, connu := noteTypeAudio(in.RawBody); !connu {
		return nil, problem(http.StatusBadRequest, "NOTE_VOCALE_INVALIDE", "Une note vocale doit être un fichier audio webm, ogg ou mp4.")
	}
	racine, err := noteRacine()
	if err != nil {
		return nil, err
	}
	defer func() { _ = racine.Close() }()
	nom := noteNom(in.ID)
	if deja, err := racine.Stat(nom); err == nil {
		return noteResultat(in.ID, deja.Size()), nil
	}
	if err := noteEcrire(racine, nom, in.RawBody); err != nil {
		return nil, err
	}
	return noteResultat(in.ID, int64(len(in.RawBody))), nil
}

// Écriture sous un nom temporaire exclusif puis `rename` : un dépôt interrompu
// ne laisse jamais un fichier tronqué sous le nom définitif.
func noteEcrire(racine *os.Root, nom string, contenu []byte) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	partiel := "." + id.String() + ".part"
	f, err := racine.OpenFile(partiel, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	_, err = f.Write(contenu)
	if err = errors.Join(err, f.Close()); err != nil {
		return errors.Join(err, racine.Remove(partiel))
	}
	if err := racine.Rename(partiel, nom); err != nil {
		return errors.Join(err, racine.Remove(partiel))
	}
	return nil
}

// `http.ServeContent` apporte `Range`, `ETag` et `Last-Modified`, dont
// l'élément `<audio>` a besoin pour se positionner dans la note vocale.
func (s *service) noteLire(ctx context.Context, in *QualificationIDInput) (*huma.StreamResponse, error) {
	if err := s.noteAcces(ctx, in.ID, false); err != nil {
		return nil, err
	}
	nom := noteNom(in.ID)
	racine, err := noteRacine()
	if err != nil {
		return nil, err
	}
	defer func() { _ = racine.Close() }()
	f, err := racine.Open(nom)
	if err != nil {
		return nil, problem(http.StatusNotFound, "NOTE_VOCALE_INTROUVABLE", "Aucune note vocale pour cette tentative.")
	}
	info, err := f.Stat()
	if err != nil {
		return nil, errors.Join(err, f.Close())
	}
	entete := make([]byte, 12)
	lus, _ := io.ReadFull(f, entete)
	mime, _ := noteTypeAudio(entete[:lus])
	return &huma.StreamResponse{Body: func(hc huma.Context) {
		defer func() { _ = f.Close() }()
		r, w := humago.Unwrap(hc)
		w.Header().Set("Content-Type", mime)
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeContent(w, r, nom, info.ModTime(), f)
	}}, nil
}

// Deux causes de suppression : l'AGE tient la durée de conservation,
// l'ORPHELIN rattrape une purge ou une fiche supprimée qui laisse le fichier.
func (s *service) balayerNotesVocales(ctx context.Context) error {
	entrees, err := os.ReadDir(noteConfig.dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	racine, err := noteRacine()
	if err != nil {
		return err
	}
	defer func() { _ = racine.Close() }()
	limite := time.Now().Add(-noteConfig.retention)
	survivants := make([]string, 0, len(entrees))
	expirees := 0
	for _, e := range entrees {
		if !strings.HasSuffix(e.Name(), noteSuffixe) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().After(limite) {
			survivants = append(survivants, strings.TrimSuffix(e.Name(), noteSuffixe))
			continue
		}
		if racine.Remove(e.Name()) == nil {
			expirees++
		}
	}
	orphelines, err := s.noteRetirerOrphelines(ctx, racine, survivants)
	if err != nil {
		return err
	}
	if expirees+orphelines > 0 {
		slog.Info("notes vocales retirées", "expirees", expirees, "orphelines", orphelines)
	}
	return nil
}

// Lecture GLOBALE : le fichier survit à la ligne, la question n'est pas « cette
// tentative m'est-elle visible » mais « existe-t-elle encore ».
func (s *service) noteRetirerOrphelines(ctx context.Context, racine *os.Root, survivants []string) (int, error) {
	if len(survivants) == 0 {
		return 0, nil
	}
	vivantes, err := s.q.TentativesVivantes(ctx, survivants)
	if err != nil {
		return 0, err
	}
	retirees := 0
	for _, id := range survivants {
		if slices.Contains(vivantes, id) {
			continue
		}
		if racine.Remove(noteNom(id)) == nil {
			retirees++
		}
	}
	return retirees, nil
}

func (s *service) notePresenceBattement(ctx context.Context, _ *struct{}) (*struct{}, error) {
	u := utilisateurCourant(ctx)
	maintenant := time.Now().UTC()
	recu := &struct{}{}
	if noteBattements.tropTot(u.ID, maintenant, noteBattementMinimum) {
		return recu, nil
	}
	if err := s.q.BattementAgent(ctx, db.BattementAgentParams{UserID: u.ID, At: &maintenant}); err != nil {
		return nil, err
	}
	return recu, s.q.TrancheDActivite(ctx, db.TrancheDActiviteParams{UserID: u.ID, At: maintenant})
}
