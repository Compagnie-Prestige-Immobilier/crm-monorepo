package exports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/accueil"
	"cpi-go/internal/shared/socle"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

const (
	exportTypeMimeXlsx            = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	exportCouleurBordeaux         = "630210"
	exportTaillePage              = 1000
	exportNomFeuilleRepresentants = "Représentants"
)

// Valeurs métier et intitulés de colonne qui reviennent d'une feuille à l'autre.
const (
	exportCleChues          = "CHUES"
	exportCleGrandPublic    = "GRAND_PUBLIC"
	ExportCleCbao           = "CBAO"
	exportCleBdd1           = "BDD1"
	exportCleBdd2           = "BDD2"
	exportCleBdd3           = "BDD3"
	exportCleBdd4           = "BDD4"
	exportCleEnAttente      = "PENDING"
	ExportCleMethodeObtenue = "METHOD_OBTAINED"
	// « TOUT » régroupe les onglets Intéressés, Hésitants et Rendez-vous.
	exportPhase2StatusTout = "TOUT"
	ExportCleAucun         = "AUCUN"
	exportCleAutreNumero   = "AUTRE_NUMERO"
	exportFiltreVrai       = "true"
	exportFiltreFaux       = "false"
	cleAucunAuteur         = "__aucun__"
	ExportTypeRemplissage  = "pattern"
	ExportVoletActif       = "bottomLeft"

	exportLibelleContacte       = "Contacté"
	exportLibelleFonctionnaire  = "Fonctionnaire"
	ExportLibelleAutre          = "Autre"
	exportLibelleMail           = "Mail"
	ExportLibelleInjoignable    = "Injoignable"
	exportLibelleRefuse         = "Refusé"
	ExportLibelleJoint          = "Joint"
	exportLibelleOui            = "Oui"
	exportLibelleNon            = "Non"
	exportLibelleCdi            = "CDI"
	exportLibelleCdd            = "CDD"
	exportLibelleAucun          = "Aucun"
	exportLibelleTontine        = "Tontine"
	exportLibellePlateforme     = "Plateforme en ligne"
	exportLibelleRendezVous     = "Enrôlement sur place"
	ExportCleRefus              = "REFUSED"
	exportCleMemeNumero         = "MEME_NUMERO"
	exportCleNonDemande         = "NON_DEMANDE"
	ExportCleMauvaisNumero      = "WRONG_NUMBER"
	ExportLibelleRefus          = "Refus"
	ExportLibelleNonDemande     = "Non demandé"
	ExportLibelleAccepte        = "Accepté"
	ExportLibelleAutreNumero    = "Autre numéro"
	ExportLibelleMemeNumero     = "Même numéro"
	ExportLibelleFauxNumero     = "Faux numéro"
	ExportLibelleNonQualifie    = "Non qualifié"
	ExportLibelleMobileMoney    = "Mobile money"
	ExportLibelleARappeler      = "À rappeler"
	ExportLibelleMethodeObtenue = "Méthode obtenue"
	ExportEnteteTeleconseiller  = "Téléconseiller"

	ExportEnteteNom               = "Nom"
	ExportEntetePrenom            = "Prénom"
	ExportEnteteTelephone         = "Téléphone"
	exportEnteteBanque            = "Banque"
	ExportEnteteSyndicat          = "Syndicat"
	ExportEnteteRepresentant      = "Représentant"
	ExportEnteteDepartement       = "Département"
	ExportEnteteIef               = "IEF"
	ExportEnteteProfession        = "Profession"
	ExportEnteteWhatsapp          = "WhatsApp"
	exportEnteteDernierResultat   = "Dernier résultat"
	exportEnteteDernierAppel      = "Dernier appel"
	exportEnteteProspects         = "Prospects"
	ExportEnteteNotes             = "Notes"
	exportEnteteCommentaire       = "Commentaire"
	exportEnteteDate              = "Date"
	exportEnteteProjet            = "Projet"
	exportEnteteIdentifiantFiche  = "Identifiant fiche"
	exportEnteteCreeLe            = "Créé le"
	exportEnteteModifieLe         = "Modifié le"
	ExportEnteteNomComplet        = "Nom complet"
	exportEnteteIdentifiant       = "Identifiant"
	exportEnteteIdentifiantAgent  = "Identifiant téléconseiller"
	exportEnteteType              = "Type"
	ExportEnteteDateSaisie        = "Date de saisie"
	ExportEnteteCanalProvenance   = "Canal de provenance"
	ExportEnteteAnciennete        = "Ancienneté (mois)"
	ExportEnteteEtablissement     = "Établissement"
	ExportEnteteMethodeEnrolement = "Méthode d’enrôlement"
	ExportEnteteTypeContrat       = "Type de contrat"
	ExportEnteteLieuActivite      = "Lieu d’activité"
	ExportEnteteModeEpargne       = "Mode d’épargne"
	ExportEntetePaysResidence     = "Pays de résidence"
	ExportEnteteVilleResidence    = "Ville de résidence"
	ExportEnteteSaisiLe           = "Saisi le"
	ExportEnteteJour              = "Jour"
	ExportEnteteQualification     = "Qualification"
	exportExempleTelephone        = "77 123 45 67"
)

var Garde = map[string]socle.Permission{
	"GET /api/v1/export/global.xlsx":                        socle.PermissionExportsGlobaux,
	"GET /api/v1/export/prospects.xlsx":                     socle.PermissionExportsProspects,
	"GET /api/v1/export/representants.xlsx":                 socle.PermissionFichesTenir,
	"GET /api/v1/export/visites.xlsx":                       socle.PermissionAccueilRegistre,
	"GET /api/v1/export/bank-cases.xlsx":                    socle.PermissionExportsBanque,
	"GET /api/v1/export/prospects-modele.xlsx":              socle.PermissionExportsModeles,
	"GET /api/v1/export/prospects-grand-public-modele.xlsx": socle.PermissionExportsModeles,
	"GET /api/v1/export/representants-modele.xlsx":          socle.PermissionExportsModeles,
	"GET " + cheminExportRendezVous:                         socle.PermissionRendezVousExporter,
}

// LibellePaiement nomme un mode de paiement, ici comme dans les classeurs.
func LibellePaiement(mode string) string {
	return exportLibellesPaiement[mode]
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "export-prospects", Method: http.MethodGet, Path: "/api/v1/export/prospects.xlsx"}, s.exportProspects)
	huma.Register(api, huma.Operation{OperationID: "export-global", Method: http.MethodGet, Path: "/api/v1/export/global.xlsx"}, s.exportGlobal)
	huma.Register(api, huma.Operation{OperationID: "export-representants", Method: http.MethodGet, Path: "/api/v1/export/representants.xlsx"}, s.exportRepresentants)
	huma.Register(api, huma.Operation{OperationID: "export-visites", Method: http.MethodGet, Path: "/api/v1/export/visites.xlsx"}, s.exportVisites)
	huma.Register(api, huma.Operation{OperationID: "export-dossiers-bancaires", Method: http.MethodGet, Path: "/api/v1/export/bank-cases.xlsx"}, s.exportDossiers)
	huma.Register(api, huma.Operation{OperationID: "modele-import-prospects", Method: http.MethodGet, Path: "/api/v1/export/prospects-modele.xlsx"}, s.exportModeleProspects)
	huma.Register(api, huma.Operation{OperationID: "modele-import-prospects-grand-public", Method: http.MethodGet, Path: "/api/v1/export/prospects-grand-public-modele.xlsx"}, s.exportModeleGrandPublic)
	huma.Register(api, huma.Operation{OperationID: "modele-import-representants", Method: http.MethodGet, Path: "/api/v1/export/representants-modele.xlsx"}, s.exportModeleRepresentants)
	huma.Register(api, huma.Operation{OperationID: "export-rendez-vous", Method: http.MethodGet, Path: cheminExportRendezVous}, s.exportRendezVous)
}

var (
	exportLibellesProjet       = map[string]string{exportCleChues: exportCleChues, exportCleGrandPublic: "Grand Public"}
	exportLibellesStatut       = map[string]string{string(db.ProspectStatutNOUVEAU): "Nouveau", string(db.ProspectStatutCONTACTE): exportLibelleContacte, string(db.ProspectStatutCONVERTI): "Converti", string(db.ProspectStatutPERDU): "Perdu", string(db.ProspectStatutVENDU): "Vendu"}
	exportLibellesType         = map[string]string{"FONCTIONNAIRE": exportLibelleFonctionnaire, "SECTEUR_PRIVE": "Secteur privé", "INFORMEL": "Informel", "DIASPORA": "Diaspora"}
	exportLibellesContrat      = map[string]string{string(db.TypeContratCDI): exportLibelleCdi, string(db.TypeContratCDD): exportLibelleCdd, string(db.TypeContratAUTRE): ExportLibelleAutre}
	exportLibellesEpargne      = map[string]string{"TONTINE": exportLibelleTontine, "MOBILE_MONEY": ExportLibelleMobileMoney, "BANQUE": exportEnteteBanque, ExportCleAucun: exportLibelleAucun}
	exportLibellesPhase2       = map[string]string{exportCleEnAttente: "En attente", ExportCleMethodeObtenue: ExportLibelleMethodeObtenue, ExportCleRefus: ExportLibelleRefus, ExportCleMauvaisNumero: ExportLibelleFauxNumero, "UNREACHABLE": ExportLibelleInjoignable, "INTERESTED": "Intéressé", "HESITANT": "Hésitant", "APPOINTMENT": "Rendez-vous", "REACHED": "Joint, sans suite"}
	ExportLibellesMethode      = map[string]string{string(db.EnrollmentMethodAPPOINTMENT): exportLibelleRendezVous, string(db.EnrollmentMethodPHYSICAL): exportLibelleRendezVous, string(db.EnrollmentMethodRDVCPI): exportLibelleRendezVous, string(db.EnrollmentMethodPLATFORM): exportLibellePlateforme, string(db.EnrollmentMethodPLATEFORMEENLIGNE): exportLibellePlateforme, string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING): exportLibelleMail, string(db.EnrollmentMethodMAIL): exportLibelleMail, string(db.EnrollmentMethodWHATSAPP): ExportEnteteWhatsapp}
	exportLibellesSegment      = map[string]string{exportCleBdd1: "BDD1 : CHUES / CBAO", exportCleBdd2: "BDD2 : CHUES / autre banque", exportCleBdd3: "BDD3 : autre syndicat / CBAO", exportCleBdd4: "BDD4 : autre syndicat / autre banque"}
	exportLibellesRelation     = map[string]string{string(db.RepresentantRelationINCONNU): ExportLibelleNonQualifie, string(db.RepresentantRelationCONTACTE): exportLibelleContacte, string(db.RepresentantRelationAMBASSADEUR): ExportLibelleAccepte, string(db.RepresentantRelationREFUS): exportLibelleRefuse}
	exportLibellesWhatsapp     = map[string]string{exportCleNonDemande: ExportLibelleNonDemande, exportCleMemeNumero: ExportLibelleMemeNumero, exportCleAutreNumero: ExportLibelleAutreNumero, ExportCleAucun: exportLibelleAucun}
	exportLibellesRappel       = map[string]string{exportCleEnAttente: "En attente", "DONE": "Effectué", "CANCELLED": "Annulé", "SUPERSEDED": "Remplacé"}
	exportLibellesPaiement     = map[string]string{string(db.PaymentModeCOMPTANT): "Comptant", string(db.PaymentModeECHELONNE): "Échelonné", string(db.PaymentModeCREDITIMMOBILIER): "Crédit immobilier"}
	exportLibellesTypeBien     = map[string]string{string(db.TypeBienTERRAIN): "Terrain", string(db.TypeBienVILLA): "Villa"}
	exportLibellesConsentement = map[string]string{exportCleNonDemande: ExportLibelleNonDemande, "INTERESSE": "Intéressé", "REFUSE": exportLibelleRefuse}
	exportLibellesSuggestion   = map[string]string{string(db.SuggestionStatusAAPPELER): "À appeler", string(db.SuggestionStatusAPPELE): "Appelé", string(db.SuggestionStatusABANDONNE): "Abandonné"}
	exportOrdrePhase2          = []string{exportCleEnAttente, "INTERESTED", "HESITANT", "APPOINTMENT", ExportCleMethodeObtenue, "REACHED", ExportCleRefus, "UNREACHABLE", ExportCleMauvaisNumero}
	ExportOrdreMethodes        = []string{string(db.EnrollmentMethodAPPOINTMENT), string(db.EnrollmentMethodPLATFORM), string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING), string(db.EnrollmentMethodWHATSAPP)}
	exportSegments             = []string{exportCleBdd1, exportCleBdd2, exportCleBdd3, exportCleBdd4}
)

func exportLibelle(table map[string]string, cle string) string {
	if cle == "" {
		return ""
	}
	if v, ok := table[cle]; ok {
		return v
	}
	return cle
}

type exportClasseur struct {
	f       *excelize.File
	entete  int
	date    int
	jour    int
	texte   int
	monnaie int
	section int
	rappel  int
	exemple int
	feuille int
}

func exportNouveauStyle(f *excelize.File, motif string, base *excelize.Style) (int, error) {
	style := base
	if style == nil {
		style = &excelize.Style{}
	}
	if motif != "" {
		style.CustomNumFmt = &motif
	}
	return f.NewStyle(style)
}

func exportNouveauClasseur() (*exportClasseur, error) {
	f := excelize.NewFile()
	c := &exportClasseur{f: f}
	styles := []struct {
		cible  *int
		style  *excelize.Style
		format string
	}{
		{&c.entete, &excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11},
			Fill:      excelize.Fill{Type: ExportTypeRemplissage, Pattern: 1, Color: []string{exportCouleurBordeaux}},
			Alignment: &excelize.Alignment{Vertical: "center", Horizontal: "left"},
		}, ""},
		{&c.section, &excelize.Style{Font: &excelize.Font{Bold: true, Color: exportCouleurBordeaux}}, ""},
		{&c.rappel, &excelize.Style{Font: &excelize.Font{Italic: true, Color: "6B6B6B", Size: 10}}, ""},
		{&c.exemple, &excelize.Style{
			Font: &excelize.Font{Italic: true, Color: "9A9A9A"},
			Fill: excelize.Fill{Type: ExportTypeRemplissage, Pattern: 1, Color: []string{"F3F3F3"}},
		}, ""},
		{&c.date, nil, "dd/mm/yyyy hh:mm"},
		{&c.jour, nil, "dd/mm/yyyy"},
		{&c.texte, nil, "@"},
		{&c.monnaie, nil, `#,##0" FCFA"`},
	}
	for _, s := range styles {
		id, err := exportNouveauStyle(f, s.format, s.style)
		if err != nil {
			return nil, err
		}
		*s.cible = id
	}
	return c, nil
}

// Excel « répare » un tableau dont deux colonnes portent le même intitulé :
// les champs libres de l'administrateur peuvent heurter un en-tête figé.
func exportEntetesUniques(entetes []string) []string {
	vus := map[string]int{}
	sortie := make([]string, len(entetes))
	for i, entete := range entetes {
		vus[entete]++
		if n := vus[entete]; n > 1 {
			entete += " (" + strconv.Itoa(n) + ")"
		}
		sortie[i] = entete
	}
	return sortie
}

type exportFeuille struct {
	c        *exportClasseur
	flux     *excelize.StreamWriter
	ligne    int
	colonnes int
}

// Largeurs, styles de colonne et volet figé se posent AVANT la première
// ligne : excelize refuse de les écrire une fois la feuille entamée.
func (c *exportClasseur) nouvelleFeuille(nom string, entetes []string, largeurs []float64, styles map[int]int) (*exportFeuille, error) {
	var err error
	if c.feuille == 0 {
		err = c.f.SetSheetName("Sheet1", nom)
	} else {
		_, err = c.f.NewSheet(nom)
	}
	if err != nil {
		return nil, err
	}
	c.feuille++
	flux, err := c.f.NewStreamWriter(nom)
	if err != nil {
		return nil, err
	}
	for i, largeur := range largeurs {
		if err := flux.SetColWidth(i+1, i+1, largeur); err != nil {
			return nil, err
		}
	}
	for rang, style := range styles {
		if err := flux.SetColStyle(rang, rang, style); err != nil {
			return nil, err
		}
	}
	if err := flux.SetPanes(&excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: ExportVoletActif}); err != nil {
		return nil, err
	}
	entetes = exportEntetesUniques(entetes)
	cellules := make([]any, len(entetes))
	for i, entete := range entetes {
		cellules[i] = excelize.Cell{StyleID: c.entete, Value: entete}
	}
	if err := flux.SetRow("A1", cellules, excelize.RowOpts{Height: 22}); err != nil {
		return nil, err
	}
	return &exportFeuille{c: c, flux: flux, ligne: 1, colonnes: len(entetes)}, nil
}

func (f *exportFeuille) ecrire(valeurs ...any) error {
	f.ligne++
	return f.flux.SetRow("A"+strconv.Itoa(f.ligne), valeurs)
}

func (f *exportFeuille) fermer(filtre bool) error {
	if filtre && f.ligne > 1 {
		coin, err := excelize.CoordinatesToCellName(f.colonnes, f.ligne)
		if err != nil {
			return err
		}
		f.c.feuille++
		table := &excelize.Table{Range: "A1:" + coin, Name: "Donnees" + strconv.Itoa(f.c.feuille), StyleName: "TableStyleLight1"}
		if err := f.flux.AddTable(table); err != nil {
			return err
		}
	}
	return f.flux.Flush()
}

func (c *exportClasseur) horodate(t *time.Time) any {
	if t == nil {
		return ""
	}
	return excelize.Cell{StyleID: c.date, Value: *t}
}

func exportChaineOuVide(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func exportCelluleTexte(v *string) any { return exportChaineOuVide(v) }

func exportCelluleNombre(v *int32) any {
	if v == nil {
		return ""
	}
	return *v
}

func exportCelluleOuiNon(v *bool) any {
	if v == nil {
		return ""
	}
	if *v {
		return exportLibelleOui
	}
	return exportLibelleNon
}

// Le classeur est monté en entier avant le premier octet : excelize garde les
// lignes en fichier temporaire, et une erreur de lecture rend encore un 5xx
// lisible au lieu d'un fichier tronqué qui s'ouvre quand même.
func exportReponseClasseur(c *exportClasseur, nom string) *huma.StreamResponse {
	return &huma.StreamResponse{Body: func(ctx huma.Context) {
		ctx.SetHeader("Content-Type", exportTypeMimeXlsx)
		ctx.SetHeader("Content-Disposition", `attachment; filename="`+nom+`"`)
		ctx.SetHeader("Cache-Control", "no-store")
		if err := c.f.Write(ctx.BodyWriter()); err != nil {
			slog.Error("écriture du classeur", "fichier", nom, "err", err)
		}
		if err := c.f.Close(); err != nil {
			slog.Error("fermeture du classeur", "fichier", nom, "err", err)
		}
	}}
}

func (s *service) exportDateDuJour() string {
	return time.Now().In(s.Cfg.TimeZone).Format("2006-01-02")
}

type exportPredicat struct {
	clauses []string
	args    []any
}

func (p *exportPredicat) valeur(v any) string {
	p.args = append(p.args, v)
	return "$" + strconv.Itoa(len(p.args))
}

func (p *exportPredicat) ajouter(gauche, operateur string, v any) {
	p.clauses = append(p.clauses, gauche+" "+operateur+" "+p.valeur(v))
}

func (p *exportPredicat) where() string {
	if len(p.clauses) == 0 {
		return "TRUE"
	}
	return strings.Join(p.clauses, " AND ")
}

type ExportRepresentantsInput struct {
	Search                string `query:"search" maxLength:"120"`
	DepartementId         string `query:"departementId"`
	IefId                 string `query:"iefId"`
	CommercialId          string `query:"commercialId"`
	DateFrom              string `query:"dateFrom"`
	DateTo                string `query:"dateTo"`
	HasProspects          string `query:"hasProspects" enum:"true,false"`
	RelationStatus        string `query:"relationStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	StatutQualificationId string `query:"statutQualificationId"`
	WhatsappStatus        string `query:"whatsappStatus" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	HasWhatsapp           string `query:"hasWhatsapp" enum:"true,false"`
	Suivi                 string `query:"suivi" enum:"A_RAPPELER,INJOIGNABLE"`
	LastCallById          string `query:"lastCallById"`
}

func exportConditionsRepresentants(u *socle.Utilisateur, in *ExportRepresentantsInput) (*exportPredicat, error) {
	p := &exportPredicat{clauses: []string{`r."deletedAt" IS NULL`}}
	if !u.Peut(socle.PermissionPortefeuilleVoirTout) {
		p.clauses = append(p.clauses, `(r."createdById" = `+p.valeur(u.ID)+
			` OR EXISTS (SELECT 1 FROM "lot_export_items" li WHERE li."representantId" = r."id" AND li."assigneeId" = `+p.valeur(u.ID)+"))")
	}
	if in.CommercialId != "" {
		cible := in.CommercialId
		if !u.Peut(socle.PermissionExportsVoirTout) && cible != u.ID {
			cible = cleAucunAuteur
		}
		p.ajouter(`r."createdById"`, "=", cible)
	}
	directs := []struct {
		colonne string
		valeur  string
		cast    string
	}{
		{`r."departementId"`, in.DepartementId, ""},
		{`r."iefId"`, in.IefId, ""},
		{`r."statutQualificationId"`, in.StatutQualificationId, ""},
		{`r."lastCallById"`, in.LastCallById, ""},
		{`r."relationStatus"`, in.RelationStatus, `::"RepresentantRelation"`},
	}
	for _, d := range directs {
		if d.valeur != "" {
			p.clauses = append(p.clauses, d.colonne+" = "+p.valeur(d.valeur)+d.cast)
		}
	}
	exportFiltresSuivi(p, in)
	return p, exportBornes(p, `r."clientCreatedAt"`, in.DateFrom, in.DateTo)
}

func exportFiltresSuivi(p *exportPredicat, in *ExportRepresentantsInput) {
	if in.Suivi == LotEtatARappeler {
		p.clauses = append(p.clauses, `r."nextCallbackAt" IS NOT NULL`)
	}
	if in.Suivi == "INJOIGNABLE" {
		p.clauses = append(p.clauses, `EXISTS (SELECT 1 FROM "statuts_qualification" sq WHERE sq."id" = r."statutQualificationId" AND sq."effect" = 'UNREACHABLE')`)
	}
	if in.HasProspects == exportFiltreVrai {
		p.clauses = append(p.clauses, `EXISTS (SELECT 1 FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL)`)
	}
	if in.HasProspects == exportFiltreFaux {
		p.clauses = append(p.clauses, `NOT EXISTS (SELECT 1 FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL)`)
	}
	if statuts := exportStatutsWhatsapp(in); statuts != nil {
		p.clauses = append(p.clauses, `r."whatsappStatus"::text = ANY(`+p.valeur(statuts)+")")
	}
	if recherche := strings.TrimSpace(in.Search); recherche != "" {
		p.clauses = append(p.clauses, `(r."fullName" ILIKE `+p.valeur("%"+recherche+"%")+
			` OR r."phoneE164" LIKE `+p.valeur("%"+exportChiffres(recherche)+"%")+")")
	}
}

// « Joignable sur WhatsApp » n'est pas un statut mais deux : le filtre par
// statut et le filtre par joignabilité se croisent, ils ne se remplacent pas.
func exportStatutsWhatsapp(in *ExportRepresentantsInput) []string {
	if in.WhatsappStatus == "" && in.HasWhatsapp == "" {
		return nil
	}
	statuts := []string{exportCleNonDemande, exportCleMemeNumero, exportCleAutreNumero, ExportCleAucun}
	if in.WhatsappStatus != "" {
		statuts = []string{in.WhatsappStatus}
	}
	if in.HasWhatsapp == "" {
		return statuts
	}
	joignable := map[string]bool{exportCleMemeNumero: true, exportCleAutreNumero: true}
	retenus := []string{}
	for _, statut := range statuts {
		if joignable[statut] == (in.HasWhatsapp == exportFiltreVrai) {
			retenus = append(retenus, statut)
		}
	}
	return retenus
}

// Bornes de date incluses, sur la colonne que porte la fiche exportée.
func exportBornes(p *exportPredicat, colonne, du, au string) error {
	for _, borne := range []struct {
		brut string
		op   string
		fin  bool
	}{{du, ">=", false}, {au, "<=", true}} {
		if borne.brut == "" {
			continue
		}
		instant, err := exportBorneDeJournee(borne.brut, borne.fin)
		if err != nil {
			return socle.Problem(http.StatusBadRequest, "BAD_REQUEST", "Date de filtre invalide : "+borne.brut)
		}
		p.ajouter(colonne, borne.op, instant)
	}
	return nil
}

type exportLigneRepresentant struct {
	ID            string
	Nom           string
	Phone         string
	Etablissement string
	Departement   string
	Ief           string
	Qualification string
	Commercial    string
	Prospects     int32
	Notes         string
	Saisi         time.Time
	Cree          time.Time
}

func (s *service) exportRepresentants(ctx context.Context, in *ExportRepresentantsInput) (*huma.StreamResponse, error) {
	u := socle.UtilisateurCourant(ctx)
	p, err := exportConditionsRepresentants(&u, in)
	if err != nil {
		return nil, err
	}
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	f, err := c.nouvelleFeuille(exportNomFeuilleRepresentants,
		[]string{ExportEnteteNomComplet, ExportEnteteTelephone, ExportEnteteEtablissement, ExportEnteteDepartement, ExportEnteteIef, ExportEnteteQualification, ExportEnteteTeleconseiller, exportEnteteProspects, ExportEnteteNotes, ExportEnteteSaisiLe, "Créé en base le"},
		[]float64{30, 20, 26, 24, 26, 20, 26, 12, 40, 20, 20}, nil)
	if err != nil {
		_ = c.f.Close()
		return nil, err
	}
	if err := s.exportEcrireRepresentants(ctx, c, f, p); err != nil {
		_ = c.f.Close()
		return nil, err
	}
	return exportReponseClasseur(c, "representants-cpi-"+s.exportDateDuJour()+".xlsx"), nil
}

const exportSelectRepresentants = `SELECT r."id", r."fullName", r."phoneE164", COALESCE(r."etablissement", '')::text, d."name", COALESCE(i."name", '')::text,
  COALESCE(sq."label", '')::text, u."fullName", (SELECT COUNT(*) FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL)::int,
  COALESCE(r."notes", '')::text, r."clientCreatedAt", r."createdAt"
FROM "representants" r
INNER JOIN "departements" d ON d."id" = r."departementId"
LEFT JOIN "iefs" i ON i."id" = r."iefId"
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
INNER JOIN "users" u ON u."id" = r."createdById"
WHERE `

func (s *service) exportEcrireRepresentants(ctx context.Context, c *exportClasseur, f *exportFeuille, p *exportPredicat) error {
	apres := ""
	for {
		args := append([]any{}, p.args...)
		clause := p.where()
		if apres != "" {
			args = append(args, apres)
			clause += ` AND r."id" > $` + strconv.Itoa(len(args))
		}
		rows, err := s.Pool.Query(ctx, exportSelectRepresentants+clause+
			` ORDER BY r."id" ASC LIMIT `+strconv.Itoa(exportTaillePage), args...)
		if err != nil {
			return err
		}
		page, err := pgx.CollectRows(rows, pgx.RowToStructByPos[exportLigneRepresentant])
		rows.Close()
		if err != nil {
			return err
		}
		for i := range page {
			l := &page[i]
			if err := f.ecrire(l.Nom, l.Phone, l.Etablissement, l.Departement, l.Ief, l.Qualification, l.Commercial, l.Prospects, l.Notes,
				excelize.Cell{StyleID: c.date, Value: l.Saisi}, excelize.Cell{StyleID: c.date, Value: l.Cree}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return f.fermer(true)
		}
		apres = page[len(page)-1].ID
	}
}

type ExportVisitesInput struct {
	From           string `query:"from"`
	To             string `query:"to"`
	EntrepriseId   string `query:"entrepriseId"`
	DirectionId    string `query:"directionId"`
	DestinataireId string `query:"destinataireId"`
	ObjetId        string `query:"objetId"`
	Search         string `query:"search" maxLength:"120"`
}

var exportEntetesVisites = []string{
	"N° REGISTRE", accueil.EnteteDate, accueil.EnteteHeure, accueil.EnteteNom, "TELEPHONES", "ENTREPRISE",
	"DIRECTION", accueil.EnteteDestinataire, "OBJET VISITE", "COMMENTAIRES / NOTES", "SAISIE LE",
}

// La ligne 2 porte toujours un rappel : le lecteur d'import saute tout ce qui
// précède la ligne 3, une ligne de moins ferait disparaître la première visite.
const exportRappelVisites = "N° REGISTRE vide = nouvelle visite. Ne renommez ni ne déplacez les colonnes."

func exportValeurFacultative(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func (s *service) exportVisites(ctx context.Context, in *ExportVisitesInput) (*huma.StreamResponse, error) {
	params := db.ExportVisitesParams{
		Entreprise: exportValeurFacultative(in.EntrepriseId), Direction: exportValeurFacultative(in.DirectionId),
		Destinataire: exportValeurFacultative(in.DestinataireId), Objet: exportValeurFacultative(in.ObjetId),
		Recherche: exportValeurFacultative(strings.TrimSpace(in.Search)),
	}
	for _, borne := range []struct {
		brut  string
		cible **time.Time
		fin   bool
	}{{in.From, &params.Du, false}, {in.To, &params.Au, true}} {
		if borne.brut == "" {
			continue
		}
		instant, err := exportBorneDeJournee(borne.brut, borne.fin)
		if err != nil {
			return nil, socle.Problem(http.StatusBadRequest, "BAD_REQUEST", "Date de filtre invalide : "+borne.brut)
		}
		*borne.cible = &instant
	}
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	if err := s.exportEcrireVisites(ctx, c, params); err != nil {
		_ = c.f.Close()
		return nil, err
	}
	return exportReponseClasseur(c, "registre-visites-cpi-"+s.exportDateDuJour()+".xlsx"), nil
}

func (s *service) exportEcrireVisites(ctx context.Context, c *exportClasseur, params db.ExportVisitesParams) error {
	// Numéro, heure et téléphone en texte : Excel réinterpréterait « 14:30 » et
	// un numéro à indicatif en nombre.
	f, err := c.nouvelleFeuille("Registre", exportEntetesVisites,
		[]float64{16, 14, 12, 32, 18, 20, 26, 34, 30, 48, 20},
		map[int]int{1: c.texte, 3: c.texte, 5: c.texte, 2: c.jour, 11: c.date})
	if err != nil {
		return err
	}
	if err := f.ecrire(excelize.Cell{StyleID: c.rappel, Value: exportRappelVisites}); err != nil {
		return err
	}
	for {
		page, err := s.Q.ExportVisites(ctx, params)
		if err != nil {
			return err
		}
		for i := range page {
			v := &page[i]
			heure := ""
			if v.TimeKnown {
				heure = v.VisitedAt.In(s.Cfg.TimeZone).Format("15:04")
			}
			jour := time.Date(v.VisitedAt.Year(), v.VisitedAt.Month(), v.VisitedAt.Day(), 0, 0, 0, 0, time.UTC)
			if err := f.ecrire(v.Reference, excelize.Cell{StyleID: c.jour, Value: jour}, heure,
				v.VisitorName, exportCelluleTexte(v.Phone), v.Entreprise, exportCelluleTexte(v.Direction),
				exportCelluleTexte(v.Destinataire), v.Objet, exportCelluleTexte(v.Comment),
				excelize.Cell{StyleID: c.date, Value: v.CreatedAt}); err != nil {
				return err
			}
		}
		if len(page) < exportTaillePage {
			return f.fermer(false)
		}
		params.Apres = &page[len(page)-1].Reference
	}
}

type exportColonneModele struct {
	entete  string
	largeur float64
	requis  bool
	aide    string
	exemple string
}

type exportListeModele struct {
	colonne int
	libelle string
	valeurs []string
}

type exportModele struct {
	feuille  string
	fichier  string
	colonnes []exportColonneModele
	listes   []exportListeModele
	regles   []string
}

const (
	exportRegleParPosition = "Ne modifiez ni l’ordre ni le nombre des colonnes : le fichier est relu par position, pas par le texte de l’en-tête."
	exportRegleParEntete   = "Les colonnes sont retrouvées par le TEXTE de leur en-tête, en ligne 1 : vous pouvez les déplacer, en intercaler d’autres, ou retirer une colonne facultative."
)

var exportReglesCommunes = []string{
	exportRegleParPosition,
	"La ligne 2 est un exemple grisé : elle n’est JAMAIS lue à l’import. Laissez-la en place et commencez votre saisie en ligne 3.",
	"Les lignes entièrement vides sont ignorées, pas comptées en erreur.",
	"L’import se fait en deux temps : une simulation qui liste les erreurs ligne par ligne, puis l’application, qui écrit.",
}

// Les erreurs d'excelize sont retenues une fois : un modèle vide se compose de
// deux cents appels dont aucun ne dépend du précédent.
type exportEcrivain struct {
	f   *excelize.File
	err error
}

func (e *exportEcrivain) faire(err error) {
	if e.err == nil {
		e.err = err
	}
}

func (e *exportEcrivain) str(feuille, cellule, valeur string) {
	e.faire(e.f.SetCellStr(feuille, cellule, valeur))
}

func (e *exportEcrivain) styler(feuille, cellule string, style int) {
	e.faire(e.f.SetCellStyle(feuille, cellule, cellule, style))
}

func exportNomColonne(rang int) string {
	nom, err := excelize.ColumnNumberToName(rang)
	if err != nil {
		return "A"
	}
	return nom
}

// Modèle d'import : trois feuilles, listes déroulantes tirées des référentiels
// vivants. Écrit en mémoire, sans flux : un modèle vide pèse quelques kilo-octets.
func exportEcrireModele(m *exportModele) (*huma.StreamResponse, error) {
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	e := &exportEcrivain{f: c.f}
	e.faire(c.f.SetSheetName("Sheet1", m.feuille))
	for i, colonne := range m.colonnes {
		nom := exportNomColonne(i + 1)
		e.faire(c.f.SetColWidth(m.feuille, nom, nom, colonne.largeur))
		e.str(m.feuille, nom+"1", colonne.entete)
		e.styler(m.feuille, nom+"1", c.entete)
		e.str(m.feuille, nom+"2", colonne.exemple)
		e.styler(m.feuille, nom+"2", c.exemple)
	}
	e.faire(c.f.SetRowHeight(m.feuille, 1, 22))
	e.faire(c.f.SetPanes(m.feuille, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: ExportVoletActif}))
	exportEcrireListes(c, e, m)
	exportEcrireInstructions(c, e, m)
	if e.err != nil {
		_ = c.f.Close()
		return nil, e.err
	}
	return exportReponseClasseur(c, m.fichier), nil
}

func exportEcrireListes(c *exportClasseur, e *exportEcrivain, m *exportModele) {
	_, err := c.f.NewSheet("Listes")
	e.faire(err)
	for i, liste := range m.listes {
		source := exportNomColonne(i + 1)
		e.str("Listes", source+"1", liste.libelle)
		for j, valeur := range liste.valeurs {
			e.str("Listes", source+strconv.Itoa(j+2), valeur)
		}
		// Un référentiel vide donnerait la plage $A$2:$A$1, qu'Excel signale en
		// ouvrant le fichier comme un classeur endommagé.
		if len(liste.valeurs) == 0 {
			continue
		}
		saisie := exportNomColonne(liste.colonne)
		dv := excelize.NewDataValidation(true)
		dv.Sqref = saisie + "2:" + saisie + "1000"
		dv.SetSqrefDropList("Listes!$" + source + "$2:$" + source + "$" + strconv.Itoa(len(liste.valeurs)+1))
		dv.ShowErrorMessage = false
		e.faire(c.f.AddDataValidation(m.feuille, dv))
	}
	e.faire(c.f.SetSheetVisible("Listes", false, true))
}

func exportEcrireInstructions(c *exportClasseur, e *exportEcrivain, m *exportModele) {
	_, err := c.f.NewSheet("Instructions")
	e.faire(err)
	for _, largeur := range []struct {
		nom string
		v   float64
	}{{"A", 22}, {"B", 14}, {"C", 90}} {
		e.faire(c.f.SetColWidth("Instructions", largeur.nom, largeur.nom, largeur.v))
	}
	for i, entete := range []string{"Colonne", "Obligatoire", "À savoir"} {
		cellule := exportNomColonne(i+1) + "1"
		e.str("Instructions", cellule, entete)
		e.styler("Instructions", cellule, c.entete)
	}
	ligne := 2
	for _, colonne := range m.colonnes {
		obligatoire := exportLibelleNon
		if colonne.requis {
			obligatoire = exportLibelleOui
		}
		e.str("Instructions", "A"+strconv.Itoa(ligne), colonne.entete)
		e.str("Instructions", "B"+strconv.Itoa(ligne), obligatoire)
		e.str("Instructions", "C"+strconv.Itoa(ligne), colonne.aide)
		ligne++
	}
	ligne++
	e.str("Instructions", "A"+strconv.Itoa(ligne), "Règles générales")
	e.styler("Instructions", "A"+strconv.Itoa(ligne), c.section)
	for _, regle := range m.regles {
		ligne++
		e.str("Instructions", "C"+strconv.Itoa(ligne), regle)
	}
}

func (s *service) exportModeleProspects(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
	banques, err := s.Q.ExportBanquesActives(ctx)
	if err != nil {
		return nil, err
	}
	syndicats, err := s.Q.ExportSyndicatsActifs(ctx)
	if err != nil {
		return nil, err
	}
	return exportEcrireModele(&exportModele{
		feuille:  exportEnteteProspects,
		fichier:  "modele-import-prospects-" + s.exportDateDuJour() + ".xlsx",
		colonnes: exportColonnesProspects,
		listes: []exportListeModele{
			{5, "Banques", banques},
			{6, "Syndicats", syndicats},
			{7, "Méthodes d’enrôlement", []string{exportLibelleRendezVous, exportLibellePlateforme, exportLibelleMail, ExportEnteteWhatsapp}},
		},
		regles: append(append([]string{}, exportReglesCommunes...),
			"Le téléphone du prospect est la clé de déduplication : un numéro déjà en base, ou répété dans le fichier, est signalé et non écrit.",
			"Ce fichier ne crée AUCUN représentant. Chaque « Téléphone du représentant » doit déjà exister : importez les représentants d’abord.",
			"Banque et Syndicat se choisissent dans la liste déroulante. Leur croisement détermine le segment BDD de la fiche : une valeur saisie à la main range la ligne dans le mauvais segment, ou la fait refuser."),
	})
}

func (s *service) exportModeleRepresentants(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
	departements, err := s.Q.ExportDepartementsActifs(ctx)
	if err != nil {
		return nil, err
	}
	iefs, err := s.Q.ExportIefsActives(ctx)
	if err != nil {
		return nil, err
	}
	return exportEcrireModele(&exportModele{
		feuille: exportNomFeuilleRepresentants,
		fichier: "modele-import-representants-" + s.exportDateDuJour() + ".xlsx",
		colonnes: []exportColonneModele{
			{ExportEnteteNomComplet, 30, true, "Nom et prénom du représentant, tels qu’il se présente. 2 caractères au minimum.", "Fatou Ndiaye"},
			{ExportEnteteTelephone, 20, true, "Toutes les présentations sont admises : 77 123 45 67, +221 77 123 45 67, 00221771234567. Le serveur normalise. C’est ce numéro qui sert à repérer les doublons.", exportExempleTelephone},
			{ExportEnteteDepartement, 24, true, "Choisir dans la liste déroulante. Les accents et la casse sont sans importance, l’orthographe non.", "Dakar"},
			{ExportEnteteIef, 26, false, "Facultative. Si elle est renseignée, elle doit appartenir au département de la colonne précédente.", "IEF Almadies"},
			{ExportEnteteNotes, 40, false, "Facultatif. Contexte libre : horaires d’appel, personne à mentionner.", "Rappeler après 16 h"},
			{ExportEnteteEtablissement, 32, false, "Facultatif. L’établissement où il exerce. Ni l’IEF, qui est une circonscription, ni le département.", "Lycée Blaise Diagne"},
			{"Statut relation", 20, false, "Facultatif. Non qualifié, Contacté, Accepté ou Refusé. Vide vaut Non qualifié, c’est-à-dire « à appeler ».", "Inconnu"},
			{ExportEnteteWhatsapp, 20, false, "Facultatif. Non demandé, Même numéro, Autre numéro ou Aucun. « Non demandé » et « Aucun » ne sont pas la même chose : le premier veut dire que la question n’a pas été posée.", ExportLibelleNonDemande},
			{"Chargé de compte", 26, false, "Facultatif. Le compte à qui la fiche appartient : identifiant, e-mail ou nom complet. Vide, la fiche revient au compte qui importe.", "khadim"},
			{"Date du dernier appel", 22, false, "Facultatif. JJ/MM/AAAA. Renseignée, elle enregistre un appel à cette date, au nom du chargé de compte : la fiche cesse de repartir dans la file comme jamais appelée.", "18/08/2026"},
			{"Issue du dernier appel", 24, false, "Facultatif, et sans effet sans la date qui précède. Joint, Injoignable, Refus, Faux numéro ou Autre. Vide vaut Joint.", ExportLibelleJoint},
		},
		listes: []exportListeModele{
			{3, "Départements", departements},
			{4, ExportEnteteIef, iefs},
			{7, "Relations", []string{"Non qualifié", exportLibelleContacte, ExportLibelleAccepte, exportLibelleRefuse}},
			{8, ExportEnteteWhatsapp, []string{ExportLibelleNonDemande, "Même numéro", ExportLibelleAutreNumero, exportLibelleAucun}},
			{11, "Issues", []string{ExportLibelleJoint, ExportLibelleInjoignable, ExportLibelleRefus, "Faux numéro", ExportLibelleAutre}},
		},
		regles: append(append([]string{}, exportReglesCommunes...),
			"Le téléphone est la clé de déduplication : un numéro déjà en base, ou répété dans le fichier, est signalé et non écrit."),
	})
}

func (s *service) exportModeleGrandPublic(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
	listes, err := s.exportListesGrandPublic(ctx)
	if err != nil {
		return nil, err
	}
	regles := []string{exportRegleParEntete}
	for _, regle := range exportReglesCommunes {
		if regle != exportRegleParPosition {
			regles = append(regles, regle)
		}
	}
	return exportEcrireModele(&exportModele{
		feuille:  "Prospects Grand Public",
		fichier:  "modele-import-prospects-grand-public-" + s.exportDateDuJour() + ".xlsx",
		colonnes: exportColonnesGrandPublic,
		listes:   listes,
		regles: append(regles,
			"Seuls le Nom et le Téléphone sont exigés. Une cellule vide n’est pas une erreur : c’est une information qu’on n’a pas encore, et la ligne est écrite quand même.",
			"Le téléphone est la clé de déduplication, tous projets confondus : un numéro déjà porté par une fiche, CHUES comprise, est signalé et non écrit.",
			"« Fonctionnaire » à « oui » range la fiche en FONCTIONNAIRE. À « non », le type reste VIDE : le fichier ne dit pas s’il s’agit du secteur privé, de l’informel ou de la diaspora, et rien ne se devine ici.",
			"Les dix dernières colonnes décrivent la situation. Un employeur hors liste est conservé en clair ; un pays de résidence hors liste refuse la ligne, car il désigne une entrée de référentiel qui ne se crée pas à l’import.",
			"Un export de campagne garde ses propres colonnes : une colonne « Nom complet » remplace Prénom et Nom, son dernier mot faisant le nom de famille, une colonne « Email » est reprise sur la fiche, et une colonne « Date » devient la date de saisie du lead. Une page d’atterrissage ou un nom de campagne en colonne de provenance est traduit par les règles de provenance."),
	})
}

func (s *service) exportListesGrandPublic(ctx context.Context) ([]exportListeModele, error) {
	syndicats, err := s.Q.ExportSyndicatsActifs(ctx)
	if err != nil {
		return nil, err
	}
	banques, err := s.Q.ExportBanquesActives(ctx)
	if err != nil {
		return nil, err
	}
	canaux, err := s.Q.ExportCanauxActifs(ctx)
	if err != nil {
		return nil, err
	}
	employeurs, err := s.Q.ExportEmployeursActifs(ctx)
	if err != nil {
		return nil, err
	}
	pays, err := s.Q.ExportPaysActifs(ctx)
	if err != nil {
		return nil, err
	}
	return []exportListeModele{
		{5, "Syndicats", syndicats},
		{6, "Banques", banques},
		{7, exportLibelleFonctionnaire, []string{exportLibelleOui, exportLibelleNon}},
		{9, "Canaux de provenance", canaux},
		{10, "Employeurs", employeurs},
		{11, "Types de contrat", []string{exportLibelleCdi, exportLibelleCdd, ExportLibelleAutre}},
		{14, "Modes d’épargne", []string{exportLibelleTontine, "Mobile money", exportEnteteBanque, exportLibelleAucun}},
		{15, "Pays", pays},
	}, nil
}

// L'import reconnaît la ligne d'exemple du modèle pour la sauter : ses colonnes
// doivent rester dans l'ordre du modèle.
func ExemplesGrandPublic() []string { return exemplesModele(exportColonnesGrandPublic) }

func ExemplesProspects() []string { return exemplesModele(exportColonnesProspects) }

func exemplesModele(colonnes []exportColonneModele) []string {
	exemples := make([]string, len(colonnes))
	for i, colonne := range colonnes {
		exemples[i] = colonne.exemple
	}
	return exemples
}

var exportColonnesProspects = []exportColonneModele{
	{ExportEnteteNom, 24, true, "Nom de famille SEUL. Ne mettez pas le nom et le prénom dans la même cellule : le serveur ne les découpe pas.", "Ndiaye"},
	{ExportEntetePrenom, 24, true, "Prénom SEUL, prénoms composés compris. Colonne distincte du nom, volontairement.", "Aminata"},
	{ExportEnteteTelephone, 20, true, "Toutes les présentations sont admises : 77 123 45 67, +221 77 123 45 67, 00221771234567. Le serveur normalise. C’est ce numéro qui sert à repérer les doublons.", exportExempleTelephone},
	{"Téléphone du représentant", 26, true, "Numéro du représentant qui a apporté le prospect. Le représentant doit DÉJÀ exister : importez d’abord les représentants, ce fichier n’en crée aucun.", "76 987 65 43"},
	{exportEnteteBanque, 18, true, "Nom court de la banque, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.", ExportCleCbao},
	{ExportEnteteSyndicat, 18, true, "Sigle du syndicat, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.", exportCleChues},
	{ExportEnteteMethodeEnrolement, 32, false, "Facultative. À remplir uniquement si l’enrôlement a DÉJÀ eu lieu : choisir dans la liste déroulante. Laissée vide, la fiche part en attente d’appel.", exportLibellePlateforme},
}

var exportColonnesGrandPublic = []exportColonneModele{
	{ExportEntetePrenom, 22, false, "Facultatif. Prénom SEUL, prénoms composés compris. Colonne distincte du nom.", "Aminata"},
	{ExportEnteteNom, 22, true, "Obligatoire. Nom de famille SEUL : le serveur ne découpe pas un nom complet.", "Ndiaye"},
	{ExportEnteteTelephone, 20, true, "Obligatoire. 77 123 45 67, +221 77 123 45 67 et 00221771234567 sont tous lus. C’est ce numéro qui sert à repérer les doublons.", exportExempleTelephone},
	{ExportEnteteProfession, 26, false, "Facultative. Texte libre, tel que la personne l’a déclaré. 120 caractères au plus.", "Couturière"},
	{ExportEnteteSyndicat, 18, false, "Facultatif, et vide pour l’écrasante majorité des fiches Grand Public. Rempli, il doit être repris de la liste déroulante.", ""},
	{"Banque de domiciliation", 24, false, "Facultative. Rempli, le nom court doit être repris de la liste déroulante : c’est lui qui, croisé au syndicat, donne le segment BDD.", ExportCleCbao},
	{"Fonctionnaire (oui/non)", 22, false, "Facultative. « Oui » range la fiche en FONCTIONNAIRE. « Non » dit seulement ce que la personne n’est pas : le type reste vide, il ne se devine pas entre secteur privé, informel et diaspora.", exportLibelleOui},
	{"Durée système", 18, false, "Facultative. Un nombre de MOIS, entier, de 1 à 300. « 24 » et « 24 mois » sont lus ; « 2 ans » ne l’est pas.", "24"},
	{ExportEnteteCanalProvenance, 26, false, "Facultatif. Rempli, il doit être repris de la liste déroulante, tirée des canaux du jour.", "TikTok"},
	{FormulaireLibelleEmployeur, 28, false, "Facultatif. Repris de la liste déroulante, il rattache la fiche au référentiel ; sinon la valeur est conservée telle quelle, en clair.", "Ministère de l’Éducation nationale"},
	{ExportEnteteTypeContrat, 18, false, "Facultatif. CDI, CDD, Autre, ou cellule vide.", exportLibelleCdi},
	{ExportEnteteAnciennete, 18, false, "Facultative. Ancienneté chez l’employeur, en MOIS, de 0 à 840. À ne pas confondre avec « Durée système », qui est la durée du plan de paiement.", "36"},
	{ExportEnteteLieuActivite, 26, false, "Facultatif. Pour l’informel : marché, quartier ou lieu où il exerce.", "Marché Sandaga"},
	{ExportEnteteModeEpargne, 20, false, "Facultatif. Tontine, Mobile money, Banque, Aucun, ou cellule vide.", exportLibelleTontine},
	{ExportEntetePaysResidence, 24, false, "Facultatif. Nom du pays en français ou code ISO à deux lettres (IT, FR…). Un pays hors référentiel refuse la ligne : il ne se crée pas à l’import.", "Italie"},
	{ExportEnteteVilleResidence, 22, false, "Facultative. Ville de résidence, pour la diaspora.", "Milan"},
	{ExportEnteteWhatsapp, 22, false, "Facultatif. Souvent INTERNATIONAL et distinct du numéro principal : écrivez-le avec son indicatif, « +39 320 111 22 33 ». Sans indicatif, il est lu comme sénégalais.", "+39 320 111 22 33"},
	{"Nom du relais", 24, false, "Facultatif. Personne à contacter au Sénégal pour un prospect de la diaspora.", "Awa Diop"},
	{"Téléphone du relais", 22, false, "Facultatif. Numéro sénégalais du relais, lu comme la colonne Téléphone.", "77 000 00 11"},
}

// Vocabulaire que les exports partagent avec les imports et les écrans.
const (
	ColonneDepartementNom      = `d."name"`
	BanqueColonneMontant       = `c."amountXof"`
	LotEtatARappeler           = "A_RAPPELER"
	FormulaireLibelleEmployeur = "Employeur"
)
