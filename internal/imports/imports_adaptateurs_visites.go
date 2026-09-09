package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/accueil"
	"cpi-go/internal/shared/database"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var colonnesVisitesImport = []colonneImport{
	{entete: accueil.EnteteDate, requise: true},
	{entete: accueil.EnteteHeure},
	{entete: accueil.EnteteNom, requise: true},
	{entete: "TELEPHONES"},
	{entete: "ENTREPRISE", requise: true},
	{entete: "DIRECTION"},
	{entete: accueil.EnteteDestinataire},
	{entete: accueil.EnteteObjetMalOrthographie, requise: true},
	{entete: "COMMENTAIRES / NOTES"},
}

func enteteVisiteImport(rang int) string { return colonnesVisitesImport[rang].entete }

var (
	listesVisitesImport = map[string]string{
		attenduEntrepriseImport: "ENTREPRISES", attenduDirectionImport: "DIRECTIONS &/OU NIVEAU",
		attenduDestinataireImport: accueil.EnteteDestinataire, attenduObjetImport: accueil.EnteteObjetMalOrthographie,
	}
	codesVisitesImport = map[string]string{
		attenduEntrepriseImport: "VISITE_IMPORT_ENTREPRISE_INCONNUE", attenduDirectionImport: "VISITE_IMPORT_DIRECTION_INCONNUE",
		attenduDestinataireImport: "VISITE_IMPORT_DESTINATAIRE_INCONNU", attenduObjetImport: "VISITE_IMPORT_OBJET_INCONNU",
	}
	telephoneApparentImport = regexp.MustCompile(`^\+?\d[\d\s.-]{5,}$`)
	referenceVisiteImport   = regexp.MustCompile(`^V-(\d{4})-(\d{6})$`)
	heureMinuteImport       = regexp.MustCompile(`(?i)^(\d{1,2})\s*[h:]\s*(\d{2})\s*h?$`)
	heureSeuleImport        = regexp.MustCompile(`(?i)^(\d{1,2})\s*h?$`)
	dateIsoImport           = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}`)
)

// La liste déroulante du classeur porte ce libellé tronqué depuis l'origine.
var aliasClasseurVisitesImport = map[string]string{
	cleImport("ACHAT PRODUITS SANTARGILE ET/OU MAK"): "ACHAT_PRODUITS",
}

type ligneVisiteImport struct {
	numero                                   int
	onglet, date, nom                        string
	heure                                    *string
	telephone, telephoneE164                 *string
	entrepriseID, objetID                    string
	directionID, destinataireID, commentaire *string
}

type etatVisitesImport struct {
	region                                         string
	vus                                            map[string]ligneVisiteImport
	entreprises, directions, destinataires, objets map[string]entreeReferentielImport
	proprietaires                                  map[string]string
}

func preparerVisitesImport(ctx context.Context, q *db.Queries, c contexteImport) (any, error) {
	lignes, err := q.ImportReferentielsVisite(ctx)
	if err != nil {
		return nil, err
	}
	etat := &etatVisitesImport{
		region: c.region, vus: map[string]ligneVisiteImport{},
		entreprises: map[string]entreeReferentielImport{}, directions: map[string]entreeReferentielImport{},
		destinataires: map[string]entreeReferentielImport{}, objets: map[string]entreeReferentielImport{},
		proprietaires: map[string]string{},
	}
	index := map[string]map[string]entreeReferentielImport{
		"entreprises": etat.entreprises, "directions": etat.directions,
		"destinataires": etat.destinataires, "objets de visite": etat.objets,
	}
	for _, ligne := range lignes {
		entree := entreeReferentielImport{id: ligne.ID, libelle: ligne.Label}
		for _, cle := range []string{cleImport(ligne.Label), cleImport(ligne.Code)} {
			if cle == "" {
				continue
			}
			index[ligne.Liste][cle] = entree
			if _, deja := etat.proprietaires[cle]; !deja {
				etat.proprietaires[cle] = ligne.Liste
			}
		}
	}
	return etat, nil
}

func lireVisiteImport(cellules map[string]string, numero int, brut any) (any, *erreurLigneImport) {
	etat := brut.(*etatVisitesImport)
	onglet := cellules[feuilleImport]

	brutDate := cellules[enteteVisiteImport(0)]
	if brutDate == "" {
		return nil, refusVisiteImport(numero, onglet, enteteVisiteImport(0), "VISITE_IMPORT_DATE_ABSENTE", "la date de la visite manque.")
	}
	date, lisible := lireDateFeuilleImport(brutDate)
	if !lisible {
		return nil, refusVisiteImport(numero, onglet, enteteVisiteImport(0), "VISITE_IMPORT_DATE_ILLISIBLE",
			fmt.Sprintf("« %s » n’est pas une date. Saisissez une vraie date Excel.", brutDate))
	}
	brutHeure := cellules[enteteVisiteImport(1)]
	heure := lireHeureFeuilleImport(brutHeure)
	if brutHeure != "" && heure == nil {
		return nil, refusVisiteImport(numero, onglet, enteteVisiteImport(1), "VISITE_IMPORT_HEURE_ILLISIBLE",
			fmt.Sprintf("« %s » ne se lit pas comme une heure. Écrivez 11H08, ou laissez vide.", brutHeure))
	}
	nom := cellules[enteteVisiteImport(2)]
	if len([]rune(nom)) < 2 {
		return nil, refusVisiteImport(numero, onglet, enteteVisiteImport(2), "VISITE_IMPORT_NOM_ABSENT", "le nom du visiteur manque.")
	}
	entrees, refus := referentielsDeLaVisiteImport(cellules, numero, onglet, etat)
	if refus != nil {
		return nil, refus
	}

	brutTelephone := cellules[enteteVisiteImport(3)]
	ligne := ligneVisiteImport{
		numero: numero, onglet: onglet, date: date, heure: heure,
		nom:          string([]rune(nom)[:min(160, len([]rune(nom)))]),
		telephone:    couperImport(brutTelephone, 40),
		entrepriseID: entrees[0].id, objetID: entrees[3].id,
		commentaire: couperImport(cellules[enteteVisiteImport(8)], 2_000),
	}
	if e164, err := database.NormaliserTelephone(brutTelephone, etat.region); err == nil {
		ligne.telephoneE164 = &e164
	}
	if entrees[1] != nil {
		ligne.directionID = &entrees[1].id
	}
	if entrees[2] != nil {
		ligne.destinataireID = &entrees[2].id
	}
	return ligne, nil
}

// Entreprise, direction, destinataire, objet : dans cet ordre, les deux
// premières et la dernière colonnes sont obligatoires.
func referentielsDeLaVisiteImport(cellules map[string]string, numero int, onglet string,
	etat *etatVisitesImport,
) ([4]*entreeReferentielImport, *erreurLigneImport) {
	attendus := [4]struct {
		rang    int
		index   map[string]entreeReferentielImport
		attendu string
		requis  bool
	}{
		{4, etat.entreprises, attenduEntrepriseImport, true},
		{5, etat.directions, attenduDirectionImport, false},
		{6, etat.destinataires, attenduDestinataireImport, false},
		{7, etat.objets, attenduObjetImport, true},
	}
	var entrees [4]*entreeReferentielImport
	for i, a := range attendus {
		entree, refus := referentielVisiteImport(cellules[enteteVisiteImport(a.rang)], a.index, etat,
			numero, onglet, enteteVisiteImport(a.rang), a.attendu, a.requis)
		if refus != nil {
			return entrees, refus
		}
		entrees[i] = entree
	}
	return entrees, nil
}

func refusVisiteImport(numero int, onglet, colonne, code, detail string) *erreurLigneImport {
	if onglet != "" {
		detail = fmt.Sprintf("Onglet « %s » : %s", onglet, detail)
	}
	return refusImport(numero, colonne, code, detail)
}

// Les deux classeurs portent des téléphones sous la mauvaise colonne : dire
// « inconnu » ferait chercher une entrée à ajouter là où la ligne est décalée.
func referentielVisiteImport(brut string, index map[string]entreeReferentielImport, etat *etatVisitesImport,
	numero int, onglet, colonne, attendu string, requis bool,
) (*entreeReferentielImport, *erreurLigneImport) {
	cle := cleImport(brut)
	if entree, connu := index[cle]; connu && cle != "" {
		return &entree, nil
	}
	if entree, connu := index[cleImport(aliasClasseurVisitesImport[cle])]; connu && cle != "" {
		return &entree, nil
	}
	if cle == "" && !requis {
		return nil, nil
	}
	if brut == "" {
		return nil, refusVisiteImport(numero, onglet, colonne, codesVisitesImport[attendu],
			fmt.Sprintf("la colonne %s est vide, elle est obligatoire.", listesVisitesImport[attendu]))
	}
	if telephoneApparentImport.MatchString(brut) {
		quoi := "une " + attendu
		if attendu == attenduObjetImport {
			quoi = "un objet de visite"
		}
		return nil, refusVisiteImport(numero, onglet, colonne, "VISITE_IMPORT_COLONNES_DECALEES",
			fmt.Sprintf("« %s » est un numéro de téléphone, pas %s. Les colonnes de cette ligne sont décalées.", brut, quoi))
	}
	if proprietaire, connu := etat.proprietaires[cle]; connu {
		return nil, refusVisiteImport(numero, onglet, colonne, "VISITE_IMPORT_COLONNES_DECALEES",
			fmt.Sprintf("« %s » appartient à la liste des %s, pas à %s. Les colonnes de cette ligne sont décalées.", brut, proprietaire, listesVisitesImport[attendu]))
	}
	return nil, refusVisiteImport(numero, onglet, colonne, codesVisitesImport[attendu],
		fmt.Sprintf("« %s » ne figure pas dans la liste %s. Corrigez la cellule, ou ajoutez l’entrée à la liste avant de relancer.", brut, listesVisitesImport[attendu]))
}

// Le classeur porte des dates numériques : le flux rend le rang brut Excel.
func lireDateFeuilleImport(brut string) (string, bool) {
	if dateIsoImport.MatchString(brut) {
		return brut[:10], true
	}
	rang, err := strconv.Atoi(brut)
	if err != nil || rang < 61 || rang > 2_958_465 {
		return "", false
	}
	origine := time.Date(1899, time.December, 30, 0, 0, 0, 0, time.UTC)
	return origine.AddDate(0, 0, rang).Format("2006-01-02"), true
}

// `11H08`, `11h45`, `12H` et `15` se lisent. `17H5` ne se devine pas.
func lireHeureFeuilleImport(brut string) *string {
	if parts := heureMinuteImport.FindStringSubmatch(brut); parts != nil {
		heure, minute := atoiImport(parts[1]), atoiImport(parts[2])
		if heure < 24 && minute < 60 {
			return pointeurImport(fmt.Sprintf("%02d:%02d", heure, minute))
		}
		return nil
	}
	if parts := heureSeuleImport.FindStringSubmatch(brut); parts != nil {
		if heure := atoiImport(parts[1]); heure < 24 {
			return pointeurImport(fmt.Sprintf("%02d:00", heure))
		}
	}
	return nil
}

// Dakar est à UTC+0 toute l'année : `fromDakarWallClock` et l'UTC coïncident.
func instantVisiteImport(date string, heure *string) time.Time {
	annee, mois, jour := atoiImport(date[:4]), atoiImport(date[5:7]), atoiImport(date[8:10])
	h, m := 0, 0
	if heure != nil {
		h, m = atoiImport((*heure)[:2]), atoiImport((*heure)[3:5])
	}
	return time.Date(annee, time.Month(mois), jour, h, m, 0, 0, time.UTC)
}

func cleVisiteImport(date string, heure *string, nom, entrepriseID string) string {
	texte := ""
	if heure != nil {
		texte = *heure
	}
	return strings.Join([]string{date, texte, cleImport(nom), entrepriseID}, "|")
}

func ecrireVisitesImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	if len(lignes) == 0 {
		return bilanTrancheImport{}, nil
	}
	etat := brut.(*etatVisitesImport)
	var uniques []ligneVisiteImport
	var erreurs []erreurLigneImport
	ignorees := 0
	for _, valeur := range lignes {
		ligne := valeur.(ligneVisiteImport)
		cle := cleVisiteImport(ligne.date, ligne.heure, ligne.nom, ligne.entrepriseID)
		if precedente, deja := etat.vus[cle]; deja {
			ignorees++
			erreurs = append(erreurs, *refusImport(ligne.numero, enteteVisiteImport(2), "VISITE_IMPORT_DOUBLON_DANS_LE_FICHIER",
				fmt.Sprintf("Même visiteur, même entreprise, même instant qu’à la ligne %d de l’onglet « %s ».", precedente.numero, precedente.onglet)))
			continue
		}
		etat.vus[cle] = ligne
		uniques = append(uniques, ligne)
	}

	connues, err := visitesDejaAuRegistreImport(ctx, q, uniques)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	var retenues []ligneVisiteImport
	for i := range uniques {
		ligne := uniques[i]
		if connues[cleVisiteImport(ligne.date, ligne.heure, ligne.nom, ligne.entrepriseID)] {
			ignorees++
			erreurs = append(erreurs, *refusImport(ligne.numero, enteteVisiteImport(2), "VISITE_IMPORT_DEJA_AU_REGISTRE", "Cette visite figure déjà au registre."))
			continue
		}
		retenues = append(retenues, ligne)
	}

	if !c.appliquer || len(retenues) == 0 {
		return bilanTrancheImport{crees: boolIntImport(!c.appliquer) * len(retenues), ignorees: ignorees, erreurs: erreurs}, nil
	}
	ecrites, refus, err := persisterVisitesImport(ctx, q, c, retenues)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: ecrites, ignorees: ignorees + len(retenues) - ecrites, erreurs: append(erreurs, refus...)}, nil
}

func visitesDejaAuRegistreImport(ctx context.Context, q *db.Queries, uniques []ligneVisiteImport) (map[string]bool, error) {
	instants := make([]time.Time, 0, len(uniques))
	entreprises := make([]string, 0, len(uniques))
	for i := range uniques {
		instants = append(instants, instantVisiteImport(uniques[i].date, uniques[i].heure))
		entreprises = append(entreprises, uniques[i].entrepriseID)
	}
	existantes, err := q.ImportVisitesConnues(ctx, db.ImportVisitesConnuesParams{Instants: instants, Entreprises: entreprises})
	if err != nil {
		return nil, err
	}
	connues := map[string]bool{}
	for _, ligne := range existantes {
		iso := ligne.VisitedAt.Format("2006-01-02T15:04")
		var heure *string
		if ligne.TimeKnown {
			heure = pointeurImport(iso[11:16])
		}
		connues[cleVisiteImport(iso[:10], heure, ligne.VisitorName, ligne.EntrepriseId)] = true
	}
	return connues, nil
}

func persisterVisitesImport(ctx context.Context, q *db.Queries, c contexteImport,
	retenues []ligneVisiteImport,
) (ecrites int, refus []erreurLigneImport, err error) {
	references, err := allouerReferencesVisitesImport(ctx, q, retenues)
	if err != nil {
		return 0, nil, err
	}
	identifiants := make([]string, len(retenues))
	fiches := make([]db.InsertImportVisiteParams, len(retenues))
	for i := range retenues {
		ligne := &retenues[i]
		identifiants[i] = identifiantImport()
		fiches[i] = db.InsertImportVisiteParams{
			ID: identifiants[i], Reference: references[i], VisitedAt: instantVisiteImport(ligne.date, ligne.heure),
			TimeKnown: ligne.heure != nil, VisitorName: ligne.nom, Phone: ligne.telephone,
			PhoneE164: ligne.telephoneE164, EntrepriseID: ligne.entrepriseID, ObjetID: ligne.objetID,
			DirectionID: ligne.directionID, DestinataireID: ligne.destinataireID,
			Comment: ligne.commentaire, CreatedByID: c.demandeur,
		}
	}
	if err := executerLotImport(q.InsertImportVisite(ctx, fiches).Exec); err != nil {
		return 0, nil, err
	}
	nombre, err := q.ImportVisitesEcrites(ctx, identifiants)
	if err != nil {
		return 0, nil, err
	}
	ecrites = int(nombre)
	if ecrites >= len(retenues) {
		return ecrites, nil, nil
	}
	perdues := len(retenues) - ecrites
	return ecrites, []erreurLigneImport{{
		RowNumber: retenues[0].numero, Code: "VISITE_IMPORT_REFERENCE_EPUISEE",
		Message: fmt.Sprintf("%d ligne(s) n’ont pas été écrites : leur référence a été prise par une saisie faite à l’accueil pendant l’import.", perdues),
	}}, nil
}

// Le « N° » du registre papier court par ANNÉE : `V-2026-000412`.
func allouerReferencesVisitesImport(ctx context.Context, q *db.Queries, retenues []ligneVisiteImport) ([]string, error) {
	suivantes := map[int]int{}
	for i := range retenues {
		annee := atoiImport(retenues[i].date[:4])
		if _, connu := suivantes[annee]; connu {
			continue
		}
		prefixe := fmt.Sprintf("V-%04d-", annee)
		derniere, err := q.ImportDerniereReferenceVisite(ctx, &prefixe)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		suivantes[annee] = 1
		if parts := referenceVisiteImport.FindStringSubmatch(derniere); len(parts) == 3 && parts[1] == fmt.Sprintf("%04d", annee) {
			suivantes[annee] = atoiImport(parts[2]) + 1
		}
	}
	references := make([]string, len(retenues))
	for i := range retenues {
		annee := atoiImport(retenues[i].date[:4])
		references[i] = fmt.Sprintf("V-%04d-%06d", annee, suivantes[annee])
		suivantes[annee]++
	}
	return references, nil
}
