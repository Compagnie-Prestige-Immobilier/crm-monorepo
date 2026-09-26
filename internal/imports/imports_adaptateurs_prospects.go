package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"fmt"
	"time"
)

var colonnesProspectsImport = []colonneImport{
	{entete: exports.ExportEnteteNom, alias: []string{"Nom de famille", "Noms", enteteNomCompletImport, "Nom et prénom", "Prénom et nom", "Nom du prospect"}},
	{entete: exports.ExportEntetePrenom, alias: []string{"Prénoms"}},
	{entete: enteteTelephoneImport, alias: []string{"Tel", "Numéro", "Numéro de téléphone", "Contact"}, requise: true},
	{entete: "Téléphone du représentant", alias: []string{"Téléphone représentant", "Contact représentant", "Relais", "Téléphone du relais"}},
	{entete: libelleBanqueImport, alias: []string{"Banque de domiciliation", "Domiciliation"}},
	{entete: exports.ExportEnteteSyndicat},
	{entete: exports.ExportEnteteMethodeEnrolement},
}

func enteteProspectImport(rang int) string { return colonnesProspectsImport[rang].entete }

var methodesEnrolementImport, libellesMethodesImport = indexMethodesImport()

// Le modèle propose les libellés de l'export ; les anciens alias restent lus.
func indexMethodesImport() (index map[string]string, libelles []string) {
	index = map[string]string{
		"rdv cpi": string(db.EnrollmentMethodAPPOINTMENT), "appointment": string(db.EnrollmentMethodAPPOINTMENT),
		"platform": string(db.EnrollmentMethodPLATFORM), "voice or electronic messaging": string(db.EnrollmentMethodVOICEORELECTRONICMESSAGING),
	}
	for _, methode := range exports.ExportOrdreMethodes {
		libelle := exports.ExportLibellesMethode[methode]
		index[cleImport(libelle)] = methode
		libelles = append(libelles, libelle)
	}
	return index, libelles
}

type ligneProspectImport struct {
	numero                                 int
	nom, prenom, telephone, representantID string
	banqueID, syndicatID, methode          *string
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
	banqueID, refus := referentielFacultatifImport(cellules[enteteProspectImport(4)], etat.banques, cleReferentielImport, numero,
		enteteProspectImport(4), "PROSPECT_IMPORT_BANQUE_INCONNUE", "Banque inconnue", etat.banqueLabels)
	if refus != nil {
		return nil, refus
	}
	syndicatID, refus := referentielFacultatifImport(cellules[enteteProspectImport(5)], etat.syndicats, cleReferentielImport, numero,
		enteteProspectImport(5), "PROSPECT_IMPORT_SYNDICAT_INCONNU", "Syndicat inconnu", etat.syndicatLabels)
	if refus != nil {
		return nil, refus
	}
	methode, refus := referentielFacultatifImport(cellules[enteteProspectImport(6)], methodesEnrolementImport, cleImport, numero,
		enteteProspectImport(6), "PROSPECT_IMPORT_METHODE_INCONNUE", "Méthode d’enrôlement inconnue", libellesMethodesImport)
	if refus != nil {
		return nil, refus
	}
	return ligneProspectImport{
		numero: numero, nom: nom, prenom: prenom, telephone: telephone,
		representantID: lireRepresentantProspectImport(cellules[enteteProspectImport(3)], etat),
		banqueID:       banqueID, syndicatID: syndicatID, methode: methode,
	}, nil
}

func ecrireProspectsImport(ctx context.Context, q *db.Queries, c contexteImport, lignes []any, brut any) (bilanTrancheImport, error) {
	if len(lignes) == 0 {
		return bilanTrancheImport{}, nil
	}
	etat := brut.(*etatProspectsImport)
	uniques, ignoreesDoublons, erreurs := doublonsDansLeFichierImport(lignes, etat.vus,
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
		return bilanTrancheImport{crees: len(retenues), ignorees: totalesIgnorees, erreurs: erreurs}, nil
	}
	crees, err := persisterProspectsImport(ctx, q, c, retenues)
	if err != nil {
		return bilanTrancheImport{}, err
	}
	return bilanTrancheImport{crees: crees, ignorees: totalesIgnorees + (len(retenues) - crees), erreurs: erreurs}, nil
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
		var methode *db.EnrollmentMethod
		if ligne.methode != nil {
			valeur := db.EnrollmentMethod(*ligne.methode)
			methode = &valeur
		}
		fiches[i] = db.InsertImportProspectParams{
			ID: identifiants[i], Nom: ligne.nom, Prenom: ligne.prenom, PhoneE164: &ligne.telephone,
			BanqueID: ligne.banqueID, SyndicatID: ligne.syndicatID, RepresentantID: couperImport(ligne.representantID, 36),
			CreatedByID: c.demandeur, Phase2Status: phase2DepuisMethodeImport(ligne.methode),
			EnrollmentMethod: methode, ClientCreatedAt: maintenant, ImportJobID: &c.jobID,
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

func phase2DepuisMethodeImport(methode *string) db.Phase2Status {
	if methode == nil {
		return db.Phase2StatusPENDING
	}
	return db.Phase2StatusMETHODOBTAINED
}
