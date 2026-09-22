package solver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"ticket-solver/internal/agent"
	"ticket-solver/internal/config"
	"ticket-solver/internal/git"
	"ticket-solver/internal/github"
	"ticket-solver/internal/glpi"
	"ticket-solver/internal/notify"
	"ticket-solver/internal/state"
	"time"

	"github.com/google/uuid"
)

type EscaladeError struct {
	Message string
}

func (e *EscaladeError) Error() string {
	return e.Message
}

type Solver struct {
	cfg        *config.Config
	state      *state.Store
	glpiClient *glpi.Client
	ghClient   *github.Client
	notif      *notify.Client

	mu         sync.Mutex
	greenBases map[string]struct{}
}

func New(cfg *config.Config, s *state.Store, g *glpi.Client, gh *github.Client, n *notify.Client) *Solver {
	return &Solver{
		cfg:        cfg,
		state:      s,
		glpiClient: g,
		ghClient:   gh,
		notif:      n,
		greenBases: make(map[string]struct{}),
	}
}

func TicketPrompt(ticketID int, ticket map[string]any, project *config.Project, previous string) string {
	name, _ := ticket["name"].(string)
	content, _ := ticket["content"].(string)
	plainContent := config.PlainText(content)
	if len(plainContent) > 20000 {
		plainContent = plainContent[:20000]
	}

	parts := []string{
		fmt.Sprintf("Ticket GLPI #%d", ticketID),
		"Titre : " + config.PlainText(name),
		"Description :\n" + plainContent,
		fmt.Sprintf("Dépôt : %s, branche de base %s", project.Name, project.BaseBranch),
		"Commande de vérification : " + project.VerificationCommand,
	}

	if strings.TrimSpace(previous) != "" {
		parts = append(parts, "Tentative précédente, à ne pas répéter :\n"+previous)
	}

	return strings.Join(parts, "\n\n")
}

func (s *Solver) checkBaseline(ctx context.Context, repoDir string, project *config.Project, jobDir, baseSHA string, deadline time.Time) error {
	s.mu.Lock()
	_, isGreen := s.greenBases[baseSHA]
	s.mu.Unlock()

	if isGreen {
		return nil
	}

	out, code, err := git.Verify(ctx, repoDir, project, jobDir, deadline)
	if err != nil {
		return err
	}
	if code != 0 {
		outSnippet := out
		if len(outSnippet) > 3000 {
			outSnippet = outSnippet[len(outSnippet)-3000:]
		}
		shaSnippet := baseSHA
		if len(shaSnippet) > 8 {
			shaSnippet = shaSnippet[:8]
		}
		return fmt.Errorf("la branche %s (%s) ne passe pas sa propre vérification :\n%s", project.BaseBranch, shaSnippet, outSnippet)
	}

	s.mu.Lock()
	s.greenBases[baseSHA] = struct{}{}
	s.mu.Unlock()
	return nil
}

func retryAgentVerification(
	ctx context.Context,
	spec config.AgentSpec,
	token string,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, vOut string,
	deadline time.Time,
) (*config.Answer, string, error) {
	failureSnippet := vOut
	if len(failureSnippet) > 6000 {
		failureSnippet = failureSnippet[len(failureSnippet)-6000:]
	}

	retryPrompt := TicketPrompt(ticketID, ticket, project, "La vérification échoue après tes changements :\n"+failureSnippet)
	ans, askErr := agent.Ask(ctx, spec, token, jobDir, repoDir, retryPrompt, deadline)
	if askErr != nil {
		return nil, "", askErr
	}
	if ans.Status == config.StatusEscalade {
		return ans, "", nil
	}

	vOut2, code2, vErr2 := git.Verify(ctx, repoDir, project, jobDir, deadline)
	if vErr2 == nil && code2 == 0 {
		return ans, "", nil
	}
	if vErr2 != nil && errors.Is(vErr2, git.ErrDeadline) {
		return nil, "", vErr2
	}

	vOutSnippet := vOut2
	if len(vOutSnippet) > 3000 {
		vOutSnippet = vOutSnippet[len(vOutSnippet)-3000:]
	}
	failNote := fmt.Sprintf("%s n'a pas fait passer la vérification. Son résumé : %s\n%s", spec.Name, ans.Summary, vOutSnippet)
	return nil, failNote, nil
}

func tryAgent(
	ctx context.Context,
	spec config.AgentSpec,
	token string,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, baseSHA, previous string,
	deadline time.Time,
) (*config.Answer, string, error) {
	gitEnv, err := git.GitEnv(jobDir, "")
	if err != nil {
		return nil, "", err
	}

	_, _ = git.ExecGit(ctx, repoDir, gitEnv, 600*time.Second, "reset", "--quiet", "--hard", baseSHA)
	_, _ = git.ExecGit(ctx, repoDir, gitEnv, 600*time.Second, "clean", "-fdq")

	prompt := TicketPrompt(ticketID, ticket, project, previous)
	ans, askErr := agent.Ask(ctx, spec, token, jobDir, repoDir, prompt, deadline)
	if askErr != nil {
		return nil, "", askErr
	}
	if ans.Status == config.StatusEscalade {
		return ans, "", nil
	}

	vOut, code, vErr := git.Verify(ctx, repoDir, project, jobDir, deadline)
	if vErr == nil && code == 0 {
		return ans, "", nil
	}
	if vErr != nil && errors.Is(vErr, git.ErrDeadline) {
		return nil, "", vErr
	}

	return retryAgentVerification(ctx, spec, token, ticketID, ticket, project, jobDir, repoDir, vOut, deadline)
}

func handleAgentError(err error, spec config.AgentSpec, ticketID int, deadline time.Time) (prev, unavail string, isDeadline bool) {
	if errors.Is(err, git.ErrDeadline) {
		return "", "", true
	}
	var unavailErr *agent.UnavailableError
	if errors.As(err, &unavailErr) {
		slog.Warn("agent indisponible", "ticket", ticketID, "err", unavailErr.Message)
		return "", unavailErr.Message, false
	}
	if time.Until(deadline) < 60*time.Second {
		return "", "", true
	}
	prevErr := config.Redact(err.Error())
	if len(prevErr) > 2000 {
		prevErr = prevErr[len(prevErr)-2000:]
	}
	slog.Warn("échec agent", "ticket", ticketID, "agent", spec.Name, "err", prevErr)
	return fmt.Sprintf("%s n'a pas abouti : %s", spec.Name, prevErr), "", false
}

func (s *Solver) Solve(
	ctx context.Context,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, baseSHA string,
	deadline time.Time,
) (*config.Answer, error) {
	if err := s.checkBaseline(ctx, repoDir, project, jobDir, baseSHA, deadline); err != nil {
		return nil, err
	}

	var previous string
	var unavailable []string
	tried := 0

	for _, spec := range config.Agents {
		token := strings.TrimSpace(os.Getenv(spec.EnvToken))
		if token == "" {
			continue
		}
		tried++

		ans, failNote, err := tryAgent(ctx, spec, token, ticketID, ticket, project, jobDir, repoDir, baseSHA, previous, deadline)
		if ans != nil {
			return ans, nil
		}
		if failNote != "" {
			previous = failNote
			continue
		}

		prev, unavailMsg, isDead := handleAgentError(err, spec, ticketID, deadline)
		if isDead {
			return nil, git.ErrDeadline
		}
		if unavailMsg != "" {
			unavailable = append(unavailable, unavailMsg)
			continue
		}
		previous = prev
	}

	if tried > 0 && len(unavailable) == tried {
		return nil, fmt.Errorf("aucun agent disponible :\n%s", strings.Join(unavailable, "\n"))
	}

	notes := config.Redact(previous)
	if len(notes) > 1500 {
		notes = notes[len(notes)-1500:]
	}

	return &config.Answer{
		Status:         config.StatusEscalade,
		Complexity:     "complexe",
		Agent:          "aucun",
		ChangedFiles:   []string{},
		Summary:        "Je n'ai pas réussi à produire une correction qui passe la vérification du dépôt. Je préfère vous laisser la main.",
		RootCause:      "Aucune tentative n'a passé la vérification.",
		ImportantNotes: notes,
	}, nil
}

func checkProtectedFiles(changedFiles, protectedPaths []string) error {
	var protected []string
	for _, f := range changedFiles {
		for _, item := range protectedPaths {
			cleaned := strings.TrimRight(item, "/")
			if f == cleaned || strings.HasPrefix(f, cleaned+"/") {
				protected = append(protected, f)
				break
			}
		}
	}
	if len(protected) > 0 {
		return &EscaladeError{
			Message: fmt.Sprintf("Ma correction touche des fichiers protégés (%s) : je ne la publie pas sans votre accord.", strings.Join(protected, ", ")),
		}
	}
	return nil
}

func createPatch(ctx context.Context, jobDir, repoDir, baseSHA string, protectedPaths []string) (patchPath string, changedFiles []string, err error) {
	gitEnv, envErr := git.GitEnv(jobDir, "")
	if envErr != nil {
		return "", nil, envErr
	}

	if _, execErr := git.ExecGit(ctx, repoDir, gitEnv, 600*time.Second, "add", "-A"); execErr != nil {
		return "", nil, execErr
	}

	patchPath = filepath.Join(jobDir, "correction.patch")
	diffArgs := []string{
		"diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv",
		"--output=" + patchPath, baseSHA,
	}
	if _, execErr := git.ExecGit(ctx, repoDir, gitEnv, 600*time.Second, diffArgs...); execErr != nil {
		return "", nil, execErr
	}

	patchBytes, readErr := os.ReadFile(filepath.Clean(patchPath))
	if readErr != nil || len(bytes.TrimSpace(patchBytes)) == 0 {
		return "", nil, &EscaladeError{
			Message: "La vérification passe, mais je n'ai modifié aucun fichier : le ticket demande sans doute autre chose que du code.",
		}
	}

	changedRaw, diffErr := git.ExecGit(ctx, repoDir, gitEnv, 600*time.Second, "diff", "--cached", "--name-only", baseSHA)
	if diffErr != nil {
		return "", nil, diffErr
	}
	changedFiles = strings.Fields(changedRaw)

	if protErr := checkProtectedFiles(changedFiles, protectedPaths); protErr != nil {
		return "", nil, protErr
	}

	patchContent := string(patchBytes)
	for _, sec := range config.GetAllSecrets() {
		if strings.Contains(patchContent, sec) {
			return "", nil, &EscaladeError{
				Message: "Ma correction contient une valeur secrète du service : je ne la publie pas.",
			}
		}
	}

	return patchPath, changedFiles, nil
}

func (s *Solver) pushPatch(ctx context.Context, project *config.Project, jobDir, branch, patchPath, rootCause string, ticketID int) error {
	pushDir := filepath.Join(jobDir, "push")
	gitEnv, err := git.GitEnv(jobDir, "")
	if err != nil {
		return err
	}

	token, err := s.ghClient.GetToken(ctx, project)
	if err != nil {
		return err
	}

	if err := git.Clone(ctx, project, pushDir, jobDir, token, 1); err != nil {
		return fmt.Errorf("clone push : %w", err)
	}

	if _, err := git.ExecGit(ctx, pushDir, gitEnv, 600*time.Second, "apply", "--index", "--whitespace=nowarn", patchPath); err != nil {
		return fmt.Errorf("apply patch : %w", err)
	}

	commitMsg := fmt.Sprintf("fix(glpi): resolve ticket %d", ticketID)
	commitDesc := fmt.Sprintf("%s\n\nTicket GLPI #%d", rootCause, ticketID)
	if _, err := git.ExecGit(ctx, pushDir, gitEnv, 600*time.Second, "commit", "--quiet", "-m", commitMsg, "-m", commitDesc); err != nil {
		return fmt.Errorf("commit : %w", err)
	}

	pushEnv, err := git.GitEnv(jobDir, token)
	if err != nil {
		return err
	}

	refspec := "HEAD:refs/heads/" + branch
	if _, err := git.ExecGit(ctx, pushDir, pushEnv, 600*time.Second, "push", "--quiet", "--force", "origin", refspec); err != nil {
		return fmt.Errorf("push : %w", err)
	}
	return nil
}

func (s *Solver) Publish(
	ctx context.Context,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, baseSHA string,
	ans *config.Answer,
) (string, error) {
	patchPath, changedFiles, err := createPatch(ctx, jobDir, repoDir, baseSHA, project.ProtectedPaths)
	if err != nil {
		return "", err
	}

	branch := fmt.Sprintf("kairo/glpi-%d", ticketID)
	if err := s.pushPatch(ctx, project, jobDir, branch, patchPath, ans.RootCause, ticketID); err != nil {
		return "", err
	}

	ticketName, _ := ticket["name"].(string)
	return s.ghClient.CreateOrUpdatePullRequest(
		ctx, project, branch, ticketID, ticketName, s.glpiClient.Link(ticketID), ans, changedFiles,
	)
}

func (s *Solver) ReportSuccess(ctx context.Context, ticketID int, ticket map[string]any, ans *config.Answer, prURL string) {
	keys := config.Routes[ans.Complexity]
	reviewers := config.TeamNames(keys)
	ticketName, _ := ticket["name"].(string)

	notes := ""
	if strings.TrimSpace(ans.ImportantNotes) != "" {
		notes = "\n\nÀ vérifier : " + ans.ImportantNotes
	}

	glpiMsg := fmt.Sprintf("%s\n\nLa correction attend la relecture de %s avant sa mise en production : %s", ans.Summary, reviewers, prURL)
	_ = s.glpiClient.Followup(ctx, ticketID, glpiMsg)

	subject := fmt.Sprintf("Ticket #%d : correction prête pour relecture", ticketID)
	body := fmt.Sprintf(
		"J'ai préparé une correction pour le ticket #%d « %s ».\n\n%s%s\n\nPR : %s\nTicket : %s\nNiveau : %s\n\nRien n'est fusionné ni déployé.",
		ticketID, config.PlainText(ticketName), ans.Summary, notes, prURL, s.glpiClient.Link(ticketID), ans.Complexity,
	)
	s.notif.Send(ctx, keys, subject, body)
}

func (s *Solver) ReportEscalation(ctx context.Context, ticketID int, ticket map[string]any, ans *config.Answer) {
	keys := config.Routes[ans.Complexity]
	reviewers := config.TeamNames(keys)
	ticketName, _ := ticket["name"].(string)

	notes := ""
	if strings.TrimSpace(ans.ImportantNotes) != "" {
		notes = "\n\n" + ans.ImportantNotes
	}

	glpiMsg := fmt.Sprintf("%s\n\nJe passe la main à %s.", ans.Summary, reviewers)
	_ = s.glpiClient.Followup(ctx, ticketID, glpiMsg)

	subject := fmt.Sprintf("Ticket #%d : je vous le passe", ticketID)
	body := fmt.Sprintf(
		"Je vous passe le ticket #%d « %s ».\n\n%s\n\nRaison : %s%s\n\nTicket : %s\nNiveau : %s",
		ticketID, config.PlainText(ticketName), ans.Summary, ans.RootCause, notes, s.glpiClient.Link(ticketID), ans.Complexity,
	)
	s.notif.Send(ctx, keys, subject, body)
}

func (s *Solver) ReportFailure(ctx context.Context, ticketID, attempts int, errorStr string) {
	keys := config.Routes["complexe"]
	subject := fmt.Sprintf("Ticket #%d : je suis bloqué", ticketID)

	redactedErr := config.Redact(errorStr)
	if len(redactedErr) > 3000 {
		redactedErr = redactedErr[len(redactedErr)-3000:]
	}

	body := fmt.Sprintf(
		"Je n'arrive pas à traiter le ticket #%d après %d essais, pour une raison technique :\n\n%s\n\nTicket : %s",
		ticketID, attempts, redactedErr, s.glpiClient.Link(ticketID),
	)
	s.notif.Send(ctx, keys, subject, body)

	followup := fmt.Sprintf("Je n'ai pas pu traiter ce ticket pour une raison technique. %s sont prévenus et reprennent la main.", config.TeamNames(keys))
	if err := s.glpiClient.Followup(ctx, ticketID, followup); err != nil {
		slog.Error("suivi GLPI d'échec non posté", "ticket", ticketID, "err", err)
	}
}

func (s *Solver) prepareTicketWorkspace(ctx context.Context, project *config.Project, ticketID int, jobDir string) (ticket map[string]any, baseSHA string, shouldAbandon bool, err error) {
	ticket, err = s.glpiClient.Ticket(ctx, ticketID)
	if err != nil {
		return nil, "", false, err
	}

	statusVal := 0
	switch v := ticket["status"].(type) {
	case float64:
		statusVal = int(v)
	case int:
		statusVal = v
	}
	if statusVal >= config.GLPIClosed {
		return nil, "", true, nil
	}

	if err := os.MkdirAll(filepath.Join(jobDir, "tmp"), 0o750); err != nil {
		return nil, "", false, err
	}

	attempts, _ := s.state.Attempts(ctx, ticketID)
	_ = s.glpiClient.Take(ctx, ticket, project.CategoryID)
	if attempts <= 1 {
		_ = s.glpiClient.Followup(ctx, ticketID, "Je prends ce ticket. Je reviens ici dès qu'une correction est prête, ou je passe la main à l'équipe s'il faut trancher.")
	}

	token, err := s.ghClient.GetToken(ctx, project)
	if err != nil {
		return nil, "", false, err
	}

	repoDir := filepath.Join(jobDir, "repo")
	gitDir := filepath.Join(jobDir, "git")
	if err := git.Clone(ctx, project, repoDir, jobDir, token, 50, "--separate-git-dir="+gitDir); err != nil {
		return nil, "", false, fmt.Errorf("clone initial : %w", err)
	}

	gitEnv, err := git.GitEnv(jobDir, "")
	if err != nil {
		return nil, "", false, err
	}

	sha, err := git.ExecGit(ctx, repoDir, gitEnv, 60*time.Second, "rev-parse", "HEAD")
	if err != nil {
		return nil, "", false, fmt.Errorf("rev-parse HEAD : %w", err)
	}
	return ticket, strings.TrimSpace(sha), false, nil
}

func (s *Solver) RunJob(ctx context.Context, ticketID int, projectName string) {
	jobID := fmt.Sprintf("%d-%s", ticketID, strings.ReplaceAll(uuid.New().String(), "-", ""))
	jobDir := filepath.Join(s.cfg.WorkRoot, jobID)
	defer func() {
		_ = os.RemoveAll(jobDir)
	}()

	var project *config.Project
	for i := range s.cfg.Projects {
		if s.cfg.Projects[i].Name == projectName {
			project = &s.cfg.Projects[i]
			break
		}
	}
	if project == nil {
		slog.Error("projet introuvable", "nom", projectName)
		_ = s.state.Finish(ctx, ticketID, "echec", "Projet introuvable : "+projectName, "", "")
		return
	}

	ticket, baseSHA, abandon, err := s.prepareTicketWorkspace(ctx, project, ticketID, jobDir)
	if err != nil {
		s.handleTechnicalFailure(ctx, ticketID, err)
		return
	}
	if abandon {
		_ = s.state.Finish(ctx, ticketID, "abandon", "Ticket clos ou résolu dans GLPI avant traitement.", "", "")
		return
	}

	deadline := time.Now().Add(s.cfg.JobTimeout)
	repoDir := filepath.Join(jobDir, "repo")
	ans, err := s.Solve(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, deadline)
	if err != nil {
		var escaladeErr *EscaladeError
		if errors.As(err, &escaladeErr) || errors.Is(err, git.ErrDeadline) {
			s.handleEscalation(ctx, ticketID, ticket, err)
			return
		}
		s.handleTechnicalFailure(ctx, ticketID, err)
		return
	}

	if ans.Status == config.StatusResolu {
		s.handleResolution(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, ans)
		return
	}

	_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, ans.Summary, ans.RootCause, ans.ImportantNotes)
	s.ReportEscalation(ctx, ticketID, ticket, ans)
}

func (s *Solver) handleResolution(
	ctx context.Context,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, baseSHA string,
	ans *config.Answer,
) {
	prURL, pubErr := s.Publish(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, ans)
	if pubErr != nil {
		var esc *EscaladeError
		if errors.As(pubErr, &esc) {
			ans.Status = config.StatusEscalade
			ans.Summary = esc.Message
			ans.RootCause = esc.Message
			_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, ans.Summary, ans.RootCause, ans.ImportantNotes)
			s.ReportEscalation(ctx, ticketID, ticket, ans)
			return
		}
		s.handleTechnicalFailure(ctx, ticketID, pubErr)
		return
	}

	_ = s.state.Finish(ctx, ticketID, "pr", ans.Summary, ans.RootCause, ans.ImportantNotes)
	slog.Info("PR créée", "ticket", ticketID, "url", prURL, "agent", ans.Agent, "complexité", ans.Complexity)
	s.ReportSuccess(ctx, ticketID, ticket, ans, prURL)
}

func (s *Solver) handleEscalation(ctx context.Context, ticketID int, ticket map[string]any, err error) {
	reason := err.Error()
	if errors.Is(err, git.ErrDeadline) {
		reason = fmt.Sprintf("Je n'ai pas terminé dans le délai de %d minutes.", int(s.cfg.JobTimeout.Minutes()))
	}
	ans := &config.Answer{
		Status:         config.StatusEscalade,
		Complexity:     "complexe",
		Summary:        reason,
		RootCause:      reason,
		ImportantNotes: "",
	}
	_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, ans.Summary, ans.RootCause, ans.ImportantNotes)
	s.ReportEscalation(ctx, ticketID, ticket, ans)
}

func (s *Solver) handleTechnicalFailure(ctx context.Context, ticketID int, err error) {
	slog.Error("échec technique ticket", "ticket", ticketID, "err", err)
	attempts, _ := s.state.Attempts(ctx, ticketID)
	if attempts < config.MaxAttempts {
		_ = s.state.Finish(ctx, ticketID, "retry", err.Error(), "", "")
		return
	}
	_ = s.state.Finish(ctx, ticketID, "echec", err.Error(), "", "")
	s.ReportFailure(ctx, ticketID, attempts, err.Error())
}
