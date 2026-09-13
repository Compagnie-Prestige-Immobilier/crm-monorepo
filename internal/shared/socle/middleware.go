package socle

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

type (
	cleRequete     struct{}
	CleAdresse     struct{}
	cleUtilisateur struct{}
	cleAuteur      struct{}
)

// La garde d'accès résout la session APRÈS la journalisation, dans un contexte
// fils que l'appelant ne voit pas. Ce porteur redescend l'identité pour que la
// ligne dise qui a agi, sans quoi un journal d'incident ne nomme personne.
type auteurRequete struct {
	id   string
	role Role
}

func noterAuteur(ctx context.Context, u *Utilisateur) {
	if a, ok := ctx.Value(cleAuteur{}).(*auteurRequete); ok {
		a.id, a.role = u.ID, u.Role
	}
}

const cheminImports = "/api/v1/imports"

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

func EcrireProblem(w http.ResponseWriter, r *http.Request, p *ProblemError) {
	p.RequestID, _ = r.Context().Value(cleRequete{}).(string)
	corps, err := json.Marshal(p)
	if err != nil {
		corps = []byte(`{"status":500,"code":"INTERNAL_ERROR","message":"Une erreur interne est survenue."}`)
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(p.Status)
	_, _ = w.Write(corps) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter -- JSON problem+json, jamais du HTML
}

func JournalEtRecuperation(mux *http.ServeMux, next http.Handler, cfg *Config) http.Handler {
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
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		// `frame-ancestors 'self'` et non `'none'` : la visionneuse de pièces
		// affiche un PDF du panneau dans une iframe du panneau, et le lecteur PDF
		// de Chrome ouvre lui-même un cadre fils soumis à cette directive.
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'self'")
		ctx := context.WithValue(r.Context(), cleRequete{}, id)
		ctx = context.WithValue(ctx, CleAdresse{}, adresseClient(r, cfg.TrustProxy))
		securisee := r.TLS != nil || (cfg.TrustProxy && r.Header.Get("X-Forwarded-Proto") == "https")
		ctx = context.WithValue(ctx, CleSecurise{}, securisee)
		auteur := &auteurRequete{}
		ctx = context.WithValue(ctx, cleAuteur{}, auteur)
		rw := &reponse{ResponseWriter: w, statut: http.StatusOK}
		// `ReadTimeout` couvre le corps entier : 30 s ne suffisent pas à
		// téléverser un classeur proche de la limite depuis une liaison
		// sénégalaise, et la requête est coupée sans message utile.
		if strings.HasPrefix(r.URL.Path, cheminImports) {
			_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(10 * time.Minute))
		}
		r = r.WithContext(ctx)
		defer func() {
			if p := recover(); p != nil {
				// Sans la pile, une panique en production ne se corrige pas : le
				// message seul ne dit ni le fichier ni la ligne.
				slog.Error("panique", "requestId", id, "method", r.Method, "chemin", r.URL.Path,
					"panic", p, "pile", string(debug.Stack()))
				EcrireProblem(rw, r, Problem(http.StatusInternalServerError, "INTERNAL_ERROR", "Une erreur interne est survenue."))
			}
			ms := time.Since(debut).Milliseconds()
			journaliserRequete(r, motif, auteur, rw.statut, ms, id)
			compterRequete(motif, rw.statut, ms)
		}()
		next.ServeHTTP(rw, r)
	})
}

// Le panneau sonde ces routes en boucle, une par minute et par onglet ouvert,
// et le flux reste ouvert des heures. À INFO elles noyaient tout le reste ; un
// échec sur l'une d'elles remonte quand même, parce que le niveau suit l'issue.
var routesDeSondage = map[string]bool{
	"GET /api/v1/live":               true,
	"GET /api/v1/notifications/mine": true,
	routeSessionCourante:             true,
	"GET /health/ready":              true,
	"GET /health/live":               true,
}

func niveauRequete(motif string, statut int) slog.Level {
	switch {
	case statut >= http.StatusInternalServerError:
		return slog.LevelError
	case statut >= http.StatusBadRequest:
		return slog.LevelWarn
	case routesDeSondage[motif]:
		return slog.LevelDebug
	}
	return slog.LevelInfo
}

func journaliserRequete(r *http.Request, motif string, auteur *auteurRequete, statut int, ms int64, id string) {
	niveau := niveauRequete(motif, statut)
	if !slog.Default().Enabled(r.Context(), niveau) {
		return
	}
	champs := []any{
		"requestId", id, "method", r.Method, "pattern", motif, "chemin", r.URL.Path,
		"status", statut, "ms", ms,
	}
	if auteur.id != "" {
		champs = append(champs, "userId", auteur.id, "role", string(auteur.role))
	} else {
		champs = append(champs, "userId", "anonyme")
	}
	if adresse, _ := r.Context().Value(CleAdresse{}).(string); adresse != "" && statut >= http.StatusBadRequest {
		champs = append(champs, "adresse", adresse)
	}
	slog.Log(r.Context(), niveau, "http", champs...)
}

// Ce GET change l'état : il consomme et détruit le fichier de sauvegarde. Sans
// lui dans cette liste, SameSite=Lax envoie le cookie sur une navigation de
// premier niveau et un lien suffit à détruire le dump d'un ADMIN.
var getsQuiEcrivent = map[string]bool{"GET /api/v1/admin/database-dump/download": true}

func origineAutorisee(r *http.Request, motif string) bool {
	if !getsQuiEcrivent[motif] &&
		(r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions) {
		return true
	}
	origine := r.Header.Get("Origin")
	if origine == "" {
		origine = r.Header.Get("Referer")
	}
	// Comparer l'hôte parsé, pas un préfixe : `go-admin.cpi-chues.com.attaquant.tld`
	// passait le test du préfixe.
	u, err := url.Parse(origine)
	if err != nil || u.Host == "" {
		return false
	}
	return u.Host == r.Host && (u.Scheme == "https" || u.Scheme == "http")
}

// Une seule couche pour l'origine, la session et le rôle. Le motif apparié
// (`METHODE /chemin`) est la clé de `garde` ; le panneau statique n'en a pas.
// Cookie SameSite=Lax + même origine exigée sur toute écriture : le cookie
// `__Host-` seul laisse passer un sous-domaine voisin (OWASP CSRF).
func GarderAcces(mux *http.ServeMux, q *db.Queries) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, motif := mux.Handler(r)
		roles, gardee := Garde[motif]
		publique := gardee && Autorise(roles, Public)
		// Une route publique n'a pas de session à protéger : un webhook n'envoie pas d'origine.
		if !publique && !origineAutorisee(r, motif) {
			EcrireProblem(w, r, Problem(http.StatusForbidden, "FORBIDDEN", "Origine refusée."))
			return
		}
		if !gardee || publique {
			mux.ServeHTTP(w, r)
			return
		}
		jeton := JetonSession(r)
		if jeton == "" {
			EcrireProblem(w, r, Problem(http.StatusUnauthorized, "UNAUTHENTICATED", "Connexion requise."))
			return
		}
		u, err := utilisateurParSession(r.Context(), q, jeton)
		if err != nil {
			EcrireProblem(w, r, Problem(http.StatusUnauthorized, "SESSION_EXPIRED", "Session expirée. Reconnectez-vous."))
			return
		}
		if !Autorise(roles, u.Role) {
			EcrireProblem(w, r, Problem(http.StatusForbidden, "FORBIDDEN", "Accès refusé."))
			return
		}
		noterAuteur(r.Context(), &u)
		mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), cleUtilisateur{}, u)))
	})
}

type Limiteur struct {
	mu     sync.Mutex
	parCle map[string]*rate.Limiter
	vus    map[string]time.Time
	parMin int
}

// LimiterApi plafonne les requêtes de l'API par adresse et par minute
// (`API_GLOBAL_RATE_LIMIT`, 0 = sans plafond), comme la v1 le faisait.
func LimiterApi(cfg *Config, next http.Handler) http.Handler {
	if cfg.GlobalRate <= 0 {
		return next
	}
	limiteur := NouveauLimiteur(cfg.GlobalRate)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		adresse, _ := r.Context().Value(CleAdresse{}).(string)
		if strings.HasPrefix(r.URL.Path, "/api/") && !limiteur.Autorise(adresse) {
			EcrireProblem(w, r, Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de requêtes. Réessayez dans une minute."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func NouveauLimiteur(parMinute int) *Limiteur {
	return &Limiteur{parCle: map[string]*rate.Limiter{}, vus: map[string]time.Time{}, parMin: parMinute}
}

// Regarde sans consommer. Compter les connexions RÉUSSIES dans un seau par
// identifiant permettrait à un tiers d'enfermer dehors un collègue en brûlant
// son budget : seul un échec doit coûter un jeton.
func (l *Limiteur) Disponible(cle string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	lim, ok := l.parCle[cle]
	return !ok || lim.Tokens() >= 1
}

func (l *Limiteur) Autorise(cle string) bool {
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
