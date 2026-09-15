package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	prospectEntite              = "prospect"
	prospectSigleChues          = "CHUES"
	prospectBanqueCbao          = "CBAO"
	formulairePublicOrigine     = "FORMULAIRE_PUBLIC"
	prospectIntrouvable         = "Prospect introuvable."
	prospectCodeIntrouvable     = "PROSPECT_NOT_FOUND"
	prospectCodeMauvaiseRequete = "BAD_REQUEST"
	prospectChampsLibresMax     = 20
	prospectReponseMax          = 500
	prospectTriDefaut           = "clientCreatedAt"
	prospectOrdreDefaut         = "desc"
	prospectVrai                = "true"
	prospectCheminID            = "/api/v1/prospects/{id}"
)

// Les clés du catalogue de conversion, nommées une fois : les réglages, le
// formulaire public et la liste des champs imposés parlent des mêmes.
const (
	prospectChampNom                = "nom"
	prospectChampEmail              = "email"
	prospectChampDureeEtablissement = "dureeEtablissementMois"
	prospectChampFonctionnaire      = "fonctionnaire"
	prospectChampType               = "type"
	prospectChampSyndicat           = "syndicatId"
	prospectChampBanque             = "banqueId"
	prospectChampEngagement         = "engagementEnCours"
	prospectChampRevenu             = "incomeBandId"
	prospectChampPaiement           = "paymentMode"
	prospectChampTypeBien           = "typeBien"
	prospectChampChampsLibres       = "champsLibres"
	prospectChampDureeSysteme       = "dureeSystemeMois"
	prospectChampMethode            = "method"
	prospectChampRendezVous         = "rendezVousAt"
)

// Un PATCH doit séparer « champ absent » de « champ vidé » : sans ce type, une
// banque saisie par erreur ne se corrige plus, elle se remplace seulement.
type prospectOptionnel[T any] struct {
	fourni bool
	valeur *T
}

func (o *prospectOptionnel[T]) UnmarshalJSON(donnees []byte) error {
	o.fourni = true
	if string(donnees) == "null" {
		o.valeur = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(donnees, &v); err != nil {
		return err
	}
	o.valeur = &v
	return nil
}

func (prospectOptionnel[T]) Schema(r huma.Registry) *huma.Schema {
	s := huma.SchemaFromType(r, reflect.TypeFor[T]())
	s.Nullable = true
	return s
}

func prospectISO(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func prospectISOPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	return prospectPtr(prospectISO(*t))
}

func prospectEnum[T ~string](v *T) *string {
	if v == nil {
		return nil
	}
	return prospectPtr(string(*v))
}

func prospectPremier[T any](a, b *T) *T {
	if a != nil {
		return a
	}
	return b
}

func prospectRogner(v *string) *string {
	if v == nil {
		return nil
	}
	return prospectPtr(strings.TrimSpace(*v))
}

func prospectPtr[T any](v T) *T { return &v }

func prospectDeref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func prospectVide(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func prospectTypeEnum[T ~string](v string) *T {
	if v == "" {
		return nil
	}
	return prospectPtr(T(v))
}

func prospectTronquer(texte string, maximum int) string {
	if len(texte) <= maximum {
		return texte
	}
	return texte[:maximum]
}

type ProspectJourney struct {
	ID          string  `json:"id"`
	Projet      string  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Statut      string  `json:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Consent     string  `json:"consent" enum:"NON_DEMANDE,INTERESSE,REFUSE"`
	ConsentAt   *string `json:"consentAt"`
	ConvertedAt *string `json:"convertedAt"`
}

type Prospect struct {
	ID                       string            `json:"id"`
	Nom                      string            `json:"nom"`
	Prenom                   string            `json:"prenom"`
	PhoneE164                *string           `json:"phoneE164"`
	Rev                      int32             `json:"rev"`
	Statut                   string            `json:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Projet                   string            `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	BanqueID                 *string           `json:"banqueId"`
	BanqueName               *string           `json:"banqueName"`
	SyndicatID               *string           `json:"syndicatId"`
	SyndicatSigle            *string           `json:"syndicatSigle"`
	RepresentantID           *string           `json:"representantId"`
	RepresentantName         *string           `json:"representantName"`
	RepresentantPhoneE164    *string           `json:"representantPhoneE164"`
	DepartementID            *string           `json:"departementId"`
	DepartementName          *string           `json:"departementName"`
	OwnedByCommercialID      string            `json:"ownedByCommercialId"`
	OwnedByCommercialName    string            `json:"ownedByCommercialName"`
	Type                     *string           `json:"type" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	Profession               *string           `json:"profession"`
	ProfessionID             *string           `json:"professionId"`
	ProfessionIsTeaching     *bool             `json:"professionIsTeaching"`
	IncomeBandID             *string           `json:"incomeBandId"`
	IncomeBandLabel          *string           `json:"incomeBandLabel"`
	PaymentMode              *string           `json:"paymentMode" enum:"COMPTANT,ECHELONNE,CREDIT_IMMOBILIER"`
	TypeBien                 *string           `json:"typeBien" enum:"TERRAIN,VILLA"`
	EmployeurID              *string           `json:"employeurId"`
	Employeur                *string           `json:"employeur"`
	TypeContrat              *string           `json:"typeContrat" enum:"CDI,CDD,AUTRE"`
	AncienneteMois           *int32            `json:"ancienneteMois"`
	LieuActivite             *string           `json:"lieuActivite"`
	ModeEpargne              *string           `json:"modeEpargne" enum:"TONTINE,MOBILE_MONEY,BANQUE,AUCUN"`
	PaysResidenceID          *string           `json:"paysResidenceId"`
	PaysResidenceLabel       *string           `json:"paysResidenceLabel"`
	VilleResidence           *string           `json:"villeResidence"`
	Etablissement            *string           `json:"etablissement"`
	WhatsappStatus           string            `json:"whatsappStatus" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	WhatsappE164             *string           `json:"whatsappE164"`
	WhatsappNumber           *string           `json:"whatsappNumber"`
	RelaisNom                *string           `json:"relaisNom"`
	RelaisPhoneE164          *string           `json:"relaisPhoneE164"`
	Journeys                 []ProspectJourney `json:"journeys"`
	ChampsLibres             map[string]string `json:"champsLibres"`
	DureeSystemeMois         *int32            `json:"dureeSystemeMois"`
	CanalProvenanceID        *string           `json:"canalProvenanceId"`
	CanalProvenanceLabel     *string           `json:"canalProvenanceLabel"`
	Segment                  *string           `json:"segment" enum:"BDD1,BDD2,BDD3,BDD4"`
	Phase2Status             string            `json:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER"`
	EnrollmentMethod         *string           `json:"enrollmentMethod"`
	EnrollmentCapturedByID   *string           `json:"enrollmentCapturedById"`
	EnrollmentCapturedByName *string           `json:"enrollmentCapturedByName"`
	EnrollmentCapturedAt     *string           `json:"enrollmentCapturedAt"`
	RevueAt                  *string           `json:"revueAt"`
	RevueByID                *string           `json:"revueById"`
	RevueByName              *string           `json:"revueByName"`
	LastOutcome              *string           `json:"lastOutcome"`
	LastReasonLabel          *string           `json:"lastReasonLabel"`
	LastComment              *string           `json:"lastComment"`
	LastAttemptAt            *string           `json:"lastAttemptAt"`
	CallAttemptCount         int32             `json:"callAttemptCount"`
	LastCallOutcome          *string           `json:"lastCallOutcome"`
	LastCallAt               *string           `json:"lastCallAt"`
	LastCallByID             *string           `json:"lastCallById"`
	LastCallByName           *string           `json:"lastCallByName"`
	PlateformeDepuis         *string           `json:"plateformeDepuis" doc:"Inscription sur une plateforme d'enrôlement : la fiche revient aux chargés de clientèle plateforme."`
	PlateformeInscrite       bool              `json:"plateformeInscrite" doc:"Une inscription présente sur la plateforme est rapprochée de la fiche. Sans elle, la fiche vient d'un classeur qui cite le site."`
	RemarqueImport           *string           `json:"remarqueImport" doc:"Réponse du prospect notée dans le classeur importé."`
	EnCoursPar               *string           `json:"enCoursPar" doc:"Un collègue a la fiche ouverte depuis moins de deux heures."`
	Origin                   *string           `json:"origin"`
	OriginLabel              *string           `json:"originLabel"`
	ARevoirAt                *string           `json:"aRevoirAt"`
	ClientCreatedAt          string            `json:"clientCreatedAt"`
	CreatedAt                string            `json:"createdAt"`
	UpdatedAt                string            `json:"updatedAt"`
	DeletedAt                *string           `json:"deletedAt"`
}

// Croisement syndicat x banque, jamais stocké : NUL dès qu'un axe manque, sinon
// une fiche Grand Public tomberait dans un segment CHUES.
func prospectSegment(sigle, banqueCourte *string) *string {
	if sigle == nil || banqueCourte == nil {
		return nil
	}
	chues, cbao := *sigle == prospectSigleChues, *banqueCourte == prospectBanqueCbao
	if chues && cbao {
		return prospectPtr("BDD1")
	}
	if chues {
		return prospectPtr("BDD2")
	}
	if cbao {
		return prospectPtr("BDD3")
	}
	return prospectPtr("BDD4")
}

func prospectNumeroWhatsapp(statut db.WhatsappStatus, whatsappE164, phoneE164 *string) *string {
	if statut == db.WhatsappStatusMEMENUMERO {
		return phoneE164
	}
	if statut == db.WhatsappStatusAUTRENUMERO {
		return whatsappE164
	}
	return nil
}

// Une clé qu'aucun champ ne définit plus reste inerte : la fiche se lit par les
// définitions des champs, jamais par les clés stockées.
func prospectReponses(brut []byte) map[string]string {
	reponses := map[string]string{}
	if len(brut) == 0 {
		return reponses
	}
	var lu map[string]any
	if err := json.Unmarshal(brut, &lu); err != nil {
		return reponses
	}
	for _, id := range slices.Sorted(maps.Keys(lu)) {
		texte, ok := lu[id].(string)
		if !ok || len(id) > 60 || len(reponses) >= prospectChampsLibresMax {
			continue
		}
		if texte = strings.TrimSpace(texte); texte != "" {
			reponses[id] = prospectTronquer(texte, prospectReponseMax)
		}
	}
	return reponses
}

func prospectDepuisLigne(l *db.ListProspectsRow, journeys []ProspectJourney, derniere *db.DernieresTentativesRow) Prospect {
	p := l.Prospect
	item := Prospect{
		ID: p.ID, Nom: p.Nom, Prenom: p.Prenom, PhoneE164: p.PhoneE164, Rev: p.Rev,
		Statut: string(p.Statut), Projet: string(p.Projet),
		BanqueID: p.BanqueId, BanqueName: l.BanqueName,
		SyndicatID: p.SyndicatId, SyndicatSigle: l.SyndicatSigle,
		RepresentantID: p.RepresentantId, RepresentantName: l.RepresentantName,
		RepresentantPhoneE164: l.RepresentantPhone,
		DepartementID:         l.DepartementID, DepartementName: l.DepartementName,
		OwnedByCommercialID: p.CreatedById, OwnedByCommercialName: l.OwnerName,
		Type:       prospectEnum(p.Type),
		Profession: prospectPremier(l.ProfessionLabel, p.Profession), ProfessionID: p.ProfessionId,
		ProfessionIsTeaching: l.ProfessionIsTeaching,
		IncomeBandID:         p.IncomeBandId, IncomeBandLabel: l.IncomeBandLabel,
		PaymentMode: prospectEnum(p.PaymentMode), TypeBien: prospectEnum(p.TypeBien),
		EmployeurID: p.EmployeurId, Employeur: prospectPremier(l.EmployeurLabel, p.Employeur),
		TypeContrat: prospectEnum(p.TypeContrat), AncienneteMois: p.AncienneteMois,
		LieuActivite: p.LieuActivite, ModeEpargne: prospectEnum(p.ModeEpargne),
		PaysResidenceID: p.PaysResidenceId, PaysResidenceLabel: l.PaysLabel,
		VilleResidence: p.VilleResidence, Etablissement: p.Etablissement,
		WhatsappStatus: string(p.WhatsappStatus), WhatsappE164: p.WhatsappE164,
		WhatsappNumber: prospectNumeroWhatsapp(p.WhatsappStatus, p.WhatsappE164, p.PhoneE164),
		RelaisNom:      p.RelaisNom, RelaisPhoneE164: p.RelaisPhoneE164,
		Journeys: journeys, ChampsLibres: prospectReponses(p.ChampsLibres),
		DureeSystemeMois:  p.DureeSystemeMois,
		CanalProvenanceID: p.CanalProvenanceId, CanalProvenanceLabel: l.CanalLabel,
		Segment:      prospectSegment(l.SyndicatSigle, l.BanqueShortName),
		Phase2Status: string(p.Phase2Status), EnrollmentMethod: prospectEnum(p.EnrollmentMethod),
		EnrollmentCapturedByID: p.EnrollmentCapturedById, EnrollmentCapturedByName: l.EnrollmentCapturedByName,
		EnrollmentCapturedAt: prospectISOPtr(p.EnrollmentCapturedAt),
		RevueAt:              prospectISOPtr(p.RevueAt), RevueByID: p.RevueById, RevueByName: l.RevueByName,
		LastCallOutcome: prospectEnum(p.LastCallOutcome), LastCallAt: prospectISOPtr(p.LastCallAt),
		LastCallByID: p.LastCallById, LastCallByName: l.LastCallByName,
		PlateformeDepuis: prospectISOPtr(p.PlateformeDepuis), PlateformeInscrite: l.PlateformeInscrite,
		RemarqueImport: p.RemarqueImport, EnCoursPar: prospectVide(l.EnCoursPar),
		Origin: p.Origin, OriginLabel: p.OriginLabel, ARevoirAt: prospectISOPtr(p.ARevoirAt),
		ClientCreatedAt: prospectISO(p.ClientCreatedAt), CreatedAt: prospectISO(p.CreatedAt),
		UpdatedAt: prospectISO(p.UpdatedAt), DeletedAt: prospectISOPtr(p.DeletedAt),
	}
	if item.Journeys == nil {
		item.Journeys = []ProspectJourney{}
	}
	if derniere != nil {
		item.LastOutcome = prospectPtr(string(derniere.Outcome))
		item.LastReasonLabel = derniere.ReasonLabel
		item.LastComment = derniere.Comment
		item.LastAttemptAt = prospectPtr(prospectISO(derniere.At))
		item.CallAttemptCount = derniere.Nombre
	}
	return item
}

type prospectPortee struct {
	tout       bool
	converti   bool
	plateforme *bool
	userID     string
}

// Le chargé de clientèle voit TOUTE demande convertie : c'est lui qui la relit
// avant l'enrôlement, et une portée bornée à ses fiches la lui cacherait. Le
// CCP voit tout, mais la borne plateforme ne lui laisse que ses fiches.
func prospectPorteeDe(u *socle.Utilisateur) prospectPortee {
	return prospectPortee{
		tout:       u.Role == socle.Admin || u.Role == socle.Superviseur || u.Role == socle.Direction || u.Role == socle.CCP,
		converti:   u.Role == socle.ChargeClientele,
		plateforme: socle.PorteePlateforme(u.Role),
		userID:     u.ID,
	}
}

func (s *service) prospectTx(ctx context.Context, geste func(*db.Queries) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := geste(s.Q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *service) prospectCharger(ctx context.Context, arg *db.ListProspectsParams) ([]Prospect, error) {
	lignes, err := s.Q.ListProspects(ctx, *arg)
	if err != nil || len(lignes) == 0 {
		return nil, err
	}
	ids := make([]string, 0, len(lignes))
	for i := range lignes {
		ids = append(ids, lignes[i].Prospect.ID)
	}
	parcours, err := s.Q.JourneysDesProspects(ctx, ids)
	if err != nil {
		return nil, err
	}
	// UNE requête pour toute la page : lire les tentatives par ligne ferait un
	// aller-retour par prospect affiché.
	tentatives, err := s.Q.DernieresTentatives(ctx, ids)
	if err != nil {
		return nil, err
	}
	parProspect := map[string][]ProspectJourney{}
	for _, j := range parcours {
		parProspect[j.ProspectId] = append(parProspect[j.ProspectId], ProspectJourney{
			ID: j.ID, Projet: string(j.Projet), Statut: string(j.Statut), Consent: string(j.Consent),
			ConsentAt: prospectISOPtr(j.ConsentAt), ConvertedAt: prospectISOPtr(j.ConvertedAt),
		})
	}
	derniere := map[string]*db.DernieresTentativesRow{}
	for i := range tentatives {
		derniere[tentatives[i].ProspectID] = &tentatives[i]
	}
	items := make([]Prospect, 0, len(lignes))
	for i := range lignes {
		id := lignes[i].Prospect.ID
		items = append(items, prospectDepuisLigne(&lignes[i], parProspect[id], derniere[id]))
	}
	return items, nil
}

// Deux requêtes seulement quand la lecture échoue : « pas à vous » ne se
// confond pas avec « n'existe pas ».
func (s *service) prospectLire(ctx context.Context, u *socle.Utilisateur, id string) (*Prospect, error) {
	p := prospectPorteeDe(u)
	items, err := s.prospectCharger(ctx, &db.ListProspectsParams{
		ID: &id, ScopeAll: p.tout, ScopeUserID: p.userID, ScopeConverti: p.converti,
		ScopePlateforme: p.plateforme,
		SortBy:          prospectTriDefaut, SortOrder: prospectOrdreDefaut, Taille: 1,
	})
	if err != nil {
		return nil, err
	}
	if len(items) == 1 {
		return &items[0], nil
	}
	_, err = s.Q.ProspectVivant(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, prospectCodeIntrouvable, prospectIntrouvable)
	}
	if err != nil {
		return nil, err
	}
	return nil, socle.Problem(http.StatusForbidden, "NOT_OWNER", "Cette fiche appartient à un autre téléconseiller.")
}

func (s *service) prospectModifiable(ctx context.Context, u *socle.Utilisateur, id string) (db.ProspectVivantRow, error) {
	row, err := s.Q.ProspectVivant(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, prospectCodeIntrouvable, prospectIntrouvable)
	}
	if err != nil {
		return row, err
	}
	if u.Role != socle.Admin && row.CreatedById != u.ID {
		return row, socle.Problem(http.StatusForbidden, "NOT_OWNER", "Cette fiche appartient à un autre téléconseiller.")
	}
	return row, nil
}

type ProspectListInput struct {
	Search                 string `query:"search" maxLength:"120"`
	RepresentantID         string `query:"representantId" format:"uuid"`
	BanqueID               string `query:"banqueId" format:"uuid"`
	SyndicatID             string `query:"syndicatId" format:"uuid"`
	DepartementID          string `query:"departementId" format:"uuid"`
	CommercialID           string `query:"commercialId" format:"uuid"`
	Projet                 string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Type                   string `query:"type" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	CanalProvenanceID      string `query:"canalProvenanceId" format:"uuid"`
	Statut                 string `query:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Segment                string `query:"segment" enum:"BDD1,BDD2,BDD3,BDD4"`
	Phase2Status           string `query:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER"`
	EnrollmentMethod       string `query:"enrollmentMethod" enum:"PLATFORM,PHYSICAL,VOICE_OR_ELECTRONIC_MESSAGING,APPOINTMENT,WHATSAPP,RDV_CPI,PLATEFORME_EN_LIGNE,MAIL"`
	AppelePar              string `query:"appelePar" format:"uuid"`
	LastCallByID           string `query:"lastCallById" format:"uuid"`
	EnrollmentCapturedByID string `query:"enrollmentCapturedById" format:"uuid"`
	Origin                 string `query:"origin" enum:"BANQUE,FORMULAIRE_PUBLIC"`
	DateFrom               string `query:"dateFrom"`
	DateTo                 string `query:"dateTo"`
	Revue                  string `query:"revue" enum:"true,false"`
	MesFiches              bool   `query:"mesFiches"`
	Attribue               bool   `query:"attribue"`
	ResteAAppeler          bool   `query:"resteAAppeler"`
	SortBy                 string `query:"sortBy" enum:"createdAt,clientCreatedAt,nom,prenom,statut,lastCallAt,plateformeDepuis"`
	SortOrder              string `query:"sortOrder" enum:"asc,desc"`
	Page                   int32  `query:"page" minimum:"1" default:"1"`
	PageSize               int32  `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

type ProspectPageMeta struct {
	Total     int32 `json:"total"`
	Page      int32 `json:"page"`
	PageSize  int32 `json:"pageSize"`
	PageCount int32 `json:"pageCount"`
}

type ProspectListOutput struct {
	Body struct {
		Items []Prospect       `json:"items"`
		Meta  ProspectPageMeta `json:"meta"`
	}
}

type ProspectOutput struct {
	Body Prospect
}

// Une borne nue (`2026-08-12`) vaut la journée entière à l'heure de Dakar :
// lue en UTC, elle amputerait la dernière journée demandée.
func prospectBorneDate(brut string, zone *time.Location, fin bool) (*time.Time, error) {
	var borne *time.Time
	if brut == "" {
		return borne, nil
	}
	if jour, err := time.ParseInLocation(time.DateOnly, brut, zone); err == nil {
		if fin {
			return prospectPtr(jour.Add(24*time.Hour - time.Millisecond).UTC()), nil
		}
		return prospectPtr(jour.UTC()), nil
	}
	instant, err := time.Parse(time.RFC3339, brut)
	if err != nil {
		return borne, socle.Problem(http.StatusBadRequest, prospectCodeMauvaiseRequete, "Date illisible : "+brut)
	}
	return prospectPtr(instant.UTC()), nil
}

// Moins de trois chiffres ne désigne aucun abonné : la clause remonterait toute
// la base sur une frappe isolée.
func prospectRechercheTelephone(recherche, region string) *string {
	var aucun *string
	chiffres := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, recherche)
	if len(chiffres) < 3 {
		return aucun
	}
	if e164, err := database.NormaliserTelephone(recherche, region); err == nil {
		return &e164
	}
	return &chiffres
}

func (s *service) prospectFiltres(in *ProspectListInput, u *socle.Utilisateur) (db.ListProspectsParams, error) {
	p := prospectPorteeDe(u)
	// `mesFiches` borne aussi l'encadrement : sur l'écran d'appel, chacun ne
	// compose que les numéros qui lui reviennent. Les fiches plateforme
	// reviennent toutes aux CCP, sans partage.
	if in.MesFiches && u.Role != socle.CCP {
		p.tout, p.converti = false, false
	}
	arg := db.ListProspectsParams{
		ScopeAll: p.tout, ScopeUserID: p.userID, ScopeConverti: p.converti, ScopePlateforme: p.plateforme,
		CommercialID: prospectVide(in.CommercialID), Type: prospectTypeEnum[db.ProspectType](in.Type),
		CanalProvenanceID: prospectVide(in.CanalProvenanceID), RepresentantID: prospectVide(in.RepresentantID),
		BanqueID: prospectVide(in.BanqueID), SyndicatID: prospectVide(in.SyndicatID),
		Origin:                 prospectVide(in.Origin),
		Phase2Status:           prospectTypeEnum[db.Phase2Status](in.Phase2Status),
		EnrollmentMethod:       prospectTypeEnum[db.EnrollmentMethod](in.EnrollmentMethod),
		EnrollmentCapturedByID: prospectVide(in.EnrollmentCapturedByID),
		LastCallByID:           prospectVide(in.LastCallByID),
		DepartementID:          prospectVide(in.DepartementID),
		Projet:                 prospectTypeEnum[db.Projet](in.Projet),
		Statut:                 prospectTypeEnum[db.ProspectStatut](in.Statut),
		Segment:                prospectVide(in.Segment),
		AppelePar:              prospectVide(in.AppelePar),
		Search:                 prospectVide(strings.TrimSpace(in.Search)),
		Attribue:               in.Attribue,
		ResteAAppeler:          in.ResteAAppeler,
	}
	if in.Revue != "" {
		arg.Revue = prospectPtr(in.Revue == prospectVrai)
	}
	if arg.Search != nil {
		arg.PhoneSearch = prospectRechercheTelephone(*arg.Search, s.Cfg.PhoneRegion)
	}
	var err error
	if arg.DateFrom, err = prospectBorneDate(in.DateFrom, s.Cfg.TimeZone, false); err != nil {
		return arg, err
	}
	arg.DateTo, err = prospectBorneDate(in.DateTo, s.Cfg.TimeZone, true)
	return arg, err
}

// La liste et son total partagent la MÊME clause : deux clauses divergeraient et
// la pagination annoncerait des pages vides.
func prospectComptage(arg *db.ListProspectsParams) db.CountProspectsParams {
	return db.CountProspectsParams{
		ScopeAll: arg.ScopeAll, ScopeUserID: arg.ScopeUserID, ScopeConverti: arg.ScopeConverti,
		CommercialID: arg.CommercialID, Type: arg.Type, CanalProvenanceID: arg.CanalProvenanceID,
		RepresentantID: arg.RepresentantID, BanqueID: arg.BanqueID, SyndicatID: arg.SyndicatID,
		Origin: arg.Origin, Phase2Status: arg.Phase2Status, EnrollmentMethod: arg.EnrollmentMethod,
		EnrollmentCapturedByID: arg.EnrollmentCapturedByID, LastCallByID: arg.LastCallByID,
		DepartementID: arg.DepartementID, Projet: arg.Projet, Statut: arg.Statut, Revue: arg.Revue,
		Segment: arg.Segment, AppelePar: arg.AppelePar, DateFrom: arg.DateFrom, DateTo: arg.DateTo,
		Search: arg.Search, PhoneSearch: arg.PhoneSearch, Attribue: arg.Attribue,
		ResteAAppeler: arg.ResteAAppeler, ScopePlateforme: arg.ScopePlateforme,
	}
}

func (s *service) prospectLister(ctx context.Context, in *ProspectListInput) (*ProspectListOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	arg, err := s.prospectFiltres(in, &u)
	if err != nil {
		return nil, err
	}
	total, err := s.Q.CountProspects(ctx, prospectComptage(&arg))
	if err != nil {
		return nil, err
	}
	arg.SortBy, arg.SortOrder = prospectTriDefaut, prospectOrdreDefaut
	if in.SortBy != "" {
		arg.SortBy = in.SortBy
	}
	if in.SortOrder != "" {
		arg.SortOrder = in.SortOrder
	}
	arg.Taille, arg.Saut = in.PageSize, (in.Page-1)*in.PageSize
	items, err := s.prospectCharger(ctx, &arg)
	if err != nil {
		return nil, err
	}
	out := &ProspectListOutput{}
	out.Body.Items = items
	if out.Body.Items == nil {
		out.Body.Items = []Prospect{}
	}
	out.Body.Meta = ProspectPageMeta{
		Total: total, Page: in.Page, PageSize: in.PageSize,
		PageCount: max(1, (total+in.PageSize-1)/in.PageSize),
	}
	return out, nil
}

type ProspectIDInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) prospectHandlerLire(ctx context.Context, in *ProspectIDInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type ProspectCallAttempt struct {
	ID                        string  `json:"id"`
	Outcome                   string  `json:"outcome"`
	ReasonLabel               *string `json:"reasonLabel"`
	Method                    *string `json:"method"`
	Comment                   *string `json:"comment"`
	Email                     *string `json:"email"`
	Fonctionnaire             *bool   `json:"fonctionnaire"`
	EngagementEnCours         *bool   `json:"engagementEnCours"`
	DureeEtablissementMois    *int32  `json:"dureeEtablissementMois"`
	RendezVousAt              *string `json:"rendezVousAt"`
	DeviceCallType            *string `json:"deviceCallType"`
	DeviceCallDurationSeconds *int32  `json:"deviceCallDurationSeconds"`
	DeviceCallAt              *string `json:"deviceCallAt"`
	PerformedByID             string  `json:"performedById"`
	PerformedByName           string  `json:"performedByName"`
	ClientCreatedAt           string  `json:"clientCreatedAt"`
	DureeTraitementSecondes   *int32  `json:"dureeTraitementSecondes"`
}

type ProspectCallAttemptsOutput struct {
	Body struct {
		Items []ProspectCallAttempt `json:"items"`
	}
}

func prospectDureeTraitement(premiereSaisie, fermeture *time.Time) *int32 {
	if premiereSaisie == nil || fermeture == nil {
		return nil
	}
	return prospectPtr(int32(fermeture.Sub(*premiereSaisie).Round(time.Second).Seconds()))
}

// Même portée que la fiche : qui peut la lire peut relire ses appels.
func (s *service) prospectTentatives(ctx context.Context, in *ProspectIDInput) (*ProspectCallAttemptsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.TentativesDuProspect(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &ProspectCallAttemptsOutput{}
	out.Body.Items = make([]ProspectCallAttempt, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		out.Body.Items = append(out.Body.Items, ProspectCallAttempt{
			ID: l.ID, Outcome: string(l.Outcome), ReasonLabel: l.ReasonLabel, Method: prospectEnum(l.Method),
			Comment: l.Comment, Email: l.Email, Fonctionnaire: l.Fonctionnaire,
			EngagementEnCours: l.EngagementEnCours, DureeEtablissementMois: l.DureeEtablissementMois,
			RendezVousAt: prospectISOPtr(l.RendezVousAt), DeviceCallType: l.DeviceCallType,
			DeviceCallDurationSeconds: l.DeviceCallDurationSeconds, DeviceCallAt: prospectISOPtr(l.DeviceCallAt),
			PerformedByID: l.PerformedById, PerformedByName: l.PerformedByName,
			ClientCreatedAt:         prospectISO(l.ClientCreatedAt),
			DureeTraitementSecondes: prospectDureeTraitement(l.OuvertureFirstInputAt, l.OuvertureClosedAt),
		})
	}
	return out, nil
}

type ProspectBody struct {
	ID                string                    `json:"id,omitempty" format:"uuid" required:"false"`
	Nom               *string                   `json:"nom,omitempty" minLength:"1" maxLength:"120" required:"false"`
	Prenom            *string                   `json:"prenom,omitempty" maxLength:"120" required:"false"`
	Phone             *string                   `json:"phone,omitempty" minLength:"6" maxLength:"40" required:"false"`
	RepresentantID    *string                   `json:"representantId,omitempty" format:"uuid" required:"false"`
	Projet            *string                   `json:"projet,omitempty" enum:"CHUES,GRAND_PUBLIC" required:"false"`
	Type              *string                   `json:"type,omitempty" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA" required:"false"`
	Profession        *string                   `json:"profession,omitempty" maxLength:"120" required:"false"`
	PaymentMode       *string                   `json:"paymentMode,omitempty" enum:"COMPTANT,ECHELONNE,CREDIT_IMMOBILIER" required:"false"`
	TypeBien          *string                   `json:"typeBien,omitempty" enum:"TERRAIN,VILLA" required:"false"`
	ChampsLibres      map[string]string         `json:"champsLibres,omitempty" required:"false"`
	DureeSystemeMois  *int32                    `json:"dureeSystemeMois,omitempty" minimum:"1" maximum:"300" required:"false"`
	Statut            *string                   `json:"statut,omitempty" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU" required:"false"`
	ClientCreatedAt   *string                   `json:"clientCreatedAt,omitempty" format:"date-time" required:"false"`
	BanqueID          prospectOptionnel[string] `json:"banqueId,omitempty" format:"uuid" required:"false"`
	SyndicatID        prospectOptionnel[string] `json:"syndicatId,omitempty" format:"uuid" required:"false"`
	ProfessionID      prospectOptionnel[string] `json:"professionId,omitempty" format:"uuid" required:"false"`
	Etablissement     prospectOptionnel[string] `json:"etablissement,omitempty" maxLength:"160" required:"false"`
	IncomeBandID      prospectOptionnel[string] `json:"incomeBandId,omitempty" format:"uuid" required:"false"`
	CanalProvenanceID prospectOptionnel[string] `json:"canalProvenanceId,omitempty" format:"uuid" required:"false"`
	EmployeurID       prospectOptionnel[string] `json:"employeurId,omitempty" format:"uuid" required:"false"`
	Employeur         prospectOptionnel[string] `json:"employeur,omitempty" maxLength:"160" required:"false"`
	TypeContrat       prospectOptionnel[string] `json:"typeContrat,omitempty" enum:"CDI,CDD,AUTRE" required:"false"`
	AncienneteMois    prospectOptionnel[int32]  `json:"ancienneteMois,omitempty" minimum:"0" maximum:"840" required:"false"`
	LieuActivite      prospectOptionnel[string] `json:"lieuActivite,omitempty" maxLength:"160" required:"false"`
	ModeEpargne       prospectOptionnel[string] `json:"modeEpargne,omitempty" enum:"TONTINE,MOBILE_MONEY,BANQUE,AUCUN" required:"false"`
	PaysResidenceID   prospectOptionnel[string] `json:"paysResidenceId,omitempty" format:"uuid" required:"false"`
	VilleResidence    prospectOptionnel[string] `json:"villeResidence,omitempty" maxLength:"120" required:"false"`
	WhatsappE164      prospectOptionnel[string] `json:"whatsappE164,omitempty" minLength:"6" maxLength:"40" required:"false"`
	RelaisNom         prospectOptionnel[string] `json:"relaisNom,omitempty" maxLength:"160" required:"false"`
	RelaisPhoneE164   prospectOptionnel[string] `json:"relaisPhoneE164,omitempty" minLength:"6" maxLength:"40" required:"false"`
}

type ProspectCreerInput struct {
	Body ProspectBody
}

type ProspectModifierInput struct {
	ID   string `path:"id" format:"uuid"`
	Body ProspectBody
}

// La durée ne concerne que le paiement échelonné : la garder sur un comptant
// laisserait une échéance qui n'engage personne.
func prospectPaiementCoherent(mode *string, duree *int32) error {
	if mode != nil && *mode == string(db.PaymentModeCOMPTANT) && duree != nil {
		return socle.Problem(http.StatusBadRequest, "PROSPECT_PAYMENT_DURATION_INVALID", "La durée ne concerne que le paiement échelonné.")
	}
	return nil
}

func (s *service) prospectNumeroOptionnel(brut *string) (*string, error) {
	var e164 *string
	if brut == nil {
		return e164, nil
	}
	normalise, err := database.NormaliserTelephone(*brut, s.Cfg.PhoneRegion)
	if err != nil {
		return e164, err
	}
	return &normalise, nil
}

// L'ANNUAIRE est commun : tout représentant vivant sert de rattachement, quel
// que soit son créateur. Le cloisonnement porte sur le prospect créé.
func (s *service) prospectRepresentantUtilisable(ctx context.Context, id *string) error {
	if id == nil {
		return nil
	}
	_, err := s.Q.RepresentantVivant(ctx, *id)
	if errors.Is(err, pgx.ErrNoRows) {
		return socle.Problem(http.StatusNotFound, "REPRESENTANT_NOT_FOUND", "Représentant introuvable.")
	}
	return err
}

func (s *service) prospectCommercialUtilisable(ctx context.Context, id *string) error {
	if id == nil {
		return nil
	}
	_, err := s.Q.UtilisateurVivant(ctx, *id)
	if errors.Is(err, pgx.ErrNoRows) {
		return socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Commercial de destination introuvable.")
	}
	return err
}

type ProspectConflictExisting struct {
	ID                    string  `json:"id,omitempty"`
	Nom                   string  `json:"nom,omitempty"`
	Prenom                string  `json:"prenom,omitempty"`
	RepresentantID        *string `json:"representantId,omitempty"`
	RepresentantName      *string `json:"representantName,omitempty"`
	OwnedByCommercialID   string  `json:"ownedByCommercialId,omitempty"`
	OwnedByCommercialName string  `json:"ownedByCommercialName"`
	CreatedAt             string  `json:"createdAt,omitempty"`
}

// 409 nommant la fiche existante ET son propriétaire : sans le nom, la même
// saisie est rejouée indéfiniment. La lecture est GLOBALE parce que l'index
// unique partiel l'est ; l'identité civile d'une fiche d'autrui ne sort pas,
// sinon ce 409 devient un annuaire interrogeable numéro par numéro.
func (s *service) prospectTelephoneLibre(ctx context.Context, u *socle.Utilisateur, phoneE164 string, saufID *string) error {
	clash, err := s.Q.ProspectDoublonTelephone(ctx, db.ProspectDoublonTelephoneParams{PhoneE164: &phoneE164, SaufID: saufID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	existante := ProspectConflictExisting{OwnedByCommercialName: clash.OwnerName}
	if u.Role == socle.Admin || clash.CreatedById == u.ID {
		existante = ProspectConflictExisting{
			ID: clash.ID, Nom: clash.Nom, Prenom: clash.Prenom,
			RepresentantID: clash.RepresentantId, RepresentantName: clash.RepresentantName,
			OwnedByCommercialID: clash.CreatedById, OwnedByCommercialName: clash.OwnerName,
			CreatedAt: prospectISO(clash.CreatedAt),
		}
	}
	p := socle.Problem(http.StatusConflict, "PROSPECT_PHONE_CONFLICT", "Ce numéro a déjà été enregistré par "+clash.OwnerName+".")
	p.Errors = []*huma.ErrorDetail{{Location: "existing", Value: existante}}
	return p
}

func (s *service) prospectIdentifiantLibre(ctx context.Context, u *socle.Utilisateur, id string) error {
	row, err := s.Q.ProspectProprietaire(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if u.Role != socle.Admin && row.CreatedById != u.ID {
		return socle.Problem(http.StatusForbidden, "ENTITY_ID_OWNED_BY_ANOTHER_USER", "Cet identifiant appartient à un autre téléconseiller.")
	}
	p := socle.Problem(http.StatusConflict, "PROSPECT_ALREADY_EXISTS", "Un prospect porte déjà cet identifiant.")
	p.Errors = []*huma.ErrorDetail{{Location: socle.CleIdentifiantExistant, Value: id}}
	return p
}

// Consentement d'un parcours neuf : acquis pour Grand Public, sinon non demandé.
func prospectConsentementDefaut(projet db.Projet) (db.GrandPublicConsent, *time.Time) {
	if projet == db.ProjetGRANDPUBLIC {
		return db.GrandPublicConsentINTERESSE, prospectPtr(time.Now())
	}
	return db.GrandPublicConsentNONDEMANDE, nil
}

func prospectStatutOuNouveau(statut *string) db.ProspectStatut {
	if statut == nil {
		return db.ProspectStatutNOUVEAU
	}
	return db.ProspectStatut(*statut)
}

func prospectIdentifiantDemande(demande string) (string, error) {
	if demande != "" {
		return demande, nil
	}
	nouvel, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return nouvel.String(), nil
}

func (s *service) prospectCreer(ctx context.Context, in *ProspectCreerInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	corps := &in.Body
	phoneE164, id, err := s.prospectAvantCreation(ctx, &u, corps)
	if err != nil {
		return nil, err
	}
	projet := db.ProjetCHUES
	if corps.Projet != nil {
		projet = db.Projet(*corps.Projet)
	}
	rattachee, err := s.prospectRattacher(ctx, &u, phoneE164, projet, corps)
	if rattachee != nil || err != nil {
		return rattachee, err
	}
	if err := s.prospectTelephoneLibre(ctx, &u, phoneE164, nil); err != nil {
		return nil, err
	}
	if err := prospectPaiementCoherent(corps.PaymentMode, corps.DureeSystemeMois); err != nil {
		return nil, err
	}
	if err := s.prospectInserer(ctx, &u, id, phoneE164, projet, corps); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, id)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

// Le numéro normalisé et l'identifiant retenu, une fois l'anti-squat et le
// rattachement au représentant vérifiés.
func (s *service) prospectAvantCreation(ctx context.Context, u *socle.Utilisateur, corps *ProspectBody) (phoneE164, id string, err error) {
	if prospectDeref(prospectRogner(corps.Nom)) == "" || corps.Phone == nil {
		return "", "", huma.Error422UnprocessableEntity("champs obligatoires",
			&huma.ErrorDetail{Location: "body", Message: "Le nom et le téléphone sont obligatoires."})
	}
	if phoneE164, err = database.NormaliserTelephone(*corps.Phone, s.Cfg.PhoneRegion); err != nil {
		return "", "", err
	}
	if id, err = prospectIdentifiantDemande(corps.ID); err != nil {
		return "", "", err
	}
	if err := s.prospectIdentifiantLibre(ctx, u, id); err != nil {
		return "", "", err
	}
	return phoneE164, id, s.prospectRepresentantUtilisable(ctx, corps.RepresentantID)
}

// Les reponses aux champs ajoutes, filtrees sur les champs declares pour le
// projet. Une cle inconnue tombe, une reponse vide ne s'ecrit pas.
func (s *service) prospectLibresRetenus(ctx context.Context, projet db.Projet, envoyes map[string]string) ([]byte, error) {
	if len(envoyes) == 0 {
		return nil, nil
	}
	reglages, err := s.prospectReglages(ctx, projet)
	if err != nil {
		return nil, err
	}
	retenus := map[string]string{}
	formulaireLibresRetenus(&reglages, envoyes, retenus)
	if len(retenus) == 0 {
		return nil, nil
	}
	return formulaireChampsLibresJSON(retenus)
}

func (s *service) prospectInserer(ctx context.Context, u *socle.Utilisateur, id, phoneE164 string, projet db.Projet, corps *ProspectBody) error {
	saisieAt, err := prospectInstant(corps.ClientCreatedAt)
	if err != nil {
		return err
	}
	relais, err := s.prospectNumeroOptionnel(corps.RelaisPhoneE164.valeur)
	if err != nil {
		return err
	}
	whatsapp, err := s.prospectNumeroOptionnel(corps.WhatsappE164.valeur)
	if err != nil {
		return err
	}
	arg := db.InsertProspectParams{
		ID: id, Nom: prospectDeref(prospectRogner(corps.Nom)), Prenom: prospectDeref(prospectRogner(corps.Prenom)),
		PhoneE164: &phoneE164, CreatedById: u.ID, ClientCreatedAt: saisieAt,
		Statut: prospectStatutOuNouveau(corps.Statut), Projet: projet,
		BanqueId: corps.BanqueID.valeur, SyndicatId: corps.SyndicatID.valeur,
		RepresentantId: corps.RepresentantID, Type: prospectTypeEnum[db.ProspectType](prospectDeref(corps.Type)),
		Profession: prospectRogner(corps.Profession), ProfessionId: corps.ProfessionID.valeur,
		Etablissement: prospectRogner(corps.Etablissement.valeur), IncomeBandId: corps.IncomeBandID.valeur,
		PaymentMode:      prospectTypeEnum[db.PaymentMode](prospectDeref(corps.PaymentMode)),
		TypeBien:         prospectTypeEnum[db.TypeBien](prospectDeref(corps.TypeBien)),
		DureeSystemeMois: corps.DureeSystemeMois, CanalProvenanceId: corps.CanalProvenanceID.valeur,
		EmployeurId: corps.EmployeurID.valeur, Employeur: prospectRogner(corps.Employeur.valeur),
		TypeContrat:    prospectTypeEnum[db.TypeContrat](prospectDeref(corps.TypeContrat.valeur)),
		AncienneteMois: corps.AncienneteMois.valeur, LieuActivite: prospectRogner(corps.LieuActivite.valeur),
		ModeEpargne:     prospectTypeEnum[db.ModeEpargne](prospectDeref(corps.ModeEpargne.valeur)),
		PaysResidenceId: corps.PaysResidenceID.valeur, VilleResidence: prospectRogner(corps.VilleResidence.valeur),
		RelaisNom: prospectRogner(corps.RelaisNom.valeur), RelaisPhoneE164: relais,
		WhatsappStatus: db.WhatsappStatusNONDEMANDE,
	}
	statutWhatsapp, numero := prospectWhatsapp(
		prospectWhatsappSaisi{numeroFourni: corps.WhatsappE164.fourni, numero: whatsapp}, nil, &phoneE164)
	if statutWhatsapp != nil {
		arg.WhatsappStatus, arg.WhatsappE164 = *statutWhatsapp, numero
	}
	libres, err := s.prospectLibresRetenus(ctx, projet, corps.ChampsLibres)
	if err != nil {
		return err
	}
	arg.ChampsLibres = libres
	consent, consentAt := prospectConsentementDefaut(projet)
	journeyID, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.InsertProspect(ctx, arg); err != nil {
			return err
		}
		return q.InsertJourney(ctx, db.InsertJourneyParams{
			ID: journeyID.String(), ProspectId: id, Projet: projet,
			Statut: prospectStatutOuNouveau(corps.Statut), Consent: consent, ConsentAt: consentAt,
		})
	})
}

func prospectInstant(brut *string) (time.Time, error) {
	if brut == nil {
		return time.Now(), nil
	}
	instant, err := time.Parse(time.RFC3339, *brut)
	if err != nil {
		return time.Time{}, socle.Problem(http.StatusBadRequest, prospectCodeMauvaiseRequete, "Date de saisie illisible.")
	}
	return instant, nil
}

// Un numéro déjà connu du même auteur ne fait pas doublon : il gagne le parcours
// du projet demandé, et la personne garde une seule fiche.
func (s *service) prospectRattacher(ctx context.Context, u *socle.Utilisateur, phoneE164 string, projet db.Projet, corps *ProspectBody) (*ProspectOutput, error) {
	var aucune *ProspectOutput
	existant, err := s.Q.ProspectRattachable(ctx, db.ProspectRattachableParams{Projet: projet, PhoneE164: &phoneE164})
	if errors.Is(err, pgx.ErrNoRows) {
		return aucune, nil
	}
	if err != nil || existant.ALeParcours {
		return aucune, err
	}
	if u.Role != socle.Admin && existant.CreatedById != u.ID {
		return aucune, nil
	}
	journeyID, err := uuid.NewV7()
	if err != nil {
		return aucune, err
	}
	consent, consentAt := prospectConsentementDefaut(projet)
	maj := prospectNouvelleMaj()
	prospectPoserEnum[db.ProspectType](maj, prospectChampType, corps.Type)
	prospectPoser(maj, "professionId", corps.ProfessionID.valeur)
	prospectPoser(maj, prospectChampRevenu, corps.IncomeBandID.valeur)
	prospectPoserEnum[db.PaymentMode](maj, prospectChampPaiement, corps.PaymentMode)
	prospectPoserEnum[db.TypeBien](maj, prospectChampTypeBien, corps.TypeBien)
	prospectPoser(maj, "canalProvenanceId", corps.CanalProvenanceID.valeur)
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.InsertJourney(ctx, db.InsertJourneyParams{
			ID: journeyID.String(), ProspectId: existant.ID, Projet: projet,
			Statut: prospectStatutOuNouveau(corps.Statut), Consent: consent, ConsentAt: consentAt,
		}); err != nil {
			return err
		}
		return maj.appliquer(ctx, s.Pool, existant.ID)
	})
	if err != nil {
		return aucune, err
	}
	item, err := s.prospectLire(ctx, u, existant.ID)
	if err != nil {
		return aucune, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func (s *service) prospectModifier(ctx context.Context, in *ProspectModifierInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	existant, err := s.prospectModifiable(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	corps := &in.Body
	phoneE164, err := s.prospectNumeroOptionnel(corps.Phone)
	if err != nil {
		return nil, err
	}
	if err := s.prospectMajAutorisee(ctx, &u, &existant, corps, phoneE164); err != nil {
		return nil, err
	}
	if err := s.prospectMajJourney(ctx, in.ID, corps); err != nil {
		return nil, err
	}
	maj := prospectNouvelleMaj()
	if err := s.prospectMajColonnes(maj, corps, &existant, phoneE164); err != nil {
		return nil, err
	}
	if err := s.prospectMajLibres(ctx, maj, &existant, corps.ChampsLibres); err != nil {
		return nil, err
	}
	// Même transaction : la fiche et sa trace, sinon le journal décrirait une
	// modification défaite.
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := maj.appliquer(ctx, tx, in.ID); err != nil {
			return err
		}
		q := s.Q.WithTx(tx)
		apres, err := q.ProspectVivant(ctx, in.ID)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.update", prospectEntite, in.ID,
			prospectChampsJournal(&existant), prospectChampsJournal(&apres))
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

func (s *service) prospectMajAutorisee(ctx context.Context, u *socle.Utilisateur, existant *db.ProspectVivantRow, corps *ProspectBody, phoneE164 *string) error {
	if phoneE164 != nil && *phoneE164 != prospectDeref(existant.PhoneE164) {
		if err := s.prospectTelephoneLibre(ctx, u, *phoneE164, &existant.ID); err != nil {
			return err
		}
	}
	if corps.RepresentantID != nil && *corps.RepresentantID != prospectDeref(existant.RepresentantId) {
		if err := s.prospectRepresentantUtilisable(ctx, corps.RepresentantID); err != nil {
			return err
		}
	}
	mode := prospectPremier(corps.PaymentMode, prospectEnum(existant.PaymentMode))
	if err := prospectPaiementCoherent(mode, prospectPremier(corps.DureeSystemeMois, existant.DureeSystemeMois)); err != nil {
		return err
	}
	return prospectStatutModifiable(u, existant.Statut, corps.Statut)
}

// `PERDU` n'est pas terminal : une fiche perdue se retravaille, et c'est le
// geste le plus courant après une relance.
var prospectTransitions = map[db.ProspectStatut][]db.ProspectStatut{
	db.ProspectStatutNOUVEAU:  {db.ProspectStatutCONTACTE, db.ProspectStatutPERDU},
	db.ProspectStatutCONTACTE: {db.ProspectStatutCONVERTI, db.ProspectStatutPERDU},
	db.ProspectStatutPERDU:    {db.ProspectStatutCONTACTE},
	db.ProspectStatutCONVERTI: {},
}

// `CONVERTI` porte une conversion signée et datée : on n'y entre que par la
// confirmation dédiée, sinon un simple PATCH y menait depuis n'importe quel
// état, sans consentement et sans auteur.
func prospectStatutModifiable(u *socle.Utilisateur, courant db.ProspectStatut, demande *string) error {
	if demande == nil || *demande == string(courant) || u.Role == socle.Admin {
		return nil
	}
	suivant := db.ProspectStatut(*demande)
	if !slices.Contains(prospectTransitions[courant], suivant) {
		return socle.Problem(http.StatusForbidden, "PROSPECT_STATUT_TRANSITION_REFUSED",
			"Statut du prospect : le passage de « "+string(courant)+" » à « "+*demande+" » n’est pas permis.")
	}
	if suivant == db.ProspectStatutCONVERTI {
		return socle.Problem(http.StatusForbidden, "PROSPECT_CONVERSION_REQUIRES_CONFIRMATION",
			"Une conversion s’enregistre par la confirmation dédiée, qui recueille l’offre et le montant.")
	}
	return nil
}

func (s *service) prospectMajJourney(ctx context.Context, id string, corps *ProspectBody) error {
	if corps.Projet == nil {
		return nil
	}
	journeyID, err := uuid.NewV7()
	if err != nil {
		return err
	}
	projet := db.Projet(*corps.Projet)
	consent, consentAt := prospectConsentementDefaut(projet)
	return s.Q.UpsertJourneyStatut(ctx, db.UpsertJourneyStatutParams{
		ID: journeyID.String(), ProspectID: id, Projet: projet,
		Statut: prospectStatutOuNouveau(corps.Statut), Consent: consent, ConsentAt: consentAt,
		StatutMaj: prospectTypeEnum[db.ProspectStatut](prospectDeref(corps.Statut)),
	})
}

// Les reponses envoyees remplacent celles de la fiche, jamais partiellement :
// un champ retire du reglage disparait aussi de la fiche.
func (s *service) prospectMajLibres(ctx context.Context, maj *prospectMaj, existant *db.ProspectVivantRow, envoyes map[string]string) error {
	if envoyes == nil {
		return nil
	}
	libres, err := s.prospectLibresRetenus(ctx, existant.Projet, envoyes)
	if err != nil {
		return err
	}
	maj.set(prospectChampChampsLibres, libres)
	return nil
}

func (s *service) prospectMajColonnes(maj *prospectMaj, corps *ProspectBody, existant *db.ProspectVivantRow, phoneE164 *string) error {
	prospectPoser(maj, prospectChampNom, prospectRogner(corps.Nom))
	prospectPoser(maj, socle.ProspectChampPrenom, prospectRogner(corps.Prenom))
	prospectPoser(maj, socle.ProspectChampPhone, phoneE164)
	prospectPoser(maj, "representantId", corps.RepresentantID)
	prospectPoser(maj, socle.ProspectChampProfession, prospectRogner(corps.Profession))
	prospectPoser(maj, prospectChampDureeSysteme, corps.DureeSystemeMois)
	prospectPoserEnum[db.Projet](maj, "projet", corps.Projet)
	prospectPoserEnum[db.ProspectType](maj, prospectChampType, corps.Type)
	prospectPoserEnum[db.PaymentMode](maj, prospectChampPaiement, corps.PaymentMode)
	prospectPoserEnum[db.TypeBien](maj, prospectChampTypeBien, corps.TypeBien)
	prospectPoserEnum[db.ProspectStatut](maj, "statut", corps.Statut)
	prospectPoserOptionnel(maj, prospectChampBanque, corps.BanqueID)
	prospectPoserOptionnel(maj, prospectChampSyndicat, corps.SyndicatID)
	prospectPoserOptionnel(maj, "professionId", corps.ProfessionID)
	prospectPoserOptionnel(maj, prospectChampRevenu, corps.IncomeBandID)
	prospectPoserOptionnel(maj, "canalProvenanceId", corps.CanalProvenanceID)
	prospectPoserOptionnel(maj, "employeurId", corps.EmployeurID)
	prospectPoserOptionnel(maj, "paysResidenceId", corps.PaysResidenceID)
	prospectPoserOptionnel(maj, socle.ProspectChampEtablissement, prospectOptionnelRogne(corps.Etablissement))
	prospectPoserOptionnel(maj, "employeur", prospectOptionnelRogne(corps.Employeur))
	prospectPoserOptionnel(maj, "lieuActivite", prospectOptionnelRogne(corps.LieuActivite))
	prospectPoserOptionnel(maj, "villeResidence", prospectOptionnelRogne(corps.VilleResidence))
	prospectPoserOptionnel(maj, "relaisNom", prospectOptionnelRogne(corps.RelaisNom))
	prospectPoserOptionnelEnum[db.TypeContrat](maj, "typeContrat", corps.TypeContrat)
	prospectPoserOptionnelEnum[db.ModeEpargne](maj, "modeEpargne", corps.ModeEpargne)
	if corps.AncienneteMois.fourni {
		maj.set("ancienneteMois", corps.AncienneteMois.valeur)
	}
	if corps.ClientCreatedAt != nil {
		instant, err := prospectInstant(corps.ClientCreatedAt)
		if err != nil {
			return err
		}
		maj.set("clientCreatedAt", instant)
	}
	relais, err := s.prospectNumeroOptionnel(corps.RelaisPhoneE164.valeur)
	if err != nil {
		return err
	}
	prospectPoserOptionnel(maj, "relaisPhoneE164", prospectOptionnel[string]{fourni: corps.RelaisPhoneE164.fourni, valeur: relais})
	return s.prospectMajWhatsapp(maj, corps, existant, phoneE164)
}

func prospectOptionnelRogne(v prospectOptionnel[string]) prospectOptionnel[string] {
	return prospectOptionnel[string]{fourni: v.fourni, valeur: prospectRogner(v.valeur)}
}

func (s *service) prospectMajWhatsapp(maj *prospectMaj, corps *ProspectBody, existant *db.ProspectVivantRow, phoneE164 *string) error {
	if !corps.WhatsappE164.fourni {
		return nil
	}
	numero, err := s.prospectNumeroOptionnel(corps.WhatsappE164.valeur)
	if err != nil {
		return err
	}
	courant := existant.PhoneE164
	if phoneE164 != nil {
		courant = phoneE164
	}
	statut, retenu := prospectWhatsapp(
		prospectWhatsappSaisi{numeroFourni: true, numero: numero}, existant.WhatsappE164, courant)
	if statut == nil {
		return nil
	}
	maj.set(socle.ProspectChampWhatsappStatut, *statut)
	maj.set(socle.ProspectChampWhatsappNumero, retenu)
	return nil
}

type prospectWhatsappSaisi struct {
	statut       *db.WhatsappStatus
	numero       *string
	numeroFourni bool
}

// NE LÈVE JAMAIS : des fiches portent un numéro WhatsApp saisi bien avant que le
// statut n'existe. Le statut se déduit alors du numéro, et AUTRE_NUMERO sans
// numéro retombe sur AUCUN pour tenir le CHECK de la table.
func prospectWhatsapp(saisi prospectWhatsappSaisi, e164Courant, phoneE164 *string) (statut *db.WhatsappStatus, numero *string) {
	if saisi.statut == nil && !saisi.numeroFourni {
		return nil, nil
	}
	statut = saisi.statut
	if statut == nil {
		statut = prospectPtr(prospectDeduireWhatsapp(saisi.numero, phoneE164))
	}
	if *statut != db.WhatsappStatusAUTRENUMERO {
		return statut, nil
	}
	numero = saisi.numero
	if numero == nil {
		numero = e164Courant
	}
	if numero == nil {
		return prospectPtr(db.WhatsappStatusAUCUN), nil
	}
	return statut, numero
}

func prospectDeduireWhatsapp(numero, phoneE164 *string) db.WhatsappStatus {
	if numero == nil {
		return db.WhatsappStatusNONDEMANDE
	}
	if *numero == prospectDeref(phoneE164) {
		return db.WhatsappStatusMEMENUMERO
	}
	return db.WhatsappStatusAUTRENUMERO
}

func prospectChampsJournal(p *db.ProspectVivantRow) map[string]any {
	return map[string]any{
		prospectChampNom: p.Nom, socle.ProspectChampPrenom: p.Prenom, socle.ProspectChampPhone: p.PhoneE164,
		"statut": string(p.Statut), prospectChampBanque: p.BanqueId, prospectChampSyndicat: p.SyndicatId,
		"representantId": p.RepresentantId, "email": p.Email,
	}
}

type ProspectOkOutput struct {
	Body struct {
		Ok bool `json:"ok"`
	}
}

// Suppression logique : l'index unique du téléphone étant PARTIEL, le numéro
// redevient immédiatement ressaisissable.
func (s *service) prospectSupprimer(ctx context.Context, in *ProspectIDInput) (*ProspectOkOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	existant, err := s.prospectModifiable(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	avant := map[string]string{
		prospectChampNom: existant.Nom, socle.ProspectChampPrenom: existant.Prenom,
		socle.ProspectChampPhone: prospectDeref(existant.PhoneE164),
	}
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.SoftDeleteProspect(ctx, in.ID); err != nil {
			return err
		}
		if err := q.AnnulerRappelsEnAttente(ctx, in.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.delete", prospectEntite, in.ID, avant, nil)
	})
	if err != nil {
		return nil, err
	}
	out := &ProspectOkOutput{}
	out.Body.Ok = true
	return out, nil
}

// `WHERE revueAt IS NULL` et non un simple UPDATE : deux revues simultanées
// écriraient deux auteurs, et c'est le PREMIER qui a relu la demande.
func (s *service) prospectRevue(ctx context.Context, in *ProspectIDInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	existant, err := s.Q.ProspectVivant(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, prospectCodeIntrouvable, prospectIntrouvable)
	}
	if err != nil {
		return nil, err
	}
	if existant.Statut != db.ProspectStatutCONVERTI {
		return nil, socle.Problem(http.StatusBadRequest, "PROSPECT_REVUE_REQUIRES_CONVERSION", "Seule une demande convertie se revoit.")
	}
	if err := s.Q.MarquerProspectRevue(ctx, db.MarquerProspectRevueParams{ID: in.ID, RevueById: &u.ID}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type ProspectFusionInput struct {
	Body struct {
		TargetID     string `json:"targetId" format:"uuid"`
		SourceID     string `json:"sourceId" format:"uuid"`
		PreferSource bool   `json:"preferSource,omitempty" required:"false"`
	}
}

// La source est supprimée dans la MÊME transaction que la mise à jour de la
// cible : entre les deux, les deux fiches partageraient le même numéro vivant et
// l'index unique partiel refuserait l'écriture.
func (s *service) prospectFusionner(ctx context.Context, in *ProspectFusionInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	corps := in.Body
	if corps.SourceID == corps.TargetID {
		return nil, socle.Problem(http.StatusBadRequest, "MERGE_SAME_PROSPECT", "Impossible de fusionner une fiche avec elle-même.")
	}
	cible, err := s.prospectModifiable(ctx, &u, corps.TargetID)
	if err != nil {
		return nil, err
	}
	source, err := s.prospectModifiable(ctx, &u, corps.SourceID)
	if err != nil {
		return nil, err
	}
	// Lequel des deux dossiers survit, avec quel montant et quelle étape, est
	// une décision d'instruction que le code ne peut pas prendre.
	ouverts, err := s.Q.CompterDossiersBancairesOuverts(ctx, []string{source.ID, cible.ID})
	if err != nil {
		return nil, err
	}
	if ouverts > 1 {
		return nil, socle.Problem(http.StatusConflict, "MERGE_TWO_OPEN_BANK_CASES",
			"Ces deux fiches portent chacune un dossier bancaire en cours. Clôturez ou corrigez l’un des deux avant de fusionner.")
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		return prospectFusion(ctx, q, &u, corps.SourceID, corps.TargetID, corps.PreferSource)
	}); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, corps.TargetID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type ProspectReaffectationInput struct {
	Body struct {
		ProspectIDs    []string `json:"prospectIds" maxItems:"1000"`
		RepresentantID *string  `json:"representantId,omitempty" format:"uuid" required:"false"`
		CommercialID   *string  `json:"commercialId,omitempty" format:"uuid" required:"false"`
	}
}

type ProspectReaffectationOutput struct {
	Body struct {
		Updated     int      `json:"updated"`
		ProspectIDs []string `json:"prospectIds"`
	}
}

// Le cloisonnement est dans le `WHERE` : les identifiants qui n'appartiennent
// pas à l'appelant sortent de l'ensemble au lieu de faire échouer le lot.
func (s *service) prospectReaffecter(ctx context.Context, in *ProspectReaffectationInput) (*ProspectReaffectationOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	corps := in.Body
	out := &ProspectReaffectationOutput{}
	out.Body.ProspectIDs = []string{}
	if len(corps.ProspectIDs) == 0 {
		return out, nil
	}
	if corps.RepresentantID == nil && corps.CommercialID == nil {
		return nil, socle.Problem(http.StatusBadRequest, "REASSIGN_NO_TARGET", "Indiquez au moins un représentant ou un commercial de destination.")
	}
	if corps.CommercialID != nil && u.Role != socle.Admin {
		return nil, socle.Problem(http.StatusForbidden, "REASSIGN_OWNER_FORBIDDEN", "Seul un administrateur peut changer le commercial propriétaire.")
	}
	ids, err := s.Q.ProspectsAReaffecter(ctx, db.ProspectsAReaffecterParams{
		Ids: corps.ProspectIDs, ScopeAll: u.Role == socle.Admin, ScopeUserID: u.ID,
	})
	if err != nil || len(ids) == 0 {
		return out, err
	}
	if err := s.prospectRepresentantUtilisable(ctx, corps.RepresentantID); err != nil {
		return nil, err
	}
	if err := s.prospectCommercialUtilisable(ctx, corps.CommercialID); err != nil {
		return nil, err
	}
	if err := s.prospectTx(ctx, func(q *db.Queries) error {
		if err := q.ReaffecterProspects(ctx, db.ReaffecterProspectsParams{
			RepresentantID: corps.RepresentantID, CommercialID: corps.CommercialID, Ids: ids,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.reassign", prospectEntite, ids[0], nil,
			map[string]any{"prospectIds": ids, "representantId": corps.RepresentantID, "commercialId": corps.CommercialID})
	}); err != nil {
		return nil, err
	}
	out.Body.Updated, out.Body.ProspectIDs = len(ids), ids
	return out, nil
}

var prospectLecture = []socle.Role{socle.Commercial, socle.ChargeClientele, socle.CCP, socle.Admin, socle.Superviseur, socle.Direction}

var Garde = map[string][]socle.Role{
	"GET /api/v1/prospects":                                           prospectLecture,
	"GET " + prospectCheminID:                                         prospectLecture,
	"GET /api/v1/prospects/{id}/call-attempts":                        prospectLecture,
	"POST /api/v1/prospects":                                          {socle.Admin, socle.Superviseur, socle.Direction},
	"PATCH " + prospectCheminID:                                       socle.Parcours,
	"DELETE " + prospectCheminID:                                      socle.Parcours,
	"POST /api/v1/prospects/merge":                                    {socle.Commercial, socle.ChargeClientele, socle.Admin},
	"POST /api/v1/prospects/reassign":                                 {socle.Commercial, socle.ChargeClientele, socle.Admin},
	"POST /api/v1/prospects/{id}/revue":                               {socle.ChargeClientele, socle.Superviseur, socle.Admin},
	"PATCH " + prospectCheminSegment:                                  socle.Encadrement,
	"GET /api/v1/prospects/{id}/segment-history":                      socle.Parcours,
	"GET /api/v1/prospects/{id}/journal":                              prospectLecture,
	"PATCH /api/v1/prospects/{id}/parcours/grand-public/consentement": {socle.Commercial, socle.ChargeClientele, socle.Admin, socle.Superviseur},
	"POST /api/v1/prospects/{id}/parcours/grand-public/conversion":    {socle.Commercial, socle.ChargeClientele, socle.Admin, socle.Superviseur},
	"GET /api/v1/champs-conversion/{projet}":                          socle.Tous,
	"PUT /api/v1/champs-conversion/{projet}":                          socle.AdminSeul,
	"GET /api/v1/parametres-chues":                                    socle.Parcours,
	"PATCH /api/v1/parametres-chues":                                  socle.Encadrement,
	"GET /api/v1/parametres-chues/journal":                            socle.Encadrement,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "listProspects", Method: http.MethodGet, Path: "/api/v1/prospects"}, s.prospectLister)
	huma.Register(api, huma.Operation{OperationID: "getProspect", Method: http.MethodGet, Path: prospectCheminID}, s.prospectHandlerLire)
	huma.Register(api, huma.Operation{OperationID: "listProspectCallAttempts", Method: http.MethodGet, Path: "/api/v1/prospects/{id}/call-attempts"}, s.prospectTentatives)
	huma.Register(api, huma.Operation{OperationID: "createProspect", Method: http.MethodPost, Path: "/api/v1/prospects", DefaultStatus: http.StatusCreated}, s.prospectCreer)
	huma.Register(api, huma.Operation{OperationID: "updateProspect", Method: http.MethodPatch, Path: prospectCheminID}, s.prospectModifier)
	huma.Register(api, huma.Operation{OperationID: "deleteProspect", Method: http.MethodDelete, Path: prospectCheminID}, s.prospectSupprimer)
	huma.Register(api, huma.Operation{OperationID: "mergeProspects", Method: http.MethodPost, Path: "/api/v1/prospects/merge"}, s.prospectFusionner)
	huma.Register(api, huma.Operation{OperationID: "reassignProspects", Method: http.MethodPost, Path: "/api/v1/prospects/reassign"}, s.prospectReaffecter)
	huma.Register(api, huma.Operation{OperationID: "marquerProspectRevue", Method: http.MethodPost, Path: "/api/v1/prospects/{id}/revue"}, s.prospectRevue)
	prospectMonterSegment(api, s)
	prospectMonterJournal(api, s)
	prospectMonterConversion(api, s)
}
