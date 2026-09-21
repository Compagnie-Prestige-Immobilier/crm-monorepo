package socle

import (
	"context"
	"cpi-go/db"
	"errors"
	"log/slog"
	"slices"
	"sync"
	"sync/atomic"
)

type Permission string

type definitionPermission struct {
	Domaine string
	Libelle string
	Defaut  []Role
}

const (
	domaineAccueil   = "Accueil"
	domaineBanque    = "Banque & Finance"
	domaineCampagnes = "Campagnes"
	domaineChiffres  = "Chiffres"
	domaineComptes   = "Comptes"
	domaineExports   = "Exports"
	domaineFiches    = "Fiches"

	Publique Permission = "publique"

	PermissionPanneauAcceder           Permission = "panneau.acceder"
	PermissionFichesTenir              Permission = "fiches.tenir"
	PermissionCampagnesSuperviser      Permission = "campagnes.superviser"
	PermissionCampagnesAdministrer     Permission = "campagnes.administrer"
	PermissionAnalyticsSuperviser      Permission = "analytics.superviser"
	PermissionImportsAdministrer       Permission = "imports.administrer"
	PermissionReferentielsSuperviser   Permission = "referentiels.superviser"
	PermissionProspectsSuperviser      Permission = "prospects.superviser"
	PermissionProspectsLire            Permission = "prospects.lire"
	PermissionProspectsFusionner       Permission = "prospects.fusionner"
	PermissionProspectsReaffecter      Permission = "prospects.reaffecter"
	PermissionProspectsReaffecterTout  Permission = "prospects.reaffecter_tout"
	PermissionProspectsRevoir          Permission = "prospects.revoir"
	PermissionProspectsConvertir       Permission = "prospects.convertir"
	PermissionComptesAdministrer       Permission = "comptes.administrer"
	PermissionComptesLister            Permission = "comptes.lister"
	PermissionRolesAdministrer         Permission = "roles.administrer"
	PermissionExploitationAdministrer  Permission = "exploitation.administrer"
	PermissionCourrielsAdministrer     Permission = "courriels.administrer"
	PermissionEnrolementAdministrer    Permission = "enrolement.administrer"
	PermissionNotificationsAdministrer Permission = "notifications.administrer"
	PermissionBanqueAdministrer        Permission = "banque.administrer"
	PermissionParametresAdministrer    Permission = "parametres.administrer"
	PermissionBasesAdministrer         Permission = "bases.administrer"
	PermissionBanqueDossiers           Permission = "banque.dossiers"
	PermissionBanqueLire               Permission = "banque.lire"
	PermissionAccueilRegistre          Permission = "accueil.registre"
	PermissionAccueilListes            Permission = "accueil.listes"
	PermissionCampagnesGerer           Permission = "campagnes.gerer"
	PermissionChiffresDisposer         Permission = "chiffres.disposer"
	PermissionExportsGlobaux           Permission = "exports.globaux"
	PermissionExportsProspects         Permission = "exports.prospects"
	PermissionExportsBanque            Permission = "exports.banque"
	PermissionExportsModeles           Permission = "exports.modeles"
	PermissionFormulairesAdministrer   Permission = "formulaires.administrer"
	PermissionQualificationRappels     Permission = "qualification.rappels"
	PermissionVentesLire               Permission = "ventes.lire"
	PermissionSupportSignaler          Permission = "support.signaler"
	PermissionSupportPlateforme        Permission = "support.plateforme"
	PermissionRendezVousSuivre         Permission = "rendez_vous.suivre"

	PermissionPortefeuilleVoirTout        Permission = "portefeuille.voir_tout"
	PermissionFichesVoirConverties        Permission = "fiches.voir_converties"
	PermissionFichesIgnorerPropriete      Permission = "fiches.ignorer_propriete"
	PermissionFichesOuvrirAttribuees      Permission = "fiches.ouvrir_attribuees"
	PermissionFichesConsignerAttribuees   Permission = "fiches.consigner_attribuees"
	PermissionFichesModifierToutes        Permission = "fiches.modifier_toutes"
	PermissionFichesForcerTransition      Permission = "fiches.forcer_transition"
	PermissionFichesParametresReserves    Permission = "fiches.parametres_reserves"
	PermissionDonneesVoirSupprimees       Permission = "donnees.voir_supprimees"
	PermissionChiffresVoirMontants        Permission = "chiffres.voir_montants"
	PermissionVisitesVoirArchivees        Permission = "visites.voir_archivees"
	PermissionVisitesDetruire             Permission = "visites.detruire"
	PermissionBanqueVoirTousPortefeuilles Permission = "banque.voir_tous_portefeuilles"
	PermissionCampagnesAttributionsToutes Permission = "campagnes.attributions_toutes"
	PermissionExportsVoirTout             Permission = "exports.voir_tout"
)

var Catalogue = map[Permission]definitionPermission{
	PermissionPanneauAcceder:           {"Panneau", "Accéder au panneau", Tous},
	PermissionFichesTenir:              {domaineFiches, "Lire et modifier les fiches de son portefeuille", Parcours},
	PermissionCampagnesSuperviser:      {domaineCampagnes, "Superviser les campagnes", Encadrement},
	PermissionCampagnesAdministrer:     {domaineCampagnes, "Supprimer une campagne", AdminSeul},
	PermissionAnalyticsSuperviser:      {domaineChiffres, "Consulter les tableaux de bord de supervision", Encadrement},
	PermissionImportsAdministrer:       {"Imports", "Importer des fichiers", AdminSeul},
	PermissionReferentielsSuperviser:   {"Référentiels", "Modifier les référentiels métier", Encadrement},
	PermissionProspectsSuperviser:      {domaineFiches, "Régler segments et paramètres CHUES, requalifier une fiche", Encadrement},
	PermissionProspectsLire:            {domaineFiches, "Lire les prospects", []Role{Commercial, ChargeClientele, Admin, Superviseur, Direction}},
	PermissionProspectsFusionner:       {domaineFiches, "Fusionner des fiches", []Role{Commercial, ChargeClientele, Admin}},
	PermissionProspectsReaffecter:      {domaineFiches, "Réaffecter des fiches", []Role{Commercial, ChargeClientele, Admin, Superviseur}},
	PermissionProspectsReaffecterTout:  {domaineFiches, "Réaffecter vers un autre téléconseiller", []Role{Admin, Superviseur}},
	PermissionProspectsRevoir:          {domaineFiches, "Revoir une demande", []Role{ChargeClientele, Superviseur, Admin}},
	PermissionProspectsConvertir:       {domaineFiches, "Convertir les parcours grand public", []Role{Commercial, ChargeClientele, Admin, Superviseur, Direction}},
	PermissionComptesAdministrer:       {domaineComptes, "Créer, modifier et désactiver les comptes", AdminSeul},
	PermissionComptesLister:            {domaineComptes, "Lister les comptes", Encadrement},
	PermissionRolesAdministrer:         {domaineComptes, "Créer les rôles et régler leurs permissions", AdminSeul},
	PermissionExploitationAdministrer:  {"Exploitation", "Exploitation, journal et purge", AdminSeul},
	PermissionCourrielsAdministrer:     {"Courriels", "Régler les courriels", AdminSeul},
	PermissionEnrolementAdministrer:    {"Enrôlement", "Suivre et régler l'enrôlement", AdminSeul},
	PermissionNotificationsAdministrer: {"Notifications", "Envoyer et régler les notifications", AdminSeul},
	PermissionBanqueAdministrer:        {domaineBanque, "Régler les étapes et valider les dossiers", AdminSeul},
	PermissionParametresAdministrer:    {"Paramètres", "Régler les objectifs et les tableaux de bord par défaut", AdminSeul},
	PermissionBasesAdministrer:         {"Bases", "Créer et supprimer les bases de démonstration", AdminSeul},
	PermissionBanqueDossiers:           {domaineBanque, "Traiter les dossiers Banque & Finance", Banque},
	PermissionBanqueLire:               {domaineBanque, "Lire les dossiers Banque & Finance", BanqueLecture},
	PermissionAccueilRegistre:          {domaineAccueil, "Tenir le registre des visites", Registre},
	PermissionAccueilListes:            {domaineAccueil, "Gérer les listes de visites et les imports", []Role{Admin, Direction}},
	PermissionCampagnesGerer:           {domaineCampagnes, "Créer et modifier les campagnes", []Role{Admin, Superviseur}},
	PermissionChiffresDisposer:         {domaineChiffres, "Disposer le tableau de bord", []Role{Admin, Direction, Superviseur, Accueil}},
	PermissionExportsGlobaux:           {domaineExports, "Exporter les données d'encadrement", Encadrement},
	PermissionExportsProspects:         {domaineExports, "Exporter les prospects", Parcours},
	PermissionExportsBanque:            {domaineExports, "Exporter Banque & Finance", []Role{Admin, BanqueFinance, Superviseur}},
	PermissionExportsModeles:           {domaineExports, "Télécharger les modèles d'import", AdminSeul},
	PermissionFormulairesAdministrer:   {"Formulaires", "Régler les champs de conversion", AdminSeul},
	PermissionQualificationRappels:     {"Qualification", "Reporter ou annuler ses rappels", []Role{Admin, Commercial, ChargeClientele}},
	PermissionVentesLire:               {"Ventes", "Lire les ventes", []Role{Admin, Direction}},
	PermissionSupportSignaler:          {"Support", "Signaler un problème au support", Encadrement},
	PermissionSupportPlateforme:        {"Support", "Ouvrir la plateforme de support GLPI", Encadrement},
	PermissionRendezVousSuivre:         {"Rendez-vous", "Noter l'issue d'un rendez-vous et la suite après rencontre (bêta)", []Role{Admin, Direction, ChargeClientele}},

	PermissionPortefeuilleVoirTout:        {"Portefeuille", "Voir tous les portefeuilles", Encadrement},
	PermissionFichesVoirConverties:        {domaineFiches, "Voir les fiches converties", []Role{ChargeClientele}},
	PermissionFichesIgnorerPropriete:      {domaineFiches, "Agir sur les rappels et identifiants des autres", AdminSeul},
	PermissionFichesOuvrirAttribuees:      {domaineFiches, "Ouvrir une fiche attribuée à un autre téléconseiller", Encadrement},
	PermissionFichesConsignerAttribuees:   {domaineFiches, "Consigner un appel sur une fiche attribuée à un autre téléconseiller", nil},
	PermissionFichesModifierToutes:        {domaineFiches, "Modifier et supprimer les fiches des autres", Encadrement},
	PermissionFichesForcerTransition:      {domaineFiches, "Forcer un changement de statut", AdminSeul},
	PermissionFichesParametresReserves:    {domaineFiches, "Régler les liens, l'adresse et les destinataires CHUES", AdminSeul},
	PermissionDonneesVoirSupprimees:       {"Données", "Voir les données supprimées", AdminSeul},
	PermissionChiffresVoirMontants:        {domaineChiffres, "Voir les montants", []Role{Admin, Direction}},
	PermissionVisitesVoirArchivees:        {domaineAccueil, "Voir les visites archivées", []Role{Direction}},
	PermissionVisitesDetruire:             {domaineAccueil, "Détruire définitivement une visite archivée", []Role{Direction}},
	PermissionBanqueVoirTousPortefeuilles: {domaineBanque, "Voir les demandes de tous les portefeuilles", AdminSeul},
	PermissionCampagnesAttributionsToutes: {domaineCampagnes, "Voir toutes les attributions", []Role{Admin, Superviseur, Direction, BanqueFinance, Accueil}},
	PermissionExportsVoirTout:             {domaineExports, "Exporter le portefeuille d'un autre", Encadrement},
}

var permissionsDePortee = map[Permission]bool{
	PermissionPortefeuilleVoirTout:        true,
	PermissionFichesVoirConverties:        true,
	PermissionFichesIgnorerPropriete:      true,
	PermissionFichesOuvrirAttribuees:      true,
	PermissionFichesConsignerAttribuees:   true,
	PermissionFichesModifierToutes:        true,
	PermissionFichesForcerTransition:      true,
	PermissionFichesParametresReserves:    true,
	PermissionDonneesVoirSupprimees:       true,
	PermissionChiffresVoirMontants:        true,
	PermissionVisitesVoirArchivees:        true,
	PermissionBanqueVoirTousPortefeuilles: true,
	PermissionCampagnesAttributionsToutes: true,
	PermissionExportsVoirTout:             true,
	PermissionProspectsReaffecterTout:     true,
}

// Chaque base porte sa table `role_permissions` ; sa garde lit ses propres
// attributions, rechargées d'un bloc après chaque écriture.
type Attributions struct {
	parRole atomic.Pointer[map[string]map[Permission]bool]
	// Deux rechargements concurrents ne doivent pas ranger une lecture plus ancienne en dernier.
	chargement sync.Mutex
}

func (a *Attributions) Charger(ctx context.Context, q *db.Queries) error {
	a.chargement.Lock()
	defer a.chargement.Unlock()
	lignes, err := q.ListRolePermissions(ctx)
	if err != nil {
		return err
	}
	if len(lignes) == 0 {
		return errors.New("table roles vide : la migration 20260916190000_role_permissions n'est pas appliquée")
	}
	parRole := map[string]map[Permission]bool{}
	for _, ligne := range lignes {
		if parRole[ligne.RoleID] == nil {
			parRole[ligne.RoleID] = map[Permission]bool{}
		}
		if ligne.Permission != nil && permissionConnue(Permission(*ligne.Permission)) {
			parRole[ligne.RoleID][Permission(*ligne.Permission)] = true
		}
	}
	a.parRole.Store(&parRole)
	return nil
}

func (a *Attributions) PermissionsDuRole(roleID string) map[Permission]bool {
	return a.duRole(roleID)
}

// Un rôle inconnu de la table n'a aucune permission : jamais celles de sa base.
func (a *Attributions) duRole(roleID string) map[Permission]bool {
	if permissions, ok := (*a.parRole.Load())[roleID]; ok {
		return permissions
	}
	return map[Permission]bool{}
}

var attributionsParDefaut = sync.OnceValue(AttributionsParDefaut)

func AttributionsParDefaut() map[Role]map[Permission]bool {
	out := map[Role]map[Permission]bool{}
	for permission, definition := range Catalogue {
		for _, role := range definition.Defaut {
			if out[role] == nil {
				out[role] = map[Permission]bool{}
			}
			out[role][permission] = true
		}
	}
	return out
}

// Hors session (tâches planifiées, drapeaux), un utilisateur garde les
// permissions par défaut de son rôle.
func (u *Utilisateur) Peut(p Permission) bool {
	if p == Publique {
		return true
	}
	if p == PermissionRendezVousSuivre && !betaSuiviRendezVous() {
		return false
	}
	if u.permissions != nil {
		return u.permissions[p]
	}
	return attributionsParDefaut()[u.Role][p]
}

// Ouverte en développement local ; la production (NODE_ENV=production) attend la variable.
func betaSuiviRendezVous() bool {
	return Env("BETA_SUIVI_RENDEZ_VOUS", Faux) == Vrai || Env("NODE_ENV", "") == "development"
}

func (u *Utilisateur) Permissions() []string {
	permissions := make([]string, 0, len(Catalogue))
	for p := range Catalogue {
		if u.Peut(p) {
			permissions = append(permissions, string(p))
		}
	}
	slices.Sort(permissions)
	return permissions
}

func PermissionConnue(p Permission) bool {
	_, ok := Catalogue[p]
	return ok
}

func RolesAutorises(p Permission) []Role {
	if p == Publique {
		return []Role{Public}
	}
	definition, ok := Catalogue[p]
	if !ok {
		return nil
	}
	return slices.Clone(definition.Defaut)
}

func permissionConnue(p Permission) bool {
	if p == Publique {
		return true
	}
	_, ok := Catalogue[p]
	if !ok {
		slog.Warn("permission inconnue", "permission", string(p))
	}
	return ok
}
