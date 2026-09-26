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

// L'appel est déjà validé : un courriel d'enrôlement en échec est tracé au journal,
// jamais remonté au téléconseiller. Une liste de destinataires vide coupe ce courriel.
func (s *service) signalerEnrolement(ctx context.Context, u *socle.Utilisateur, prospectID string) {
	reglages, err := notifications.LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		slog.Error("prospect enrôlé : réglages illisibles", "prospect", prospectID, "err", err)
		return
	}
	if len(reglages.Enrolement.Destinataires) == 0 {
		return
	}
	r, err := s.Q.ProspectPourCourrielEnrolement(ctx, prospectID)
	if err != nil {
		slog.Error("prospect enrôlé : lecture impossible", "prospect", prospectID, "err", err)
		return
	}
	projet, coque := "CPI CHUES", "chues"
	if r.Projet == socle.ProjetGrandPublic {
		projet, coque = "CPI GRAND PUBLIC", "grand-public"
	}
	client := strings.TrimSpace(r.Prenom + " " + r.Nom)
	methode := methodeLisible(r.Methode)
	if strings.Contains(r.DernierCourriel, libelleMethode+" : "+methode+"\n") {
		return
	}
	obtenuLe := time.Now()
	if r.EnrollmentCapturedAt != nil {
		obtenuLe = *r.EnrollmentCapturedAt
	}
	// Un rendez-vous se prépare, un enrôlement à distance se suit : le courriel
	// change de titre et ne parle du rendez-vous que s'il y en a un.
	titre, objet, rendezVous := "Enrôlement à distance", "Prospect transmis à l’enrôlement : ", ""
	if methodesRendezVous[r.Methode] {
		titre, objet = "Rendez-vous d’enrôlement", "Rendez-vous d’enrôlement : "
		rendezVous = "date à fixer"
	}
	if r.RendezVousAt != nil {
		rendezVous = r.RendezVousAt.In(s.Cfg.TimeZone).Format(formatDateEnrolement)
	}
	intro := notifications.IntroCourriel(&reglages.Enrolement, notifications.AideEnrolement(), map[string]string{
		notifications.VariableClient: client, "telephone": qualificationNumero(r.PhoneE164), "methode": methode, "rendezVous": rendezVous,
		notifications.VariableTeleconseiller: u.FullName, notifications.VariableBanque: texteOuNonRenseigne(r.BanqueName),
		notifications.VariableProjet: projet,
	})
	lignes := [][2]string{
		{"Client", client},
		{"Téléphone", texteOuNonRenseigne(r.PhoneE164)},
		{"Courriel", texteOuNonRenseigne(r.Email)},
		{"Banque", texteOuNonRenseigne(r.BanqueName)},
		{libelleMethode, methode},
	}
	if rendezVous != "" {
		intro += " Rendez-vous : " + rendezVous + "."
		lignes = append(lignes, [2]string{"Rendez-vous", rendezVous})
	}
	lignes = append(lignes,
		[2]string{"Téléconseiller", u.FullName},
		[2]string{"Obtenue le", obtenuLe.In(s.Cfg.TimeZone).Format(formatDateEnrolement)},
	)
	chemin := "/" + coque + "/prospects/" + r.ID
	err = notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          notifications.CourrielProspectEnrolement,
		Sujet:         "[" + projet + "] " + objet + client,
		Destinataires: reglages.Enrolement.Destinataires, Copies: reglages.Enrolement.Copies,
		ObjetType: "prospect", ObjetID: r.ID,
		Titre: titre, Intro: intro, Lignes: lignes,
		Lien: socle.Env("PUBLIC_WEB_URL", "") + chemin, LibelleLien: "Voir le prospect dans CPI GO",
	})
	if err != nil {
		slog.Error("prospect enrôlé : courriel non tracé", "prospect", prospectID, "err", err)
	}
}

const (
	formatDateEnrolement = "02/01/2006 à 15:04"
	// Relu dans le texte du dernier courriel : la même méthode ne se renvoie pas.
	libelleMethode = "Méthode d’enrôlement"
)

var methodesRendezVous = map[string]bool{"APPOINTMENT": true, "PHYSICAL": true, "RDV_CPI": true}

func methodeLisible(code string) string {
	if code == "" {
		return "non précisée"
	}
	if libelle, connu := exports.ExportLibellesMethode[code]; connu {
		return libelle
	}
	return code
}

func texteOuNonRenseigne(v *string) string {
	if v == nil || strings.TrimSpace(*v) == "" {
		return "non renseigné"
	}
	return *v
}
