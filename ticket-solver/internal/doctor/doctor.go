package doctor

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"ticket-solver/internal/config"
	"ticket-solver/internal/github"
	"ticket-solver/internal/glpi"
)

var requiredTools = []string{"git", "claude", "codex", "go", "node", "pnpm", "sqlc", "golangci-lint"}

func checkTools() map[string]bool {
	res := make(map[string]bool, len(requiredTools))
	for _, t := range requiredTools {
		_, err := exec.LookPath(t)
		res[t] = err == nil
	}
	return res
}

func checkWork(workRoot string) bool {
	workParent := filepath.Dir(workRoot)
	testFile := filepath.Join(workParent, ".kairo-doctor-test")
	if err := os.WriteFile(testFile, []byte("ok"), 0o600); err == nil {
		_ = os.Remove(testFile)
		return true
	}
	return false
}

func checkGitHub(ctx context.Context, cfg *config.Config, ghClient *github.Client) bool {
	if len(cfg.Projects) == 0 {
		return false
	}
	for i := range cfg.Projects {
		p := &cfg.Projects[i]
		if _, err := ghClient.GetToken(ctx, p); err != nil {
			fmt.Printf("erreur github (%s) : %s\n", p.Name, config.Redact(err.Error()))
			return false
		}
	}
	return true
}

func Run(ctx context.Context, cfg *config.Config, glpiClient *glpi.Client, ghClient *github.Client) error {
	checks := checkTools()
	checks["work"] = checkWork(cfg.WorkRoot)
	checks["brevo"] = cfg.BrevoAPIKey != ""

	hasAgent := false
	for _, a := range config.Agents {
		if strings.TrimSpace(os.Getenv(a.EnvToken)) != "" {
			hasAgent = true
			break
		}
	}
	checks["agent"] = hasAgent
	checks["projects"] = len(cfg.Projects) > 0

	glpiErr := glpiClient.Connect(ctx)
	checks["glpi"] = glpiErr == nil
	if glpiErr != nil {
		fmt.Printf("erreur glpi : %s\n", config.Redact(glpiErr.Error()))
	}

	checks["github"] = checkGitHub(ctx, cfg, ghClient)

	allOk := true
	order := make([]string, 0, len(requiredTools)+6)
	order = append(order, requiredTools...)
	order = append(order, "work", "brevo", "agent", "github", "projects", "glpi")

	for _, k := range order {
		status := "manquant"
		if checks[k] {
			status = "ok"
		} else {
			allOk = false
		}
		fmt.Printf("%s: %s\n", k, status)
	}

	if !allOk {
		return errors.New("contrôle de santé incomplet")
	}
	return nil
}
