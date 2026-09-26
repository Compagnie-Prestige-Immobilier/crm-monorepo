package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"regexp"
	"slices"
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
			ligneEntete: 1, premiereDonnee: 2, toutesFeuilles: true, exemples: exemplesGrandPublicImport(),
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
			erreurs = append(erreurs, erreurLigneImport{
				RowNumber: numero, Column: &colonne, Code: code,
				Message: fmt.Sprintf(messageDoublonFichierImport, precedente),
			})
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
	statutImportJoint         = "AUTRE_JOINT"
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
		exports.ExportLibelleJoint: statutImportJoint, exports.ExportLibelleInjoignable: "AUTRE_NON_JOINT", exports.ExportLibelleRefus: "REFUSE",
		exports.ExportLibelleFauxNumero: "FAUX_NUMERO", libelleAutreImport: statutImportJoint,
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
	statutCode  string
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
	statutCode := statutImportJoint
	if strings.TrimSpace(brutIssue) != "" {
		valeur, connu := issuesImport[cleImport(brutIssue)]
		if !connu {
			return nil, refusImport(numero, EnteteRepresentantImport(10), "CALL_OUTCOME_UNKNOWN", "Issue d’appel inconnue. Joint, Injoignable, Refus, Faux numéro ou Autre.")
		}
		statutCode = valeur
	}
	commentaire := couperImport(strings.TrimSpace(notes), 2_000)
	if cleImport(brutIssue) == cleImport(libelleAutreImport) && commentaire == nil {
		return nil, refusImport(numero, EnteteRepresentantImport(10), "CALL_COMMENT_REQUIRED", "L’issue « Autre » exige une note : sans elle, l’appel n’apprend rien.")
	}
	return &appelImportRep{date: date, statutCode: statutCode, commentaire: commentaire}, nil
}

// Un appel ne se consigne pas dans le futur.
func lireDateAppelImport(brut string) (time.Time, bool) {
	date, ok := lireJourMoisAnImport(brut)
	if !ok || date.After(time.Now()) {
		return time.Time{}, false
	}
	return date, true
}

// Minuit UTC : Dakar est à UTC+0 toute l'année, une conversion de fuseau ferait
// glisser la date d'un jour sur une machine européenne.
func lireJourMoisAnImport(brut string) (time.Time, bool) {
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
	if date.Year() != annee || int(date.Month()) != mois || date.Day() != jour {
		return time.Time{}, false
	}
	return date, true
}

func atoiImport(valeur string) int {
	n, _ := strconv.Atoi(valeur)
	return n
}

// Le rang Excel porte l'heure dans sa partie décimale : elle est gardée à la seconde.
func dateRangExcelImport(brut string) (time.Time, bool) {
	texte := strings.TrimSpace(brut)
	f, err := strconv.ParseFloat(texte, 64)
	if err != nil || f < 61 || f > 2_958_465 {
		return time.Time{}, false
	}
	jours := math.Floor(f)
	base := time.Date(1899, time.December, 30, 0, 0, 0, 0, time.UTC).AddDate(0, 0, int(jours))
	return base.Add(time.Duration(math.Round((f-jours)*86_400)) * time.Second), true
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
			erreurs = append(erreurs, *refusImport(ligne.numero, EnteteRepresentantImport(1),
				"DUPLICATE_IN_DATABASE", messageDejaEnBaseImport))
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
	statuts := map[string]string{}
	for i := range retenues {
		ligne := &retenues[i]
		if ligne.appel == nil || !presents[identifiants[i]] {
			continue
		}
		auteur := c.demandeur
		if ligne.proprietaireID != nil {
			auteur = *ligne.proprietaireID
		}
		statutID, connu := statuts[ligne.appel.statutCode]
		if !connu {
			statut, err := q.StatutQualificationParCode(ctx, ligne.appel.statutCode)
			if err != nil {
				return err
			}
			statutID = statut.ID
			statuts[ligne.appel.statutCode] = statutID
		}
		appels = append(appels, db.InsertImportRepCallAttemptParams{
			ID: identifiantImport(), RepresentantID: identifiants[i], PerformedByID: auteur,
			StatutQualificationID: statutID, Comment: ligne.appel.commentaire, ClientCreatedAt: ligne.appel.date,
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

// ------------------------------------------------------------ grand public

const (
	enteteNomCompletImport      = "Nom complet"
	enteteProvenanceImport      = "Provenance"
	enteteReponseProspectImport = "Réponse du prospect"
	remarqueImportMax           = 500

	codeDateCorrigeeImport   = "PROSPECT_GP_IMPORT_DATE_CORRIGEE"
	codeCanalAVerifierImport = "PROSPECT_GP_IMPORT_CANAL_A_VERIFIER"
	codeSansIdentiteImport   = "PROSPECT_GP_IMPORT_LIGNE_SANS_IDENTITE"
	codeSansTelephoneImport  = "PROSPECT_GP_IMPORT_LIGNE_SANS_TELEPHONE"
	codeDejaEnBaseImport     = "PROSPECT_GP_IMPORT_DEJA_EN_BASE"
	codePerdueImport         = "PROSPECT_GP_IMPORT_PERDUE_A_L_ECRITURE"
	codeRemplaceeImport      = "PROSPECT_GP_IMPORT_LIGNE_REMPLACEE"
	codePlateformeImport     = "PROSPECT_GP_IMPORT_LIGNE_PLATEFORME"
)

// Les deux plateformes d'enrôlement, telles que cleImport les écrit
// (docs/decisions/fiches-plateforme.md).
var hotesPlateformeImport = []string{"monespace cpi chues com", "monespace cpi sn"}

var colonnesGrandPublicImport = []colonneImport{
	{entete: exports.ExportEntetePrenom, alias: []string{"Prénoms"}},
	// Pas « requise » : « Nom complet » la remplace, et le refus se dit ligne à ligne.
	{entete: exports.ExportEnteteNom, alias: []string{"Nom de famille", "Noms"}},
	{entete: enteteTelephoneImport, alias: []string{"Tel", "Numéro", "Numéro de téléphone", "Contact"}},
	{entete: exports.ExportEnteteProfession, alias: []string{"Métier", "Activité", "Poste", "JOB_TITLE"}},
	{entete: exports.ExportEnteteSyndicat},
	{entete: "Banque de domiciliation", alias: []string{libelleBanqueImport, "Domiciliation"}},
	{entete: "Fonctionnaire (oui/non)", alias: []string{"Fonctionnaire"}},
	{entete: "Durée système", alias: []string{"Durée du système", "Durée système de paiement", "Durée (mois)"}},
	// « Canal » seul décide : « Provenance » (Payé, fb, ig) ne fait que nommer un canal de repli.
	{entete: exports.ExportEnteteCanalProvenance, alias: []string{"Canal"}},
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
	{entete: enteteCourrielImport, alias: []string{"E-mail", "Email", "Courriel", "Adresse e-mail"}},
	{entete: enteteNomCompletImport, alias: []string{"Nom et prénom", "Prénom et nom", "Nom du prospect"}},
	{entete: enteteCreeLeImport, alias: []string{"Date du lead", "Date de création", "Créé le", "Date", "CREATED_TIME"}},
	{entete: enteteEtapeImport, alias: []string{"Statut"}},
	{entete: enteteProvenanceImport, alias: []string{"Source"}},
	{entete: enteteReponseProspectImport, alias: []string{"Réponse", "Remarque", "Commentaire"}},
}

func enteteGrandPublicImport(rang int) string { return colonnesGrandPublicImport[rang].entete }

// Les six dernières colonnes n'existent pas dans le modèle : elles n'ont pas
// d'exemple à reconnaître.
func exemplesGrandPublicImport() []string {
	return append(exports.ExemplesGrandPublic(), "", "", "", "", "", "")
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
	etapesImport       = tableLibellesImport(map[string]string{
		libelleAEvaluerImport: string(db.ProspectStatutNOUVEAU), "Nouveau": string(db.ProspectStatutNOUVEAU),
		libelleQualifieImport: string(db.ProspectStatutCONTACTE), "Contacté": string(db.ProspectStatutCONTACTE),
		"Converti": string(db.ProspectStatutCONVERTI), "Perdu": string(db.ProspectStatutPERDU),
	})
	choixEtapeImport = []string{libelleAEvaluerImport, libelleQualifieImport, "Converti", "Perdu"}
	// Jour d'abord, comme tout classeur d'ici ; les exports Meta, en américain et
	// en 12 heures, passent ensuite. Le jour de l'onglet tranche les ambiguïtés.
	formatsCreeLeImport = []string{
		"02/01/2006 15:04", "02/01/2006 3:04pm", "01/02/2006 3:04pm", "01/02/2006 15:04",
		"2006-01-02 15:04", "2006-01-02",
	}
	emailImport = regexp.MustCompile(`[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)
)

type ligneGrandPublicImport struct {
	numero                                                 int
	nom, prenom                                            string
	telephone, email                                       *string
	projet                                                 db.Projet
	creeLe                                                 time.Time
	statut                                                 db.ProspectStatut
	profession, syndicatID, banqueID, canalID              *string
	typeProspect                                           *db.ProspectType
	dureeSystemeMois, ancienneteMois                       *int32
	employeurID, employeur, lieuActivite                   *string
	typeContrat                                            *db.TypeContrat
	modeEpargne                                            *db.ModeEpargne
	paysID, villeResidence, whatsapp, relaisNom, relaisTel *string
	feuille, remarque                                      *string
	// Le Canal cite une plateforme d'enrôlement : la personne n'existe que
	// là-bas, sa ligne se compte sans jamais entrer dans les fiches.
	plateforme bool
	// Ni nom ni téléphone : rien à rattacher, la ligne se signale sans s'écrire.
	vide           bool
	avertissements []erreurLigneImport
}

type etatGrandPublicImport struct {
	region                       string
	vus                          map[string]int
	emails                       map[string]int
	banques, syndicats           map[string]string
	banqueLabels, syndicatLabels []string
	canaux                       map[string]string
	// Les clés triées : deux relevés du même classeur donnent le même canal.
	clesCanaux  []string
	canalLabels []string
	regles      []regleProvenanceImport
	// L'onglet qui a livre un numero le premier : les suivants le re-livrent.
	premiereFeuille map[string]string
	employeurs      map[string]string
	pays            map[string]string
	paysLabels      []string
}

type connuImport struct {
	id     string
	projet db.Projet
}

// `sure` : une règle ou un libellé exact a parlé ; sinon le canal est deviné et le projet reste à vérifier.
type provenanceImport struct {
	canalID *string
	projet  db.Projet
	sure    bool
}

type triGrandPublicImport struct {
	nouvelles, connues []ligneGrandPublicImport
	ignorees           int
	avertissements     []erreurLigneImport
}

func (t *triGrandPublicImport) ignorer(ligne *erreurLigneImport) {
	t.ignorees++
	t.avertissements = append(t.avertissements, *ligne)
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
		premiereFeuille: map[string]string{},
		banques:         banques.index, banqueLabels: banques.libelles,
		syndicats: syndicats.index, syndicatLabels: syndicats.libelles,
		canaux: map[string]string{}, employeurs: map[string]string{}, pays: map[string]string{},
	}
	for _, ligne := range canaux {
		indexerLibellesImport(etat.canaux, ligne.ID, ligne.Label, ligne.Code)
		etat.canalLabels = append(etat.canalLabels, ligne.Label)
	}
	etat.clesCanaux = slices.Sorted(maps.Keys(etat.canaux))
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

// AUCUNE colonne n'est exigée : un lead Messenger ne donne qu'un nom, et une
// cellule vide est une information qu'on n'a pas encore. Seule une valeur
// écrite mais inexploitable refuse la ligne.
func lireGrandPublicImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatGrandPublicImport)
	nom, prenom, telephone, refus := identiteGrandPublicImport(cellules, numero, etat)
	if refus != nil {
		return nil, refus
	}
	if nom == "" && telephone == nil {
		return ligneGrandPublicImport{numero: numero, vide: true}, nil
	}
	statut, refus := etapeGrandPublicImport(cellules[enteteGrandPublicImport(22)], numero)
	if refus != nil {
		return nil, refus
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
		numero: numero, nom: nom, prenom: prenom,
		telephone: telephone, email: emailGrandPublicImport(cellules[enteteGrandPublicImport(19)]),
		statut:     statut,
		profession: couperImport(cellules[enteteGrandPublicImport(3)], 120),
		syndicatID: syndicatID, banqueID: banqueID,
		typeProspect: typeProspect, dureeSystemeMois: duree,
		feuille:  couperImport(cellules[feuilleImport], 200),
		remarque: couperImport(cellules[enteteGrandPublicImport(24)], remarqueImportMax),
	}
	provenanceEtDateGrandPublicImport(&ligne, cellules, etat)
	if refus := completerSituationGrandPublicImport(&ligne, cellules, numero, etat); refus != nil {
		return nil, refus
	}
	return ligne, nil
}

// Un lead Messenger ne donne qu'un nom, sans numéro : les deux se valident
// séparément, et une ligne vide des deux côtés n'est pas une erreur.
func identiteGrandPublicImport(cellules map[string]string, numero int, etat *etatGrandPublicImport,
) (nom, prenom string, telephone *string, refus *erreurLigneImport) {
	nom, prenom = nomGrandPublicImport(cellules)
	telephone, refus = telephoneFacultatifImport(cellules[enteteGrandPublicImport(2)], etat.region, numero,
		enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_TELEPHONE_ILLISIBLE",
		"Numéro de téléphone inexploitable : « %s ». Laissez la cellule vide si vous ne l'avez pas.")
	if refus != nil {
		return "", "", nil, refus
	}
	if nom == "" && telephone != nil {
		return "", "", nil, refusImport(numero, enteteGrandPublicImport(1), "PROSPECT_GP_IMPORT_NOM_ABSENT",
			"Le nom est obligatoire : une colonne « Nom », ou une colonne « Nom complet » dont le dernier mot est le nom de famille.")
	}
	return nom, prenom, telephone, nil
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
	uniques, ignoreesDoublons, erreursDoublons := doublonsDansLeFichierImport(lignes, etat.vus,
		func(v any) (string, int) {
			ligne := v.(ligneGrandPublicImport)
			return cleDoublonGrandPublicImport(&ligne), ligne.numero
		},
		enteteGrandPublicImport(2), "PROSPECT_GP_IMPORT_DOUBLON_DANS_LE_FICHIER")

	deja, dejaEmail, err := dejaEnBaseGrandPublicImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	tri := trierGrandPublicImport(uniques, deja, dejaEmail, etat)
	compterFeuillesGrandPublicImport(c.feuilles, lignes, uniques, etat.premiereFeuille)
	bilan := bilanTrancheImport{
		ignorees: ignoreesDoublons + tri.ignorees, avertissements: append(erreursDoublons, tri.avertissements...),
	}
	if !c.appliquer {
		bilan.crees, bilan.misAJour = len(tri.nouvelles), len(tri.connues)
		return bilan, nil
	}
	crees, perdues, err := persisterGrandPublicImport(ctx, q, c, tri.nouvelles)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	misAJour, inchangees, err := mettreAJourGrandPublicImport(ctx, q, c, tri.connues, deja)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	bilan.crees, bilan.misAJour = crees, misAJour
	bilan.ignorees += len(perdues) + len(inchangees)
	bilan.avertissements = append(append(bilan.avertissements, perdues...), inchangees...)
	return bilan, nil
}

// Un même numéro dans un même onglet est une faute de saisie ; sur un onglet
// plus tard dans le classeur, c'est une nouvelle du jour qui met la fiche à jour.
func cleDoublonGrandPublicImport(ligne *ligneGrandPublicImport) string {
	telephone := telephoneConnuImport(ligne.telephone)
	if telephone == "" || ligne.feuille == nil {
		return telephone
	}
	return telephone + "|" + *ligne.feuille
}

// Une ligne sans identité et une adresse déjà prise se signalent sans s'écrire ;
// un numéro connu se met à jour, le reste se crée. Un numéro repris plus loin
// dans la même tranche remplace sa première ligne : la dernière fait foi.
func trierGrandPublicImport(uniques []any, deja map[string]connuImport,
	dejaEmail map[string]map[db.Projet]bool, etat *etatGrandPublicImport,
) triGrandPublicImport {
	var tri triGrandPublicImport
	rangNouvelle := map[string]int{}
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		switch {
		case ligne.vide:
			tri.ignorer(refusImport(ligne.numero, enteteGrandPublicImport(2), codeSansIdentiteImport,
				"Ni nom ni téléphone : rien à rattacher, la ligne est ignorée."))
			continue
		case ligne.telephone == nil:
			tri.ignorer(refusImport(ligne.numero, enteteGrandPublicImport(2), codeSansTelephoneImport,
				"Sans téléphone, personne ne peut appeler cette fiche : la ligne est ignorée."))
			continue
		case ligne.plateforme:
			tri.ignorer(refusImport(ligne.numero, enteteGrandPublicImport(8), codePlateformeImport,
				"Inscrit sur une plateforme d’enrôlement : le suivi s’y fait, la ligne n’entre pas dans les fiches."))
			continue
		case deja[telephoneConnuImport(ligne.telephone)].id != "":
			tri.connues = append(tri.connues, ligne)
		default:
			if refus := doublonEmailGrandPublicImport(&ligne, etat, dejaEmail); refus != nil {
				tri.ignorer(refus)
				continue
			}
			tri.retenirNouvelle(&ligne, rangNouvelle)
		}
		tri.avertissements = append(tri.avertissements, ligne.avertissements...)
	}
	return tri
}

func (t *triGrandPublicImport) retenirNouvelle(ligne *ligneGrandPublicImport, rangs map[string]int) {
	telephone := telephoneConnuImport(ligne.telephone)
	if rang, deja := rangs[telephone]; telephone != "" && deja {
		precedente := t.nouvelles[rang]
		t.ignorer(refusImport(precedente.numero, enteteGrandPublicImport(2), codeRemplaceeImport,
			fmt.Sprintf("Ce numéro revient à la ligne %d, qui fait foi.", ligne.numero)))
		// Comme d'une tranche à l'autre, où la fiche déjà créée garde son projet :
		// sans cela le résultat dépendrait de IMPORTS_CHUNK_SIZE.
		remplacante := *ligne
		remplacante.projet, remplacante.creeLe = precedente.projet, precedente.creeLe
		t.nouvelles[rang] = remplacante
		return
	}
	if telephone != "" {
		rangs[telephone] = len(t.nouvelles)
	}
	t.nouvelles = append(t.nouvelles, *ligne)
}

// Téléphone et courriel repèrent la même personne : la plateforme rapproche ses
// inscriptions par l'un puis par l'autre.
func dejaEnBaseGrandPublicImport(ctx context.Context, q *db.Queries, uniques []any,
) (telephones map[string]connuImport, emails map[string]map[db.Projet]bool, err error) {
	telephones, emails = map[string]connuImport{}, map[string]map[db.Projet]bool{}
	clesTelephone := make([]string, 0, len(uniques))
	clesEmail := make([]string, 0, len(uniques))
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		if ligne.telephone != nil {
			clesTelephone = append(clesTelephone, *ligne.telephone)
		}
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
			telephones[telephoneConnuImport(ligne.PhoneE164)] = connuImport{id: ligne.ID, projet: ligne.Projet}
		}
	}
	for _, lot := range lotsImport(clesEmail) {
		connus, err := q.ImportProspectsConnusParEmail(ctx, lot)
		if err != nil {
			return nil, nil, err
		}
		for _, ligne := range connus {
			cumulerProjetsPortesImport(emails, ligne.Email, projetsPortesImport(ligne.Projet, ligne.ParcoursGp, ligne.ParcoursChues))
		}
	}
	return telephones, emails, nil
}

// Deux fiches peuvent partager une adresse, une par projet : écraser la carte
// laissait repasser la ligne du projet lu en premier, et le relevé horaire des
// leads recréait la même personne à chaque passage.
func cumulerProjetsPortesImport(connus map[string]map[db.Projet]bool, email string, portes map[db.Projet]bool) {
	cumul, deja := connus[email]
	if !deja {
		connus[email] = portes
		return
	}
	for projet, porte := range portes {
		cumul[projet] = cumul[projet] || porte
	}
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

// Les fiches créées ici portent un identifiant que NOUS tenons : le relire par
// téléphone laisserait de côté celles qui n'en ont pas. Une fiche que l'insert
// n'a pas écrite (numéro pris entre-temps) se signale au lieu de disparaître.
func persisterGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport,
	nouvelles []ligneGrandPublicImport,
) (int, []erreurLigneImport, error) {
	if len(nouvelles) == 0 {
		return 0, nil, nil
	}
	maintenant := time.Now()
	fiches := make([]db.InsertImportProspectGrandPublicParams, 0, len(nouvelles))
	parLigne := make(map[string]*ligneGrandPublicImport, len(nouvelles))
	for i := range nouvelles {
		ligne := &nouvelles[i]
		identifiant := identifiantImport()
		parLigne[identifiant] = ligne
		statut, numero := whatsappGrandPublicImport(ligne.whatsapp, ligne.telephone)
		fiches = append(fiches, db.InsertImportProspectGrandPublicParams{
			ID: identifiant, Projet: ligne.projet, Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: ligne.telephone,
			Email: ligne.email, Statut: ligne.statut,
			Profession: ligne.profession, SyndicatID: ligne.syndicatID, BanqueID: ligne.banqueID,
			Type: ligne.typeProspect, DureeSystemeMois: ligne.dureeSystemeMois, CanalProvenanceID: ligne.canalID,
			EmployeurID: ligne.employeurID, Employeur: ligne.employeur, TypeContrat: ligne.typeContrat,
			AncienneteMois: ligne.ancienneteMois, LieuActivite: ligne.lieuActivite, ModeEpargne: ligne.modeEpargne,
			PaysResidenceID: ligne.paysID, VilleResidence: ligne.villeResidence,
			WhatsappStatus: statut, WhatsappE164: numero, RelaisNom: ligne.relaisNom,
			RelaisPhoneE164: ligne.relaisTel, CreatedByID: c.demandeur,
			ClientCreatedAt: ligne.creeLe, ImportJobID: &c.jobID, ImportFeuille: ligne.feuille,
			RemarqueImport: ligne.remarque,
		})
	}
	if err := executerLotImport(q.InsertImportProspectGrandPublic(ctx, fiches).Exec); err != nil {
		return 0, nil, err
	}
	ecrits, err := q.ImportProspectsGrandPublicEcrits(ctx, slices.Collect(maps.Keys(parLigne)))
	if err != nil {
		return 0, nil, err
	}
	parcours := make([]db.InsertImportProspectJourneyParams, 0, len(ecrits))
	for _, id := range ecrits {
		parcours = append(parcours, db.InsertImportProspectJourneyParams{
			ID: identifiantImport(), ProspectID: id, Projet: parLigne[id].projet, ConsentAt: &maintenant,
		})
	}
	if len(parcours) > 0 {
		if err := executerLotImport(q.InsertImportProspectJourney(ctx, parcours).Exec); err != nil {
			return 0, nil, err
		}
	}
	return len(ecrits), fichesPerduesImport(parLigne, ecrits), nil
}

func fichesPerduesImport(parLigne map[string]*ligneGrandPublicImport, ecrits []string) []erreurLigneImport {
	vus := make(map[string]bool, len(ecrits))
	for _, id := range ecrits {
		vus[id] = true
	}
	var perdues []erreurLigneImport
	for id, ligne := range parLigne {
		if !vus[id] {
			perdues = append(perdues, *refusImport(ligne.numero, enteteGrandPublicImport(2), codePerdueImport,
				"Ce numéro a été écrit par un autre geste pendant l’import : la ligne est ignorée, relancez le relevé."))
		}
	}
	slices.SortFunc(perdues, func(a, b erreurLigneImport) int { return a.RowNumber - b.RowNumber })
	return perdues
}

func mettreAJourGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport,
	connues []ligneGrandPublicImport, deja map[string]connuImport,
) (misAJour int, inchangees []erreurLigneImport, err error) {
	for i := range connues {
		ligne := &connues[i]
		changee, err := mettreAJourFicheGrandPublicImport(ctx, q, c, ligne, deja[telephoneConnuImport(ligne.telephone)])
		if err != nil {
			return 0, nil, err
		}
		if !changee {
			inchangees = append(inchangees, *refusImport(ligne.numero, enteteGrandPublicImport(2), codeDejaEnBaseImport,
				"Ce numéro a déjà sa fiche, et la ligne ne lui apprend rien de neuf."))
			continue
		}
		misAJour++
	}
	return misAJour, inchangees, nil
}

// Une fiche connue garde son projet : le classeur recodifie parfois le même
// numéro d'un onglet à l'autre, et chaque relevé la sortait de sa campagne.
// Canal et note du classeur suivent la dernière ligne lue.
func mettreAJourFicheGrandPublicImport(ctx context.Context, q *db.Queries, c contexteImport,
	ligne *ligneGrandPublicImport, connue connuImport,
) (bool, error) {
	maintenant := time.Now()
	parcours := []db.InsertImportProspectJourneyParams{{ID: identifiantImport(), ProspectID: connue.id, Projet: connue.projet, ConsentAt: &maintenant}}
	if err := executerLotImport(q.InsertImportProspectJourney(ctx, parcours).Exec); err != nil {
		return false, err
	}
	rangs, err := q.ImportMettreAJourProspectGrandPublic(ctx, db.ImportMettreAJourProspectGrandPublicParams{
		ID: connue.id, CanalProvenanceID: ligne.canalID, RemarqueImport: ligne.remarque,
		Nom: ligne.nom, Prenom: ligne.prenom, Email: ligne.email,
	})
	if err != nil || rangs == 0 {
		return false, err
	}
	if err := database.Auditer(ctx, q, c.demandeur, "prospect.import", "prospect", connue.id, nil,
		map[string]any{
			"canalProvenanceId": ligne.canalID, "remarqueImport": ligne.remarque,
			"onglet": ligne.feuille,
		}); err != nil {
		return false, err
	}
	return true, nil
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
