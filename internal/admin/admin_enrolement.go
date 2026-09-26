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
	"net/http"
	"slices"
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
	MotifNegatif       *string    `json:"motifNegatif"`
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
		ProspectID: r.ProspectId, DernierTirageAt: r.DernierTirageAt, MotifNegatif: r.MotifNegatif,
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
	Negatif          string `query:"negatif" enum:"true,false"`
	InclureDisparues string `query:"inclureDisparues" enum:"true,false"`
	// Les étages de l'entonnoir : la plateforme ne les nomme pas, ils se
	// déduisent de l'étape et des dates.
	Avancement string `query:"avancement" enum:"ouvert,soumis,decide,negatif"`
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
		Negatif:  booleenAdmin(in.Negatif),
		DateFrom: debut, DateTo: fin, Search: texteAdmin(in.Search),
		Avancement: texteAdmin(in.Avancement),
	}
	total, err := s.Q.CountInscriptions(ctx, filtres)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListInscriptions(ctx, db.ListInscriptionsParams{
		Projet: filtres.Projet, InclureDisparues: filtres.InclureDisparues, Statut: filtres.Statut,
		Rapproche: filtres.Rapproche, Negatif: filtres.Negatif, DateFrom: filtres.DateFrom, DateTo: filtres.DateTo,
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

func inscriptionLieeAUnDossier() error {
	return socle.Problem(http.StatusConflict, "INSCRIPTION_LIEE_A_UN_DOSSIER",
		"Cette inscription porte un dossier bancaire ouvert : elle ne peut pas être supprimée.")
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
		DernierTirageAt: row.DernierTirageAt, MotifNegatif: row.MotifNegatif,
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
	acteur := socle.UtilisateurCourant(ctx)
	var n int64
	// Le miroir purgé se COMPTE : recopier chaque inscription rendrait le
	// journal illisible, et le tirage suivant les relit toutes.
	err := s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		supprimees, err := q.PurgerInscriptions(ctx, db.Projet(in.Projet))
		if err != nil {
			return err
		}
		n = supprimees
		return database.Auditer(ctx, q, acteur.ID, "enrolement.purge", "enrolement", in.Projet,
			map[string]any{"projet": in.Projet, "supprimees": supprimees}, nil)
	})
	if err != nil {
		return nil, err
	}
	out := &SuppressionInscriptionsOutput{}
	out.Body.Supprimees = n
	return out, nil
}

func (s *service) supprimerInscription(ctx context.Context, in *InscriptionInput) (*SuppressionInscriptionsOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	existante, err := s.Q.GetInscription(ctx, db.GetInscriptionParams{ID: in.ID, Projet: db.Projet(in.Projet)})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, inscriptionIntrouvable()
	}
	if err != nil {
		return nil, err
	}
	avant := map[string]any{
		"projet": in.Projet, "identifiantDistant": existante.IdentifiantDistant,
		"nom": existante.Nom, "prenom": existante.Prenom, "phoneE164": existante.PhoneE164,
		"statutDistant": existante.StatutDistant, "prospectId": existante.ProspectId,
	}
	var n int64
	err = s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		supprimees, err := q.SupprimerInscription(ctx, db.SupprimerInscriptionParams{ID: in.ID, Projet: db.Projet(in.Projet)})
		if err != nil {
			return err
		}
		if supprimees == 0 {
			return inscriptionLieeAUnDossier()
		}
		n = supprimees
		return database.Auditer(ctx, q, acteur.ID, "enrolement.inscription_delete", "inscription", in.ID, avant, nil)
	})
	if err != nil {
		return nil, err
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
	valeurs := reglagesEnrolement{FrequenceMinutes: frequenceDefaut, StatutsComplets: []string{}}
	var stockees reglagesEnrolement
	if json.Unmarshal([]byte(valeur), &stockees) != nil {
		return valeurs
	}
	if stockees.FrequenceMinutes >= frequenceMin && stockees.FrequenceMinutes <= frequenceMax {
		valeurs.FrequenceMinutes = stockees.FrequenceMinutes
	}
	valeurs.RepriseDepuis, valeurs.DernierTirage = stockees.RepriseDepuis, stockees.DernierTirage
	if stockees.StatutsComplets != nil {
		valeurs.StatutsComplets = stockees.StatutsComplets
	}
	return valeurs
}

func (s *service) reglagesTirage(ctx context.Context, projet string) (reglagesEnrolement, *time.Time, error) {
	ligne, existe, err := s.reglage(ctx, cleReglages(projet))
	if err != nil || !existe {
		return reglagesStockes(""), nil, err
	}
	return reglagesStockes(ligne.Value), &ligne.UpdatedAt, nil
}

func ecrireReglagesTirage(ctx context.Context, q *db.Queries, projet string, valeurs reglagesEnrolement, acteurID *string) error {
	brut, err := json.Marshal(valeurs)
	if err != nil {
		return err
	}
	_, err = q.UpsertSetting(ctx, db.UpsertSettingParams{Key: cleReglages(projet), Value: string(brut), UpdatedById: acteurID})
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

// Le dernier bilan de tirage vit dans la même clé : la trace ne garde que ce
// qu'un humain a réglé.
func reglagesJournal(r *reglagesEnrolement) map[string]any {
	return map[string]any{
		"frequenceMinutes": r.FrequenceMinutes, "repriseDepuis": r.RepriseDepuis,
		"statutsComplets": r.StatutsComplets,
	}
}

func (s *service) ecrireReglagesEnrolement(ctx context.Context, in *EcrireReglagesInput) (*ReglagesOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	valeurs, _, err := s.reglagesTirage(ctx, in.Projet)
	if err != nil {
		return nil, err
	}
	avant := valeurs
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
	if err := s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if err := ecrireReglagesTirage(ctx, q, in.Projet, valeurs, &acteur.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "enrolement.reglages", "enrolement", in.Projet,
			reglagesJournal(&avant), reglagesJournal(&valeurs))
	}); err != nil {
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
	acteur := socle.UtilisateurCourant(ctx)
	bilan := s.tirer(ctx, in.Projet)
	// Le tirage écrit page par page, dans autant de transactions : sa trace ne
	// peut que suivre le bilan, une fois la lecture de la plateforme terminée.
	if err := database.Auditer(ctx, s.Q, acteur.ID, "enrolement.tirage", "enrolement", in.Projet, nil,
		map[string]any{
			"dureeMs": bilan.DureeMs, "lus": bilan.Lus, "crees": bilan.Crees,
			"misAJour": bilan.MisAJour, "rapproches": bilan.Rapproches,
			"disparues": bilan.Disparues, "erreur": bilan.Erreur,
		}); err != nil {
		return nil, err
	}
	out := &TirageOutput{}
	out.Body.Projet = in.Projet
	out.Body.DureeMs, out.Body.Lus, out.Body.Crees = bilan.DureeMs, bilan.Lus, bilan.Crees
	out.Body.MisAJour, out.Body.Rapproches, out.Body.Disparues = bilan.MisAJour, bilan.Rapproches, bilan.Disparues
	out.Body.Erreur = bilan.Erreur
	return out, nil
}

// Chaque minute : ne fait rien tant qu'aucune plateforme n'est configurée.
func (s *service) tirerEnrolement(ctx context.Context) error {
	var echecs []error
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
		// Le bilan était jeté : un 401 de la plateforme ou une panne réseau
		// comptaient comme un passage réussi.
		avecDelai, annuler := context.WithTimeout(ctx, webhookTirageDelai)
		bilan := s.tirer(avecDelai, projet)
		annuler()
		if bilan.Erreur != nil {
			echecs = append(echecs, fmt.Errorf("%s : %s", projet, *bilan.Erreur))
		}
	}
	return errors.Join(echecs...)
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
		if err := ecrireReglagesTirage(ctx, s.Q, projet, valeurs, nil); err != nil {
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

	index, err := s.indexerProspects(ctx, retenues)
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
		candidat := index.choisir(ligne.PhoneE164, ligne.Email)
		if candidat != nil {
			bilan.Rapproches++
		}
		if slices.Contains(connus, ligne.IdentifiantDistant) {
			bilan.MisAJour++
		} else {
			bilan.Crees++
		}
		if err := s.deposerInscription(ctx, projet, ligne, candidat, tirageAt); err != nil {
			return bilan, err
		}
		vus = append(vus, ligne.IdentifiantDistant)
	}
	disparues, err := s.marquerDisparues(ctx, projet, vus, len(connus), valeurs.RepriseDepuis, tirageAt)
	bilan.Disparues = disparues
	if err != nil {
		return bilan, err
	}
	return bilan, s.appliquerPurges(ctx, projet, base, jeton)
}

func (s *service) appliquerPurges(ctx context.Context, projet, base, jeton string) error {
	purges, err := purgesPlateforme(ctx, projet, base, jeton)
	if err != nil || len(purges) == 0 {
		return err
	}
	return s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		params := db.EffacerInscriptionsPurgeesParams{Projet: db.Projet(projet), Identifiants: purges}
		if err := q.EffacerInscriptionsPurgees(ctx, params); err != nil {
			return err
		}
		return q.ViderInscriptionsPurgees(ctx, db.ViderInscriptionsPurgeesParams(params))
	})
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
		MotifNegatif: ligne.MotifNegatif,
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

func (s *service) indexerProspects(ctx context.Context, lignes []inscriptionDistante) (indexProspects, error) {
	index := indexProspects{parTelephone: map[string][]candidatProspect{}, parEmail: map[string][]candidatProspect{}}
	telephones, emails := cles(lignes)
	if len(telephones) > 0 {
		rows, err := s.Q.CandidatsParTelephone(ctx, telephones)
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
		rows, err := s.Q.CandidatsParEmail(ctx, emails)
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
	MotifNegatif       *string
}
