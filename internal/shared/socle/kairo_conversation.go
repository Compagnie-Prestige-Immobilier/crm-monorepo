package socle

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func OuvrirKairo(ctx context.Context, u *Utilisateur, methode, chemin string, corps []byte, requete string) (*http.Response, error) {
	if !KairoConfigure() {
		return nil, ErrIANonConfiguree
	}
	req, err := http.NewRequestWithContext(ctx, methode, strings.TrimRight(Env("KAIRO_URL", ""), "/")+chemin, bytes.NewReader(corps))
	if err != nil {
		return nil, err
	}
	identite, err := identiteKairo(u)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Kairos-Identite", identite)
	req.Header.Set("Content-Type", "application/json")
	if requete != "" {
		req.Header.Set("X-Kairos-Request-ID", requete)
	}
	return clientTachesKairo.Do(req)
}

func (d *Deps) UtilisateurAppelKairo(ctx context.Context, identite, horodatage, signature, chemin string, corps []byte) (context.Context, error) {
	refus := errors.New("appel Kairos non autorisé")
	secret := []byte(Env("KAIRO_SDK_SECRET", ""))
	instant, err := strconv.ParseInt(horodatage, 10, 64)
	if !horodatageKairoValide(instant, err, secret) {
		return ctx, refus
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(horodatage + "\nPOST\n" + chemin + "\n"))
	_, _ = mac.Write(corps)
	if !hmac.Equal([]byte(signature), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		return ctx, refus
	}
	charge, sceau, ok := strings.Cut(identite, ".")
	if !ok {
		return ctx, refus
	}
	mac.Reset()
	_, _ = mac.Write([]byte(charge))
	if !hmac.Equal([]byte(sceau), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		return ctx, refus
	}
	brut, err := base64.RawURLEncoding.DecodeString(charge)
	if err != nil {
		return ctx, refus
	}
	var id struct {
		Sub, App, Org string
		WorkspaceID   int64
		Exp           int64
	}
	if json.Unmarshal(brut, &id) != nil || id.Exp <= time.Now().Unix() || id.App != Env("KAIRO_APPLICATION", "") || id.Org != id.App || strconv.FormatInt(id.WorkspaceID, 10) != Env("KAIRO_WORKSPACE_ID", "") {
		return ctx, refus
	}
	return d.utilisateurKairoVerifie(ctx, id.Sub)
}

func (d *Deps) utilisateurKairoVerifie(ctx context.Context, sub string) (context.Context, error) {
	refus := errors.New("appel Kairos non autorisé")
	row, err := d.Q.UserDetail(ctx, sub)
	if err != nil || !row.IsActive {
		return ctx, refus
	}
	u := Utilisateur{ID: row.ID, Role: Role(row.Role), RoleID: row.RoleId}
	if err := d.Attributions.Attribuer(ctx, d.Q, &u); err != nil {
		return ctx, err
	}
	if !u.Peut(PermissionAssistantUtiliser) {
		return ctx, refus
	}
	return context.WithValue(ctx, cleUtilisateur{}, u), nil
}

func horodatageKairoValide(instant int64, err error, secret []byte) bool {
	return err == nil && len(secret) != 0 && time.Since(time.Unix(instant, 0)).Abs() <= time.Minute
}
