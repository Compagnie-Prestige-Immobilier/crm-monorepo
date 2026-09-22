package server

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"ticket-solver/internal/config"
	"ticket-solver/internal/state"
	"time"
)

type Server struct {
	cfg        *config.Config
	state      *state.Store
	httpServer *http.Server
	lastPoll   *atomic.Int64
}

var relanceRegex = regexp.MustCompile(`^/tickets/(\d+)/relance$`)

func New(cfg *config.Config, s *state.Store, lastPoll *atomic.Int64) *Server {
	srv := &Server{
		cfg:      cfg,
		state:    s,
		lastPoll: lastPoll,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/readyz", srv.handleHealth)
	mux.HandleFunc("/etat", srv.handleEtat)
	mux.HandleFunc("/pause", srv.handlePause)
	mux.HandleFunc("/reprise", srv.handleReprise)
	mux.HandleFunc("/", srv.handleRoot)

	srv.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	return srv
}

func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) isHealthy() bool {
	last := s.lastPoll.Load()
	if last == 0 {
		return true
	}
	elapsed := time.Since(time.Unix(0, last))
	maxThreshold := 300 * time.Second
	pollThreshold := s.cfg.PollInterval * 5
	if pollThreshold > maxThreshold {
		maxThreshold = pollThreshold
	}
	return elapsed < maxThreshold
}

func (s *Server) checkAdmin(r *http.Request) bool {
	token := s.cfg.AdminToken
	if token == "" {
		return false
	}
	auth := r.Header.Get("Authorization")
	given := strings.TrimPrefix(auth, "Bearer ")
	return subtle.ConstantTimeCompare([]byte(given), []byte(token)) == 1
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("erreur encodage JSON réponse", "err", err)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	if s.isHealthy() {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "polling bloqué"})
}

func (s *Server) handleEtat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !s.checkAdmin(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	healthy := s.isHealthy()
	var pauseDepuis *string
	if depuis, ok, _ := s.state.PausedSince(r.Context()); ok {
		pauseDepuis = &depuis
	}

	last := s.lastPoll.Load()
	lastSec := 0
	if last > 0 {
		lastSec = int(time.Since(time.Unix(0, last)).Seconds())
	}

	var activeAgents []string
	for _, spec := range config.Agents {
		if strings.TrimSpace(os.Getenv(spec.EnvToken)) != "" {
			activeAgents = append(activeAgents, spec.Name)
		}
	}

	records, _ := s.state.Recent(r.Context())
	tickets := make([]state.JobRecord, 0, len(records))
	glpiURL := strings.TrimRight(s.cfg.GLPIURL, "/")
	for _, rec := range records {
		rec.Link = fmt.Sprintf("%s/front/ticket.form.php?id=%d", glpiURL, rec.TicketID)
		tickets = append(tickets, rec)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sain":                    healthy,
		"pauseDepuis":             pauseDepuis,
		"derniereLectureSecondes": lastSec,
		"intervalleSecondes":      int(s.cfg.PollInterval.Seconds()),
		"agents":                  activeAgents,
		"tickets":                 tickets,
	})
}

func (s *Server) setPause(w http.ResponseWriter, r *http.Request, active bool, logMsg string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !s.checkAdmin(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if err := s.state.Pause(r.Context(), active); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	slog.Info(logMsg)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePause(w http.ResponseWriter, r *http.Request) {
	s.setPause(w, r, true, "Kairo en pause depuis le CRM")
}

func (s *Server) handleReprise(w http.ResponseWriter, r *http.Request) {
	s.setPause(w, r, false, "Kairo repris depuis le CRM")
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	matches := relanceRegex.FindStringSubmatch(r.URL.Path)
	if len(matches) != 2 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if !s.checkAdmin(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(matches[1])
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	ok, err := s.state.Relaunch(r.Context(), id)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !ok {
		writeJSON(w, http.StatusConflict, map[string]string{"erreur": "seul un ticket en échec ou escaladé se relance"})
		return
	}

	slog.Info("relance demandée depuis le CRM", "ticket", id)
	w.WriteHeader(http.StatusNoContent)
}
