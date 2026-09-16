package database

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"errors"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

// Une fiche devenue plateforme passe aux CCP tout entière : hors des campagnes,
// et ses rappels promis avec elle, au CCP le moins chargé.
func PasserAuxCCP(ctx context.Context, q *db.Queries, demandeur, prospectID string) error {
	if err := RetirerDesCampagnes(ctx, q, demandeur, "lot_export.plateforme", prospectID); err != nil {
		return err
	}
	rappels, err := q.RappelsPendantsDuProspect(ctx, prospectID)
	if err != nil || len(rappels) == 0 {
		return err
	}
	ccp, err := q.CCPLeMoinsCharge(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		slog.Warn("rappels non transférés : aucun CCP actif", "prospectId", prospectID)
		return nil
	}
	if err != nil {
		return err
	}
	for _, rappel := range rappels {
		if rappel.AssignedToId == ccp {
			continue
		}
		if err := q.ReattribuerRappel(ctx, db.ReattribuerRappelParams{ID: rappel.ID, Vers: ccp}); err != nil {
			return err
		}
		if err := Auditer(ctx, q, demandeur, "rappel.reattribue", "scheduled_callback", rappel.ID,
			map[string]any{"assignedToId": rappel.AssignedToId},
			map[string]any{"assignedToId": ccp, "prospectId": prospectID}); err != nil {
			return err
		}
	}
	return nil
}

// Une fiche qui quitte le périmètre d'une campagne en sort à l'instant : la
// ligne disparaît et la campagne se recompte seule. Le journal garde la
// position et l'attribution, l'historique des appels reste sur la fiche.
func RetirerDesCampagnes(ctx context.Context, q *db.Queries, demandeur, action, prospectID string) error {
	lots, err := q.LotsDuProspect(ctx, &prospectID)
	if err != nil || len(lots) == 0 {
		return err
	}
	if err := q.RetirerProspectDesCampagnes(ctx, &prospectID); err != nil {
		return err
	}
	for _, lot := range lots {
		if err := Auditer(ctx, q, demandeur, action, "lot_export", lot.LotId, nil,
			map[string]any{"prospectId": prospectID, "position": lot.Position, "teleconseillerId": lot.AssigneeId}); err != nil {
			return err
		}
	}
	return nil
}
