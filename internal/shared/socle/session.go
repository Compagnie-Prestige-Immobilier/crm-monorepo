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

// JetonSession lit le cookie de session sous l'un ou l'autre nom.
func JetonSession(r *http.Request) string {
	for _, nom := range []string{NomCookie, NomCookieClair} {
		if c, err := r.Cookie(nom); err == nil && c.Value != "" {
			return c.Value
		}
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
}

func Empreinte(jeton string) string {
	h := sha256.Sum256([]byte(jeton))
	return hex.EncodeToString(h[:])
}

func utilisateurParSession(ctx context.Context, q *db.Queries, jeton string) (Utilisateur, error) {
	row, err := q.UserBySession(ctx, Empreinte(jeton))
	if err != nil {
		return Utilisateur{}, err
	}
	return Utilisateur{ID: row.ID, Email: row.Email, Username: row.Username, FullName: row.FullName, Role: Role(row.Role), PhoneE164: row.PhoneE164}, nil
}

func UtilisateurCourant(ctx context.Context) Utilisateur {
	u, _ := ctx.Value(cleUtilisateur{}).(Utilisateur)
	return u
}
