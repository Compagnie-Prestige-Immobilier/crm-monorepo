package solver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
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

var reSecret = regexp.MustCompile(`(?i)(ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]{20,})`)

func sanitiser(s string) string {
	if s == "" {
		return ""
	}
	return reSecret.ReplaceAllString(s, "[SECRET MASQUÉ]")
}

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
	currentOut := vOut
	var lastSummary string
	const maxEssais = 2

	for essai := 1; essai <= maxEssais; essai++ {
		failureSnippet := currentOut
		if len(failureSnippet) > 6000 {
			failureSnippet = failureSnippet[len(failureSnippet)-6000:]
		}

		motif := fmt.Sprintf("La vérification (%s) échoue après tes changements (essai de correction %d/%d) :\n%s", project.VerificationCommand, essai, maxEssais, failureSnippet)
		retryPrompt := TicketPrompt(ticketID, ticket, project, motif)
		ans, askErr := agent.Ask(ctx, spec, token, jobDir, repoDir, retryPrompt, deadline)
		if askErr != nil {
			return nil, "", askErr
		}
		if ans.Status == config.StatusEscalade {
			return ans, "", nil
		}
		lastSummary = ans.Summary

		vOut2, code2, vErr2 := git.Verify(ctx, repoDir, project, jobDir, deadline)
		if vErr2 == nil && code2 == 0 {
			return ans, "", nil
		}
		if isStopSignal(vErr2) {
			return nil, "", vErr2
		}
		currentOut = vOut2
	}

	vOutSnippet := currentOut
	if len(vOutSnippet) > 3000 {
		vOutSnippet = vOutSnippet[len(vOutSnippet)-3000:]
	}
	failNote := fmt.Sprintf("%s n'a pas fait passer la vérification après %d essais de correction. Son résumé : %s\n%s", spec.Name, maxEssais, lastSummary, vOutSnippet)
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
	if isStopSignal(vErr) {
		return nil, "", vErr
	}

	return retryAgentVerification(ctx, spec, token, ticketID, ticket, project, jobDir, repoDir, vOut, deadline)
}

func isStopSignal(err error) bool {
	return errors.Is(err, git.ErrDeadline) || errors.Is(err, git.ErrCancelled)
}

func handleAgentError(err error, spec config.AgentSpec, ticketID int, deadline time.Time) (prev, unavail string, stopErr error) {
	if isStopSignal(err) {
		return "", "", err
	}
	var unavailErr *agent.UnavailableError
	if errors.As(err, &unavailErr) {
		slog.Warn("agent indisponible", "ticket", ticketID, "err", unavailErr.Message)
		return "", unavailErr.Message, nil
	}
	if time.Until(deadline) < 60*time.Second {
		return "", "", git.ErrDeadline
	}
	prevErr := config.Redact(err.Error())
	if len(prevErr) > 2000 {
		prevErr = prevErr[len(prevErr)-2000:]
	}
	slog.Warn("échec agent", "ticket", ticketID, "agent", spec.Name, "err", prevErr)
	return fmt.Sprintf("%s n'a pas abouti : %s", spec.Name, prevErr), "", nil
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

		prev, unavailMsg, stopErr := handleAgentError(err, spec, ticketID, deadline)
		if stopErr != nil {
			return nil, stopErr
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

type DecisionTriage struct {
	NonTechnique bool
	EstVague     bool
	Raison       string
	Reponse      string
}

func estDemandeAcces(plain string) bool {
	mots := []string{"mot de passe", "password", "mdp", "identifiant", "compte bloque", "compte bloqué", "acces refuse", "accès refusé"}
	for _, m := range mots {
		if strings.Contains(plain, m) {
			return true
		}
	}
	return false
}

func estQuestionUsage(plain string) bool {
	mots := []string{"comment faire pour", "question d usage", "question d'usage", "ou trouver", "où trouver", "formation", "mode d'emploi"}
	for _, m := range mots {
		if strings.Contains(plain, m) {
			return true
		}
	}
	return false
}

func estSignalementImprecis(content string) bool {
	return len(strings.TrimSpace(config.PlainText(content))) < 15
}

func evaluerTriage(ticket map[string]any) DecisionTriage {
	name, _ := ticket["name"].(string)
	content, _ := ticket["content"].(string)
	plain := strings.ToLower(config.PlainText(name + " " + content))

	if estDemandeAcces(plain) {
		return DecisionTriage{
			NonTechnique: true,
			Raison:       "Demande d'accès ou mot de passe",
			Reponse:      "Bonjour. Ce ticket concerne une demande d'accès ou de mot de passe. Kairo intervient exclusivement sur le code applicatif. Votre demande est transmise à l'équipe support.",
		}
	}
	if estQuestionUsage(plain) {
		return DecisionTriage{
			NonTechnique: true,
			Raison:       "Question d'usage ou accompagnement",
			Reponse:      "Bonjour. Ce ticket concerne une question d'usage ou d'accompagnement fonctionnel. Kairo traite les anomalies et évolutions de code. L'équipe support prend le relais pour vous répondre.",
		}
	}
	if estSignalementImprecis(content) {
		return DecisionTriage{
			NonTechnique: true,
			EstVague:     true,
			Raison:       "Signalement imprécis ou description incomplète",
			Reponse:      "Bonjour. Pour nous permettre d'analyser et de corriger cette anomalie sur le CRM, pourriez-vous préciser le contexte exact, les étapes pas à pas pour reproduire le comportement, ainsi que le message d'erreur ou une capture d'écran ? Le ticket est placé en attente de votre retour.",
		}
	}
	return DecisionTriage{NonTechnique: false}
}

func (s *Solver) verifierDoublon(ctx context.Context, ticketID int, projectName, title string, dureeSec int) bool {
	dupID, dupPR, err := s.state.FindDuplicatePR(ctx, projectName, title)
	if err != nil || dupPR == "" || dupID <= 0 {
		return false
	}
	slog.Info("ticket doublon détecté", "ticket", ticketID, "doublonDe", dupID, "pr", dupPR)
	msg := fmt.Sprintf("Ce ticket semble identique au ticket #%d déjà traité. La pull request existante a été associée : %s", dupID, dupPR)
	_ = s.glpiClient.Followup(ctx, ticketID, msg)
	_ = s.state.Finish(ctx, ticketID, "pr", fmt.Sprintf("Doublon du ticket #%d (PR existante réutilisée).", dupID), fmt.Sprintf("Ticket identique au #%d.", dupID), "", dupPR, "", dureeSec)
	return true
}

func (s *Solver) verifierTriage(ctx context.Context, ticketID int, ticket map[string]any, dureeSec int) bool {
	triage := evaluerTriage(ticket)
	if !triage.NonTechnique {
		return false
	}
	slog.Info("ticket pré-qualifié en triage hors-code", "ticket", ticketID, "raison", triage.Raison, "vague", triage.EstVague)
	_ = s.glpiClient.Followup(ctx, ticketID, triage.Reponse)
	if triage.EstVague {
		if err := s.glpiClient.SetStatus(ctx, ticketID, config.GLPIWaiting); err != nil {
			slog.Warn("impossible de passer le ticket en attente dans GLPI", "ticket", ticketID, "err", err)
		}
	}
	_ = s.state.Finish(ctx, ticketID, "triage", triage.Reponse, triage.Raison, "", "", "", dureeSec)
	return true
}

func ticketEstClos(ticket map[string]any) bool {
	statusVal := 0
	switch v := ticket["status"].(type) {
	case float64:
		statusVal = int(v)
	case int:
		statusVal = v
	}
	return statusVal >= config.GLPIClosed
}

func (s *Solver) prepareTicketWorkspace(ctx context.Context, project *config.Project, ticketID int, ticket map[string]any, jobDir string) (baseSHA string, err error) {
	if err := os.MkdirAll(filepath.Join(jobDir, "tmp"), 0o750); err != nil {
		return "", err
	}

	attempts, _ := s.state.Attempts(ctx, ticketID)
	_ = s.glpiClient.Take(ctx, ticket, project.CategoryID)
	if attempts <= 1 {
		_ = s.glpiClient.Followup(ctx, ticketID, "Je prends ce ticket. Je reviens ici dès qu'une correction est prête, ou je passe la main à l'équipe s'il faut trancher.")
	}

	token, err := s.ghClient.GetToken(ctx, project)
	if err != nil {
		return "", err
	}

	repoDir := filepath.Join(jobDir, "repo")
	gitDir := filepath.Join(jobDir, "git")
	if err := git.Clone(ctx, project, repoDir, jobDir, token, 50, "--separate-git-dir="+gitDir); err != nil {
		return "", fmt.Errorf("clone initial : %w", err)
	}

	gitEnv, err := git.GitEnv(jobDir, "")
	if err != nil {
		return "", err
	}

	sha, err := git.ExecGit(ctx, repoDir, gitEnv, 60*time.Second, "rev-parse", "HEAD")
	if err != nil {
		return "", fmt.Errorf("rev-parse HEAD : %w", err)
	}
	return strings.TrimSpace(sha), nil
}

func (s *Solver) RunJob(ctx context.Context, ticketID int, projectName string) {
	debut := time.Now()
	duree := func() int { return int(time.Since(debut).Seconds()) }

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
		_ = s.state.Finish(ctx, ticketID, "echec", "Projet introuvable : "+projectName, "", "", "", "", duree())
		return
	}

	_ = s.state.SetStep(ctx, ticketID, "running:analyse")
	ticket, err := s.glpiClient.Ticket(ctx, ticketID)
	if err != nil {
		s.handleTechnicalFailure(ctx, ticketID, err, duree())
		return
	}
	if ticketEstClos(ticket) {
		_ = s.state.Finish(ctx, ticketID, "abandon", "Ticket clos ou résolu dans GLPI avant traitement.", "", "", "", "", duree())
		return
	}

	ticketName, _ := ticket["name"].(string)
	_ = s.state.SetTitle(ctx, ticketID, ticketName)

	if s.verifierDoublon(ctx, ticketID, projectName, ticketName, duree()) {
		return
	}
	if s.verifierTriage(ctx, ticketID, ticket, duree()) {
		return
	}

	baseSHA, err := s.prepareTicketWorkspace(ctx, project, ticketID, ticket, jobDir)
	if err != nil {
		if errors.Is(err, git.ErrCancelled) {
			s.handleCancellation(ticketID)
			return
		}
		s.handleTechnicalFailure(ctx, ticketID, err, duree())
		return
	}

	deadline := time.Now().Add(s.cfg.JobTimeout)
	repoDir := filepath.Join(jobDir, "repo")
	ans, err := s.Solve(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, deadline)
	if err != nil {
		if errors.Is(err, git.ErrCancelled) {
			s.handleCancellation(ticketID)
			return
		}
		var escaladeErr *EscaladeError
		if errors.As(err, &escaladeErr) || errors.Is(err, git.ErrDeadline) {
			s.handleEscalation(ctx, ticketID, ticket, err, duree())
			return
		}
		s.handleTechnicalFailure(ctx, ticketID, err, duree())
		return
	}

	if ans.Status == config.StatusResolu {
		s.handleResolution(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, ans, duree())
		return
	}

	_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, sanitiser(ans.Summary), sanitiser(ans.RootCause), sanitiser(ans.ImportantNotes), "", "", duree())
	s.ReportEscalation(ctx, ticketID, ticket, ans)
}

func (s *Solver) handleResolution(
	ctx context.Context,
	ticketID int,
	ticket map[string]any,
	project *config.Project,
	jobDir, repoDir, baseSHA string,
	ans *config.Answer,
	dureeSec int,
) {
	_ = s.state.SetStep(ctx, ticketID, "running:publication")
	prURL, pubErr := s.Publish(ctx, ticketID, ticket, project, jobDir, repoDir, baseSHA, ans)
	if pubErr != nil {
		if errors.Is(pubErr, git.ErrCancelled) {
			s.handleCancellation(ticketID)
			return
		}
		var esc *EscaladeError
		if errors.As(pubErr, &esc) {
			ans.Status = config.StatusEscalade
			ans.Summary = esc.Message
			ans.RootCause = esc.Message
			_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, sanitiser(ans.Summary), sanitiser(ans.RootCause), sanitiser(ans.ImportantNotes), "", "", dureeSec)
			s.ReportEscalation(ctx, ticketID, ticket, ans)
			return
		}
		s.handleTechnicalFailure(ctx, ticketID, pubErr, dureeSec)
		return
	}

	fichiers := strings.Join(ans.ChangedFiles, ",")
	_ = s.state.Finish(ctx, ticketID, "pr", sanitiser(ans.Summary), sanitiser(ans.RootCause), sanitiser(ans.ImportantNotes), prURL, fichiers, dureeSec)
	slog.Info("PR créée", "ticket", ticketID, "url", prURL, "agent", ans.Agent, "complexité", ans.Complexity)
	s.ReportSuccess(ctx, ticketID, ticket, ans, prURL)
}

func (s *Solver) handleEscalation(ctx context.Context, ticketID int, ticket map[string]any, err error, dureeSec int) {
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
	_ = s.state.Finish(ctx, ticketID, config.StatusEscalade, sanitiser(ans.Summary), sanitiser(ans.RootCause), sanitiser(ans.ImportantNotes), "", "", dureeSec)
	s.ReportEscalation(ctx, ticketID, ticket, ans)
}

func (s *Solver) handleCancellation(ticketID int) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	message := "Je me suis arrêté à la demande de l'équipe. Le ticket peut être relancé quand vous voulez."
	_ = s.state.Finish(ctx, ticketID, "arrete", message, "", "", "", "", 0)
	if err := s.glpiClient.Followup(ctx, ticketID, message); err != nil {
		slog.Error("suivi GLPI d'arrêt non posté", "ticket", ticketID, "err", err)
	}
}

func (s *Solver) handleTechnicalFailure(ctx context.Context, ticketID int, err error, dureeSec int) {
	slog.Error("échec technique ticket", "ticket", ticketID, "err", err)
	attempts, _ := s.state.Attempts(ctx, ticketID)
	if attempts < config.MaxAttempts {
		_ = s.state.Finish(ctx, ticketID, "retry", sanitiser(err.Error()), "", "", "", "", dureeSec)
		return
	}
	_ = s.state.Finish(ctx, ticketID, "echec", sanitiser(err.Error()), "", "", "", "", dureeSec)
	s.ReportFailure(ctx, ticketID, attempts, err.Error())
}
