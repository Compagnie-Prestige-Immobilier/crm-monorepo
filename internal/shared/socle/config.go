package socle

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	BasePublique  = "public"
	NomCookieBase = "cpi_base"
)

type Config struct {
	Port        string
	Base        string
	DatabaseURL string
	SessionTTL  time.Duration
	LoginRate   int
	GlobalRate  int
	TrustProxy  bool
	PasswordMin int
	PasswordMax int
	LogLevel    slog.Level
	LogFormat   string
	PhoneRegion string
	TimeZone    *time.Location
}

func Env(nom, defaut string) string {
	if v := os.Getenv(nom); v != "" {
		return v
	}
	return defaut
}

func EnvInt(nom string, defaut int) (int, error) {
	n, err := strconv.Atoi(Env(nom, strconv.Itoa(defaut)))
	if err != nil {
		return 0, fmt.Errorf("%s doit être un entier", nom)
	}
	return n, nil
}

func LireConfig() (*Config, error) {
	cfg := &Config{
		Port:        Env("PORT", "4000"),
		Base:        BasePublique,
		DatabaseURL: os.Getenv("DATABASE_URL"),
		TrustProxy:  Env("API_TRUST_PROXY_HEADERS", Faux) == Vrai,
		LogFormat:   Env("LOG_FORMAT", "json"),
		PhoneRegion: strings.ToUpper(Env("PHONE_DEFAULT_REGION", "SN")),
	}
	if err := cfg.LogLevel.UnmarshalText([]byte(strings.ToUpper(Env("LOG_LEVEL", "info")))); err != nil {
		return nil, fmt.Errorf("LOG_LEVEL : %w", err)
	}
	tz, err := time.LoadLocation(Env("BUSINESS_TIME_ZONE", "Africa/Dakar"))
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
		{"API_GLOBAL_RATE_LIMIT", 0, &cfg.GlobalRate},
		{"PASSWORD_MIN_LENGTH", 8, &cfg.PasswordMin},
		{"PASSWORD_MAX_LENGTH", 128, &cfg.PasswordMax},
	}
	for _, e := range entiers {
		if *e.cible, err = EnvInt(e.nom, e.defaut); err != nil {
			return nil, err
		}
	}
	if jours <= 0 {
		return nil, errors.New("SESSION_TTL_DAYS doit être positif")
	}
	cfg.SessionTTL = time.Duration(jours) * 24 * time.Hour
	return cfg, nil
}

// Une base de plus par variable `DATABASE_URL_<NOM>` à côté de `DATABASE_URL`,
// la base publique ; le nom en minuscules est la valeur du cookie `cpi_base`.
func Bases(cfg *Config) []*Config {
	bases := []*Config{cfg}
	for _, kv := range os.Environ() {
		nom, url, _ := strings.Cut(kv, "=")
		if !strings.HasPrefix(nom, "DATABASE_URL_") || url == "" {
			continue
		}
		c := *cfg
		c.Base, c.DatabaseURL = strings.ToLower(strings.TrimPrefix(nom, "DATABASE_URL_")), url
		bases = append(bases, &c)
	}
	slices.SortFunc(bases[1:], func(a, b *Config) int { return strings.Compare(a.Base, b.Base) })
	return bases
}

func Journal(cfg *Config) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.LogFormat == "text" {
		return slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts))
}
