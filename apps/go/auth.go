package main

import (
	"context"
	"cpi-go/db"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const nomCookie = "__Host-cpi_session"

type Utilisateur struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Username  string  `json:"username"`
	FullName  string  `json:"fullName"`
	Role      Role    `json:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	PhoneE164 *string `json:"phoneE164"`
}

type service struct {
	q          *db.Queries
	pool       *pgxpool.Pool
	cfg        *config
	live       *live
	leurre     string
	tentatives *limiteur
}

func nouveauService(pool *pgxpool.Pool, cfg *config) (*service, error) {
	leurre, err := hacherMotDePasse(uuid.NewString())
	if err != nil {
		return nil, err
	}
	return &service{q: db.New(pool), pool: pool, cfg: cfg, live: nouveauLive(), leurre: leurre, tentatives: nouveauLimiteur(cfg.LoginRate)}, nil
}

func empreinte(jeton string) string {
	h := sha256.Sum256([]byte(jeton))
	return hex.EncodeToString(h[:])
}

func (s *service) utilisateurParSession(ctx context.Context, jeton string) (Utilisateur, error) {
	row, err := s.q.UserBySession(ctx, empreinte(jeton))
	if err != nil {
		return Utilisateur{}, err
	}
	return Utilisateur{ID: row.ID, Email: row.Email, Username: row.Username, FullName: row.FullName, Role: Role(row.Role), PhoneE164: row.PhoneE164}, nil
}

func utilisateurCourant(ctx context.Context) Utilisateur {
	u, _ := ctx.Value(cleUtilisateur{}).(Utilisateur)
	return u
}

func cookieSession(jeton string, duree time.Duration) http.Cookie {
	return http.Cookie{Name: nomCookie, Value: jeton, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: int(duree.Seconds())}
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
		User Utilisateur `json:"user"`
	}
}

func (s *service) login(ctx context.Context, in *LoginInput) (*SessionOutput, error) {
	adresse, _ := ctx.Value(cleAdresse{}).(string)
	if !s.tentatives.autorise(adresse) {
		return nil, problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
	}
	u, err := s.q.UserForLogin(ctx, in.Body.Identifier)
	condensat := s.leurre
	if err == nil {
		condensat = u.PasswordHash
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if !verifierMotDePasse(in.Body.Password, condensat) || err != nil {
		return nil, problem(http.StatusUnauthorized, "INVALID_CREDENTIALS", "Identifiants invalides.")
	}
	if !u.IsActive {
		return nil, problem(http.StatusUnauthorized, "ACCOUNT_DISABLED", "Ce compte est désactivé. Contactez un administrateur.")
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
	if err := s.q.InsertSession(ctx, db.InsertSessionParams{
		ID: id.String(), UserId: u.ID, TokenHash: empreinte(jeton),
		ExpiresAt: time.Now().Add(s.cfg.SessionTTL), UserAgent: &in.UserAgent,
	}); err != nil {
		return nil, err
	}
	if err := s.q.TouchLastLogin(ctx, u.ID); err != nil {
		return nil, err
	}
	out := &SessionOutput{SetCookie: cookieSession(jeton, s.cfg.SessionTTL)}
	out.Body.User = Utilisateur{ID: u.ID, Email: u.Email, Username: u.Username, FullName: u.FullName, Role: Role(u.Role), PhoneE164: u.PhoneE164}
	return out, nil
}

type MeOutput struct {
	Body struct {
		User Utilisateur `json:"user"`
	}
}

func (*service) me(ctx context.Context, _ *struct{}) (*MeOutput, error) {
	out := &MeOutput{}
	out.Body.User = utilisateurCourant(ctx)
	return out, nil
}

type CookieInput struct {
	Session string `cookie:"__Host-cpi_session"`
}

type LogoutOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
}

func (s *service) logout(ctx context.Context, in *CookieInput) (*LogoutOutput, error) {
	if err := s.q.RevokeSession(ctx, empreinte(in.Session)); err != nil {
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

func monterAuth(api huma.API, s *service) {
	huma.Post(api, "/api/v1/auth/login", s.login)
	huma.Get(api, "/api/v1/auth/me", s.me)
	huma.Register(api, huma.Operation{OperationID: "logout", Method: http.MethodPost, Path: "/api/v1/auth/logout", DefaultStatus: http.StatusNoContent}, s.logout)
	huma.Register(api, huma.Operation{OperationID: "change-password", Method: http.MethodPost, Path: "/api/v1/auth/password", DefaultStatus: http.StatusNoContent}, s.changerMotDePasse)
}

func (s *service) changerMotDePasse(ctx context.Context, in *PasswordInput) (*struct{}, error) {
	u := utilisateurCourant(ctx)
	if n := len(in.Body.NewPassword); n < s.cfg.PasswordMin || n > s.cfg.PasswordMax {
		message := fmt.Sprintf("Le mot de passe doit faire entre %d et %d caractères.", s.cfg.PasswordMin, s.cfg.PasswordMax)
		return nil, huma.Error422UnprocessableEntity("mot de passe hors bornes", &huma.ErrorDetail{Location: "body.newPassword", Message: message})
	}
	row, err := s.q.UserForLogin(ctx, u.Email)
	if err != nil {
		return nil, err
	}
	if !verifierMotDePasse(in.Body.CurrentPassword, row.PasswordHash) {
		return nil, problem(http.StatusUnauthorized, "INVALID_CREDENTIALS", "Mot de passe actuel incorrect.")
	}
	condensat, err := hacherMotDePasse(in.Body.NewPassword)
	if err != nil {
		return nil, err
	}
	if err := s.q.UpdatePassword(ctx, db.UpdatePasswordParams{ID: u.ID, PasswordHash: condensat}); err != nil {
		return nil, err
	}
	return nil, s.q.RevokeOtherSessions(ctx, db.RevokeOtherSessionsParams{UserId: u.ID, TokenHash: empreinte(in.Session)})
}
