package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/banque"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	projetChues     = "CHUES"
	frequenceDefaut = 15
	frequenceMin    = 5
	frequenceMax    = 24 * 60
	pagesMax        = 400
	pausePage       = 600 * time.Millisecond
)

// Un tirage par projet à la fois : la clé `projet + identifiantDistant` rend
// l'écriture idempotente, mais deux tirages liraient la plateforme deux fois.
var tiragesEnCours sync.Map

var clientPlateforme = &http.Client{Timeout: 60 * time.Second}

func monterEnrolement(api huma.API, s *service) {
	base := "/api/v1/enrolement/{projet}"
	huma.Register(api, huma.Operation{OperationID: "listEnrolementInscriptions", Method: http.MethodGet, Path: base + "/inscriptions"}, s.listerInscriptions)
	huma.Register(api, huma.Operation{OperationID: "getEnrolementInscription", Method: http.MethodGet, Path: base + "/inscriptions/{id}"}, s.lireInscription)
	huma.Register(api, huma.Operation{OperationID: "getEnrolementIndicateurs", Method: http.MethodGet, Path: base + "/indicateurs"}, s.lireIndicateurs)
	huma.Register(api, huma.Operation{OperationID: "getEnrolementReglages", Method: http.MethodGet, Path: base + "/reglages"}, s.lireReglagesEnrolement)
	huma.Register(api, huma.Operation{OperationID: "putEnrolementReglages", Method: http.MethodPut, Path: base + "/reglages"}, s.ecrireReglagesEnrolement)
	monterWebhookEnrolement(api, s)
	huma.Register(api, huma.Operation{OperationID: "postEnrolementTirage", Method: http.MethodPost, Path: base + "/tirage", DefaultStatus: http.StatusCreated}, s.tirageManuel)
	huma.Register(api, huma.Operation{OperationID: "purgeEnrolementInscriptions", Method: http.MethodDelete, Path: base + "/inscriptions"}, s.purgerInscriptions)
	huma.Register(api, huma.Operation{OperationID: "deleteEnrolementInscription", Method: http.MethodDelete, Path: base + "/inscriptions/{id}"}, s.supprimerInscription)
}

type Inscription struct {
	ID                 string     `json:"id" format:"uuid"`
	Projet             string     `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	IdentifiantDistant string     `json:"identifiantDistant"`
	Nom                string     `json:"nom"`
	Prenom             string     `json:"prenom"`
	PhoneE164          *string    `json:"phoneE164"`
	Email              *string    `json:"email"`
	StatutDistant      string     `json:"statutDistant"`
	EtapeDistante      *int       `json:"etapeDistante"`
	InscriteLe         *time.Time `json:"inscriteLe"`
	SoumiseLe          *time.Time `json:"soumiseLe"`
	DecideeLe          *time.Time `json:"decideeLe"`
	DisparueLe         *time.Time `json:"disparueLe"`
	ProspectID         *string    `json:"prospectId"`
	DernierTirageAt    time.Time  `json:"dernierTirageAt"`
}

func versInscription(r *db.ListInscriptionsRow) Inscription {
	var etape *int
	if r.EtapeDistante != nil {
		n := int(*r.EtapeDistante)
		etape = &n
	}
	return Inscription{
		ID: r.ID, Projet: string(r.Projet), IdentifiantDistant: r.IdentifiantDistant,
		Nom: r.Nom, Prenom: r.Prenom, PhoneE164: r.PhoneE164, Email: r.Email,
		StatutDistant: r.StatutDistant, EtapeDistante: etape, InscriteLe: r.InscriteLe,
		SoumiseLe: r.SoumiseLe, DecideeLe: r.DecideeLe, DisparueLe: r.DisparueLe,
		ProspectID: r.ProspectId, DernierTirageAt: r.DernierTirageAt,
	}
}

type ListerInscriptionsInput struct {
	Projet           string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Page             int32  `query:"page" minimum:"1" default:"1"`
	PageSize         int32  `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
	Statut           string `query:"statut" maxLength:"80"`
	Search           string `query:"search" maxLength:"120"`
	DateFrom         string `query:"dateFrom" maxLength:"40"`
	DateTo           string `query:"dateTo" maxLength:"40"`
	Rapproche        string `query:"rapproche" enum:"true,false"`
	InclureDisparues string `query:"inclureDisparues" enum:"true,false"`
	// Les étages de l'entonnoir : la plateforme ne les nomme pas, ils se
	// déduisent de l'étape et des dates.
	Avancement string `query:"avancement" enum:"ouvert,soumis,decide"`
}

type ListerInscriptionsOutput struct {
	Body struct {
		Items []Inscription `json:"items"`
		Meta  PageAdmin     `json:"meta"`
	}
}

// Une date seule vaut le jour entier à Dakar : le panneau envoie `2026-09-03`,
// pas un instant.
func borneDateEnrolement(valeur string, fin bool, lieu *time.Location) (time.Time, error) {
	if jour, err := time.ParseInLocation(time.DateOnly, valeur, lieu); err == nil {
		if fin {
			jour = jour.Add(24*time.Hour - time.Millisecond)
		}
		return jour, nil
	}
	instant, err := time.Parse(time.RFC3339, valeur)
	if err != nil {
		return time.Time{}, huma.Error422UnprocessableEntity("date invalide",
			&huma.ErrorDetail{Location: "query", Message: "Date attendue au format ISO 8601.", Value: valeur})
	}
	return instant, nil
}

func (s *service) bornesEnrolement(du, au string) (debut, fin *time.Time, err error) {
	if du != "" {
		borne, err := borneDateEnrolement(du, false, s.Cfg.TimeZone)
		if err != nil {
			return nil, nil, err
		}
		debut = &borne
	}
	if au != "" {
		borne, err := borneDateEnrolement(au, true, s.Cfg.TimeZone)
		if err != nil {
			return nil, nil, err
		}
		fin = &borne
	}
	return debut, fin, nil
}

func (s *service) listerInscriptions(ctx context.Context, in *ListerInscriptionsInput) (*ListerInscriptionsOutput, error) {
	debut, fin, err := s.bornesEnrolement(in.DateFrom, in.DateTo)
	if err != nil {
		return nil, err
	}
	filtres := db.CountInscriptionsParams{
		Projet: db.Projet(in.Projet), InclureDisparues: in.InclureDisparues == socle.Vrai,
		Statut: texteAdmin(in.Statut), Rapproche: booleenAdmin(in.Rapproche),
		DateFrom: debut, DateTo: fin, Search: texteAdmin(in.Search),
		Avancement: texteAdmin(in.Avancement),
	}
	total, err := s.Q.CountInscriptions(ctx, filtres)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListInscriptions(ctx, db.ListInscriptionsParams{
		Projet: filtres.Projet, InclureDisparues: filtres.InclureDisparues, Statut: filtres.Statut,
		Rapproche: filtres.Rapproche, DateFrom: filtres.DateFrom, DateTo: filtres.DateTo,
		Search: filtres.Search, Avancement: filtres.Avancement,
		PageSize: in.PageSize, PageOffset: (in.Page - 1) * in.PageSize,
	})
	if err != nil {
		return nil, err
	}
	out := &ListerInscriptionsOutput{}
	out.Body.Items = make([]Inscription, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, versInscription(&rows[i]))
	}
	taille := int(in.PageSize)
	out.Body.Meta = PageAdmin{
		Total: int(total), Page: int(in.Page), PageSize: taille,
		PageCount: (int(total) + taille - 1) / taille,
	}
	return out, nil
}

type InscriptionInput struct {
	Projet string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	ID     string `path:"id" format:"uuid"`
}

type InscriptionOutput struct {
	Body struct {
		Inscription
		ChargeUtile json.RawMessage `json:"chargeUtile"`
	}
}

func inscriptionIntrouvable() error {
	return socle.Problem(http.StatusNotFound, "INSCRIPTION_INTROUVABLE", "Cette inscription n’existe pas pour ce projet.")
}

func (s *service) lireInscription(ctx context.Context, in *InscriptionInput) (*InscriptionOutput, error) {
	row, err := s.Q.GetInscription(ctx, db.GetInscriptionParams{ID: in.ID, Projet: db.Projet(in.Projet)})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, inscriptionIntrouvable()
	}
	if err != nil {
		return nil, err
	}
	out := &InscriptionOutput{}
	ligne := db.ListInscriptionsRow{
		ID: row.ID, Projet: row.Projet, IdentifiantDistant: row.IdentifiantDistant, Nom: row.Nom,
		Prenom: row.Prenom, PhoneE164: row.PhoneE164, Email: row.Email, StatutDistant: row.StatutDistant,
		EtapeDistante: row.EtapeDistante, InscriteLe: row.InscriteLe, SoumiseLe: row.SoumiseLe,
		DecideeLe: row.DecideeLe, DisparueLe: row.DisparueLe, ProspectId: row.ProspectId,
		DernierTirageAt: row.DernierTirageAt,
	}
	out.Body.Inscription = versInscription(&ligne)
	out.Body.ChargeUtile = row.ChargeUtile
	return out, nil
}

type ProjetEnrolementInput struct {
	Projet string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
}

type SuppressionInscriptionsOutput struct {
	Body struct {
		Supprimees int64 `json:"supprimees"`
	}
}

// Vider le miroir n'a aucune conséquence sur la plateforme : le tirage suivant
// relit tout. Vider puis tirer vérifie ce que le CRM montre.
func (s *service) purgerInscriptions(ctx context.Context, in *ProjetEnrolementInput) (*SuppressionInscriptionsOutput, error) {
	n, err := s.Q.PurgerInscriptions(ctx, db.Projet(in.Projet))
	if err != nil {
		return nil, err
	}
	out := &SuppressionInscriptionsOutput{}
	out.Body.Supprimees = n
	return out, nil
}

func (s *service) supprimerInscription(ctx context.Context, in *InscriptionInput) (*SuppressionInscriptionsOutput, error) {
	n, err := s.Q.SupprimerInscription(ctx, db.SupprimerInscriptionParams{ID: in.ID, Projet: db.Projet(in.Projet)})
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, inscriptionIntrouvable()
	}
	out := &SuppressionInscriptionsOutput{}
	out.Body.Supprimees = n
	return out, nil
}

type BilanTirage struct {
	TermineLe  time.Time `json:"termineLe"`
	DureeMs    int64     `json:"dureeMs"`
	Lus        int       `json:"lus"`
	Crees      int       `json:"crees"`
	MisAJour   int       `json:"misAJour"`
	Rapproches int       `json:"rapproches"`
	Disparues  int       `json:"disparues"`
	Erreur     *string   `json:"erreur"`
}

type reglagesEnrolement struct {
	FrequenceMinutes int          `json:"frequenceMinutes"`
	RepriseDepuis    *string      `json:"repriseDepuis"`
	StatutsComplets  []string     `json:"statutsComplets"`
	DernierTirage    *BilanTirage `json:"dernierTirage"`
}

type ReglagesOutput struct {
	Body struct {
		Projet           string       `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
		FrequenceMinutes int          `json:"frequenceMinutes"`
		RepriseDepuis    *string      `json:"repriseDepuis"`
		StatutsComplets  []string     `json:"statutsComplets"`
		Configuree       bool         `json:"configuree"`
		DernierTirage    *BilanTirage `json:"dernierTirage"`
		UpdatedAt        *time.Time   `json:"updatedAt"`
	}
}

func cleReglages(projet string) string { return socle.CleReglagesEnrolement(projet) }

// Un réglage illisible ou hors bornes retombe sur l'usine plutôt que
// d'arrêter l'écran.
func reglagesStockes(valeur string) reglagesEnrolement {
	valeurs := reglagesEnrolement{FrequenceMinutes: frequenceDefaut}
	var stockees reglagesEnrolement
	if json.Unmarshal([]byte(valeur), &stockees) != nil {
		return valeurs
	}
	if stockees.FrequenceMinutes >= frequenceMin && stockees.FrequenceMinutes <= frequenceMax {
		valeurs.FrequenceMinutes = stockees.FrequenceMinutes
	}
	valeurs.RepriseDepuis, valeurs.DernierTirage = stockees.RepriseDepuis, stockees.DernierTirage
	valeurs.StatutsComplets = stockees.StatutsComplets
	if valeurs.StatutsComplets == nil {
		valeurs.StatutsComplets = []string{}
	}
	return valeurs
}

func (s *service) reglagesTirage(ctx context.Context, projet string) (reglagesEnrolement, *time.Time, error) {
	ligne, existe, err := s.reglage(ctx, cleReglages(projet))
	if err != nil || !existe {
		return reglagesEnrolement{FrequenceMinutes: frequenceDefaut}, nil, err
	}
	return reglagesStockes(ligne.Value), &ligne.UpdatedAt, nil
}

func (s *service) ecrireReglagesTirage(ctx context.Context, projet string, valeurs reglagesEnrolement, acteurID *string) error {
	brut, err := json.Marshal(valeurs)
	if err != nil {
		return err
	}
	_, err = s.Q.UpsertSetting(ctx, db.UpsertSettingParams{Key: cleReglages(projet), Value: string(brut), UpdatedById: acteurID})
	return err
}

func (s *service) reponseReglagesEnrolement(ctx context.Context, projet string) (*ReglagesOutput, error) {
	valeurs, quand, err := s.reglagesTirage(ctx, projet)
	if err != nil {
		return nil, err
	}
	base, jeton := socle.PlateformeConfiguree(projet)
	out := &ReglagesOutput{}
	out.Body.Projet = projet
	out.Body.FrequenceMinutes = valeurs.FrequenceMinutes
	out.Body.RepriseDepuis = valeurs.RepriseDepuis
	out.Body.StatutsComplets = valeurs.StatutsComplets
	out.Body.Configuree = base != "" && jeton != ""
	out.Body.DernierTirage = valeurs.DernierTirage
	out.Body.UpdatedAt = quand
	return out, nil
}

func (s *service) lireReglagesEnrolement(ctx context.Context, in *ProjetEnrolementInput) (*ReglagesOutput, error) {
	return s.reponseReglagesEnrolement(ctx, in.Projet)
}

type EcrireReglagesInput struct {
	Projet string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	Body   struct {
		FrequenceMinutes *int      `json:"frequenceMinutes,omitempty" minimum:"5" maximum:"1440"`
		RepriseDepuis    *string   `json:"repriseDepuis,omitempty" maxLength:"40"`
		StatutsComplets  *[]string `json:"statutsComplets,omitempty" maxItems:"20"`
	}
}

// Chaîne vide : reprendre tout l'historique. Absente : ne rien changer.
func repriseNormalisee(valeur, courant *string) *string {
	if valeur == nil {
		return courant
	}
	if strings.TrimSpace(*valeur) == "" {
		return nil
	}
	for _, forme := range []string{time.RFC3339, time.DateOnly} {
		if instant, err := time.Parse(forme, *valeur); err == nil {
			iso := instant.UTC().Format(time.RFC3339)
			return &iso
		}
	}
	return courant
}

func (s *service) ecrireReglagesEnrolement(ctx context.Context, in *EcrireReglagesInput) (*ReglagesOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	valeurs, _, err := s.reglagesTirage(ctx, in.Projet)
	if err != nil {
		return nil, err
	}
	if in.Body.FrequenceMinutes != nil {
		valeurs.FrequenceMinutes = *in.Body.FrequenceMinutes
	}
	valeurs.RepriseDepuis = repriseNormalisee(in.Body.RepriseDepuis, valeurs.RepriseDepuis)
	if in.Body.StatutsComplets != nil {
		valeurs.StatutsComplets = make([]string, 0, len(*in.Body.StatutsComplets))
		for _, statut := range *in.Body.StatutsComplets {
			if propre := strings.TrimSpace(statut); propre != "" {
				valeurs.StatutsComplets = append(valeurs.StatutsComplets, propre)
			}
		}
	}
	if err := s.ecrireReglagesTirage(ctx, in.Projet, valeurs, &acteur.ID); err != nil {
		return nil, err
	}
	return s.reponseReglagesEnrolement(ctx, in.Projet)
}

type TirageOutput struct {
	Body struct {
		Projet     string  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
		DureeMs    int64   `json:"dureeMs"`
		Lus        int     `json:"lus"`
		Crees      int     `json:"crees"`
		MisAJour   int     `json:"misAJour"`
		Rapproches int     `json:"rapproches"`
		Disparues  int     `json:"disparues"`
		Erreur     *string `json:"erreur"`
	}
}

func (s *service) tirageManuel(ctx context.Context, in *ProjetEnrolementInput) (*TirageOutput, error) {
	bilan := s.tirer(ctx, in.Projet)
	out := &TirageOutput{}
	out.Body.Projet = in.Projet
	out.Body.DureeMs, out.Body.Lus, out.Body.Crees = bilan.DureeMs, bilan.Lus, bilan.Crees
	out.Body.MisAJour, out.Body.Rapproches, out.Body.Disparues = bilan.MisAJour, bilan.Rapproches, bilan.Disparues
	out.Body.Erreur = bilan.Erreur
	return out, nil
}

// Chaque minute : ne fait rien tant qu'aucune plateforme n'est configurée.
func (s *service) tirerEnrolement(ctx context.Context) error {
	for _, projet := range []string{projetChues, socle.ProjetGrandPublic} {
		base, jeton := socle.PlateformeConfiguree(projet)
		if base == "" || jeton == "" {
			continue
		}
		valeurs, _, err := s.reglagesTirage(ctx, projet)
		if err != nil {
			return err
		}
		if valeurs.DernierTirage != nil &&
			time.Since(valeurs.DernierTirage.TermineLe) < time.Duration(valeurs.FrequenceMinutes)*time.Minute {
			continue
		}
		s.tirer(ctx, projet)
	}
	return nil
}

func (s *service) tirer(ctx context.Context, projet string) BilanTirage {
	if _, occupe := tiragesEnCours.LoadOrStore(projet, true); occupe {
		deja := "Un tirage est déjà en cours."
		return BilanTirage{TermineLe: time.Now(), Erreur: &deja}
	}
	defer tiragesEnCours.Delete(projet)

	debut := time.Now()
	bilan, err := s.executerTirage(ctx, projet)
	bilan.TermineLe = time.Now()
	bilan.DureeMs = time.Since(debut).Milliseconds()
	if err != nil {
		message := err.Error()
		bilan.Erreur = &message
		slog.Error("tirage d’enrôlement interrompu", "projet", projet, "err", message)
	} else if _, err := banque.SignalerDossiersComplets(ctx, s.Deps, projet); err != nil {
		slog.Error("tirage d’enrôlement : dossiers complets non signalés", "projet", projet, "err", err)
	}
	valeurs, _, lecture := s.reglagesTirage(ctx, projet)
	if lecture == nil {
		valeurs.DernierTirage = &bilan
		if err := s.ecrireReglagesTirage(ctx, projet, valeurs, nil); err != nil {
			slog.Error("tirage d’enrôlement : compte rendu non écrit", "projet", projet, "err", err)
		}
	}
	return bilan
}

func (s *service) executerTirage(ctx context.Context, projet string) (BilanTirage, error) {
	var bilan BilanTirage
	base, jeton := socle.PlateformeConfiguree(projet)
	if base == "" || jeton == "" {
		return bilan, fmt.Errorf("aucune URL ni jeton pour la plateforme %s", projet)
	}
	lignes, err := lirePlateforme(ctx, projet, base, jeton)
	if err != nil {
		return bilan, err
	}
	valeurs, _, err := s.reglagesTirage(ctx, projet)
	if err != nil {
		return bilan, err
	}
	retenues := depuisReprise(lignes, valeurs.RepriseDepuis)
	bilan.Lus = len(retenues)

	index, err := s.indexerProspects(ctx, projet, retenues)
	if err != nil {
		return bilan, err
	}
	connus, err := s.Q.IdentifiantsConnus(ctx, db.Projet(projet))
	if err != nil {
		return bilan, err
	}
	tirageAt := time.Now()
	vus := make([]string, 0, len(retenues))
	for i := range retenues {
		ligne := &retenues[i]
		prospectID := index.choisir(ligne.PhoneE164, ligne.Email)
		if prospectID != nil {
			bilan.Rapproches++
		}
		if slices.Contains(connus, ligne.IdentifiantDistant) {
			bilan.MisAJour++
		} else {
			bilan.Crees++
		}
		if err := s.deposerInscription(ctx, projet, ligne, prospectID, tirageAt); err != nil {
			return bilan, err
		}
		vus = append(vus, ligne.IdentifiantDistant)
	}
	disparues, err := s.marquerDisparues(ctx, projet, vus, len(connus), valeurs.RepriseDepuis, tirageAt)
	bilan.Disparues = disparues
	return bilan, err
}

func (s *service) deposerInscription(ctx context.Context, projet string, ligne *inscriptionDistante, prospectID *string, tirageAt time.Time) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	charge := ligne.ChargeUtile
	if len(charge) == 0 {
		charge = json.RawMessage("{}")
	}
	return s.Q.UpsertInscription(ctx, db.UpsertInscriptionParams{
		ID: id.String(), Projet: db.Projet(projet), IdentifiantDistant: ligne.IdentifiantDistant,
		Nom: ligne.Nom, Prenom: ligne.Prenom, PhoneE164: ligne.PhoneE164, Email: ligne.Email,
		StatutDistant: ligne.StatutDistant, EtapeDistante: ligne.EtapeDistante,
		InscriteLe: ligne.InscriteLe, SoumiseLe: ligne.SoumiseLe, DecideeLe: ligne.DecideeLe,
		ProspectId: prospectID, ChargeUtile: charge, DernierTirageAt: tirageAt,
	})
}

// Ce qu'un tirage complet ne rend plus est marqué, jamais supprimé. Une reprise
// datée n'en rend qu'une tranche, et une plateforme vide face à une table
// pleine est une panne d'en face : dans ces deux cas, ne rien marquer.
func (s *service) marquerDisparues(ctx context.Context, projet string, vus []string, connus int, reprise *string, quand time.Time) (int, error) {
	if reprise != nil {
		return 0, nil
	}
	if len(vus) == 0 && connus > 0 {
		slog.Warn("tirage d’enrôlement : la plateforme ne rend plus rien", "projet", projet, "connus", connus)
		return 0, nil
	}
	n, err := s.Q.MarquerDisparues(ctx, db.MarquerDisparuesParams{Projet: db.Projet(projet), Vus: vus, Quand: quand})
	return int(n), err
}

func depuisReprise(lignes []inscriptionDistante, reprise *string) []inscriptionDistante {
	if reprise == nil {
		return lignes
	}
	borne, err := time.Parse(time.RFC3339, *reprise)
	if err != nil {
		return lignes
	}
	retenues := make([]inscriptionDistante, 0, len(lignes))
	for i := range lignes {
		// Une ligne sans date d'inscription est GARDÉE : l'écarter ferait
		// disparaître de l'écran une inscription réelle.
		if lignes[i].InscriteLe == nil || !lignes[i].InscriteLe.Before(borne) {
			retenues = append(retenues, lignes[i])
		}
	}
	return retenues
}

type candidatProspect struct {
	id              string
	clientCreatedAt time.Time
}

type indexProspects struct {
	parTelephone map[string][]candidatProspect
	parEmail     map[string][]candidatProspect
}

func (i indexProspects) choisir(telephone, email *string) *string {
	if telephone != nil && strings.TrimSpace(*telephone) != "" {
		if seau := i.parTelephone[*telephone]; len(seau) > 0 {
			return &seau[0].id
		}
	}
	if email != nil && strings.TrimSpace(*email) != "" {
		if seau := i.parEmail[strings.ToLower(strings.TrimSpace(*email))]; len(seau) > 0 {
			return &seau[0].id
		}
	}
	return nil
}

// Le plus ancien d'abord, puis l'identifiant : deux tirages rendent le même lien.
func ajouterCandidat(index map[string][]candidatProspect, cle string, c candidatProspect) {
	for _, deja := range index[cle] {
		if deja.id == c.id {
			return
		}
	}
	index[cle] = append(index[cle], c)
	seau := index[cle]
	slices.SortFunc(seau, func(a, b candidatProspect) int {
		if a.clientCreatedAt.Equal(b.clientCreatedAt) {
			return strings.Compare(a.id, b.id)
		}
		return a.clientCreatedAt.Compare(b.clientCreatedAt)
	})
	index[cle] = seau
}

func cles(lignes []inscriptionDistante) (telephones, emails []string) {
	for i := range lignes {
		if t := lignes[i].PhoneE164; t != nil && *t != "" {
			telephones = append(telephones, *t)
		}
		if e := texteDistant(lignes[i].Email); e != nil {
			emails = append(emails, strings.ToLower(*e))
		}
	}
	return slices.Compact(slices.Sorted(slices.Values(telephones))), slices.Compact(slices.Sorted(slices.Values(emails)))
}

func (s *service) indexerProspects(ctx context.Context, projet string, lignes []inscriptionDistante) (indexProspects, error) {
	index := indexProspects{parTelephone: map[string][]candidatProspect{}, parEmail: map[string][]candidatProspect{}}
	telephones, emails := cles(lignes)
	if len(telephones) > 0 {
		rows, err := s.Q.CandidatsParTelephone(ctx, db.CandidatsParTelephoneParams{Projet: db.Projet(projet), Telephones: telephones})
		if err != nil {
			return index, err
		}
		for _, row := range rows {
			c := candidatProspect{id: row.ID, clientCreatedAt: row.ClientCreatedAt}
			indexerNumeros(index.parTelephone, c, row.PhoneE164, row.WhatsappE164)
		}
	}
	if len(emails) > 0 {
		// `prospects` n'a pas d'e-mail fiable : la conversion l'écrit sur la
		// tentative d'appel.
		rows, err := s.Q.CandidatsParEmail(ctx, db.CandidatsParEmailParams{Projet: db.Projet(projet), Emails: emails})
		if err != nil {
			return index, err
		}
		for _, row := range rows {
			ajouterCandidat(index.parEmail, row.Email, candidatProspect{id: row.ID, clientCreatedAt: row.ClientCreatedAt})
		}
	}
	return index, nil
}

// Une fiche sans numéro ne s'indexe pas : elle ne peut appareiller aucune
// inscription distante, qui ne se reconnaît qu'au téléphone ou à l'e-mail.
func indexerNumeros(index map[string][]candidatProspect, c candidatProspect, numeros ...*string) {
	for _, numero := range numeros {
		if numero != nil {
			ajouterCandidat(index, *numero, c)
		}
	}
}

type inscriptionDistante struct {
	IdentifiantDistant string
	Nom                string
	Prenom             string
	PhoneE164          *string
	Email              *string
	StatutDistant      string
	EtapeDistante      *int32
	InscriteLe         *time.Time
	SoumiseLe          *time.Time
	DecideeLe          *time.Time
	ChargeUtile        json.RawMessage
}

// Laravel sérialise ses horodatages tantôt en secondes, tantôt en
// millisecondes ; le seuil sépare les deux sans ambiguïté.
const seuilSecondes = 1e11

func dateDistanteEpoch(valeur *float64) *time.Time {
	if valeur == nil || *valeur == 0 {
		return nil
	}
	ms := int64(*valeur)
	if *valeur < seuilSecondes {
		ms = int64(*valeur) * 1000
	}
	instant := time.UnixMilli(ms).UTC()
	return &instant
}

// « 2026-09-03 13:43:05 » n'a pas de fuseau : le serveur métier est à Dakar,
// donc UTC. Lue dans le fuseau de la machine, la même inscription changerait de jour.
func dateDistanteTexte(valeur *string) *time.Time {
	if valeur == nil || strings.TrimSpace(*valeur) == "" {
		return nil
	}
	propre := strings.TrimSpace(*valeur)
	for _, forme := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", time.DateOnly} {
		if instant, err := time.ParseInLocation(forme, propre, time.UTC); err == nil {
			return &instant
		}
	}
	return nil
}

func texteDistant(valeur *string) *string {
	if valeur == nil {
		return nil
	}
	propre := strings.TrimSpace(*valeur)
	if propre == "" {
		return nil
	}
	return &propre
}

func lirePlateforme(ctx context.Context, projet, base, jeton string) ([]inscriptionDistante, error) {
	if projet == projetChues {
		return lireChues(ctx, base, jeton)
	}
	return lirePlateformeGrandPublic(ctx, base, jeton)
}

func appelPlateforme(ctx context.Context, projet, url, jeton string, cible any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+jeton)
	req.Header.Set("Accept", "application/json")
	resp, err := clientPlateforme.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusUnauthorized {
		return resp.StatusCode, fmt.Errorf("jeton refusé par la plateforme %s (401)", projet)
	}
	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode, fmt.Errorf("lecture refusée par la plateforme %s (%d)", projet, resp.StatusCode)
	}
	return resp.StatusCode, json.NewDecoder(resp.Body).Decode(cible)
}

// Les deux plateformes ont migre leurs identifiants d'un entier vers un UUID.
// Un `json.Number` refuse la chaine, et le tirage rejetait alors chaque ligne
// en silence : 200 lu, zero retenu, aucune erreur.
type idDistant string

func (id *idDistant) UnmarshalJSON(brut []byte) error {
	var texte string
	if json.Unmarshal(brut, &texte) == nil {
		*id = idDistant(texte)
		return nil
	}
	var nombre json.Number
	if err := json.Unmarshal(brut, &nombre); err != nil {
		return err
	}
	*id = idDistant(nombre.String())
	return nil
}

type ligneChues struct {
	ID        idDistant `json:"id"`
	Email     *string   `json:"email"`
	FirstName *string   `json:"firstName"`
	LastName  *string   `json:"lastName"`
	Phone     *string   `json:"phone"`
	CreatedAt *float64  `json:"createdAt"`
	Approved  bool      `json:"approved"`
	Dossier   *struct {
		Status      string   `json:"status"`
		SubmittedAt *float64 `json:"submittedAt"`
	} `json:"dossier"`
}

// `/clients` pagine par 25 : sans le parcours complet, les comptes des pages
// suivantes seraient marqués disparus a chaque tirage.
func pageChues(ctx context.Context, base, jeton string, page int) (lignes []json.RawMessage, dernierePage int, err error) {
	var comptes struct {
		Clients []json.RawMessage `json:"clients"`
		Meta    *struct {
			LastPage *int `json:"lastPage"`
		} `json:"meta"`
	}
	url := base + "/clients?page=" + strconv.Itoa(page)
	if _, err := appelPlateforme(ctx, projetChues, url, jeton, &comptes); err != nil {
		return nil, page, err
	}
	dernierePage = page
	if comptes.Meta != nil && comptes.Meta.LastPage != nil && len(comptes.Clients) > 0 {
		dernierePage = *comptes.Meta.LastPage
	}
	return comptes.Clients, dernierePage, nil
}

func comptesChues(ctx context.Context, base, jeton string) ([]json.RawMessage, error) {
	var clients []json.RawMessage
	dernierePage := 1
	for page := 1; page <= dernierePage && page <= pagesMax; page++ {
		lues, derniere, err := pageChues(ctx, base, jeton, page)
		if err != nil {
			return nil, err
		}
		clients = append(clients, lues...)
		dernierePage = derniere
		if page >= dernierePage {
			return clients, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(pausePage):
		}
	}
	return clients, nil
}

// La décision vit sur la demande d'adhésion, que seul l'e-mail relie au
// compte. Une plateforme sans la permission rend 403 : le tirage continue.
func decisionsChues(ctx context.Context, base, jeton string) (map[string]*time.Time, error) {
	var adhesions struct {
		Requests []struct {
			Email     *string  `json:"email"`
			DecidedAt *float64 `json:"decidedAt"`
		} `json:"requests"`
	}
	statut, err := appelPlateforme(ctx, projetChues, base+"/chues/adhesions", jeton, &adhesions)
	if statut == http.StatusUnauthorized {
		return nil, err
	}
	if err != nil {
		slog.Warn("adhésions CHUES illisibles, aucune date de décision", "statut", statut, "err", err)
	}
	decisions := map[string]*time.Time{}
	for _, demande := range adhesions.Requests {
		if courriel := texteDistant(demande.Email); courriel != nil {
			decisions[strings.ToLower(*courriel)] = dateDistanteEpoch(demande.DecidedAt)
		}
	}
	return decisions, nil
}

func versInscriptionChues(ligne *ligneChues, brut json.RawMessage, decisions map[string]*time.Time) inscriptionDistante {
	statutDistant := "compte-en-attente"
	if ligne.Approved {
		statutDistant = "compte-valide"
	}
	var soumise *time.Time
	if ligne.Dossier != nil {
		statutDistant = ligne.Dossier.Status
		soumise = dateDistanteEpoch(ligne.Dossier.SubmittedAt)
	}
	courriel := texteDistant(ligne.Email)
	var decidee *time.Time
	if courriel != nil {
		decidee = decisions[strings.ToLower(*courriel)]
	}
	return inscriptionDistante{
		IdentifiantDistant: string(ligne.ID),
		Nom:                valeurDistante(texteDistant(ligne.LastName)),
		Prenom:             valeurDistante(texteDistant(ligne.FirstName)),
		PhoneE164:          database.TelephoneOptionnel(ligne.Phone, "SN"),
		Email:              courriel,
		StatutDistant:      statutDistant,
		InscriteLe:         dateDistanteEpoch(ligne.CreatedAt),
		SoumiseLe:          soumise,
		DecideeLe:          decidee,
		ChargeUtile:        brut,
	}
}

func lireChues(ctx context.Context, base, jeton string) ([]inscriptionDistante, error) {
	clients, err := comptesChues(ctx, base, jeton)
	if err != nil {
		return nil, err
	}
	decisions, err := decisionsChues(ctx, base, jeton)
	if err != nil {
		return nil, err
	}

	lignes := make([]inscriptionDistante, 0, len(clients))
	for _, brut := range clients {
		var ligne ligneChues
		// Une ligne qui ne tient pas le contrat est ignorée, pas déposée à moitié.
		if json.Unmarshal(brut, &ligne) == nil {
			lignes = append(lignes, versInscriptionChues(&ligne, brut, decisions))
		}
	}
	return lignes, nil
}

func valeurDistante(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

type ligneGrandPublicDistante struct {
	ID              idDistant    `json:"id"`
	Name            *string      `json:"name"`
	Email           *string      `json:"email"`
	Phone           *string      `json:"phone"`
	DossierEtape    *json.Number `json:"dossierEtape"`
	DateInscription *string      `json:"dateInscription"`
	Demande         *struct {
		SubmittedAt *string `json:"submittedAt"`
	} `json:"demande"`
}

// Grand Public ne stocke qu'un `name` ; l'ordre d'affichage est « Prénom Nom ».
func separerNomDistant(complet *string) (nom, prenom string) {
	mots := strings.Fields(valeurDistante(complet))
	if len(mots) == 0 {
		return "", ""
	}
	if len(mots) == 1 {
		return mots[0], ""
	}
	return strings.Join(mots[1:], " "), mots[0]
}

func pageGrandPublic(ctx context.Context, base, jeton string, page int) (lignes []inscriptionDistante, dernierePage int, err error) {
	var reponse struct {
		Data []json.RawMessage `json:"data"`
		Meta *struct {
			LastPage *int `json:"last_page"`
		} `json:"meta"`
		LastPage *int `json:"last_page"`
	}
	url := base + "/staff/clients?page=" + strconv.Itoa(page)
	if _, err := appelPlateforme(ctx, socle.ProjetGrandPublic, url, jeton, &reponse); err != nil {
		return nil, page, err
	}
	for _, brut := range reponse.Data {
		var ligne ligneGrandPublicDistante
		// Une ligne qui ne tient pas le contrat est ignorée, pas déposée à moitié.
		if json.Unmarshal(brut, &ligne) == nil {
			lignes = append(lignes, versInscriptionGrandPublic(&ligne, brut))
		}
	}
	dernierePage = page
	if reponse.Meta != nil && reponse.Meta.LastPage != nil {
		dernierePage = *reponse.Meta.LastPage
	} else if reponse.LastPage != nil {
		dernierePage = *reponse.LastPage
	}
	if len(reponse.Data) == 0 {
		dernierePage = page
	}
	return lignes, dernierePage, nil
}

func lirePlateformeGrandPublic(ctx context.Context, base, jeton string) ([]inscriptionDistante, error) {
	var lignes []inscriptionDistante
	dernierePage := 1
	for page := 1; page <= dernierePage && page <= pagesMax; page++ {
		lues, derniere, err := pageGrandPublic(ctx, base, jeton, page)
		if err != nil {
			return nil, err
		}
		lignes = append(lignes, lues...)
		dernierePage = derniere
		if page >= dernierePage {
			break
		}
		select {
		case <-ctx.Done():
			return lignes, ctx.Err()
		case <-time.After(pausePage):
		}
	}
	return lignes, nil
}

func versInscriptionGrandPublic(ligne *ligneGrandPublicDistante, brut json.RawMessage) inscriptionDistante {
	nom, prenom := separerNomDistant(ligne.Name)
	// Le `statut` de la plateforme est un texte libre décoratif : l'état qui se
	// mesure est l'ÉTAPE, et le statut en dérive.
	statut := "etape-inconnue"
	var etape *int32
	if ligne.DossierEtape != nil {
		if n, err := strconv.ParseInt(ligne.DossierEtape.String(), 10, 32); err == nil {
			valeur := int32(n)
			etape = &valeur
			statut = "etape-" + strconv.FormatInt(n, 10)
		}
	}
	var soumise *time.Time
	if ligne.Demande != nil {
		soumise = dateDistanteTexte(ligne.Demande.SubmittedAt)
	}
	return inscriptionDistante{
		IdentifiantDistant: string(ligne.ID),
		Nom:                nom,
		Prenom:             prenom,
		PhoneE164:          database.TelephoneOptionnel(ligne.Phone, "SN"),
		Email:              texteDistant(ligne.Email),
		StatutDistant:      statut,
		EtapeDistante:      etape,
		InscriteLe:         dateDistanteTexte(ligne.DateInscription),
		SoumiseLe:          soumise,
		ChargeUtile:        brut,
	}
}

type SerieJour struct {
	Jour         string `json:"jour"`
	Inscriptions int    `json:"inscriptions"`
}

type RepartitionEnrolement struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	Inscriptions int    `json:"inscriptions"`
}

type DelaiMedian struct {
	Leg         string   `json:"leg"`
	Label       string   `json:"label"`
	MedianDays  *float64 `json:"medianDays"`
	MoyenneDays *float64 `json:"moyenneDays"`
	Sample      int      `json:"sample"`
}

type IndicateursOutput struct {
	Body struct {
		Projet             string                  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
		Inscriptions       int                     `json:"inscriptions"`
		Rapprochees        int                     `json:"rapprochees"`
		TauxConversion     *float64                `json:"tauxConversion"`
		TauxRapprochement  *float64                `json:"tauxRapprochement"`
		ParJour            []SerieJour             `json:"parJour"`
		ParEtape           []RepartitionEnrolement `json:"parEtape"`
		Delais             []DelaiMedian           `json:"delais"`
		ParTeleconseiller  []RepartitionEnrolement `json:"parTeleconseiller"`
		ParCampagne        []RepartitionEnrolement `json:"parCampagne"`
		ParMethode         []RepartitionEnrolement `json:"parMethode"`
		Entonnoir          EntonnoirEnrolement     `json:"entonnoir"`
		ParAgentPlateforme []RepartitionEnrolement `json:"parAgentPlateforme"`
		ParPiece           []RepartitionEnrolement `json:"parPiece"`
	}
}

// Ce qui avance, en quatre nombres. Les deux plateformes nomment leurs etats
// autrement : un compte sans dossier se reconnait au prefixe `compte-` cote
// CHUES, a l'etape zero cote Grand Public.
type EntonnoirEnrolement struct {
	Inscriptions    int `json:"inscriptions"`
	DossiersOuverts int `json:"dossiersOuverts"`
	DossiersSoumis  int `json:"dossiersSoumis"`
	DossiersDecides int `json:"dossiersDecides"`
}

const dossierOuvert = `(COALESCE(i."etapeDistante", 0) > 0` +
	` OR (i."etapeDistante" IS NULL AND i."statutDistant" NOT LIKE 'compte-%'))`

type IndicateursInput struct {
	Projet   string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	DateFrom string `query:"dateFrom" maxLength:"40"`
	DateTo   string `query:"dateTo" maxLength:"40"`
}

func tauxEnrolement(valeur, total int) *float64 {
	if total == 0 {
		return nil
	}
	arrondi := math.Round(float64(valeur)/float64(total)*1000) / 10
	return &arrondi
}

func joursArrondis(valeur *float64) *float64 {
	if valeur == nil {
		return nil
	}
	arrondi := math.Round(*valeur*10) / 10
	return &arrondi
}

// Une inscription disparue de la plateforme ne compte plus dans aucun chiffre.
func filtresEnrolement(debut, fin *time.Time) (clause string, args []any) {
	clauses := []string{`i."disparueLe" IS NULL`}
	args = []any{}
	if debut != nil {
		args = append(args, *debut)
		clauses = append(clauses, fmt.Sprintf(`i."inscriteLe" >= $%d`, len(args)+1))
	}
	if fin != nil {
		args = append(args, *fin)
		clauses = append(clauses, fmt.Sprintf(`i."inscriteLe" <= $%d`, len(args)+1))
	}
	return strings.Join(clauses, " AND "), args
}

func (s *service) repartitionEnrolement(ctx context.Context, requete string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var l RepartitionEnrolement
		if err := rows.Scan(&l.ID, &l.Label, &l.Inscriptions); err != nil {
			return nil, err
		}
		lignes = append(lignes, l)
	}
	return lignes, rows.Err()
}

const etapesGrandPublic = "Étape 0 · Inscription,Étape 1 · Dossier constitué,Étape 2 · Dépôt en banque,Étape 3 · Accord bancaire,Étape 4 · Signature,Étape 5 · Terminé"

// Les statuts que CHUES rend sont ceux de son moteur. La cellule de pilotage
// lit du francais, pas le vocabulaire de la plateforme.
var statutsChues = map[string]string{
	"compte-en-attente": "Compte en attente",
	"compte-valide":     "Compte validé",
	"draft":             "Dossier en préparation",
	"submitted":         "Dossier soumis",
	"approved":          "Dossier accepté",
	"rejected":          "Dossier refusé",
}

func libelleEtapeEnrolement(etape *int32, statut string) string {
	if etape == nil {
		if libelle, connu := statutsChues[statut]; connu {
			return libelle
		}
		return statut
	}
	libelles := strings.Split(etapesGrandPublic, ",")
	if int(*etape) < len(libelles) && *etape >= 0 {
		return libelles[*etape]
	}
	return "Étape " + strconv.FormatInt(int64(*etape), 10)
}

func (s *service) lireIndicateurs(ctx context.Context, in *IndicateursInput) (*IndicateursOutput, error) {
	debut, fin, err := s.bornesEnrolement(in.DateFrom, in.DateTo)
	if err != nil {
		return nil, err
	}
	filtres, bornes := filtresEnrolement(debut, fin)
	args := append([]any{db.Projet(in.Projet)}, bornes...)
	depuis := ` FROM "inscriptions_plateforme" i WHERE i."projet" = $1::"Projet" AND ` + filtres

	out := &IndicateursOutput{}
	out.Body.Projet = in.Projet
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE i."prospectId" IS NOT NULL)::int,`+
		` COUNT(*) FILTER (WHERE `+dossierOuvert+`)::int,`+
		` COUNT(*) FILTER (WHERE i."soumiseLe" IS NOT NULL)::int,`+
		` COUNT(*) FILTER (WHERE i."decideeLe" IS NOT NULL)::int`+depuis, args...).
		Scan(&out.Body.Inscriptions, &out.Body.Rapprochees, &out.Body.Entonnoir.DossiersOuverts,
			&out.Body.Entonnoir.DossiersSoumis, &out.Body.Entonnoir.DossiersDecides); err != nil {
		return nil, err
	}
	out.Body.Entonnoir.Inscriptions = out.Body.Inscriptions
	out.Body.TauxRapprochement = tauxEnrolement(out.Body.Rapprochees, out.Body.Inscriptions)

	conversion, err := s.Q.ConversionEnrolement(ctx, db.Projet(in.Projet))
	if err != nil {
		return nil, err
	}
	out.Body.TauxConversion = tauxEnrolement(int(conversion.Inscrits), int(conversion.Convertis))

	if out.Body.ParJour, err = s.serieJoursEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.ParEtape, err = s.parEtapeEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.Delais, err = s.delaisEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.ParTeleconseiller, err = s.repartitionEnrolement(ctx, `SELECT u."id", u."fullName", COUNT(*)::int`+
		` FROM "inscriptions_plateforme" i`+
		` INNER JOIN "prospects" p ON p."id" = i."prospectId"`+
		` INNER JOIN "users" u ON u."id" = COALESCE(p."enrollmentCapturedById", p."createdById")`+
		` WHERE i."projet" = $1::"Projet" AND `+filtres+` GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParCampagne, err = s.repartitionEnrolement(ctx, `SELECT l."id", l."name", COUNT(DISTINCT i."id")::int`+
		` FROM "inscriptions_plateforme" i`+
		` INNER JOIN "lot_export_items" li ON li."prospectId" = i."prospectId"`+
		` INNER JOIN "lots_export" l ON l."id" = li."lotId"`+
		` WHERE i."projet" = $1::"Projet" AND l."projet" = $1::"Projet" AND `+filtres+` GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParAgentPlateforme, err = s.repartitionEnrolement(ctx, `SELECT `+agentPlateforme+`, `+agentPlateforme+
		`, COUNT(*)::int`+depuis+` AND `+agentPlateforme+` IS NOT NULL GROUP BY 1 ORDER BY 3 DESC, 1 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParPiece, err = s.repartitionEnrolement(ctx, requetePieces+filtres+
		` AND jsonb_typeof(i."chargeUtile"->'requisDocs') = 'array' GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	out.Body.ParMethode, err = s.parMethodeEnrolement(ctx, filtres, args)
	return out, err
}

// L'agent qui a saisi l'inscription n'a pas de colonne : les deux plateformes
// le rendent, sous deux noms, et le tirage garde leur reponse telle quelle.
const agentPlateforme = `COALESCE(i."chargeUtile"->'agent'->>'name', i."chargeUtile"->>'conseiller')`

// Une piece par ligne, avec son etat : c'est ce qui dit sur quoi un dossier bloque.
const requetePieces = `SELECT (piece->>'docId') || ':' || (piece->>'status'),` +
	` COALESCE(piece->>'label', piece->>'docId') || ' · ' ||` +
	` CASE piece->>'status' WHEN 'accepte' THEN 'acceptée' WHEN 'en-attente' THEN 'en attente'` +
	` WHEN 'refuse' THEN 'refusée' ELSE piece->>'status' END, COUNT(*)::int` +
	` FROM "inscriptions_plateforme" i, jsonb_array_elements(i."chargeUtile"->'requisDocs') AS piece` +
	` WHERE i."projet" = $1::"Projet" AND `

func (s *service) serieJoursEnrolement(ctx context.Context, depuis string, args []any) ([]SerieJour, error) {
	rows, err := s.Pool.Query(ctx, `SELECT date_trunc('day', i."inscriteLe") AS jour, COUNT(*)::int`+depuis+
		` AND i."inscriteLe" IS NOT NULL GROUP BY 1 ORDER BY 1`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	serie := []SerieJour{}
	for rows.Next() {
		var jour time.Time
		var total int
		if err := rows.Scan(&jour, &total); err != nil {
			return nil, err
		}
		serie = append(serie, SerieJour{Jour: jour.Format(time.DateOnly), Inscriptions: total})
	}
	return serie, rows.Err()
}

func (s *service) parEtapeEnrolement(ctx context.Context, depuis string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, `SELECT i."etapeDistante", i."statutDistant", COUNT(*)::int`+depuis+
		` GROUP BY 1, 2 ORDER BY 1 NULLS FIRST, 3 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var etape *int32
		var statut string
		var total int
		if err := rows.Scan(&etape, &statut, &total); err != nil {
			return nil, err
		}
		// L'identifiant sert de valeur au filtre de la liste, qui compare
		// `statutDistant` : un numéro d'étape n'y correspondrait jamais.
		lignes = append(lignes, RepartitionEnrolement{ID: statut, Label: libelleEtapeEnrolement(etape, statut), Inscriptions: total})
	}
	return lignes, rows.Err()
}

// Médiane et non moyenne : un dossier oublié six mois déplacerait la moyenne de
// plusieurs semaines.
// Médiane et moyenne du même écart : la médiane résiste à un dossier oublié
// six mois, la moyenne dit ce que le dispositif coûte en jours cumulés.
func delaiEnrolement(de, a string) string {
	utilisable := de + " IS NOT NULL AND " + a + " IS NOT NULL AND " + a + " >= " + de
	ecart := `EXTRACT(EPOCH FROM (` + a + ` - ` + de + `)) / 86400.0`
	return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ` + ecart + `)` +
		` FILTER (WHERE ` + utilisable + `)::float8,` +
		` AVG(` + ecart + `) FILTER (WHERE ` + utilisable + `)::float8,` +
		` COUNT(*) FILTER (WHERE ` + utilisable + `)::int`
}

func (s *service) delaisEnrolement(ctx context.Context, depuis string, args []any) ([]DelaiMedian, error) {
	var m1, a1, m2, a2 *float64
	var n1, n2 int
	requete := "SELECT " + delaiEnrolement(`i."inscriteLe"`, `i."soumiseLe"`) + ", " +
		delaiEnrolement(`i."soumiseLe"`, `i."decideeLe"`) + depuis
	if err := s.Pool.QueryRow(ctx, requete, args...).Scan(&m1, &a1, &n1, &m2, &a2, &n2); err != nil {
		return nil, err
	}
	delais := []DelaiMedian{
		{Leg: "INSCRIPTION_TO_SOUMISSION", Label: "Inscription vers dossier soumis", Sample: n1},
		{Leg: "SOUMISSION_TO_DECISION", Label: "Dossier soumis vers décision", Sample: n2},
	}
	if n1 > 0 {
		delais[0].MedianDays, delais[0].MoyenneDays = joursArrondis(m1), joursArrondis(a1)
	}
	if n2 > 0 {
		delais[1].MedianDays, delais[1].MoyenneDays = joursArrondis(m2), joursArrondis(a2)
	}
	return delais, nil
}

const methodesEnrolement = "APPOINTMENT:RDV CPI,PHYSICAL:RDV CPI,PLATFORM:Plateforme en ligne,PLATEFORME_EN_LIGNE:Plateforme en ligne," +
	"VOICE_OR_ELECTRONIC_MESSAGING:Mail,MAIL:Mail,WHATSAPP:WhatsApp,RDV_CPI:RDV CPI"

func libelleMethodeEnrolement(methode string) string {
	for _, paire := range strings.Split(methodesEnrolement, ",") {
		if code, libelle, _ := strings.Cut(paire, ":"); code == methode {
			return libelle
		}
	}
	return methode
}

func (s *service) parMethodeEnrolement(ctx context.Context, filtres string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, `SELECT p."enrollmentMethod"::text, COUNT(*)::int`+
		` FROM "inscriptions_plateforme" i INNER JOIN "prospects" p ON p."id" = i."prospectId"`+
		` WHERE i."projet" = $1::"Projet" AND p."enrollmentMethod" IS NOT NULL AND `+filtres+
		` GROUP BY 1 ORDER BY 2 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var methode string
		var total int
		if err := rows.Scan(&methode, &total); err != nil {
			return nil, err
		}
		lignes = append(lignes, RepartitionEnrolement{ID: methode, Label: libelleMethodeEnrolement(methode), Inscriptions: total})
	}
	return lignes, rows.Err()
}
