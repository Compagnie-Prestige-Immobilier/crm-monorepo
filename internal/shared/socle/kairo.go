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
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const reponseIAMax = 1 << 20

var clientTachesKairo = &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

type ImageIA struct {
	TypeMime string `json:"typeMime"`
	Contenu  []byte `json:"base64"`
}

var (
	ErrIANonConfiguree = errors.New("kairos non configuré")
	ErrIAIndisponible  = errors.New("kairos indisponible")
)

func KairoConfigure() bool {
	espace, err := strconv.ParseInt(Env("KAIRO_WORKSPACE_ID", ""), 10, 64)
	return err == nil && espace > 0 && Env("KAIRO_URL", "") != "" && Env("KAIRO_APPLICATION", "") != "" && Env("KAIRO_SDK_SECRET", "") != ""
}

func identiteKairo(u *Utilisateur) (string, error) {
	utilisateur, role := "crm:service", "service"
	if u != nil && u.ID != "" {
		utilisateur, role = u.ID, string(u.Role)
	}
	espace, _ := strconv.ParseInt(Env("KAIRO_WORKSPACE_ID", ""), 10, 64)
	brut, err := json.Marshal(struct {
		Sub         string `json:"sub"`
		Role        string `json:"role"`
		Org         string `json:"org"`
		WorkspaceID int64  `json:"workspaceId"`
		App         string `json:"app"`
		Exp         int64  `json:"exp"`
	}{utilisateur, role, Env("KAIRO_APPLICATION", ""), espace, Env("KAIRO_APPLICATION", ""), time.Now().Add(time.Minute).Unix()})
	if err != nil {
		return "", err
	}
	charge := base64.RawURLEncoding.EncodeToString(brut)
	mac := hmac.New(sha256.New, []byte(Env("KAIRO_SDK_SECRET", "")))
	_, _ = mac.Write([]byte(charge))
	return charge + "." + hex.EncodeToString(mac.Sum(nil)), nil
}

func DemanderKairo(ctx context.Context, utilisateur *Utilisateur, genre, consigne string, entree, cible any, images []ImageIA) (string, error) {
	if !KairoConfigure() {
		return "", ErrIANonConfiguree
	}
	corps, err := json.Marshal(map[string]any{
		"genre": genre, "consigne": consigne, "entrees": entree, "images": images, "initiateur": "plateforme",
	})
	if err != nil {
		return "", err
	}
	ctx, annuler := context.WithTimeout(ctx, 30*time.Second)
	defer annuler()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(Env("KAIRO_URL", ""), "/")+"/v1/sdk/taches", bytes.NewReader(corps))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	jeton, err := identiteKairo(utilisateur)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Kairos-Identite", jeton)
	resp, err := clientTachesKairo.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w : %w", ErrIAIndisponible, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w : HTTP %d", ErrIAIndisponible, resp.StatusCode)
	}
	return lireTacheKairo(resp.Body, cible)
}

func lireTacheKairo(corps io.Reader, cible any) (string, error) {
	brut, err := io.ReadAll(io.LimitReader(corps, reponseIAMax+1))
	if err != nil {
		return "", fmt.Errorf("%w : %w", ErrIAIndisponible, err)
	}
	if len(brut) > reponseIAMax {
		return "", fmt.Errorf("%w : réponse trop longue", ErrIAIndisponible)
	}
	var reponse struct {
		Resultat string `json:"resultat"`
		Modele   string `json:"modele"`
	}
	if err := json.Unmarshal(brut, &reponse); err != nil {
		return "", fmt.Errorf("%w : %w", ErrIAIndisponible, err)
	}
	if err := json.Unmarshal([]byte(sansBalises(reponse.Resultat)), cible); err != nil {
		return "", fmt.Errorf("%w : %w", ErrIAIndisponible, err)
	}
	return reponse.Modele, nil
}

// Un texte rédigé par un modèle ne cite que des nombres reçus : un chiffre
// inventé le fait écarter au profit du texte calculé.
func NombresInventes(texte string, entree any) bool {
	donnees, err := json.Marshal(entree)
	if err != nil {
		return true
	}
	connus := map[string]bool{}
	for _, n := range motifNombre.FindAllString(string(donnees), -1) {
		connus[strings.TrimLeft(n, "0")] = true
	}
	for _, n := range motifNombre.FindAllString(texte, -1) {
		if !connus[strings.TrimLeft(n, "0")] {
			return true
		}
	}
	return false
}

var motifNombre = regexp.MustCompile(`\d+`)

// Certains modèles entourent le JSON d'une balise Markdown malgré le format demandé.
func sansBalises(texte string) string {
	texte = strings.TrimSpace(texte)
	texte = strings.TrimPrefix(texte, "```json")
	texte = strings.TrimPrefix(texte, "```")
	return strings.TrimSpace(strings.TrimSuffix(texte, "```"))
}
