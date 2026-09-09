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
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type service struct {
	*socle.Deps
	leurre     string
	tentatives *socle.Limiteur
}

func cookieSession(jeton string, duree time.Duration) http.Cookie {
	return http.Cookie{Name: socle.NomCookie, Value: jeton, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: int(duree.Seconds())}
}

type LoginInput struct {
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Identifier string `json:"identifier" minLength:"1" maxLength:"254"`
		Password   string `json:"password" minLength:"1" maxLength:"1024"`
	}
}

type SessionOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
	Body      struct {
		User socle.Utilisateur `json:"user"`
	}
}

func (s *service) login(ctx context.Context, in *LoginInput) (*SessionOutput, error) {
	adresse, _ := ctx.Value(socle.CleAdresse{}).(string)
	if !s.tentatives.Autorise(adresse) {
		return nil, socle.Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
	}
	u, err := s.Q.UserForLogin(ctx, in.Body.Identifier)
	condensat := s.leurre
	if err == nil {
		condensat = u.PasswordHash
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if !database.VerifierMotDePasse(in.Body.Password, condensat) || err != nil {
		return nil, socle.Problem(http.StatusUnauthorized, "INVALID_CREDENTIALS", "Identifiants invalides.")
	}
	if !u.IsActive {
		return nil, socle.Problem(http.StatusUnauthorized, "ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez un administrateur.")
	}
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
		ExpiresAt: time.Now().Add(s.Cfg.SessionTTL), UserAgent: &in.UserAgent,
	}); err != nil {
		return nil, err
	}
	if err := s.Q.TouchLastLogin(ctx, u.ID); err != nil {
		return nil, err
	}
	out := &SessionOutput{SetCookie: cookieSession(jeton, s.Cfg.SessionTTL)}
	out.Body.User = socle.Utilisateur{ID: u.ID, Email: u.Email, Username: u.Username, FullName: u.FullName, Role: socle.Role(u.Role), PhoneE164: u.PhoneE164}
	return out, nil
}

type MeOutput struct {
	Body struct {
		User socle.Utilisateur `json:"user"`
	}
}

func (*service) me(ctx context.Context, _ *struct{}) (*MeOutput, error) {
	out := &MeOutput{}
	out.Body.User = socle.UtilisateurCourant(ctx)
	return out, nil
}

type CookieInput struct {
	Session string `cookie:"__Host-cpi_session"`
}

type LogoutOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
}

func (s *service) logout(ctx context.Context, in *CookieInput) (*LogoutOutput, error) {
	if err := s.Q.RevokeSession(ctx, socle.Empreinte(in.Session)); err != nil {
		return nil, err
	}
	return &LogoutOutput{SetCookie: cookieSession("", -1)}, nil
}

type PasswordInput struct {
	Session string `cookie:"__Host-cpi_session"`
	Body    struct {
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
	s := &service{Deps: d, leurre: leurre, tentatives: socle.NouveauLimiteur(d.Cfg.LoginRate)}
	huma.Post(api, "/api/v1/auth/login", s.login)
	huma.Get(api, "/api/v1/auth/me", s.me)
	huma.Register(api, huma.Operation{OperationID: "logout", Method: http.MethodPost, Path: "/api/v1/auth/logout", DefaultStatus: http.StatusNoContent}, s.logout)
	huma.Register(api, huma.Operation{OperationID: "change-password", Method: http.MethodPost, Path: "/api/v1/auth/password", DefaultStatus: http.StatusNoContent}, s.changerMotDePasse)
	return nil
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
	if err := s.Q.UpdatePassword(ctx, db.UpdatePasswordParams{ID: u.ID, PasswordHash: condensat}); err != nil {
		return nil, err
	}
	return nil, s.Q.RevokeOtherSessions(ctx, db.RevokeOtherSessionsParams{UserId: u.ID, TokenHash: socle.Empreinte(in.Session)})
}

var Garde = map[string][]socle.Role{
	"GET /health/ready":          {socle.Public},
	"POST /api/v1/auth/login":    {socle.Public},
	"POST /api/v1/auth/logout":   socle.Tous,
	"GET /api/v1/auth/me":        socle.Tous,
	"POST /api/v1/auth/password": socle.Tous,
}
