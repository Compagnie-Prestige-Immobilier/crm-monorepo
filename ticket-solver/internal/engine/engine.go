package engine

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"ticket-solver/internal/config"
	"ticket-solver/internal/glpi"
	"ticket-solver/internal/solver"
	"ticket-solver/internal/state"
)

type Engine struct {
	cfg        *config.Config
	state      *state.Store
	glpiClient *glpi.Client
	solver     *solver.Solver
	lastPoll   *atomic.Int64

	sem     chan struct{}
	wg      sync.WaitGroup
	ignored map[int]string
	active  map[int]context.CancelFunc
	mu      sync.Mutex
}

func New(
	cfg *config.Config,
	s *state.Store,
	g *glpi.Client,
	solv *solver.Solver,
	lastPoll *atomic.Int64,
) *Engine {
	return &Engine{
		cfg:        cfg,
		state:      s,
		glpiClient: g,
		solver:     solv,
		lastPoll:   lastPoll,
		sem:        make(chan struct{}, cfg.MaxConcurrentJobs),
		ignored:    make(map[int]string),
		active:     make(map[int]context.CancelFunc),
	}
}

func (e *Engine) Poll(ctx context.Context) {
	_, paused, err := e.state.PausedSince(ctx)
	if err != nil {
		slog.Error("erreur vérification pause", "err", err)
		return
	}
	if paused {
		return
	}

	for i := range e.cfg.Projects {
		e.pollProject(ctx, &e.cfg.Projects[i])
	}

	e.pollRetries(ctx)
	_ = e.state.CheckpointWAL(ctx)
}

func (e *Engine) pollProject(ctx context.Context, project *config.Project) {
	tickets, err := e.glpiClient.NewTickets(ctx, project.CategoryID)
	if err != nil {
		slog.Error("lecture GLPI impossible pour catégorie", "cat", project.CategoryID, "err", err)
		return
	}

	for _, t := range tickets {
		e.processNewTicket(ctx, project, t)
	}
}

func (e *Engine) processNewTicket(ctx context.Context, project *config.Project, t glpi.TicketSummary) {
	e.mu.Lock()
	prevMod, wasIgnored := e.ignored[t.ID]
	e.mu.Unlock()

	if wasIgnored && prevMod == t.DateMod {
		return
	}

	known, err := e.state.Known(ctx, t.ID)
	if err != nil || known {
		return
	}

	ticketData, err := e.glpiClient.Ticket(ctx, t.ID)
	if err != nil {
		return
	}

	name, _ := ticketData["name"].(string)
	content, _ := ticketData["content"].(string)
	if !config.HasMarker(name, content, project.Markers) {
		if !e.solver.ClassifyProject(ctx, name, content, project.Name) {
			e.mu.Lock()
			e.ignored[t.ID] = t.DateMod
			e.mu.Unlock()
			return
		}
		slog.Info("ticket sans marqueur qualifié par JEV", "ticket", t.ID, "projet", project.Name)
	}

	claimed, err := e.state.Claim(ctx, t.ID, project.Name)
	if err != nil || !claimed {
		return
	}

	slog.Info("ticket pris en charge", "ticket", t.ID, "projet", project.Name)
	e.launch(ctx, t.ID, project.Name)
}

func (e *Engine) pollRetries(ctx context.Context) {
	retries, err := e.state.DueRetries(ctx, "-15 minutes")
	if err != nil {
		return
	}

	for _, r := range retries {
		claimed, err := e.state.Claim(ctx, r.TicketID, r.Project)
		if err != nil || !claimed {
			continue
		}
		slog.Info("ticket nouvel essai", "ticket", r.TicketID, "projet", r.Project)
		e.launch(ctx, r.TicketID, r.Project)
	}
}

func (e *Engine) launch(ctx context.Context, ticketID int, projectName string) {
	e.wg.Add(1)
	jobCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	e.mu.Lock()
	e.active[ticketID] = cancel
	e.mu.Unlock()

	go func() {
		defer e.wg.Done()
		defer func() {
			e.mu.Lock()
			delete(e.active, ticketID)
			e.mu.Unlock()
			cancel()
		}()
		e.sem <- struct{}{}
		defer func() { <-e.sem }()

		slog.Info("ticket en traitement", "ticket", ticketID, "projet", projectName)
		e.solver.RunJob(jobCtx, ticketID, projectName)
	}()
}

// Stop annule le job en cours pour ce ticket, s'il y en a un. Renvoie false si
// aucun job n'est actif pour ce ticket (déjà terminé, ou jamais démarré).
func (e *Engine) Stop(ticketID int) bool {
	e.mu.Lock()
	cancel, ok := e.active[ticketID]
	e.mu.Unlock()
	if ok {
		cancel()
	}
	return ok
}

func (e *Engine) Wait() {
	e.wg.Wait()
}
