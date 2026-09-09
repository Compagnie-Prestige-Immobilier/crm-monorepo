package main

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xuri/excelize/v2"
)

type ExportDossiersInput struct {
	Search            string `query:"search" maxLength:"120"`
	StageId           string `query:"stageId"`
	StageType         string `query:"stageType" enum:"OPEN,CASHED,REJECTED"`
	BanqueId          string `query:"banqueId"`
	Projet            string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	AgentId           string `query:"agentId"`
	RejectionReasonId string `query:"rejectionReasonId"`
	DateFrom          string `query:"dateFrom"`
	DateTo            string `query:"dateTo"`
	AmountMin         string `query:"amountMin" pattern:"^[0-9]{1,18}$"`
	AmountMax         string `query:"amountMax" pattern:"^[0-9]{1,18}$"`
}

const exportJointuresDossiers = `
FROM "bank_cases" c
INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"`

// Source unique du filtrage : la feuille Dossiers et la feuille Synthèse
// passent par les mêmes conditions, sinon les compteurs et le tableau divergent.
func exportConditionsDossiers(in *ExportDossiersInput) (*exportPredicat, error) {
	p := &exportPredicat{clauses: []string{`c."deletedAt" IS NULL`}}
	directs := []struct {
		colonne   string
		valeur    string
		operateur string
		cast      string
	}{
		{`c."currentStageId"`, in.StageId, "=", ""},
		{`c."processingBankId"`, in.BanqueId, "=", ""},
		{`c."rejectionReasonId"`, in.RejectionReasonId, "=", ""},
		{`s."type"`, in.StageType, "=", `::"BankStageType"`},
		{banqueColonneMontant, in.AmountMin, ">=", "::numeric"},
		{banqueColonneMontant, in.AmountMax, "<=", "::numeric"},
	}
	for _, d := range directs {
		if d.valeur == "" {
			continue
		}
		p.clauses = append(p.clauses, d.colonne+" "+d.operateur+" "+p.valeur(d.valeur)+d.cast)
	}
	if in.Projet != "" {
		p.clauses = append(p.clauses, `EXISTS (SELECT 1 FROM "prospect_journeys" pj WHERE pj."prospectId" = c."prospectId" AND pj."projet" = `+
			p.valeur(in.Projet)+`::"Projet")`)
	}
	// Créateur ou dernier intervenant : reprendre le dossier d'un collègue compte.
	if in.AgentId != "" {
		p.clauses = append(p.clauses, `(c."createdById" = `+p.valeur(in.AgentId)+` OR c."updatedById" = `+p.valeur(in.AgentId)+")")
	}
	exportRechercheDossiers(p, in)
	return p, exportBornes(p, `c."createdAt"`, in.DateFrom, in.DateTo)
}

func exportRechercheDossiers(p *exportPredicat, in *ExportDossiersInput) {
	recherche := strings.TrimSpace(in.Search)
	if recherche == "" {
		return
	}
	clause := `(c."referenceKey" LIKE ` + p.valeur("%"+strings.ToUpper(strings.Join(strings.Fields(recherche), " "))+"%") +
		` OR unaccent(lower(c."customerName")) LIKE unaccent(lower(` + p.valeur("%"+recherche+"%") + `))`
	// Quatre chiffres au moins : « DOS-3 » ne laisse que « 3 », et un seuil plus
	// bas joindrait tous les téléphones contenant ce chiffre.
	motif := ""
	if e164, err := normaliserTelephone(recherche, "SN"); err == nil {
		motif = e164
	} else if compact := exportChiffres(recherche); len(compact) >= 4 {
		motif = compact
	}
	if motif != "" {
		clause += ` OR c."customerPhoneE164" LIKE ` + p.valeur("%"+motif+"%")
	}
	p.clauses = append(p.clauses, clause+")")
}

type exportLigneDossier struct {
	ID        string
	Reference string
	Client    string
	Phone     string
	Banque    string
	Etape     string
	Montant   *string
	Motif     string
	Detail    string
	CreePar   string
	MajPar    string
	CreeLe    time.Time
	MajLe     time.Time
}

type exportLigneTransition struct {
	CaseID        string
	EtapeSource   string
	EtapeCible    string
	Agent         string
	Commentaire   string
	Montant       *string
	Motif         string
	Justification string
	Date          time.Time
}

// XOF n'a pas de décimale : au-delà de 2^53 le montant part en texte plutôt
// qu'en nombre faux au fond d'un total.
func exportMontant(v *string) any {
	if v == nil {
		return ""
	}
	entier, err := strconv.ParseInt(*v, 10, 64)
	if err != nil || entier > 1<<53 {
		return *v
	}
	return entier
}

func (s *service) exportDossiers(ctx context.Context, in *ExportDossiersInput) (*huma.StreamResponse, error) {
	p, err := exportConditionsDossiers(in)
	if err != nil {
		return nil, err
	}
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	if err := s.exportClasseurDossiers(ctx, c, p); err != nil {
		_ = c.f.Close()
		return nil, err
	}
	return exportReponseClasseur(c, "cpi-dossiers-bancaires-"+s.exportDateDuJour()+".xlsx"), nil
}

func (s *service) exportClasseurDossiers(ctx context.Context, c *exportClasseur, p *exportPredicat) error {
	dossiers, err := c.nouvelleFeuille("Dossiers",
		[]string{
			"Référence", "Client", exportEnteteTelephone, "Banque de traitement", "Étape", "Montant",
			"Motif de rejet", "Détail du rejet", "Créé par", "Dernier agent", exportEnteteCreeLe, "Mis à jour le",
		},
		[]float64{22, 28, 18, 24, 22, 18, 26, 34, 24, 24, 20, 20}, nil)
	if err != nil {
		return err
	}
	historique, err := c.nouvelleFeuille("Historique",
		[]string{
			"Référence", "Client", "Étape source", "Étape cible", "Agent", exportEnteteCommentaire,
			"Montant", "Motif de rejet", "Justification de correction", exportEnteteDate,
		},
		[]float64{22, 28, 22, 22, 24, 34, 18, 26, 34, 20}, nil)
	if err != nil {
		return err
	}
	exportes, err := s.exportEcrireDossiers(ctx, c, dossiers, historique, p)
	if err != nil {
		return err
	}
	if err := dossiers.fermer(true); err != nil {
		return err
	}
	if err := historique.fermer(true); err != nil {
		return err
	}
	return s.exportSyntheseDossiers(ctx, c, p, exportes)
}

func (s *service) exportEcrireDossiers(ctx context.Context, c *exportClasseur, dossiers, historique *exportFeuille, p *exportPredicat) (int, error) {
	apres, exportes := "", 0
	for {
		page, err := s.exportPageDossiers(ctx, p, apres)
		if err != nil {
			return 0, err
		}
		if len(page) == 0 {
			return exportes, nil
		}
		identifiants := make([]string, 0, len(page))
		fiches := map[string][2]string{}
		for i := range page {
			d := &page[i]
			identifiants = append(identifiants, d.ID)
			fiches[d.ID] = [2]string{d.Reference, d.Client}
			if err := dossiers.ecrire(d.Reference, d.Client, d.Phone, d.Banque, d.Etape,
				excelize.Cell{StyleID: c.monnaie, Value: exportMontant(d.Montant)}, d.Motif, d.Detail,
				d.CreePar, d.MajPar, excelize.Cell{StyleID: c.date, Value: d.CreeLe},
				excelize.Cell{StyleID: c.date, Value: d.MajLe}); err != nil {
				return 0, err
			}
			exportes++
		}
		if err := s.exportEcrireHistorique(ctx, c, historique, identifiants, fiches); err != nil {
			return 0, err
		}
		if len(page) < exportTaillePage {
			return exportes, nil
		}
		apres = page[len(page)-1].ID
	}
}

func (s *service) exportPageDossiers(ctx context.Context, p *exportPredicat, apres string) ([]exportLigneDossier, error) {
	args := append([]any{}, p.args...)
	clause := p.where()
	if apres != "" {
		args = append(args, apres)
		clause += ` AND c."id" > $` + strconv.Itoa(len(args))
	}
	requete := `SELECT c."id", c."reference", c."customerName", c."customerPhoneE164", b."name", s."label",
  c."amountXof"::text, COALESCE(rr."label", '')::text, COALESCE(c."rejectionDetail", '')::text,
  cb."fullName", COALESCE(ub."fullName", '')::text, c."createdAt", c."updatedAt"` +
		exportJointuresDossiers + `
INNER JOIN "banques" b ON b."id" = c."processingBankId"
INNER JOIN "users" cb ON cb."id" = c."createdById"
LEFT JOIN "users" ub ON ub."id" = c."updatedById"
LEFT JOIN "bank_rejection_reasons" rr ON rr."id" = c."rejectionReasonId"
WHERE ` + clause + ` ORDER BY c."id" ASC LIMIT ` + strconv.Itoa(exportTaillePage)
	rows, err := s.pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowToStructByPos[exportLigneDossier])
}

// Lecture globale délibérée : les identifiants viennent de la page déjà
// filtrée, et une transition n'existe que rattachée à son dossier.
func (s *service) exportEcrireHistorique(ctx context.Context, c *exportClasseur, historique *exportFeuille, identifiants []string, fiches map[string][2]string) error {
	rows, err := s.pool.Query(ctx, `SELECT t."caseId", COALESCE(fs."label", 'Ouverture')::text, ts."label",
  u."fullName", COALESCE(t."comment", '')::text, t."amountXof"::text,
  COALESCE(rr."label", '')::text, COALESCE(t."correctionReason", '')::text, t."createdAt"
FROM "bank_case_transitions" t
INNER JOIN "bank_case_stages" ts ON ts."id" = t."toStageId"
LEFT JOIN "bank_case_stages" fs ON fs."id" = t."fromStageId"
INNER JOIN "users" u ON u."id" = t."performedById"
LEFT JOIN "bank_rejection_reasons" rr ON rr."id" = t."rejectionReasonId"
WHERE t."caseId" = ANY($1)
ORDER BY t."caseId" ASC, t."createdAt" ASC, t."id" ASC`, identifiants)
	if err != nil {
		return err
	}
	transitions, err := pgx.CollectRows(rows, pgx.RowToStructByPos[exportLigneTransition])
	rows.Close()
	if err != nil {
		return err
	}
	for i := range transitions {
		t := &transitions[i]
		parent := fiches[t.CaseID]
		if err := historique.ecrire(parent[0], parent[1], t.EtapeSource, t.EtapeCible, t.Agent,
			t.Commentaire, excelize.Cell{StyleID: c.monnaie, Value: exportMontant(t.Montant)}, t.Motif,
			t.Justification, excelize.Cell{StyleID: c.date, Value: t.Date}); err != nil {
			return err
		}
	}
	return nil
}

// Date d'entrée en étape terminale, lue dans l'historique : `updatedAt`
// bougerait à toute correction ultérieure.
const exportDateCloture = `
LEFT JOIN LATERAL (
  SELECT MAX(bt."createdAt") AS "closedAt"
  FROM "bank_case_transitions" bt
  INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
  WHERE bt."caseId" = c."id" AND bs."type" <> 'OPEN'
) cl ON TRUE`

type exportTotauxDossiers struct {
	Total         int
	ATraiter      int
	EnTraitement  int
	Encaisses     int
	Rejetes       int
	Montant       string
	DelaiSecondes *float64
}

func (s *service) exportTotauxDossiers(ctx context.Context, p *exportPredicat) (exportTotauxDossiers, error) {
	var t exportTotauxDossiers
	requete := `SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE s."isInitial")::int,
  COUNT(*) FILTER (WHERE s."type" = 'OPEN' AND NOT s."isInitial")::int,
  COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int,
  COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int,
  COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text,
  (AVG(EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
     FILTER (WHERE s."type" <> 'OPEN' AND cl."closedAt" IS NOT NULL))::float8` +
		exportJointuresDossiers + exportDateCloture + " WHERE " + p.where()
	err := s.pool.QueryRow(ctx, requete, p.args...).Scan(&t.Total, &t.ATraiter, &t.EnTraitement,
		&t.Encaisses, &t.Rejetes, &t.Montant, &t.DelaiSecondes)
	return t, err
}

type exportLigneSyntheseDossiers struct {
	libelle string
	cases   int
	montant string
	part    float64
}

func (s *service) exportAgregatDossiers(ctx context.Context, p *exportPredicat, requete string) ([]exportLigneSyntheseDossiers, error) {
	rows, err := s.pool.Query(ctx, requete, p.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var lignes []exportLigneSyntheseDossiers
	total := 0
	for rows.Next() {
		var ligne exportLigneSyntheseDossiers
		if err := rows.Scan(&ligne.libelle, &ligne.cases, &ligne.montant); err != nil {
			return nil, err
		}
		total += ligne.cases
		lignes = append(lignes, ligne)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range lignes {
		lignes[i].part = exportPart(lignes[i].cases, total)
	}
	return lignes, nil
}

func (s *service) exportSyntheseDossiers(ctx context.Context, c *exportClasseur, p *exportPredicat, exportes int) error {
	totaux, err := s.exportTotauxDossiers(ctx, p)
	if err != nil {
		return err
	}
	parEtape, err := s.exportAgregatDossiers(ctx, p, `SELECT s."label", COUNT(*)::int, '0'`+exportJointuresDossiers+
		" WHERE "+p.where()+` GROUP BY s."id", s."label", s."position" ORDER BY s."position" ASC`)
	if err != nil {
		return err
	}
	parBanque, err := s.exportAgregatDossiers(ctx, p, `SELECT b."shortName", COUNT(*)::int,
  COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text`+exportJointuresDossiers+
		` INNER JOIN "banques" b ON b."id" = c."processingBankId" WHERE `+p.where()+
		` GROUP BY b."id", b."shortName" ORDER BY 2 DESC, 1 ASC`)
	if err != nil {
		return err
	}
	parMotif, err := s.exportAgregatDossiers(ctx, p, `SELECT r."label", COUNT(*)::int, '0'`+exportJointuresDossiers+
		` INNER JOIN "bank_rejection_reasons" r ON r."id" = c."rejectionReasonId" WHERE `+p.where()+
		` AND s."type" = 'REJECTED' GROUP BY r."id", r."label", r."sortOrder" ORDER BY 2 DESC, r."sortOrder" ASC`)
	if err != nil {
		return err
	}
	return exportEcrireSyntheseDossiers(c, totaux, exportes, parEtape, parBanque, parMotif)
}

func exportEcrireSyntheseDossiers(c *exportClasseur, t exportTotauxDossiers, exportes int, parEtape, parBanque, parMotif []exportLigneSyntheseDossiers) error {
	f, err := c.nouvelleFeuille("Synthèse", []string{"Indicateur", "Valeur", "Part (%)"}, []float64{36, 20, 12}, nil)
	if err != nil {
		return err
	}
	if err := f.ecrire(excelize.Cell{StyleID: c.section, Value: "Vue d’ensemble"}); err != nil {
		return err
	}
	delai := any("n/d")
	if t.DelaiSecondes != nil {
		delai = float64(int(*t.DelaiSecondes/360+0.5)) / 10
	}
	vue := []struct {
		libelle string
		valeur  any
	}{
		{"Dossiers exportés", exportes},
		{"Dossiers (total filtré)", t.Total},
		{"À traiter", t.ATraiter},
		{"En traitement", t.EnTraitement},
		{"Encaissés", t.Encaisses},
		{"Rejetés", t.Rejetes},
		{"Montant encaissé", excelize.Cell{StyleID: c.monnaie, Value: exportMontant(&t.Montant)}},
		{"Taux de rejet (%)", exportPart(t.Rejetes, t.Encaisses+t.Rejetes)},
		{"Délai moyen de traitement (h)", delai},
	}
	for _, ligne := range vue {
		if err := f.ecrire(ligne.libelle, ligne.valeur); err != nil {
			return err
		}
	}
	groupes := []struct {
		titre   string
		lignes  []exportLigneSyntheseDossiers
		argent  bool
		absence string
	}{
		{"Par étape", parEtape, false, ""},
		{"Par banque de traitement", parBanque, false, ""},
		{"Montant encaissé par banque", parBanque, true, ""},
		{"Par motif de rejet", parMotif, false, "Aucun rejet"},
	}
	for _, groupe := range groupes {
		if err := exportEcrireGroupeDossiers(c, f, groupe.titre, groupe.lignes, groupe.argent, groupe.absence); err != nil {
			return err
		}
	}
	return f.fermer(false)
}

func exportEcrireGroupeDossiers(c *exportClasseur, f *exportFeuille, titre string, lignes []exportLigneSyntheseDossiers, argent bool, absence string) error {
	if err := f.ecrire(""); err != nil {
		return err
	}
	if err := f.ecrire(excelize.Cell{StyleID: c.section, Value: titre}); err != nil {
		return err
	}
	if len(lignes) == 0 && absence != "" {
		return f.ecrire(absence, 0)
	}
	for i := range lignes {
		ligne := &lignes[i]
		if argent {
			somme := ligne.montant
			if err := f.ecrire(ligne.libelle, excelize.Cell{StyleID: c.monnaie, Value: exportMontant(&somme)}); err != nil {
				return err
			}
			continue
		}
		if err := f.ecrire(ligne.libelle, ligne.cases, ligne.part); err != nil {
			return err
		}
	}
	return nil
}

// Le classeur global : douze feuilles cohérentes entre elles, donc une seule
// transaction RepeatableRead. Un « 40001 » rejoue la lecture entière.
func (s *service) exportGlobal(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
	for essai := range 3 {
		c, err := exportNouveauClasseur()
		if err != nil {
			return nil, err
		}
		err = s.exportLireGlobal(ctx, c)
		if err == nil {
			return exportReponseClasseur(c, "cpi-global-"+s.exportDateDuJour()+".xlsx"), nil
		}
		_ = c.f.Close()
		var pg *pgconn.PgError
		if !errors.As(err, &pg) || pg.Code != "40001" || essai == 2 {
			return nil, err
		}
	}
	return nil, problem(http.StatusServiceUnavailable, "UNAVAILABLE", "Service momentanément indisponible.")
}

func (s *service) exportLireGlobal(ctx context.Context, c *exportClasseur) error {
	lecture, annuler := context.WithTimeout(ctx, 120*time.Second)
	defer annuler()
	tx, err := s.pool.BeginTx(lecture, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(lecture) }()
	if err := c.f.SetSheetName("Sheet1", "Tableau de bord"); err != nil {
		return err
	}
	c.feuille = 1
	g := &exportClasseurGlobal{c: c, q: s.q.WithTx(tx), s: s, tx: tx, groupes: map[string]map[string]int{}, totaux: map[string]int{}}
	for _, etape := range []func(context.Context) error{
		g.representants, g.prospects, g.parcours, g.appels, g.campagnes, g.historique,
	} {
		if err := etape(lecture); err != nil {
			return err
		}
	}
	if err := tx.Commit(lecture); err != nil {
		return err
	}
	return g.tableauDeBord()
}

type exportClasseurGlobal struct {
	c       *exportClasseur
	q       *db.Queries
	s       *service
	tx      pgx.Tx
	groupes map[string]map[string]int
	totaux  map[string]int
}

func (g *exportClasseurGlobal) compter(groupe, libelle string) {
	if libelle == "" {
		libelle = "Non renseigné"
	}
	if g.groupes[groupe] == nil {
		g.groupes[groupe] = map[string]int{}
	}
	g.groupes[groupe][libelle]++
}

// Largeurs de `finish()` : l'identifiant tient en entier, le commentaire est lisible.
func exportLargeursGlobal(entetes []string) []float64 {
	largeurs := make([]float64, len(entetes))
	for i, entete := range entetes {
		largeur := min(max(22, float64(len([]rune(entete))+4)), 45)
		if strings.Contains(entete, exportEnteteIdentifiant) || strings.Contains(entete, "Référence") {
			largeur = 39
		}
		if strings.Contains(entete, exportEnteteCommentaire) || strings.Contains(entete, exportEnteteNotes) {
			largeur = 55
		}
		largeurs[i] = largeur
	}
	return largeurs
}

func (g *exportClasseurGlobal) feuille(nom string, entetes []string) (*exportFeuille, error) {
	return g.c.nouvelleFeuille(nom, entetes, exportLargeursGlobal(entetes), nil)
}

func (g *exportClasseurGlobal) representants(ctx context.Context) error {
	reps, err := g.feuille(exportNomFeuilleRepresentants, []string{
		exportEnteteIdentifiant, exportEnteteNomComplet, exportEntetePrenom, exportEnteteTelephone, exportEnteteEtablissement, "Région", exportEnteteDepartement,
		exportEnteteIef, exportEnteteTeleconseiller, exportEnteteIdentifiantAgent, exportEnteteQualification, "Statut WhatsApp",
		exportEnteteWhatsapp, exportEnteteProfession, exportEnteteSyndicat, "Connaît UES", "Déjà contacté", exportEnteteNotes,
		"Dernier résultat", exportEnteteDernierAppel, "Dernier appel par", "Relance", "Origine relance",
		exportEnteteSaisiLe, exportEnteteCreeLe, exportEnteteModifieLe, exportEnteteProspects,
	})
	if err != nil {
		return err
	}
	rappels, err := g.feuille("Relances", []string{
		exportEnteteIdentifiant, exportEnteteType, exportEnteteIdentifiantFiche, exportEnteteNom, exportEnteteTelephone, exportEnteteTeleconseiller,
		exportEnteteIdentifiantAgent, "Échéance", "État", exportEnteteCommentaire, "Appel source",
		"Appel de clôture", exportEnteteCreeLe, exportEnteteModifieLe,
	})
	if err != nil {
		return err
	}
	if err := g.lignesRepresentants(ctx, reps, rappels); err != nil {
		return err
	}
	if err := g.lignesRappels(ctx, rappels); err != nil {
		return err
	}
	g.totaux[exportNomFeuilleRepresentants] = reps.ligne - 1
	if err := reps.fermer(true); err != nil {
		return err
	}
	return rappels.fermer(true)
}

func (g *exportClasseurGlobal) lignesRepresentants(ctx context.Context, reps, rappels *exportFeuille) error {
	var apres *string
	for {
		page, err := g.q.ExportGlobalRepresentants(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			if err := g.ligneRepresentant(reps, rappels, &page[i]); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) ligneRepresentant(reps, rappels *exportFeuille, r *db.ExportGlobalRepresentantsRow) error {
	c := g.c
	if err := reps.ecrire(r.ID, r.FullName, exportCelluleTexte(r.Prenom), r.PhoneE164,
		exportCelluleTexte(r.Etablissement), r.Region, r.Departement, exportCelluleTexte(r.Ief),
		r.Teleconseiller, r.CreatedById, exportCelluleTexte(r.Qualification),
		exportLibelle(exportLibellesWhatsapp, r.WhatsappStatut), r.Whatsapp,
		exportCelluleTexte(r.Profession), exportCelluleTexte(r.Syndicat), exportCelluleOuiNon(r.ConnaitUES),
		exportCelluleOuiNon(r.Contacte), exportCelluleTexte(r.Notes),
		exportLibelle(exportLibellesIssueRepresentant, r.DerniereIssue), c.horodate(r.LastCallAt),
		exportCelluleTexte(r.DernierAppelPar), c.horodate(r.NextCallbackAt), r.RelanceOrigine,
		excelize.Cell{StyleID: c.date, Value: r.ClientCreatedAt},
		excelize.Cell{StyleID: c.date, Value: r.CreatedAt},
		excelize.Cell{StyleID: c.date, Value: r.UpdatedAt}, r.Prospects); err != nil {
		return err
	}
	if r.NextCallbackAt == nil {
		return nil
	}
	g.compter("Relances par état", "En attente")
	return rappels.ecrire(r.ID, exportEnteteRepresentant, r.ID, r.FullName, r.PhoneE164,
		exportCelluleTexte(r.DernierAppelPar), exportCelluleTexte(r.LastCallById), c.horodate(r.NextCallbackAt),
		"En attente", "", "", "", "", excelize.Cell{StyleID: c.date, Value: r.UpdatedAt})
}

func (g *exportClasseurGlobal) lignesRappels(ctx context.Context, rappels *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalRappels(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			r := &page[i]
			etat := exportLibelle(exportLibellesRappel, r.Statut)
			g.compter("Relances par état", etat)
			if err := rappels.ecrire(r.ID, "Prospect", r.ProspectId, strings.TrimSpace(r.Prenom+" "+r.Nom),
				r.PhoneE164, r.Assigne, r.AssignedToId, excelize.Cell{StyleID: c.date, Value: r.ScheduledAt},
				etat, exportCelluleTexte(r.Comment), r.SourceAttemptId, exportCelluleTexte(r.ClosedAttemptId),
				excelize.Cell{StyleID: c.date, Value: r.CreatedAt},
				excelize.Cell{StyleID: c.date, Value: r.UpdatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) prospects(ctx context.Context) error {
	libres := g.s.exportChampsLibres(ctx, []string{exportCleChues, exportCleGrandPublic})
	entetes := make([]string, 0, len(exportEntetesProspects)+len(libres)+16)
	entetes = append(entetes, exportEnteteIdentifiant, "Identifiant représentant")
	for _, entete := range exportEntetesProspects {
		if entete == exportEnteteCommercial {
			entete = exportEnteteTeleconseiller
		}
		entetes = append(entetes, entete)
	}
	entetes = append(entetes, exportEntetesChampsLibres(libres)...)
	entetes = append(entetes, exportEnteteIdentifiantAgent, "Projet d’origine", "Établissement",
		"E-mail", "Revenu mensuel", "Paiement", "Statut WhatsApp", "Origine", "Détail origine",
		"À revoir depuis", "Revu le", "Revu par", exportEnteteCreeLe, exportEnteteModifieLe)
	f, err := g.feuille(exportEnteteProspects, entetes)
	if err != nil {
		return err
	}
	p := &exportPredicat{clauses: []string{`p."deletedAt" IS NULL`}}
	apres := ""
	for {
		page, err := exportPageProspects(ctx, g.tx, p, apres)
		if err != nil {
			return err
		}
		for i := range page {
			if err := g.ligneProspect(f, &page[i], libres); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			g.totaux[exportEnteteProspects] = f.ligne - 1
			return f.fermer(true)
		}
		apres = page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) ligneProspect(f *exportFeuille, l *exportLigneProspect, libres []exportChampLibre) error {
	c := g.c
	g.compter("Prospects par téléconseiller", l.Commercial)
	g.compter("Prospects par segment", exportSegmentDuProspect(l))
	valeurs := append([]any{l.ID, l.RepresentantID}, exportValeursProspect(c, l, libres)...)
	valeurs = append(valeurs, l.CreePar, exportLibelle(exportLibellesProjet, l.ProjetOrigine),
		l.Etablissement, l.Email, l.Revenu, exportLibelle(exportLibellesPaiement, l.Paiement),
		exportLibelle(exportLibellesWhatsapp, l.WhatsappStatut), l.Origine, l.OrigineDetail,
		c.horodate(l.ARevoirDepuis), c.horodate(l.RevuLe), l.RevuPar,
		excelize.Cell{StyleID: c.date, Value: l.CreeLe}, excelize.Cell{StyleID: c.date, Value: l.ModifieLe})
	return f.ecrire(valeurs...)
}

func (g *exportClasseurGlobal) parcours(ctx context.Context) error {
	f, err := g.feuille("Parcours", []string{
		exportEnteteIdentifiant, "Identifiant prospect", exportEnteteNom, exportEnteteTelephone, exportEnteteProjet, "Statut", "Consentement",
		"Consentement le", "Consentement par", "Phase de conversion", "Méthode", "Méthode obtenue le",
		"Méthode obtenue par", "Converti le", "Converti par", "Fermé le", "Motif fermeture",
		"Fermé par", exportEnteteCreeLe, exportEnteteModifieLe,
	})
	if err != nil {
		return err
	}
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalParcours(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			j := &page[i]
			statut := exportLibelle(exportLibellesStatut, j.Statut)
			g.compter("Parcours par statut", statut)
			if err := f.ecrire(j.ID, j.ProspectId, strings.TrimSpace(j.Prenom+" "+j.Nom), j.PhoneE164,
				exportLibelle(exportLibellesProjet, j.Projet), statut,
				exportLibelle(exportLibellesConsentement, j.Consentement), c.horodate(j.ConsentAt),
				exportCelluleTexte(j.ConsentementPar), exportLibelle(exportLibellesPhase2, j.Phase2),
				exportLibelle(exportLibellesMethode, j.Methode), c.horodate(j.EnrollmentCapturedAt),
				exportCelluleTexte(j.MethodePar), c.horodate(j.ConvertedAt), exportCelluleTexte(j.ConvertiPar),
				c.horodate(j.ClosedAt), exportCelluleTexte(j.ClosedReason), exportCelluleTexte(j.FermePar),
				excelize.Cell{StyleID: c.date, Value: j.CreatedAt},
				excelize.Cell{StyleID: c.date, Value: j.UpdatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			break
		}
		apres = &page[len(page)-1].ID
	}
	if err := f.fermer(true); err != nil {
		return err
	}
	return g.conversions(ctx)
}

func (g *exportClasseurGlobal) conversions(ctx context.Context) error {
	f, err := g.feuille("Conversions", []string{
		exportEnteteIdentifiant, "Identifiant parcours", "Identifiant prospect", exportEnteteNom, exportEnteteProjet, "Offre",
		"Paiement", "Montant XOF", "Durée en mois", "Confirmé par", exportEnteteIdentifiantAgent,
		"Confirmé le",
	})
	if err != nil {
		return err
	}
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalConversions(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			v := &page[i]
			if err := f.ecrire(v.ID, v.JourneyId, v.ProspectId, strings.TrimSpace(v.Prenom+" "+v.Nom),
				exportLibelle(exportLibellesProjet, v.Projet), exportCelluleTexte(v.Offre),
				exportLibelle(exportLibellesPaiement, v.Paiement), exportCelluleNombre(v.AmountXof),
				exportCelluleNombre(v.DurationMonths), v.ConfirmePar, v.ConfirmedById,
				excelize.Cell{StyleID: c.date, Value: v.ConfirmedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			break
		}
		apres = &page[len(page)-1].ID
	}
	g.totaux["Conversions"] = f.ligne - 1
	return f.fermer(true)
}

var exportEntetesAppels = []string{
	exportEnteteIdentifiant, exportEnteteType, exportEnteteIdentifiantFiche, exportEnteteNom, exportEnteteTelephone, exportEnteteTeleconseiller,
	exportEnteteIdentifiantAgent, exportEnteteDate, "Résultat", "Motif", exportEnteteCommentaire, "Méthode",
	"Rendez-vous", "E-mail", exportLibelleFonctionnaire, "Engagement bancaire",
	"Ancienneté établissement en mois", "Prospects promis", "Rappel promis",
	"Établissement confirmé", "Numéro confirmé", "Déjà contacté", "Connaît UES", exportEnteteSyndicat,
	"Qualification", "Type appel appareil", "Durée en secondes", "Date appel appareil", exportEnteteCreeLe,
}

func (g *exportClasseurGlobal) appels(ctx context.Context) error {
	f, err := g.feuille("Appels", exportEntetesAppels)
	if err != nil {
		return err
	}
	if err := g.appelsProspects(ctx, f); err != nil {
		return err
	}
	if err := g.appelsRepresentants(ctx, f); err != nil {
		return err
	}
	g.totaux["Appels"] = f.ligne - 1
	return f.fermer(true)
}

func (g *exportClasseurGlobal) appelsProspects(ctx context.Context, f *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalAppelsProspects(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			a := &page[i]
			g.compter("Appels par mois", a.ClientCreatedAt.Format("2006-01"))
			if err := f.ecrire(a.ID, "Prospect", a.ProspectId, strings.TrimSpace(a.Prenom+" "+a.Nom),
				a.PhoneE164, a.Teleconseiller, a.PerformedById,
				excelize.Cell{StyleID: c.date, Value: a.ClientCreatedAt},
				exportLibelle(exportLibellesIssue, a.Issue), exportCelluleTexte(a.Motif), exportCelluleTexte(a.Comment),
				exportLibelle(exportLibellesMethode, a.Methode), c.horodate(a.RendezVousAt),
				exportCelluleTexte(a.Email), exportCelluleOuiNon(a.Fonctionnaire), exportCelluleOuiNon(a.EngagementEnCours),
				exportCelluleNombre(a.DureeEtablissementMois), "", "", "", "", "", "", "", "",
				exportCelluleTexte(a.DeviceCallType), exportCelluleNombre(a.DeviceCallDurationSeconds),
				c.horodate(a.DeviceCallAt), excelize.Cell{StyleID: c.date, Value: a.CreatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) appelsRepresentants(ctx context.Context, f *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalAppelsRepresentants(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			a := &page[i]
			g.compter("Appels par mois", a.ClientCreatedAt.Format("2006-01"))
			if err := f.ecrire(a.ID, exportEnteteRepresentant, a.RepresentantId, a.FullName, a.PhoneE164,
				a.Teleconseiller, a.PerformedById, excelize.Cell{StyleID: c.date, Value: a.ClientCreatedAt},
				exportLibelle(exportLibellesIssueRepresentant, a.Issue), "", exportCelluleTexte(a.Comment), "", "", "", "", "", "",
				exportCelluleNombre(a.PromisedProspects), c.horodate(a.CallbackAt),
				exportCelluleOuiNon(a.EtablissementConfirme), exportCelluleOuiNon(a.NumeroConfirme),
				exportCelluleOuiNon(a.Contacte), exportCelluleOuiNon(a.ConnaitUES), exportCelluleTexte(a.Syndicat),
				exportCelluleTexte(a.Qualification), exportCelluleTexte(a.DeviceCallType),
				exportCelluleNombre(a.DeviceCallDurationSeconds), c.horodate(a.DeviceCallAt),
				excelize.Cell{StyleID: c.date, Value: a.CreatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

type exportRepartition struct {
	FichesParJour   int            `json:"fichesParJour"`
	Jours           int            `json:"jours"`
	Objectifs       map[string]int `json:"objectifs"`
	Teleconseillers []string       `json:"teleconseillerIds"`
}

func (g *exportClasseurGlobal) campagnes(ctx context.Context) error {
	campagnes, err := g.feuille("Campagnes", []string{
		exportEnteteIdentifiant, exportEnteteNom, exportEnteteType, exportEnteteProjet, "Fiches à la création", "Jours prévus",
		"Fiches par jour", "Créé par", exportEnteteIdentifiantAgent, exportEnteteCreeLe,
	})
	if err != nil {
		return err
	}
	affectations, err := g.feuille("Affectations", []string{
		"Identifiant campagne", "Campagne", "Position", "Jour", exportEnteteType, exportEnteteIdentifiantFiche, exportEnteteNom,
		exportEnteteTelephone, exportEnteteTeleconseiller, exportEnteteIdentifiantAgent, "Objectif quotidien",
		"Dernier résultat", exportEnteteDernierAppel,
	})
	if err != nil {
		return err
	}
	var apres *string
	for {
		page, err := g.q.ExportGlobalCampagnes(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			if err := g.ligneCampagne(ctx, campagnes, affectations, &page[i]); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			break
		}
		apres = &page[len(page)-1].ID
	}
	g.totaux["Campagnes"] = campagnes.ligne - 1
	if err := campagnes.fermer(true); err != nil {
		return err
	}
	return affectations.fermer(true)
}

func (g *exportClasseurGlobal) ligneCampagne(ctx context.Context, campagnes, affectations *exportFeuille, l *db.ExportGlobalCampagnesRow) error {
	repartition := exportLireRepartition(l.Filters)
	typeLot := "Campagne d’appels représentants"
	if l.Cible == "PROSPECTS" {
		typeLot = "Campagne d’appels prospects"
	}
	jours, fiches := any(""), any("")
	if repartition != nil {
		jours, fiches = repartition.Jours, repartition.FichesParJour
	}
	if err := campagnes.ecrire(l.ID, l.Name, typeLot, exportLibelle(exportLibellesProjet, l.Projet),
		l.ItemCount, jours, fiches, l.CreePar, l.CreatedById,
		excelize.Cell{StyleID: g.c.date, Value: l.CreatedAt}); err != nil {
		return err
	}
	return g.affectations(ctx, affectations, l, repartition)
}

func exportLireRepartition(brut []byte) *exportRepartition {
	var filtres struct {
		Distribution *exportRepartition `json:"distribution"`
	}
	if err := json.Unmarshal(brut, &filtres); err != nil || filtres.Distribution == nil {
		return nil
	}
	r := filtres.Distribution
	if len(r.Teleconseillers) == 0 || r.FichesParJour < 1 || r.Jours < 1 {
		return nil
	}
	return r
}

func (g *exportClasseurGlobal) affectations(ctx context.Context, f *exportFeuille, lot *db.ExportGlobalCampagnesRow, repartition *exportRepartition) error {
	position := int32(-1)
	for {
		page, err := g.q.ExportGlobalAffectations(ctx, db.ExportGlobalAffectationsParams{LotId: lot.ID, Position: position})
		if err != nil {
			return err
		}
		for i := range page {
			if err := f.ecrire(g.valeursAffectation(lot, &page[i], repartition)...); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		position = page[len(page)-1].Position
	}
}

func (g *exportClasseurGlobal) valeursAffectation(lot *db.ExportGlobalCampagnesRow, item *db.ExportGlobalAffectationsRow, repartition *exportRepartition) []any {
	nature, fiche := exportEnteteRepresentant, exportChaineOuVide(item.RepresentantId)
	nom, phone := exportChaineOuVide(item.FullName), exportChaineOuVide(item.RepresentantPhone)
	issue, appel := exportLibelle(exportLibellesIssueRepresentant, item.RepresentantIssue), item.RepresentantAppel
	if item.ProspectId != nil {
		nature, fiche = "Prospect", exportChaineOuVide(item.ProspectId)
		nom = strings.TrimSpace(exportChaineOuVide(item.Prenom) + " " + exportChaineOuVide(item.Nom))
		phone = exportChaineOuVide(item.ProspectPhone)
		issue, appel = exportLibelle(exportLibellesIssue, item.ProspectIssue), item.ProspectAppel
	}
	objectif := any("")
	if repartition != nil && item.AssigneeId != nil {
		if valeur, ok := repartition.Objectifs[*item.AssigneeId]; ok {
			objectif = valeur
		} else {
			objectif = exportCapaciteParJour(item.Role, repartition.FichesParJour)
		}
	}
	return []any{
		lot.ID, lot.Name, item.Position, item.Day, nature, fiche, nom, phone,
		exportCelluleTexte(item.Assigne), exportCelluleTexte(item.AssigneeId), objectif, issue, g.c.horodate(appel),
	}
}

func exportCapaciteParJour(role string, fichesParJour int) int {
	if role == "COMMERCIAL" {
		return fichesParJour
	}
	return max(1, (fichesParJour+4)/5)
}

func (g *exportClasseurGlobal) historique(ctx context.Context) error {
	if err := g.commentaires(ctx); err != nil {
		return err
	}
	f, err := g.feuille("Historique", []string{
		exportEnteteIdentifiant, exportEnteteType, "Identifiant fiche ou campagne", exportEnteteNom, "Avant", "Après", "Motif",
		"Auteur", "Identifiant auteur", exportEnteteDate, "Source", "Fiches", "Positions", "Banque avant",
		"Banque après", "Syndicat avant", "Syndicat après",
	})
	if err != nil {
		return err
	}
	for _, etape := range []func(context.Context, *exportFeuille) error{
		g.changementsSegment, g.changementsQualification, g.reaffectations,
	} {
		if err := etape(ctx, f); err != nil {
			return err
		}
	}
	if err := f.fermer(true); err != nil {
		return err
	}
	return g.suggestions(ctx)
}

func (g *exportClasseurGlobal) commentaires(ctx context.Context) error {
	f, err := g.feuille("Commentaires", []string{
		exportEnteteIdentifiant, "Identifiant représentant", exportEnteteNom, exportEnteteTelephone, exportEnteteCommentaire, "Auteur",
		"Identifiant auteur", exportEnteteDate, exportEnteteCreeLe,
	})
	if err != nil {
		return err
	}
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalCommentaires(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			if err := f.ecrire(l.ID, l.RepresentantId, l.FullName, l.PhoneE164, l.Body, l.Auteur,
				l.AuthorId, excelize.Cell{StyleID: c.date, Value: l.ClientCreatedAt},
				excelize.Cell{StyleID: c.date, Value: l.CreatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return f.fermer(true)
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) changementsSegment(ctx context.Context, f *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalChangementsSegment(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			if err := f.ecrire(l.ID, "Segment", l.ProspectId, strings.TrimSpace(l.Prenom+" "+l.Nom),
				l.Avant, l.Apres, exportCelluleTexte(l.Reason), l.Auteur, l.ChangedById,
				excelize.Cell{StyleID: c.date, Value: l.ChangedAt}, l.Source, "", "",
				l.BanqueAvant, l.BanqueApres, l.SyndicatAvant, l.SyndicatApres); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) changementsQualification(ctx context.Context, f *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalChangementsQualification(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			if err := f.ecrire(l.ID, "Qualification", l.RepresentantId, l.FullName,
				exportLibelle(exportLibellesRelation, l.Avant), exportLibelle(exportLibellesRelation, l.Apres),
				exportCelluleTexte(l.Reason), l.Auteur, l.ChangedById,
				excelize.Cell{StyleID: c.date, Value: l.ChangedAt}, l.Source,
				"", "", "", "", "", ""); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) reaffectations(ctx context.Context, f *exportFeuille) error {
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalReaffectations(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			positions := make([]string, 0, len(l.Positions))
			for _, p := range l.Positions {
				positions = append(positions, strconv.Itoa(int(p)))
			}
			if err := f.ecrire(l.ID, "Réaffectation", l.LotId, l.Name, exportCelluleTexte(l.De), l.Vers, "",
				l.Auteur, l.PerformedById, excelize.Cell{StyleID: c.date, Value: l.CreatedAt}, "",
				l.Fiches, strings.Join(positions, ", "), "", "", "", ""); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return nil
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) suggestions(ctx context.Context) error {
	f, err := g.feuille("Suggestions", []string{
		exportEnteteIdentifiant, "Identifiant représentant source", "Représentant source", "Nom suggéré",
		"Téléphone suggéré", "Note", "Suggéré par", exportEnteteIdentifiantAgent, "État",
		"Identifiant représentant retrouvé", "Représentant retrouvé", "Appel source", exportEnteteDate, exportEnteteCreeLe,
	})
	if err != nil {
		return err
	}
	c := g.c
	var apres *string
	for {
		page, err := g.q.ExportGlobalSuggestions(ctx, apres)
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			if err := f.ecrire(l.ID, l.SourceRepresentantId, l.Source, exportCelluleTexte(l.SuggestedName),
				l.SuggestedPhoneE164, exportCelluleTexte(l.Note), l.SuggerePar, l.SuggestedById,
				exportLibelle(exportLibellesSuggestion, l.Statut), exportCelluleTexte(l.ResolvedRepresentantId),
				exportCelluleTexte(l.Retrouve), l.SourceAttemptId,
				excelize.Cell{StyleID: c.date, Value: l.ClientCreatedAt},
				excelize.Cell{StyleID: c.date, Value: l.CreatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return f.fermer(true)
		}
		apres = &page[len(page)-1].ID
	}
}

func (g *exportClasseurGlobal) tableauDeBord() error {
	e := &exportEcrivain{f: g.c.f}
	feuille := "Tableau de bord"
	e.str(feuille, "A1", "Synthèse au")
	e.faire(g.c.f.SetCellValue(feuille, "B1", time.Now().UTC()))
	e.faire(g.c.f.SetCellStyle(feuille, "B1", "B1", g.c.date))
	for i, entete := range []string{"Groupe", "Libellé", "Nombre"} {
		e.str(feuille, exportNomColonne(i+1)+"2", entete)
	}
	ligne := 3
	for _, nom := range []string{exportNomFeuilleRepresentants, exportEnteteProspects, "Conversions", "Appels", "Campagnes"} {
		e.str(feuille, "A"+strconv.Itoa(ligne), "Totaux")
		e.str(feuille, "B"+strconv.Itoa(ligne), nom)
		e.faire(g.c.f.SetCellInt(feuille, "C"+strconv.Itoa(ligne), int64(g.totaux[nom])))
		ligne++
	}
	for _, groupe := range []string{
		"Parcours par statut", "Prospects par téléconseiller",
		"Prospects par segment", "Appels par mois", "Relances par état",
	} {
		libelles := make([]string, 0, len(g.groupes[groupe]))
		for libelle := range g.groupes[groupe] {
			libelles = append(libelles, libelle)
		}
		sort.Strings(libelles)
		for _, libelle := range libelles {
			e.str(feuille, "A"+strconv.Itoa(ligne), groupe)
			e.str(feuille, "B"+strconv.Itoa(ligne), libelle)
			e.faire(g.c.f.SetCellInt(feuille, "C"+strconv.Itoa(ligne), int64(g.groupes[groupe][libelle])))
			ligne++
		}
	}
	return e.err
}
