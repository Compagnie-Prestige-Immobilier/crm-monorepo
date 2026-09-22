package github

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"ticket-solver/internal/config"
	"time"
)

type cachedToken struct {
	token     string
	expiresAt time.Time
}

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
	mu         sync.Mutex
	tokens     map[string]cachedToken
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		tokens:     make(map[string]cachedToken),
	}
}

func (c *Client) GetToken(ctx context.Context, project *config.Project) (string, error) {
	if c.cfg.GitHubAppID == "" {
		if c.cfg.GitToken == "" {
			return "", errors.New("configuration manquante : GIT_TOKEN")
		}
		return c.cfg.GitToken, nil
	}

	_, repoName, err := config.GitHubRepository(project.Repository)
	if err != nil {
		return "", err
	}

	c.mu.Lock()
	cached, ok := c.tokens[repoName]
	if ok && time.Until(cached.expiresAt) > 10*time.Minute {
		c.mu.Unlock()
		return cached.token, nil
	}
	c.mu.Unlock()

	token, expiresAt, err := c.createInstallationToken(ctx, project)
	if err != nil {
		return "", err
	}

	config.RegisterDynamicSecret(token)

	c.mu.Lock()
	c.tokens[repoName] = cachedToken{
		token:     token,
		expiresAt: expiresAt,
	}
	c.mu.Unlock()

	return token, nil
}

func (c *Client) fetchInstallationID(ctx context.Context, jwtToken, owner, repoName string) (int64, error) {
	instURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/installation", owner, repoName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, instURL, http.NoBody)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("recherche installation GitHub App : %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return 0, fmt.Errorf("l'App GitHub n'est pas installée sur %s/%s", owner, repoName)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("erreur API GitHub (%d) : %s", resp.StatusCode, string(body))
	}

	var installation struct {
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&installation); err != nil {
		return 0, fmt.Errorf("décodage installation GitHub : %w", err)
	}
	return installation.ID, nil
}

func (c *Client) requestAccessToken(ctx context.Context, jwtToken string, instID int64, repoName string) (string, error) {
	tokenURL := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", instID)
	tokenPayload := map[string]any{
		"repositories": []string{repoName},
		"permissions": map[string]string{
			"contents":      "write",
			"pull_requests": "write",
		},
	}
	payloadBytes, err := json.Marshal(tokenPayload)
	if err != nil {
		return "", fmt.Errorf("sérialisation payload token : %w", err)
	}

	tokenReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return "", err
	}
	tokenReq.Header.Set("Accept", "application/vnd.github+json")
	tokenReq.Header.Set("Authorization", "Bearer "+jwtToken)
	tokenReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	tokenReq.Header.Set("Content-Type", "application/json")

	tokenResp, err := c.httpClient.Do(tokenReq)
	if err != nil {
		return "", fmt.Errorf("création token installation : %w", err)
	}
	defer func() { _ = tokenResp.Body.Close() }()

	if tokenResp.StatusCode < 200 || tokenResp.StatusCode >= 300 {
		body, _ := io.ReadAll(tokenResp.Body)
		return "", fmt.Errorf("erreur token GitHub (%d) : %s", tokenResp.StatusCode, string(body))
	}

	var tokenResult struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenResult); err != nil {
		return "", fmt.Errorf("décodage token GitHub : %w", err)
	}
	return tokenResult.Token, nil
}

func (c *Client) createInstallationToken(ctx context.Context, project *config.Project) (string, time.Time, error) {
	owner, repoName, err := config.GitHubRepository(project.Repository)
	if err != nil {
		return "", time.Time{}, err
	}

	jwtToken, err := generateGitHubAppJWT(c.cfg.GitHubAppID, c.cfg.GitHubAppPrivateKey)
	if err != nil {
		return "", time.Time{}, err
	}

	instID, err := c.fetchInstallationID(ctx, jwtToken, owner, repoName)
	if err != nil {
		return "", time.Time{}, err
	}

	token, err := c.requestAccessToken(ctx, jwtToken, instID, repoName)
	if err != nil {
		return "", time.Time{}, err
	}

	return token, time.Now().Add(1 * time.Hour), nil
}

func generateGitHubAppJWT(appID, privateKeyPEM string) (string, error) {
	now := time.Now().Unix()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"iat":%d,"exp":%d,"iss":%q}`, now-60, now+540, appID)))
	signingInput := header + "." + payload

	cleanedKey := strings.ReplaceAll(privateKeyPEM, `\n`, "\n")
	block, _ := pem.Decode([]byte(cleanedKey))
	if block == nil {
		return "", errors.New("échec décodage PEM de la clé privée GitHub App")
	}

	var rsaKey *rsa.PrivateKey
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		rsaKey = key
	} else if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		var ok bool
		rsaKey, ok = key.(*rsa.PrivateKey)
		if !ok {
			return "", errors.New("clé privée GitHub non RSA")
		}
	} else {
		return "", fmt.Errorf("analyse clé privée GitHub App : %w", err)
	}

	hashed := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("signature JWT GitHub App : %w", err)
	}

	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func (c *Client) CreateOrUpdatePullRequest(
	ctx context.Context,
	project *config.Project,
	branch string,
	ticketID int,
	ticketName string,
	glpiLink string,
	answer *config.Answer,
	changedFiles []string,
) (string, error) {
	token, err := c.GetToken(ctx, project)
	if err != nil {
		return "", err
	}

	owner, repoName, err := config.GitHubRepository(project.Repository)
	if err != nil {
		return "", err
	}

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls", owner, repoName)
	notes := ""
	if strings.TrimSpace(answer.ImportantNotes) != "" {
		notes = "\n\n**À vérifier** : " + answer.ImportantNotes
	}

	filesList := make([]string, 0, len(changedFiles))
	for _, f := range changedFiles {
		filesList = append(filesList, fmt.Sprintf("`%s`", f))
	}

	reviewers := config.TeamNames(config.Routes[answer.Complexity])
	bodyText := config.Redact(fmt.Sprintf(
		"Ticket GLPI [#%d %s](%s)\n\n%s\n\n**Cause** : %s\n\n**Fichiers** : %s%s\n\n"+
			"Niveau %s, relecture : %s. La vérification du projet passe ; "+
			"l'intégration et les parcours tournent dans la CI de cette PR. Rien n'est fusionné ni déployé automatiquement.",
		ticketID, config.PlainText(ticketName), glpiLink,
		answer.Summary,
		answer.RootCause,
		strings.Join(filesList, ", "), notes,
		answer.Complexity, reviewers,
	))

	existingReq, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL+"?head="+owner+":"+branch+"&state=open", http.NoBody)
	if err != nil {
		return "", err
	}
	existingReq.Header.Set("Accept", "application/vnd.github+json")
	existingReq.Header.Set("Authorization", "Bearer "+token)
	existingReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.httpClient.Do(existingReq)
	if err != nil {
		return "", fmt.Errorf("recherche PR existante : %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("erreur recherche PR (%d) : %s", resp.StatusCode, string(body))
	}

	var pulls []struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&pulls); err != nil {
		return "", fmt.Errorf("décodage recherche PR : %w", err)
	}

	if len(pulls) > 0 {
		return c.updatePullRequest(ctx, apiURL, pulls[0].Number, pulls[0].HTMLURL, token, bodyText)
	}

	return c.createPullRequest(ctx, apiURL, project.BaseBranch, branch, ticketID, token, bodyText)
}

func (c *Client) updatePullRequest(ctx context.Context, apiURL string, prNumber int, htmlURL, token, bodyText string) (string, error) {
	patchURL := fmt.Sprintf("%s/%d", apiURL, prNumber)
	patchBody, err := json.Marshal(map[string]string{"body": bodyText})
	if err != nil {
		return "", fmt.Errorf("sérialisation patch PR : %w", err)
	}

	patchReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, patchURL, bytes.NewReader(patchBody))
	if err != nil {
		return "", err
	}
	patchReq.Header.Set("Accept", "application/vnd.github+json")
	patchReq.Header.Set("Authorization", "Bearer "+token)
	patchReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	patchReq.Header.Set("Content-Type", "application/json")

	patchResp, err := c.httpClient.Do(patchReq)
	if err != nil {
		return "", fmt.Errorf("mise à jour PR : %w", err)
	}
	defer func() { _ = patchResp.Body.Close() }()

	if patchResp.StatusCode < 200 || patchResp.StatusCode >= 300 {
		body, _ := io.ReadAll(patchResp.Body)
		return "", fmt.Errorf("erreur mise à jour PR (%d) : %s", patchResp.StatusCode, string(body))
	}
	return htmlURL, nil
}

func (c *Client) createPullRequest(ctx context.Context, apiURL, baseBranch, branch string, ticketID int, token, bodyText string) (string, error) {
	createBody, err := json.Marshal(map[string]string{
		"title": fmt.Sprintf("fix(glpi): resolve ticket %d", ticketID),
		"head":  branch,
		"base":  baseBranch,
		"body":  bodyText,
	})
	if err != nil {
		return "", fmt.Errorf("sérialisation création PR : %w", err)
	}

	createReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(createBody))
	if err != nil {
		return "", err
	}
	createReq.Header.Set("Accept", "application/vnd.github+json")
	createReq.Header.Set("Authorization", "Bearer "+token)
	createReq.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	createReq.Header.Set("Content-Type", "application/json")

	createResp, err := c.httpClient.Do(createReq)
	if err != nil {
		return "", fmt.Errorf("création PR : %w", err)
	}
	defer func() { _ = createResp.Body.Close() }()

	if createResp.StatusCode < 200 || createResp.StatusCode >= 300 {
		body, _ := io.ReadAll(createResp.Body)
		return "", fmt.Errorf("erreur création PR (%d) : %s", createResp.StatusCode, string(body))
	}

	var createdPR struct {
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(createResp.Body).Decode(&createdPR); err != nil {
		return "", fmt.Errorf("décodage création PR : %w", err)
	}

	return createdPR.HTMLURL, nil
}
