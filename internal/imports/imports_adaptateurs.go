package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"
)

var adaptateursImport = map[db.ImportKind]adaptateurImport{
	db.ImportKindREPRESENTANTS: {
		maxLignes: 50_000, colonnes: ColonnesRepresentantsImport,
		preparer: preparerRepresentantsImport, lire: lireRepresentantImport, ecrire: ecrireRepresentantsImport,
	},
	db.ImportKindPROSPECTS: {
		maxLignes: 150_000, colonnes: colonnesProspectsImport,
		preparer: preparerProspectsImport, lire: lireProspectImport, ecrire: ecrireProspectsImport,
	},
	db.ImportKindPROSPECTSGRANDPUBLIC: {
		maxLignes: 50_000, colonnes: colonnesGrandPublicImport,
		feuilles: &dispositionFeuilleImport{ligneEntete: 1},
		preparer: preparerGrandPublicImport, lire: lireGrandPublicImport, ecrire: ecrireGrandPublicImport,
	},
	db.ImportKindVISITES: {
		maxLignes: 20_000, colonnes: colonnesVisitesImport,
		feuilles: &dispositionFeuilleImport{motif: regexp.MustCompile(`(?i)BDD VISITES`), ligneEntete: 3},
		preparer: preparerVisitesImport, lire: lireVisiteImport, ecrire: ecrireVisitesImport,
	},
}

// ------------------------------------------------------------------ communs

// Les lectures de dédoublonnage filtrent sur une liste de numéros : la colonne
// est nullable, la valeur lue ne l'est jamais.
func telephoneConnuImport(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

// « SAINT-LOUIS », « Saint Louis » et « saint  louis » tombent sur la même clé.
func cleImport(valeur string) string {
	var sortie strings.Builder
	espace := false
	for _, r := range norm.NFD.String(valeur) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		r = unicode.ToLower(r)
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if espace && sortie.Len() > 0 {
				sortie.WriteByte(' ')
			}
			espace = false
			sortie.WriteRune(r)
			continue
		}
		espace = true
	}
	return sortie.String()
}

// Sigles : seules la casse et les espaces s'effacent. « BNDE » et « B.N.D.E. »
// peuvent désigner deux entrées distinctes, et le couple banque/syndicat EST le
// segment BDD.
func cleReferentielImport(valeur string) string {
	return strings.ToUpper(espacesRepetesImport.ReplaceAllString(strings.TrimSpace(valeur), " "))
}

func valeursAdmisesImport(valeurs []string) string {
	const maximum = 20
	if len(valeurs) > maximum {
		return fmt.Sprintf(messageValeursTronqueesImport, strings.Join(valeurs[:maximum], ", "), len(valeurs))
	}
	return strings.Join(valeurs, ", ")
}

func couperImport(valeur string, maximum int) *string {
	if valeur == "" {
		return nil
	}
	runes := []rune(valeur)
	if len(runes) > maximum {
		valeur = string(runes[:maximum])
	}
	return &valeur
}

func refusImport(ligne int, colonne, code, message string) *erreurLigneImport {
	return &erreurLigneImport{RowNumber: ligne, Column: &colonne, Code: code, Message: message}
}

func lotsImport(valeurs []string) [][]string {
	var lots [][]string
	for debut := 0; debut < len(valeurs); debut += lotTelephonesImport {
		fin := min(debut+lotTelephonesImport, len(valeurs))
		lots = append(lots, valeurs[debut:fin])
	}
	return lots
}

// La SECONDE occurrence est rejetée, jamais la première : c'est celle du haut du
// fichier que l'utilisateur reconnaît.
func doublonsDansLeFichierImport(lignes []any, vus map[string]int, cle func(any) (string, int),
	colonne, code string,
) (uniques []any, ignorees int, erreurs []erreurLigneImport) {
	for _, ligne := range lignes {
		telephone, numero := cle(ligne)
		// Sans clé, pas de doublon possible : la fiche n'a rien à quoi se comparer.
		if telephone == "" {
			uniques = append(uniques, ligne)
			continue
		}
		if precedente, deja := vus[telephone]; deja {
			ignorees++
			erreurs = append(erreurs, *refusImport(numero, colonne, code, fmt.Sprintf(messageDoublonFichierImport, precedente)))
			continue
		}
		vus[telephone] = numero
		uniques = append(uniques, ligne)
	}
	return uniques, ignorees, erreurs
}

func identifiantImport() string {
	id, err := uuid.NewV7()
	if err != nil {
		return uuid.NewString()
	}
	return id.String()
}

type entreeReferentielImport struct {
	id, libelle string
}

// Libellés partagés par plusieurs colonnes ou tables de correspondance.
const (
	enteteTelephoneImport     = "Téléphone"
	enteteWhatsappImport      = "WhatsApp"
	enteteCreeLeImport        = "Créé"
	enteteCourrielImport      = "Adresse e-mail"
	enteteEtapeImport         = "Étape"
	libelleAEvaluerImport     = "À évaluer"
	libelleQualifieImport     = "Qualifié"
	libelleAucunImport        = "Aucun"
	libelleAutreImport        = "Autre"
	libelleBanqueImport       = "Banque"
	libelleCDDImport          = "CDD"
	libelleCDIImport          = "CDI"
	attenduEntrepriseImport   = "entreprise"
	attenduDirectionImport    = "direction"
	attenduDestinataireImport = "destinataire"
	modeMobileMoneyImport     = "MOBILE_MONEY"
	attenduObjetImport        = "objet"
)

// ------------------------------------------------------------ représentants

var ColonnesRepresentantsImport = []colonneImport{
	{entete: exports.ExportEnteteNomComplet, requise: true},
	{entete: enteteTelephoneImport, requise: true},
	{entete: exports.ExportEnteteDepartement, requise: true},
	{entete: exports.ExportEnteteIef},
	{entete: exports.ExportEnteteNotes},
	{entete: exports.ExportEnteteEtablissement},
	{entete: "Statut relation"},
	{entete: enteteWhatsappImport},
	{entete: "Chargé de compte"},
	{entete: "Date du dernier appel"},
	{entete: "Issue du dernier appel"},
}

func EnteteRepresentantImport(rang int) string { return ColonnesRepresentantsImport[rang].entete }

var (
	relationsImport = tableLibellesImport(map[string]string{
		exports.ExportLibelleNonQualifie: string(db.RepresentantRelationINCONNU), "Contacté": string(db.RepresentantRelationCONTACTE),
		exports.ExportLibelleAccepte: string(db.RepresentantRelationAMBASSADEUR), "Refusé": string(db.RepresentantRelationREFUS),
	})
	whatsappImport = tableLibellesImport(map[string]string{
		exports.ExportLibelleNonDemande: string(db.WhatsappStatusNONDEMANDE), exports.ExportLibelleMemeNumero: string(db.WhatsappStatusMEMENUMERO),
		exports.ExportLibelleAutreNumero: string(db.WhatsappStatusAUTRENUMERO), libelleAucunImport: string(db.WhatsappStatusAUCUN),
	})
	issuesImport = tableLibellesImport(map[string]string{
		exports.ExportLibelleJoint: exports.IssueJointImport, exports.ExportLibelleInjoignable: string(db.CallOutcomeUNREACHABLE), exports.ExportLibelleRefus: exports.ExportCleRefus,
		exports.ExportLibelleFauxNumero: exports.ExportCleMauvaisNumero, libelleAutreImport: string(db.CallOutcomeOTHER),
	})
	jourMoisAnImport = regexp.MustCompile(`^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$`)
	anMoisJourImport = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})`)
)

// Le nom de l'énumération est toujours accepté : un fichier réexporté depuis la
// base porte `AMBASSADEUR` et non « Accepté ».
func tableLibellesImport(entrees map[string]string) map[string]string {
	table := make(map[string]string, len(entrees)*2)
	for libelle, valeur := range entrees {
		table[cleImport(libelle)] = valeur
		table[cleImport(valeur)] = valeur
	}
	return table
}

type appelImportRep struct {
	date        time.Time
	issue       db.RepCallOutcome
	commentaire *string
}

type ligneRepresentantImport struct {
	numero                        int
	nom, telephone, departementID string
	iefID, notes, etablissement   *string
	relation                      db.RepresentantRelation
	whatsapp                      db.WhatsappStatus
	proprietaireID                *string
	appel                         *appelImportRep
}

type etatRepresentantsImport struct {
	region       string
	vus          map[string]int
	departements map[string]entreeReferentielImport
	iefs         map[string]iefImport
	comptes      map[string]string
}

type iefImport struct {
	id, nom, departementID string
}

// Les référentiels sont relus à CHAQUE course : un département activé ce matin
// doit être accepté par l'import de cet après-midi.
func preparerRepresentantsImport(ctx context.Context, q *db.Queries, c contexteImport) (any, error) {
	departements, err := q.ImportDepartements(ctx)
	if err != nil {
		return nil, err
	}
	iefs, err := q.ImportIefs(ctx)
	if err != nil {
		return nil, err
	}
	comptes, err := q.ImportComptes(ctx)
	if err != nil {
		return nil, err
	}
	etat := &etatRepresentantsImport{
		region: c.region, vus: map[string]int{},
		departements: map[string]entreeReferentielImport{}, iefs: map[string]iefImport{}, comptes: map[string]string{},
	}
	for _, ligne := range departements {
		entree := entreeReferentielImport{id: ligne.ID, libelle: ligne.Name}
		etat.departements[cleImport(ligne.Name)] = entree
		etat.departements[cleImport(ligne.Code)] = entree
	}
	for _, ligne := range iefs {
		entree := iefImport{id: ligne.ID, nom: ligne.Name, departementID: ligne.DepartementId}
		etat.iefs[cleImport(ligne.Name)] = entree
		etat.iefs[cleImport(ligne.Code)] = entree
	}
	// Identifiant, e-mail ET nom complet : le classeur terrain désigne les
	// chargés de compte par leur prénom d'usage.
	for _, ligne := range comptes {
		for _, cle := range []string{cleImport(ligne.Username), cleImport(ligne.Email), cleImport(ligne.FullName)} {
			if cle != "" {
				etat.comptes[cle] = ligne.ID
			}
		}
	}
	return etat, nil
}

func lireRepresentantImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatRepresentantsImport)
	notes := cellules[EnteteRepresentantImport(4)]

	relation, refus := lireRelationImport(cellules[EnteteRepresentantImport(6)], numero)
	if refus != nil {
		return nil, refus
	}
	whatsapp, refus := lireWhatsappImport(cellules[EnteteRepresentantImport(7)], numero)
	if refus != nil {
		return nil, refus
	}
	proprietaire, refus := lireProprietaireImport(cellules[EnteteRepresentantImport(8)], numero, etat)
	if refus != nil {
		return nil, refus
	}
	appel, refus := lireAppelImport(cellules, notes, numero)
	if refus != nil {
		return nil, refus
	}

	nom := cellules[EnteteRepresentantImport(0)]
	if len([]rune(nom)) < 2 {
		return nil, refusImport(numero, EnteteRepresentantImport(0), "NAME_INVALID", "Le nom complet est obligatoire (2 caractères au minimum).")
	}
	telephone, err := database.NormaliserTelephone(cellules[EnteteRepresentantImport(1)], etat.region)
	if err != nil {
		return nil, refusImport(numero, EnteteRepresentantImport(1), "PHONE_INVALID", "Numéro de téléphone inexploitable.")
	}
	departement, connu := etat.departements[cleImport(cellules[EnteteRepresentantImport(2)])]
	if !connu {
		return nil, refusImport(numero, EnteteRepresentantImport(2), "DEPARTEMENT_UNKNOWN", "Département inconnu. Reprenez exactement un libellé de la liste déroulante.")
	}
	ief, refus := lireIefImport(cellules[EnteteRepresentantImport(3)], departement, numero, etat)
	if refus != nil {
		return nil, refus
	}

	ligne := ligneRepresentantImport{
		numero: numero, nom: string([]rune(nom)[:min(160, len([]rune(nom)))]), telephone: telephone,
		departementID: departement.id, notes: couperImport(notes, 2_000),
		etablissement: couperImport(cellules[EnteteRepresentantImport(5)], 200),
		relation:      relation, whatsapp: whatsapp, proprietaireID: proprietaire, appel: appel,
	}
	if ief != nil {
		ligne.iefID = &ief.id
	}
	return ligne, nil
}

func lireRelationImport(brut string, numero int) (db.RepresentantRelation, *erreurLigneImport) {
	if strings.TrimSpace(brut) == "" {
		return db.RepresentantRelationINCONNU, nil
	}
	valeur, connu := relationsImport[cleImport(brut)]
	if !connu {
		return "", refusImport(numero, EnteteRepresentantImport(6), "RELATION_UNKNOWN", "Statut de relation inconnu. Inconnu, Contacté, Ambassadeur ou Refus.")
	}
	return db.RepresentantRelation(valeur), nil
}

// « Autre numéro » est refusé : le schéma exige alors un `whatsappE164` que le
// modèle ne porte pas.
func lireWhatsappImport(brut string, numero int) (db.WhatsappStatus, *erreurLigneImport) {
	if strings.TrimSpace(brut) == "" {
		return db.WhatsappStatusNONDEMANDE, nil
	}
	valeur, connu := whatsappImport[cleImport(brut)]
	if !connu || valeur == "AUTRE_NUMERO" {
		return "", refusImport(numero, EnteteRepresentantImport(7), "WHATSAPP_UNKNOWN",
			"Statut WhatsApp inconnu. Non demandé, Même numéro ou Aucun. « Autre numéro » ne s’importe pas : le second numéro n’a pas de colonne.")
	}
	return db.WhatsappStatus(valeur), nil
}

func lireProprietaireImport(brut string, numero int, etat *etatRepresentantsImport) (*string, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	identifiant, connu := etat.comptes[cleImport(brut)]
	if !connu {
		return nil, refusImport(numero, EnteteRepresentantImport(8), "OWNER_UNKNOWN", "Chargé de compte introuvable. Identifiant, e-mail ou nom complet d’un compte actif.")
	}
	return &identifiant, nil
}

// Le département se DÉDUIT de l'IEF, jamais l'inverse.
func lireIefImport(brut string, departement entreeReferentielImport, numero int, etat *etatRepresentantsImport) (*iefImport, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	ief, connu := etat.iefs[cleImport(brut)]
	if !connu {
		return nil, refusImport(numero, EnteteRepresentantImport(3), "IEF_UNKNOWN", "IEF inconnue. Laissez la cellule vide si elle n’est pas connue.")
	}
	if ief.departementID != departement.id {
		return nil, refusImport(numero, EnteteRepresentantImport(3), "IEF_DEPARTEMENT_MISMATCH",
			fmt.Sprintf("L’IEF « %s » n’appartient pas au département « %s ».", ief.nom, departement.libelle))
	}
	return &ief, nil
}

// L'issue ne vaut rien sans sa date : `clientCreatedAt` est obligatoire, et
// l'inventer daterait l'appel du jour de l'import.
func lireAppelImport(cellules map[string]string, notes string, numero int) (*appelImportRep, *erreurLigneImport) {
	brutDate := cellules[EnteteRepresentantImport(9)]
	brutIssue := cellules[EnteteRepresentantImport(10)]
	date, lisible := lireDateAppelImport(brutDate)
	if brutDate != "" && !lisible {
		return nil, refusImport(numero, EnteteRepresentantImport(9), "CALL_DATE_INVALID", "Date du dernier appel illisible ou dans le futur. Format JJ/MM/AAAA.")
	}
	if brutIssue != "" && !lisible {
		return nil, refusImport(numero, EnteteRepresentantImport(9), "CALL_DATE_MISSING", "Une issue d’appel sans date d’appel ne s’enregistre pas. Renseignez la date.")
	}
	if !lisible {
		return nil, nil
	}
	issue := exports.IssueJointImport
	if strings.TrimSpace(brutIssue) != "" {
		valeur, connu := issuesImport[cleImport(brutIssue)]
		if !connu {
			return nil, refusImport(numero, EnteteRepresentantImport(10), "CALL_OUTCOME_UNKNOWN", "Issue d’appel inconnue. Joint, Injoignable, Refus, Faux numéro ou Autre.")
		}
		issue = valeur
	}
	commentaire := couperImport(strings.TrimSpace(notes), 2_000)
	// Même règle qu'en base : `rep_call_attempts_other_requires_comment`.
	if issue == "OTHER" && commentaire == nil {
		return nil, refusImport(numero, EnteteRepresentantImport(10), "CALL_COMMENT_REQUIRED", "L’issue « Autre » exige une note : sans elle, l’appel n’apprend rien.")
	}
	return &appelImportRep{date: date, issue: db.RepCallOutcome(issue), commentaire: commentaire}, nil
}

// Minuit UTC : Dakar est à UTC+0 toute l'année, une conversion de fuseau ferait
// glisser la date d'un jour sur une machine européenne.
func lireDateAppelImport(brut string) (time.Time, bool) {
	texte := strings.TrimSpace(brut)
	var annee, mois, jour int
	switch parts := jourMoisAnImport.FindStringSubmatch(texte); {
	case parts != nil:
		jour, mois, annee = atoiImport(parts[1]), atoiImport(parts[2]), atoiImport(parts[3])
	default:
		parts = anMoisJourImport.FindStringSubmatch(texte)
		if parts == nil {
			return time.Time{}, false
		}
		annee, mois, jour = atoiImport(parts[1]), atoiImport(parts[2]), atoiImport(parts[3])
	}
	date := time.Date(annee, time.Month(mois), jour, 0, 0, 0, 0, time.UTC)
	if date.Year() != annee || int(date.Month()) != mois || date.Day() != jour || date.After(time.Now()) {
		return time.Time{}, false
	}
	return date, true
}

func atoiImport(valeur string) int {
	n, _ := strconv.Atoi(valeur)
	return n
}

func ecrireRepresentantsImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	etat := brut.(*etatRepresentantsImport)
	uniques, ignorees, erreurs := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) {
			return v.(ligneRepresentantImport).telephone, v.(ligneRepresentantImport).numero
		},
		EnteteRepresentantImport(1), "DUPLICATE_IN_FILE")

	connus := map[string]bool{}
	for _, lot := range lotsImport(telephonesRepresentantsImport(uniques)) {
		trouves, err := q.ImportTelephonesRepresentantsConnus(ctx, lot)
		if err != nil {
			return bilanTrancheImport{}, err
		}
		for _, telephone := range trouves {
			connus[telephone] = true
		}
	}

	var retenues []ligneRepresentantImport
	for _, valeur := range uniques {
		ligne := valeur.(ligneRepresentantImport)
		if connus[ligne.telephone] {
			ignorees++
			erreurs = append(erreurs, *refusImport(ligne.numero, EnteteRepresentantImport(1), "DUPLICATE_IN_DATABASE", "Un représentant porte déjà ce numéro en base."))
			continue
		}
		retenues = append(retenues, ligne)
	}

	// `created` en simulation compte les fiches qui SERAIENT créées : c'est la
	// réponse à « combien de fiches vais-je obtenir ».
	if !c.appliquer || len(retenues) == 0 {
		return bilanTrancheImport{crees: boolIntImport(!c.appliquer) * len(retenues), ignorees: ignorees, erreurs: erreurs}, nil
	}
	ecrits, refus, err := persisterRepresentantsImport(ctx, q, c, retenues)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: ecrits, ignorees: ignorees + len(retenues) - ecrits, erreurs: append(erreurs, refus...)}, nil
}

func telephonesRepresentantsImport(lignes []any) []string {
	telephones := make([]string, 0, len(lignes))
	for _, valeur := range lignes {
		telephones = append(telephones, valeur.(ligneRepresentantImport).telephone)
	}
	return telephones
}

func boolIntImport(vrai bool) int {
	if vrai {
		return 1
	}
	return 0
}

func persisterRepresentantsImport(ctx context.Context, q *db.Queries, c contexteImport,
	retenues []ligneRepresentantImport,
) (crees int, refus []erreurLigneImport, err error) {
	maintenant := time.Now()
	identifiants := make([]string, len(retenues))
	fiches := make([]db.InsertImportRepresentantParams, len(retenues))
	for i := range retenues {
		ligne := &retenues[i]
		identifiants[i] = identifiantImport()
		proprietaire := c.demandeur
		if ligne.proprietaireID != nil {
			proprietaire = *ligne.proprietaireID
		}
		fiches[i] = db.InsertImportRepresentantParams{
			ID: identifiants[i], FullName: ligne.nom, PhoneE164: ligne.telephone,
			DepartementID: ligne.departementID, IefID: ligne.iefID, Notes: ligne.notes,
			Etablissement: ligne.etablissement, RelationStatus: ligne.relation,
			WhatsappStatus: ligne.whatsapp, CreatedByID: proprietaire, ClientCreatedAt: maintenant,
		}
	}
	if err := executerLotImport(q.InsertImportRepresentant(ctx, fiches).Exec); err != nil {
		return 0, nil, err
	}
	// Relecture obligatoire : `ON CONFLICT DO NOTHING` écarte en silence.
	ecrits, err := q.ImportIdentifiantsEcrits(ctx, identifiants)
	if err != nil {
		return 0, nil, err
	}
	presents := map[string]bool{}
	for _, identifiant := range ecrits {
		presents[identifiant] = true
	}
	if err := ecrireAppelsRepresentantsImport(ctx, q, c, retenues, identifiants, presents); err != nil {
		return 0, nil, err
	}
	if len(ecrits) >= len(retenues) {
		return len(ecrits), nil, nil
	}
	perdues := len(retenues) - len(ecrits)
	return len(ecrits), []erreurLigneImport{{
		RowNumber: retenues[0].numero, Code: "SKIPPED_ON_WRITE",
		Message: fmt.Sprintf("%d ligne(s) retenue(s) n’ont pas été écrites : leur numéro a été pris par une autre saisie pendant l’import.", perdues),
	}}, nil
}

// Un appel rattaché à une fiche écartée ferait échouer la tranche entière sur la
// clé étrangère.
func ecrireAppelsRepresentantsImport(ctx context.Context, q *db.Queries, c contexteImport,
	retenues []ligneRepresentantImport, identifiants []string, presents map[string]bool,
) error {
	var appels []db.InsertImportRepCallAttemptParams
	for i := range retenues {
		ligne := &retenues[i]
		if ligne.appel == nil || !presents[identifiants[i]] {
			continue
		}
		auteur := c.demandeur
		if ligne.proprietaireID != nil {
			auteur = *ligne.proprietaireID
		}
		appels = append(appels, db.InsertImportRepCallAttemptParams{
			ID: identifiantImport(), RepresentantID: identifiants[i], PerformedByID: auteur,
			Outcome: ligne.appel.issue, Comment: ligne.appel.commentaire, ClientCreatedAt: ligne.appel.date,
		})
	}
	if len(appels) == 0 {
		return nil
	}
	return executerLotImport(q.InsertImportRepCallAttempt(ctx, appels).Exec)
}

func executerLotImport(exec func(func(int, error))) error {
	var premiere error
	exec(func(_ int, err error) {
		if err != nil && premiere == nil {
			premiere = err
		}
	})
	return premiere
}

// ---------------------------------------------------------------- prospects

var colonnesProspectsImport = []colonneImport{
	{entete: exports.ExportEnteteNom, requise: true},
	{entete: exports.ExportEntetePrenom, requise: true},
	{entete: enteteTelephoneImport, requise: true},
	{entete: "Téléphone du représentant", requise: true},
	{entete: libelleBanqueImport, requise: true},
	{entete: exports.ExportEnteteSyndicat, requise: true},
	{entete: exports.ExportEnteteMethodeEnrolement},
}

func enteteProspectImport(rang int) string { return colonnesProspectsImport[rang].entete }

var (
	methodesEnrolementImport = map[string]string{
		"rdv cpi": string(db.EnrollmentMethodAPPOINTMENT), "appointment": string(db.EnrollmentMethodAPPOINTMENT),
		"plateforme en ligne": string(db.EnrollmentMethodPLATFORM), "platform": string(db.EnrollmentMethodPLATFORM),
		"mail": string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING), "voice or electronic messaging": string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING),
		"whatsapp": string(db.EnrollmentMethodWHATSAPP),
	}
	libellesEnrolementImport = []string{"RDV CPI", "Plateforme en ligne", "Mail", exports.ExportEnteteWhatsapp}
)

type ligneProspectImport struct {
	numero                                 int
	nom, prenom, telephone, representantID string
	banqueID, syndicatID                   string
	methode                                *db.EnrollmentMethod
}

type etatProspectsImport struct {
	region         string
	vus            map[string]int
	banques        map[string]string
	banqueLabels   []string
	syndicats      map[string]string
	syndicatLabels []string
	representants  map[string]string
}

func preparerProspectsImport(ctx context.Context, q *db.Queries, c contexteImport) (any, error) {
	banques, syndicats, err := referentielsBancairesImport(ctx, q)
	if err != nil {
		return nil, err
	}
	representants, err := q.ImportRepresentantsParTelephone(ctx)
	if err != nil {
		return nil, err
	}
	etat := &etatProspectsImport{
		region: c.region, vus: map[string]int{},
		banques: banques.index, banqueLabels: banques.libelles,
		syndicats: syndicats.index, syndicatLabels: syndicats.libelles,
		representants: make(map[string]string, len(representants)),
	}
	for _, ligne := range representants {
		etat.representants[ligne.PhoneE164] = ligne.ID
	}
	return etat, nil
}

type indexReferentielImport struct {
	index    map[string]string
	libelles []string
}

// Deux entrées qui se confondent feraient dépendre le segment BDD de l'ordre de
// lecture du référentiel.
func referentielsBancairesImport(ctx context.Context, q *db.Queries) (banques, syndicats indexReferentielImport, err error) {
	lignesBanques, err := q.ImportBanques(ctx)
	if err != nil {
		return banques, syndicats, err
	}
	lignesSyndicats, err := q.ImportSyndicats(ctx)
	if err != nil {
		return banques, syndicats, err
	}
	banques = indexReferentielImport{index: map[string]string{}}
	for _, ligne := range lignesBanques {
		if err := ajouterReferentielImport(banques.index, ligne.ShortName, ligne.ID, libelleBanqueImport); err != nil {
			return banques, syndicats, err
		}
		banques.libelles = append(banques.libelles, ligne.ShortName)
	}
	syndicats = indexReferentielImport{index: map[string]string{}}
	for _, ligne := range lignesSyndicats {
		if err := ajouterReferentielImport(syndicats.index, ligne.Sigle, ligne.ID, "Syndicat"); err != nil {
			return banques, syndicats, err
		}
		syndicats.libelles = append(syndicats.libelles, ligne.Sigle)
	}
	return banques, syndicats, nil
}

func ajouterReferentielImport(index map[string]string, libelle, identifiant, colonne string) error {
	cle := cleReferentielImport(libelle)
	if _, deja := index[cle]; deja {
		return echecImportError{"PROSPECT_IMPORT_REFERENTIAL_AMBIGUOUS", fmt.Sprintf(
			"Le référentiel « %s » contient deux entrées qui se confondent sur « %s ». Corrigez le référentiel avant de relancer l’import.", colonne, cle)}
	}
	index[cle] = identifiant
	return nil
}

func lireProspectImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatProspectsImport)
	nom := cellules[enteteProspectImport(0)]
	if nom == "" {
		return nil, refusImport(numero, enteteProspectImport(0), "PROSPECT_IMPORT_NOM_REQUIRED", "Le nom de famille est obligatoire, dans sa propre colonne.")
	}
	prenom := cellules[enteteProspectImport(1)]
	if prenom == "" {
		return nil, refusImport(numero, enteteProspectImport(1), "PROSPECT_IMPORT_PRENOM_REQUIRED", "Le prénom est obligatoire, dans sa propre colonne.")
	}
	brutTelephone := cellules[enteteProspectImport(2)]
	telephone, err := database.NormaliserTelephone(brutTelephone, etat.region)
	if err != nil {
		return nil, refusImport(numero, enteteProspectImport(2), "PROSPECT_IMPORT_PHONE_INVALID", fmt.Sprintf("Numéro de téléphone inexploitable : « %s ».", brutTelephone))
	}
	brutRepresentant := cellules[enteteProspectImport(3)]
	telephoneRepresentant, err := database.NormaliserTelephone(brutRepresentant, etat.region)
	if err != nil {
		return nil, refusImport(numero, enteteProspectImport(3), "PROSPECT_IMPORT_REPRESENTANT_PHONE_INVALID", fmt.Sprintf("Numéro du représentant inexploitable : « %s ».", brutRepresentant))
	}
	representantID, connu := etat.representants[telephoneRepresentant]
	if !connu {
		return nil, refusImport(numero, enteteProspectImport(3), "PROSPECT_IMPORT_REPRESENTANT_UNKNOWN",
			fmt.Sprintf("Aucun représentant actif ne porte le numéro %s. Cet import ne crée pas de représentant : importez-le d’abord.", telephoneRepresentant))
	}
	// Rapprochement EXACT : le croisement banque/syndicat est le segment BDD, et
	// un rapprochement flou le change sans que rien ne le dise.
	brutBanque := cellules[enteteProspectImport(4)]
	banqueID, connu := etat.banques[cleReferentielImport(brutBanque)]
	if !connu {
		return nil, refusImport(numero, enteteProspectImport(4), "PROSPECT_IMPORT_BANQUE_UNKNOWN",
			fmt.Sprintf("Banque inconnue : « %s ». Valeurs admises : %s.", brutBanque, valeursAdmisesImport(etat.banqueLabels)))
	}
	brutSyndicat := cellules[enteteProspectImport(5)]
	syndicatID, connu := etat.syndicats[cleReferentielImport(brutSyndicat)]
	if !connu {
		return nil, refusImport(numero, enteteProspectImport(5), "PROSPECT_IMPORT_SYNDICAT_UNKNOWN",
			fmt.Sprintf("Syndicat inconnu : « %s ». Valeurs admises : %s.", brutSyndicat, valeursAdmisesImport(etat.syndicatLabels)))
	}
	var methode *db.EnrollmentMethod
	if brutMethode := cellules[enteteProspectImport(6)]; brutMethode != "" {
		valeur, connu := methodesEnrolementImport[cleImport(brutMethode)]
		if !connu {
			return nil, refusImport(numero, enteteProspectImport(6), "PROSPECT_IMPORT_ENROLLMENT_METHOD_UNKNOWN",
				fmt.Sprintf("Méthode d’enrôlement inconnue : « %s ». Valeurs admises : %s, ou cellule vide.", brutMethode, valeursAdmisesImport(libellesEnrolementImport)))
		}
		methode = pointeurImport(db.EnrollmentMethod(valeur))
	}
	return ligneProspectImport{
		numero: numero, nom: nom, prenom: prenom, telephone: telephone,
		representantID: representantID, banqueID: banqueID, syndicatID: syndicatID, methode: methode,
	}, nil
}

func ecrireProspectsImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	if len(lignes) == 0 {
		return bilanTrancheImport{}, nil
	}
	etat := brut.(*etatProspectsImport)
	uniques, _, erreurs := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) { return v.(ligneProspectImport).telephone, v.(ligneProspectImport).numero },
		enteteProspectImport(2), "PROSPECT_IMPORT_DUPLICATE_IN_FILE")

	porteurs, err := porteursProspectsImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}

	var retenues []ligneProspectImport
	for _, valeur := range uniques {
		ligne := valeur.(ligneProspectImport)
		porteur, existe := porteurs[ligne.telephone]
		switch {
		case !existe:
			retenues = append(retenues, ligne)
		case porteur == ligne.representantID:
			erreurs = append(erreurs, *refusImport(ligne.numero, enteteProspectImport(2), "PROSPECT_IMPORT_DUPLICATE_IN_DATABASE", "Ce prospect existe déjà en base, sous ce même représentant."))
		default:
			// Jamais de rerattachement silencieux : le représentant porteur décide
			// de la commission. On rapporte, un humain tranche.
			erreurs = append(erreurs, *refusImport(ligne.numero, enteteProspectImport(3), "PROSPECT_IMPORT_ATTACHED_TO_OTHER_REPRESENTANT",
				"Ce prospect existe déjà en base, rattaché à un AUTRE représentant. Le rattachement n’a pas été modifié : faites-le expliciter depuis la fiche."))
		}
	}

	if !c.appliquer {
		return bilanTrancheImport{crees: len(retenues), erreurs: erreurs}, nil
	}
	crees, err := persisterProspectsImport(ctx, q, c, retenues)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: crees, ignorees: len(retenues) - crees, erreurs: erreurs}, nil
}

func porteursProspectsImport(ctx context.Context, q *db.Queries, uniques []any) (map[string]string, error) {
	telephones := make([]string, 0, len(uniques))
	for _, valeur := range uniques {
		telephones = append(telephones, valeur.(ligneProspectImport).telephone)
	}
	porteurs := map[string]string{}
	for _, lot := range lotsImport(telephones) {
		connus, err := q.ImportProspectsConnus(ctx, lot)
		if err != nil {
			return nil, err
		}
		for _, ligne := range connus {
			porteur := ""
			if ligne.RepresentantId != nil {
				porteur = *ligne.RepresentantId
			}
			porteurs[telephoneConnuImport(ligne.PhoneE164)] = porteur
		}
	}
	return porteurs, nil
}

func persisterProspectsImport(ctx context.Context, q *db.Queries, c contexteImport, retenues []ligneProspectImport) (int, error) {
	if len(retenues) == 0 {
		return 0, nil
	}
	maintenant := time.Now()
	identifiants := make([]string, len(retenues))
	fiches := make([]db.InsertImportProspectParams, len(retenues))
	for i := range retenues {
		ligne := &retenues[i]
		identifiants[i] = identifiantImport()
		fiches[i] = db.InsertImportProspectParams{
			ID: identifiants[i], Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: &ligne.telephone,
			BanqueID: &ligne.banqueID, SyndicatID: &ligne.syndicatID, RepresentantID: &ligne.representantID,
			CreatedByID: c.demandeur, Phase2Status: phase2DepuisMethodeImport(ligne.methode),
			EnrollmentMethod: ligne.methode, ClientCreatedAt: maintenant,
		}
		// La contrainte `prospects_enrollment_method_matches_status` décide : les
		// deux colonnes se déduisent l'une de l'autre.
		if ligne.methode != nil {
			fiches[i].EnrollmentCapturedAt, fiches[i].EnrollmentCapturedByID = &maintenant, &c.demandeur
		}
	}
	if err := executerLotImport(q.InsertImportProspect(ctx, fiches).Exec); err != nil {
		return 0, err
	}
	ecrits, err := q.ImportProspectsEcrits(ctx, identifiants)
	return int(ecrits), err
}

func phase2DepuisMethodeImport(methode *db.EnrollmentMethod) db.Phase2Status {
	if methode == nil {
		return db.Phase2StatusPENDING
	}
	return db.Phase2StatusMETHODOBTAINED
}

// ------------------------------------------------------------ grand public

var colonnesGrandPublicImport = []colonneImport{
	{entete: exports.ExportEntetePrenom, alias: []string{"Prénoms"}},
	{entete: exports.ExportEnteteNom, alias: []string{"Nom de famille", "Noms", "Nom complet"}},
	{entete: enteteTelephoneImport, alias: []string{"Tel", "Numéro", "Numéro de téléphone", "Contact"}},
	{entete: exports.ExportEnteteProfession, alias: []string{"Métier", "Activité"}},
	{entete: exports.ExportEnteteSyndicat},
	{entete: "Banque de domiciliation", alias: []string{libelleBanqueImport, "Domiciliation"}},
	{entete: "Fonctionnaire (oui/non)", alias: []string{"Fonctionnaire"}},
	{entete: "Durée système", alias: []string{"Durée du système", "Durée système de paiement", "Durée (mois)"}},
	{entete: exports.ExportEnteteCanalProvenance, alias: []string{"Provenance", "Canal", "Source"}},
	{entete: exports.FormulaireLibelleEmployeur, alias: []string{"Ministère", "Entreprise", "Employeur / Entreprise"}},
	{entete: exports.ExportEnteteTypeContrat, alias: []string{"Contrat"}},
	{entete: exports.ExportEnteteAnciennete, alias: []string{"Ancienneté", "Ancienneté chez l’employeur"}},
	{entete: exports.ExportEnteteLieuActivite, alias: []string{"Lieu de travail", "Marché"}},
	{entete: exports.ExportEnteteModeEpargne, alias: []string{"Épargne"}},
	{entete: exports.ExportEntetePaysResidence, alias: []string{"Pays", "Résidence"}},
	{entete: exports.ExportEnteteVilleResidence, alias: []string{"Ville"}},
	{entete: enteteWhatsappImport, alias: []string{"Numéro WhatsApp", "WhatsApp (international)"}},
	{entete: "Nom du relais", alias: []string{"Relais", "Personne relais"}},
	{entete: "Téléphone du relais", alias: []string{"Téléphone relais", "Contact du relais"}},
	{entete: enteteCreeLeImport, alias: []string{"Date de création", "Créé le", "Date"}},
	{entete: enteteCourrielImport, alias: []string{"E-mail", "Email", "Courriel"}},
	{entete: enteteEtapeImport, alias: []string{"Statut"}},
}

func enteteGrandPublicImport(rang int) string { return colonnesGrandPublicImport[rang].entete }

var (
	ouiImport          = []string{"oui", "o", "yes", "y", "vrai", "true", "x", "1"}
	nonImport          = []string{"non", "n", "no", "faux", "false", "0"}
	typesContratImport = tableLibellesImport(map[string]string{
		libelleCDIImport: libelleCDIImport, libelleCDDImport: libelleCDDImport, libelleAutreImport: string(db.TypeContratAUTRE),
	})
	modesEpargneImport = tableLibellesImport(map[string]string{
		"Tontine": "TONTINE", exports.ExportLibelleMobileMoney: modeMobileMoneyImport, "Mobile Money": modeMobileMoneyImport,
		"Orange Money": modeMobileMoneyImport, "Wave": modeMobileMoneyImport,
		libelleBanqueImport: "BANQUE", libelleAucunImport: exports.ExportCleAucun,
	})
	choixContratImport = []string{libelleCDIImport, libelleCDDImport, libelleAutreImport}
	choixEpargneImport = []string{"Tontine", "Mobile money", libelleBanqueImport, libelleAucunImport}
	moisImport         = regexp.MustCompile(`(?i)^(\d{1,4})(?:\s*mois)?$`)
	etapesImport       = tableLibellesImport(map[string]string{
		libelleAEvaluerImport: string(db.ProspectStatutNOUVEAU), "Nouveau": string(db.ProspectStatutNOUVEAU),
		libelleQualifieImport: string(db.ProspectStatutCONTACTE), "Contacté": string(db.ProspectStatutCONTACTE),
		"Converti": string(db.ProspectStatutCONVERTI), "Perdu": string(db.ProspectStatutPERDU),
	})
	choixEtapeImport = []string{libelleAEvaluerImport, libelleQualifieImport, "Converti", "Perdu"}
	// Les exports Meta datent au format américain, en 12 heures.
	formatsCreeLeImport = []string{"01/02/2006 3:04pm", "01/02/2006 15:04", "02/01/2006 15:04", "2006-01-02 15:04", "2006-01-02"}
)

type ligneGrandPublicImport struct {
	numero                                                 int
	nom, prenom                                            string
	telephone, email                                       *string
	creeLe                                                 *time.Time
	statut                                                 db.ProspectStatut
	profession, syndicatID, banqueID, canalID              *string
	typeProspect                                           *db.ProspectType
	dureeSystemeMois, ancienneteMois                       *int32
	employeurID, employeur, lieuActivite                   *string
	typeContrat                                            *db.TypeContrat
	modeEpargne                                            *db.ModeEpargne
	paysID, villeResidence, whatsapp, relaisNom, relaisTel *string
}

type etatGrandPublicImport struct {
	region                       string
	vus                          map[string]int
	banques, syndicats           map[string]string
	banqueLabels, syndicatLabels []string
	canaux                       map[string]string
	canalLabels                  []string
	employeurs                   map[string]string
	pays                         map[string]string
	paysLabels                   []string
}

func preparerGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport) (any, error) {
	banques, syndicats, err := referentielsBancairesImport(ctx, q)
	if err != nil {
		return nil, err
	}
	canaux, err := q.ImportCanaux(ctx)
	if err != nil {
		return nil, err
	}
	employeurs, err := q.ImportEmployeurs(ctx)
	if err != nil {
		return nil, err
	}
	pays, err := q.ImportPays(ctx)
	if err != nil {
		return nil, err
	}
	etat := &etatGrandPublicImport{
		region: c.region, vus: map[string]int{},
		banques: banques.index, banqueLabels: banques.libelles,
		syndicats: syndicats.index, syndicatLabels: syndicats.libelles,
		canaux: map[string]string{}, employeurs: map[string]string{}, pays: map[string]string{},
	}
	for _, ligne := range canaux {
		indexerLibellesImport(etat.canaux, ligne.ID, ligne.Label, ligne.Code)
		etat.canalLabels = append(etat.canalLabels, ligne.Label)
	}
	for _, ligne := range employeurs {
		indexerLibellesImport(etat.employeurs, ligne.ID, ligne.Label, ligne.Code)
	}
	for _, ligne := range pays {
		indexerLibellesImport(etat.pays, ligne.ID, ligne.Label, ligne.Code)
		etat.paysLabels = append(etat.paysLabels, ligne.Label)
	}
	return etat, nil
}

func indexerLibellesImport(index map[string]string, identifiant string, libelles ...string) {
	for _, libelle := range libelles {
		cle := cleImport(libelle)
		if cle == "" {
			continue
		}
		if _, deja := index[cle]; !deja {
			index[cle] = identifiant
		}
	}
}

// AUCUNE colonne n'est exigée : un lead Messenger ne donne qu'un nom, et une
// cellule vide est une information qu'on n'a pas encore. Seule une valeur
// écrite mais inexploitable refuse la ligne.
func lireGrandPublicImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatGrandPublicImport)
	telephone, refusTelephone := telephoneFacultatifImport(cellules[enteteGrandPublicImport(2)], etat.region, numero,
		enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_TELEPHONE_ILLISIBLE",
		"Numéro de téléphone inexploitable : « %s ». Laissez la cellule vide si vous ne l’avez pas.")
	if refusTelephone != nil {
		return nil, refusTelephone
	}
	creeLe, refusDate := dateCreationGrandPublicImport(cellules[enteteGrandPublicImport(19)], numero)
	if refusDate != nil {
		return nil, refusDate
	}
	statut, refusEtape := etapeGrandPublicImport(cellules[enteteGrandPublicImport(21)], numero)
	if refusEtape != nil {
		return nil, refusEtape
	}
	banqueID, refus := referentielFacultatifImport(cellules[enteteGrandPublicImport(5)], etat.banques, cleReferentielImport, numero,
		enteteGrandPublicImport(5), "PROSPECT_GP_IMPORT_BANQUE_INCONNUE", "Banque inconnue", etat.banqueLabels)
	if refus != nil {
		return nil, refus
	}
	syndicatID, refus := referentielFacultatifImport(cellules[enteteGrandPublicImport(4)], etat.syndicats, cleReferentielImport, numero,
		enteteGrandPublicImport(4), "PROSPECT_GP_IMPORT_SYNDICAT_INCONNU", "Syndicat inconnu", etat.syndicatLabels)
	if refus != nil {
		return nil, refus
	}
	canalID, refus := referentielFacultatifImport(cellules[enteteGrandPublicImport(8)], etat.canaux, cleImport, numero,
		enteteGrandPublicImport(8), "PROSPECT_GP_IMPORT_CANAL_INCONNU", "Canal de provenance inconnu", etat.canalLabels)
	if refus != nil {
		return nil, refus
	}
	typeProspect, refus := lireFonctionnaireImport(cellules[enteteGrandPublicImport(6)], numero)
	if refus != nil {
		return nil, refus
	}
	duree, refus := lireMoisImport(cellules[enteteGrandPublicImport(7)], 1, 300, numero, enteteGrandPublicImport(7),
		"PROSPECT_GP_IMPORT_DUREE_ILLISIBLE", "n’est pas un nombre entier de mois entre 1 et 300. Écrivez 24, ou laissez vide.")
	if refus != nil {
		return nil, refus
	}
	ligne := ligneGrandPublicImport{
		numero: numero, nom: cellules[enteteGrandPublicImport(1)], prenom: cellules[enteteGrandPublicImport(0)],
		telephone: telephone, email: couperImport(cellules[enteteGrandPublicImport(20)], 160),
		creeLe: creeLe, statut: statut,
		profession: couperImport(cellules[enteteGrandPublicImport(3)], 120),
		syndicatID: syndicatID, banqueID: banqueID, canalID: canalID,
		typeProspect: typeProspect, dureeSystemeMois: duree,
	}
	if refus := completerSituationGrandPublicImport(&ligne, cellules, numero, etat); refus != nil {
		return nil, refus
	}
	return ligne, nil
}

// Seul le pays refuse la ligne : l'employeur retombe en texte libre, ce que la
// fiche prévoit déjà.
func completerSituationGrandPublicImport(ligne *ligneGrandPublicImport, cellules map[string]string, numero int, etat *etatGrandPublicImport) *erreurLigneImport {
	brutEmployeur := cellules[enteteGrandPublicImport(9)]
	if identifiant, connu := etat.employeurs[cleImport(brutEmployeur)]; connu && brutEmployeur != "" {
		ligne.employeurID = &identifiant
	} else {
		ligne.employeur = couperImport(brutEmployeur, 160)
	}
	brutContrat := cellules[enteteGrandPublicImport(10)]
	if brutContrat != "" {
		valeur, connu := typesContratImport[cleImport(brutContrat)]
		if !connu {
			return refusImport(numero, enteteGrandPublicImport(10), "PROSPECT_GP_IMPORT_TYPE_CONTRAT_ILLISIBLE",
				fmt.Sprintf("Type de contrat inconnu : « %s ». Valeurs admises : %s, ou cellule vide.", brutContrat, valeursAdmisesImport(choixContratImport)))
		}
		ligne.typeContrat = pointeurImport(db.TypeContrat(valeur))
	}
	anciennete, refus := lireMoisImport(cellules[enteteGrandPublicImport(11)], 0, 840, numero, enteteGrandPublicImport(11),
		"PROSPECT_GP_IMPORT_ANCIENNETE_ILLISIBLE", "n’est pas un nombre entier de mois entre 0 et 840. Écrivez 36, ou laissez vide.")
	if refus != nil {
		return refus
	}
	ligne.ancienneteMois = anciennete
	brutEpargne := cellules[enteteGrandPublicImport(13)]
	if brutEpargne != "" {
		valeur, connu := modesEpargneImport[cleImport(brutEpargne)]
		if !connu {
			return refusImport(numero, enteteGrandPublicImport(13), "PROSPECT_GP_IMPORT_MODE_EPARGNE_ILLISIBLE",
				fmt.Sprintf("Mode d’épargne inconnu : « %s ». Valeurs admises : %s, ou cellule vide.", brutEpargne, valeursAdmisesImport(choixEpargneImport)))
		}
		ligne.modeEpargne = pointeurImport(db.ModeEpargne(valeur))
	}
	brutPays := cellules[enteteGrandPublicImport(14)]
	paysID, refus := referentielFacultatifImport(brutPays, etat.pays, cleImport, numero, enteteGrandPublicImport(14),
		"PROSPECT_GP_IMPORT_PAYS_INCONNU", "Pays de résidence inconnu", etat.paysLabels)
	if refus != nil {
		refus.Message = fmt.Sprintf("Pays de résidence inconnu : « %s ». Nom en français ou code ISO. Valeurs admises : %s, ou cellule vide.",
			brutPays, valeursAdmisesImport(etat.paysLabels))
		return refus
	}
	whatsapp, refus := telephoneFacultatifImport(cellules[enteteGrandPublicImport(16)], etat.region, numero, enteteGrandPublicImport(16),
		"PROSPECT_GP_IMPORT_WHATSAPP_ILLISIBLE", "Numéro WhatsApp inexploitable : « %s ». Écrivez-le avec son indicatif s’il est étranger.")
	if refus != nil {
		return refus
	}
	relais, refus := telephoneFacultatifImport(cellules[enteteGrandPublicImport(18)], etat.region, numero, enteteGrandPublicImport(18),
		"PROSPECT_GP_IMPORT_RELAIS_TELEPHONE_ILLISIBLE", "Téléphone du relais inexploitable : « %s ».")
	if refus != nil {
		return refus
	}
	ligne.lieuActivite = couperImport(cellules[enteteGrandPublicImport(12)], 160)
	ligne.paysID = paysID
	ligne.villeResidence = couperImport(cellules[enteteGrandPublicImport(15)], 120)
	ligne.whatsapp = whatsapp
	ligne.relaisNom = couperImport(cellules[enteteGrandPublicImport(17)], 160)
	ligne.relaisTel = relais
	return nil
}

// Vide : la fiche prend l'heure de l'import. Les exports Meta écrivent le mois
// en premier, ce qu'aucun autre classeur d'ici ne fait.
func dateCreationGrandPublicImport(brut string, numero int) (*time.Time, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	for _, format := range formatsCreeLeImport {
		quand, err := time.ParseInLocation(format, brut, time.UTC)
		if err == nil && !quand.After(time.Now()) {
			return &quand, nil
		}
	}
	return nil, refusImport(numero, enteteCreeLeImport, "PROSPECT_GP_IMPORT_DATE_ILLISIBLE",
		fmt.Sprintf("Date de création illisible ou à venir : « %s ». Écrivez 05/12/2026 9:42am, ou laissez vide.", brut))
}

func etapeGrandPublicImport(brut string, numero int) (db.ProspectStatut, *erreurLigneImport) {
	if brut == "" {
		return db.ProspectStatutNOUVEAU, nil
	}
	valeur, connu := etapesImport[cleImport(brut)]
	if !connu {
		return db.ProspectStatutNOUVEAU, refusImport(numero, enteteEtapeImport, "PROSPECT_GP_IMPORT_ETAPE_INCONNUE",
			fmt.Sprintf("Étape inconnue : « %s ». Valeurs admises : %s, ou cellule vide.", brut, valeursAdmisesImport(choixEtapeImport)))
	}
	return db.ProspectStatut(valeur), nil
}

func referentielFacultatifImport(brut string, index map[string]string, cle func(string) string,
	numero int, colonne, code, sujet string, libelles []string,
) (*string, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	identifiant, connu := index[cle(brut)]
	if !connu {
		return nil, refusImport(numero, colonne, code,
			fmt.Sprintf("%s : « %s ». Valeurs admises : %s, ou cellule vide.", sujet, brut, valeursAdmisesImport(libelles)))
	}
	return &identifiant, nil
}

func telephoneFacultatifImport(brut, region string, numero int, colonne, code, format string) (*string, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	e164, err := database.NormaliserTelephone(brut, region)
	if err != nil {
		return nil, refusImport(numero, colonne, code, fmt.Sprintf(format, brut))
	}
	return &e164, nil
}

// « Non » dit ce que la personne n'est PAS : il ne choisit pas entre secteur
// privé, informel et diaspora.
func lireFonctionnaireImport(brut string, numero int) (*db.ProspectType, *erreurLigneImport) {
	cle := cleImport(brut)
	switch {
	case cle == "":
		return nil, nil
	case contientImport(ouiImport, cle):
		return pointeurImport(db.ProspectTypeFONCTIONNAIRE), nil
	case contientImport(nonImport, cle):
		return nil, nil
	}
	return nil, refusImport(numero, enteteGrandPublicImport(6), "PROSPECT_GP_IMPORT_FONCTIONNAIRE_ILLISIBLE",
		fmt.Sprintf("« %s » ne se lit ni comme oui ni comme non. Écrivez %s ou %s, ou laissez vide.",
			brut, valeursAdmisesImport(ouiImport), valeursAdmisesImport(nonImport)))
}

func contientImport(valeurs []string, cle string) bool {
	for _, valeur := range valeurs {
		if valeur == cle {
			return true
		}
	}
	return false
}

func lireMoisImport(brut string, minimum, maximum, numero int, colonne, code, motif string) (*int32, *erreurLigneImport) {
	if brut == "" {
		return nil, nil
	}
	parts := moisImport.FindStringSubmatch(strings.TrimSpace(brut))
	if parts != nil {
		mois := atoiImport(parts[1])
		if mois >= minimum && mois <= maximum {
			return pointeurImport(entier32Import(int64(mois))), nil
		}
	}
	return nil, refusImport(numero, colonne, code, fmt.Sprintf("« %s » %s", brut, motif))
}

func ecrireGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	if len(lignes) == 0 {
		return bilanTrancheImport{}, nil
	}
	etat := brut.(*etatGrandPublicImport)
	uniques, _, erreurs := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) {
			ligne := v.(ligneGrandPublicImport)
			return telephoneConnuImport(ligne.telephone), ligne.numero
		},
		enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_DOUBLON_DANS_LE_FICHIER")

	dejaGrandPublic, err := grandPublicDejaConnusImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}

	var retenues []ligneGrandPublicImport
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		if ligne.telephone != nil && dejaGrandPublic[*ligne.telephone] {
			erreurs = append(erreurs, *refusImport(ligne.numero, enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_DEJA_EN_BASE", "Ce prospect Grand Public existe déjà en base."))
			continue
		}
		retenues = append(retenues, ligne)
	}
	if !c.appliquer {
		return bilanTrancheImport{crees: len(retenues), erreurs: erreurs}, nil
	}
	crees, err := persisterGrandPublicImport(ctx, q, c, retenues, dejaGrandPublic)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: crees, ignorees: len(retenues) - crees, erreurs: erreurs}, nil
}

// Les fiches déjà en base, lues sur les seuls numéros que le lot porte : sans
// numéro, une ligne n'a rien à comparer et passe toujours pour nouvelle.
func grandPublicDejaConnusImport(ctx context.Context, q *db.Queries, uniques []any) (map[string]bool, error) {
	telephones := make([]string, 0, len(uniques))
	for _, valeur := range uniques {
		if numero := valeur.(ligneGrandPublicImport).telephone; numero != nil {
			telephones = append(telephones, *numero)
		}
	}
	deja := map[string]bool{}
	for _, lot := range lotsImport(telephones) {
		connus, err := q.ImportProspectsConnus(ctx, lot)
		if err != nil {
			return nil, err
		}
		for _, ligne := range connus {
			deja[telephoneConnuImport(ligne.PhoneE164)] = ligne.ParcoursGp || ligne.Projet == db.ProjetGRANDPUBLIC
		}
	}
	return deja, nil
}

// Les fiches créées ici portent un identifiant que NOUS tenons : le relire par
// téléphone laisserait de côté celles qui n'en ont pas.
func persisterGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport,
	retenues []ligneGrandPublicImport, connus map[string]bool,
) (int, error) {
	maintenant := time.Now()
	var fiches []db.InsertImportProspectGrandPublicParams
	var fichesID, telephonesConnus []string
	for i := range retenues {
		ligne := &retenues[i]
		if ligne.telephone != nil {
			if _, existe := connus[*ligne.telephone]; existe {
				telephonesConnus = append(telephonesConnus, *ligne.telephone)
				continue
			}
		}
		identifiant := identifiantImport()
		fichesID = append(fichesID, identifiant)
		statut, numero := whatsappGrandPublicImport(ligne.whatsapp, ligne.telephone)
		fiches = append(fiches, db.InsertImportProspectGrandPublicParams{
			ID: identifiant, Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: ligne.telephone,
			Email: ligne.email, Statut: ligne.statut,
			Profession: ligne.profession, SyndicatID: ligne.syndicatID, BanqueID: ligne.banqueID,
			Type: ligne.typeProspect, DureeSystemeMois: ligne.dureeSystemeMois, CanalProvenanceID: ligne.canalID,
			EmployeurID: ligne.employeurID, Employeur: ligne.employeur, TypeContrat: ligne.typeContrat,
			AncienneteMois: ligne.ancienneteMois, LieuActivite: ligne.lieuActivite, ModeEpargne: ligne.modeEpargne,
			PaysResidenceID: ligne.paysID, VilleResidence: ligne.villeResidence,
			WhatsappStatus: statut, WhatsappE164: numero, RelaisNom: ligne.relaisNom,
			RelaisPhoneE164: ligne.relaisTel, CreatedByID: c.demandeur,
			ClientCreatedAt: dateOuMaintenantImport(ligne.creeLe, maintenant),
		})
	}
	if len(fiches) > 0 {
		if err := executerLotImport(q.InsertImportProspectGrandPublic(ctx, fiches).Exec); err != nil {
			return 0, err
		}
	}
	porteuses, err := prospectsGrandPublicImport(ctx, q, fichesID, telephonesConnus)
	if err != nil || len(porteuses) == 0 {
		return 0, err
	}
	parcours := make([]db.InsertImportProspectJourneyParams, len(porteuses))
	identifiants := make([]string, len(porteuses))
	for i, prospectID := range porteuses {
		identifiants[i] = identifiantImport()
		parcours[i] = db.InsertImportProspectJourneyParams{ID: identifiants[i], ProspectID: prospectID, ConsentAt: &maintenant}
	}
	if err := executerLotImport(q.InsertImportProspectJourney(ctx, parcours).Exec); err != nil {
		return 0, err
	}
	ecrits, err := q.ImportJourneysEcrits(ctx, identifiants)
	return int(ecrits), err
}

// Les fiches qui reçoivent un parcours Grand Public : celles qu'on vient
// d'écrire, et celles qui existaient déjà sous un autre projet.
func prospectsGrandPublicImport(ctx context.Context, q *db.Queries, creees, telephones []string) ([]string, error) {
	porteuses := append([]string(nil), creees...)
	for _, lot := range lotsImport(telephones) {
		prospects, err := q.ImportProspectsParTelephone(ctx, lot)
		if err != nil {
			return nil, err
		}
		for _, prospect := range prospects {
			porteuses = append(porteuses, prospect.ID)
		}
	}
	return porteuses, nil
}

func dateOuMaintenantImport(quand *time.Time, defaut time.Time) time.Time {
	if quand == nil {
		return defaut
	}
	return *quand
}

// EB-23 : le statut se déduit du numéro, et le CHECK reste tenu.
func whatsappGrandPublicImport(numero, telephone *string) (statut db.WhatsappStatus, whatsapp *string) {
	switch {
	case numero == nil:
		return db.WhatsappStatusNONDEMANDE, nil
	case telephone != nil && *numero == *telephone:
		return db.WhatsappStatusMEMENUMERO, nil
	}
	return db.WhatsappStatusAUTRENUMERO, numero
}

// Le registre des visites vit dans `imports_adaptateurs_visites.go`.
