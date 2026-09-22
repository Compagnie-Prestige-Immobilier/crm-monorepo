package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"ticket-solver/internal/config"
	"ticket-solver/internal/git"
	"time"
)

type UnavailableError struct {
	Message string
}

func (e *UnavailableError) Error() string {
	return e.Message
}

func Ask(ctx context.Context, spec config.AgentSpec, token, jobDir, repoDir, prompt string, deadline time.Time) (*config.Answer, error) {
	timeout, err := git.Remaining(deadline, config.AgentTimeout)
	if err != nil {
		return nil, err
	}

	cacheDir := config.EnvOrDefault("CACHE_ROOT", "/work/cache")
	env := git.SandboxEnv(jobDir, cacheDir)

	if strings.HasPrefix(spec.Name, "claude") {
		return runClaude(ctx, spec, token, repoDir, prompt, env, timeout)
	}
	return runCodex(ctx, spec, token, jobDir, repoDir, prompt, env, timeout, cacheDir)
}

func runClaude(ctx context.Context, spec config.AgentSpec, token, repoDir, prompt string, env []string, timeout time.Duration) (*config.Answer, error) {
	env = append(env, "CLAUDE_CODE_OAUTH_TOKEN="+token)

	args := []string{
		"-p", prompt,
		"--append-system-prompt", config.Policy,
		"--output-format", "json",
		"--json-schema", config.SchemaJSON,
		"--permission-mode", "acceptEdits",
		"--allowedTools", config.ClaudeTools,
		"--no-session-persistence",
	}

	stdout, stderr, code, err := git.Run(ctx, git.ProgramClaude, args, repoDir, env, "", false, timeout)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		APIErrorStatus   any            `json:"api_error_status"`
		IsError          bool           `json:"is_error"`
		Result           any            `json:"result"`
		StructuredOutput *config.Answer `json:"structured_output"`
	}

	if unmarshalErr := json.Unmarshal([]byte(stdout), &envelope); unmarshalErr != nil {
		combined := stdout + stderr
		if len(combined) > 2000 {
			combined = combined[len(combined)-2000:]
		}
		return nil, fmt.Errorf("%s code %d : %s", spec.Name, code, combined)
	}

	if envelope.APIErrorStatus != nil {
		resStr := fmt.Sprintf("%v", envelope.Result)
		if len(resStr) > 300 {
			resStr = resStr[:300]
		}
		return nil, &UnavailableError{
			Message: fmt.Sprintf("%s indisponible (%v) : %s", spec.Name, envelope.APIErrorStatus, resStr),
		}
	}

	if code != 0 || envelope.IsError {
		resStr := fmt.Sprintf("%v", envelope.Result)
		if len(resStr) > 1000 {
			resStr = resStr[:1000]
		}
		return nil, fmt.Errorf("%s en erreur : %s", spec.Name, resStr)
	}

	if envelope.StructuredOutput == nil {
		return nil, fmt.Errorf("%s : réponse sans output structuré", spec.Name)
	}

	return validateAnswer(envelope.StructuredOutput, spec.Name)
}

func runCodex(ctx context.Context, spec config.AgentSpec, token, jobDir, repoDir, prompt string, env []string, timeout time.Duration, cacheDir string) (*config.Answer, error) {
	codexHome := filepath.Join(jobDir, "codex")
	if err := os.MkdirAll(codexHome, 0o750); err != nil {
		return nil, fmt.Errorf("création répertoire codex : %w", err)
	}

	env = append(env, "CODEX_HOME="+codexHome)

	loginArgs := []string{"login", "--with-access-token"}
	loginOut, loginErr, loginCode, err := git.Run(ctx, git.ProgramCodex, loginArgs, "", env, token, false, 120*time.Second)
	if err != nil {
		return nil, err
	}
	if loginCode != 0 {
		combined := loginOut + loginErr
		if len(combined) > 1000 {
			combined = combined[len(combined)-1000:]
		}
		return nil, fmt.Errorf("connexion codex refusée : %s", combined)
	}

	schemaPath := filepath.Join(jobDir, "schema.json")
	outputPath := filepath.Join(jobDir, "codex-answer.json")
	if err := os.WriteFile(schemaPath, []byte(config.SchemaJSON), 0o600); err != nil {
		return nil, fmt.Errorf("écriture schema.json : %w", err)
	}

	tmpDir := filepath.Join(jobDir, "tmp")
	promptWithPolicy := config.Policy + "\n\n" + prompt

	execArgs := []string{
		"exec",
		"--sandbox", "workspace-write",
		"-c", "sandbox_workspace_write.network_access=true",
		"--ephemeral",
		"--add-dir", cacheDir,
		"--add-dir", tmpDir,
		"--output-schema", schemaPath,
		"-o", outputPath,
		promptWithPolicy,
	}

	stdout, stderr, code, err := git.Run(ctx, git.ProgramCodex, execArgs, repoDir, env, "", false, timeout)
	if err != nil {
		return nil, err
	}

	outputBytes, readErr := os.ReadFile(filepath.Clean(outputPath))
	if code != 0 || readErr != nil {
		combined := stdout + stderr
		if len(combined) > 2000 {
			combined = combined[len(combined)-2000:]
		}
		return nil, fmt.Errorf("%s code %d : %s", spec.Name, code, combined)
	}

	var answer config.Answer
	if err := json.Unmarshal(outputBytes, &answer); err != nil {
		return nil, fmt.Errorf("décodage réponse codex : %w", err)
	}

	return validateAnswer(&answer, spec.Name)
}

func validateAnswer(ans *config.Answer, agentName string) (*config.Answer, error) {
	if ans.Status != "resolu" && ans.Status != "escalade" {
		return nil, fmt.Errorf("%s : statut hors schéma (%s)", agentName, ans.Status)
	}
	if _, ok := config.Routes[ans.Complexity]; !ok {
		return nil, fmt.Errorf("%s : complexité hors schéma (%s)", agentName, ans.Complexity)
	}
	ans.Agent = agentName
	return ans, nil
}
