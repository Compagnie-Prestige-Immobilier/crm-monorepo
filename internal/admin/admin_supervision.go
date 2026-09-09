package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/analytics"
	"cpi-go/internal/shared/socle"
	"log/slog"
	"strconv"
	"strings"
	"time"
)

// Aucune colonne n'a été ajoutée à `users` pour cet écran : un `lastRequestAt`
// coûterait une écriture par requête sur la table la plus lue. Le battement de
// cœur vit dans `agent_heartbeats`, écrit par POST /presence/beat.
const (
	FenetreConnecteMinutes = 20
	fenetreRecenteHeures   = 24
	fenetreActiviteJours   = 31
	trouMortSecondes       = 15 * 60
	CheminSupervision      = "/api/v1/admin/supervision"
)

type CompteSupervise struct {
	ID                     string                    `json:"id" format:"uuid"`
	FullName               string                    `json:"fullName"`
	Username               string                    `json:"username"`
	Email                  string                    `json:"email"`
	Role                   socle.Role                `json:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	IsActive               bool                      `json:"isActive"`
	Presence               string                    `json:"presence" enum:"ONLINE,RECENT,AWAY"`
	HasLiveSession         bool                      `json:"hasLiveSession"`
	SessionCount           int                       `json:"sessionCount"`
	LastSeenAt             *time.Time                `json:"lastSeenAt"`
	LastLoginAt            *time.Time                `json:"lastLoginAt"`
	LastSyncAt             *time.Time                `json:"lastSyncAt"`
	LastPullAt             *time.Time                `json:"lastPullAt"`
	PendingOps             *int                      `json:"pendingOps"`
	AppVersion             *string                   `json:"appVersion"`
	JournalAppelsAutorise  *bool                     `json:"journalAppelsAutorise"`
	LastWriteAt            *time.Time                `json:"lastWriteAt"`
	ActiveSecondsToday     int                       `json:"activeSecondsToday"`
	ActiveSecondsInShifts  int                       `json:"activeSecondsInShifts"`
	FirstSeenToday         *time.Time                `json:"firstSeenToday"`
	CallsToday             int                       `json:"callsToday"`
	MedianGapSeconds       *int                      `json:"medianGapSeconds"`
	MedianUploadLagSeconds *int                      `json:"medianUploadLagSeconds"`
	FirstCallAt            *time.Time                `json:"firstCallAt"`
	LastCallAt             *time.Time                `json:"lastCallAt"`
	ReachedToday           int                       `json:"reachedToday"`
	QualifiedToday         int                       `json:"qualifiedToday"`
	RepeatCalls            int                       `json:"repeatCalls"`
	DeadSeconds            int                       `json:"deadSeconds"`
	DeadGaps               int                       `json:"deadGaps"`
	Score                  analytics.NoteDeRendement `json:"score"`
}

type ComptesParPresence struct {
	Online int `json:"online"`
	Recent int `json:"recent"`
	Away   int `json:"away"`
}

type SupervisionOutput struct {
	Body struct {
		ObservedAt          time.Time                    `json:"observedAt"`
		OnlineWindowMinutes int                          `json:"onlineWindowMinutes"`
		ShiftSecondsElapsed int                          `json:"shiftSecondsElapsed"`
		Shifts              []analytics.CreneauDeTravail `json:"shifts"`
		Teleconseillers     []CompteSupervise            `json:"teleconseillers"`
		Finances            []CompteSupervise            `json:"finances"`
		Counts              ComptesParPresence           `json:"counts"`
	}
}

type comptePlateau struct {
	id, fullName, username, email string
	role                          socle.Role
	isActive                      bool
	lastLoginAt                   *time.Time
	sessions                      int
	dernierJeton                  *time.Time
	lastPullAt, lastPushAt        *time.Time
	pendingOps                    *int
	appVersion                    *string
	journalAppelsAutorise         *bool
	derniereEcriture              *time.Time
}

// Les deux rôles supervisés : l'ADMIN et le SUPERVISEUR ne produisent ni
// tentative d'appel ni présence de plateau.
const requeteComptesPlateau = `
SELECT u."id", u."fullName", u."username", u."email", u."role", u."isActive", u."lastLoginAt",
  (SELECT COUNT(*) FROM "refresh_tokens" rt
   WHERE rt."userId" = u."id" AND rt."revokedAt" IS NULL AND rt."expiresAt" > now()),
  (SELECT MAX(rt."createdAt") FROM "refresh_tokens" rt
   WHERE rt."userId" = u."id" AND rt."revokedAt" IS NULL AND rt."expiresAt" > now()),
  h."lastPullAt", h."lastPushAt", h."pendingOps", h."appVersion", h."journalAppelsAutorise",
  GREATEST(
    (SELECT MAX(ca."createdAt") FROM "call_attempts" ca
     WHERE ca."performedById" = u."id" AND ca."createdAt" >= $1),
    (SELECT MAX(rca."createdAt") FROM "rep_call_attempts" rca
     WHERE rca."performedById" = u."id" AND rca."createdAt" >= $1),
    (SELECT MAX(bt."createdAt") FROM "bank_case_transitions" bt
     WHERE bt."performedById" = u."id" AND bt."createdAt" >= $1))
FROM "users" u
LEFT JOIN "agent_heartbeats" h ON h."userId" = u."id"
WHERE u."role" IN ('COMMERCIAL', 'BANQUE_FINANCE') AND u."deletedAt" IS NULL
ORDER BY u."fullName" ASC`

func (s *service) comptesDuPlateau(ctx context.Context, depuis time.Time) ([]comptePlateau, error) {
	rows, err := s.Pool.Query(ctx, requeteComptesPlateau, depuis)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	comptes := []comptePlateau{}
	for rows.Next() {
		var c comptePlateau
		if err := rows.Scan(&c.id, &c.fullName, &c.username, &c.email, &c.role, &c.isActive,
			&c.lastLoginAt, &c.sessions, &c.dernierJeton, &c.lastPullAt, &c.lastPushAt,
			&c.pendingOps, &c.appVersion, &c.journalAppelsAutorise, &c.derniereEcriture); err != nil {
			return nil, err
		}
		comptes = append(comptes, c)
	}
	return comptes, rows.Err()
}

type metriquesDuJour struct {
	calls, reached, qualified, repeatCalls, deadSeconds, deadGaps int
	firstCallAt, lastCallAt                                       *time.Time
	medianGap, medianUploadLag                                    *int
}

type totauxDeTranches struct {
	actives, enCreneaux      int
	premiereVue, derniereVue *time.Time
}

// Une tranche compte dès que SON HEURE DE DÉBUT tombe dans un créneau : un
// créneau réglé à la demi-heure compte donc l'heure entière.
func trancheDansCreneaux(tranche time.Time, creneaux []analytics.CreneauEffectif) bool {
	debut := tranche.UTC().Hour() * 3600
	for _, c := range creneaux {
		if debut >= c.Debut && debut < c.Fin {
			return true
		}
	}
	return false
}

func (s *service) tranchesParCompte(ctx context.Context, debut time.Time, creneaux []analytics.CreneauEffectif) (map[string]*totauxDeTranches, error) {
	lignes, err := s.Q.TranchesDActivite(ctx, db.TranchesDActiviteParams{Debut: debut, Fin: debut.Add(24 * time.Hour)})
	if err != nil {
		return nil, err
	}
	totaux := map[string]*totauxDeTranches{}
	for i := range lignes {
		ligne := &lignes[i]
		total := totaux[ligne.UserId]
		if total == nil {
			total = &totauxDeTranches{}
			totaux[ligne.UserId] = total
		}
		total.actives += int(ligne.ActiveSeconds)
		if trancheDansCreneaux(ligne.Slot, creneaux) {
			total.enCreneaux += int(ligne.ActiveSeconds)
		}
		total.premiereVue = plusAncien(total.premiereVue, &ligne.FirstSeenAt)
		total.derniereVue = plusRecent(total.derniereVue, &ligne.LastSeenAt)
	}
	return totaux, nil
}

func plusRecent(a, b *time.Time) *time.Time {
	if a == nil || (b != nil && b.After(*a)) {
		return b
	}
	return a
}

func plusAncien(a, b *time.Time) *time.Time {
	if a == nil || (b != nil && b.Before(*a)) {
		return b
	}
	return a
}

// La cadence du jour : le tri, l'écart entre deux appels et les médianes se
// font en base, rapatrier les tentatives coûterait une lecture complète toutes
// les quinze secondes.
func requeteCadenceDuJour(shifts []analytics.CreneauDeTravail) string {
	branches := make([]string, 0, len(shifts))
	for _, shift := range shifts {
		branches = append(branches, `WHEN a."clientCreatedAt"::time >= '`+shift.Start+
			`'::time AND a."clientCreatedAt"::time < '`+shift.End+`'::time THEN '`+shift.Key+`'::text`)
	}
	creneauDe := "CASE " + strings.Join(branches, " ") + " END"
	trouMort := `EXTRACT(EPOCH FROM p.gap) > ` + strconv.Itoa(trouMortSecondes) + ` AND p."shift" = p."prevShift"`
	return `
WITH attempts AS (
  SELECT "performedById" AS "userId", "clientCreatedAt", "createdAt",
    'prospect' AS famille, "prospectId" AS cible,
    ("outcome" NOT IN ` + analytics.IssuesNonJointes + `)::int AS joint,
    ("outcome" = 'METHOD_OBTAINED')::int AS qualifie
  FROM "call_attempts" WHERE "clientCreatedAt" >= $1 AND "clientCreatedAt" < $2
  UNION ALL
  SELECT "performedById", "clientCreatedAt", "createdAt",
    'representant', "representantId",
    ("outcome" IN ` + analytics.IssuesRepresentantJointes + `)::int, 0
  FROM "rep_call_attempts" WHERE "clientCreatedAt" >= $1 AND "clientCreatedAt" < $2
),
situes AS (
  SELECT a.*, ` + creneauDe + ` AS "shift"
  FROM attempts a
  JOIN "users" u ON u."id" = a."userId" AND u."deletedAt" IS NULL
  WHERE u."role" IN ('COMMERCIAL', 'BANQUE_FINANCE')
),
paced AS (
  SELECT s.*, s."clientCreatedAt" - LAG(s."clientCreatedAt") OVER w AS gap,
    LAG(s."shift") OVER w AS "prevShift"
  FROM situes s
  WINDOW w AS (PARTITION BY s."userId" ORDER BY s."clientCreatedAt")
),
rappels AS (
  SELECT "userId", SUM(n - 1)::int AS repetitions
  FROM (SELECT "userId", famille, cible, COUNT(*)::int AS n FROM situes GROUP BY 1, 2, 3) t
  GROUP BY 1
),
derniere_reponse AS (
  SELECT DISTINCT ON (rca."representantId") rca."performedById" AS "userId",
    (` + analytics.ArbitrageDeLAdhesion + ` = 'AMBASSADEUR')::int AS qualifie
  FROM "rep_call_attempts" rca
  ` + analytics.JointureStatutQualification + `
  WHERE ` + analytics.ArbitrageDeLAdhesion + ` IS NOT NULL
    AND rca."clientCreatedAt" >= $1 AND rca."clientCreatedAt" < $2
  ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC
),
representants_qualifies AS (
  SELECT "userId", SUM(qualifie)::int AS qualifies FROM derniere_reponse GROUP BY 1
)
SELECT p."userId", COUNT(*)::int, MIN(p."clientCreatedAt"), MAX(p."clientCreatedAt"),
  SUM(p.joint)::int,
  (SUM(p.qualifie) + COALESCE(MAX(q.qualifies), 0))::int,
  COALESCE(MAX(r.repetitions), 0)::int,
  COUNT(*) FILTER (WHERE ` + trouMort + `)::int,
  COALESCE(SUM(EXTRACT(EPOCH FROM p.gap)) FILTER (WHERE ` + trouMort + `), 0)::int,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM p.gap)))::int,
  ROUND(percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (p."createdAt" - p."clientCreatedAt"))))::int
FROM paced p
LEFT JOIN representants_qualifies q ON q."userId" = p."userId"
LEFT JOIN rappels r ON r."userId" = p."userId"
GROUP BY p."userId"`
}

func (s *service) cadenceDuJour(ctx context.Context, debut time.Time, shifts []analytics.CreneauDeTravail) map[string]*metriquesDuJour {
	cadence := map[string]*metriquesDuJour{}
	rows, err := s.Pool.Query(ctx, requeteCadenceDuJour(shifts), debut, debut.Add(24*time.Hour))
	if err != nil {
		// La cadence complète la présence, elle ne la porte pas : l'écran reste
		// lisible sans elle.
		slog.Warn("supervision : cadence du jour indisponible", "err", err)
		return cadence
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var m metriquesDuJour
		if err := rows.Scan(&id, &m.calls, &m.firstCallAt, &m.lastCallAt, &m.reached, &m.qualified,
			&m.repeatCalls, &m.deadGaps, &m.deadSeconds, &m.medianGap, &m.medianUploadLag); err != nil {
			slog.Warn("supervision : ligne de cadence illisible", "err", err)
			return cadence
		}
		cadence[id] = &m
	}
	if err := rows.Err(); err != nil {
		slog.Warn("supervision : cadence du jour interrompue", "err", err)
	}
	return cadence
}

// La présence se déduit des traces existantes, jamais d'une colonne dédiée.
func presenceDuCompte(vu *time.Time, actif, sessionVivante bool, maintenant time.Time) string {
	if vu == nil {
		return "AWAY"
	}
	minutes := maintenant.Sub(*vu).Minutes()
	if actif && sessionVivante && minutes >= 0 && minutes <= FenetreConnecteMinutes {
		return "ONLINE"
	}
	if minutes <= fenetreRecenteHeures*60 {
		return "RECENT"
	}
	return "AWAY"
}

func versCompteSupervise(c *comptePlateau, tranches *totauxDeTranches, m *metriquesDuJour, creneauxEcoules int, maintenant time.Time) CompteSupervise {
	if tranches == nil {
		tranches = &totauxDeTranches{}
	}
	if m == nil {
		m = &metriquesDuJour{}
	}
	// Un pull ne laisse aucune autre trace : sans lui, un panneau ouvert qui
	// n'écrit rien passerait pour absent pendant des heures.
	remontee := plusRecent(c.lastPushAt, c.lastPullAt)
	vu := plusRecent(plusRecent(plusRecent(plusRecent(c.dernierJeton, tranches.derniereVue), remontee), c.derniereEcriture), c.lastLoginAt)
	rendement := analytics.RendementDunTeleconseiller{
		TeleconseillerID: c.id, TeleconseillerName: c.fullName,
		ActiveSecondsInShifts: tranches.enCreneaux, ShiftSecondsElapsed: creneauxEcoules,
		Calls: m.calls, Reached: m.reached, Qualified: m.qualified,
		RepeatCalls: m.repeatCalls, DeadSeconds: m.deadSeconds,
	}
	return CompteSupervise{
		ID: c.id, FullName: c.fullName, Username: c.username, Email: c.email,
		Role: c.role, IsActive: c.isActive,
		Presence:       presenceDuCompte(vu, c.isActive, c.dernierJeton != nil, maintenant),
		HasLiveSession: c.dernierJeton != nil, SessionCount: c.sessions,
		LastSeenAt: vu, LastLoginAt: c.lastLoginAt, LastSyncAt: c.lastPushAt, LastPullAt: c.lastPullAt,
		PendingOps: c.pendingOps, AppVersion: c.appVersion, JournalAppelsAutorise: c.journalAppelsAutorise,
		LastWriteAt:           c.derniereEcriture,
		ActiveSecondsToday:    tranches.actives,
		ActiveSecondsInShifts: tranches.enCreneaux,
		FirstSeenToday:        tranches.premiereVue,
		CallsToday:            m.calls,
		MedianGapSeconds:      m.medianGap, MedianUploadLagSeconds: m.medianUploadLag,
		FirstCallAt: m.firstCallAt, LastCallAt: m.lastCallAt,
		ReachedToday: m.reached, QualifiedToday: m.qualified, RepeatCalls: m.repeatCalls,
		DeadSeconds: m.deadSeconds, DeadGaps: m.deadGaps,
		Score: analytics.NoterRendement(&rendement),
	}
}

func (s *service) supervisionDesComptes(ctx context.Context, _ *struct{}) (*SupervisionOutput, error) {
	maintenant := time.Now().UTC()
	// Dakar est à UTC+00:00 toute l'année : la journée civile commence au minuit UTC.
	jour := time.Date(maintenant.Year(), maintenant.Month(), maintenant.Day(), 0, 0, 0, 0, time.UTC)

	shifts := analytics.CreneauxOuValeursParDefaut(ctx, s.Deps)
	creneaux := analytics.CreneauxRabotes(shifts, &analytics.FiltreDeSupervision{})
	ecoulees := analytics.SecondesDeCreneauEcoulees(jour.Format(time.DateOnly), creneaux, maintenant)

	comptes, err := s.comptesDuPlateau(ctx, maintenant.AddDate(0, 0, -fenetreActiviteJours))
	if err != nil {
		return nil, err
	}
	tranches, err := s.tranchesParCompte(ctx, jour, creneaux)
	if err != nil {
		return nil, err
	}
	cadence := s.cadenceDuJour(ctx, jour, shifts)

	out := &SupervisionOutput{}
	out.Body.ObservedAt = maintenant
	out.Body.OnlineWindowMinutes = FenetreConnecteMinutes
	out.Body.ShiftSecondsElapsed = ecoulees
	out.Body.Shifts = shifts
	out.Body.Teleconseillers = []CompteSupervise{}
	out.Body.Finances = []CompteSupervise{}
	for i := range comptes {
		ligne := versCompteSupervise(&comptes[i], tranches[comptes[i].id], cadence[comptes[i].id], ecoulees, maintenant)
		switch ligne.Presence {
		case "ONLINE":
			out.Body.Counts.Online++
		case "RECENT":
			out.Body.Counts.Recent++
		default:
			out.Body.Counts.Away++
		}
		if ligne.Role == socle.Commercial {
			out.Body.Teleconseillers = append(out.Body.Teleconseillers, ligne)
			continue
		}
		out.Body.Finances = append(out.Body.Finances, ligne)
	}
	return out, nil
}
