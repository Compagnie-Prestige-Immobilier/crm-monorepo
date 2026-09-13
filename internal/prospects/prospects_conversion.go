package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ProspectConsentementInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Consent string `json:"consent" enum:"NON_DEMANDE,INTERESSE,REFUSE"`
	}
}

func (s *service) prospectConsentement(ctx context.Context, in *ProspectConsentementInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectModifiable(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	journeyID, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	arg := db.UpsertJourneyConsentementParams{
		ID: journeyID.String(), ProspectID: in.ID, Consent: db.GrandPublicConsent(in.Body.Consent),
	}
	if arg.Consent != db.GrandPublicConsentNONDEMANDE {
		arg.ConsentAt, arg.ConsentByID = prospectPtr(time.Now()), &u.ID
	}
	// Même transaction : le consentement est la pièce qui autorise le
	// démarchage, il ne survit pas sans sa trace.
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.UpsertJourneyConsentement(ctx, arg); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.consentement", prospectEntite, in.ID, nil,
			map[string]any{"consent": string(arg.Consent)})
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type ProspectConversionBody struct {
	OfferID        string  `json:"offerId" format:"uuid"`
	PaymentMode    *string `json:"paymentMode,omitempty" enum:"COMPTANT,ECHELONNE,CREDIT_IMMOBILIER" required:"false"`
	AmountXof      *int32  `json:"amountXof,omitempty" minimum:"0" maximum:"2147483647" required:"false"`
	DurationMonths *int32  `json:"durationMonths,omitempty" minimum:"1" maximum:"300" required:"false"`
}

type ProspectConversionInput struct {
	ID   string                 `path:"id" format:"uuid"`
	Body ProspectConversionBody `json:"body"`
}

func (s *service) prospectConvertir(ctx context.Context, in *ProspectConversionInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	corps := in.Body
	if err := prospectPaiementCoherent(corps.PaymentMode, corps.DurationMonths); err != nil {
		return nil, err
	}
	if _, err := s.prospectModifiable(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	journey, err := s.Q.JourneyParProjet(ctx, db.JourneyParProjetParams{ProspectId: in.ID, Projet: db.ProjetGRANDPUBLIC})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) || journey.Consent != db.GrandPublicConsentINTERESSE {
		return nil, socle.Problem(http.StatusBadRequest, "GRAND_PUBLIC_CONSENT_REQUIRED",
			"Le parcours Grand Public doit être accepté avant sa conversion.")
	}
	conversionID, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	maintenant := time.Now()
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.ConvertirJourney(ctx, db.ConvertirJourneyParams{
			ID: journey.ID, ConvertedAt: &maintenant, ConvertedById: &u.ID,
		}); err != nil {
			return err
		}
		if err := q.UpsertConversion(ctx, db.UpsertConversionParams{
			ID: conversionID.String(), JourneyId: journey.ID, OfferId: &corps.OfferID,
			PaymentMode:    prospectTypeEnum[db.PaymentMode](prospectDeref(corps.PaymentMode)),
			AmountXof:      corps.AmountXof,
			DurationMonths: corps.DurationMonths, ConfirmedById: u.ID, ConfirmedAt: maintenant,
		}); err != nil {
			return err
		}
		return q.MarquerProspectConverti(ctx, in.ID)
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	// L'avis part après la transaction : une messagerie en panne ne doit pas
	// défaire une adhésion déjà acquise.
	s.prospectAviserAdhesion(ctx, &u, item, &corps, maintenant)
	return &ProspectOutput{Body: *item}, nil
}

// L'avis d'adhésion aux adresses réglées par l'administrateur. Sans destinataire
// ou sans clé Brevo, rien ne part et la conversion reste enregistrée.
func (s *service) prospectAviserAdhesion(ctx context.Context, u *socle.Utilisateur, item *Prospect, corps *ProspectConversionBody, quand time.Time) {
	parametres, err := s.prospectLireParametres(ctx)
	if err != nil {
		slog.WarnContext(ctx, "avis d'adhésion non composé", "prospectId", item.ID, "err", err)
		return
	}
	destinataires := prospectDestinataires(parametres.DestinatairesAdhesion)
	if len(destinataires) == 0 {
		return
	}
	offre, err := s.Q.OffreParID(ctx, corps.OfferID)
	if err != nil {
		offre = prospectAbsent
	}
	jetons := map[string]string{
		"prenomNom": item.Prenom + " " + item.Nom, "telephone": prospectDeref(item.PhoneE164),
		"date": formulaireDateLongue(quand.In(s.Cfg.TimeZone)), "offre": offre,
		"paiement":       prospectLibellePaiement(corps.PaymentMode),
		"montant":        prospectLibelleMontant(corps.AmountXof),
		"teleconseiller": u.FullName,
	}
	texte := formulaireRemplacerJetons(parametres.AdhesionCorps, jetons)
	transport := notifications.ConfigurerBrevo()
	envoi := transport.Envoyer(ctx, []notifications.MessageBrevo{{
		Destinataires: destinataires,
		Sujet:         formulaireRemplacerJetons(parametres.AdhesionObjet, jetons),
		Texte:         texte, HTML: formulaireEnHtml(texte),
	}})
	if envoi.Statut != notifications.BrevoEnvoye {
		slog.WarnContext(ctx, "avis d'adhésion non remis", "prospectId", item.ID, "statut", envoi.Statut)
	}
}

const prospectAbsent = "non renseigné"

func prospectDestinataires(adresses []string) []notifications.DestinataireBrevo {
	var liste []notifications.DestinataireBrevo
	for _, adresse := range adresses {
		if propre := strings.TrimSpace(adresse); propre != "" {
			liste = append(liste, notifications.DestinataireBrevo{Email: propre})
		}
	}
	return liste
}

func prospectLibellePaiement(mode *string) string {
	if mode == nil || *mode == "" {
		return prospectAbsent
	}
	return exports.LibellePaiement(*mode)
}

func prospectLibelleMontant(montant *int32) string {
	if montant == nil {
		return prospectAbsent
	}
	return strconv.FormatInt(int64(*montant), 10) + " F CFA"
}

// Avancement d'un parcours : la fusion garde toujours le plus avancé des deux.
var prospectRangStatut = map[db.ProspectStatut]int{
	db.ProspectStatutNOUVEAU: 0, db.ProspectStatutPERDU: 1,
	db.ProspectStatutCONTACTE: 2, db.ProspectStatutCONVERTI: 3,
}

// TOUT ce qui pend à la source suit : un parcours resté sur une fiche supprimée
// fait disparaître la personne des listes de son projet, et un dossier encaissé
// pointerait vers une fiche qu'aucun écran ne montre plus.
func prospectFusion(ctx context.Context, q *db.Queries, u *socle.Utilisateur, sourceID, targetID string, preferSource bool) error {
	if err := q.SoftDeleteProspect(ctx, sourceID); err != nil {
		return err
	}
	if err := prospectDeplacerParcours(ctx, q, sourceID, targetID); err != nil {
		return err
	}
	if err := q.DeplacerDossiersBancaires(ctx, db.DeplacerDossiersBancairesParams{ProspectId: sourceID, ProspectId_2: targetID}); err != nil {
		return err
	}
	if err := q.DeplacerTentatives(ctx, db.DeplacerTentativesParams{ProspectId: sourceID, ProspectId_2: targetID}); err != nil {
		return err
	}
	if err := q.DeplacerRappels(ctx, db.DeplacerRappelsParams{ProspectId: sourceID, ProspectId_2: targetID}); err != nil {
		return err
	}
	// Un CHECK exige qu'une demande approuvée porte une fiche : la laisser sur
	// la fiche supprimée la rendrait orpheline aux yeux de la banque.
	if err := q.DeplacerDemandesClient(ctx, db.DeplacerDemandesClientParams{CreatedProspectId: &sourceID, CreatedProspectId_2: &targetID}); err != nil {
		return err
	}
	if err := q.FusionnerProspect(ctx, db.FusionnerProspectParams{
		PreferSource: preferSource, SourceID: sourceID, TargetID: targetID,
	}); err != nil {
		return err
	}
	return database.Auditer(ctx, q, u.ID, "prospect.merge", prospectEntite, targetID,
		map[string]string{"sourceId": sourceID},
		map[string]any{"targetId": targetID, "preferSource": preferSource})
}

// `@@unique(prospectId, projet)` interdit le simple déplacement : quand les deux
// fiches suivent le même projet il faut choisir, et le parcours PORTEUR de la
// conversion survit toujours.
func prospectDeplacerParcours(ctx context.Context, q *db.Queries, sourceID, targetID string) error {
	depart, err := q.JourneysAFusionner(ctx, sourceID)
	if err != nil {
		return err
	}
	arrivee, err := q.JourneysAFusionner(ctx, targetID)
	if err != nil {
		return err
	}
	parProjet := map[db.Projet]db.JourneysAFusionnerRow{}
	for _, j := range arrivee {
		parProjet[j.Projet] = j
	}
	for _, j := range depart {
		cible, existe := parProjet[j.Projet]
		if !existe {
			if err := q.DeplacerJourney(ctx, db.DeplacerJourneyParams{ID: j.ID, ProspectId: targetID}); err != nil {
				return err
			}
			continue
		}
		if err := prospectFusionnerParcours(ctx, q, &j, &cible, targetID); err != nil {
			return err
		}
	}
	return nil
}

func prospectFusionnerParcours(ctx context.Context, q *db.Queries, depart, arrivee *db.JourneysAFusionnerRow, targetID string) error {
	if depart.AConversion && arrivee.AConversion {
		return socle.Problem(http.StatusConflict, "MERGE_TWO_CONVERSIONS",
			"Les deux fiches portent une conversion confirmée sur le projet "+string(depart.Projet)+". Corrigez l’une des deux avant de fusionner.")
	}
	if depart.AConversion {
		if err := q.SupprimerJourney(ctx, arrivee.ID); err != nil {
			return err
		}
		return q.DeplacerJourney(ctx, db.DeplacerJourneyParams{ID: depart.ID, ProspectId: targetID})
	}
	statut := arrivee.Statut
	if prospectRangStatut[depart.Statut] > prospectRangStatut[arrivee.Statut] {
		statut = depart.Statut
	}
	consent := arrivee.Consent
	if consent == db.GrandPublicConsentNONDEMANDE && depart.Consent != db.GrandPublicConsentNONDEMANDE {
		consent = depart.Consent
	}
	if err := q.FusionnerJourney(ctx, db.FusionnerJourneyParams{ID: arrivee.ID, Statut: statut, Consent: consent}); err != nil {
		return err
	}
	return q.SupprimerJourney(ctx, depart.ID)
}

type prospectChampMeta struct {
	champ       string
	libelle     string
	visible     []db.Projet
	obligatoire []db.Projet
}

var (
	prospectLesDeuxProjets  = []db.Projet{db.ProjetCHUES, db.ProjetGRANDPUBLIC}
	prospectSeulChues       = []db.Projet{db.ProjetCHUES}
	prospectSeulGrandPublic = []db.Projet{db.ProjetGRANDPUBLIC}
)

// L'ordre de déclaration EST l'ordre d'affichage sans réglage, et les défauts
// avec.
var prospectCatalogue = []prospectChampMeta{
	{prospectChampNom, "Nom", prospectLesDeuxProjets, prospectLesDeuxProjets},
	{socle.ProspectChampPrenom, "Prénom", prospectLesDeuxProjets, prospectSeulChues},
	{socle.ProspectChampPhone, "Téléphone", prospectLesDeuxProjets, nil},
	{prospectChampEmail, "E-mail", prospectLesDeuxProjets, nil},
	{socle.ProspectChampProfession, "Profession", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampDureeEtablissement, "Durée dans l’établissement (mois)", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampFonctionnaire, "Fonctionnaire", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampType, "Situation", prospectSeulGrandPublic, nil},
	{prospectChampSyndicat, "Syndicat", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampBanque, "Banque", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampEngagement, "Engagement en cours à la banque", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampRevenu, "Revenu mensuel", prospectLesDeuxProjets, prospectSeulChues},
	{prospectChampPaiement, "Paiement", prospectSeulGrandPublic, nil},
	{socle.ProspectChampEtablissement, exports.ExportEnteteEtablissement, prospectLesDeuxProjets, nil},
	{prospectChampDureeSysteme, "Durée du système de paiement", prospectSeulGrandPublic, nil},
	{socle.ProspectChampWhatsappStatut, "Numéro WhatsApp", prospectLesDeuxProjets, nil},
	{socle.ProspectChampWhatsappNumero, "Autre numéro WhatsApp", prospectLesDeuxProjets, nil},
	{prospectChampMethode, "Méthode d’enrôlement", prospectLesDeuxProjets, prospectLesDeuxProjets},
	{prospectChampRendezVous, "Date du rendez-vous", prospectLesDeuxProjets, prospectLesDeuxProjets},
}

// Ce dont dépendent les indicateurs et le closing : la fusion les rend visibles
// quoi qu'il arrive.
var prospectChampsImposes = []string{
	prospectChampNom, socle.ProspectChampPrenom, socle.ProspectChampPhone,
	prospectChampRevenu, prospectChampMethode,
}

var prospectTypesChampLibre = []string{"TEXTE", prospectTypeListe, "OUI_NON"}

const (
	prospectLibelleMax = 80
	prospectOptionMax  = 80
	prospectOptionsMax = 30
	prospectTypeListe  = "LISTE"
)

type ProspectReglageChamp struct {
	Champ       string `json:"champ"`
	Libelle     string `json:"libelle"`
	Visible     bool   `json:"visible"`
	Obligatoire bool   `json:"obligatoire"`
	Impose      bool   `json:"impose"`
}

type ProspectChampLibre struct {
	ID          string   `json:"id"`
	Libelle     string   `json:"libelle"`
	Type        string   `json:"type" enum:"TEXTE,LISTE,OUI_NON"`
	Options     []string `json:"options"`
	Obligatoire bool     `json:"obligatoire"`
}

type ProspectReglagesConversion struct {
	Projet    string                 `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Champs    []ProspectReglageChamp `json:"champs"`
	Libres    []ProspectChampLibre   `json:"libres"`
	UpdatedAt *string                `json:"updatedAt"`
}

type prospectReglageStocke struct {
	Champ       string `json:"champ" maxLength:"60"`
	Visible     bool   `json:"visible"`
	Obligatoire bool   `json:"obligatoire"`
}

type prospectReglagesStockes struct {
	Champs []prospectReglageStocke `json:"champs"`
	Libres []ProspectChampLibre    `json:"libres"`
}

func prospectCleChamps(projet db.Projet) string {
	return "conversion.champs." + string(projet)
}

func prospectMetaChamp(champ string) (prospectChampMeta, bool) {
	for _, meta := range prospectCatalogue {
		if meta.champ == champ {
			return meta, true
		}
	}
	return prospectChampMeta{}, false
}

func prospectReglageDefaut(meta *prospectChampMeta, projet db.Projet) ProspectReglageChamp {
	return ProspectReglageChamp{
		Champ: meta.champ, Libelle: meta.libelle,
		Visible:     slices.Contains(meta.visible, projet),
		Obligatoire: slices.Contains(meta.obligatoire, projet),
		Impose:      slices.Contains(prospectChampsImposes, meta.champ),
	}
}

// Un réglage illisible rend le formulaire d'usine, jamais une erreur d'écran.
func prospectLireReglages(valeur string) prospectReglagesStockes {
	var lu prospectReglagesStockes
	if err := json.Unmarshal([]byte(valeur), &lu); err != nil {
		return prospectReglagesStockes{}
	}
	propre := prospectReglagesStockes{}
	for _, ligne := range lu.Champs {
		if _, connu := prospectMetaChamp(ligne.Champ); connu {
			propre.Champs = append(propre.Champs, ligne)
		}
	}
	for _, libre := range lu.Libres {
		if libre.ID == "" || libre.Libelle == "" || !slices.Contains(prospectTypesChampLibre, libre.Type) {
			continue
		}
		libre.Options = prospectOptionsPropres(libre.Options)
		propre.Libres = append(propre.Libres, libre)
	}
	return propre
}

func prospectOptionsPropres(brutes []string) []string {
	options := []string{}
	for _, option := range brutes {
		if len(options) >= prospectOptionsMax {
			break
		}
		if option = strings.TrimSpace(option); option != "" {
			options = append(options, prospectTronquer(option, prospectOptionMax))
		}
	}
	return options
}

// L'ordre stocké d'abord, les champs qu'il ignore encore à la suite.
func prospectFusionnerReglages(projet db.Projet, stockes *prospectReglagesStockes) []ProspectReglageChamp {
	vus := map[string]bool{}
	champs := make([]ProspectReglageChamp, 0, len(prospectCatalogue))
	for _, ligne := range stockes.Champs {
		meta, connu := prospectMetaChamp(ligne.Champ)
		if !connu || vus[ligne.Champ] {
			continue
		}
		vus[ligne.Champ] = true
		defaut := prospectReglageDefaut(&meta, projet)
		defaut.Visible = defaut.Impose || ligne.Visible
		defaut.Obligatoire = ligne.Obligatoire
		champs = append(champs, defaut)
	}
	for i := range prospectCatalogue {
		if !vus[prospectCatalogue[i].champ] {
			champs = append(champs, prospectReglageDefaut(&prospectCatalogue[i], projet))
		}
	}
	return champs
}

func (s *service) prospectReglages(ctx context.Context, projet db.Projet) (ProspectReglagesConversion, error) {
	reglages := ProspectReglagesConversion{Projet: string(projet), Libres: []ProspectChampLibre{}}
	ligne, err := s.Q.AppSettingParCle(ctx, prospectCleChamps(projet))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return reglages, err
	}
	var stockes prospectReglagesStockes
	if err == nil {
		stockes = prospectLireReglages(ligne.Value)
		reglages.UpdatedAt = prospectPtr(prospectISO(ligne.UpdatedAt))
	}
	reglages.Champs = prospectFusionnerReglages(projet, &stockes)
	if stockes.Libres != nil {
		reglages.Libres = stockes.Libres
	}
	return reglages, nil
}

type ProspectProjetInput struct {
	Projet string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
}

type ProspectReglagesOutput struct {
	Body ProspectReglagesConversion
}

func (s *service) prospectLireChamps(ctx context.Context, in *ProspectProjetInput) (*ProspectReglagesOutput, error) {
	reglages, err := s.prospectReglages(ctx, db.Projet(in.Projet))
	if err != nil {
		return nil, err
	}
	return &ProspectReglagesOutput{Body: reglages}, nil
}

type ProspectChampLibreEntree struct {
	ID          string   `json:"id,omitempty" format:"uuid" required:"false"`
	Libelle     string   `json:"libelle" maxLength:"80"`
	Type        string   `json:"type" enum:"TEXTE,LISTE,OUI_NON"`
	Options     []string `json:"options,omitempty" maxItems:"30" required:"false"`
	Obligatoire bool     `json:"obligatoire"`
}

type ProspectMajChampsInput struct {
	Projet string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Body   struct {
		Champs []prospectReglageStocke    `json:"champs" maxItems:"60"`
		Libres []ProspectChampLibreEntree `json:"libres" maxItems:"20"`
	}
}

// La liste ENTIÈRE remplace l'ancienne : masquer un champ imposé est refusé.
func (s *service) prospectMajChamps(ctx context.Context, in *ProspectMajChampsInput) (*ProspectReglagesOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	projet := db.Projet(in.Projet)
	champs := []prospectReglageStocke{}
	for _, ligne := range in.Body.Champs {
		meta, connu := prospectMetaChamp(ligne.Champ)
		if !connu {
			continue
		}
		if !ligne.Visible && slices.Contains(prospectChampsImposes, meta.champ) {
			return nil, socle.Problem(http.StatusBadRequest, "CHAMP_IMPOSE_MASQUE",
				"« "+meta.libelle+" » ne peut pas être masqué : les indicateurs et le closing en dépendent.")
		}
		champs = append(champs, ligne)
	}
	libres, err := s.prospectChampsLibres(ctx, projet, in.Body.Libres)
	if err != nil {
		return nil, err
	}
	valeur, err := json.Marshal(prospectReglagesStockes{Champs: champs, Libres: libres})
	if err != nil {
		return nil, err
	}
	ancien, err := s.Q.AppSettingParCle(ctx, prospectCleChamps(projet))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	var avant any
	if err == nil {
		avant = json.RawMessage(ancien.Value)
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.UpsertAppSetting(ctx, db.UpsertAppSettingParams{
			Key: prospectCleChamps(projet), Value: string(valeur), UpdatedById: &u.ID,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "champs_conversion.update", "champs_conversion", in.Projet,
			avant, json.RawMessage(valeur))
	}); err != nil {
		return nil, err
	}
	return s.prospectLireChamps(ctx, &ProspectProjetInput{Projet: in.Projet})
}

func (s *service) prospectChampsLibres(ctx context.Context, projet db.Projet, entrees []ProspectChampLibreEntree) ([]ProspectChampLibre, error) {
	actuels, err := s.prospectReglages(ctx, projet)
	if err != nil {
		return nil, err
	}
	connus := map[string]bool{}
	for _, libre := range actuels.Libres {
		connus[libre.ID] = true
	}
	libres := make([]ProspectChampLibre, 0, len(entrees))
	for i := range entrees {
		if len(libres) >= prospectChampsLibresMax {
			break
		}
		normalise, err := prospectNormaliserChampLibre(&entrees[i], connus)
		if err != nil {
			return nil, err
		}
		connus[normalise.ID] = true
		libres = append(libres, normalise)
	}
	return libres, nil
}

// Un identifiant inconnu du réglage courant est réengendré : sinon une réponse
// déjà écrite sur une fiche serait détournée vers un autre champ.
func prospectNormaliserChampLibre(entree *ProspectChampLibreEntree, connus map[string]bool) (ProspectChampLibre, error) {
	libelle := strings.TrimSpace(entree.Libelle)
	if libelle == "" {
		return ProspectChampLibre{}, socle.Problem(http.StatusBadRequest, "CHAMP_LIBRE_SANS_LIBELLE",
			"Un champ ajouté au formulaire doit porter un libellé.")
	}
	propres := []string{}
	if entree.Type == prospectTypeListe {
		propres = prospectOptionsPropres(entree.Options)
		if len(propres) == 0 {
			return ProspectChampLibre{}, socle.Problem(http.StatusBadRequest, "CHAMP_LIBRE_SANS_VALEUR",
				"« "+libelle+" » est une liste de valeurs : proposez-en au moins une.")
		}
	}
	id := entree.ID
	if id == "" || !connus[id] {
		nouvel, err := uuid.NewV7()
		if err != nil {
			return ProspectChampLibre{}, err
		}
		id = nouvel.String()
	}
	return ProspectChampLibre{
		ID: id, Libelle: prospectTronquer(libelle, prospectLibelleMax), Type: entree.Type,
		Options: propres, Obligatoire: entree.Obligatoire,
	}, nil
}

type ProspectParametresChues struct {
	PlateformeChuesUrl       string   `json:"plateformeChuesUrl"`
	PlateformeGrandPublicUrl string   `json:"plateformeGrandPublicUrl"`
	EmailChues               string   `json:"emailChues"`
	WhatsappChuesE164        string   `json:"whatsappChuesE164"`
	MessageWhatsapp          string   `json:"messageWhatsapp"`
	AccuseReceptionObjet     string   `json:"accuseReceptionObjet"`
	AccuseReceptionCorps     string   `json:"accuseReceptionCorps"`
	AdhesionObjet            string   `json:"adhesionObjet"`
	AdhesionCorps            string   `json:"adhesionCorps"`
	DestinatairesEnrolement  []string `json:"destinatairesEnrolement"`
	DestinatairesBpe         []string `json:"destinatairesBpe"`
	DestinatairesSupervision []string `json:"destinatairesSupervision"`
	DestinatairesDirection   []string `json:"destinatairesDirection"`
	DestinatairesAdhesion    []string `json:"destinatairesAdhesion"`
	CodificationProvenances  []string `json:"codificationProvenances"`
	// Les textes d'origine, pour les rétablir d'un clic depuis l'écran.
	TextesUsine ProspectTextesUsine `json:"textesUsine"`
}

type ProspectTextesUsine struct {
	MessageWhatsapp      string `json:"messageWhatsapp"`
	AccuseReceptionObjet string `json:"accuseReceptionObjet"`
	AccuseReceptionCorps string `json:"accuseReceptionCorps"`
}

// Les deux textes viennent mot pour mot de l'expression de besoins ; les liens,
// l'adresse et le numéro naissent VIDES : inventer une URL enverrait les
// prospects nulle part sans que personne ne s'en aperçoive.
var prospectParametresUsine = ProspectParametresChues{
	MessageWhatsapp: "Bonjour {prenom}, suite à notre échange, voici le lien pour compléter votre demande " +
		"d’adhésion CPI CHUES : {lien}. Je reste joignable au {telephoneTeleconseiller}. " +
		"{teleconseiller}, CPI.",
	AccuseReceptionObjet: "Votre demande CPI CHUES a bien été reçue",
	AccuseReceptionCorps: "Bonjour {prenomNom}, nous avons bien reçu votre demande du {date}. " +
		"Récapitulatif : {informations}. Un chargé de clientèle CPI vous contactera au {telephone}. " +
		"Pour toute question : {emailChues} ou {whatsappChues}. CPI.",
	AdhesionObjet: "Nouvelle adhésion Grand Public : {prenomNom}",
	AdhesionCorps: "Bonjour, {prenomNom} ({telephone}) a adhéré le {date}. " +
		"Offre : {offre}. Paiement : {paiement}. Montant : {montant}. " +
		"Conversion enregistrée par {teleconseiller}. CPI.",
	DestinatairesEnrolement:  []string{},
	DestinatairesBpe:         []string{},
	DestinatairesSupervision: []string{},
	DestinatairesDirection:   []string{},
	CodificationProvenances:  []string{},
	DestinatairesAdhesion:    []string{},
}

const (
	prospectCleLienChues     = "plateformeChuesUrl"
	prospectCleLienGP        = "plateformeGrandPublicUrl"
	prospectCleEmail         = "emailChues"
	prospectCleWhatsapp      = "whatsappChuesE164"
	prospectCleMessage       = "messageWhatsapp"
	prospectCleAccuseObjet   = "accuseReceptionObjet"
	prospectCleAccuseCorps   = "accuseReceptionCorps"
	prospectCleAdhesionObjet = "adhesionObjet"
	prospectCleAdhesionCorps = "adhesionCorps"
	prospectCleAdhesionDest  = "destinatairesAdhesion"
	prospectCleEnrolement    = "destinatairesEnrolement"
	prospectCleBpe           = "destinatairesBpe"
	prospectCleSupervision   = "destinatairesSupervision"
	prospectCleDirection     = "destinatairesDirection"
	prospectCleCodification  = "codificationProvenances"
	prospectPrefixeParametre = "chues."
)

// Les deux textes que la supervision et la direction écrivent aussi. Tout le
// reste engage l'entreprise au-delà d'un message : un lien faux détourne des
// inscriptions, et la liste des destinataires décide qui lit les demandes.
var prospectTextesPartages = []string{prospectCleMessage, prospectCleAccuseObjet, prospectCleAccuseCorps}

var prospectClesParametres = []string{
	prospectCleLienChues, prospectCleLienGP, prospectCleEmail, prospectCleWhatsapp,
	prospectCleMessage, prospectCleAccuseObjet, prospectCleAccuseCorps,
	prospectCleAdhesionObjet, prospectCleAdhesionCorps,
	prospectCleEnrolement, prospectCleBpe, prospectCleSupervision,
	prospectCleDirection, prospectCleCodification, prospectCleAdhesionDest,
}

// `app_settings` est partagée : le préfixe évite qu'un réglage CHUES en écrase
// un autre.
func prospectCleParametre(cle string) string { return prospectPrefixeParametre + cle }

func prospectClesStockees() []string {
	cles := make([]string, 0, len(prospectClesParametres))
	for _, cle := range prospectClesParametres {
		cles = append(cles, prospectCleParametre(cle))
	}
	return cles
}

// Une liste voyage en JSON, un booléen en 'true'/'false'. Une valeur illisible
// retombe sur l'usine plutôt que de faire échouer l'écran entier.
func prospectListeDe(brut string) []string {
	liste := []string{}
	if err := json.Unmarshal([]byte(brut), &liste); err != nil {
		return []string{}
	}
	return liste
}

func prospectJSONListe(liste []string) string {
	if liste == nil {
		liste = []string{}
	}
	encode, err := json.Marshal(liste)
	if err != nil {
		return "[]"
	}
	return string(encode)
}

func (p *ProspectParametresChues) textes() map[string]*string {
	return map[string]*string{
		prospectCleLienChues: &p.PlateformeChuesUrl, prospectCleLienGP: &p.PlateformeGrandPublicUrl,
		prospectCleEmail: &p.EmailChues, prospectCleWhatsapp: &p.WhatsappChuesE164,
		prospectCleMessage: &p.MessageWhatsapp, prospectCleAccuseObjet: &p.AccuseReceptionObjet,
		prospectCleAccuseCorps:   &p.AccuseReceptionCorps,
		prospectCleAdhesionObjet: &p.AdhesionObjet, prospectCleAdhesionCorps: &p.AdhesionCorps,
	}
}

func (p *ProspectParametresChues) listes() map[string]*[]string {
	return map[string]*[]string{
		prospectCleEnrolement: &p.DestinatairesEnrolement, prospectCleBpe: &p.DestinatairesBpe,
		prospectCleSupervision: &p.DestinatairesSupervision, prospectCleDirection: &p.DestinatairesDirection,
		prospectCleCodification: &p.CodificationProvenances,
		prospectCleAdhesionDest: &p.DestinatairesAdhesion,
	}
}

func (p *ProspectParametresChues) poser(cle, brut string) {
	if cible, texte := p.textes()[cle]; texte {
		*cible = brut
		return
	}
	if cible, liste := p.listes()[cle]; liste {
		*cible = prospectListeDe(brut)
		return
	}
}

func (p *ProspectParametresChues) valeur(cle string) string {
	if texte, connu := p.textes()[cle]; connu {
		return *texte
	}
	if liste, connu := p.listes()[cle]; connu {
		return prospectJSONListe(*liste)
	}
	return ""
}

// Ce qui n'a jamais été réglé rend sa valeur d'usine : l'écran n'a pas de trou.
func (s *service) prospectLireParametres(ctx context.Context) (ProspectParametresChues, error) {
	parametres := prospectParametresUsine
	lignes, err := s.Q.AppSettingsParCles(ctx, prospectClesStockees())
	if err != nil {
		return parametres, err
	}
	stockees := map[string]string{}
	for _, ligne := range lignes {
		stockees[ligne.Key] = ligne.Value
	}
	for _, cle := range prospectClesParametres {
		if brut, present := stockees[prospectCleParametre(cle)]; present {
			parametres.poser(cle, brut)
		}
	}
	parametres.TextesUsine = ProspectTextesUsine{
		MessageWhatsapp:      prospectParametresUsine.MessageWhatsapp,
		AccuseReceptionObjet: prospectParametresUsine.AccuseReceptionObjet,
		AccuseReceptionCorps: prospectParametresUsine.AccuseReceptionCorps,
	}
	return parametres, nil
}

type ProspectParametresOutput struct {
	Body ProspectParametresChues
}

func (s *service) prospectParametres(ctx context.Context, _ *struct{}) (*ProspectParametresOutput, error) {
	parametres, err := s.prospectLireParametres(ctx)
	if err != nil {
		return nil, err
	}
	return &ProspectParametresOutput{Body: parametres}, nil
}

// Tout est facultatif : l'écran n'envoie que ce qu'il a changé, et le
// superviseur n'a le droit d'envoyer que les deux textes.
type ProspectMajParametresInput struct {
	Body struct {
		PlateformeChuesUrl       *string   `json:"plateformeChuesUrl,omitempty" maxLength:"300" required:"false"`
		PlateformeGrandPublicUrl *string   `json:"plateformeGrandPublicUrl,omitempty" maxLength:"300" required:"false"`
		EmailChues               *string   `json:"emailChues,omitempty" format:"email" maxLength:"200" required:"false"`
		WhatsappChuesE164        *string   `json:"whatsappChuesE164,omitempty" maxLength:"20" required:"false"`
		MessageWhatsapp          *string   `json:"messageWhatsapp,omitempty" maxLength:"1000" required:"false"`
		AccuseReceptionObjet     *string   `json:"accuseReceptionObjet,omitempty" maxLength:"200" required:"false"`
		AccuseReceptionCorps     *string   `json:"accuseReceptionCorps,omitempty" maxLength:"4000" required:"false"`
		AdhesionObjet            *string   `json:"adhesionObjet,omitempty" maxLength:"200" required:"false"`
		AdhesionCorps            *string   `json:"adhesionCorps,omitempty" maxLength:"4000" required:"false"`
		DestinatairesEnrolement  *[]string `json:"destinatairesEnrolement,omitempty" maxItems:"50" required:"false"`
		DestinatairesBpe         *[]string `json:"destinatairesBpe,omitempty" maxItems:"50" required:"false"`
		DestinatairesSupervision *[]string `json:"destinatairesSupervision,omitempty" maxItems:"50" required:"false"`
		DestinatairesDirection   *[]string `json:"destinatairesDirection,omitempty" maxItems:"50" required:"false"`
		CodificationProvenances  *[]string `json:"codificationProvenances,omitempty" maxItems:"100" required:"false"`
		DestinatairesAdhesion    *[]string `json:"destinatairesAdhesion,omitempty" maxItems:"50" required:"false"`
	}
}

func (in *ProspectMajParametresInput) demandees() map[string]string {
	demandees := map[string]string{}
	textes := map[string]*string{
		prospectCleLienChues: in.Body.PlateformeChuesUrl, prospectCleLienGP: in.Body.PlateformeGrandPublicUrl,
		prospectCleEmail: in.Body.EmailChues, prospectCleWhatsapp: in.Body.WhatsappChuesE164,
		prospectCleMessage: in.Body.MessageWhatsapp, prospectCleAccuseObjet: in.Body.AccuseReceptionObjet,
		prospectCleAccuseCorps:   in.Body.AccuseReceptionCorps,
		prospectCleAdhesionObjet: in.Body.AdhesionObjet, prospectCleAdhesionCorps: in.Body.AdhesionCorps,
	}
	for cle, valeur := range textes {
		if valeur != nil {
			demandees[cle] = *valeur
		}
	}
	listes := map[string]*[]string{
		prospectCleEnrolement: in.Body.DestinatairesEnrolement, prospectCleBpe: in.Body.DestinatairesBpe,
		prospectCleSupervision: in.Body.DestinatairesSupervision, prospectCleDirection: in.Body.DestinatairesDirection,
		prospectCleCodification: in.Body.CodificationProvenances,
		prospectCleAdhesionDest: in.Body.DestinatairesAdhesion,
	}
	for cle, valeur := range listes {
		if valeur != nil {
			demandees[cle] = prospectJSONListe(*valeur)
		}
	}
	return demandees
}

func (s *service) prospectMajParametres(ctx context.Context, in *ProspectMajParametresInput) (*ProspectParametresOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	demandees := in.demandees()
	for _, cle := range prospectClesParametres {
		_, demandee := demandees[cle]
		if demandee && u.Role != socle.Admin && !slices.Contains(prospectTextesPartages, cle) {
			return nil, socle.Problem(http.StatusForbidden, "PARAMETRE_RESERVE_ADMIN",
				"Seul l’administrateur règle les liens, l’adresse, le numéro et les destinataires.")
		}
	}
	courants, err := s.prospectLireParametres(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		return prospectEcrireParametres(ctx, q, u.ID, demandees, &courants)
	}); err != nil {
		return nil, err
	}
	return s.prospectParametres(ctx, nil)
}

// N'écrit QUE ce qui change vraiment : enregistrer une valeur identique
// remplirait le journal de lignes qui ne disent rien.
func prospectEcrireParametres(ctx context.Context, q *db.Queries, userID string, demandees map[string]string, courants *ProspectParametresChues) error {
	for _, cle := range prospectClesParametres {
		nouvelle, demandee := demandees[cle]
		if !demandee || nouvelle == courants.valeur(cle) {
			continue
		}
		if err := prospectEcrireUnParametre(ctx, q, userID, prospectCleParametre(cle), nouvelle); err != nil {
			return err
		}
	}
	return nil
}

func prospectEcrireUnParametre(ctx context.Context, q *db.Queries, userID, stockee, nouvelle string) error {
	// Lue AVANT l'écriture : `oldValue` nul dit « le réglage n'existait pas », et
	// non « il était vide ».
	var ancienne *string
	ligne, err := q.AppSettingParCle(ctx, stockee)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil {
		ancienne = &ligne.Value
	}
	if err := q.UpsertAppSetting(ctx, db.UpsertAppSettingParams{Key: stockee, Value: nouvelle, UpdatedById: &userID}); err != nil {
		return err
	}
	changeID, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return q.InsertAppSettingChange(ctx, db.InsertAppSettingChangeParams{
		ID: changeID.String(), Key: stockee, OldValue: ancienne, NewValue: nouvelle, ChangedById: &userID,
	})
}

type ProspectParametreChangement struct {
	ID       string  `json:"id"`
	Cle      string  `json:"cle"`
	Ancienne *string `json:"ancienne"`
	Nouvelle string  `json:"nouvelle"`
	ParNom   string  `json:"parNom"`
	Le       string  `json:"le"`
}

type ProspectJournalInput struct {
	Limite int32 `query:"limite" minimum:"1" maximum:"200" default:"50"`
}

type ProspectJournalOutput struct {
	Body struct {
		Items []ProspectParametreChangement `json:"items"`
	}
}

func prospectNomAuteur(nom *string) string {
	if nom == nil {
		return "Compte supprimé"
	}
	return *nom
}

func (s *service) prospectJournal(ctx context.Context, in *ProspectJournalInput) (*ProspectJournalOutput, error) {
	lignes, err := s.Q.JournalAppSettings(ctx, db.JournalAppSettingsParams{Keys: prospectClesStockees(), Taille: in.Limite})
	if err != nil {
		return nil, err
	}
	out := &ProspectJournalOutput{}
	out.Body.Items = make([]ProspectParametreChangement, 0, len(lignes))
	for _, ligne := range lignes {
		out.Body.Items = append(out.Body.Items, ProspectParametreChangement{
			ID: ligne.ID, Cle: strings.TrimPrefix(ligne.Key, prospectPrefixeParametre),
			Ancienne: ligne.OldValue, Nouvelle: ligne.NewValue,
			ParNom: prospectNomAuteur(ligne.ChangedByName), Le: prospectISO(ligne.ChangedAt),
		})
	}
	return out, nil
}

func prospectMonterConversion(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "updateGrandPublicConsent", Method: http.MethodPatch, Path: "/api/v1/prospects/{id}/parcours/grand-public/consentement"}, s.prospectConsentement)
	huma.Register(api, huma.Operation{OperationID: "confirmGrandPublicConversion", Method: http.MethodPost, Path: "/api/v1/prospects/{id}/parcours/grand-public/conversion"}, s.prospectConvertir)
	huma.Register(api, huma.Operation{OperationID: "getChampsConversion", Method: http.MethodGet, Path: "/api/v1/champs-conversion/{projet}"}, s.prospectLireChamps)
	huma.Register(api, huma.Operation{OperationID: "updateChampsConversion", Method: http.MethodPut, Path: "/api/v1/champs-conversion/{projet}"}, s.prospectMajChamps)
	huma.Register(api, huma.Operation{OperationID: "getParametresChues", Method: http.MethodGet, Path: "/api/v1/parametres-chues"}, s.prospectParametres)
	huma.Register(api, huma.Operation{OperationID: "updateParametresChues", Method: http.MethodPatch, Path: "/api/v1/parametres-chues"}, s.prospectMajParametres)
	huma.Register(api, huma.Operation{OperationID: "getJournalParametresChues", Method: http.MethodGet, Path: "/api/v1/parametres-chues/journal"}, s.prospectJournal)
}
