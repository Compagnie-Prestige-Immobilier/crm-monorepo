package socle

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port        string
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
		{"PASSWORD_MAX_LENGTH", 24, &cfg.PasswordMax},
	}
	for _, e := range entiers {
		if *e.cible, err = EnvInt(e.nom, e.defaut); err != nil {
			return nil, err
		}
	}
	cfg.SessionTTL = time.Duration(jours) * 24 * time.Hour
	return cfg, nil
}

func Journal(cfg *Config) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.LogFormat == "text" {
		return slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts))
}
