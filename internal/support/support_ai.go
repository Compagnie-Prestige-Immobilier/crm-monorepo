package support

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type ticketReformule struct {
	Description string `json:"description"`
	Contexte    string `json:"contexte"`
}

func reformulerTicket(parent context.Context, description, contexte string) (ticketReformule, error) {
	original := ticketReformule{description, contexte}
	if socle.Env("SUPPORT_AI_ENABLED", socle.Faux) == socle.Faux {
		return original, nil
	}
	for _, nom := range strings.Split(socle.Env("SUPPORT_AI_PROVIDERS", "gemini,groq,cerebras,openrouter"), ",") {
		nom = strings.TrimSpace(strings.ToLower(nom))
		cle, _, endpoint := configurationIA(nom)
		if cle == "" || endpoint == "" {
			continue
		}
		for _, modele := range modelesIA(nom) {
			resultat, err := appelerIA(parent, endpoint, cle, modele, description, contexte)
			if err == nil && strings.TrimSpace(resultat.Description) != "" {
				return resultat, nil
			}
			slog.Warn("modèle IA indisponible", "fournisseur", nom, "modèle", modele, "erreur", erreurCourte(err))
		}
	}
	return original, fmt.Errorf("aucun fournisseur IA disponible")
}

func modelesIA(nom string) []string {
	if nom == "gemini" {
		valeurs := strings.Split(socle.Env("GEMINI_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-3-flash-preview,gemini-flash-lite-latest,gemma-4-26b-a4b-it,gemma-4-31b-it"), ",")
		modeles := make([]string, 0, len(valeurs))
		for _, valeur := range valeurs {
			if modele := strings.TrimPrefix(strings.TrimSpace(valeur), "models/"); modele != "" {
				modeles = append(modeles, modele)
			}
		}
		return modeles
	}
	_, modele, _ := configurationIA(nom)
	return []string{modele}
}

func configurationIA(nom string) (string, string, string) {
	switch nom {
	case "gemini":
		return socle.Env("GEMINI_API_KEY", ""), socle.Env("GEMINI_MODEL", "gemini-3.6-flash"), "https://generativelanguage.googleapis.com/v1beta/models/"
	case "groq":
		return socle.Env("GROQ_API_KEY", ""), socle.Env("GROQ_MODEL", "llama-3.3-70b-versatile"), "https://api.groq.com/openai/v1/chat/completions"
	case "cerebras":
		return socle.Env("CEREBRAS_API_KEY", ""), socle.Env("CEREBRAS_MODEL", "llama-3.3-70b"), "https://api.cerebras.ai/v1/chat/completions"
	case "openrouter":
		return socle.Env("OPENROUTER_API_KEY", ""), socle.Env("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"), "https://openrouter.ai/api/v1/chat/completions"
	}
	return "", "", ""
}

func appelerIA(parent context.Context, endpoint, cle, modele, description, contexte string) (ticketReformule, error) {
	ctx, annuler := context.WithTimeout(parent, 8*time.Second)
	defer annuler()
	prompt := "Reformule ce signalement de support en français clair. N'invente aucune information. Retourne uniquement un JSON avec description et contexte. Les informations absentes restent non précisées.\nDescription: " + description + "\nContexte: " + contexte
	corps, _ := json.Marshal(map[string]any{"model": modele, "messages": []map[string]string{{"role": "user", "content": prompt}}, "temperature": 0.1, "response_format": map[string]string{"type": "json_object"}})
	url := endpoint
	if strings.Contains(endpoint, "generativelanguage") {
		url += modele + ":generateContent?key=" + cle
		corps, _ = json.Marshal(map[string]any{"contents": []map[string]any{{"parts": []map[string]string{{"text": prompt}}}}, "generationConfig": map[string]any{"responseMimeType": "application/json", "temperature": 0.1}})
	}
	requete, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(corps))
	if err != nil {
		return ticketReformule{}, err
	}
	requete.Header.Set("Content-Type", "application/json")
	if !strings.Contains(endpoint, "generativelanguage") {
		requete.Header.Set("Authorization", "Bearer "+cle)
	}
	reponse, err := http.DefaultClient.Do(requete)
	if err != nil {
		return ticketReformule{}, err
	}
	defer reponse.Body.Close()
	if reponse.StatusCode < 200 || reponse.StatusCode >= 300 {
		return ticketReformule{}, fmt.Errorf("réponse HTTP %d", reponse.StatusCode)
	}
	var brut map[string]any
	if err := json.NewDecoder(reponse.Body).Decode(&brut); err != nil {
		return ticketReformule{}, err
	}
	var resultat ticketReformule
	if err := json.Unmarshal([]byte(texteIA(brut)), &resultat); err != nil {
		return ticketReformule{}, err
	}
	return resultat, nil
}
func texteIA(brut map[string]any) string {
	if choix, ok := brut["choices"].([]any); ok && len(choix) > 0 {
		if c, ok := choix[0].(map[string]any); ok {
			if m, ok := c["message"].(map[string]any); ok {
				if t, ok := m["content"].(string); ok {
					return t
				}
			}
		}
	}
	if candidats, ok := brut["candidates"].([]any); ok && len(candidats) > 0 {
		if c, ok := candidats[0].(map[string]any); ok {
			if contenu, ok := c["content"].(map[string]any); ok {
				if parties, ok := contenu["parts"].([]any); ok && len(parties) > 0 {
					if p, ok := parties[0].(map[string]any); ok {
						if t, ok := p["text"].(string); ok {
							return t
						}
					}
				}
			}
		}
	}
	return ""
}
func erreurCourte(err error) string {
	if err == nil {
		return "réponse vide"
	}
	return err.Error()
}
