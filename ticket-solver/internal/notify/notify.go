package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"ticket-solver/internal/config"
	"time"
)

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type emailRecipient struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type emailSender struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type emailPayload struct {
	Sender      emailSender      `json:"sender"`
	To          []emailRecipient `json:"to"`
	Subject     string           `json:"subject"`
	TextContent string           `json:"textContent"`
}

func (c *Client) Send(ctx context.Context, keys []string, subject, body string) {
	if c.cfg.BrevoAPIKey == "" {
		slog.Warn("BREVO_API_KEY absent, mail non envoyé", "sujet", subject)
		return
	}

	names := config.TeamNames(keys)
	textContent := config.Redact(fmt.Sprintf("Bonjour %s,\n\n%s\n\nKairo, assistant de la DSI", names, body))

	var to []emailRecipient
	for _, k := range keys {
		if m, ok := config.Team[k]; ok {
			to = append(to, emailRecipient{
				Email: m.Email,
				Name:  m.FullName,
			})
		}
	}
	if len(to) == 0 {
		return
	}

	payload := emailPayload{
		Sender:      emailSender{Email: config.GitEmail, Name: config.GitName},
		To:          to,
		Subject:     subject,
		TextContent: textContent,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("erreur sérialisation mail Brevo", "err", err)
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.brevo.com/v3/smtp/email", bytes.NewReader(payloadBytes))
	if err != nil {
		slog.Error("erreur requête mail Brevo", "err", err)
		return
	}
	req.Header.Set("api-key", c.cfg.BrevoAPIKey)
	req.Header.Set("accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		slog.Error("mail non envoyé", "sujet", subject, "err", err)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		slog.Error("mail non envoyé", "code", resp.StatusCode, "sujet", subject, "reponse", string(respBody))
	}
}
