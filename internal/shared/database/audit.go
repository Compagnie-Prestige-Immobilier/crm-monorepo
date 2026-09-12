package database

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
)

// Seul point d'écriture du journal d'audit, toujours dans la transaction du
// geste : une trace écrite dehors survivrait à un geste annulé.
func Auditer(ctx context.Context, q *db.Queries, userID, action, entite, entiteID string, avant, apres any) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	p := db.InsertAuditLogParams{ID: id.String(), UserId: &userID, Action: action, Entity: entite, EntityId: entiteID}
	if avant != nil {
		if p.Before, err = json.Marshal(avant); err != nil {
			return err
		}
	}
	if apres != nil {
		if p.After, err = json.Marshal(apres); err != nil {
			return err
		}
	}
	// La trace en base se lit dans l'écran Exploitation, pas dans le terminal
	// pendant un incident. La ligne nomme le geste, sa cible et son auteur ; les
	// états avant et après restent en base, ils n'ont rien à faire dans un flux.
	if err := q.InsertAuditLog(ctx, p); err != nil {
		slog.Error("trace d’audit non écrite", "action", action, "entite", entite, "entiteId", entiteID, "userId", userID, "err", err)
		return err
	}
	slog.Info("écriture", "action", action, "entite", entite, "entiteId", entiteID, "userId", userID)
	return nil
}
