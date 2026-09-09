package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/go-co-op/gocron/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed all:web/dist
var panneau embed.FS

//go:embed sql/migrations/*.sql
var migrations embed.FS

type config struct {
	Port        string
	DatabaseURL string
	SessionTTL  time.Duration
	LoginRate   int
	TrustProxy  bool
	PasswordMin int
	PasswordMax int
	LogLevel    slog.Level
	LogFormat   string
	PhoneRegion string
	TimeZone    *time.Location
}

func env(nom, defaut string) string {
	if v := os.Getenv(nom); v != "" {
		return v
	}
	return defaut
}

func envInt(nom string, defaut int) (int, error) {
	n, err := strconv.Atoi(env(nom, strconv.Itoa(defaut)))
	if err != nil {
		return 0, fmt.Errorf("%s doit être un entier", nom)
	}
	return n, nil
}

func lireConfig() (*config, error) {
	cfg := &config{
		Port:        env("PORT", "4000"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		TrustProxy:  env("API_TRUST_PROXY_HEADERS", faux) == vrai,
		LogFormat:   env("LOG_FORMAT", "json"),
		PhoneRegion: strings.ToUpper(env("PHONE_DEFAULT_REGION", "SN")),
	}
	if err := cfg.LogLevel.UnmarshalText([]byte(strings.ToUpper(env("LOG_LEVEL", "info")))); err != nil {
		return nil, fmt.Errorf("LOG_LEVEL : %w", err)
	}
	tz, err := time.LoadLocation(env("BUSINESS_TIME_ZONE", "Africa/Dakar"))
	if err != nil {
		return nil, fmt.Errorf("BUSINESS_TIME_ZONE : %w", err)
	}
	cfg.TimeZone = tz
	var jours int
	entiers := []struct {
		nom    string
		defaut int
		cible  *int
	}{
		{"SESSION_TTL_DAYS", 30, &jours},
		{"AUTH_LOGIN_RATE_LIMIT", 10, &cfg.LoginRate},
		{"PASSWORD_MIN_LENGTH", 8, &cfg.PasswordMin},
		{"PASSWORD_MAX_LENGTH", 24, &cfg.PasswordMax},
	}
	for _, e := range entiers {
		if *e.cible, err = envInt(e.nom, e.defaut); err != nil {
			return nil, err
		}
	}
	cfg.SessionTTL = time.Duration(jours) * 24 * time.Hour
	return cfg, nil
}

func journal(cfg *config) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.LogFormat == "text" {
		return slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts))
}

type SanteOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func nouvelleAPI(mux *http.ServeMux, s *service, pool *pgxpool.Pool) (huma.API, error) {
	conf := huma.DefaultConfig("CPI GO", "2.0.0")
	conf.DocsPath, conf.OpenAPIPath, conf.SchemasPath = "", "", ""
	conf.CreateHooks = nil
	api := humago.New(mux, conf)

	huma.Get(api, "/health/ready", func(ctx context.Context, _ *struct{}) (*SanteOutput, error) {
		if err := pool.Ping(ctx); err != nil {
			return nil, huma.Error503ServiceUnavailable("Base de données injoignable")
		}
		out := &SanteOutput{}
		out.Body.Status = "ok"
		return out, nil
	})
	monterDomaines(api, s)
	fusionnerGardes(gardesDomaines()...)
	return api, verifierGarde(api)
}

func servirPanneau(mux *http.ServeMux) {
	dist, _ := fs.Sub(panneau, "web/dist")
	fichiers := http.FileServerFS(dist)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			ecrireProblem(w, r, problem(http.StatusNotFound, "NOT_FOUND", "Route inconnue."))
			return
		}
		if _, err := fs.Stat(dist, strings.TrimPrefix(r.URL.Path, "/")); err == nil && r.URL.Path != "/" {
			fichiers.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fichiers.ServeHTTP(w, r)
	})
}

func migrer(ctx context.Context, pool *pgxpool.Pool) error {
	goose.SetBaseFS(migrations)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	sqlDB := stdlib.OpenDBFromPool(pool)
	return errors.Join(goose.UpContext(ctx, sqlDB, "sql/migrations"), sqlDB.Close())
}

func serveur(cfg *config, pool *pgxpool.Pool) (*http.Server, huma.API, *service, error) {
	installerErreurs()
	mux := http.NewServeMux()
	s, err := nouveauService(pool, cfg)
	if err != nil {
		return nil, nil, nil, err
	}
	api, err := nouvelleAPI(mux, s, pool)
	if err != nil {
		return nil, nil, nil, err
	}
	servirPanneau(mux)
	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           journalEtRecuperation(mux, garderAcces(mux, s), cfg),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}, api, s, nil
}

func planifier(ctx context.Context, s *service) (gocron.Scheduler, error) {
	sched, err := gocron.NewScheduler(gocron.WithLocation(s.cfg.TimeZone))
	if err != nil {
		return nil, err
	}
	for _, t := range tachesDomaines(s) {
		_, err := sched.NewJob(gocron.CronJob(t.cron, false), gocron.NewTask(func() {
			if err := t.run(ctx); err != nil {
				slog.Error("tâche", "nom", t.nom, "err", err)
			}
		}), gocron.WithName(t.nom), gocron.WithSingletonMode(gocron.LimitModeReschedule))
		if err != nil {
			return nil, fmt.Errorf("tâche %s : %w", t.nom, err)
		}
	}
	sched.Start()
	return sched, nil
}

func sonder(ctx context.Context, port string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:"+port+"/health/ready", http.NoBody)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("statut %d", resp.StatusCode)
	}
	return nil
}

func ecrireOpenAPI(cfg *config) error {
	_, api, _, err := serveur(cfg, nil)
	if err != nil {
		return err
	}
	doc, err := api.OpenAPI().MarshalJSON()
	if err != nil {
		return err
	}
	fmt.Println(string(doc))
	return nil
}

func ecrireRoles(cfg *config) error {
	if _, _, _, err := serveur(cfg, nil); err != nil {
		return err
	}
	doc, err := json.MarshalIndent(garde, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(doc))
	return nil
}

func run(ctx context.Context, openapi, roles, sonde, seed bool) error {
	cfg, err := lireConfig()
	if err != nil {
		return err
	}
	slog.SetDefault(journal(cfg))
	if openapi {
		return ecrireOpenAPI(cfg)
	}
	if roles {
		return ecrireRoles(cfg)
	}
	if sonde {
		return sonder(ctx, cfg.Port)
	}
	if cfg.DatabaseURL == "" {
		return errors.New("DATABASE_URL manquante")
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := migrer(ctx, pool); err != nil {
		return fmt.Errorf("migrations : %w", err)
	}
	if seed {
		return semer(ctx, pool, cfg)
	}
	return servir(ctx, cfg, pool)
}

func servir(ctx context.Context, cfg *config, pool *pgxpool.Pool) error {
	srv, _, s, err := serveur(cfg, pool)
	if err != nil {
		return err
	}
	sched, err := planifier(ctx, s)
	if err != nil {
		return err
	}
	defer func() { _ = sched.Shutdown() }()
	erreurs := make(chan error, 1)
	go func() {
		slog.Info("démarrage", "port", cfg.Port, "url", "http://localhost:"+cfg.Port)
		erreurs <- srv.ListenAndServe()
	}()
	select {
	case err := <-erreurs:
		return err
	case <-ctx.Done():
		arret, annuler := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
		defer annuler()
		return srv.Shutdown(arret)
	}
}

func main() {
	openapi := flag.Bool("openapi", false, "écrit le document OpenAPI sur stdout")
	roles := flag.Bool("roles", false, "écrit la matrice route x rôles en JSON sur stdout")
	sonde := flag.Bool("healthcheck", false, "interroge /health/ready et sort 0 ou 1")
	seed := flag.Bool("seed", false, "sème référentiels, workflow bancaire et compte admin, puis sort")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	err := run(ctx, *openapi, *roles, *sonde, *seed)
	stop()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("arrêt sur erreur", "err", err)
		os.Exit(1)
	}
}
