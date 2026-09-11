package qualification

import (
	"context"
	"cpi-go/internal/exports"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/socle"
	"log/slog"
	"strings"
	"time"
)

// Méthode d'enrôlement obtenue : le prospect part à l'enrôlement, l'équipe
// et ses copies configurées reçoivent la fiche. L'appel est déjà validé, un
// courriel en échec est tracé dans le journal, jamais remonté au téléconseiller.
func (s *service) signalerEnrolement(ctx context.Context, u *socle.Utilisateur, prospectID string) {
	r, err := s.Q.ProspectPourCourrielEnrolement(ctx, prospectID)
	if err != nil {
		slog.Error("prospect enrôlé : lecture impossible", "prospect", prospectID, "err", err)
		return
	}
	reglages, err := notifications.LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		slog.Error("prospect enrôlé : réglages illisibles", "prospect", prospectID, "err", err)
		return
	}
	projet, coque := "CPI CHUES", "chues"
	if r.Projet == socle.ProjetGrandPublic {
		projet, coque = "CPI GRAND PUBLIC", "grand-public"
	}
	client := strings.TrimSpace(r.Prenom + " " + r.Nom)
	methode := "non précisée"
	if r.Methode != "" {
		methode = r.Methode
		if libelle, connu := exports.ExportLibellesMethode[r.Methode]; connu {
			methode = libelle
		}
	}
	obtenuLe := time.Now()
	if r.EnrollmentCapturedAt != nil {
		obtenuLe = *r.EnrollmentCapturedAt
	}
	chemin := "/" + coque + "/prospects/" + r.ID
	err = notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          notifications.CourrielProspectEnrolement,
		Sujet:         "[" + projet + "] Prospect transmis à l’enrôlement : " + client,
		Destinataires: reglages.Enrolement, Copies: reglages.EnrolementCopies,
		ObjetType: "prospect", ObjetID: r.ID,
		Titre: "Prospect transmis à l’enrôlement",
		Intro: u.FullName + " a obtenu la méthode d’enrôlement « " + methode + " » pour " + client +
			". Le prospect est transmis à l’équipe enrôlement.",
		Lignes: [][2]string{
			{"Client", client},
			{"Téléphone", r.PhoneE164},
			{"Courriel", texteOuNonRenseigne(r.Email)},
			{"Banque", texteOuNonRenseigne(r.BanqueName)},
			{"Méthode d’enrôlement", methode},
			{"Téléconseiller", u.FullName},
			{"Obtenue le", obtenuLe.In(s.Cfg.TimeZone).Format("02/01/2006 à 15:04")},
		},
		Lien: socle.Env("PUBLIC_WEB_URL", "") + chemin, LibelleLien: "Voir le prospect dans CPI GO",
		NomPieceJointe: "prospect-enrolement-" + r.ID + ".pdf",
	})
	if err != nil {
		slog.Error("prospect enrôlé : courriel non tracé", "prospect", prospectID, "err", err)
	}
}

func texteOuNonRenseigne(v *string) string {
	if v == nil || strings.TrimSpace(*v) == "" {
		return "non renseigné"
	}
	return *v
}
