package exports

import (
	"context"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

type ExportProspectsInput struct {
	Mode                   string `query:"mode" enum:"filtered,consolidated"`
	Search                 string `query:"search" maxLength:"120"`
	RepresentantId         string `query:"representantId"`
	BanqueId               string `query:"banqueId"`
	SyndicatId             string `query:"syndicatId"`
	DepartementId          string `query:"departementId"`
	CommercialId           string `query:"commercialId"`
	Projet                 string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Type                   string `query:"type" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	CanalProvenanceId      string `query:"canalProvenanceId"`
	Statut                 string `query:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Segment                string `query:"segment" enum:"BDD1,BDD2,BDD3,BDD4"`
	Phase2Status           string `query:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER,UNREACHABLE,INTERESTED,HESITANT,APPOINTMENT,REACHED"`
	EnrollmentMethod       string `query:"enrollmentMethod"`
	AppelePar              string `query:"appelePar"`
	LastCallById           string `query:"lastCallById"`
	EnrollmentCapturedById string `query:"enrollmentCapturedById"`
	Origin                 string `query:"origin" enum:"BANQUE,FORMULAIRE_PUBLIC"`
	DateFrom               string `query:"dateFrom"`
	DateTo                 string `query:"dateTo"`
	Revue                  string `query:"revue" enum:"true,false"`
	IncludeDeleted         string `query:"includeDeleted" enum:"true,false"`
}

// Les dates de filtre sont des jours de Dakar, bornes incluses (date-bounds.ts).
func exportBorneDeJournee(brut string, fin bool) (time.Time, error) {
	if len(brut) == 10 {
		heure := "T00:00:00Z"
		if fin {
			heure = "T23:59:59.999Z"
		}
		return time.Parse(time.RFC3339, brut+heure)
	}
	return time.Parse(time.RFC3339, brut)
}

func exportPorteeDeLecture(p *exportPredicat, u *socle.Utilisateur) {
	if borne := socle.PorteePlateforme(u); borne != nil && *borne {
		p.clauses = append(p.clauses, `p."plateformeDepuis" IS NOT NULL`)
	} else if borne != nil {
		p.clauses = append(p.clauses, `p."plateformeDepuis" IS NULL`)
	}
	if u.Peut(socle.PermissionPortefeuilleVoirTout) || u.Peut(socle.PermissionPlateformeSaisir) {
		return
	}
	enMain := `(p."createdById" = ` + p.valeur(u.ID) +
		` OR EXISTS (SELECT 1 FROM "lot_export_items" li WHERE li."prospectId" = p."id" AND li."assigneeId" = ` + p.valeur(u.ID) + ")"
	if u.Peut(socle.PermissionFichesVoirConverties) {
		enMain += ` OR p."statut" = 'CONVERTI'`
	}
	p.clauses = append(p.clauses, enMain+")")
}

func exportFiltresDirects(p *exportPredicat, in *ExportProspectsInput) {
	directs := []struct {
		colonne string
		valeur  string
		cast    string
	}{
		{`p."representantId"`, in.RepresentantId, ""},
		{`p."banqueId"`, in.BanqueId, ""},
		{`p."syndicatId"`, in.SyndicatId, ""},
		{`r."departementId"`, in.DepartementId, ""},
		{`p."canalProvenanceId"`, in.CanalProvenanceId, ""},
		{`p."enrollmentCapturedById"`, in.EnrollmentCapturedById, ""},
		{`p."lastCallById"`, in.LastCallById, ""},
		{`p."origin"`, in.Origin, ""},
		{`p."type"`, in.Type, `::"ProspectType"`},
		{`p."phase2Status"`, in.Phase2Status, `::"Phase2Status"`},
		{`p."enrollmentMethod"`, in.EnrollmentMethod, `::"EnrollmentMethod"`},
	}
	for _, d := range directs {
		if d.valeur == "" {
			continue
		}
		p.clauses = append(p.clauses, d.colonne+" = "+p.valeur(d.valeur)+d.cast)
	}
}

func exportFiltresDerives(p *exportPredicat, in *ExportProspectsInput, segment string) error {
	if in.Projet != "" {
		clause := `EXISTS (SELECT 1 FROM "prospect_journeys" pj WHERE pj."prospectId" = p."id" AND pj."projet" = ` + p.valeur(in.Projet) + `::"Projet"`
		if in.Statut != "" {
			clause += ` AND pj."statut" = ` + p.valeur(in.Statut) + `::"ProspectStatut"`
		}
		p.clauses = append(p.clauses, clause+")")
	}
	if in.Projet == "" && in.Statut != "" {
		p.clauses = append(p.clauses, `p."statut" = `+p.valeur(in.Statut)+`::"ProspectStatut"`)
	}
	if in.Revue != "" {
		p.clauses = append(p.clauses, `p."statut" = 'CONVERTI'`)
		if in.Revue == exportFiltreVrai {
			p.clauses = append(p.clauses, `p."revueAt" IS NOT NULL`)
		} else {
			p.clauses = append(p.clauses, `p."revueAt" IS NULL`)
		}
	}
	if segment != "" {
		p.clauses = append(p.clauses, exportSegmentSQL(segment))
	}
	if in.AppelePar != "" {
		p.clauses = append(p.clauses, `EXISTS (SELECT 1 FROM "call_attempts" ca WHERE ca."prospectId" = p."id" AND ca."performedById" = `+p.valeur(in.AppelePar)+")")
	}
	return exportBornesEtRecherche(p, in)
}

func exportBornesEtRecherche(p *exportPredicat, in *ExportProspectsInput) error {
	if err := exportBornes(p, `p."clientCreatedAt"`, in.DateFrom, in.DateTo); err != nil {
		return err
	}
	recherche := strings.TrimSpace(in.Search)
	if recherche == "" {
		return nil
	}
	clause := `((lower(p."nom") || ' ' || lower(p."prenom")) LIKE ` + p.valeur("%"+strings.ToLower(recherche)+"%")
	if compact := exportChiffres(recherche); len(compact) >= 3 {
		motif := compact
		if e164, err := database.NormaliserTelephone(recherche, "SN"); err == nil {
			motif = e164
		}
		clause += ` OR p."phoneE164" LIKE ` + p.valeur("%"+motif+"%")
	}
	p.clauses = append(p.clauses, clause+")")
	return nil
}

func exportChiffres(v string) string {
	var b strings.Builder
	for _, r := range v {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func exportSegmentSQL(segment string) string {
	syndicat, banque := `sy."sigle" <> 'CHUES'`, `bq."shortName" <> 'CBAO'`
	if segment == exportCleBdd1 || segment == exportCleBdd2 {
		syndicat = `sy."sigle" = 'CHUES'`
	}
	if segment == exportCleBdd1 || segment == exportCleBdd3 {
		banque = `bq."shortName" = 'CBAO'`
	}
	return "(" + syndicat + " AND " + banque + ")"
}

// Portée, filtres et suppression logique, partagés par les lignes et par la
// feuille Synthèse : deux clauses distinctes feraient diverger le total du
// tableau de bord et le nombre de lignes du classeur.
func exportConditionsProspects(u *socle.Utilisateur, in *ExportProspectsInput, segment string) (*exportPredicat, error) {
	p := &exportPredicat{}
	exportPorteeDeLecture(p, u)
	if in.CommercialId != "" {
		cible := in.CommercialId
		if !u.Peut(socle.PermissionExportsVoirTout) && cible != u.ID {
			cible = "__aucun__"
		}
		p.ajouter(`p."createdById"`, "=", cible)
	}
	if in.IncludeDeleted != exportFiltreVrai || !u.Peut(socle.PermissionDonneesVoirSupprimees) {
		p.clauses = append(p.clauses, `p."deletedAt" IS NULL`)
	}
	p.clauses = append(p.clauses, `r."deletedAt" IS NULL`)
	exportFiltresDirects(p, in)
	if err := exportFiltresDerives(p, in, segment); err != nil {
		return nil, err
	}
	return p, nil
}

const exportJointuresProspects = `
FROM "prospects" p
LEFT JOIN "representants" r ON r."id" = p."representantId"
LEFT JOIN "departements" d ON d."id" = r."departementId"
LEFT JOIN "users" rc ON rc."id" = r."createdById"
LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
LEFT JOIN "banques" bq ON bq."id" = p."banqueId"
INNER JOIN "users" cb ON cb."id" = p."createdById"
LEFT JOIN "professions" pr ON pr."id" = p."professionId"
LEFT JOIN "canaux_provenance" cp ON cp."id" = p."canalProvenanceId"
LEFT JOIN "employeurs" em ON em."id" = p."employeurId"
LEFT JOIN "pays" py ON py."id" = p."paysResidenceId"
LEFT JOIN "income_bands" ib ON ib."id" = p."incomeBandId"
LEFT JOIN "users" ec ON ec."id" = p."enrollmentCapturedById"
LEFT JOIN "users" rv ON rv."id" = p."revueById"
LEFT JOIN LATERAL (
  SELECT ca."outcome"::text AS outcome, ca."comment" AS commentaire, ca."createdAt" AS le
  FROM "call_attempts" ca WHERE ca."prospectId" = p."id"
  ORDER BY ca."createdAt" DESC, ca."id" DESC LIMIT 1
) la ON TRUE`

const exportSelectProspects = `
SELECT p."id", p."nom", p."prenom", COALESCE(p."phoneE164", '')::text,
  COALESCE(bq."name", '')::text, COALESCE(bq."shortName", '')::text, COALESCE(sy."sigle", '')::text,
  COALESCE(r."id", '')::text, COALESCE(r."fullName", '')::text, COALESCE(r."phoneE164", '')::text,
  COALESCE(d."name", '')::text, COALESCE(rc."fullName", '')::text, r."clientCreatedAt",
  cb."fullName", p."clientCreatedAt",
  COALESCE(p."type"::text, '')::text, COALESCE(pr."label", p."profession", '')::text,
  COALESCE(cp."label", '')::text, p."dureeSystemeMois",
  COALESCE(em."label", p."employeur", '')::text, COALESCE(p."typeContrat"::text, '')::text,
  p."ancienneteMois", COALESCE(p."lieuActivite", '')::text, COALESCE(p."modeEpargne"::text, '')::text,
  COALESCE(py."label", '')::text, COALESCE(p."villeResidence", '')::text,
  COALESCE(CASE p."whatsappStatus"
    WHEN 'MEME_NUMERO' THEN p."phoneE164" WHEN 'AUTRE_NUMERO' THEN p."whatsappE164" END, '')::text,
  COALESCE(p."relaisNom", '')::text, COALESCE(p."relaisPhoneE164", '')::text,
  COALESCE(p."enrollmentMethod"::text, '')::text, p."phase2Status"::text,
  COALESCE(la.outcome, '')::text, COALESCE(la.commentaire, '')::text, la.le,
  COALESCE(ec."fullName", '')::text, p."enrollmentCapturedAt",
  COALESCE(p."champsLibres", '{}'::jsonb),
  ARRAY(SELECT j."projet"::text FROM "prospect_journeys" j WHERE j."prospectId" = p."id" ORDER BY j."createdAt" ASC),
  ARRAY(SELECT j."statut"::text FROM "prospect_journeys" j WHERE j."prospectId" = p."id" ORDER BY j."createdAt" ASC),
  p."createdById", p."projet"::text, COALESCE(p."etablissement", '')::text, COALESCE(p."email", '')::text,
  COALESCE(ib."label", '')::text, COALESCE(p."paymentMode"::text, '')::text, p."whatsappStatus"::text,
  COALESCE(p."origin", '')::text, COALESCE(p."originLabel", '')::text,
  p."aRevoirAt", p."revueAt", COALESCE(rv."fullName", '')::text, p."createdAt", p."updatedAt",
  COALESCE(p."typeBien"::text, '')::text`

type exportLigneProspect struct {
	ID                string
	Nom               string
	Prenom            string
	Phone             string
	BanqueNom         string
	BanqueCourt       string
	Syndicat          string
	RepresentantID    string
	Representant      string
	RepresentantPhone string
	Departement       string
	RepresentantCree  string
	RepresentantSaisi *time.Time
	Commercial        string
	Saisie            time.Time
	Type              string
	Profession        string
	Canal             string
	DureeSysteme      *int32
	Employeur         string
	TypeContrat       string
	Anciennete        *int32
	LieuActivite      string
	ModeEpargne       string
	Pays              string
	Ville             string
	Whatsapp          string
	RelaisNom         string
	RelaisPhone       string
	Methode           string
	Phase2            string
	DerniereIssue     string
	DernierCommentair string
	DernierAppel      *time.Time
	MethodePar        string
	MethodeLe         *time.Time
	ChampsLibres      []byte
	Projets           []string
	Statuts           []string
	CreePar           string
	ProjetOrigine     string
	Etablissement     string
	Email             string
	Revenu            string
	Paiement          string
	WhatsappStatut    string
	Origine           string
	OrigineDetail     string
	ARevoirDepuis     *time.Time
	RevuLe            *time.Time
	RevuPar           string
	CreeLe            time.Time
	ModifieLe         time.Time
	TypeBien          string
}

// Le segment n'est pas stocké : il se recalcule sur les deux axes, sinon
// l'onglet BDD1 et le graphique BDD1 comptent deux populations différentes.
func exportSegmentDuProspect(l *exportLigneProspect) string {
	if l.Syndicat == "" || l.BanqueCourt == "" {
		return ""
	}
	if l.Syndicat == exportCleChues {
		if l.BanqueCourt == ExportCleCbao {
			return exportCleBdd1
		}
		return exportCleBdd2
	}
	if l.BanqueCourt == ExportCleCbao {
		return exportCleBdd3
	}
	return exportCleBdd4
}

var ExportEntetesProspects = []string{
	ExportEnteteNom, ExportEntetePrenom, ExportEnteteTelephone, "Projets", "Statut",
	exportEnteteBanque, ExportEnteteSyndicat, ExportEnteteRepresentant,
	"Tél. représentant", ExportEnteteDepartement, exportEnteteCommercial, ExportEnteteDateSaisie,
	"Secteur", ExportEnteteProfession, ExportEnteteCanalProvenance, "Durée du système (mois)",
	FormulaireLibelleEmployeur, "Type de contrat", ExportEnteteAnciennete, "Lieu d’activité", "Mode d’épargne",
	"Pays de résidence", "Ville de résidence", ExportEnteteWhatsapp, "Relais au Sénégal",
	"Tél. relais", "Segment", "Méthode d’enrôlement", "Statut phase 3 (conversion)",
	exportEnteteDernierResultat, "Dernier commentaire", exportEnteteDernierAppel,
	"Méthode obtenue par", "Date d’obtention",
}

type exportChampLibre struct {
	ID      string `json:"id"`
	Libelle string `json:"libelle"`
}

// Une lecture manquante ou illisible ne fait pas échouer l'export : le
// classeur sort alors sans les colonnes ajoutées au formulaire.
func (s *service) exportChampsLibres(ctx context.Context, projets []string) []exportChampLibre {
	var libres []exportChampLibre
	vus := map[string]bool{}
	for _, projet := range projets {
		brut, err := s.Q.ExportReglagesConversion(ctx, "conversion.champs."+projet)
		if err != nil {
			continue
		}
		var reglages struct {
			Libres []exportChampLibre `json:"libres"`
		}
		if err := json.Unmarshal([]byte(brut), &reglages); err != nil {
			continue
		}
		for _, libre := range reglages.Libres {
			if libre.ID != "" && !vus[libre.ID] {
				vus[libre.ID] = true
				libres = append(libres, libre)
			}
		}
	}
	return libres
}

func exportValeursProspect(c *exportClasseur, l *exportLigneProspect, libres []exportChampLibre) []any {
	projets := make([]string, 0, len(l.Projets))
	statuts := make([]string, 0, len(l.Statuts))
	for i, projet := range l.Projets {
		projets = append(projets, exportLibelle(exportLibellesProjet, projet))
		if i < len(l.Statuts) {
			statuts = append(statuts, exportLibelle(exportLibellesProjet, projet)+" : "+exportLibelle(exportLibellesStatut, l.Statuts[i]))
		}
	}
	valeurs := []any{
		l.Nom, l.Prenom, l.Phone, strings.Join(projets, " + "), strings.Join(statuts, " · "),
		l.BanqueNom, l.Syndicat, l.Representant, l.RepresentantPhone, l.Departement, l.Commercial,
		excelize.Cell{StyleID: c.date, Value: l.Saisie},
		exportLibelle(exportLibellesType, l.Type), l.Profession, l.Canal, exportCelluleNombre(l.DureeSysteme), l.Employeur,
		exportLibelle(exportLibellesContrat, l.TypeContrat), exportCelluleNombre(l.Anciennete), l.LieuActivite,
		exportLibelle(exportLibellesEpargne, l.ModeEpargne), l.Pays, l.Ville, l.Whatsapp, l.RelaisNom, l.RelaisPhone,
		exportSegmentDuProspect(l), exportLibelle(ExportLibellesMethode, l.Methode), exportLibelle(exportLibellesPhase2, l.Phase2),
		exportLibelle(exportLibellesIssue, l.DerniereIssue), l.DernierCommentair, c.horodate(l.DernierAppel),
		l.MethodePar, c.horodate(l.MethodeLe),
	}
	if len(libres) == 0 {
		return valeurs
	}
	reponses := map[string]string{}
	_ = json.Unmarshal(l.ChampsLibres, &reponses)
	for _, libre := range libres {
		valeurs = append(valeurs, reponses[libre.ID])
	}
	return valeurs
}

// Largeurs calculées sur la première page : elles tiennent dans l'en-tête du
// XML et ne sont plus ajustables une fois des lignes émises.
func exportLargeursProspects(entetes []string, page []exportLigneProspect, c *exportClasseur, libres []exportChampLibre) []float64 {
	largeurs := make([]float64, len(entetes))
	for i, entete := range entetes {
		largeurs[i] = float64(len([]rune(entete)) + 2)
	}
	for ligne := range page {
		for i, valeur := range exportValeursProspect(c, &page[ligne], libres) {
			longueur := 21.0
			if texte, ok := valeur.(string); ok {
				longueur = float64(len([]rune(texte)) + 2)
			}
			if i < len(largeurs) && longueur > largeurs[i] {
				largeurs[i] = longueur
			}
		}
	}
	for i := range largeurs {
		largeurs[i] = min(largeurs[i], 50)
	}
	return largeurs
}

// Le pool pour un export filtré, la transaction du classeur global pour l'autre.
type exportLecteurSQL interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func exportPageProspects(ctx context.Context, base exportLecteurSQL, p *exportPredicat, apres string) ([]exportLigneProspect, error) {
	args := append([]any{}, p.args...)
	clause := p.where()
	if apres != "" {
		args = append(args, apres)
		clause += ` AND p."id" > $` + strconv.Itoa(len(args))
	}
	requete := exportSelectProspects + exportJointuresProspects + " WHERE " + clause +
		` ORDER BY p."id" ASC LIMIT ` + strconv.Itoa(exportTaillePage)
	rows, err := base.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowToStructByPos[exportLigneProspect])
}

type exportCompteurRepresentant struct {
	nom         string
	phone       string
	departement string
	commercial  string
	saisie      *time.Time
	prospects   int
}

// Une feuille de prospects, page keyset après page keyset : la mémoire ne
// dépend jamais du nombre de lignes exportées.
func (s *service) exportFeuilleProspects(ctx context.Context, c *exportClasseur, nom string, p *exportPredicat, libres []exportChampLibre) (lignes int, representants map[string]*exportCompteurRepresentant, err error) {
	page, err := exportPageProspects(ctx, s.Pool, p, "")
	if err != nil {
		return 0, nil, err
	}
	entetes := append(append([]string{}, ExportEntetesProspects...), exportEntetesChampsLibres(libres)...)
	f, err := c.nouvelleFeuille(nom, entetes, exportLargeursProspects(entetes, page, c, libres), nil)
	if err != nil {
		return 0, nil, err
	}
	representants = map[string]*exportCompteurRepresentant{}
	for len(page) > 0 {
		for i := range page {
			if err := f.ecrire(exportValeursProspect(c, &page[i], libres)...); err != nil {
				return 0, nil, err
			}
			lignes++
			exportCompterRepresentant(representants, &page[i])
		}
		if len(page) < exportTaillePage {
			break
		}
		if page, err = exportPageProspects(ctx, s.Pool, p, page[len(page)-1].ID); err != nil {
			return 0, nil, err
		}
	}
	return lignes, representants, f.fermer(true)
}

func exportEntetesChampsLibres(libres []exportChampLibre) []string {
	entetes := make([]string, 0, len(libres))
	for _, libre := range libres {
		entetes = append(entetes, libre.Libelle)
	}
	return entetes
}

func exportCompterRepresentant(representants map[string]*exportCompteurRepresentant, l *exportLigneProspect) {
	if l.RepresentantID == "" {
		return
	}
	if connu, ok := representants[l.RepresentantID]; ok {
		connu.prospects++
		return
	}
	representants[l.RepresentantID] = &exportCompteurRepresentant{
		nom: l.Representant, phone: l.RepresentantPhone, departement: l.Departement,
		commercial: l.RepresentantCree, saisie: l.RepresentantSaisi, prospects: 1,
	}
}

func (s *service) exportProspects(ctx context.Context, in *ExportProspectsInput) (*huma.StreamResponse, error) {
	u := socle.UtilisateurCourant(ctx)
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	projets := []string{exportCleChues, exportCleGrandPublic}
	if in.Projet != "" {
		projets = []string{in.Projet}
	}
	libres := s.exportChampsLibres(ctx, projets)
	if in.Mode == "consolidated" {
		err = s.exportClasseurConsolide(ctx, c, &u, in, libres)
	} else {
		err = s.exportClasseurFiltre(ctx, c, &u, in, libres)
	}
	if err != nil {
		_ = c.f.Close()
		return nil, err
	}
	return exportReponseClasseur(c, s.exportNomFichierProspects(in)), nil
}

func (s *service) exportNomFichierProspects(in *ExportProspectsInput) string {
	if in.Mode == "consolidated" {
		return "cpi-prospects-consolide-" + s.exportDateDuJour() + ".xlsx"
	}
	if in.Projet == exportCleGrandPublic {
		return "cpi-prospects-grand-public-" + s.exportDateDuJour() + ".xlsx"
	}
	return "cpi-prospects-" + s.exportDateDuJour() + ".xlsx"
}

// Exactement cinq feuilles : Consolidé, puis un onglet par segment. Le filtre
// `segment` est ignoré, c'est le classeur qui porte la segmentation.
func (s *service) exportClasseurConsolide(ctx context.Context, c *exportClasseur, u *socle.Utilisateur, in *ExportProspectsInput, libres []exportChampLibre) error {
	for _, segment := range append([]string{""}, exportSegments...) {
		nom := "Consolidé"
		if segment != "" {
			nom = segment
		}
		p, err := exportConditionsProspects(u, in, segment)
		if err != nil {
			return err
		}
		if _, _, err := s.exportFeuilleProspects(ctx, c, nom, p, libres); err != nil {
			return err
		}
	}
	return nil
}

func (s *service) exportClasseurFiltre(ctx context.Context, c *exportClasseur, u *socle.Utilisateur, in *ExportProspectsInput, libres []exportChampLibre) error {
	p, err := exportConditionsProspects(u, in, in.Segment)
	if err != nil {
		return err
	}
	total, representants, err := s.exportFeuilleProspects(ctx, c, exportEnteteProspects, p, libres)
	if err != nil {
		return err
	}
	if err := exportEcrireFeuilleRepresentants(c, representants); err != nil {
		return err
	}
	return s.exportSynthese(ctx, c, p, in, total, len(representants))
}

func exportEcrireFeuilleRepresentants(c *exportClasseur, representants map[string]*exportCompteurRepresentant) error {
	f, err := c.nouvelleFeuille(exportNomFeuilleRepresentants,
		[]string{
			ExportEnteteRepresentant, ExportEnteteTelephone, ExportEnteteDepartement,
			exportEnteteCommercial, exportEnteteProspects, ExportEnteteDateSaisie,
		},
		[]float64{28, 18, 22, 26, 12, 20}, nil)
	if err != nil {
		return err
	}
	ordonnes := make([]*exportCompteurRepresentant, 0, len(representants))
	for _, r := range representants {
		ordonnes = append(ordonnes, r)
	}
	sort.SliceStable(ordonnes, func(i, j int) bool { return ordonnes[i].prospects > ordonnes[j].prospects })
	for _, r := range ordonnes {
		if err := f.ecrire(r.nom, r.phone, r.departement, r.commercial, r.prospects, c.horodate(r.saisie)); err != nil {
			return err
		}
	}
	return f.fermer(true)
}

type exportLigneSynthese struct {
	libelle   string
	prospects int
	part      float64
}

func exportPart(valeur, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(int(float64(valeur)/float64(total)*1000+0.5)) / 10
}

func (s *service) exportAgregat(ctx context.Context, p *exportPredicat, cle, jointure, condition string) ([]exportLigneSynthese, error) {
	requete := "SELECT " + cle + " AS libelle, COUNT(*)::int AS prospects" + exportJointuresProspects + " " + jointure +
		" WHERE " + p.where() + condition + " GROUP BY 1 ORDER BY 2 DESC, 1 ASC"
	rows, err := s.Pool.Query(ctx, requete, p.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var lignes []exportLigneSynthese
	total := 0
	for rows.Next() {
		var ligne exportLigneSynthese
		var libelle *string
		if err := rows.Scan(&libelle, &ligne.prospects); err != nil {
			return nil, err
		}
		ligne.libelle = exportChaineOuVide(libelle)
		total += ligne.prospects
		lignes = append(lignes, ligne)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range lignes {
		lignes[i].part = exportPart(lignes[i].prospects, total)
	}
	return lignes, nil
}

// Les valeurs d'une énumération sont émises même à zéro : un histogramme qui
// perd une barre change de forme sans raison.
func exportOrdonner(lignes []exportLigneSynthese, ordre []string, libelles map[string]string) []exportLigneSynthese {
	compteurs := map[string]int{}
	total := 0
	for _, ligne := range lignes {
		compteurs[ligne.libelle] = ligne.prospects
		total += ligne.prospects
	}
	sortie := make([]exportLigneSynthese, 0, len(ordre))
	for _, cle := range ordre {
		sortie = append(sortie, exportLigneSynthese{
			libelle:   exportLibelle(libelles, cle),
			prospects: compteurs[cle],
			part:      exportPart(compteurs[cle], total),
		})
	}
	return sortie
}

type exportGroupeSynthese struct {
	titre     string
	cle       string
	jointure  string
	condition string
	ordre     []string
	libelles  map[string]string
}

var exportGroupesSynthese = []exportGroupeSynthese{
	{"Par banque", `bq."shortName"`, "", "", nil, nil},
	{"Par syndicat", `sy."sigle"`, "", "", nil, nil},
	{"Par département", ColonneDepartementNom, `INNER JOIN "departements" dj ON dj."id" = r."departementId"`, "", nil, nil},
	{"Par segment", "", "", "", exportSegments, exportLibellesSegment},
	{"Avancement phase 3 (conversion)", `p."phase2Status"::text`, "", "", exportOrdrePhase2, exportLibellesPhase2},
	{"Méthodes d’enrôlement obtenues", `p."enrollmentMethod"::text`, "", ` AND p."enrollmentMethod" IS NOT NULL`, ExportOrdreMethodes, ExportLibellesMethode},
}

func (s *service) exportSynthese(ctx context.Context, c *exportClasseur, p *exportPredicat, in *ExportProspectsInput, total, representants int) error {
	vue, err := s.exportVueDEnsemble(ctx, p, in)
	if err != nil {
		return err
	}
	f, err := c.nouvelleFeuille("Synthèse", []string{"Indicateur", "Valeur", "Part (%)"}, []float64{34, 16, 12}, nil)
	if err != nil {
		return err
	}
	if err := f.ecrire(excelize.Cell{StyleID: c.section, Value: "Vue d’ensemble"}); err != nil {
		return err
	}
	entete := []exportLigneSynthese{
		{libelle: "Prospects exportés", prospects: total},
		{libelle: "Représentants distincts", prospects: representants},
	}
	for _, ligne := range append(entete, vue...) {
		if err := f.ecrire(ligne.libelle, ligne.prospects); err != nil {
			return err
		}
	}
	for i := range exportGroupesSynthese {
		if err := s.exportGroupeSynthese(ctx, f, p, &exportGroupesSynthese[i]); err != nil {
			return err
		}
	}
	return f.fermer(false)
}

func (s *service) exportGroupeSynthese(ctx context.Context, f *exportFeuille, p *exportPredicat, groupe *exportGroupeSynthese) error {
	cle := groupe.cle
	if cle == "" {
		cle = exportSegmentCase()
	}
	lignes, err := s.exportAgregat(ctx, p, cle, groupe.jointure, groupe.condition)
	if err != nil {
		return err
	}
	if groupe.ordre != nil {
		lignes = exportOrdonner(lignes, groupe.ordre, groupe.libelles)
	}
	if err := f.ecrire(""); err != nil {
		return err
	}
	if err := f.ecrire(excelize.Cell{StyleID: f.c.section, Value: groupe.titre}); err != nil {
		return err
	}
	for i := range lignes {
		if err := f.ecrire(lignes[i].libelle, lignes[i].prospects, lignes[i].part); err != nil {
			return err
		}
	}
	return nil
}

func exportSegmentCase() string {
	var b strings.Builder
	b.WriteString("CASE")
	for _, segment := range exportSegments {
		b.WriteString(" WHEN " + exportSegmentSQL(segment) + " THEN '" + segment + "'")
	}
	b.WriteString(" END")
	return b.String()
}

func (s *service) exportVueDEnsemble(ctx context.Context, p *exportPredicat, in *ExportProspectsInput) ([]exportLigneSynthese, error) {
	statut := `p."statut"`
	args := p.args
	if in.Projet != "" {
		args = append(append([]any{}, p.args...), in.Projet)
		statut = `(SELECT pj."statut" FROM "prospect_journeys" pj WHERE pj."prospectId" = p."id" AND pj."projet" = $` +
			strconv.Itoa(len(args)) + `::"Projet" LIMIT 1)`
	}
	requete := `SELECT
  COUNT(DISTINCT u."id") FILTER (WHERE u."role" = 'COMMERCIAL' AND u."isActive" AND u."deletedAt" IS NULL)::int,
  COUNT(DISTINCT r."departementId")::int,
  COUNT(*) FILTER (WHERE ` + statut + ` = 'NOUVEAU')::int,
  COUNT(*) FILTER (WHERE ` + statut + ` = 'CONTACTE')::int,
  COUNT(*) FILTER (WHERE ` + statut + ` = 'CONVERTI')::int,
  COUNT(*) FILTER (WHERE ` + statut + ` = 'PERDU')::int,
  COUNT(*) FILTER (WHERE p."clientCreatedAt" >= now() - interval '7 days')::int,
  COUNT(*) FILTER (WHERE p."clientCreatedAt" >= now() - interval '30 days')::int` +
		exportJointuresProspects + ` LEFT JOIN "users" u ON u."id" = p."createdById" WHERE ` + p.where()
	var v [8]int
	if err := s.Pool.QueryRow(ctx, requete, args...).Scan(&v[0], &v[1], &v[2], &v[3], &v[4], &v[5], &v[6], &v[7]); err != nil {
		return nil, err
	}
	libelles := []string{
		"Commerciaux actifs", "Départements couverts", "Nouveaux", "Contactés",
		"Convertis", "Perdus", "Saisis sur 7 jours", "Saisis sur 30 jours",
	}
	lignes := make([]exportLigneSynthese, 0, len(libelles))
	for i, libelle := range libelles {
		lignes = append(lignes, exportLigneSynthese{libelle: libelle, prospects: v[i]})
	}
	return lignes, nil
}
