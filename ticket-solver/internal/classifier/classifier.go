package classifier

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

var ErrNotConfigured = errors.New("classificateur JEV non configuré")

type Category string

const (
	CategoryCodeDefect       Category = "CODE_DEFECT"
	CategoryInsufficientInfo Category = "INSUFFICIENT_INFO"
	CategoryAccessCreds      Category = "ACCESS_CREDENTIALS"
	CategoryFunctionalHowto  Category = "FUNCTIONAL_HOWTO"
	CategoryFeatureRequest   Category = "FEATURE_REQUEST"
)

type Complexity string

const (
	ComplexityBasse    Complexity = "basse"
	ComplexityMoyenne  Complexity = "moyenne"
	ComplexityHaute    Complexity = "haute"
	ComplexityComplexe Complexity = "complexe"
)

type Result struct {
	Category   Category   `json:"category"`
	Complexity Complexity `json:"complexity"`
	Confidence float64    `json:"confidence"`
	Reason     string     `json:"reason"`
	Model      string     `json:"model,omitempty"`
}

type Client struct {
	url        string
	apiKey     string
	httpClient *http.Client
}

func New(url, apiKey string) *Client {
	return &Client{
		url:        strings.TrimRight(strings.TrimSpace(url), "/"),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) Configured() bool {
	return c != nil && c.apiKey != "" && c.url != ""
}

type requeteJEV struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Project string `json:"project"`
}

type reponseJEV struct {
	Category   string  `json:"category"`
	Complexity string  `json:"complexity"`
	Confidence float64 `json:"confidence"`
	Reason     string  `json:"reason"`
	Label      string  `json:"label,omitempty"`
	Score      float64 `json:"score,omitempty"`
	Model      string  `json:"model,omitempty"`
}

// ChoisirModele sélectionne le modèle adapté selon la tâche qualifiée par JEV (haiku, sonnet, opus),
// avec fallback sur "sonnet" en cas de doute, d'erreur ou d'indisponibilité.
func ChoisirModele(res *Result) string {
	if res != nil && res.Model != "" {
		m := strings.ToLower(strings.TrimSpace(res.Model))
		switch {
		case strings.Contains(m, "haiku"):
			return "haiku"
		case strings.Contains(m, "opus"):
			return "opus"
		case strings.Contains(m, "sonnet"):
			return "sonnet"
		}
	}
	if res == nil {
		return "sonnet"
	}
	switch res.Complexity {
	case ComplexityBasse:
		return "haiku"
	case ComplexityHaute, ComplexityComplexe:
		return "opus"
	default:
		return "sonnet"
	}
}

func contientUn(texte string, mots ...string) bool {
	for _, m := range mots {
		if strings.Contains(texte, m) {
			return true
		}
	}
	return false
}

func normaliserCategorie(brute string) Category {
	nettoye := strings.ToUpper(strings.TrimSpace(brute))
	switch {
	case contientUn(nettoye, "INSUFFICIENT", "VAGUE", "IMPRECIS"):
		return CategoryInsufficientInfo
	case contientUn(nettoye, "ACCESS", "PASSWORD", "MDP", "AUTH"):
		return CategoryAccessCreds
	case contientUn(nettoye, "HOWTO", "USAGE", "HELP"):
		return CategoryFunctionalHowto
	case contientUn(nettoye, "FEATURE", "EVOLUTION"):
		return CategoryFeatureRequest
	default:
		return CategoryCodeDefect
	}
}

func normaliserComplexite(brute string) Complexity {
	nettoye := strings.ToLower(strings.TrimSpace(brute))
	switch nettoye {
	case "basse", "low":
		return ComplexityBasse
	case "moyenne", "medium", "mid":
		return ComplexityMoyenne
	case "haute", "high":
		return ComplexityHaute
	default:
		return ComplexityComplexe
	}
}

func (c *Client) Classify(ctx context.Context, title, content, project string) (*Result, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}

	bodyBytes, err := json.Marshal(requeteJEV{
		Title:   title,
		Content: content,
		Project: project,
	})
	if err != nil {
		return nil, fmt.Errorf("encodage requête JEV : %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("création requête JEV : %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("appel JEV : %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("erreur HTTP JEV (%d) : %s", resp.StatusCode, string(snippet))
	}

	var rep reponseJEV
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&rep); err != nil {
		return nil, fmt.Errorf("décodage réponse JEV : %w", err)
	}

	catBrute := rep.Category
	if catBrute == "" {
		catBrute = rep.Label
	}
	conf := rep.Confidence
	if conf == 0 {
		conf = rep.Score
	}

	res := &Result{
		Category:   normaliserCategorie(catBrute),
		Complexity: normaliserComplexite(rep.Complexity),
		Confidence: conf,
		Reason:     rep.Reason,
		Model:      rep.Model,
	}

	slog.Debug("classification JEV réussie", "cat", res.Category, "complexite", res.Complexity, "conf", res.Confidence, "modele", ChoisirModele(res))
	return res, nil
}

// DiagnostiquerEchec catégorise la sortie de vérification pour orienter la boucle d'auto-correction.
func DiagnostiquerEchec(vOut string) (nature, conseil string) {
	lower := strings.ToLower(vOut)
	switch {
	case contientUn(lower, "golangci-lint", "oxlint", "prettier", "gocyclo", "gocognit"):
		return "LINTER", "Erreur de formatage, de linter ou de complexité. Vérifie le style et découpe les fonctions trop longues."
	case contientUn(lower, "syntax error", "cannot use", "undefined:", "tsc", "not assignable"):
		return "TYPAGE_COMPILATION", "Erreur de typage ou de compilation. Vérifie les signatures et types retournés."
	case contientUn(lower, "--- fail:", "failed", "fail:"):
		return "TEST_REGRESSION", "Échec d'assertion sur un test automatique. Le code produit un comportement inattendu."
	case contientUn(lower, "timed out", "deadline exceeded"):
		return "TIMEOUT", "Dépassement de délai lors de l'exécution des tests."
	default:
		return "VERIFICATION", "La commande de vérification a renvoyé un code de sortie non nul."
	}
}

// ClassifyProject détermine si un ticket sans marqueur explicite [crm] concerne bien le projet cible.
func (c *Client) ClassifyProject(ctx context.Context, title, content, targetProject string) bool {
	if !c.Configured() {
		return false
	}
	res, err := c.Classify(ctx, title, content, targetProject)
	if err != nil || res == nil {
		return false
	}
	return res.Category == CategoryCodeDefect && res.Confidence >= 0.80
}
