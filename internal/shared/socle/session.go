package socle

import (
	"context"
	"cpi-go/db"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
)

// `__Host-` exige Secure : hors TLS (poste de développement, téléphone sur le
// réseau local) le navigateur jetterait le cookie, donc un nom sans préfixe.
const (
	NomCookie      = "__Host-cpi_session"
	NomCookieClair = "cpi_session"
)

// CleSecurise porte dans le contexte si la requête est arrivée en TLS, directement
// ou derrière le proxy de confiance.
type CleSecurise struct{}

func ConnexionSecurisee(ctx context.Context) bool {
	v, _ := ctx.Value(CleSecurise{}).(bool)
	return v
}

// JetonSession lit le cookie sécurisé, et le cookie en clair seulement hors
// TLS : en TLS, l'accepter laisserait un jeton non chiffré traverser le réseau.
func JetonSession(r *http.Request) string {
	if c, err := r.Cookie(NomCookie); err == nil && c.Value != "" {
		return c.Value
	}
	if ConnexionSecurisee(r.Context()) {
		return ""
	}
	if c, err := r.Cookie(NomCookieClair); err == nil && c.Value != "" {
		return c.Value
	}
	return ""
}

type Utilisateur struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Username  string  `json:"username"`
	FullName  string  `json:"fullName"`
	Role      Role    `json:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	PhoneE164 *string `json:"phoneE164"`
	// Role reste le rôle de base, qui porte les données ; RoleID donne les permissions.
	RoleID      string `json:"roleId"`
	RoleLibelle string `json:"roleLibelle"`
	permissions map[Permission]bool
}

// Le démarrage charge chaque base ; un serveur d'essai charge à la première session.
func (a *Attributions) Attribuer(ctx context.Context, q *db.Queries, u *Utilisateur) error {
	if a.parRole.Load() == nil {
		if err := a.Charger(ctx, q); err != nil {
			return err
		}
	}
	u.permissions = a.duRole(u.RoleID)
	return nil
}

func Empreinte(jeton string) string {
	h := sha256.Sum256([]byte(jeton))
	return hex.EncodeToString(h[:])
}

func UtilisateurParSession(ctx context.Context, q *db.Queries, a *Attributions, jeton string) (Utilisateur, error) {
	row, err := q.UserBySession(ctx, Empreinte(jeton))
	if err != nil {
		return Utilisateur{}, err
	}
	u := Utilisateur{
		ID: row.ID, Email: row.Email, Username: row.Username, FullName: row.FullName, Role: Role(row.Role),
		PhoneE164: row.PhoneE164, RoleID: row.RoleId, RoleLibelle: row.RoleLibelle,
	}
	if err := a.Attribuer(ctx, q, &u); err != nil {
		return Utilisateur{}, err
	}
	return u, nil
}

func UtilisateurCourant(ctx context.Context) Utilisateur {
	u, _ := ctx.Value(cleUtilisateur{}).(Utilisateur)
	return u
}
