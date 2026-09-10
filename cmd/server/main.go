package main

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"cpi-go/web"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/go-co-op/gocron/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SanteOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func nouvelleAPI(mux *http.ServeMux, d *socle.Deps, pool *pgxpool.Pool) (huma.API, error) {
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
	if err := monterDomaines(api, d); err != nil {
		return nil, err
	}
	socle.FusionnerGardes(gardesDomaines()...)
	return api, socle.VerifierGarde(api)
}

func servirPanneau(mux *http.ServeMux) {
	dist, _ := fs.Sub(web.Dist, "dist")
	fichiers := http.FileServerFS(dist)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			socle.EcrireProblem(w, r, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Route inconnue."))
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

func nouveauDeps(pool *pgxpool.Pool, cfg *socle.Config) *socle.Deps {
	return &socle.Deps{Q: db.New(pool), Pool: pool, Cfg: cfg, Live: socle.NouveauLive()}
}

func serveur(cfg *socle.Config, pool *pgxpool.Pool) (*http.Server, huma.API, *socle.Deps, error) {
	socle.InstallerErreurs()
	mux := http.NewServeMux()
	d := nouveauDeps(pool, cfg)
	api, err := nouvelleAPI(mux, d, pool)
	if err != nil {
		return nil, nil, nil, err
	}
	servirPanneau(mux)
	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           socle.JournalEtRecuperation(mux, socle.GarderAcces(mux, d.Q), cfg),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}, api, d, nil
}

func planifier(ctx context.Context, d *socle.Deps) (gocron.Scheduler, error) {
	sched, err := gocron.NewScheduler(gocron.WithLocation(d.Cfg.TimeZone))
	if err != nil {
		return nil, err
	}
	// Hôte d'essai à côté de la v1 sur la même base : deux planificateurs se
	// disputeraient notifications dues et jobs d'import.
	if socle.Env("TACHES_PLANIFIEES", socle.Vrai) == socle.Faux {
		slog.Warn("tâches planifiées désactivées", "variable", "TACHES_PLANIFIEES")
		sched.Start()
		return sched, nil
	}
	for _, t := range tachesDomaines(d) {
		_, err := sched.NewJob(gocron.CronJob(t.Cron, false), gocron.NewTask(func() {
			if err := t.Run(ctx); err != nil {
				slog.Error("tâche", "nom", t.Nom, "err", err)
			}
		}), gocron.WithName(t.Nom), gocron.WithSingletonMode(gocron.LimitModeReschedule))
		if err != nil {
			return nil, fmt.Errorf("tâche %s : %w", t.Nom, err)
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

func ecrireOpenAPI(cfg *socle.Config) error {
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

func ecrireRoles(cfg *socle.Config) error {
	if _, _, _, err := serveur(cfg, nil); err != nil {
		return err
	}
	doc, err := json.MarshalIndent(socle.Garde, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(doc))
	return nil
}

func run(ctx context.Context, openapi, roles, sonde, seed bool) error {
	cfg, err := socle.LireConfig()
	if err != nil {
		return err
	}
	slog.SetDefault(socle.Journal(cfg))
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
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	// Les listes joignent jusqu'à quatorze tables : au-delà de douze le planificateur
	// génétique replanifie chaque appel (82 ms mesurés pour 0,7 ms d'exécution).
	poolCfg.ConnConfig.RuntimeParams["join_collapse_limit"] = "1"
	poolCfg.ConnConfig.RuntimeParams["from_collapse_limit"] = "1"
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := database.Migrer(ctx, pool); err != nil {
		return fmt.Errorf("migrations : %w", err)
	}
	if seed {
		return semer(ctx, pool, cfg)
	}
	return servir(ctx, cfg, pool)
}

func servir(ctx context.Context, cfg *socle.Config, pool *pgxpool.Pool) error {
	srv, _, d, err := serveur(cfg, pool)
	if err != nil {
		return err
	}
	sched, err := planifier(ctx, d)
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
