package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

type (
	cleRequete     struct{}
	cleAdresse     struct{}
	cleUtilisateur struct{}
)

var idRequeteValide = regexp.MustCompile(`^[\w-]{1,64}$`)

type reponse struct {
	http.ResponseWriter
	statut int
}

func (r *reponse) WriteHeader(code int) {
	r.statut = code
	r.ResponseWriter.WriteHeader(code)
}

// Sans `Unwrap`, `http.NewResponseController` ne trouve pas le Flusher et le
// flux SSE reste bloqué dans le tampon jusqu'à la fin de la requête.
func (r *reponse) Unwrap() http.ResponseWriter { return r.ResponseWriter }

func adresseClient(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
			return ip
		}
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			return strings.TrimSpace(parts[len(parts)-1])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func ecrireProblem(w http.ResponseWriter, r *http.Request, p *ProblemError) {
	p.RequestID, _ = r.Context().Value(cleRequete{}).(string)
	corps, err := json.Marshal(p)
	if err != nil {
		corps = []byte(`{"status":500,"code":"INTERNAL_ERROR","message":"Une erreur interne est survenue."}`)
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(p.Status)
	_, _ = w.Write(corps)
}

func journalEtRecuperation(mux *http.ServeMux, next http.Handler, cfg *config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		debut := time.Now()
		_, motif := mux.Handler(r)
		id := r.Header.Get("X-Request-Id")
		if !idRequeteValide.MatchString(id) {
			id = uuid.NewString()
		}
		w.Header().Set("X-Request-Id", id)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		ctx := context.WithValue(r.Context(), cleRequete{}, id)
		ctx = context.WithValue(ctx, cleAdresse{}, adresseClient(r, cfg.TrustProxy))
		rw := &reponse{ResponseWriter: w, statut: http.StatusOK}
		r = r.WithContext(ctx)
		defer func() {
			if p := recover(); p != nil {
				slog.Error("panique", "requestId", id, "panic", p)
				ecrireProblem(rw, r, problem(http.StatusInternalServerError, "INTERNAL_ERROR", "Une erreur interne est survenue."))
			}
			slog.Info("http", "requestId", id, "method", r.Method, "pattern", motif, "status", rw.statut, "ms", time.Since(debut).Milliseconds())
		}()
		next.ServeHTTP(rw, r)
	})
}

func origineAutorisee(r *http.Request) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return true
	}
	origine := r.Header.Get("Origin")
	if origine == "" {
		origine = r.Header.Get("Referer")
	}
	return strings.HasPrefix(origine, "https://"+r.Host) || strings.HasPrefix(origine, "http://"+r.Host)
}

// Une seule couche pour l'origine, la session et le rôle. Le motif apparié
// (`METHODE /chemin`) est la clé de `garde` ; le panneau statique n'en a pas.
// Cookie SameSite=Lax + même origine exigée sur toute écriture : le cookie
// `__Host-` seul laisse passer un sous-domaine voisin (OWASP CSRF).
func garderAcces(mux *http.ServeMux, s *service) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !origineAutorisee(r) {
			ecrireProblem(w, r, problem(http.StatusForbidden, "FORBIDDEN", "Origine refusée."))
			return
		}
		_, motif := mux.Handler(r)
		roles, gardee := garde[motif]
		if !gardee || autorise(roles, Public) {
			mux.ServeHTTP(w, r)
			return
		}
		cookie, err := r.Cookie(nomCookie)
		if err != nil || cookie.Value == "" {
			ecrireProblem(w, r, problem(http.StatusUnauthorized, "UNAUTHENTICATED", "Connexion requise."))
			return
		}
		u, err := s.utilisateurParSession(r.Context(), cookie.Value)
		if err != nil {
			ecrireProblem(w, r, problem(http.StatusUnauthorized, "SESSION_EXPIRED", "Session expirée. Reconnectez-vous."))
			return
		}
		if !autorise(roles, u.Role) {
			ecrireProblem(w, r, problem(http.StatusForbidden, "FORBIDDEN", "Accès refusé."))
			return
		}
		mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), cleUtilisateur{}, u)))
	})
}

type limiteur struct {
	mu     sync.Mutex
	parCle map[string]*rate.Limiter
	vus    map[string]time.Time
	parMin int
}

func nouveauLimiteur(parMinute int) *limiteur {
	return &limiteur{parCle: map[string]*rate.Limiter{}, vus: map[string]time.Time{}, parMin: parMinute}
}

func (l *limiteur) autorise(cle string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	maintenant := time.Now()
	for k, t := range l.vus {
		if maintenant.Sub(t) > 10*time.Minute {
			delete(l.vus, k)
			delete(l.parCle, k)
		}
	}
	lim, ok := l.parCle[cle]
	if !ok {
		lim = rate.NewLimiter(rate.Every(time.Minute/time.Duration(l.parMin)), l.parMin)
		l.parCle[cle] = lim
	}
	l.vus[cle] = maintenant
	return lim.Allow()
}
