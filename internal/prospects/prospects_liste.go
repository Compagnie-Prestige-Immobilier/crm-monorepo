package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
)

type ProspectJourney struct {
	ID          string  `json:"id"`
	Projet      string  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Statut      string  `json:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU"`
	Consent     string  `json:"consent" enum:"NON_DEMANDE,INTERESSE,REFUSE"`
	ConsentAt   *string `json:"consentAt"`
	ConvertedAt *string `json:"convertedAt"`
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
		OwnedByCommercialID: p.CreatedById, OwnedByCommercialName: l.OwnerName, Type: prospectEnum(p.Type),
		Profession: prospectPremier(l.ProfessionLabel, p.Profession), ProfessionID: p.ProfessionId,
		ProfessionIsTeaching: l.ProfessionIsTeaching,
		IncomeBandID:         p.IncomeBandId, IncomeBandLabel: l.IncomeBandLabel,
		PaymentMode: prospectEnum(p.PaymentMode), TypeBien: prospectEnum(p.TypeBien),
		EmployeurID: p.EmployeurId, Employeur: prospectPremier(l.EmployeurLabel, p.Employeur),
		TypeContrat: prospectEnum(p.TypeContrat), AncienneteMois: p.AncienneteMois,
		LieuActivite: p.LieuActivite, ModeEpargne: prospectEnum(p.ModeEpargne),
		PaysResidenceID: p.PaysResidenceId, PaysResidenceLabel: l.PaysLabel,
		VilleResidence: p.VilleResidence, Etablissement: p.Etablissement, Email: p.Email,
		WhatsappStatus: string(p.WhatsappStatus), WhatsappE164: p.WhatsappE164,
		WhatsappNumber: prospectNumeroWhatsapp(p.WhatsappStatus, p.WhatsappE164, p.PhoneE164),
		RelaisNom:      p.RelaisNom, RelaisPhoneE164: p.RelaisPhoneE164,
		Journeys: journeys, ChampsLibres: prospectReponses(p.ChampsLibres),
		DureeSystemeMois:  p.DureeSystemeMois,
		CanalProvenanceID: p.CanalProvenanceId, CanalProvenanceLabel: l.CanalLabel,
		Segment:      prospectSegment(l.SyndicatSigle, l.BanqueShortName),
		Phase2Status: string(p.Phase2Status), EnrollmentMethod: prospectEnum(p.EnrollmentMethod),
		EnrollmentCapturedByID: p.EnrollmentCapturedById, EnrollmentCapturedByName: l.EnrollmentCapturedByName,
		EnrollmentCapturedAt: prospectISOPtr(p.EnrollmentCapturedAt), StatutQualification: l.StatutQualification,
		RevueAt: prospectISOPtr(p.RevueAt), RevueByID: p.RevueById, RevueByName: l.RevueByName, RemarqueImport: p.RemarqueImport,
		LastCallAt: prospectISOPtr(p.LastCallAt), LastCallByID: p.LastCallById, LastCallByName: l.LastCallByName,
		EnCoursPar: prospectVide(l.EnCoursPar), RepresentantAppelePar: l.RepresentantAppelePar, RepresentantAppeleAt: prospectISOPtr(l.RepresentantAppeleAt),
		HomonymeTelephone: l.HomonymeTelephone, HomonymeAppeleAt: prospectISOPtr(l.HomonymeAppeleAt), HomonymeAppelePar: l.HomonymeAppelePar,
		Origin: p.Origin, OriginLabel: p.OriginLabel, ARevoirAt: prospectISOPtr(p.ARevoirAt),
		RendezVousIssue: p.RendezVousIssue, RendezVousReporteAt: prospectISOPtr(p.RendezVousReporteAt), SuiteRencontre: p.SuiteRencontre,
		// string_agg ne rend rien hors campagne : le vide devient un tiret.
		Campagne: prospectVide(string(l.CampagneNoms)), RendezVousAt: prospectISOPtr(l.RendezVousAt),
		ClientCreatedAt: prospectISO(p.ClientCreatedAt), CreatedAt: prospectISO(p.CreatedAt),
		UpdatedAt: prospectISO(p.UpdatedAt), DeletedAt: prospectISOPtr(p.DeletedAt),
	}
	if item.Journeys == nil {
		item.Journeys = []ProspectJourney{}
	}
	if derniere != nil {
		item.LastReasonLabel = &derniere.ReasonLabel
		item.LastJoignable = &derniere.CountsAsReached
		item.LastComment = derniere.Comment
		item.LastAttemptAt = prospectPtr(prospectISO(derniere.At))
		item.CallAttemptCount = derniere.Nombre
	}
	return item
}

type prospectPortee struct {
	tout       bool
	converti   bool
	rendezVous bool
	suivi      bool
	userID     string
}

// Le chargé de clientèle voit TOUTE demande convertie : c'est lui qui la relit
// avant l'enrôlement, et une portée bornée à ses fiches la lui cacherait.
func prospectPorteeDe(u *socle.Utilisateur) prospectPortee {
	return prospectPortee{
		tout:       u.Peut(socle.PermissionPortefeuilleVoirTout),
		converti:   u.Peut(socle.PermissionFichesVoirConverties),
		rendezVous: u.Peut(socle.PermissionRendezVousSuivre),
		// Qui tient les rendez-vous suit aussi les intéressés et hésitants de tous les téléconseillers.
		suivi:  u.Peut(socle.PermissionRendezVousCloser),
		userID: u.ID,
	}
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
		ID: &id, ScopeAll: p.tout, ScopeUserID: p.userID, ScopeConverti: p.converti, ScopeRendezVous: p.rendezVous, ScopeSuivi: p.suivi,
		SortBy: prospectTriDefaut, SortOrder: prospectOrdreDefaut, Taille: 1,
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
