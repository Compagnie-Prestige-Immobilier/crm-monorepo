package state

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

type JobRetry struct {
	TicketID int
	Project  string
}

type JobRecord struct {
	TicketID  int    `json:"id"`
	Project   string `json:"projet"`
	Status    string `json:"statut"`
	Attempts  int    `json:"essais"`
	UpdatedAt string `json:"majLe"`
	Link      string `json:"lien"`
	Resume    string `json:"resume,omitempty"`
	Cause     string `json:"cause,omitempty"`
	Notes     string `json:"notes,omitempty"`
}

type Store struct {
	db *sql.DB
	mu sync.Mutex
}

func Open(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("création répertoire base : %w", err)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("ouverture base sqlite : %w", err)
	}

	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.init(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) init(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS kairo_jobs (
			ticket_id INTEGER PRIMARY KEY,
			project TEXT NOT NULL,
			status TEXT NOT NULL,
			attempts INTEGER NOT NULL DEFAULT 1,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			resume TEXT NOT NULL DEFAULT '',
			cause TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT ''
		)`,
		`UPDATE kairo_jobs SET status='retry', updated_at=datetime('now', '-1 day') WHERE status='running'`,
		`CREATE TABLE IF NOT EXISTS kairo_pause (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			depuis TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, q := range queries {
		if _, err := s.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("init db (%s) : %w", q, err)
		}
	}
	for _, col := range []string{"resume", "cause", "notes"} {
		_, _ = s.db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE kairo_jobs ADD COLUMN %s TEXT NOT NULL DEFAULT ''", col))
	}
	return nil
}

func (s *Store) Known(ctx context.Context, ticketID int) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var dummy int
	err := s.db.QueryRowContext(ctx, "SELECT 1 FROM kairo_jobs WHERE ticket_id=?", ticketID).Scan(&dummy)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) Claim(ctx context.Context, ticketID int, project string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	res, err := s.db.ExecContext(
		ctx,
		`INSERT INTO kairo_jobs(ticket_id, project, status) VALUES (?, ?, 'running')
		ON CONFLICT(ticket_id) DO UPDATE SET status='running', attempts=kairo_jobs.attempts+1, updated_at=CURRENT_TIMESTAMP
		WHERE kairo_jobs.status='retry'`,
		ticketID, project,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows == 1, nil
}

func (s *Store) Attempts(ctx context.Context, ticketID int) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var attempts int
	err := s.db.QueryRowContext(ctx, "SELECT attempts FROM kairo_jobs WHERE ticket_id=?", ticketID).Scan(&attempts)
	if err != nil {
		return 0, err
	}
	return attempts, nil
}

func (s *Store) DueRetries(ctx context.Context, retryDelayModifier string) ([]JobRetry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.QueryContext(
		ctx,
		"SELECT ticket_id, project FROM kairo_jobs WHERE status='retry' AND updated_at <= datetime('now', ?)",
		retryDelayModifier,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var list []JobRetry
	for rows.Next() {
		var r JobRetry
		if err := rows.Scan(&r.TicketID, &r.Project); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (s *Store) Finish(ctx context.Context, ticketID int, status string, resume, cause, notes string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.ExecContext(
		ctx,
		"UPDATE kairo_jobs SET status=?, resume=?, cause=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE ticket_id=?",
		status, resume, cause, notes, ticketID,
	)
	return err
}

func (s *Store) PausedSince(ctx context.Context) (depuis string, paused bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	err = s.db.QueryRowContext(ctx, "SELECT depuis FROM kairo_pause WHERE id=1").Scan(&depuis)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return depuis, true, nil
}

func (s *Store) Pause(ctx context.Context, active bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if active {
		_, err := s.db.ExecContext(ctx, "INSERT OR IGNORE INTO kairo_pause(id) VALUES (1)")
		return err
	}
	_, err := s.db.ExecContext(ctx, "DELETE FROM kairo_pause")
	return err
}

func (s *Store) Relaunch(ctx context.Context, ticketID int) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	res, err := s.db.ExecContext(
		ctx,
		`UPDATE kairo_jobs SET status='retry', attempts=0, resume='', cause='', notes='', updated_at=datetime('now', '-1 day')
		WHERE ticket_id=? AND status IN ('echec', 'escalade')`,
		ticketID,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows == 1, nil
}

func (s *Store) Recent(ctx context.Context) ([]JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.QueryContext(ctx, "SELECT ticket_id, project, status, attempts, updated_at, resume, cause, notes FROM kairo_jobs ORDER BY updated_at DESC LIMIT 50")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var list []JobRecord
	for rows.Next() {
		var r JobRecord
		if err := rows.Scan(&r.TicketID, &r.Project, &r.Status, &r.Attempts, &r.UpdatedAt, &r.Resume, &r.Cause, &r.Notes); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}
