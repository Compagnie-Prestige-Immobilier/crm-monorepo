package auth

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type service struct {
	*socle.Deps
	leurre string
	// Deux compteurs : par adresse contre un seul attaquant, par identifiant
	// contre une attaque distribuée qui, sans lui, a un budget illimité sur un
	// compte donné.
	tentatives   *socle.Limiteur
	parIdentifie *socle.Limiteur
}

// `maxAge` en secondes ; -1 efface le cookie (Max-Age=0), ce qu'une durée négative
// convertie en secondes n'obtenait pas.
func cookieSession(ctx context.Context, jeton string, maxAge int) http.Cookie {
	c := http.Cookie{Name: socle.NomCookie, Value: jeton, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge} //nolint:gosec // G124 : hors TLS (poste de développement, téléphone sur le réseau local) un cookie Secure serait jeté par le navigateur ; choix du propriétaire du 10 septembre 2026
	if !socle.ConnexionSecurisee(ctx) {
		c.Name, c.Secure = socle.NomCookieClair, false
	}
	return c
}

// La session arrive sous l'un ou l'autre nom de cookie selon le transport.
type CookieInput struct {
	Session      string `cookie:"__Host-cpi_session"`
	SessionClair string `cookie:"cpi_session"`
}

func (in *CookieInput) jeton() string {
	if in.Session != "" {
		return in.Session
	}
	return in.SessionClair
}

type LoginInput struct {
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Identifier string `json:"identifier" minLength:"1" maxLength:"254"`
		Password   string `json:"password" minLength:"1" maxLength:"1024"`
	}
}

type DemoLoginInput struct {
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Role string `json:"role" minLength:"1" maxLength:"32"`
	}
}

var demoProfiles = map[string]struct {
	email string
	role  db.Role
}{
	"ADMIN":            {email: "admin@cpi.sn", role: db.RoleADMIN},
	"COMMERCIAL":       {email: "fixture.awa@cpi.sn", role: db.RoleCOMMERCIAL},
	"BANQUE_FINANCE":   {email: "fixture.banque@cpi.sn", role: db.RoleBANQUEFINANCE},
	"SUPERVISEUR":      {email: "fixture.superviseur@cpi.sn", role: db.RoleSUPERVISEUR},
	"DIRECTION":        {email: "fixture.direction@cpi.sn", role: db.RoleDIRECTION},
	"ACCUEIL":          {email: "fixture.accueil@cpi.sn", role: db.RoleACCUEIL},
	"CHARGE_CLIENTELE": {email: "fixture.clientele@cpi.sn", role: db.RoleCHARGECLIENTELE},
}

// Le compte est forcément actif : la session d'un compte désactivé est coupée
// avant d'arriver ici. `workspace` nomme la base qui sert cette session.
type CompteConnecte struct {
	socle.Utilisateur
	IsActive    bool    `json:"isActive"`
	Workspace   string  `json:"workspace"`
	LastLoginAt *string `json:"lastLoginAt"`
}

type SessionOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
	Body      struct {
		User CompteConnecte `json:"user"`
	}
}

func (s *service) login(ctx context.Context, in *LoginInput) (*SessionOutput, error) {
	adresse, _ := ctx.Value(socle.CleAdresse{}).(string)
	if !s.tentatives.Autorise(adresse) || !s.parIdentifie.Autorise(strings.ToLower(in.Body.Identifier)) {
		return nil, socle.Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
	}
	u, err := s.Q.UserForLogin(ctx, in.Body.Identifier)
	condensat := s.leurre
	if err == nil {
		condensat = u.PasswordHash
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	// Une connexion n'etait journalisee nulle part : ni qui entre, ni qui
	// s'acharne. C'est la premiere chose qu'on cherche apres un incident.
	if !database.VerifierMotDePasse(in.Body.Password, condensat) || err != nil {
		slog.Warn("connexion refusée", "identifiant", in.Body.Identifier, "adresse", adresse, "cause", "identifiants")
		return nil, socle.Problem(http.StatusUnauthorized, "INVALID_CREDENTIALS", "Identifiants invalides.")
	}
	if !u.IsActive {
		slog.Warn("connexion refusée", "identifiant", in.Body.Identifier, "adresse", adresse, "cause", "compte désactivé")
		return nil, socle.Problem(http.StatusUnauthorized, "ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez un administrateur.")
	}
	slog.Info("connexion", "userId", u.ID, "username", u.Username, "role", u.Role, "adresse", adresse)
	return s.ouvrirSession(ctx, in.UserAgent, &u)
}

func (s *service) demoLogin(ctx context.Context, in *DemoLoginInput) (*SessionOutput, error) {
	adresse, _ := ctx.Value(socle.CleAdresse{}).(string)
	if !s.tentatives.Autorise(adresse) {
		return nil, socle.Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
	}
	if s.Cfg.Base == socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "DEMO_BASE_REQUIRED", "Sélectionnez une base de démonstration.")
	}
	profil, ok := demoProfiles[in.Body.Role]
	if !ok {
		return nil, socle.Problem(http.StatusBadRequest, "UNKNOWN_DEMO_PROFILE", "Profil de démonstration inconnu.")
	}
	u, err := s.Q.UserForLogin(ctx, profil.email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusServiceUnavailable, "DEMO_NOT_SEEDED", "Cette base de démonstration n'est pas encore amorcée.")
	}
	if err != nil {
		return nil, err
	}
	if !u.IsActive || u.Role != profil.role {
		return nil, socle.Problem(http.StatusServiceUnavailable, "DEMO_NOT_AVAILABLE", "Ce profil de démonstration n'est pas disponible.")
	}
	return s.ouvrirSession(ctx, in.UserAgent, &u)
}

func (s *service) ouvrirSession(ctx context.Context, userAgent string, u *db.UserForLoginRow) (*SessionOutput, error) {
	brut := make([]byte, 32)
	if _, err := rand.Read(brut); err != nil {
		return nil, err
	}
	jeton := base64.RawURLEncoding.EncodeToString(brut)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	if err := s.Q.InsertSession(ctx, db.InsertSessionParams{
		ID: id.String(), UserId: u.ID, TokenHash: socle.Empreinte(jeton),
		ExpiresAt: time.Now().Add(s.Cfg.SessionTTL), UserAgent: stringPtr(userAgent),
	}); err != nil {
		return nil, err
	}
	if err := s.Q.TouchLastLogin(ctx, u.ID); err != nil {
		return nil, err
	}
	out := &SessionOutput{SetCookie: cookieSession(ctx, jeton, int(s.Cfg.SessionTTL.Seconds()))}
	out.Body.User = s.compte(&socle.Utilisateur{ID: u.ID, Email: u.Email, Username: u.Username, FullName: u.FullName, Role: socle.Role(u.Role), PhoneE164: u.PhoneE164})
	return out, nil
}

func stringPtr(value string) *string { return &value }

func (s *service) compte(u *socle.Utilisateur) CompteConnecte {
	return CompteConnecte{Utilisateur: *u, IsActive: true, Workspace: s.Cfg.Base}
}

type MeOutput struct{ Body CompteConnecte }

func (s *service) me(ctx context.Context, _ *struct{}) (*MeOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	return &MeOutput{Body: s.compte(&u)}, nil
}

type BasesOutput struct {
	Body struct {
		Bases []string `json:"bases"`
	}
}

func (s *service) bases(context.Context, *struct{}) (*BasesOutput, error) {
	out := &BasesOutput{}
	out.Body.Bases = s.Bases
	return out, nil
}

type LogoutOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
}

func (s *service) logout(ctx context.Context, in *CookieInput) (*LogoutOutput, error) {
	if err := s.Q.RevokeSession(ctx, socle.Empreinte(in.jeton())); err != nil {
		return nil, err
	}
	return &LogoutOutput{SetCookie: cookieSession(ctx, "", -1)}, nil
}

type PasswordInput struct {
	CookieInput
	Body struct {
		CurrentPassword string `json:"currentPassword" minLength:"1" maxLength:"1024"`
		NewPassword     string `json:"newPassword" minLength:"1" maxLength:"1024"`
	}
}

func Monter(api huma.API, d *socle.Deps) error {
	// Un condensat leurre : la vérification dure le même temps pour un compte inconnu.
	leurre, err := database.HacherMotDePasse(uuid.NewString())
	if err != nil {
		return err
	}
	s := &service{
		Deps:         d,
		leurre:       leurre,
		tentatives:   socle.NouveauLimiteur(d.Cfg.LoginRate),
		parIdentifie: socle.NouveauLimiteur(d.Cfg.LoginRate),
	}
	huma.Post(api, "/api/v1/auth/login", s.login)
	huma.Post(api, "/api/v1/auth/demo-login", s.demoLogin)
	huma.Get(api, "/api/v1/auth/me", s.me)
	huma.Get(api, "/api/v1/auth/bases", s.bases)
	huma.Register(api, huma.Operation{OperationID: "logout", Method: http.MethodPost, Path: "/api/v1/auth/logout", DefaultStatus: http.StatusNoContent}, s.logout)
	huma.Register(api, huma.Operation{OperationID: "change-password", Method: http.MethodPost, Path: "/api/v1/auth/password", DefaultStatus: http.StatusNoContent}, s.changerMotDePasse)
	huma.Register(api, huma.Operation{OperationID: "changeMyPassword", Method: http.MethodPut, Path: "/api/v1/auth/me/password"}, s.changerMotDePasseOk)
	return nil
}

type OkOutput struct {
	Body struct {
		Ok bool `json:"ok"`
	}
}

func (s *service) changerMotDePasseOk(ctx context.Context, in *PasswordInput) (*OkOutput, error) {
	if _, err := s.changerMotDePasse(ctx, in); err != nil {
		return nil, err
	}
	out := &OkOutput{}
	out.Body.Ok = true
	return out, nil
}

func (s *service) changerMotDePasse(ctx context.Context, in *PasswordInput) (*struct{}, error) {
	u := socle.UtilisateurCourant(ctx)
	if n := len(in.Body.NewPassword); n < s.Cfg.PasswordMin || n > s.Cfg.PasswordMax {
		message := fmt.Sprintf("Le mot de passe doit faire entre %d et %d caractères.", s.Cfg.PasswordMin, s.Cfg.PasswordMax)
		return nil, huma.Error422UnprocessableEntity("mot de passe hors bornes", &huma.ErrorDetail{Location: "body.newPassword", Message: message})
	}
	row, err := s.Q.UserForLogin(ctx, u.Email)
	if err != nil {
		return nil, err
	}
	if !database.VerifierMotDePasse(in.Body.CurrentPassword, row.PasswordHash) {
		return nil, socle.Problem(http.StatusUnauthorized, "INVALID_CREDENTIALS", "Mot de passe actuel incorrect.")
	}
	condensat, err := database.HacherMotDePasse(in.Body.NewPassword)
	if err != nil {
		return nil, err
	}
	// Le condensat, la révocation des autres sessions et la trace dans la même
	// transaction. La trace ne porte aucune valeur : un mot de passe, même
	// ancien, ne s'écrit pas dans le journal.
	return nil, pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.UpdatePassword(ctx, db.UpdatePasswordParams{ID: u.ID, PasswordHash: condensat}); err != nil {
			return err
		}
		if err := q.RevokeOtherSessions(ctx, db.RevokeOtherSessionsParams{UserId: u.ID, TokenHash: socle.Empreinte(in.jeton())}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "user.password_change", "user", u.ID, nil, nil)
	})
}

var Garde = map[string][]socle.Role{
	"GET /health/ready":            {socle.Public},
	"GET /health/live":             {socle.Public},
	"POST /api/v1/auth/login":      {socle.Public},
	"POST /api/v1/auth/demo-login": {socle.Public},
	"GET /api/v1/auth/bases":       {socle.Public},
	"POST /api/v1/auth/logout":     socle.Tous,
	"GET /api/v1/auth/me":          socle.Tous,
	"POST /api/v1/auth/password":   socle.Tous,
	"PUT /api/v1/auth/me/password": socle.Tous,
}
