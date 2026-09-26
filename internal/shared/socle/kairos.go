package socle

import (
	"bytes"
	"context"
	"cpi-go/db"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	CleReglageAssistantKairos = "kairos.assistant"
	DureeIdentiteKairos       = 10 * time.Minute
	enteteSignatureKairos     = "X-Kairos-Signature"
	ecartHorodatageKairos     = 300
	corpsMaxKairos            = 1 << 20
)

type IdentiteKairos struct {
	Sub    string `json:"sub"`
	Role   string `json:"role"`
	Org    string `json:"org"`
	Expire int64  `json:"exp"`
}

var errAppelKairos = errors.New("appel Kairos refusé")

func KairosConfigure() (url, secret string) {
	return strings.TrimRight(strings.TrimSpace(Env("KAIROS_URL", "")), "/"), strings.TrimSpace(Env("KAIROS_SDK_SECRET", ""))
}

func AssistantKairosAffiche(ctx context.Context, q *db.Queries) (bool, error) {
	ligne, err := q.GetSetting(ctx, CleReglageAssistantKairos)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return ligne.Value == Vrai, nil
}

func signerKairos(secret, texte string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(texte))
	return hex.EncodeToString(mac.Sum(nil))
}

func SignerIdentiteKairos(secret string, id IdentiteKairos) (string, error) {
	brut, err := json.Marshal(id)
	if err != nil {
		return "", err
	}
	charge := base64.RawURLEncoding.EncodeToString(brut)
	return charge + "." + signerKairos(secret, charge), nil
}

func LireIdentiteKairos(secret, jeton string, maintenant time.Time) (IdentiteKairos, error) {
	charge, signature, _ := strings.Cut(jeton, ".")
	if !hmac.Equal([]byte(signature), []byte(signerKairos(secret, charge))) {
		return IdentiteKairos{}, errAppelKairos
	}
	brut, err := base64.RawURLEncoding.DecodeString(charge)
	if err != nil {
		return IdentiteKairos{}, errAppelKairos
	}
	var id IdentiteKairos
	if err := json.Unmarshal(brut, &id); err != nil || id.Sub == "" {
		return IdentiteKairos{}, errAppelKairos
	}
	reste := id.Expire - maintenant.Unix()
	if reste <= 0 || reste > int64(DureeIdentiteKairos/time.Second) {
		return IdentiteKairos{}, fmt.Errorf("%w : identité expirée", errAppelKairos)
	}
	return id, nil
}

// La signature couvre le corps brut : il est lu ici puis rendu intact au handler.
func verifierAppelKairos(w http.ResponseWriter, r *http.Request, secret string) (IdentiteKairos, error) {
	horodatage := r.Header.Get("X-Kairos-Horodatage")
	instant, err := strconv.ParseInt(horodatage, 10, 64)
	if err != nil || max(time.Now().Unix()-instant, instant-time.Now().Unix()) > ecartHorodatageKairos {
		return IdentiteKairos{}, fmt.Errorf("%w : horodatage hors délai", errAppelKairos)
	}
	corps, err := io.ReadAll(http.MaxBytesReader(w, r.Body, corpsMaxKairos))
	if err != nil {
		return IdentiteKairos{}, err
	}
	r.Body = io.NopCloser(bytes.NewReader(corps))
	signe := horodatage + "\n" + r.Method + "\n" + r.URL.RequestURI() + "\n" + string(corps)
	if !hmac.Equal([]byte(r.Header.Get(enteteSignatureKairos)), []byte(signerKairos(secret, signe))) {
		return IdentiteKairos{}, fmt.Errorf("%w : signature", errAppelKairos)
	}
	return LireIdentiteKairos(secret, r.Header.Get("X-Kairos-Identite"), time.Now())
}

// Une base de démonstration n'a jamais d'appel Kairos : l'assistant ne doit
// atteindre que les données de la base qui a signé l'identité, la publique.
func utilisateurKairos(w http.ResponseWriter, r *http.Request, q *db.Queries, a *Attributions, base string) (Utilisateur, error) {
	_, secret := KairosConfigure()
	affiche, err := AssistantKairosAffiche(r.Context(), q)
	if secret == "" || base != BasePublique || err != nil || !affiche {
		return Utilisateur{}, errors.Join(errAppelKairos, err)
	}
	id, err := verifierAppelKairos(w, r, secret)
	if err != nil || id.Org != base {
		return Utilisateur{}, errors.Join(errAppelKairos, err)
	}
	row, err := q.UserActifParId(r.Context(), id.Sub)
	if err != nil {
		return Utilisateur{}, err
	}
	u := Utilisateur{
		ID: row.ID, Email: row.Email, Username: row.Username, FullName: row.FullName, Role: Role(row.Role),
		PhoneE164: row.PhoneE164, RoleID: row.RoleId, RoleLibelle: row.RoleLibelle,
	}
	if err := a.Attribuer(r.Context(), q, &u); err != nil {
		return Utilisateur{}, err
	}
	if !u.Peut(PermissionKairosAssistant) {
		return Utilisateur{}, fmt.Errorf("%w : permission retirée", errAppelKairos)
	}
	return u, nil
}
