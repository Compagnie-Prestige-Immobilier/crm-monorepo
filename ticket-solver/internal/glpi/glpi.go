package glpi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"ticket-solver/internal/config"
	"time"
)

type TicketSummary struct {
	ID      int
	DateMod string
}

type Client struct {
	baseURL    string
	appToken   string
	userToken  string
	httpClient *http.Client

	mu           sync.Mutex
	sessionToken string
	userID       int
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		baseURL:    strings.TrimRight(cfg.GLPIURL, "/"),
		appToken:   cfg.GLPIAppToken,
		userToken:  cfg.GLPIUserToken,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connectLocked(ctx)
}

const fieldInput = "input"

func (c *Client) connectLocked(ctx context.Context) error {
	initURL := c.baseURL + "/apirest.php/initSession?get_full_session=true"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, initURL, http.NoBody)
	if err != nil {
		return err
	}
	req.Header.Set("App-Token", c.appToken)
	req.Header.Set("Authorization", "user_token "+c.userToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connexion GLPI : %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erreur GLPI initSession (%d) : %s", resp.StatusCode, string(body))
	}

	var res struct {
		SessionToken string `json:"session_token"`
		Session      struct {
			GlpiID any `json:"glpiID"`
		} `json:"session"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return fmt.Errorf("décodage GLPI initSession : %w", err)
	}

	c.sessionToken = res.SessionToken
	switch id := res.Session.GlpiID.(type) {
	case float64:
		c.userID = int(id)
	case string:
		c.userID, _ = strconv.Atoi(id)
	case int:
		c.userID = id
	}

	return nil
}

func (c *Client) getOrInitSession(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sessionToken == "" {
		if err := c.connectLocked(ctx); err != nil {
			return "", err
		}
	}
	return c.sessionToken, nil
}

func (c *Client) buildRequest(ctx context.Context, method, reqURL, session string, body any) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("App-Token", c.appToken)
	req.Header.Set("Session-Token", session)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

func (c *Client) executeRequest(req *http.Request) (respBody []byte, statusCode int, err error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	respBody, readErr := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if readErr != nil {
		return nil, 0, readErr
	}
	return respBody, resp.StatusCode, nil
}

func isSessionInvalid(statusCode int, body []byte) bool {
	return (statusCode == http.StatusBadRequest || statusCode == http.StatusUnauthorized) &&
		strings.Contains(string(body), "ERROR_SESSION_TOKEN_INVALID")
}

func (c *Client) clearSessionIfCurrent(session string) {
	c.mu.Lock()
	if c.sessionToken == session {
		c.sessionToken = ""
	}
	c.mu.Unlock()
}

func (c *Client) executeCallAttempt(ctx context.Context, method, reqURL string, body any) (respBody []byte, statusCode int, session string, err error) {
	session, err = c.getOrInitSession(ctx)
	if err != nil {
		return nil, 0, "", err
	}
	req, reqErr := c.buildRequest(ctx, method, reqURL, session, body)
	if reqErr != nil {
		return nil, 0, "", reqErr
	}
	respBody, statusCode, err = c.executeRequest(req)
	return respBody, statusCode, session, err
}

func (c *Client) Call(ctx context.Context, method, path string, query url.Values, body any) ([]byte, error) {
	reqURL := fmt.Sprintf("%s/apirest.php/%s", c.baseURL, path)
	if len(query) > 0 {
		reqURL += "?" + query.Encode()
	}

	for attempt := 1; attempt <= 2; attempt++ {
		respBody, statusCode, session, err := c.executeCallAttempt(ctx, method, reqURL, body)
		if err != nil {
			return nil, err
		}

		if attempt == 1 && isSessionInvalid(statusCode, respBody) {
			c.clearSessionIfCurrent(session)
			continue
		}

		if statusCode < 200 || statusCode >= 300 {
			return nil, fmt.Errorf("GLPI %s %s (%d) : %s", method, path, statusCode, string(respBody))
		}

		return respBody, nil
	}

	return nil, errors.New("GLPI : session invalide après re tentative")
}

func (c *Client) NewTickets(ctx context.Context, categoryID string) ([]TicketSummary, error) {
	query := url.Values{}
	query.Set("criteria[0][criteria][0][field]", "12")
	query.Set("criteria[0][criteria][0][searchtype]", "equals")
	query.Set("criteria[0][criteria][0][value]", "1")
	query.Set("criteria[0][criteria][1][link]", "OR")
	query.Set("criteria[0][criteria][1][field]", "12")
	query.Set("criteria[0][criteria][1][searchtype]", "equals")
	query.Set("criteria[0][criteria][1][value]", strconv.Itoa(config.GLPIAssigned))
	query.Set("criteria[1][link]", "AND")
	query.Set("criteria[1][criteria][0][field]", "7")
	query.Set("criteria[1][criteria][0][searchtype]", "under")
	query.Set("criteria[1][criteria][0][value]", categoryID)
	query.Set("criteria[1][criteria][1][link]", "OR")
	query.Set("criteria[1][criteria][1][field]", "7")
	query.Set("criteria[1][criteria][1][searchtype]", "equals")
	query.Set("criteria[1][criteria][1][value]", "0")
	query.Set("forcedisplay[0]", "2")
	query.Set("forcedisplay[1]", "19")
	query.Set("sort", "2")
	query.Set("order", "ASC")
	query.Set("range", "0-199")

	data, err := c.Call(ctx, http.MethodGet, "search/Ticket", query, nil)
	if err != nil {
		return nil, err
	}

	var searchRes struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(data, &searchRes); err != nil {
		return nil, fmt.Errorf("décodage recherche GLPI : %w", err)
	}

	var tickets []TicketSummary
	for _, row := range searchRes.Data {
		var id int
		switch v := row["2"].(type) {
		case float64:
			id = int(v)
		case string:
			id, _ = strconv.Atoi(v)
		case int:
			id = v
		}
		if id == 0 {
			continue
		}
		dateMod, _ := row["19"].(string)
		tickets = append(tickets, TicketSummary{ID: id, DateMod: dateMod})
	}

	return tickets, nil
}

func (c *Client) Ticket(ctx context.Context, ticketID int) (map[string]any, error) {
	data, err := c.Call(ctx, http.MethodGet, fmt.Sprintf("Ticket/%d", ticketID), nil, nil)
	if err != nil {
		return nil, err
	}
	var ticket map[string]any
	if err := json.Unmarshal(data, &ticket); err != nil {
		return nil, fmt.Errorf("décodage ticket GLPI : %w", err)
	}
	return ticket, nil
}

func (c *Client) checkAssignTechnician(ctx context.Context, ticketID, userID int) {
	actorsData, err := c.Call(ctx, http.MethodGet, fmt.Sprintf("Ticket/%d/Ticket_User", ticketID), nil, nil)
	if err != nil {
		return
	}
	var actors []map[string]any
	_ = json.Unmarshal(actorsData, &actors)
	for _, a := range actors {
		if intFromAny(a["users_id"]) == userID && intFromAny(a["type"]) == config.GLPIAssigned {
			return
		}
	}
	_, _ = c.Call(ctx, http.MethodPost, "Ticket_User", nil, map[string]any{
		fieldInput: map[string]any{
			"tickets_id": ticketID,
			"users_id":   userID,
			"type":       config.GLPIAssigned,
		},
	})
}

func (c *Client) Take(ctx context.Context, ticket map[string]any, categoryID string) error {
	c.mu.Lock()
	if c.sessionToken == "" {
		if err := c.connectLocked(ctx); err != nil {
			c.mu.Unlock()
			return err
		}
	}
	userID := c.userID
	c.mu.Unlock()

	ticketID := intFromAny(ticket["id"])
	c.checkAssignTechnician(ctx, ticketID, userID)

	updateInput := map[string]any{
		"id":     ticketID,
		"status": config.GLPIAssigned,
	}
	catID := intFromAny(ticket["itilcategories_id"])
	if catID == 0 {
		cID, _ := strconv.Atoi(categoryID)
		updateInput["itilcategories_id"] = cID
	}

	_, err := c.Call(ctx, http.MethodPut, fmt.Sprintf("Ticket/%d", ticketID), nil, map[string]any{
		fieldInput: updateInput,
	})
	return err
}

func (c *Client) Followup(ctx context.Context, ticketID int, text string) error {
	content := html.EscapeString(config.Redact(text))
	content = strings.ReplaceAll(content, "\n", "<br>")

	_, err := c.Call(ctx, http.MethodPost, "ITILFollowup", nil, map[string]any{
		fieldInput: map[string]any{
			"itemtype":   "Ticket",
			"items_id":   ticketID,
			"content":    content,
			"is_private": 0,
		},
	})
	return err
}

func (c *Client) Link(ticketID int) string {
	return fmt.Sprintf("%s/front/ticket.form.php?id=%d", c.baseURL, ticketID)
}

func intFromAny(v any) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		n, _ := strconv.Atoi(val)
		return n
	default:
		return 0
	}
}
