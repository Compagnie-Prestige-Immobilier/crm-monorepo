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
	"github.com/jackc/pgx/v5/pgtype"
)

type versementInput struct {
	Date    string `json:"date" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
	Montant int64  `json:"montant" minimum:"1"`
}

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
	NombreEcheances  *int32 `json:"nombreEcheances,omitempty" minimum:"1"`
	PeriodiciteMois  int32  `json:"periodiciteMois,omitempty" enum:"1,2,3"`
	JourVersement    *int32 `json:"jourVersement,omitempty" enum:"5,10,15"`
	PremierVersement string `json:"premierVersement,omitempty" pattern:"^(\\d{4}-\\d{2}-\\d{2})?$"`
	MarquerSoldee    bool   `json:"marquerSoldee,omitempty"`
	Acompte          int64  `json:"acompte" minimum:"0"`
	PartProprietaire *int64 `json:"partProprietaire,omitempty" minimum:"0"`
	PartApporteur    *int64 `json:"partApporteur,omitempty" minimum:"0"`
	PartCpi          *int64 `json:"partCpi,omitempty"`
	IdentiteClient
}

type IdentiteClient struct {
	Email                  string `json:"email,omitempty" maxLength:"200" pattern:"^([^@\\s]+@[^@\\s]+\\.[^@\\s]+)?$"`
	NumeroCni              string `json:"numeroCni,omitempty" maxLength:"60"`
	DateDelivranceCni      string `json:"dateDelivranceCni,omitempty" pattern:"^(\\d{4}-\\d{2}-\\d{2})?$"`
	AutrePiece             string `json:"autrePiece,omitempty" maxLength:"200"`
	DemeurantA             string `json:"demeurantA,omitempty" maxLength:"200"`
	Profession             string `json:"profession,omitempty" maxLength:"120"`
	AdresseProfessionnelle string `json:"adresseProfessionnelle,omitempty" maxLength:"200"`
	Representant           string `json:"representant,omitempty" maxLength:"200"`
	NomTeleconseiller      string `json:"nomTeleconseiller,omitempty" maxLength:"200"`
	ResponsableClosing     string `json:"responsableClosing,omitempty" maxLength:"200"`
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
	preparee, err := s.preparer(ctx, &in.Body, nil)
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
		apres, err := q.VenteParID(ctx, id)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.creer", "vente", strconv.FormatInt(id, 10), nil, venteDTO(&apres, nil))
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
	preparee, err := s.preparer(ctx, &in.Body, &avant)
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
			ModePaiement: preparee.Vente.ModePaiement, NombreEcheances: preparee.Vente.NombreEcheances,
			PeriodiciteMois: preparee.Vente.PeriodiciteMois, JourVersement: preparee.Vente.JourVersement,
			PremierVersement:   preparee.Vente.PremierVersement,
			SoldeeManuellement: preparee.Vente.SoldeeManuellement,
			Email:              preparee.Vente.Email, NumeroCni: preparee.Vente.NumeroCni,
			DateDelivranceCni: preparee.Vente.DateDelivranceCni, AutrePiece: preparee.Vente.AutrePiece,
			DemeurantA: preparee.Vente.DemeurantA, Profession: preparee.Vente.Profession,
			AdresseProfessionnelle: preparee.Vente.AdresseProfessionnelle,
			Representant:           preparee.Vente.Representant, NomTeleconseiller: preparee.Vente.NomTeleconseiller,
			ResponsableClosing: preparee.Vente.ResponsableClosing,
		}); err != nil {
			return err
		}
		apres, err := q.VenteParID(ctx, id)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.corriger", "vente", in.ID, venteDTO(&avant, nil), venteDTO(&apres, nil))
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
	if err != nil || date.After(time.Now()) || in.Body.Montant <= 0 {
		return nil, socle.Problem(http.StatusBadRequest, "VENTE_VERSEMENT_INVALIDE", "Le versement doit avoir une date passée ou du jour et un montant positif.")
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
		return database.Auditer(ctx, q, acteur, "vente.archiver", "vente", in.ID, venteDTO(&avant, nil), nil)
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
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.RestaurerVente(ctx, id); err != nil {
			return err
		}
		apres, err := q.VenteParID(ctx, id)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur, "vente.restaurer", "vente", in.ID, nil, venteDTO(&apres, nil))
	}); err != nil {
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

// `avant` est la vente corrigée, nil à la création : une correction garde le
// site, le canal et l'échéancier qu'elle avait, même retirés ou incomplets depuis.
func (s *service) preparer(ctx context.Context, in *venteInput, avant *db.Vente) (ventePreparee, error) {
	contexte, err := s.contexte(ctx, in, avant)
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
	echeancier, err := verifierModePaiement(in, avant)
	if err != nil {
		return ventePreparee{}, err
	}
	delivrance, err := dateFacultative(in.DateDelivranceCni)
	if err != nil {
		return ventePreparee{}, err
	}
	sortie := ventePreparee{
		Vente: db.InsererVenteSaisieParams{
			Canal: contexte.canal, DateSouscription: dateSQL(contexte.date), Client: contexte.client,
			Telephone: contexte.telephone, Site: contexte.siteNom, NombreLots: in.NombreLots,
			NumerosLots: strings.TrimSpace(in.NumerosLots), Superficie: strings.TrimSpace(in.Superficie),
			PrixUnitaire: prix, PrixTotal: prix * int64(in.NombreLots), Acompte: in.Acompte,
			Reliquat: prix*int64(in.NombreLots) - in.Acompte, PartProprietaire: proprietaire,
			PartApporteur: apporteur, PartCpi: cpi,
			ModePaiement: echeancier.mode, NombreEcheances: echeancier.nombre,
			PeriodiciteMois: echeancier.periodicite, JourVersement: echeancier.jour,
			PremierVersement: echeancier.premier, SoldeeManuellement: in.MarquerSoldee,
			Email:                  strings.ToLower(strings.TrimSpace(in.Email)),
			NumeroCni:              strings.TrimSpace(in.NumeroCni),
			DateDelivranceCni:      delivrance,
			AutrePiece:             strings.TrimSpace(in.AutrePiece),
			DemeurantA:             strings.TrimSpace(in.DemeurantA),
			Profession:             strings.TrimSpace(in.Profession),
			AdresseProfessionnelle: strings.TrimSpace(in.AdresseProfessionnelle),
			Representant:           strings.TrimSpace(in.Representant),
			NomTeleconseiller:      strings.TrimSpace(in.NomTeleconseiller),
			ResponsableClosing:     strings.TrimSpace(in.ResponsableClosing),
		},
	}
	sortie.TelephoneE164, _ = database.NormaliserTelephone(contexte.telephone, s.Cfg.PhoneRegion)
	return sortie, nil
}

const (
	modeComptant = "COMPTANT"
	modeCredit   = "CREDIT"
)

type echeancier struct {
	mode        string
	nombre      *int32
	periodicite int32
	jour        *int32
	premier     pgtype.Date
}

func verifierModePaiement(in *venteInput, avant *db.Vente) (echeancier, error) {
	mode := strings.ToUpper(strings.TrimSpace(in.ModePaiement))
	if mode == "" {
		mode = modeComptant
	}
	if mode != modeComptant && mode != modeCredit {
		return echeancier{}, socle.Problem(http.StatusBadRequest, "VENTE_MODE_PAIEMENT_INVALIDE", "Choisissez comptant ou crédit.")
	}
	if mode == modeComptant {
		return echeancier{mode: mode, periodicite: 1}, nil
	}
	if in.MarquerSoldee {
		return echeancier{}, socle.Problem(http.StatusBadRequest, "VENTE_SOLDEE_INVALIDE", "Une vente à crédit ne peut être soldée manuellement à cette étape.")
	}
	return echeancierCredit(in, avant)
}

func echeancierCredit(in *venteInput, avant *db.Vente) (echeancier, error) {
	if in.NombreEcheances == nil || *in.NombreEcheances < 1 {
		return echeancier{}, socle.Problem(http.StatusBadRequest, "VENTE_ECHEANCIER_INVALIDE", "Indiquez le nombre d’échéances.")
	}
	periodicite := max(in.PeriodiciteMois, 1)
	sortie := echeancier{mode: modeCredit, nombre: in.NombreEcheances, periodicite: periodicite}
	if in.JourVersement == nil && in.PremierVersement == "" && echeancierAnterieur(avant) {
		return sortie, nil
	}
	premier, err := time.Parse(time.DateOnly, in.PremierVersement)
	if in.JourVersement == nil || err != nil {
		return echeancier{}, socle.Problem(http.StatusBadRequest, "VENTE_ECHEANCIER_INVALIDE",
			"Indiquez le jour de versement et la date du premier versement.")
	}
	sortie.jour, sortie.premier = in.JourVersement, dateSQL(premier)
	return sortie, nil
}

// Un crédit saisi avant l'échéancier n'a ni jour ni premier versement.
func echeancierAnterieur(avant *db.Vente) bool {
	return avant != nil && avant.ModePaiement == modeCredit && avant.JourVersement == nil
}

type venteContexte struct {
	client, telephone, siteNom, canal string
	date                              time.Time
	site                              db.VentesSite
}

func (s *service) contexte(ctx context.Context, in *venteInput, avant *db.Vente) (venteContexte, error) {
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
	site, err := s.siteEtCanalProposes(ctx, siteNom, canal, avant)
	if err != nil {
		return venteContexte{}, err
	}
	return venteContexte{client: client, telephone: telephone, siteNom: siteNom, canal: canal, date: date, site: site}, nil
}

func (s *service) siteEtCanalProposes(ctx context.Context, siteNom, canal string, avant *db.Vente) (db.VentesSite, error) {
	site, err := s.Q.SiteVenteParNom(ctx, siteNom)
	siteConserve := avant != nil && avant.Site == siteNom
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !site.Actif && !siteConserve) {
		return db.VentesSite{}, socle.Problem(http.StatusBadRequest, "VENTE_SITE_INDISPONIBLE", "Ce site n’est plus proposé à la saisie.")
	}
	if err != nil {
		return db.VentesSite{}, err
	}
	canaux, err := s.Q.ListerCanauxVentes(ctx)
	if err != nil {
		return db.VentesSite{}, err
	}
	if !canalActif(canaux, canal) && (avant == nil || avant.Canal != canal) {
		return db.VentesSite{}, socle.Problem(http.StatusBadRequest, "VENTE_CANAL_INDISPONIBLE", "Ce canal n’est plus proposé à la saisie.")
	}
	return site, nil
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

func dateFacultative(texte string) (pgtype.Date, error) {
	if strings.TrimSpace(texte) == "" {
		return pgtype.Date{}, nil
	}
	date, err := time.Parse(time.DateOnly, strings.TrimSpace(texte))
	if err != nil {
		return pgtype.Date{}, socle.Problem(http.StatusBadRequest, "VENTE_DATE_CNI_INVALIDE", "La date de délivrance de la CNI est invalide.")
	}
	return dateSQL(date), nil
}

func parseVenteID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, socle.Problem(http.StatusBadRequest, "VENTES_ID_INVALIDE", "Cette vente est introuvable.")
	}
	return id, nil
}
