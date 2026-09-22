package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"ticket-solver/internal/config"
	"ticket-solver/internal/doctor"
	"ticket-solver/internal/engine"
	"ticket-solver/internal/github"
	"ticket-solver/internal/glpi"
	"ticket-solver/internal/notify"
	"ticket-solver/internal/server"
	"ticket-solver/internal/solver"
	"ticket-solver/internal/state"
	"time"
)

func runHealthcheck(port int) bool {
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, fmt.Sprintf("http://127.0.0.1:%d/healthz", port), http.NoBody)
	if err != nil {
		return false
	}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode == http.StatusOK
}

func handleCLI(cfg *config.Config) (handled, ok bool) {
	for _, arg := range os.Args[1:] {
		switch arg {
		case "doctor":
			glpiClient := glpi.NewClient(cfg)
			ghClient := github.NewClient(cfg)
			if err := doctor.Run(context.Background(), cfg, glpiClient, ghClient); err != nil {
				return true, false
			}
			return true, true
		case "healthcheck":
			if !runHealthcheck(cfg.Port) {
				return true, false
			}
			return true, true
		}
	}
	return false, false
}

func getActiveAgents() []string {
	var configured []string
	for _, a := range config.Agents {
		if strings.TrimSpace(os.Getenv(a.EnvToken)) != "" {
			configured = append(configured, a.Name)
		}
	}
	return configured
}

func initGitHub(ctx context.Context, cfg *config.Config, ghClient *github.Client) error {
	for i := range cfg.Projects {
		p := &cfg.Projects[i]
		if _, err := ghClient.GetToken(ctx, p); err != nil {
			return fmt.Errorf("projet %s : %w", p.Name, err)
		}
	}
	return nil
}

func runPoller(stop <-chan os.Signal, engineInst *engine.Engine, httpSrv *server.Server, lastPoll *atomic.Int64, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	engineInst.Poll(context.Background())
	lastPoll.Store(time.Now().UnixNano())

	for {
		select {
		case <-stop:
			slog.Info("arrêt de Kairo demandé...")
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = httpSrv.Shutdown(shutdownCtx)
			cancel()
			return
		case <-ticker.C:
			func() {
				defer func() {
					if r := recover(); r != nil {
						slog.Error("panique lors du poll", "r", r)
					}
				}()
				engineInst.Poll(context.Background())
				lastPoll.Store(time.Now().UnixNano())
			}()
		}
	}
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "erreur configuration : %v\n", err)
		os.Exit(1)
	}

	if handled, ok := handleCLI(cfg); handled {
		if !ok {
			os.Exit(1)
		}
		return
	}

	setupLogging(cfg.LogLevel)

	if !cfg.Enabled {
		slog.Info("Kairo désactivé")
		return
	}

	if err := cfg.ValidateForDaemon(); err != nil {
		slog.Error("configuration invalide", "err", err)
		os.Exit(1)
	}

	activeAgents := getActiveAgents()
	if len(activeAgents) == 0 {
		slog.Error("aucun jeton d'agent configuré")
		os.Exit(1)
	}

	ghClient := github.NewClient(cfg)
	if err := initGitHub(context.Background(), cfg, ghClient); err != nil {
		slog.Error("erreur initialisation GitHub", "err", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(cfg.WorkRoot, 0o750); err != nil {
		slog.Error("erreur création répertoire de travail", "err", err)
		os.Exit(1)
	}

	cleanStaleJobs(cfg.WorkRoot)

	store, err := state.Open(cfg.StateDB)
	if err != nil {
		slog.Error("erreur ouverture base état", "err", err)
		os.Exit(1)
	}
	defer func() { _ = store.Close() }()

	var lastPoll atomic.Int64
	lastPoll.Store(time.Now().UnixNano())

	httpSrv := server.New(cfg, store, &lastPoll)
	go func() {
		if err := httpSrv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("erreur serveur HTTP", "err", err)
		}
	}()

	glpiClient := glpi.NewClient(cfg)
	notifClient := notify.NewClient(cfg)
	solverInst := solver.New(cfg, store, glpiClient, ghClient, notifClient)
	engineInst := engine.New(cfg, store, glpiClient, solverInst, &lastPoll)

	slog.Info("Kairo démarre", "ticketsParalleles", cfg.MaxConcurrentJobs, "agents", strings.Join(activeAgents, ", "))

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	runPoller(stop, engineInst, httpSrv, &lastPoll, cfg.PollInterval)
}

func setupLogging(level string) {
	var lvl slog.Level
	switch strings.ToUpper(level) {
	case "DEBUG":
		lvl = slog.LevelDebug
	case "WARN", "WARNING":
		lvl = slog.LevelWarn
	case "ERROR":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(handler))
}

func cleanStaleJobs(workRoot string) {
	entries, err := os.ReadDir(workRoot)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			_ = os.RemoveAll(filepath.Join(workRoot, e.Name()))
		}
	}
}
