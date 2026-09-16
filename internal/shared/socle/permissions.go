package socle

import (
	"context"
	"cpi-go/db"
	"log/slog"
	"sync/atomic"
)

type Permission string

type definitionPermission struct {
	Domaine string
	Libelle string
	Defaut  []Role
}

const (
	domaineAccueil    = "Accueil"
	domaineBanque     = "Banque & Finance"
	domaineCampagnes  = "Campagnes"
	domaineChiffres   = "Chiffres"
	domaineExports    = "Exports"
	domaineFiches     = "Fiches"
	domainePlateforme = "Plateforme"

	Publique Permission = "publique"

	PermissionPanneauAcceder           Permission = "panneau.acceder"
	PermissionFichesTenir              Permission = "fiches.tenir"
	PermissionCampagnesSuperviser      Permission = "campagnes.superviser"
	PermissionCampagnesAdministrer     Permission = "campagnes.administrer"
	PermissionAnalyticsSuperviser      Permission = "analytics.superviser"
	PermissionQualificationSuperviser  Permission = "qualification.superviser"
	PermissionImportsAdministrer       Permission = "imports.administrer"
	PermissionReferentielsSuperviser   Permission = "referentiels.superviser"
	PermissionProspectsSuperviser      Permission = "prospects.superviser"
	PermissionProspectsLire            Permission = "prospects.lire"
	PermissionProspectsFusionner       Permission = "prospects.fusionner"
	PermissionProspectsReaffecter      Permission = "prospects.reaffecter"
	PermissionProspectsRevoir          Permission = "prospects.revoir"
	PermissionProspectsConvertir       Permission = "prospects.convertir"
	PermissionComptesAdministrer       Permission = "comptes.administrer"
	PermissionComptesLister            Permission = "comptes.lister"
	PermissionRolesAdministrer         Permission = "roles.administrer"
	PermissionReferentielsAdministrer  Permission = "referentiels.administrer"
	PermissionExploitationAdministrer  Permission = "exploitation.administrer"
	PermissionCourrielsAdministrer     Permission = "courriels.administrer"
	PermissionEnrolementAdministrer    Permission = "enrolement.administrer"
	PermissionNotificationsAdministrer Permission = "notifications.administrer"
	PermissionBanqueAdministrer        Permission = "banque.administrer"
	PermissionParametresAdministrer    Permission = "parametres.administrer"
	PermissionBasesAdministrer         Permission = "bases.administrer"
	PermissionPlateformeEquipe         Permission = "plateforme.equipe"
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

	PermissionPortefeuilleVoirTout        Permission = "portefeuille.voir_tout"
	PermissionPlateformeVoir              Permission = "plateforme.voir"
	PermissionPlateformeSaisir            Permission = "plateforme.saisir"
	PermissionFichesVoirConverties        Permission = "fiches.voir_converties"
	PermissionFichesIgnorerPropriete      Permission = "fiches.ignorer_propriete"
	PermissionFichesForcerTransition      Permission = "fiches.forcer_transition"
	PermissionFichesParametresReserves    Permission = "fiches.parametres_reserves"
	PermissionDonneesVoirSupprimees       Permission = "donnees.voir_supprimees"
	PermissionChiffresVoirMontants        Permission = "chiffres.voir_montants"
	PermissionVisitesVoirArchivees        Permission = "visites.voir_archivees"
	PermissionBanqueVoirTousPortefeuilles Permission = "banque.voir_tous_portefeuilles"
	PermissionCampagnesAttributionsToutes Permission = "campagnes.attributions_toutes"
	PermissionExportsVoirTout             Permission = "exports.voir_tout"
)

var Catalogue = map[Permission]definitionPermission{
	PermissionPanneauAcceder:           {"Panneau", "Accéder au panneau", Tous},
	PermissionFichesTenir:              {domaineFiches, "Lire et modifier les fiches de son portefeuille", Parcours},
	PermissionCampagnesSuperviser:      {domaineCampagnes, "Superviser les campagnes", Encadrement},
	PermissionCampagnesAdministrer:     {domaineCampagnes, "Administrer les campagnes", AdminSeul},
	PermissionAnalyticsSuperviser:      {domaineChiffres, "Consulter les tableaux de bord de supervision", Encadrement},
	PermissionImportsAdministrer:       {"Imports", "Administrer les imports", AdminSeul},
	PermissionReferentielsSuperviser:   {"Référentiels", "Modifier les référentiels métier", Encadrement},
	PermissionProspectsSuperviser:      {domaineFiches, "Superviser les fiches", Encadrement},
	PermissionProspectsLire:            {domaineFiches, "Lire les prospects", []Role{Commercial, ChargeClientele, CCP, Admin, Superviseur, Direction}},
	PermissionProspectsFusionner:       {domaineFiches, "Fusionner des fiches", []Role{Commercial, ChargeClientele, Admin}},
	PermissionProspectsReaffecter:      {domaineFiches, "Réaffecter des fiches", []Role{Commercial, ChargeClientele, Admin, Superviseur}},
	PermissionProspectsRevoir:          {domaineFiches, "Revoir une demande", []Role{ChargeClientele, Superviseur, Admin}},
	PermissionProspectsConvertir:       {domaineFiches, "Convertir les parcours grand public", []Role{Commercial, ChargeClientele, Admin, Superviseur}},
	PermissionComptesAdministrer:       {"Comptes", "Administrer les comptes", AdminSeul},
	PermissionComptesLister:            {"Comptes", "Lister les comptes", Encadrement},
	PermissionExploitationAdministrer:  {"Exploitation", "Administrer l'exploitation", AdminSeul},
	PermissionCourrielsAdministrer:     {"Courriels", "Administrer les courriels", AdminSeul},
	PermissionEnrolementAdministrer:    {"Enrôlement", "Administrer l'enrôlement", AdminSeul},
	PermissionNotificationsAdministrer: {"Notifications", "Administrer les notifications", AdminSeul},
	PermissionBanqueAdministrer:        {domaineBanque, "Administrer Banque & Finance", AdminSeul},
	PermissionParametresAdministrer:    {"Paramètres", "Administrer les paramètres", AdminSeul},
	PermissionBasesAdministrer:         {"Bases", "Administrer les bases", AdminSeul},
	PermissionPlateformeEquipe:         {domainePlateforme, "Voir l'équipe plateforme", []Role{Admin, Superviseur, Direction, CCP}},
	PermissionBanqueDossiers:           {domaineBanque, "Traiter les dossiers Banque & Finance", Banque},
	PermissionBanqueLire:               {domaineBanque, "Lire les dossiers Banque & Finance", BanqueLecture},
	PermissionAccueilRegistre:          {domaineAccueil, "Tenir le registre des visites", Registre},
	PermissionAccueilListes:            {domaineAccueil, "Administrer les listes de visites", []Role{Admin, Direction}},
	PermissionCampagnesGerer:           {domaineCampagnes, "Créer et modifier les campagnes", []Role{Admin, Superviseur}},
	PermissionChiffresDisposer:         {domaineChiffres, "Disposer le tableau de bord", []Role{Admin, Direction, Superviseur, Accueil}},
	PermissionExportsGlobaux:           {domaineExports, "Exporter les données d'encadrement", Encadrement},
	PermissionExportsProspects:         {domaineExports, "Exporter les prospects", Parcours},
	PermissionExportsBanque:            {domaineExports, "Exporter Banque & Finance", []Role{Admin, BanqueFinance, Superviseur}},
	PermissionExportsModeles:           {domaineExports, "Télécharger les modèles d'import", AdminSeul},
	PermissionFormulairesAdministrer:   {"Formulaires", "Administrer les formulaires publics", AdminSeul},
	PermissionQualificationRappels:     {"Qualification", "Reporter ou annuler ses rappels", []Role{Admin, Commercial, ChargeClientele, CCP}},
	PermissionVentesLire:               {"Ventes", "Lire les ventes", []Role{Admin, Direction}},

	PermissionPortefeuilleVoirTout:        {"Portefeuille", "Voir tous les portefeuilles", Encadrement},
	PermissionPlateformeVoir:              {domainePlateforme, "Voir les fiches plateforme", Encadrement},
	PermissionPlateformeSaisir:            {domainePlateforme, "Saisir les fiches plateforme", []Role{CCP}},
	PermissionFichesVoirConverties:        {domaineFiches, "Voir les fiches converties", []Role{ChargeClientele}},
	PermissionFichesIgnorerPropriete:      {domaineFiches, "Ignorer la propriété d'une fiche", AdminSeul},
	PermissionFichesForcerTransition:      {domaineFiches, "Forcer une transition de fiche", AdminSeul},
	PermissionFichesParametresReserves:    {domaineFiches, "Modifier les paramètres réservés", AdminSeul},
	PermissionDonneesVoirSupprimees:       {"Données", "Voir les données supprimées", AdminSeul},
	PermissionChiffresVoirMontants:        {domaineChiffres, "Voir les montants", []Role{Admin, Direction}},
	PermissionVisitesVoirArchivees:        {domaineAccueil, "Voir les visites archivées", []Role{Direction}},
	PermissionBanqueVoirTousPortefeuilles: {domaineBanque, "Voir tous les portefeuilles Banque & Finance", AdminSeul},
	PermissionCampagnesAttributionsToutes: {domaineCampagnes, "Voir toutes les attributions", []Role{Admin, Superviseur, Direction, BanqueFinance, Accueil}},
	PermissionExportsVoirTout:             {domaineExports, "Exporter tous les portefeuilles", Encadrement},
}

var permissionsDePortee = map[Permission]bool{
	PermissionPortefeuilleVoirTout:        true,
	PermissionPlateformeVoir:              true,
	PermissionPlateformeSaisir:            true,
	PermissionFichesVoirConverties:        true,
	PermissionFichesIgnorerPropriete:      true,
	PermissionFichesForcerTransition:      true,
	PermissionFichesParametresReserves:    true,
	PermissionDonneesVoirSupprimees:       true,
	PermissionChiffresVoirMontants:        true,
	PermissionVisitesVoirArchivees:        true,
	PermissionBanqueVoirTousPortefeuilles: true,
	PermissionCampagnesAttributionsToutes: true,
	PermissionExportsVoirTout:             true,
}

var attributions atomic.Pointer[map[Role]map[Permission]bool]

func ChargerAttributions(_ context.Context, _ *db.Queries) error {
	defauts := AttributionsParDefaut()
	attributions.Store(&defauts)
	return nil
}

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

func (u *Utilisateur) Peut(p Permission) bool {
	if p == Publique {
		return true
	}
	attribution := attributions.Load()
	if attribution == nil {
		defauts := AttributionsParDefaut()
		if attributions.CompareAndSwap(nil, &defauts) {
			attribution = &defauts
		} else {
			attribution = attributions.Load()
		}
	}
	return (*attribution)[u.Role][p]
}

func RolesAutorises(p Permission) []Role {
	if p == Publique {
		return []Role{Public}
	}
	definition, ok := Catalogue[p]
	if !ok {
		return nil
	}
	roles := make([]Role, len(definition.Defaut))
	copy(roles, definition.Defaut)
	return roles
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
