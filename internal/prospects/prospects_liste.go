package prospects

import (
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"net/http"
	"strings"
	"time"
)

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
	Statut                 string `query:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU,VENDU"`
	Segment                string `query:"segment" enum:"BDD1,BDD2,BDD3,BDD4"`
	Phase2Status           string `query:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER,UNREACHABLE,INTERESTED,HESITANT,APPOINTMENT,REACHED"`
	SansMotif              string `query:"sansMotif" maxLength:"40" doc:"Code du motif dont le dernier appel écarte la fiche."`
	Motif                  string `query:"motif" maxLength:"40" doc:"Code du motif du dernier appel : ne garde que les fiches qui le portent."`
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
	SortBy                 string `query:"sortBy" enum:"createdAt,clientCreatedAt,nom,prenom,statut,lastCallAt"`
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
	// compose que les numéros qui lui reviennent.
	if in.MesFiches {
		p.tout, p.converti, p.rendezVous = false, false, false
	}
	arg := db.ListProspectsParams{
		ScopeAll: p.tout, ScopeUserID: p.userID, ScopeConverti: p.converti, ScopeRendezVous: p.rendezVous,
		CommercialID: prospectVide(in.CommercialID), Type: prospectTypeEnum[db.ProspectType](in.Type),
		CanalProvenanceID: prospectVide(in.CanalProvenanceID), RepresentantID: prospectVide(in.RepresentantID),
		BanqueID: prospectVide(in.BanqueID), SyndicatID: prospectVide(in.SyndicatID),
		Origin:                 prospectVide(in.Origin),
		Phase2Status:           prospectTypeEnum[db.Phase2Status](in.Phase2Status),
		SansMotif:              prospectVide(in.SansMotif),
		Motif:                  prospectVide(in.Motif),
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
		ScopeAll: arg.ScopeAll, ScopeUserID: arg.ScopeUserID, ScopeConverti: arg.ScopeConverti, ScopeRendezVous: arg.ScopeRendezVous,
		CommercialID: arg.CommercialID, Type: arg.Type, CanalProvenanceID: arg.CanalProvenanceID,
		RepresentantID: arg.RepresentantID, BanqueID: arg.BanqueID, SyndicatID: arg.SyndicatID,
		Origin: arg.Origin, Phase2Status: arg.Phase2Status, SansMotif: arg.SansMotif, Motif: arg.Motif,
		EnrollmentMethod:       arg.EnrollmentMethod,
		EnrollmentCapturedByID: arg.EnrollmentCapturedByID, LastCallByID: arg.LastCallByID,
		DepartementID: arg.DepartementID, Projet: arg.Projet, Statut: arg.Statut, Revue: arg.Revue,
		Segment: arg.Segment, AppelePar: arg.AppelePar, DateFrom: arg.DateFrom, DateTo: arg.DateTo,
		Search: arg.Search, PhoneSearch: arg.PhoneSearch, Attribue: arg.Attribue,
		ResteAAppeler: arg.ResteAAppeler,
	}
}
