package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *service) tirerLigne(ctx context.Context, projet, base string, ligne *inscriptionDistante, candidat *string,
	connus []string, tirageAt time.Time, bilan *BilanTirage,
) error {
	prospectID, err := s.rattacherPlateforme(ctx, projet, base, ligne, candidat, tirageAt)
	if err != nil {
		return err
	}
	if prospectID != nil {
		bilan.Rapproches++
	}
	if slices.Contains(connus, ligne.IdentifiantDistant) {
		bilan.MisAJour++
	} else {
		bilan.Crees++
	}
	return s.deposerInscription(ctx, projet, ligne, prospectID, tirageAt)
}

// Une inscription rapprochée fait de la fiche une fiche plateforme, qui sort
// des campagnes à l'instant (docs/decisions/fiches-plateforme.md). Sans fiche
// au numéro, une fiche neuve naît pour que les CCP voient chaque inscrit.
func (s *service) rattacherPlateforme(ctx context.Context, projet, base string, ligne *inscriptionDistante, prospectID *string, quand time.Time) (*string, error) {
	depuis := quand
	if ligne.InscriteLe != nil {
		depuis = *ligne.InscriteLe
	}
	if prospectID == nil {
		id, err := s.creerProspectPlateforme(ctx, projet, base, ligne, depuis)
		if err != nil || id == "" {
			return nil, err
		}
		prospectID = &id
	}
	marquee, err := s.Q.MarquerProspectPlateforme(ctx, db.MarquerProspectPlateformeParams{ID: *prospectID, Depuis: depuis})
	if err != nil || marquee == 0 {
		return prospectID, err
	}
	return prospectID, s.retirerDesCampagnes(ctx, *prospectID)
}

// Vide sans erreur : l'inscription n'a pas de numéro, ou aucun administrateur ne peut porter la fiche.
func (s *service) creerProspectPlateforme(ctx context.Context, projet, base string, ligne *inscriptionDistante, depuis time.Time) (string, error) {
	if ligne.PhoneE164 == nil {
		return "", nil
	}
	demandeur, err := s.Q.ImportDemandeurSysteme(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		slog.Warn("fiche plateforme non créée : aucun administrateur actif", "projet", projet)
		return "", nil
	}
	if err != nil {
		return "", err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	nom := ligne.Nom
	if nom == "" {
		nom = "Inscription plateforme"
	}
	cree, err := s.Q.CreerProspectPlateforme(ctx, db.CreerProspectPlateformeParams{
		ID: id.String(), Nom: nom, Prenom: ligne.Prenom, PhoneE164: ligne.PhoneE164, Email: ligne.Email,
		CreatedByID: demandeur, Depuis: depuis, Projet: db.Projet(projet), OriginLabel: hoteDe(base),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		existant, err := s.Q.ProspectParTelephone(ctx, ligne.PhoneE164)
		if err != nil {
			return "", err
		}
		return existant.ID, nil
	}
	if err != nil {
		return "", err
	}
	parcours, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	_, err = s.Q.OuvrirParcours(ctx, db.OuvrirParcoursParams{ID: parcours.String(), ProspectID: cree, Projet: projet})
	return cree, err
}

func (s *service) retirerDesCampagnes(ctx context.Context, prospectID string) error {
	demandeur, err := s.Q.ImportDemandeurSysteme(ctx)
	if err != nil {
		return err
	}
	return database.PasserAuxCCP(ctx, s.Q, demandeur, prospectID)
}

// Un rappel promis sur une fiche plateforme quand aucun CCP n'existait encore
// est resté chez le téléconseiller : chaque tirage le rattrape dès qu'un CCP est là.
func (s *service) remettreRappelsPlateformeAuxCCP(ctx context.Context) error {
	prospects, err := s.Q.ProspectsPlateformeAuxRappelsHorsCCP(ctx)
	if err != nil {
		return err
	}
	for _, prospectID := range prospects {
		if err := s.retirerDesCampagnes(ctx, prospectID); err != nil {
			return err
		}
	}
	if len(prospects) > 0 {
		slog.Info("rappels plateforme remis aux CCP", "fiches", len(prospects))
	}
	return nil
}

const cleObjectifCCP = "plateforme.objectifAppelsParJour"

type PlateformeCCP struct {
	ID              string  `json:"id"`
	FullName        string  `json:"fullName"`
	AppelsJour      int     `json:"appelsJour"`
	JointsJour      int     `json:"jointsJour"`
	AppelsSemaine   int     `json:"appelsSemaine"`
	RappelsEnAttente int    `json:"rappelsEnAttente"`
	DernierAppel    *string `json:"dernierAppel"`
}

type PlateformeEquipeOutput struct {
	Body struct {
		ObjectifAppelsParJour int             `json:"objectifAppelsParJour" doc:"Appels attendus par CCP et par jour. Zéro : aucun objectif."`
		Ccps                  []PlateformeCCP `json:"ccps"`
	}
}

type PlateformeObjectifInput struct {
	Body struct {
		ObjectifAppelsParJour int `json:"objectifAppelsParJour" minimum:"0" maximum:"1000"`
	}
}

func (s *service) objectifCCP(ctx context.Context) (int, error) {
	ligne, existe, err := s.reglage(ctx, cleObjectifCCP)
	if err != nil || !existe {
		return 0, err
	}
	objectif, _ := strconv.Atoi(ligne.Value)
	return max(0, objectif), nil
}

// La journée et la semaine se comptent à l'heure de Dakar, du lundi.
func (s *service) equipePlateforme(ctx context.Context, _ *struct{}) (*PlateformeEquipeOutput, error) {
	local := time.Now().In(s.Cfg.TimeZone)
	debutJour := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, s.Cfg.TimeZone)
	depuisLundi := (int(local.Weekday()) + 6) % 7
	debutSemaine := debutJour.AddDate(0, 0, -depuisLundi)
	rows, err := s.Q.EquipeCCP(ctx, db.EquipeCCPParams{DebutJour: debutJour.UTC(), DebutSemaine: debutSemaine.UTC()})
	if err != nil {
		return nil, err
	}
	objectif, err := s.objectifCCP(ctx)
	if err != nil {
		return nil, err
	}
	out := &PlateformeEquipeOutput{}
	out.Body.ObjectifAppelsParJour = objectif
	out.Body.Ccps = make([]PlateformeCCP, 0, len(rows))
	for _, r := range rows {
		// 1970 : jamais appelé, la requête remplace le NULL que sqlc ne sait pas typer.
		var dernier *string
		if r.DernierAppel.Year() > 1970 {
			iso := r.DernierAppel.UTC().Format(time.RFC3339)
			dernier = &iso
		}
		out.Body.Ccps = append(out.Body.Ccps, PlateformeCCP{
			ID: r.ID, FullName: r.FullName, AppelsJour: int(r.AppelsJour), JointsJour: int(r.JointsJour),
			AppelsSemaine: int(r.AppelsSemaine), RappelsEnAttente: int(r.RappelsEnAttente), DernierAppel: dernier,
		})
	}
	return out, nil
}

func (s *service) ecrireObjectifCCP(ctx context.Context, in *PlateformeObjectifInput) (*PlateformeEquipeOutput, error) {
	acteur := socle.UtilisateurCourant(ctx).ID
	if _, err := s.Q.UpsertSetting(ctx, db.UpsertSettingParams{
		Key: cleObjectifCCP, Value: strconv.Itoa(in.Body.ObjectifAppelsParJour), UpdatedById: &acteur,
	}); err != nil {
		return nil, err
	}
	return s.equipePlateforme(ctx, nil)
}

func monterPlateforme(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "getPlateformeEquipe", Method: http.MethodGet, Path: "/api/v1/plateforme/equipe"}, s.equipePlateforme)
	huma.Register(api, huma.Operation{OperationID: "putPlateformeObjectif", Method: http.MethodPut, Path: "/api/v1/plateforme/objectif"}, s.ecrireObjectifCCP)
}

func hoteDe(base string) *string {
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return nil
	}
	return &u.Host
}
