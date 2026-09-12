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
	"path"
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
	// Le panneau itère sur les listes sans garde : le contrat promet `[]`, jamais `null`.
	huma.DefaultArrayNullable = false
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
		chemin := strings.TrimPrefix(r.URL.Path, "/")
		if _, err := fs.Stat(dist, chemin); err == nil && chemin != "" {
			w.Header().Set("Cache-Control", cachePanneau(r.URL.Path))
			fichiers.ServeHTTP(w, r)
			return
		}
		if path.Ext(chemin) != "" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		r.URL.Path = "/"
		fichiers.ServeHTTP(w, r)
	})
}

func cachePanneau(chemin string) string {
	switch {
	case strings.HasPrefix(chemin, "/assets/"):
		return "public, max-age=31536000, immutable"
	case strings.HasPrefix(chemin, "/brand/"):
		return "public, max-age=86400"
	}
	return "no-cache"
}

func nouveauDeps(pool *pgxpool.Pool, cfg *socle.Config) *socle.Deps {
	return &socle.Deps{Q: db.New(pool), Pool: pool, Cfg: cfg, Live: socle.NouveauLive(), Bases: []string{cfg.Base}}
}

// Une instance par base : ses requêtes, son bus SSE, ses routes montées sur
// son propre mux. Le code métier ne sait pas qu'il en existe d'autres.
type instance struct {
	mux  *http.ServeMux
	api  huma.API
	deps *socle.Deps
}

func instancier(cfg *socle.Config, pool *pgxpool.Pool, bases []string) (*instance, error) {
	socle.InstallerErreurs()
	mux := http.NewServeMux()
	d := nouveauDeps(pool, cfg)
	d.Bases = bases
	api, err := nouvelleAPI(mux, d, pool)
	if err != nil {
		return nil, err
	}
	servirPanneau(mux)
	return &instance{mux: mux, api: api, deps: d}, nil
}

// Le cookie `cpi_base` choisit l'instance ; absent ou inconnu, la base
// publique. Un seul journal et un seul limiteur, une garde par base.
func assembler(cfg *socle.Config, instances map[string]*instance) *http.Server {
	gardes := make(map[string]http.Handler, len(instances))
	for nom, i := range instances {
		gardes[nom] = socle.GarderAcces(i.mux, i.deps.Q)
	}
	repartir := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		garde := gardes[socle.BasePublique]
		if c, err := r.Cookie(socle.NomCookieBase); err == nil {
			if g, ok := gardes[c.Value]; ok {
				garde = g
			}
		}
		garde.ServeHTTP(w, r)
	})
	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           socle.JournalEtRecuperation(instances[socle.BasePublique].mux, socle.LimiterApi(cfg, repartir), cfg),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
}

func serveur(cfg *socle.Config, pool *pgxpool.Pool) (*http.Server, huma.API, error) {
	i, err := instancier(cfg, pool, []string{cfg.Base})
	if err != nil {
		return nil, nil, err
	}
	return assembler(cfg, map[string]*instance{cfg.Base: i}), i.api, nil
}

func planifier(ctx context.Context, d *socle.Deps) (gocron.Scheduler, error) {
	sched, err := gocron.NewScheduler(gocron.WithLocation(d.Cfg.TimeZone))
	if err != nil {
		return nil, err
	}
	// Hôte d'essai à côté de la v1 sur la même base : deux planificateurs se
	// disputeraient notifications dues et jobs d'import.
	if socle.Env("TACHES_PLANIFIEES", socle.Vrai) == socle.Faux {
		slog.Warn("tâches planifiées désactivées", "variable", "TACHES_PLANIFIEES", "base", d.Cfg.Base)
		sched.Start()
		return sched, nil
	}
	for _, t := range tachesDomaines(d) {
		_, err := sched.NewJob(gocron.CronJob(t.Cron, false), gocron.NewTask(func() {
			tracerPassage(ctx, d, t)
		}), gocron.WithName(t.Nom), gocron.WithSingletonMode(gocron.LimitModeReschedule))
		if err != nil {
			return nil, fmt.Errorf("tâche %s : %w", t.Nom, err)
		}
	}
	sched.Start()
	return sched, nil
}

// La ligne est ouverte avant de lancer la tâche : une tâche bloquée ou coupée
// par un redémarrage laisse une ligne sans `fin`, pas le silence d'avant.
func tracerPassage(ctx context.Context, d *socle.Deps, t socle.Tache) {
	debut := time.Now()
	id, errOuverture := d.Q.CronRunDebut(ctx, db.CronRunDebutParams{Nom: t.Nom, Debut: debut})
	if errOuverture != nil {
		slog.Warn("passage de tâche non ouvert", "nom", t.Nom, "base", d.Cfg.Base, "err", errOuverture)
	}
	echec := t.Run(ctx)
	if echec != nil {
		slog.Error("tâche", "nom", t.Nom, "base", d.Cfg.Base, "err", echec)
	}
	if errOuverture != nil {
		return
	}
	fin := db.CronRunFinParams{ID: id, Fin: time.Now(), DureeMs: time.Since(debut).Milliseconds(), Ok: echec == nil}
	if echec != nil {
		message := echec.Error()
		fin.Erreur = &message
	}
	if err := d.Q.CronRunFin(ctx, fin); err != nil {
		slog.Warn("passage de tâche non clos", "nom", t.Nom, "base", d.Cfg.Base, "err", err)
	}
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
	_, api, err := serveur(cfg, nil)
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
	if _, _, err := serveur(cfg, nil); err != nil {
		return err
	}
	doc, err := json.MarshalIndent(socle.Garde, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(doc))
	return nil
}

func ouvrirBase(ctx context.Context, url string) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	// Les listes joignent jusqu'à quatorze tables : au-delà de douze le planificateur
	// génétique replanifie chaque appel (82 ms mesurés pour 0,7 ms d'exécution).
	poolCfg.ConnConfig.RuntimeParams["join_collapse_limit"] = "1"
	poolCfg.ConnConfig.RuntimeParams["from_collapse_limit"] = "1"
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}
	if err := database.Migrer(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrations : %w", err)
	}
	return pool, nil
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
	if seed {
		for _, base := range socle.Bases(cfg) {
			pool, err := ouvrirBase(ctx, base.DatabaseURL)
			if err != nil {
				return fmt.Errorf("base %s : %w", base.Base, err)
			}
			err = semer(ctx, pool, base)
			pool.Close()
			if err != nil {
				return fmt.Errorf("base %s : %w", base.Base, err)
			}
		}
		return nil
	}
	return servir(ctx, cfg)
}

func servir(ctx context.Context, cfg *socle.Config) error {
	bases := socle.Bases(cfg)
	noms := make([]string, 0, len(bases))
	for _, b := range bases {
		noms = append(noms, b.Base)
	}
	instances := make(map[string]*instance, len(bases))
	var fermer []func()
	defer func() {
		for i := len(fermer) - 1; i >= 0; i-- {
			fermer[i]()
		}
	}()
	for _, base := range bases {
		pool, err := ouvrirBase(ctx, base.DatabaseURL)
		if err != nil {
			return fmt.Errorf("base %s : %w", base.Base, err)
		}
		fermer = append(fermer, pool.Close)
		i, err := instancier(base, pool, noms)
		if err != nil {
			return err
		}
		sched, err := planifier(ctx, i.deps)
		if err != nil {
			return err
		}
		fermer = append(fermer, func() { _ = sched.Shutdown() })
		instances[base.Base] = i
	}
	// Un seul journal de requêtes pour toutes les bases : ses compteurs se
	// vident dans la base publique, celle du mux qui porte le middleware.
	go socle.ViderMetriquesChaqueMinute(ctx, instances[socle.BasePublique].deps.Q)
	srv := assembler(cfg, instances)
	erreurs := make(chan error, 1)
	go func() {
		slog.Info("démarrage", "port", cfg.Port, "url", "http://localhost:"+cfg.Port, "bases", noms)
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
