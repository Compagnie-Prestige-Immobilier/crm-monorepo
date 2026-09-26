package socle

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const (
	appelIAMax        = 15 * time.Second
	reponseIAMax      = 1 << 20
	extraitErreurMax  = 300
	fournisseurGemini = "gemini"
)

type ImageIA struct {
	TypeMime string
	Contenu  []byte
}

type FournisseurIA struct {
	Nom     string
	url     string
	cle     string
	Modeles []string
}

var fournisseursConnus = map[string]struct{ url, modeles string }{
	fournisseurGemini: {"https://generativelanguage.googleapis.com/v1beta/models/", "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-flash-lite-latest,gemma-4-26b-a4b-it"},
	"groq":            {"https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile,llama-3.1-8b-instant"},
	"cerebras":        {"https://api.cerebras.ai/v1/chat/completions", "gpt-oss-120b"},
	"openrouter":      {"https://openrouter.ai/api/v1/chat/completions", "openrouter/free"},
}

// `variable` nomme la liste ordonnée des fournisseurs ; clés et modèles restent partagés.
func FournisseursIA(variable, parDefaut string) []FournisseurIA {
	var retenus []FournisseurIA
	for _, nom := range strings.Split(Env(variable, parDefaut), ",") {
		nom = strings.ToLower(strings.TrimSpace(nom))
		connu, ok := fournisseursConnus[nom]
		if !ok {
			slog.Warn("fournisseur IA inconnu ignoré", "fournisseur", nom)
			continue
		}
		prefixe := strings.ToUpper(nom)
		cle := Env(prefixe+"_API_KEY", "")
		if cle == "" {
			continue
		}
		modeles := Env(prefixe+"_MODELS", Env(prefixe+"_MODEL", connu.modeles))
		retenus = append(retenus, FournisseurIA{Nom: nom, url: Env(prefixe+"_URL", connu.url), cle: cle, Modeles: listeModeles(modeles)})
	}
	return retenus
}

func listeModeles(valeur string) []string {
	var modeles []string
	for _, modele := range strings.Split(valeur, ",") {
		if modele = strings.TrimPrefix(strings.TrimSpace(modele), "models/"); modele != "" {
			modeles = append(modeles, modele)
		}
	}
	return modeles
}

type messageChat struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type formatReponse struct {
	Type string `json:"type"`
}

type requeteChat struct {
	Model          string        `json:"model"`
	Messages       []messageChat `json:"messages"`
	Temperature    float64       `json:"temperature"`
	ResponseFormat formatReponse `json:"response_format"`
}

type donneesInline struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

type partieGemini struct {
	Text       string         `json:"text,omitempty"`
	InlineData *donneesInline `json:"inlineData,omitempty"`
	Thought    bool           `json:"thought,omitempty"`
}

type contenuGemini struct {
	Role  string         `json:"role,omitempty"`
	Parts []partieGemini `json:"parts"`
}

type configurationGemini struct {
	ResponseMimeType string `json:"responseMimeType"`
}

// Gemini 3 garde sa température par défaut : Google déconseille de la baisser.
type requeteGemini struct {
	SystemInstruction contenuGemini       `json:"systemInstruction"`
	Contents          []contenuGemini     `json:"contents"`
	GenerationConfig  configurationGemini `json:"generationConfig"`
}

type reponseIA struct {
	Choices []struct {
		Message messageChat `json:"message"`
	} `json:"choices"`
	Candidates []struct {
		Content contenuGemini `json:"content"`
	} `json:"candidates"`
}

func (r *reponseIA) texte() string {
	if len(r.Choices) > 0 {
		return r.Choices[0].Message.Content
	}
	if len(r.Candidates) == 0 {
		return ""
	}
	var texte strings.Builder
	for _, partie := range r.Candidates[0].Content.Parts {
		if !partie.Thought {
			texte.WriteString(partie.Text)
		}
	}
	return texte.String()
}

func (f *FournisseurIA) requete(ctx context.Context, modele, consigne, entree string, images []ImageIA) (*http.Request, error) {
	url := f.url
	var corps []byte
	var err error
	if f.Nom == fournisseurGemini {
		url += modele + ":generateContent"
		parts := make([]partieGemini, 0, 1+len(images))
		parts = append(parts, partieGemini{Text: entree})
		for _, img := range images {
			parts = append(parts, partieGemini{
				InlineData: &donneesInline{MimeType: img.TypeMime, Data: base64.StdEncoding.EncodeToString(img.Contenu)},
			})
		}
		corps, err = json.Marshal(requeteGemini{
			SystemInstruction: contenuGemini{Parts: []partieGemini{{Text: consigne}}},
			Contents:          []contenuGemini{{Role: "user", Parts: parts}},
			GenerationConfig:  configurationGemini{ResponseMimeType: "application/json"},
		})
	} else {
		corps, err = json.Marshal(requeteChat{
			Model:          modele,
			Messages:       []messageChat{{Role: "system", Content: consigne}, {Role: "user", Content: entree}},
			Temperature:    0.2,
			ResponseFormat: formatReponse{Type: "json_object"},
		})
	}
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(corps))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// La clé reste hors de l'URL : une erreur réseau recopie l'URL dans le journal.
	if f.Nom == fournisseurGemini {
		req.Header.Set("X-Goog-Api-Key", f.cle)
	} else {
		req.Header.Set("Authorization", "Bearer "+f.cle)
	}
	return req, nil
}

// Rend le JSON produit par le modèle, à décoder par l'appelant.
func (f *FournisseurIA) DemanderJSON(parent context.Context, modele, consigne, entree string, images []ImageIA) ([]byte, error) {
	ctx, annuler := context.WithTimeout(parent, appelIAMax)
	defer annuler()
	req, err := f.requete(ctx, modele, consigne, entree, images)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	corps := io.LimitReader(resp.Body, reponseIAMax)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		extrait, _ := io.ReadAll(io.LimitReader(corps, extraitErreurMax))
		return nil, fmt.Errorf("HTTP %d : %s", resp.StatusCode, strings.TrimSpace(string(extrait)))
	}
	var reponse reponseIA
	if err := json.NewDecoder(corps).Decode(&reponse); err != nil {
		return nil, err
	}
	return []byte(sansBalises(reponse.texte())), nil
}

// Les fournisseurs de l'assistant servent aussi au résumé de fiche et au compte rendu.
const (
	FournisseursAssistant       = "ASSISTANT_AI_PROVIDERS"
	FournisseursAssistantDefaut = "gemini,groq"
)

var (
	ErrIANonConfiguree = errors.New("aucun fournisseur d'IA n'a de clé")
	ErrIAIndisponible  = errors.New("aucun modèle n'a répondu")
)

// Chaque modèle des fournisseurs nommés par `variable` est essayé dans l'ordre ;
// le premier JSON qui se décode dans `cible` gagne. Rend « fournisseur/modèle ».
func DemanderIA(ctx context.Context, variable, parDefaut, consigne string, entree, cible any) (string, error) {
	fournisseurs := FournisseursIA(variable, parDefaut)
	if len(fournisseurs) == 0 {
		return "", ErrIANonConfiguree
	}
	donnees, err := json.Marshal(entree)
	if err != nil {
		return "", err
	}
	for _, f := range fournisseurs {
		for _, modele := range f.Modeles {
			if ctx.Err() != nil {
				return "", fmt.Errorf("%w : %w", ErrIAIndisponible, ctx.Err())
			}
			brut, err := f.DemanderJSON(ctx, modele, consigne, string(donnees), nil)
			if err == nil {
				err = json.Unmarshal(brut, cible)
			}
			if err == nil {
				return f.Nom + "/" + modele, nil
			}
			slog.Warn("modèle IA écarté", "fournisseur", f.Nom, "modele", modele, "err", err)
		}
	}
	return "", ErrIAIndisponible
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
