package notifications

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *service) expedierNotificationsDues(ctx context.Context) error {
	maintenant := time.Now()
	ids, err := s.Q.DueNotifications(ctx, db.DueNotificationsParams{
		Now: &maintenant, LeaseExpired: maintenant.Add(-notificationBailExpedition),
	})
	if err != nil || len(ids) == 0 {
		return err
	}
	pris, err := s.expedierNotifications(ctx, ids, maintenant)
	if err != nil {
		return err
	}
	expediees := 0
	for _, tenue := range pris {
		if tenue {
			expediees++
		}
	}
	if expediees > 0 {
		slog.Info("notifications programmées expédiées", "nombre", expediees)
	}
	return nil
}

type notificationCandidatRappel struct {
	userID    string
	variables map[string]string
}

func notificationOptionActivee(nom string) bool {
	const oui = "true"
	return socle.Env(nom, oui) == oui
}

func (s *service) rappelsQuotidiens(ctx context.Context) error {
	if !notificationOptionActivee("NOTIFICATIONS_REMINDERS_ENABLED") {
		return nil
	}
	maintenant := time.Now()
	return errors.Join(
		s.rappelerAppelsAPasserNotification(ctx, maintenant),
		s.rappelerDossiersBanqueNotification(ctx, maintenant, "NOTIFICATIONS_BANK_PENDING", 5, notificationCleDossiersEnAttente),
		s.rappelerDossiersBanqueNotification(ctx, maintenant, "NOTIFICATIONS_BANK_STALE", 10, notificationCleDossiersSansMouvement),
		s.rappelerEcheancesVentesNotification(ctx, maintenant),
	)
}

func (s *service) rappelerEcheancesVentesNotification(ctx context.Context, maintenant time.Time) error {
	aujourdhui := maintenant.In(s.Cfg.TimeZone)
	demain := time.Date(aujourdhui.Year(), aujourdhui.Month(), aujourdhui.Day()+1, 0, 0, 0, 0, time.UTC)
	ventes, err := s.Q.EcheancesVentesACredit(ctx)
	if err != nil {
		return err
	}
	var clients []string
	for i := range ventes {
		if echeanceLe(&ventes[i], demain) {
			clients = append(clients, ventes[i].Client)
		}
	}
	if len(clients) == 0 {
		return nil
	}
	lecteurs, err := s.Q.ActiveUsersByPermission(ctx, string(socle.PermissionVentesLire))
	if err != nil {
		return err
	}
	candidats := make([]notificationCandidatRappel, 0, len(lecteurs))
	for _, lecteur := range lecteurs {
		candidats = append(candidats, notificationCandidatRappel{userID: lecteur.ID, variables: map[string]string{
			notificationVariableNom: lecteur.FullName, notificationVariableNombre: strconv.Itoa(len(clients)), "clients": strings.Join(clients, ", "),
		}})
	}
	return s.emettreRappelNotification(ctx, notificationCleEcheancesVentes, maintenant, candidats, "Échéances de demain",
		"{{nombre}} client(s) doivent verser demain : {{clients}}.", "/ventes", "RAPPEL")
}

// La première échéance tombe à la date choisie, les suivantes au jour de
// versement, tous les `periodiciteMois` mois.
func echeanceLe(vente *db.EcheancesVentesACreditRow, jour time.Time) bool {
	premier := vente.PremierVersement.Time
	nombre := int32(1)
	if vente.NombreEcheances != nil {
		nombre = *vente.NombreEcheances
	}
	for rang := range nombre {
		echeance := premier
		if rang > 0 {
			mois := int(premier.Month()) + int(rang)*int(vente.PeriodiciteMois)
			echeance = time.Date(premier.Year(), time.Month(mois), int(*vente.JourVersement), 0, 0, 0, 0, time.UTC)
		}
		if echeance.Equal(jour) {
			return true
		}
		if echeance.After(jour) {
			return false
		}
	}
	return false
}

// Rappels promis et encore dus d'ici la fin de la journée, RETARDS COMPRIS :
// un rappel de la veille est toujours antérieur à ce soir.
func (s *service) rappelerAppelsAPasserNotification(ctx context.Context, maintenant time.Time) error {
	_, finJour := s.bornesJourNotification(s.jourNotification(maintenant))
	groupes, err := s.Q.DueCallbacksByAssignee(ctx, finJour)
	if err != nil || len(groupes) == 0 {
		return err
	}
	candidats := make([]notificationCandidatRappel, 0, len(groupes))
	for _, groupe := range groupes {
		candidats = append(candidats, notificationCandidatRappel{userID: groupe.UserId, variables: map[string]string{
			notificationVariableNom: groupe.FullName, notificationVariableNombre: strconv.Itoa(int(groupe.Total)),
		}})
	}
	return s.emettreRappelNotification(ctx, notificationCleRappelsAPasser, maintenant, candidats, "Rappels à passer",
		"Vous avez {{nombre}} rappel(s) à passer aujourd’hui, retards compris.", "/phase2/callbacks", "RAPPEL")
}

func (s *service) rappelerDossiersBanqueNotification(ctx context.Context, maintenant time.Time, prefixe string, defautJours int, cle string) error {
	if !notificationOptionActivee(prefixe + "_ENABLED") {
		return nil
	}
	jours, err := socle.EnvInt(prefixe+"_DAYS", defautJours)
	if err != nil {
		jours = defautJours
	}
	seuil := maintenant.Add(-time.Duration(jours) * 24 * time.Hour)
	titre, corps := "Dossiers en attente",
		"{{nombre}} dossier(s) sont ouverts depuis plus de {{jours}} jour(s) et attendent une décision."
	total, err := s.Q.CountBankCasesPending(ctx, seuil)
	if cle == notificationCleDossiersSansMouvement {
		titre, corps = "Dossiers sans mouvement",
			"{{nombre}} dossier(s) n'ont enregistré aucun mouvement depuis {{jours}} jour(s)."
		total, err = s.Q.CountBankCasesStale(ctx, seuil)
	}
	if err != nil || total == 0 {
		return err
	}
	candidats, err := s.candidatsParRolesNotification(ctx, []string{string(socle.BanqueFinance)}, map[string]string{
		notificationVariableNombre: strconv.Itoa(int(total)), "jours": strconv.Itoa(jours),
	})
	if err != nil {
		return err
	}
	return s.emettreRappelNotification(ctx, cle, maintenant, candidats, titre, corps, "/dossiers", "RAPPEL")
}

func (s *service) candidatsParRolesNotification(ctx context.Context, roles []string, variables map[string]string) ([]notificationCandidatRappel, error) {
	rows, err := s.Q.ActiveUsersByRoles(ctx, roles)
	if err != nil {
		return nil, err
	}
	candidats := make([]notificationCandidatRappel, 0, len(rows))
	for _, row := range rows {
		propres := map[string]string{notificationVariableNom: row.FullName}
		for nom, valeur := range variables {
			propres[nom] = valeur
		}
		candidats = append(candidats, notificationCandidatRappel{userID: row.ID, variables: propres})
	}
	return candidats, nil
}

func (s *service) compteRenduQuotidien(ctx context.Context) error {
	if !notificationOptionActivee("NOTIFICATIONS_DAILY_REPORT_ENABLED") {
		return nil
	}
	maintenant := time.Now()
	jour := s.jourNotification(maintenant)
	debut, fin := s.bornesJourNotification(jour)
	totaux, err := s.Q.DailyReportTotals(ctx, db.DailyReportTotalsParams{Debut: debut, Fin: fin})
	if err != nil {
		return err
	}
	honores, err := s.Q.CountCallbacksHonored(ctx, db.CountCallbacksHonoredParams{Debut: debut, Fin: fin})
	if err != nil {
		return err
	}
	retards, err := s.Q.CountCallbacksOverdue(ctx, maintenant)
	if err != nil {
		return err
	}
	muets, err := s.Q.DailyReportSilentAgents(ctx, db.DailyReportSilentAgentsParams{Debut: debut, Fin: fin})
	if err != nil {
		return err
	}
	sansActe := "personne"
	if len(muets) > 0 {
		sansActe = strings.Join(muets, ", ")
	}
	candidats, err := s.candidatsParRolesNotification(ctx, notificationRolesEncadrants, map[string]string{
		"jour": jour, "appels": strconv.Itoa(int(totaux.Appels)),
		"methodes": strconv.Itoa(int(totaux.Methodes)), "injoignables": strconv.Itoa(int(totaux.Injoignables)),
		"fauxNumeros": strconv.Itoa(int(totaux.FauxNumeros)), "prospects": strconv.Itoa(int(totaux.Prospects)),
		"rappelsHonores": strconv.Itoa(int(honores)), "rappelsEnRetard": strconv.Itoa(int(retards)),
		"sansActe": sansActe,
	})
	if err != nil {
		return err
	}
	return s.emettreRappelNotification(ctx, notificationCleCompteRendu, maintenant, candidats, "Compte rendu du {{jour}}",
		"{{appels}} appel(s) passé(s) : {{methodes}} méthode(s) obtenue(s), "+
			"{{injoignables}} NRP ou injoignable(s), {{fauxNumeros}} faux numéro(s).\n"+
			"Rappels : {{rappelsHonores}} honoré(s) dans la journée, {{rappelsEnRetard}} "+
			"en retard sur l’heure promise.\n{{prospects}} prospect(s) saisi(s).\n"+
			"Téléconseillers sans acte aujourd’hui : {{sansActe}}.", "/supervision", "ANNONCE")
}

// L'idempotence est portée par l'index unique `(reminderKey, period)` : les
// identifiants sont tirés avant l'écriture, et la relecture dit lequel est
// réellement en base, donc si la ligne vient de ce passage ou d'un précédent.
func (s *service) emettreRappelNotification(ctx context.Context, cle string, maintenant time.Time, candidats []notificationCandidatRappel, titre, corps, route, categorie string) error {
	if len(candidats) == 0 {
		return nil
	}
	periode := s.jourNotification(maintenant)
	lignes, err := s.inscrireRappelsNotification(ctx, periode, candidats, &notificationRappel{
		cle: cle, titre: titre, corps: corps, route: route, categorie: categorie,
	})
	if err != nil {
		return err
	}
	crees, comptesVus, dejaVues, err := s.trierRappelsNotification(ctx, periode, lignes)
	if err != nil {
		return err
	}

	for i, id := range crees {
		if err := notificationEcrireLivraisons(ctx, s.Q, []string{id}, []string{comptesVus[i]}, cle, periode); err != nil {
			return err
		}
	}
	if len(crees) > 0 {
		if _, err := s.expedierNotifications(ctx, crees, maintenant); err != nil {
			return err
		}
	}
	if len(dejaVues) > 0 {
		if err := s.reprendreRappelsBloquesNotification(ctx, cle, dejaVues, periode, maintenant); err != nil {
			return err
		}
	}
	slog.Info("rappel émis", "cle", cle, "periode", periode, "emis", len(crees), "presents", len(dejaVues))
	return nil
}

type notificationRappel struct {
	cle, titre, corps, route, categorie string
}

type notificationLigneRappel struct {
	id, userID, cleRappel string
}

// La relecture rend l'identifiant réellement en base pour chaque clé : le
// comparer au nôtre dit si la ligne vient de ce passage ou d'un précédent.
func (s *service) trierRappelsNotification(ctx context.Context, periode string, lignes []notificationLigneRappel) (crees, comptes, dejaVues []string, err error) {
	cles := make([]string, 0, len(lignes))
	for _, l := range lignes {
		cles = append(cles, l.cleRappel)
	}
	presentes, err := s.Q.NotificationIDsByReminderKeys(ctx,
		db.NotificationIDsByReminderKeysParams{Keys: cles, Period: &periode})
	if err != nil {
		return nil, nil, nil, err
	}
	idParCle := map[string]string{}
	for _, row := range presentes {
		idParCle[notificationTexteOuVide(row.ReminderKey)] = row.ID
	}
	for _, l := range lignes {
		if idParCle[l.cleRappel] == l.id {
			crees = append(crees, l.id)
			comptes = append(comptes, l.userID)
			continue
		}
		dejaVues = append(dejaVues, l.userID)
	}
	return crees, comptes, dejaVues, nil
}

func (s *service) inscrireRappelsNotification(ctx context.Context, periode string, candidats []notificationCandidatRappel, rappel *notificationRappel) ([]notificationLigneRappel, error) {
	lignes := make([]notificationLigneRappel, 0, len(candidats))
	for _, candidat := range candidats {
		id, err := uuid.NewV7()
		if err != nil {
			return nil, err
		}
		var manquantes []string
		l := notificationLigneRappel{
			id: id.String(), userID: candidat.userID, cleRappel: rappel.cle + ":" + candidat.userID,
		}
		if _, err := s.Q.InsertNotification(ctx, db.InsertNotificationParams{
			ID:       l.id,
			Title:    notificationRendreTexte(rappel.titre, candidat.variables, &manquantes),
			Body:     notificationRendreTexte(rappel.corps, candidat.variables, &manquantes),
			Category: db.NotificationCategory(rappel.categorie),
			Route:    notificationTexteOuNil(rappel.route),
			Audience: db.NotificationAudience("USERS"), AudienceUserIds: []string{candidat.userID},
			Status:      db.NotificationStatus(notificationStatutEnCours),
			ReminderKey: &l.cleRappel, Period: &periode,
		}); err != nil {
			return nil, err
		}
		lignes = append(lignes, l)
	}
	return lignes, nil
}

func (s *service) reprendreRappelsBloquesNotification(ctx context.Context, cle string, comptes []string, periode string, maintenant time.Time) error {
	ids, err := s.Q.StalledReminderNotificationIDs(ctx, db.StalledReminderNotificationIDsParams{
		ReminderKey: &cle, UserIds: comptes, Period: &periode,
	})
	if err != nil || len(ids) == 0 {
		return err
	}
	_, err = s.expedierNotifications(ctx, ids, maintenant)
	return err
}

func (s *service) jourNotification(instant time.Time) string {
	return instant.In(s.Cfg.TimeZone).Format(time.DateOnly)
}

func (s *service) bornesJourNotification(jour string) (debut, fin time.Time) {
	minuit, err := time.ParseInLocation(time.DateOnly, jour, s.Cfg.TimeZone)
	if err != nil {
		minuit = time.Now().In(s.Cfg.TimeZone).Truncate(24 * time.Hour)
	}
	return minuit.UTC(), minuit.Add(24 * time.Hour).Add(-time.Millisecond).UTC()
}
