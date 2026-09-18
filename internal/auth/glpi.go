package auth

import (
	"context"
	"cpi-go/internal/shared/socle"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// Le panneau fournit l'identité au greffon « Single Sign-on » de GLPI, qui
// suit le flux OAuth2 par code puis lit le profil en JSON, sans jeton d'identité signé.
const (
	cheminRetourGlpi = "/plugins/singlesignon/front/callback.php/provider/1"
	dureeCodeGlpi    = time.Minute
	dureeJetonGlpi   = 5 * time.Minute
)

type ProfilGlpi struct {
	ID          string `json:"id"`
	Login       string `json:"login"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
}

type identiteGlpi struct {
	profil ProfilGlpi
	retour string
	expire time.Time
}

type fournisseurGlpi struct {
	*socle.Deps
	clientID, secret, retour string
	mu                       sync.Mutex
	codes, jetons            map[string]*identiteGlpi
}

type AutoriserGlpiInput struct {
	CookieInput
	ClientID    string `query:"client_id"`
	RedirectURI string `query:"redirect_uri"`
	State       string `query:"state"`
}

type RedirectionOutput struct {
	Status   int
	Location string `header:"Location"`
}

type JetonGlpiInput struct {
	RawBody []byte
}

type JetonGlpiOutput struct {
	CacheControl string `header:"Cache-Control"`
	Body         struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
	}
}

type ProfilGlpiInput struct {
	Authorization string `header:"Authorization"`
}

type ProfilGlpiOutput struct{ Body ProfilGlpi }

func monterGlpi(api huma.API, d *socle.Deps) {
	f := &fournisseurGlpi{
		Deps:     d,
		clientID: strings.TrimSpace(socle.Env("GLPI_SSO_CLIENT_ID", "")),
		secret:   strings.TrimSpace(socle.Env("GLPI_SSO_SECRET", "")),
		retour:   strings.TrimRight(strings.TrimSpace(socle.Env("GLPI_URL", "")), "/") + cheminRetourGlpi,
		codes:    map[string]*identiteGlpi{},
		jetons:   map[string]*identiteGlpi{},
	}
	huma.Register(api, huma.Operation{OperationID: "ouvrirGlpi", Method: http.MethodGet, Path: "/api/v1/auth/glpi/ouvrir"}, f.ouvrir)
	huma.Register(api, huma.Operation{OperationID: "autoriserGlpi", Method: http.MethodGet, Path: "/api/v1/auth/glpi/autoriser"}, f.autoriser)
	huma.Register(api, huma.Operation{OperationID: "jetonGlpi", Method: http.MethodPost, Path: "/api/v1/auth/glpi/jeton"}, f.jeton)
	huma.Register(api, huma.Operation{OperationID: "profilGlpi", Method: http.MethodGet, Path: "/api/v1/auth/glpi/profil"}, f.profil)
}

func (f *fournisseurGlpi) ouvrir(context.Context, *struct{}) (*RedirectionOutput, error) {
	if f.retour == cheminRetourGlpi {
		return nil, socle.Problem(http.StatusServiceUnavailable, "SUPPORT_NON_CONFIGURE", "La plateforme de support n'est pas encore reliée au panneau. Prévenez l'administrateur.")
	}
	return redirection(f.retour), nil
}

func (f *fournisseurGlpi) autoriser(ctx context.Context, in *AutoriserGlpiInput) (*RedirectionOutput, error) {
	if f.clientID == "" || f.secret == "" || f.retour == cheminRetourGlpi {
		return nil, socle.Problem(http.StatusServiceUnavailable, "SUPPORT_NON_CONFIGURE", "La plateforme de support n'est pas encore reliée au panneau. Prévenez l'administrateur.")
	}
	if in.ClientID != f.clientID || in.RedirectURI != f.retour {
		return nil, socle.Problem(http.StatusBadRequest, "SUPPORT_CLIENT_INCONNU", "Lien de connexion au support invalide.")
	}
	if f.Cfg.Base != socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "SUPPORT_BASE_DEMO", "La plateforme de support s'ouvre depuis la base principale.")
	}
	u, connecte := f.utilisateur(ctx, in.jeton())
	if !connecte {
		suite := "/api/v1/auth/glpi/autoriser?" + url.Values{"client_id": {in.ClientID}, "redirect_uri": {in.RedirectURI}, "state": {in.State}}.Encode()
		return redirection("/connexion?" + url.Values{"suite": {suite}}.Encode()), nil
	}
	retour := url.Values{"state": {in.State}}
	if !u.Peut(socle.PermissionSupportPlateforme) {
		retour.Set("error", "access_denied")
		retour.Set("error_description", "Votre rôle n'ouvre pas la plateforme de support.")
		return redirection(f.retour + "?" + retour.Encode()), nil
	}
	code := jetonAleatoire()
	f.ranger(f.codes, code, &identiteGlpi{
		profil: ProfilGlpi{ID: u.ID, Login: u.Username, Email: u.Email, DisplayName: u.FullName},
		retour: in.RedirectURI, expire: time.Now().Add(dureeCodeGlpi),
	})
	retour.Set("code", code)
	return redirection(f.retour + "?" + retour.Encode()), nil
}

func (f *fournisseurGlpi) jeton(_ context.Context, in *JetonGlpiInput) (*JetonGlpiOutput, error) {
	form, err := url.ParseQuery(string(in.RawBody))
	if err != nil || form.Get("grant_type") != "authorization_code" || f.secret == "" ||
		form.Get("client_id") != f.clientID ||
		subtle.ConstantTimeCompare([]byte(form.Get("client_secret")), []byte(f.secret)) != 1 {
		return nil, socle.Problem(http.StatusUnauthorized, "invalid_client", "Client refusé.")
	}
	identite, ok := f.prendre(f.codes, form.Get("code"), true)
	if !ok || identite.retour != form.Get("redirect_uri") {
		return nil, socle.Problem(http.StatusBadRequest, "invalid_grant", "Code expiré ou déjà utilisé.")
	}
	acces := jetonAleatoire()
	identite.expire = time.Now().Add(dureeJetonGlpi)
	f.ranger(f.jetons, acces, identite)
	out := &JetonGlpiOutput{CacheControl: "no-store"}
	out.Body.AccessToken, out.Body.TokenType, out.Body.ExpiresIn = acces, "Bearer", int(dureeJetonGlpi.Seconds())
	return out, nil
}

func (f *fournisseurGlpi) profil(_ context.Context, in *ProfilGlpiInput) (*ProfilGlpiOutput, error) {
	identite, ok := f.prendre(f.jetons, strings.TrimPrefix(in.Authorization, "Bearer "), false)
	if !ok {
		return nil, socle.Problem(http.StatusUnauthorized, "invalid_token", "Jeton expiré.")
	}
	return &ProfilGlpiOutput{Body: identite.profil}, nil
}

func (f *fournisseurGlpi) utilisateur(ctx context.Context, jeton string) (socle.Utilisateur, bool) {
	if jeton == "" {
		return socle.Utilisateur{}, false
	}
	u, err := socle.UtilisateurParSession(ctx, f.Q, f.Attributions, jeton)
	return u, err == nil
}

func (f *fournisseurGlpi) ranger(table map[string]*identiteGlpi, cle string, identite *identiteGlpi) {
	f.mu.Lock()
	defer f.mu.Unlock()
	maintenant := time.Now()
	for k, v := range table {
		if maintenant.After(v.expire) {
			delete(table, k)
		}
	}
	table[cle] = identite
}

func (f *fournisseurGlpi) prendre(table map[string]*identiteGlpi, cle string, unique bool) (*identiteGlpi, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	identite, ok := table[cle]
	if unique {
		delete(table, cle)
	}
	return identite, ok && cle != "" && time.Now().Before(identite.expire)
}

func redirection(location string) *RedirectionOutput {
	return &RedirectionOutput{Status: http.StatusFound, Location: location}
}

func jetonAleatoire() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
