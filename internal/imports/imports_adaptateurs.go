package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"encoding/json"
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
		feuilles: &dispositionFeuilleImport{
			ligneEntete: 1, premiereDonnee: 2, repliFeuillesRemplies: true,
		},
		preparer: preparerProspectsImport, lire: lireProspectImport, ecrire: ecrireProspectsImport,
	},
	db.ImportKindPROSPECTSGRANDPUBLIC: {
		maxLignes: 50_000, colonnes: colonnesGrandPublicImport,
		feuilles: &dispositionFeuilleImport{
			motif: regexp.MustCompile(`(?i)prospect`), ligneEntete: 1,
			premiereDonnee: 2, repliFeuillesRemplies: true, exemples: exemplesGrandPublicImport(),
		},
		preparer: preparerGrandPublicImport, lire: lireGrandPublicImport, ecrire: ecrireGrandPublicImport,
	},
	db.ImportKindVISITES: {
		maxLignes: 20_000, colonnes: colonnesVisitesImport,
		feuilles: &dispositionFeuilleImport{motif: regexp.MustCompile(`(?i)BDD VISITES`), ligneEntete: 3},
		preparer: preparerVisitesImport, lire: lireVisiteImport, ecrire: ecrireVisitesImport,
	},
}

// ------------------------------------------------------------------ communs

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
	_, _ string,
) (uniques []any, ignorees int, erreurs []erreurLigneImport) {
	for _, ligne := range lignes {
		telephone, numero := cle(ligne)
		if _, deja := vus[telephone]; deja {
			ignorees++
			continue
		}
		vus[telephone] = numero
		uniques = append(uniques, ligne)
	}
	return uniques, ignorees, nil
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

func dateRangExcelImport(brut string) (time.Time, bool) {
	texte := strings.TrimSpace(brut)
	f, err := strconv.ParseFloat(texte, 64)
	if err != nil || f < 61 || f > 2_958_465 {
		return time.Time{}, false
	}
	return time.Date(1899, time.December, 30, 0, 0, 0, 0, time.UTC).AddDate(0, 0, int(f)), true
}

func lireDateLeadImport(brut string, numero int) (*time.Time, *erreurLigneImport) {
	texte := strings.TrimSpace(brut)
	if texte == "" {
		return nil, nil
	}
	if date, ok := dateRangExcelImport(texte); ok {
		return &date, nil
	}
	if date, ok := lireDateAppelImport(texte); ok {
		return &date, nil
	}
	return nil, refusImport(numero, enteteGrandPublicImport(21), "PROSPECT_GP_IMPORT_DATE_ILLISIBLE",
		fmt.Sprintf("« %s » n’est pas une date. Écrivez 10/09/2026, ou laissez vide.", brut))
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
	{entete: exports.ExportEnteteNom, alias: []string{"Nom de famille", "Noms", "Nom complet", "Nom et prénom", "Prénom et nom", "Nom du prospect"}},
	{entete: exports.ExportEntetePrenom, alias: []string{"Prénoms"}},
	{entete: enteteTelephoneImport, alias: []string{"Tel", "Numéro", "Numéro de téléphone", "Contact"}, requise: true},
	{entete: "Téléphone du représentant", alias: []string{"Téléphone représentant", "Contact représentant", "Relais", "Téléphone du relais"}},
	{entete: libelleBanqueImport, alias: []string{"Banque de domiciliation", "Domiciliation"}},
	{entete: exports.ExportEnteteSyndicat},
	{entete: exports.ExportEnteteMethodeEnrolement},
}

func enteteProspectImport(rang int) string { return colonnesProspectsImport[rang].entete }

var methodesEnrolementImport = map[string]string{
	"rdv cpi": string(db.EnrollmentMethodAPPOINTMENT), "appointment": string(db.EnrollmentMethodAPPOINTMENT),
	"plateforme en ligne": string(db.EnrollmentMethodPLATFORM), "platform": string(db.EnrollmentMethodPLATFORM),
	"mail": string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING), "voice or electronic messaging": string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING),
	"whatsapp": string(db.EnrollmentMethodWHATSAPP),
}

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

func lireRepresentantProspectImport(brut string, etat *etatProspectsImport) string {
	if brut == "" {
		return ""
	}
	tel, err := database.NormaliserTelephone(brut, etat.region)
	if err != nil {
		return ""
	}
	return etat.representants[tel]
}

func lireBanqueProspectImport(brut string, etat *etatProspectsImport) string {
	if brut == "" {
		return ""
	}
	return etat.banques[cleReferentielImport(brut)]
}

func lireSyndicatProspectImport(brut string, etat *etatProspectsImport) string {
	if brut == "" {
		return ""
	}
	return etat.syndicats[cleReferentielImport(brut)]
}

func lireMethodeProspectImport(brut string) *db.EnrollmentMethod {
	if brut == "" {
		return nil
	}
	if valeur, connu := methodesEnrolementImport[cleImport(brut)]; connu {
		return pointeurImport(db.EnrollmentMethod(valeur))
	}
	return nil
}

func lireProspectImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatProspectsImport)
	nom, prenom := cellules[enteteProspectImport(0)], cellules[enteteProspectImport(1)]
	if nom == "" && prenom == "" {
		nom, prenom = nomGrandPublicImport(cellules)
	}
	if nom == "" {
		return nil, refusImport(numero, enteteProspectImport(0), "PROSPECT_IMPORT_NOM_REQUIRED", "Le nom de famille est obligatoire.")
	}
	brutTelephone := cellules[enteteProspectImport(2)]
	telephone, err := database.NormaliserTelephone(brutTelephone, etat.region)
	if err != nil {
		return nil, refusImport(numero, enteteProspectImport(2), "PROSPECT_IMPORT_PHONE_INVALID", fmt.Sprintf("Numéro de téléphone inexploitable : « %s ».", brutTelephone))
	}
	return ligneProspectImport{
		numero: numero, nom: nom, prenom: prenom, telephone: telephone,
		representantID: lireRepresentantProspectImport(cellules[enteteProspectImport(3)], etat),
		banqueID:       lireBanqueProspectImport(cellules[enteteProspectImport(4)], etat),
		syndicatID:     lireSyndicatProspectImport(cellules[enteteProspectImport(5)], etat),
		methode:        lireMethodeProspectImport(cellules[enteteProspectImport(6)]),
	}, nil
}

func ecrireProspectsImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	if len(lignes) == 0 {
		return bilanTrancheImport{}, nil
	}
	etat := brut.(*etatProspectsImport)
	uniques, ignoreesDoublons, _ := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) { return v.(ligneProspectImport).telephone, v.(ligneProspectImport).numero },
		enteteProspectImport(2), "PROSPECT_IMPORT_DUPLICATE_IN_FILE")

	porteurs, err := porteursProspectsImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}

	var retenues []ligneProspectImport
	ignoreesBase := 0
	for _, valeur := range uniques {
		ligne := valeur.(ligneProspectImport)
		_, existe := porteurs[ligne.telephone]
		if !existe {
			retenues = append(retenues, ligne)
		} else {
			ignoreesBase++
		}
	}

	totalesIgnorees := ignoreesDoublons + ignoreesBase
	if !c.appliquer {
		return bilanTrancheImport{crees: len(retenues), ignorees: totalesIgnorees}, nil
	}
	crees, err := persisterProspectsImport(ctx, q, c, retenues)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: crees, ignorees: totalesIgnorees + (len(retenues) - crees)}, nil
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
			porteurs[ligne.PhoneE164] = porteur
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
			ID: identifiants[i], Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: ligne.telephone,
			BanqueID: couperImport(ligne.banqueID, 36), SyndicatID: couperImport(ligne.syndicatID, 36), RepresentantID: couperImport(ligne.representantID, 36),
			CreatedByID: c.demandeur, Phase2Status: phase2DepuisMethodeImport(ligne.methode),
			EnrollmentMethod: ligne.methode, ClientCreatedAt: maintenant, ImportJobID: &c.jobID,
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
	// Pas « requise » : « Nom complet » la remplace, et le refus se dit ligne à ligne.
	{entete: exports.ExportEnteteNom, alias: []string{"Nom de famille", "Noms"}},
	{entete: enteteTelephoneImport, alias: []string{"Tel", "Numéro", "Numéro de téléphone", "Contact"}, requise: true},
	{entete: exports.ExportEnteteProfession, alias: []string{"Métier", "Activité", "Poste", "JOB_TITLE"}},
	{entete: exports.ExportEnteteSyndicat},
	{entete: "Banque de domiciliation", alias: []string{libelleBanqueImport, "Domiciliation"}},
	{entete: "Fonctionnaire (oui/non)", alias: []string{"Fonctionnaire"}},
	{entete: "Durée système", alias: []string{"Durée du système", "Durée système de paiement", "Durée (mois)"}},
	{entete: exports.ExportEnteteCanalProvenance, alias: []string{"Canal", "Provenance", "Source"}},
	{entete: exports.FormulaireLibelleEmployeur, alias: []string{"Ministère", "Entreprise", "Employeur / Entreprise", "COMPANY_NAME"}},
	{entete: exports.ExportEnteteTypeContrat, alias: []string{"Contrat"}},
	{entete: exports.ExportEnteteAnciennete, alias: []string{"Ancienneté", "Ancienneté chez l’employeur"}},
	{entete: exports.ExportEnteteLieuActivite, alias: []string{"Lieu de travail", "Marché"}},
	{entete: exports.ExportEnteteModeEpargne, alias: []string{"Épargne"}},
	{entete: exports.ExportEntetePaysResidence, alias: []string{"Pays", "Résidence"}},
	{entete: exports.ExportEnteteVilleResidence, alias: []string{"Ville"}},
	{entete: enteteWhatsappImport, alias: []string{"Numéro WhatsApp", "WhatsApp (international)"}},
	{entete: "Nom du relais", alias: []string{"Relais", "Personne relais"}},
	{entete: "Téléphone du relais", alias: []string{"Téléphone relais", "Contact du relais"}},
	{entete: "Email", alias: []string{"E-mail", "Courriel", "Adresse e-mail"}},
	{entete: "Nom complet", alias: []string{"Nom et prénom", "Prénom et nom", "Nom du prospect"}},
	{entete: "Date", alias: []string{"Date du lead", "Date de création", "Créé le", "CREATED_TIME"}},
}

func enteteGrandPublicImport(rang int) string { return colonnesGrandPublicImport[rang].entete }

// Les trois dernières colonnes n'existent pas dans le modèle : elles n'ont pas
// d'exemple à reconnaître.
func exemplesGrandPublicImport() []string {
	return append(exports.ExemplesGrandPublic(), "", "", "")
}

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
	emailImport        = regexp.MustCompile(`[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)
)

type ligneGrandPublicImport struct {
	numero                                                 int
	nom, prenom, telephone                                 string
	projet                                                 db.Projet
	email                                                  *string
	dateLead                                               *time.Time
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
	emails                       map[string]int
	banques, syndicats           map[string]string
	banqueLabels, syndicatLabels []string
	canaux                       map[string]string
	canalLabels                  []string
	regles                       []regleProvenanceImport
	employeurs                   map[string]string
	pays                         map[string]string
	paysLabels                   []string
}

type regleProvenanceImport struct {
	motif, canalID string
	projet         db.Projet
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
		region: c.region, vus: map[string]int{}, emails: map[string]int{},
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
	etat.regles, err = reglesProvenanceImport(ctx, q, etat.canaux)
	if err != nil {
		return nil, err
	}
	return etat, nil
}

// Une page d'atterrissage ou un nom de campagne n'est pas un canal, et change à
// chaque campagne : la correspondance est une donnée, pas du code.
func reglesProvenanceImport(ctx context.Context, q *db.Queries, canaux map[string]string) ([]regleProvenanceImport, error) {
	valeurs, err := q.ImportReglesProvenance(ctx)
	if err != nil || len(valeurs) == 0 {
		return nil, err
	}
	var lignes []string
	if err := json.Unmarshal([]byte(valeurs[0]), &lignes); err != nil {
		return nil, classeurImportError{"Les règles de provenance de Paramètres CHUES sont illisibles."}
	}
	var regles []regleProvenanceImport
	for _, brute := range lignes {
		parts := strings.Split(brute, "|")
		if strings.TrimSpace(brute) == "" {
			continue
		}
		if len(parts) != 3 {
			return nil, classeurImportError{"Règle de provenance illisible : « " + brute + " ». Forme attendue : motif | canal | projet."}
		}
		canalID, connu := canaux[cleImport(parts[1])]
		if !connu {
			return nil, classeurImportError{"Règle de provenance « " + brute + " » : le canal « " + strings.TrimSpace(parts[1]) + " » n’existe pas."}
		}
		projet := db.Projet(strings.ToUpper(strings.TrimSpace(parts[2])))
		if projet != db.ProjetCHUES && projet != db.ProjetGRANDPUBLIC {
			return nil, classeurImportError{"Règle de provenance « " + brute + " » : le projet doit être CHUES ou GRAND_PUBLIC."}
		}
		regles = append(regles, regleProvenanceImport{motif: cleImport(parts[0]), canalID: canalID, projet: projet})
	}
	return regles, nil
}

// Le canal nomme le réseau, la règle nomme la campagne : elle seule sait à quel
// projet le prospect répondait.
func provenanceExacteGrandPublic(cle string, etat *etatGrandPublicImport) (*string, db.Projet, bool) {
	if identifiant, connu := etat.canaux[cle]; connu {
		return &identifiant, db.ProjetGRANDPUBLIC, true
	}
	for i := range etat.regles {
		if etat.regles[i].motif != "" && strings.Contains(cle, etat.regles[i].motif) {
			return &etat.regles[i].canalID, etat.regles[i].projet, true
		}
	}
	return nil, db.ProjetGRANDPUBLIC, false
}

func canalParKeywordGrandPublic(cle string, canaux map[string]string) *string {
	for cCle, cID := range canaux {
		if strings.Contains(cle, cCle) || strings.Contains(cCle, cle) {
			return &cID
		}
	}
	return nil
}

func cibleFamilleGrandPublic(cle string) string {
	switch {
	case strings.Contains(cle, "pay") || strings.Contains(cle, "ad") || strings.Contains(cle, "meta") || strings.Contains(cle, "pub") || strings.Contains(cle, "sponsor"):
		return "meta"
	case strings.Contains(cle, "organique") || strings.Contains(cle, "site") || strings.Contains(cle, "web") || strings.Contains(cle, "page") || strings.Contains(cle, "adhesion"):
		return "site"
	default:
		return ""
	}
}

func canalParFamilleGrandPublic(cle string, canaux map[string]string) *string {
	cible := cibleFamilleGrandPublic(cle)
	if cible == "" {
		return nil
	}
	for cCle, cID := range canaux {
		if strings.Contains(cCle, cible) {
			return &cID
		}
	}
	return nil
}

func provenanceGrandPublicImport(brut string, etat *etatGrandPublicImport) (*string, db.Projet) {
	if brut == "" {
		return nil, db.ProjetGRANDPUBLIC
	}
	cle := cleImport(brut)
	if id, projet, ok := provenanceExacteGrandPublic(cle, etat); ok {
		return id, projet
	}
	if id := canalParKeywordGrandPublic(cle, etat.canaux); id != nil {
		return id, db.ProjetGRANDPUBLIC
	}
	return canalParFamilleGrandPublic(cle, etat.canaux), db.ProjetGRANDPUBLIC
}

func libelleProjetImport(projet db.Projet) string {
	if projet == db.ProjetCHUES {
		return "CPI CHUES"
	}
	return "Grand Public"
}

// Un export de campagne colle parfois une puce ou un commentaire derrière
// l'adresse : une adresse illisible n'est pas un refus, le téléphone reste la clé.
func emailGrandPublicImport(brut string) *string {
	trouvee := emailImport.FindString(strings.ToLower(brut))
	if trouvee == "" {
		return nil
	}
	return &trouvee
}

// Un classeur de campagne ne porte qu'un nom complet : le dernier mot devient le
// nom de famille, le reste le prénom.
func nomGrandPublicImport(cellules map[string]string) (nom, prenom string) {
	nom, prenom = cellules[enteteGrandPublicImport(1)], cellules[enteteGrandPublicImport(0)]
	complet := cellules[enteteGrandPublicImport(20)]
	if nom != "" || complet == "" {
		return nom, prenom
	}
	mots := strings.Fields(complet)
	return mots[len(mots)-1], strings.Join(mots[:len(mots)-1], " ")
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

// Seuls le nom et le téléphone sont exigés : une cellule vide est une
// information qu'on n'a pas encore, jamais un refus.
func lireGrandPublicImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatGrandPublicImport)
	nom, prenom := nomGrandPublicImport(cellules)
	brutTelephone := strings.TrimSpace(cellules[enteteGrandPublicImport(2)])
	if nom == "" && brutTelephone == "" {
		return nil, nil
	}
	if nom == "" {
		return nil, refusImport(numero, enteteGrandPublicImport(1), "PROSPECT_GP_IMPORT_NOM_ABSENT",
			"Le nom est obligatoire : une colonne « Nom », ou une colonne « Nom complet » dont le dernier mot est le nom de famille.")
	}
	telephone, err := database.NormaliserTelephone(brutTelephone, etat.region)
	if err != nil {
		message := fmt.Sprintf("Numéro de téléphone inexploitable : « %s ».", brutTelephone)
		if brutTelephone == "" {
			message = "Le téléphone est obligatoire : c’est lui qui repère les doublons."
		}
		return nil, refusImport(numero, enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_TELEPHONE_ILLISIBLE", message)
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
	canalID, projet := provenanceGrandPublicImport(cellules[enteteGrandPublicImport(8)], etat)
	typeProspect, refus := lireFonctionnaireImport(cellules[enteteGrandPublicImport(6)], numero)
	if refus != nil {
		return nil, refus
	}
	duree, refus := lireMoisImport(cellules[enteteGrandPublicImport(7)], 1, 300, numero, enteteGrandPublicImport(7),
		"PROSPECT_GP_IMPORT_DUREE_ILLISIBLE", "n’est pas un nombre entier de mois entre 1 et 300. Écrivez 24, ou laissez vide.")
	if refus != nil {
		return nil, refus
	}
	dateLead, refus := lireDateLeadImport(cellules[enteteGrandPublicImport(21)], numero)
	if refus != nil {
		return nil, refus
	}
	ligne := ligneGrandPublicImport{
		numero: numero, nom: nom, prenom: prenom, telephone: telephone, projet: projet,
		email:      emailGrandPublicImport(cellules[enteteGrandPublicImport(19)]),
		dateLead:   dateLead,
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
	uniques, ignoreesDoublons, _ := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) {
			return v.(ligneGrandPublicImport).telephone, v.(ligneGrandPublicImport).numero
		},
		enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_DOUBLON_DANS_LE_FICHIER")

	deja, dejaEmail, err := dejaEnBaseGrandPublicImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}

	var retenues []ligneGrandPublicImport
	var erreurs []erreurLigneImport
	ignoreesBase := 0
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		if deja[ligne.telephone][ligne.projet] {
			ignoreesBase++
			continue
		}
		if refus := doublonEmailGrandPublicImport(&ligne, etat, dejaEmail); refus != nil {
			ignoreesBase++
			continue
		}
		retenues = append(retenues, ligne)
	}

	totalesIgnorees := ignoreesDoublons + ignoreesBase
	if !c.appliquer {
		return bilanTrancheImport{crees: len(retenues), ignorees: totalesIgnorees, erreurs: erreurs}, nil
	}
	crees, err := persisterGrandPublicImport(ctx, q, c, retenues, deja)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: crees, ignorees: totalesIgnorees + (len(retenues) - crees), erreurs: erreurs}, nil
}

// Téléphone et courriel repèrent la même personne : la plateforme rapproche ses
// inscriptions par l'un puis par l'autre.
func dejaEnBaseGrandPublicImport(ctx context.Context, q *db.Queries, uniques []any,
) (telephones, emails map[string]map[db.Projet]bool, err error) {
	telephones, emails = map[string]map[db.Projet]bool{}, map[string]map[db.Projet]bool{}
	clesTelephone := make([]string, 0, len(uniques))
	clesEmail := make([]string, 0, len(uniques))
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		clesTelephone = append(clesTelephone, ligne.telephone)
		if ligne.email != nil {
			clesEmail = append(clesEmail, *ligne.email)
		}
	}
	for _, lot := range lotsImport(clesTelephone) {
		connus, err := q.ImportProspectsConnus(ctx, lot)
		if err != nil {
			return nil, nil, err
		}
		for _, ligne := range connus {
			telephones[ligne.PhoneE164] = projetsPortesImport(ligne.Projet, ligne.ParcoursGp, ligne.ParcoursChues)
		}
	}
	for _, lot := range lotsImport(clesEmail) {
		connus, err := q.ImportProspectsConnusParEmail(ctx, lot)
		if err != nil {
			return nil, nil, err
		}
		for _, ligne := range connus {
			emails[ligne.Email] = projetsPortesImport(ligne.Projet, ligne.ParcoursGp, ligne.ParcoursChues)
		}
	}
	return telephones, emails, nil
}

func projetsPortesImport(projet db.Projet, parcoursGp, parcoursChues bool) map[db.Projet]bool {
	return map[db.Projet]bool{
		db.ProjetGRANDPUBLIC: parcoursGp || projet == db.ProjetGRANDPUBLIC,
		db.ProjetCHUES:       parcoursChues || projet == db.ProjetCHUES,
	}
}

// Deux numéros pour une seule adresse, c'est la même personne qui a rempli deux
// fois le formulaire : la seconde ligne est signalée, jamais écrite.
func doublonEmailGrandPublicImport(ligne *ligneGrandPublicImport, etat *etatGrandPublicImport,
	connus map[string]map[db.Projet]bool,
) *erreurLigneImport {
	if ligne.email == nil {
		return nil
	}
	colonne := enteteGrandPublicImport(19)
	if precedente, deja := etat.emails[*ligne.email]; deja {
		return refusImport(ligne.numero, colonne, "PROSPECT_GP_IMPORT_EMAIL_DOUBLON_FICHIER",
			fmt.Sprintf("Cette adresse figure déjà à la ligne %d du fichier.", precedente))
	}
	etat.emails[*ligne.email] = ligne.numero
	if connus[*ligne.email][ligne.projet] {
		return refusImport(ligne.numero, colonne, "PROSPECT_GP_IMPORT_EMAIL_DEJA_EN_BASE",
			fmt.Sprintf("Cette adresse porte déjà un prospect %s en base.", libelleProjetImport(ligne.projet)))
	}
	return nil
}

func persisterGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport,
	retenues []ligneGrandPublicImport, connus map[string]map[db.Projet]bool,
) (int, error) {
	maintenant := time.Now()
	var fiches []db.InsertImportProspectGrandPublicParams
	telephones := make([]string, 0, len(retenues))
	projets := make(map[string]db.Projet, len(retenues))
	for i := range retenues {
		ligne := &retenues[i]
		telephones = append(telephones, ligne.telephone)
		projets[ligne.telephone] = ligne.projet
		if _, existe := connus[ligne.telephone]; existe {
			continue
		}
		statut, numero := whatsappGrandPublicImport(ligne.whatsapp, ligne.telephone)
		saisieLe := maintenant
		if ligne.dateLead != nil {
			saisieLe = *ligne.dateLead
		}
		fiches = append(fiches, db.InsertImportProspectGrandPublicParams{
			ID: identifiantImport(), Projet: ligne.projet, Email: ligne.email, ImportJobID: &c.jobID,
			Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: ligne.telephone,
			Profession: ligne.profession, SyndicatID: ligne.syndicatID, BanqueID: ligne.banqueID,
			Type: ligne.typeProspect, DureeSystemeMois: ligne.dureeSystemeMois, CanalProvenanceID: ligne.canalID,
			EmployeurID: ligne.employeurID, Employeur: ligne.employeur, TypeContrat: ligne.typeContrat,
			AncienneteMois: ligne.ancienneteMois, LieuActivite: ligne.lieuActivite, ModeEpargne: ligne.modeEpargne,
			PaysResidenceID: ligne.paysID, VilleResidence: ligne.villeResidence,
			WhatsappStatus: statut, WhatsappE164: numero, RelaisNom: ligne.relaisNom,
			RelaisPhoneE164: ligne.relaisTel, CreatedByID: c.demandeur, ClientCreatedAt: saisieLe,
		})
	}
	if len(fiches) > 0 {
		if err := executerLotImport(q.InsertImportProspectGrandPublic(ctx, fiches).Exec); err != nil {
			return 0, err
		}
	}
	prospects, err := q.ImportProspectsParTelephone(ctx, telephones)
	if err != nil {
		return 0, err
	}
	if len(prospects) == 0 {
		return 0, nil
	}
	parcours := make([]db.InsertImportProspectJourneyParams, len(prospects))
	identifiants := make([]string, len(prospects))
	for i, prospect := range prospects {
		identifiants[i] = identifiantImport()
		parcours[i] = db.InsertImportProspectJourneyParams{
			ID: identifiants[i], ProspectID: prospect.ID,
			Projet: projets[prospect.PhoneE164], ConsentAt: &maintenant,
		}
	}
	if err := executerLotImport(q.InsertImportProspectJourney(ctx, parcours).Exec); err != nil {
		return 0, err
	}
	ecrits, err := q.ImportJourneysEcrits(ctx, identifiants)
	return int(ecrits), err
}

// EB-23 : le statut se déduit du numéro, et le CHECK reste tenu.
func whatsappGrandPublicImport(numero *string, telephone string) (statut db.WhatsappStatus, whatsapp *string) {
	switch {
	case numero == nil:
		return db.WhatsappStatusNONDEMANDE, nil
	case *numero == telephone:
		return db.WhatsappStatusMEMENUMERO, nil
	}
	return db.WhatsappStatusAUTRENUMERO, numero
}

// Le registre des visites vit dans `imports_adaptateurs_visites.go`.
