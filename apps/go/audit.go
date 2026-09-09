package main

import (
	"context"
	"cpi-go/db"
	"encoding/json"

	"github.com/google/uuid"
)

// Seul point d'écriture du journal d'audit, toujours dans la transaction du
// geste : une trace écrite dehors survivrait à un geste annulé.
func auditer(ctx context.Context, q *db.Queries, userID, action, entite, entiteID string, avant, apres any) error {
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
	return q.InsertAuditLog(ctx, p)
}
