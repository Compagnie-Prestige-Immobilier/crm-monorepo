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
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	formulaireSiteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	formulaireDelai      = 10 * time.Second
	formulaireLienMort   = "Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI."
	formulaireTitreMax   = 120
	formulaireCorpsMax   = 500
	formulaireLibelleMel = "E-mail"
)

var (
	formulaireMotifJeton = regexp.MustCompile(`\{(\w+)\}`)
	formulaireMois       = [12]string{
		"janvier", "février", "mars", "avril", "mai", "juin",
		"juillet", "août", "septembre", "octobre", "novembre", "décembre",
	}
)

// Deux compteurs par adresse : la lecture compose la page, l'écriture crée une
// fiche. Les mêmes bornes qu'en v1.
var (
	formulaireLimiteLecture  = socle.NouveauLimiteur(30)
	formulaireLimiteEcriture = socle.NouveauLimiteur(5)
)

type formulaireConfigTurnstile struct {
	secret   string
	siteKey  string
	degradee bool
}

// Lue au montage des routes, pas à chaque demande : une clé qui changerait en
// cours de vie du binaire ne veut rien dire.
var formulaireTurnstile formulaireConfigTurnstile

// La borne BASSE fait la valeur écrite : une tranche ne surestime jamais
// l'ancienneté.
var formulaireDurees = []FormulaireTrancheDuree{
	{Mois: 0, Libelle: "Moins d’un an"},
	{Mois: 12, Libelle: "1 à 2 ans"},
	{Mois: 24, Libelle: "2 à 5 ans"},
	{Mois: 60, Libelle: "5 à 10 ans"},
	{Mois: 120, Libelle: "Plus de 10 ans"},
}

// La méthode d'enrôlement clôt le dossier et nomme l'auteur du closing : un
// visiteur non vérifié ne peut pas se déclarer converti. La date de rendez-vous
// n'existe qu'avec elle.
var FormulaireChampsPublics = []string{
	prospectChampNom, socle.ProspectChampPrenom, socle.ProspectChampPhone, prospectChampEmail,
	socle.ProspectChampProfession, prospectChampDureeEtablissement, prospectChampFonctionnaire,
	prospectChampType, prospectChampSyndicat, prospectChampBanque, prospectChampEngagement,
	prospectChampRevenu, prospectChampPaiement, socle.ProspectChampEtablissement,
	prospectChampDureeSysteme, socle.ProspectChampWhatsappStatut, socle.ProspectChampWhatsappNumero,
}

type FormulaireOption struct {
	ID      string `json:"id"`
	Libelle string `json:"libelle"`
}

type FormulaireTrancheDuree struct {
	Mois    int32  `json:"mois"`
	Libelle string `json:"libelle"`
}

type FormulairePublicOutput struct {
	Body struct {
		Champs              []ProspectReglageChamp   `json:"champs"`
		Libres              []ProspectChampLibre     `json:"libres"`
		Banques             []FormulaireOption       `json:"banques"`
		Syndicats           []FormulaireOption       `json:"syndicats"`
		Revenus             []FormulaireOption       `json:"revenus"`
		Professions         []FormulaireOption       `json:"professions"`
		DureesEtablissement []FormulaireTrancheDuree `json:"dureesEtablissement"`

		// La clé de SITE est publique et se lit à la requête : figée au build de
		// la SPA, une rotation obligerait à reconstruire le panneau.
		TurnstileSiteKey string `json:"turnstileSiteKey"`
	}
}

func formulaireAdresse(ctx context.Context) string {
	adresse, _ := ctx.Value(socle.CleAdresse{}).(string)
	return adresse
}

func formulaireTropDeDemandes() error {
	return socle.Problem(http.StatusTooManyRequests, "RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute.")
}

// La composition de la page, et rien d'autre : aucune donnée de fiche, et aucun
// jeton exigé. Demander le jeton dirait à qui le devine quels comptes existent.
func (s *service) formulairePublic(ctx context.Context, _ *struct{}) (*FormulairePublicOutput, error) {
	if !formulaireLimiteLecture.Autorise(formulaireAdresse(ctx)) {
		return nil, formulaireTropDeDemandes()
	}
	reglages, err := s.prospectReglages(ctx, db.ProjetCHUES)
	if err != nil {
		return nil, err
	}
	out := &FormulairePublicOutput{}
	out.Body.Champs = []ProspectReglageChamp{}
	for _, champ := range reglages.Champs {
		if champ.Visible && slices.Contains(FormulaireChampsPublics, champ.Champ) {
			out.Body.Champs = append(out.Body.Champs, champ)
		}
	}
	out.Body.Libres = reglages.Libres
	out.Body.DureesEtablissement = formulaireDurees
	out.Body.TurnstileSiteKey = formulaireTurnstile.siteKey
	return out, s.formulaireListes(ctx, out)
}

func (s *service) formulaireListes(ctx context.Context, out *FormulairePublicOutput) error {
	banques, err := s.Q.BanquesActives(ctx)
	if err != nil {
		return err
	}
	syndicats, err := s.Q.SyndicatsActifs(ctx)
	if err != nil {
		return err
	}
	revenus, err := s.Q.TranchesRevenuActives(ctx)
	if err != nil {
		return err
	}
	professions, err := s.Q.ProfessionsActives(ctx)
	if err != nil {
		return err
	}
	out.Body.Banques = make([]FormulaireOption, 0, len(banques))
	for _, ligne := range banques {
		out.Body.Banques = append(out.Body.Banques, FormulaireOption{ID: ligne.ID, Libelle: ligne.Libelle})
	}
	out.Body.Syndicats = make([]FormulaireOption, 0, len(syndicats))
	for _, ligne := range syndicats {
		out.Body.Syndicats = append(out.Body.Syndicats, FormulaireOption{ID: ligne.ID, Libelle: ligne.Libelle})
	}
	out.Body.Revenus = make([]FormulaireOption, 0, len(revenus))
	for _, ligne := range revenus {
		out.Body.Revenus = append(out.Body.Revenus, FormulaireOption{ID: ligne.ID, Libelle: ligne.Libelle})
	}
	out.Body.Professions = make([]FormulaireOption, 0, len(professions))
	for _, ligne := range professions {
		out.Body.Professions = append(out.Body.Professions, FormulaireOption{ID: ligne.ID, Libelle: ligne.Libelle})
	}
	return nil
}

type formulaireCorps struct {
	Nom                    string            `json:"nom" minLength:"1" maxLength:"120"`
	Prenom                 string            `json:"prenom" minLength:"1" maxLength:"120"`
	Phone                  string            `json:"phone" minLength:"6" maxLength:"40"`
	Email                  *string           `json:"email,omitempty" format:"email" maxLength:"160" required:"false"`
	ProfessionID           *string           `json:"professionId,omitempty" format:"uuid" required:"false"`
	Profession             *string           `json:"profession,omitempty" maxLength:"120" required:"false"`
	Etablissement          *string           `json:"etablissement,omitempty" maxLength:"160" required:"false"`
	Employeur              *string           `json:"employeur,omitempty" maxLength:"160" required:"false"`
	DureeEtablissementMois *int32            `json:"dureeEtablissementMois,omitempty" minimum:"0" maximum:"600" required:"false"`
	Fonctionnaire          *bool             `json:"fonctionnaire,omitempty" required:"false"`
	EngagementEnCours      *bool             `json:"engagementEnCours,omitempty" required:"false"`
	SyndicatID             *string           `json:"syndicatId,omitempty" format:"uuid" required:"false"`
	BanqueID               *string           `json:"banqueId,omitempty" format:"uuid" required:"false"`
	IncomeBandID           *string           `json:"incomeBandId,omitempty" format:"uuid" required:"false"`
	Type                   *string           `json:"type,omitempty" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA" required:"false"`
	PaymentMode            *string           `json:"paymentMode,omitempty" enum:"COMPTANT,ECHELONNE" required:"false"`
	DureeSystemeMois       *int32            `json:"dureeSystemeMois,omitempty" minimum:"1" maximum:"300" required:"false"`
	WhatsappStatus         *string           `json:"whatsappStatus,omitempty" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN" required:"false"`
	WhatsappE164           *string           `json:"whatsappE164,omitempty" minLength:"6" maxLength:"40" required:"false"`
	ChampsLibres           map[string]string `json:"champsLibres,omitempty" required:"false"`
	Message                *string           `json:"message,omitempty" maxLength:"500" required:"false"`
	Site                   *string           `json:"site,omitempty" maxLength:"200" required:"false"`
	TurnstileToken         *string           `json:"turnstileToken,omitempty" maxLength:"2048" required:"false"`
}

type FormulaireDemandeInput struct {
	Jeton string `path:"jeton" maxLength:"64"`
	Body  formulaireCorps
}

// Ce qu'un visiteur envoie, une fois les réglages appliqués.
type formulaireSaisie struct {
	nom                    string
	prenom                 string
	phoneE164              string
	email                  *string
	profession             *string
	professionID           *string
	employeur              *string
	etablissement          *string
	banqueID               *string
	syndicatID             *string
	incomeBandID           *string
	typeProspect           *string
	paymentMode            *string
	dureeSystemeMois       *int32
	whatsappStatus         *string
	whatsappE164           *string
	champsLibres           map[string]string
	dureeEtablissementMois *int32
	fonctionnaire          *bool
	engagementEnCours      *bool
}

// La SEULE écriture ouverte sans compte. Elle ne lit rien : ni recherche par
// numéro, ni pré-remplissage, ni existence d'une fiche.
func (s *service) formulaireRecevoir(ctx context.Context, in *FormulaireDemandeInput) (*ProspectOkOutput, error) {
	if !formulaireLimiteEcriture.Autorise(formulaireAdresse(ctx)) {
		return nil, formulaireTropDeDemandes()
	}
	out := &ProspectOkOutput{}
	out.Body.Ok = true
	// Le piège est rempli : la réponse est celle d'un envoi accepté, et rien
	// n'est écrit. Un refus explicite apprendrait au robot à contourner.
	if in.Body.Site != nil && strings.TrimSpace(*in.Body.Site) != "" {
		return out, nil
	}
	if err := formulaireVerifierTurnstile(ctx, in.Body.TurnstileToken); err != nil {
		return nil, err
	}
	// Le lien porte le compte qui l'a partagé, et c'est lui qui devient auteur :
	// `createdById` est obligatoire, et un compte tiré au hasard rendrait la
	// fiche invisible au téléconseiller qui a démarché.
	agentID, err := s.Q.AgentParJeton(ctx, &in.Jeton)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "LIEN_INVALIDE", formulaireLienMort)
	}
	if err != nil {
		return nil, err
	}
	saisie, err := s.formulaireRetenir(ctx, in)
	if err != nil {
		return nil, err
	}
	prospectID, err := s.formulaireRapprocherOuCreer(ctx, agentID, &saisie)
	if err != nil {
		return nil, err
	}
	// La demande est enregistrée : la perdre parce qu'un e-mail n'est pas parti
	// ferait ressaisir le visiteur pour rien.
	if err := s.formulairePrevenir(ctx, agentID, prospectID, in, &saisie); err != nil {
		slog.Error("demande publique enregistrée, avis non émis", "prospectId", prospectID, "err", err)
	}
	return out, nil
}

// Supervision et compte partageur dans la boîte de réception, la même chose par
// e-mail, et l'accusé au visiteur s'il a laissé une adresse. L'e-mail de
// supervision part d'ici et non de l'expédition des notifications : celle-ci ne
// sert que les téléconseillers, par choix, et l'encadrement doit l'être aussi.
func (s *service) formulairePrevenir(ctx context.Context, agentID, prospectID string, in *FormulaireDemandeInput, saisie *formulaireSaisie) error {
	parametres, err := s.prospectLireParametres(ctx)
	if err != nil {
		return err
	}
	superviseurs, err := s.Q.SuperviseursActifs(ctx)
	if err != nil {
		return err
	}
	agent, err := s.Q.NomCompletUtilisateur(ctx, agentID)
	if err != nil {
		return err
	}
	prenomNom := saisie.prenom + " " + saisie.nom
	informations := formulaireResumer(in, saisie)
	titre := prospectTronquer("Demande reçue du formulaire public : "+prenomNom, formulaireTitreMax)
	corps := prospectTronquer(informations+"\nLien partagé par "+agent+".", formulaireCorpsMax)

	destinataires := make([]string, 0, len(superviseurs)+1)
	for _, membre := range superviseurs {
		destinataires = append(destinataires, membre.ID)
	}
	if _, err := notifications.Composer(ctx, s.Deps, agentID, &notifications.CreationNotification{
		Title: titre, Body: corps, Category: string(db.NotificationCategorySYSTEME),
		Route:    "/chues/prospects/" + prospectID,
		Audience: string(db.NotificationAudienceUSERS), AudienceUserIDs: append(destinataires, agentID),
	}); err != nil {
		return err
	}
	return s.formulaireAviserParEmail(ctx, &parametres, superviseurs, prospectID, prenomNom, titre, corps, informations, saisie)
}

func (s *service) formulaireAviserParEmail(ctx context.Context, parametres *ProspectParametresChues, superviseurs []db.SuperviseursActifsRow, prospectID, prenomNom, titre, corps, informations string, saisie *formulaireSaisie) error {
	var copies []notifications.DestinataireBrevo
	for _, membre := range superviseurs {
		if membre.Email != "" {
			copies = append(copies, notifications.DestinataireBrevo{Email: membre.Email, Nom: membre.FullName})
		}
	}
	for _, adresse := range parametres.DestinatairesSupervision {
		if propre := strings.TrimSpace(adresse); propre != "" {
			copies = append(copies, notifications.DestinataireBrevo{Email: propre})
		}
	}
	var messages []notifications.MessageBrevo
	if len(copies) > 0 {
		messages = append(messages, notifications.MessageBrevo{
			Destinataires: copies, Sujet: titre, Texte: corps, HTML: formulaireEnHtml(corps),
		})
	}
	if saisie.email != nil {
		jetons := map[string]string{
			"prenomNom": prenomNom, "informations": informations, "telephone": saisie.phoneE164,
			"date":          formulaireDateLongue(time.Now().In(s.Cfg.TimeZone)),
			"emailChues":    parametres.EmailChues,
			"whatsappChues": parametres.WhatsappChuesE164,
		}
		accuse := formulaireRemplacerJetons(parametres.AccuseReceptionCorps, jetons)
		messages = append(messages, notifications.MessageBrevo{
			Destinataires: []notifications.DestinataireBrevo{{Email: *saisie.email, Nom: prenomNom}},
			Sujet:         formulaireRemplacerJetons(parametres.AccuseReceptionObjet, jetons),
			Texte:         accuse, HTML: formulaireEnHtml(accuse),
		})
	}
	if len(messages) == 0 {
		return nil
	}
	transport := notifications.ConfigurerBrevo()
	if envoi := transport.Envoyer(ctx, messages); envoi.Statut != notifications.BrevoEnvoye {
		slog.Warn("avis de demande publique non remis", "prospectId", prospectID, "statut", envoi.Statut)
	}
	return nil
}

// Le référentiel choisi n'est PAS repris : il est déjà sur la fiche, sous son
// libellé. Ne restent que le numéro saisi et ce qu'aucune colonne ne porte.
func formulaireResumer(in *FormulaireDemandeInput, saisie *formulaireSaisie) string {
	lignes := []string{"Nom : " + saisie.prenom + " " + saisie.nom, "Téléphone : " + saisie.phoneE164}
	for _, entree := range []struct {
		libelle string
		valeur  *string
	}{
		{formulaireLibelleMel, saisie.email},
		{exports.ExportEnteteProfession, saisie.profession},
		{exports.ExportEnteteEtablissement, saisie.etablissement},
		{exports.FormulaireLibelleEmployeur, saisie.employeur},
	} {
		if entree.valeur != nil {
			lignes = append(lignes, entree.libelle+" : "+*entree.valeur)
		}
	}
	if saisie.dureeEtablissementMois != nil {
		lignes = append(lignes, "Durée dans l’établissement : "+formulaireTrancheDuree(*saisie.dureeEtablissementMois))
	}
	if saisie.fonctionnaire != nil {
		lignes = append(lignes, "Fonctionnaire : "+formulaireOuiNon(*saisie.fonctionnaire))
	}
	if saisie.engagementEnCours != nil {
		lignes = append(lignes, "Engagement en cours à la banque : "+formulaireOuiNon(*saisie.engagementEnCours))
	}
	if in.Body.Message != nil {
		lignes = append(lignes, "Message : "+*in.Body.Message)
	}
	return strings.Join(lignes, "\n")
}

func formulaireOuiNon(valeur bool) string {
	if valeur {
		return "oui"
	}
	return "non"
}

// Le visiteur choisit une tranche : rendre « 0 mois » au relecteur serait faux.
func formulaireTrancheDuree(mois int32) string {
	for _, tranche := range formulaireDurees {
		if tranche.Mois == mois {
			return tranche.Libelle
		}
	}
	return strconv.Itoa(int(mois)) + " mois"
}

func formulaireEnHtml(texte string) string {
	echapper := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\n", "<br />")
	return "<p>" + echapper.Replace(texte) + "</p>"
}

// Jetons `{prenomNom}` du texte d'accusé réglé par l'administrateur.
func formulaireRemplacerJetons(texte string, jetons map[string]string) string {
	return formulaireMotifJeton.ReplaceAllStringFunc(texte, func(marqueur string) string {
		if valeur, connu := jetons[strings.Trim(marqueur, "{}")]; connu {
			return valeur
		}
		return marqueur
	})
}

func formulaireDateLongue(instant time.Time) string {
	return strconv.Itoa(instant.Day()) + " " + formulaireMois[instant.Month()-1] + " " + strconv.Itoa(instant.Year())
}

// Un champ masqué puis envoyé quand même est ignoré : une page en cache ou un
// robot ne doit pas faire échouer un vrai visiteur. Un champ exigé et absent,
// lui, arrête l'envoi.
func (s *service) formulaireRetenir(ctx context.Context, in *FormulaireDemandeInput) (formulaireSaisie, error) {
	corps := &in.Body
	saisie := formulaireSaisie{champsLibres: map[string]string{}}
	reglages, err := s.prospectReglages(ctx, db.ProjetCHUES)
	if err != nil {
		return saisie, err
	}
	visibles := map[string]bool{}
	for _, champ := range reglages.Champs {
		if champ.Visible && slices.Contains(FormulaireChampsPublics, champ.Champ) {
			visibles[champ.Champ] = true
		}
	}
	formulaireLibresRetenus(&reglages, corps.ChampsLibres, saisie.champsLibres)
	if err := formulaireManquants(&reglages, visibles, saisie.champsLibres, in); err != nil {
		return saisie, err
	}
	if saisie.phoneE164, err = database.NormaliserTelephone(corps.Phone, s.Cfg.PhoneRegion); err != nil {
		return saisie, err
	}
	saisie.nom, saisie.prenom = strings.TrimSpace(corps.Nom), strings.TrimSpace(corps.Prenom)
	numero := formulaireGarde(visibles, socle.ProspectChampWhatsappNumero, corps.WhatsappE164)
	if saisie.whatsappE164, err = s.prospectNumeroOptionnel(numero); err != nil {
		return saisie, err
	}
	if err := s.formulaireProfession(ctx, visibles, in, &saisie); err != nil {
		return saisie, err
	}
	formulaireRetenirChamps(visibles, corps, &saisie)
	return saisie, nil
}

// Une réponse à un champ qu'aucun réglage ne déclare plus est écartée : elle
// serait inerte sur la fiche et le classeur ne saurait pas la nommer.
func formulaireLibresRetenus(reglages *ProspectReglagesConversion, envoyes, retenus map[string]string) {
	declares := map[string]bool{}
	for _, libre := range reglages.Libres {
		declares[libre.ID] = true
	}
	for id, valeur := range envoyes {
		if !declares[id] {
			continue
		}
		if texte := strings.TrimSpace(valeur); texte != "" {
			retenus[id] = prospectTronquer(texte, prospectReponseMax)
		}
	}
}

func formulaireRetenirChamps(visibles map[string]bool, corps *formulaireCorps, saisie *formulaireSaisie) {
	saisie.email = formulaireMinuscule(formulaireGarde(visibles, prospectChampEmail, corps.Email))
	saisie.etablissement = prospectRogner(formulaireGarde(visibles, socle.ProspectChampEtablissement, corps.Etablissement))
	saisie.employeur = prospectRogner(corps.Employeur)
	saisie.banqueID = formulaireGarde(visibles, prospectChampBanque, corps.BanqueID)
	saisie.syndicatID = formulaireGarde(visibles, prospectChampSyndicat, corps.SyndicatID)
	saisie.incomeBandID = formulaireGarde(visibles, prospectChampRevenu, corps.IncomeBandID)
	saisie.typeProspect = formulaireGarde(visibles, prospectChampType, corps.Type)
	saisie.paymentMode = formulaireGarde(visibles, prospectChampPaiement, corps.PaymentMode)
	saisie.dureeSystemeMois = formulaireGarde(visibles, prospectChampDureeSysteme, corps.DureeSystemeMois)
	saisie.whatsappStatus = formulaireGarde(visibles, socle.ProspectChampWhatsappStatut, corps.WhatsappStatus)
	saisie.dureeEtablissementMois = formulaireGarde(visibles, prospectChampDureeEtablissement, corps.DureeEtablissementMois)
	saisie.fonctionnaire = formulaireGarde(visibles, prospectChampFonctionnaire, corps.Fonctionnaire)
	saisie.engagementEnCours = formulaireGarde(visibles, prospectChampEngagement, corps.EngagementEnCours)
}

func formulaireGarde[T any](visibles map[string]bool, champ string, valeur *T) *T {
	if !visibles[champ] {
		return nil
	}
	return valeur
}

func formulaireMinuscule(v *string) *string {
	if v == nil {
		return nil
	}
	return prospectPtr(strings.ToLower(strings.TrimSpace(*v)))
}

// Un identifiant inconnu ou désactivé est ignoré plutôt que refusé : une page
// ouverte avant le retrait d'une profession doit pouvoir être envoyée.
func (s *service) formulaireProfession(ctx context.Context, visibles map[string]bool, in *FormulaireDemandeInput, saisie *formulaireSaisie) error {
	choisie := formulaireGarde(visibles, "profession", in.Body.ProfessionID)
	if choisie != nil {
		ligne, err := s.Q.ProfessionActive(ctx, *choisie)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if err == nil {
			saisie.profession, saisie.professionID = &ligne.Label, &ligne.ID
			return nil
		}
	}
	saisie.profession = prospectRogner(formulaireGarde(visibles, socle.ProspectChampProfession, in.Body.Profession))
	return nil
}

func formulaireValeurSaisie(corps *formulaireCorps, champ string) bool {
	presents := map[string]bool{
		prospectChampNom:          strings.TrimSpace(corps.Nom) != "",
		socle.ProspectChampPrenom: strings.TrimSpace(corps.Prenom) != "",
		socle.ProspectChampPhone:  corps.Phone != "", prospectChampEmail: corps.Email != nil,
		socle.ProspectChampProfession:     corps.ProfessionID != nil || corps.Profession != nil,
		socle.ProspectChampEtablissement:  corps.Etablissement != nil,
		prospectChampDureeEtablissement:   corps.DureeEtablissementMois != nil,
		prospectChampFonctionnaire:        corps.Fonctionnaire != nil,
		prospectChampType:                 corps.Type != nil,
		prospectChampSyndicat:             corps.SyndicatID != nil,
		prospectChampBanque:               corps.BanqueID != nil,
		prospectChampEngagement:           corps.EngagementEnCours != nil,
		prospectChampRevenu:               corps.IncomeBandID != nil,
		prospectChampPaiement:             corps.PaymentMode != nil,
		prospectChampDureeSysteme:         corps.DureeSystemeMois != nil,
		socle.ProspectChampWhatsappStatut: corps.WhatsappStatus != nil,
		socle.ProspectChampWhatsappNumero: corps.WhatsappE164 != nil,
	}
	return presents[champ]
}

func formulaireManquants(reglages *ProspectReglagesConversion, visibles map[string]bool, retenus map[string]string, in *FormulaireDemandeInput) error {
	libelles := []string{}
	for _, champ := range reglages.Champs {
		if visibles[champ.Champ] && champ.Obligatoire && !formulaireValeurSaisie(&in.Body, champ.Champ) {
			libelles = append(libelles, champ.Libelle)
		}
	}
	for _, libre := range reglages.Libres {
		if libre.Obligatoire && retenus[libre.ID] == "" {
			libelles = append(libelles, libre.Libelle)
		}
	}
	if len(libelles) == 0 {
		return nil
	}
	return socle.Problem(http.StatusBadRequest, "CHAMPS_OBLIGATOIRES", "Renseignez "+strings.Join(libelles, ", ")+" avant d’envoyer.")
}

// Le rapprochement se fait ICI, après envoi : le formulaire n'affiche jamais
// qu'un numéro est déjà connu et ne pré-remplit rien depuis la base.
func (s *service) formulaireRapprocherOuCreer(ctx context.Context, agentID string, saisie *formulaireSaisie) (string, error) {
	existant, trouve, err := s.formulaireTrouver(ctx, saisie)
	if err != nil {
		return "", err
	}
	if trouve {
		return existant.ID, s.formulaireCompleter(ctx, &existant, saisie)
	}
	id, err := s.formulaireCreer(ctx, agentID, saisie)
	if err == nil {
		return id, nil
	}
	// Deux onglets arrivent ici ensemble : l'index unique partiel a laissé
	// passer une seule insertion, et le perdant reprend le rapprochement au lieu
	// de rendre une erreur au visiteur.
	concurrent, trouve, relecture := s.formulaireTrouver(ctx, saisie)
	if relecture != nil || !trouve {
		return "", err
	}
	return concurrent.ID, s.formulaireCompleter(ctx, &concurrent, saisie)
}

// Le TÉLÉPHONE fait foi : il porte l'index unique partiel. L'e-mail ne sert qu'à
// rattraper le numéro inconnu, et quand les deux désignent deux fiches, celle du
// numéro l'emporte : fusionner serait destructeur.
func (s *service) formulaireTrouver(ctx context.Context, saisie *formulaireSaisie) (db.ProspectParTelephoneRow, bool, error) {
	parNumero, err := s.Q.ProspectParTelephone(ctx, saisie.phoneE164)
	if err == nil {
		return parNumero, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return parNumero, false, err
	}
	if saisie.email == nil {
		return parNumero, false, nil
	}
	parEmail, err := s.Q.ProspectParEmail(ctx, saisie.email)
	if errors.Is(err, pgx.ErrNoRows) {
		return parNumero, false, nil
	}
	if err != nil {
		return parNumero, false, err
	}
	return db.ProspectParTelephoneRow(parEmail), true, nil
}

func (s *service) formulaireCreer(ctx context.Context, agentID string, saisie *formulaireSaisie) (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	maintenant := time.Now()
	libres, err := formulaireChampsLibresJSON(saisie.champsLibres)
	if err != nil {
		return "", err
	}
	arg := db.InsertProspectParams{
		ID: id.String(), Nom: saisie.nom, Prenom: saisie.prenom, PhoneE164: saisie.phoneE164,
		CreatedById: agentID, ClientCreatedAt: maintenant,
		Statut: db.ProspectStatutNOUVEAU, Projet: db.ProjetCHUES,
		Origin: prospectPtr(formulairePublicOrigine), ARevoirAt: &maintenant,
		Email: saisie.email, Profession: saisie.profession, ProfessionId: saisie.professionID,
		Employeur: saisie.employeur, Etablissement: saisie.etablissement,
		BanqueId: saisie.banqueID, SyndicatId: saisie.syndicatID, IncomeBandId: saisie.incomeBandID,
		Type:             prospectTypeEnum[db.ProspectType](prospectDeref(saisie.typeProspect)),
		PaymentMode:      prospectTypeEnum[db.PaymentMode](prospectDeref(saisie.paymentMode)),
		DureeSystemeMois: saisie.dureeSystemeMois, WhatsappStatus: db.WhatsappStatusNONDEMANDE,
		ChampsLibres: libres,
	}
	statut, numero := prospectWhatsapp(formulaireWhatsapp(saisie), nil, saisie.phoneE164)
	if statut != nil {
		arg.WhatsappStatus, arg.WhatsappE164 = *statut, numero
	}
	journeyID, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.InsertProspect(ctx, arg); err != nil {
			return err
		}
		return q.InsertJourney(ctx, db.InsertJourneyParams{
			ID: journeyID.String(), ProspectId: id.String(), Projet: db.ProjetCHUES,
			Statut: db.ProspectStatutNOUVEAU, Consent: db.GrandPublicConsentNONDEMANDE,
		})
	})
}

func formulaireWhatsapp(saisie *formulaireSaisie) prospectWhatsappSaisi {
	demande := prospectWhatsappSaisi{numero: saisie.whatsappE164, numeroFourni: saisie.whatsappE164 != nil}
	if saisie.whatsappStatus != nil {
		demande.statut = prospectPtr(db.WhatsappStatus(*saisie.whatsappStatus))
	}
	return demande
}

func formulaireChampsLibresJSON(reponses map[string]string) ([]byte, error) {
	if len(reponses) == 0 {
		return nil, nil
	}
	return json.Marshal(reponses)
}

// Une saisie publique non vérifiée ne remplit que ce qui est VIDE : le numéro
// n'est jamais réécrit, et la fiche rapprochée par e-mail garde le sien.
func (s *service) formulaireCompleter(ctx context.Context, existant *db.ProspectParTelephoneRow, saisie *formulaireSaisie) error {
	maj := prospectNouvelleMaj()
	maj.set("origin", formulairePublicOrigine)
	maj.set("aRevoirAt", time.Now())
	formulaireCombler(maj, prospectChampNom, &existant.Nom, &saisie.nom)
	formulaireCombler(maj, socle.ProspectChampPrenom, &existant.Prenom, &saisie.prenom)
	formulaireCombler(maj, prospectChampEmail, existant.Email, saisie.email)
	formulaireCombler(maj, socle.ProspectChampProfession, existant.Profession, saisie.profession)
	formulaireCombler(maj, "professionId", existant.ProfessionId, saisie.professionID)
	formulaireCombler(maj, "employeur", existant.Employeur, saisie.employeur)
	formulaireCombler(maj, socle.ProspectChampEtablissement, existant.Etablissement, saisie.etablissement)
	formulaireCombler(maj, prospectChampBanque, existant.BanqueId, saisie.banqueID)
	formulaireCombler(maj, prospectChampSyndicat, existant.SyndicatId, saisie.syndicatID)
	formulaireCombler(maj, prospectChampRevenu, existant.IncomeBandId, saisie.incomeBandID)
	formulaireComblerEnum[db.ProspectType](maj, prospectChampType, prospectEnum(existant.Type), saisie.typeProspect)
	formulaireComblerEnum[db.PaymentMode](maj, prospectChampPaiement, prospectEnum(existant.PaymentMode), saisie.paymentMode)
	if existant.DureeSystemeMois == nil && saisie.dureeSystemeMois != nil {
		maj.set(prospectChampDureeSysteme, *saisie.dureeSystemeMois)
	}
	// La question n'a jamais été posée : sinon le statut porte une réponse, et
	// une déclaration publique ne la corrige pas.
	if existant.WhatsappStatus == db.WhatsappStatusNONDEMANDE && existant.WhatsappE164 == nil {
		if statut, numero := prospectWhatsapp(formulaireWhatsapp(saisie), nil, existant.PhoneE164); statut != nil {
			maj.set(socle.ProspectChampWhatsappStatut, *statut)
			maj.set(socle.ProspectChampWhatsappNumero, numero)
		}
	}
	libres := formulaireReponsesAbsentes(existant.ChampsLibres, saisie.champsLibres)
	if libres != nil {
		maj.set("champsLibres", libres)
	}
	return maj.appliquer(ctx, s.Pool, existant.ID)
}

func formulaireCombler(maj *prospectMaj, colonne string, courant, valeur *string) {
	if valeur == nil || *valeur == "" {
		return
	}
	if courant != nil && *courant != "" {
		return
	}
	maj.set(colonne, *valeur)
}

func formulaireComblerEnum[T ~string](maj *prospectMaj, colonne string, courant, valeur *string) {
	if valeur == nil || courant != nil {
		return
	}
	maj.set(colonne, T(*valeur))
}

func formulaireReponsesAbsentes(deja []byte, saisies map[string]string) []byte {
	if len(saisies) == 0 {
		return nil
	}
	courant := prospectReponses(deja)
	ajout := false
	for id, valeur := range saisies {
		if _, present := courant[id]; !present {
			courant[id] = valeur
			ajout = true
		}
	}
	if !ajout {
		return nil
	}
	encode, err := json.Marshal(courant)
	if err != nil {
		return nil
	}
	return encode
}

// La seule barrière anti-robot de la route publique, à côté du champ piège.
// Sans clé secrète l'envoi est REFUSÉ : une vérification qui se désactive quand
// sa configuration manque ne protège rien, et personne ne s'apercevrait qu'elle
// est tombée.
func formulaireVerifierTurnstile(ctx context.Context, jeton *string) error {
	config := formulaireTurnstile
	if config.secret == "" {
		if !config.degradee {
			return socle.Problem(http.StatusServiceUnavailable, "CAPTCHA_INDISPONIBLE",
				"La vérification anti-robot est indisponible. Réessayez dans un instant.")
		}
		slog.Warn("TURNSTILE_SECRET_KEY absent et TURNSTILE_ALLOW_DEGRADED=true : demande publique acceptée sans vérification")
		return nil
	}
	if jeton == nil || strings.TrimSpace(*jeton) == "" {
		return formulaireCaptchaRefuse()
	}
	corps := url.Values{"secret": {config.secret}, "response": {strings.TrimSpace(*jeton)}}
	// `remoteip` est l'adresse réelle du visiteur, celle du limiteur : sans elle
	// Cloudflare note tous les envois sur l'adresse du serveur.
	if adresse := formulaireAdresse(ctx); adresse != "" {
		corps.Set("remoteip", adresse)
	}
	valide, err := formulaireSiteverifyAppel(ctx, corps)
	if err != nil {
		return err
	}
	if !valide {
		return formulaireCaptchaRefuse()
	}
	return nil
}

func formulaireCaptchaRefuse() error {
	return socle.Problem(http.StatusBadRequest, "CAPTCHA_REFUSE",
		"La vérification anti-robot n’a pas abouti. Rechargez la page et recommencez.")
}

func formulaireCaptchaIndisponible() error {
	return socle.Problem(http.StatusServiceUnavailable, "CAPTCHA_INDISPONIBLE",
		"La vérification anti-robot est indisponible. Réessayez dans un instant.")
}

func formulaireSiteverifyAppel(ctx context.Context, corps url.Values) (bool, error) {
	appel, annuler := context.WithTimeout(ctx, formulaireDelai)
	defer annuler()
	req, err := http.NewRequestWithContext(appel, http.MethodPost, formulaireSiteverify, strings.NewReader(corps.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reponse, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Error("Cloudflare injoignable : vérification anti-robot impossible", "err", err)
		return false, formulaireCaptchaIndisponible()
	}
	defer func() { _ = reponse.Body.Close() }()
	if reponse.StatusCode != http.StatusOK {
		slog.Error("Cloudflare a refusé la vérification anti-robot", "status", reponse.StatusCode)
		return false, formulaireCaptchaIndisponible()
	}
	var charge struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(io.LimitReader(reponse.Body, 1<<16)).Decode(&charge); err != nil {
		return false, nil
	}
	if !charge.Success {
		slog.Warn("Vérification anti-robot refusée", "codes", charge.ErrorCodes)
	}
	return charge.Success, nil
}

var GardeFormulairePublic = map[string][]socle.Role{
	"GET /api/v1/formulaire-public/formulaire": {socle.Public},
	"POST /api/v1/formulaire-public/{jeton}":   {socle.Public},
}

func MonterFormulairePublic(api huma.API, d *socle.Deps) {
	s := &service{d}
	formulaireTurnstile = formulaireConfigTurnstile{
		secret:   strings.TrimSpace(socle.Env("TURNSTILE_SECRET_KEY", "")),
		siteKey:  strings.TrimSpace(socle.Env("TURNSTILE_SITE_KEY", "")),
		degradee: socle.Env("TURNSTILE_ALLOW_DEGRADED", "false") == prospectVrai,
	}
	huma.Register(api, huma.Operation{OperationID: "lireFormulairePublic", Method: http.MethodGet, Path: "/api/v1/formulaire-public/formulaire"}, s.formulairePublic)
	huma.Register(api, huma.Operation{OperationID: "envoyerDemandePublique", Method: http.MethodPost, Path: "/api/v1/formulaire-public/{jeton}", DefaultStatus: http.StatusCreated}, s.formulaireRecevoir)
}
