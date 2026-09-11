package banque

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"strconv"
)

const banqueJoursRetard = 7

type EntonnoirBanque struct {
	Inscrits  int32 `json:"inscrits"`
	Soumis    int32 `json:"soumis"`
	Valides   int32 `json:"valides"`
	Ouverts   int32 `json:"ouverts"`
	Encaisses int32 `json:"encaisses"`
}

type DureeEtapeBanque struct {
	StageID     string   `json:"stageId"`
	Label       string   `json:"label"`
	MedianHours *float64 `json:"medianHours"`
}

type TeleconseillerBanque struct {
	AgentID   string `json:"agentId"`
	Label     string `json:"label"`
	Cases     int32  `json:"cases"`
	Cashed    int32  `json:"cashed"`
	AmountXof string `json:"amountXof"`
}

type PilotageBanque struct {
	Entonnoir             EntonnoirBanque        `json:"entonnoir"`
	MedianDelayHours      *float64               `json:"medianDelayHours"`
	Overdue               int32                  `json:"overdue"`
	OverdueDays           int32                  `json:"overdueDays"`
	CompletsNonOuverts    int32                  `json:"completsNonOuverts"`
	CompletsNonOuverts48h int32                  `json:"completsNonOuverts48h"`
	ByStageDuration       []DureeEtapeBanque     `json:"byStageDuration"`
	ByTeleconseiller      []TeleconseillerBanque `json:"byTeleconseiller"`
}

func (s *service) pilotageBanque(ctx context.Context, f *FiltreBanque, where string, args []any) (PilotageBanque, error) {
	p := PilotageBanque{OverdueDays: banqueJoursRetard, ByStageDuration: []DureeEtapeBanque{}, ByTeleconseiller: []TeleconseillerBanque{}}
	if err := s.banqueDelaisEtRetards(ctx, where, args, &p); err != nil {
		return p, err
	}
	if err := s.banqueEntonnoir(ctx, f.Projet, &p); err != nil {
		return p, err
	}
	if err := s.banqueDureesParEtape(ctx, where, args, &p); err != nil {
		return p, err
	}
	err := s.banqueParTeleconseiller(ctx, where, args, &p)
	return p, err
}

func (s *service) banqueDelaisEtRetards(ctx context.Context, where string, args []any, p *PilotageBanque) error {
	requete := `SELECT
		(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
			FILTER (WHERE s."type" = 'CASHED' AND cl."closedAt" IS NOT NULL))::float8,
		COUNT(*) FILTER (WHERE s."type" = 'OPEN' AND c."createdAt" < now() - make_interval(days => ` +
		strconv.Itoa(banqueJoursRetard) + `))::int` +
		depuisDossier + clotureDossier + " WHERE " + where
	var median *float64
	if err := s.Pool.QueryRow(ctx, requete, args...).Scan(&median, &p.Overdue); err != nil {
		return err
	}
	p.MedianDelayHours = banqueHeures(median)
	return nil
}

// L'entonnoir suit les inscriptions de la plateforme, du compte créé à
// l'encaissement : c'est la seule série qui couvre tout le parcours.
func (s *service) banqueEntonnoir(ctx context.Context, projet string, p *PilotageBanque) error {
	if projet == "" {
		projet = string(db.ProjetCHUES)
	}
	statuts, err := socle.StatutsDossierComplet(ctx, s.Q, projet)
	if err != nil {
		return err
	}
	const complete = `((cardinality($2::text[]) = 0 AND i."decideeLe" IS NOT NULL) OR i."statutDistant" = ANY($2::text[]))`
	const dossier = `EXISTS (SELECT 1 FROM "bank_cases" c WHERE c."inscriptionId" = i."id" AND c."deletedAt" IS NULL)`
	requete := `SELECT COUNT(*)::int,
		COUNT(*) FILTER (WHERE i."soumiseLe" IS NOT NULL)::int,
		COUNT(*) FILTER (WHERE ` + complete + `)::int,
		COUNT(*) FILTER (WHERE ` + complete + ` AND ` + dossier + `)::int,
		COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "bank_cases" c INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"
			WHERE c."inscriptionId" = i."id" AND c."deletedAt" IS NULL AND s."type" = 'CASHED'))::int,
		COUNT(*) FILTER (WHERE ` + complete + ` AND NOT ` + dossier + `)::int,
		COUNT(*) FILTER (WHERE ` + complete + ` AND NOT ` + dossier + `
			AND COALESCE(i."decideeLe", i."soumiseLe") < now() - interval '48 hours')::int
		FROM "inscriptions_plateforme" i WHERE i."projet" = $1::"Projet" AND i."disparueLe" IS NULL`
	e := &p.Entonnoir
	return s.Pool.QueryRow(ctx, requete, projet, statuts).Scan(&e.Inscrits, &e.Soumis, &e.Valides, &e.Ouverts, &e.Encaisses,
		&p.CompletsNonOuverts, &p.CompletsNonOuverts48h)
}

func (s *service) banqueDureesParEtape(ctx context.Context, where string, args []any, p *PilotageBanque) error {
	requete := `WITH dossiers AS (SELECT c."id"` + depuisDossier + " WHERE " + where + `),
		ordonnees AS (
			SELECT t."toStageId", t."createdAt",
			       LEAD(t."createdAt") OVER (PARTITION BY t."caseId" ORDER BY t."createdAt", t."id") AS suivant
			FROM "bank_case_transitions" t WHERE t."caseId" IN (SELECT "id" FROM dossiers))
		SELECT s."id", s."label",
		       percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (o.suivant - o."createdAt")))::float8
		FROM ordonnees o INNER JOIN "bank_case_stages" s ON s."id" = o."toStageId"
		WHERE o.suivant IS NOT NULL
		GROUP BY s."id", s."label", s."position" ORDER BY s."position" ASC`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var d DureeEtapeBanque
		var median *float64
		if err := rows.Scan(&d.StageID, &d.Label, &median); err != nil {
			return err
		}
		d.MedianHours = banqueHeures(median)
		p.ByStageDuration = append(p.ByStageDuration, d)
	}
	return rows.Err()
}

func (s *service) banqueParTeleconseiller(ctx context.Context, where string, args []any, p *PilotageBanque) error {
	requete := `SELECT u."id", u."fullName", COUNT(*)::int,
		COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int,
		COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text` +
		depuisDossier + `
		INNER JOIN "prospects" p ON p."id" = c."prospectId"
		INNER JOIN "users" u ON u."id" = COALESCE(p."lastCallById", p."createdById")
		WHERE ` + where + `
		GROUP BY u."id", u."fullName" ORDER BY 4 DESC, 3 DESC, u."fullName" ASC LIMIT 20`
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var t TeleconseillerBanque
		var somme string
		if err := rows.Scan(&t.AgentID, &t.Label, &t.Cases, &t.Cashed, &somme); err != nil {
			return err
		}
		t.AmountXof = banqueSommeChaine(somme)
		p.ByTeleconseiller = append(p.ByTeleconseiller, t)
	}
	return rows.Err()
}
