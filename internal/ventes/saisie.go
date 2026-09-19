package ventes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type versementInput struct {
	Date    string `json:"date" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
	Montant int64  `json:"montant" minimum:"1"`
}

const (
	champClient = "client"
	champSite   = "site"
)

type venteInput struct {
	Canal            string `json:"canal" minLength:"1" maxLength:"80"`
	DateSouscription string `json:"dateSouscription" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
	Client           string `json:"client" minLength:"2" maxLength:"200"`
	Telephone        string `json:"telephone" maxLength:"40"`
	Site             string `json:"site" minLength:"1" maxLength:"120"`
	NombreLots       int32  `json:"nombreLots" minimum:"1"`
	NumerosLots      string `json:"numerosLots" maxLength:"500"`
	Superficie       string `json:"superficie" maxLength:"80"`
	PrixUnitaire     *int64 `json:"prixUnitaire,omitempty" minimum:"0"`
	ModePaiement     string `json:"modePaiement" enum:"COMPTANT,CREDIT"`
	NombreMois       *int32 `json:"nombreMois,omitempty" minimum:"1"`
	MarquerSoldee    bool   `json:"marquerSoldee,omitempty"`
	Acompte          int64  `json:"acompte" minimum:"0"`
	PartProprietaire *int64 `json:"partProprietaire,omitempty" minimum:"0"`
	PartApporteur    *int64 `json:"partApporteur,omitempty" minimum:"0"`
	PartCpi          *int64 `json:"partCpi,omitempty"`
}

type creerVenteInput struct {
	Body venteInput
}

type modifierVenteInput struct {
	ID   string `path:"id"`
	Body venteInput
}

type ajouterVersementInput struct {
	ID   string `path:"id"`
	Body versementInput
}

type venteIDInput struct {
	ID string `path:"id"`
}

type VenteOutput struct {
	Body VenteDTO
}

type ventePreparee struct {
	Vente         db.InsererVenteSaisieParams
	TelephoneE164 string
}

func (s *service) creer(ctx context.Context, in *creerVenteInput) (*VenteOutput, error) {
	preparee, err := s.preparer(ctx, &in.Body)
	if err != nil {
		return nil, err
	}
	numero, err := s.Q.ProchainNumeroVente(ctx)
	if err != nil {
		return nil, err
	}
	preparee.Vente.Numero = numero
	var id int64
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		id, err = q.InsererVenteSaisie(ctx, preparee.Vente)
		if err != nil {
			return err
		}
		if preparee.TelephoneE164 != "" {
			if err := marquerProspectsVendus(ctx, q, acteur, []string{preparee.TelephoneE164}); err != nil {
				return err
			}
		}
		return database.Auditer(ctx, q, acteur, "vente.creer", "vente", strconv.FormatInt(id, 10),
			map[string]any{champClient: preparee.Vente.Client, champSite: preparee.Vente.Site}, nil)
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortie(ctx, id)
}

func (s *service) corriger(ctx context.Context, in *modifierVenteInput) (*VenteOutput, error) {
	id, err := strconv.ParseInt(in.ID, 10, 64)
	if err != nil {
		return nil, socle.Problem(http.StatusBadRequest, "VENTES_ID_INVALIDE", "Cette vente est introuvable.")
	}
	avant, err := s.Q.VenteParID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_NOT_FOUND", "Vente introuvable.")
	}
	if err != nil {
		return nil, err
	}
	preparee, err := s.preparer(ctx, &in.Body)
	if err != nil {
		return nil, err
	}
	preparee.Vente.Numero = avant.Numero
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		versements, err := q.TotalVersementsVente(ctx, id)
		if err != nil {
			return err
		}
		if err := q.ModifierVente(ctx, db.ModifierVenteParams{
			ID: id, Canal: preparee.Vente.Canal, DateSouscription: preparee.Vente.DateSouscription,
			Client: preparee.Vente.Client, Telephone: preparee.Vente.Telephone, Site: preparee.Vente.Site,
			NombreLots: preparee.Vente.NombreLots, NumerosLots: preparee.Vente.NumerosLots,
			Superficie: preparee.Vente.Superficie, PrixUnitaire: preparee.Vente.PrixUnitaire,
			PrixTotal: preparee.Vente.PrixTotal, Acompte: preparee.Vente.Acompte,
			Reliquat:         preparee.Vente.PrixTotal - preparee.Vente.Acompte - versements,
			PartProprietaire: preparee.Vente.PartProprietaire,
			PartApporteur:    preparee.Vente.PartApporteur, PartCpi: preparee.Vente.PartCpi,
			ModePaiement: preparee.Vente.ModePaiement, NombreMois: preparee.Vente.NombreMois,
			SoldeeManuellement: preparee.Vente.SoldeeManuellement,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.corriger", "vente", in.ID,
			map[string]any{champClient: avant.Client, champSite: avant.Site},
			map[string]any{champClient: preparee.Vente.Client, champSite: preparee.Vente.Site})
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortie(ctx, id)
}

func (s *service) ajouterVersement(ctx context.Context, in *ajouterVersementInput) (*VenteOutput, error) {
	id, err := parseVenteID(in.ID)
	if err != nil {
		return nil, err
	}
	vente, err := s.Q.VenteParID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_NOT_FOUND", "Vente introuvable.")
	}
	if err != nil {
		return nil, err
	}
	date, err := time.Parse(time.DateOnly, in.Body.Date)
	if err != nil || in.Body.Montant <= 0 {
		return nil, socle.Problem(http.StatusBadRequest, "VENTE_VERSEMENT_INVALIDE", "Le versement doit avoir une date valide et un montant positif.")
	}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		rang, err := q.ProchainRangVersement(ctx, id)
		if err != nil {
			return err
		}
		if err := q.InsererVersementVente(ctx, db.InsererVersementVenteParams{
			VenteId: id, Rang: rang, Date: dateSQL(date), Montant: in.Body.Montant,
		}); err != nil {
			return err
		}
		totalVersements, err := q.TotalVersementsVente(ctx, id)
		if err != nil {
			return err
		}
		if err := q.ModifierReliquatVente(ctx, db.ModifierReliquatVenteParams{
			ID: id, Reliquat: vente.PrixTotal - vente.Acompte - totalVersements,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.versement_ajouter", "vente", in.ID,
			map[string]any{"montant": in.Body.Montant}, map[string]any{
				"reliquat": vente.PrixTotal - vente.Acompte - totalVersements,
			})
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortie(ctx, id)
}

func (s *service) archiver(ctx context.Context, in *venteIDInput) (*struct{}, error) {
	id, err := parseVenteID(in.ID)
	if err != nil {
		return nil, err
	}
	avant, err := s.Q.VenteParID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "VENTE_NOT_FOUND", "Vente introuvable.")
	}
	if err != nil {
		return nil, err
	}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.ArchiverVente(ctx, db.ArchiverVenteParams{ID: id, ArchiveeParId: &acteur}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.archiver", "vente", in.ID,
			map[string]any{champClient: avant.Client, champSite: avant.Site}, nil)
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return &struct{}{}, nil
}

func (s *service) restaurer(ctx context.Context, in *venteIDInput) (*VenteOutput, error) {
	id, err := parseVenteID(in.ID)
	if err != nil {
		return nil, err
	}
	if err := s.Q.RestaurerVente(ctx, id); err != nil {
		return nil, err
	}
	s.Live.Emettre("ventes")
	return s.sortie(ctx, id)
}

func (s *service) sortie(ctx context.Context, id int64) (*VenteOutput, error) {
	vente, err := s.Q.VenteParID(ctx, id)
	if err != nil {
		return nil, err
	}
	versements, err := s.Q.ListerVersementsVentes(ctx)
	if err != nil {
		return nil, err
	}
	parVente := map[int64][]VersementDTO{}
	for _, versement := range versements {
		if versement.VenteId == id {
			parVente[id] = append(parVente[id], VersementDTO{Date: jour(versement.Date), Montant: versement.Montant})
		}
	}
	return &VenteOutput{Body: venteDTO(&vente, parVente[id])}, nil
}

func (s *service) preparer(ctx context.Context, in *venteInput) (ventePreparee, error) {
	contexte, err := s.contexte(ctx, in)
	if err != nil {
		return ventePreparee{}, err
	}
	prix, err := prixVente(in, &contexte.site)
	if err != nil {
		return ventePreparee{}, err
	}
	proprietaire, apporteur, cpi := partsVente(in, &contexte.site, prix*int64(in.NombreLots))
	if in.Acompte < 0 {
		return ventePreparee{}, socle.Problem(http.StatusBadRequest, "VENTE_ACOMPTE_INVALIDE", "L’acompte ne peut pas être négatif.")
	}
	mode, err := verifierModePaiement(in)
	if err != nil {
		return ventePreparee{}, err
	}
	nombreMois := in.NombreMois
	if mode == modeComptant {
		nombreMois = nil
	}
	sortie := ventePreparee{
		Vente: db.InsererVenteSaisieParams{
			Canal: contexte.canal, DateSouscription: dateSQL(contexte.date), Client: contexte.client,
			Telephone: contexte.telephone, Site: contexte.siteNom, NombreLots: in.NombreLots,
			NumerosLots: strings.TrimSpace(in.NumerosLots), Superficie: strings.TrimSpace(in.Superficie),
			PrixUnitaire: prix, PrixTotal: prix * int64(in.NombreLots), Acompte: in.Acompte,
			Reliquat: prix*int64(in.NombreLots) - in.Acompte, PartProprietaire: proprietaire,
			PartApporteur: apporteur, PartCpi: cpi,
			ModePaiement: mode, NombreMois: nombreMois, SoldeeManuellement: in.MarquerSoldee,
		},
	}
	sortie.TelephoneE164, _ = database.NormaliserTelephone(contexte.telephone, s.Cfg.PhoneRegion)
	return sortie, nil
}

const (
	modeComptant = "COMPTANT"
	modeCredit   = "CREDIT"
)

func verifierModePaiement(in *venteInput) (string, error) {
	mode := strings.ToUpper(strings.TrimSpace(in.ModePaiement))
	if mode == "" {
		mode = modeComptant
	}
	if mode != modeComptant && mode != modeCredit {
		return "", socle.Problem(http.StatusBadRequest, "VENTE_MODE_PAIEMENT_INVALIDE", "Choisissez comptant ou crédit.")
	}
	if mode == modeCredit && (in.NombreMois == nil || *in.NombreMois < 1) {
		return "", socle.Problem(http.StatusBadRequest, "VENTE_DUREE_CREDIT_INVALIDE", "Indiquez le nombre de mois du crédit.")
	}
	if mode == modeCredit && in.MarquerSoldee {
		return "", socle.Problem(http.StatusBadRequest, "VENTE_SOLDEE_INVALIDE", "Une vente à crédit ne peut être soldée manuellement à cette étape.")
	}
	return mode, nil
}

type venteContexte struct {
	client, telephone, siteNom, canal string
	date                              time.Time
	site                              db.VentesSite
}

func (s *service) contexte(ctx context.Context, in *venteInput) (venteContexte, error) {
	client := strings.Join(strings.Fields(strings.ToUpper(strings.TrimSpace(in.Client))), " ")
	telephone := strings.TrimSpace(in.Telephone)
	siteNom := strings.ToUpper(strings.TrimSpace(in.Site))
	canal := strings.TrimSpace(in.Canal)
	if client == "" || telephone == "" || siteNom == "" || canal == "" {
		return venteContexte{}, socle.Problem(http.StatusBadRequest, "VENTE_CHAMPS_REQUIS", "Client, téléphone, site et canal sont obligatoires.")
	}
	date, err := time.Parse(time.DateOnly, in.DateSouscription)
	if err != nil {
		return venteContexte{}, socle.Problem(http.StatusBadRequest, "VENTE_DATE_INVALIDE", "La date de souscription est invalide.")
	}
	site, err := s.Q.SiteVenteParNom(ctx, siteNom)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !site.Actif) {
		return venteContexte{}, socle.Problem(http.StatusBadRequest, "VENTE_SITE_INDISPONIBLE", "Ce site n’est plus proposé à la saisie.")
	}
	if err != nil {
		return venteContexte{}, err
	}
	canaux, err := s.Q.ListerCanauxVentes(ctx)
	if err != nil {
		return venteContexte{}, err
	}
	if !canalActif(canaux, canal) {
		return venteContexte{}, socle.Problem(http.StatusBadRequest, "VENTE_CANAL_INDISPONIBLE", "Ce canal n’est plus proposé à la saisie.")
	}
	return venteContexte{client: client, telephone: telephone, siteNom: siteNom, canal: canal, date: date, site: site}, nil
}

func canalActif(canaux []db.VentesCanaux, libelle string) bool {
	for i := range canaux {
		if canaux[i].Actif && canaux[i].Libelle == libelle {
			return true
		}
	}
	return false
}

func prixVente(in *venteInput, site *db.VentesSite) (int64, error) {
	if in.NombreLots < 1 || int64(in.NombreLots) > math.MaxInt32 {
		return 0, socle.Problem(http.StatusBadRequest, "VENTE_LOTS_INVALIDES", "Le nombre de lots doit être positif.")
	}
	prix := site.PrixUnitaireDefaut
	if in.PrixUnitaire != nil {
		prix = *in.PrixUnitaire
	}
	if prix <= 0 || int64(in.NombreLots) > math.MaxInt64/prix {
		return 0, socle.Problem(http.StatusBadRequest, "VENTE_PRIX_INVALIDE", "Renseignez un prix unitaire positif.")
	}
	return prix, nil
}

func partsVente(in *venteInput, site *db.VentesSite, total int64) (proprietaire, apporteur, cpi int64) {
	proprietaire = site.PartProprietaireParLot * int64(in.NombreLots)
	if in.PartProprietaire != nil {
		proprietaire = *in.PartProprietaire
	}
	apporteur = partApporteur(site, proprietaire, in.NombreLots)
	if in.PartApporteur != nil {
		apporteur = *in.PartApporteur
	}
	cpi = total - proprietaire - apporteur
	if in.PartCpi != nil {
		cpi = *in.PartCpi
	}
	return proprietaire, apporteur, cpi
}

func partApporteur(site *db.VentesSite, partProprietaire int64, lots int32) int64 {
	switch site.PartApporteurMode {
	case "POURCENTAGE_PROPRIETAIRE":
		return partProprietaire * site.PartApporteurValeur / 100
	case "MONTANT_PAR_LOT":
		return site.PartApporteurValeur * int64(lots)
	case "MONTANT_TOTAL":
		return site.PartApporteurValeur
	default:
		return 0
	}
}

func parseVenteID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, socle.Problem(http.StatusBadRequest, "VENTES_ID_INVALIDE", "Cette vente est introuvable.")
	}
	return id, nil
}
