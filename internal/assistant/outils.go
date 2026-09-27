package assistant

import (
	"cmp"
	"context"
	"cpi-go/db"
	"cpi-go/internal/analytics"
	"cpi-go/internal/shared/socle"
	ventesACredit "cpi-go/internal/ventes"
	"fmt"
	"math"
	"slices"
	"strconv"
	"time"
)

const (
	outilAppels       = "appels"
	outilVentes       = "ventes"
	outilDossiers     = "dossiers_bancaires"
	colonneAppels     = "Appels"
	colonneJoints     = "Joints"
	libelleCanal      = "Canal"
	axeJour           = "jour"
	axeSite           = "site"
	axeCanal          = "canal"
	axeTeleconseiller = "teleconseiller"
	libelleTotal      = "Total"
	periodeParDefaut  = "30_derniers_jours"
	periodeTrimestre  = "90_derniers_jours"
	filtresChiffres   = "chiffres"
	filtresBanque     = "banque"
	joursAvantBlocage = 7
)

type parametres struct {
	du, au         time.Time
	maintenant     time.Time
	jour           time.Time
	zone           *time.Location
	projet         *string
	teleconseiller *string
	axe            string
}

type ecranOutil struct {
	route      string
	permission socle.Permission
	filtres    string
}

// `projet` et `portefeuille` disent si le filtre de projet et la portée du rôle
// s'appliquent : ils suivent l'écran qui montre les mêmes chiffres. `groupe`
// nomme les lignes d'un outil sans axe au choix.
type outil struct {
	libelle      string
	description  string
	permission   socle.Permission
	source       string
	axes         []string
	groupe       string
	mesures      []string
	sansPeriode  bool
	periode      string
	futur        bool
	projet       bool
	portefeuille bool
	ecran        ecranOutil
	executer     func(context.Context, *db.Queries, *parametres) (Resultat, error)
}

var (
	mesuresAppels              = []string{colonneAppels, colonneJoints, "Taux joints", "Fiches appelées"}
	mesuresConversions         = []string{"Prospects", colonneJoints, "Convertis", "Perdus", "Taux de conversion"}
	mesuresPrevision           = []string{"Fiches ouvertes", "Tranchées sur 6 mois", "Taux historique", "Conversions attendues"}
	mesuresVentes              = []string{"Ventes", "Lots", "Montant", "Encaissé", "Reliquat"}
	mesuresDossiers            = []string{"Dossiers", "Encaissés", "Rejetés", "Montant encaissé", "Bloqués plus de 7 jours"}
	mesuresVisites             = []string{"Visites"}
	mesuresRendezVous          = []string{"Obtenus", "Honorés", "Non honorés", "Reportés", "Taux honorés"}
	mesuresAppelsRepresentants = []string{colonneAppels, colonneJoints, "Représentants appelés", "Taux joints"}
	mesuresRappels             = []string{"Promis", "Honorés", "En retard", "À venir", "Annulés"}
	mesuresCampagnes           = []string{"Fiches confiées", "Fiches traitées", "Appelées aujourd'hui", "Taux d'exploitation"}
	mesuresObjectifs           = []string{"Cible", "Réalisé", "Avancement", "Cadence requise", "Cadence réelle"}
	mesuresEcheances           = []string{"Ventes en retard", "Montant dû"}
	mesuresRisques             = []string{"Nombre"}
)

var (
	ecranChiffres            = ecranOutil{"/teleconseil/tableau-de-bord", socle.PermissionAnalyticsSuperviser, filtresChiffres}
	ecranAppelsRepresentants = ecranOutil{"/teleconseil/supervision", socle.PermissionAnalyticsSuperviser, ""}
)

var outils = map[string]*outil{
	outilAppels: {
		libelle: colonneAppels, description: "Appels passés aux prospects, appels joints et fiches appelées, jour par jour, sur une période.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les appels consignés aux prospects, datés du jour de l'appel",
		groupe: axeJour, mesures: mesuresAppels,
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: appels,
	},
	"conversions_par_canal": {
		libelle: "Conversions par canal", description: "Prospects créés sur une période par canal de provenance : joints, convertis, perdus, taux de conversion.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les fiches créées sur la période, par canal de provenance",
		groupe: axeCanal, mesures: mesuresConversions,
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: conversionsParCanal,
	},
	"prevision_conversions": {
		libelle: "Prévision des conversions", description: "Prévision des conversions à venir parmi les fiches ouvertes, par canal et projet, d'après le taux des six derniers mois.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les fiches ouvertes et le taux de conversion des six mois qui précèdent la fin de période",
		groupe: axeCanal, mesures: mesuresPrevision,
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: prevision,
	},
	outilVentes: {
		libelle: "Ventes", description: "Ventes saisies sur une période : nombre, lots, montant total, montant encaissé et reliquat, par site, par téléconseiller, par canal ou par jour.",
		permission: socle.PermissionVentesLire, source: "les ventes saisies et non archivées, datées du jour de souscription",
		axes: []string{axeSite, axeTeleconseiller, axeCanal, axeJour}, mesures: mesuresVentes, periode: periodeParDefaut,
		ecran: ecranOutil{"/ventes", socle.PermissionVentesLire, ""}, executer: ventes,
	},
	outilDossiers: {
		libelle: "Dossiers Banque & Finance", description: "Dossiers de financement créés sur une période : nombre, encaissés, rejetés, montant encaissé et dossiers bloqués plus de 7 jours dans leur étape, par étape ou par banque.",
		permission: socle.PermissionBanqueLire, source: "les dossiers Banque & Finance créés sur la période, classés par leur étape actuelle",
		axes: []string{"etape", "banque"}, mesures: mesuresDossiers, periode: periodeParDefaut, projet: true,
		ecran: ecranOutil{"/finance", socle.PermissionBanqueLire, filtresBanque}, executer: dossiersBancaires,
	},
	"visites": {
		libelle: "Visites de l'accueil", description: "Visites enregistrées à l'accueil sur une période, par jour ou par objet de la visite.",
		permission: socle.PermissionAccueilRegistre, source: "le registre des visites, hors visites archivées",
		axes: []string{axeJour, "objet"}, mesures: mesuresVisites, periode: periodeParDefaut,
		ecran: ecranOutil{"/accueil/tableau-de-bord", socle.PermissionAccueilRegistre, filtresChiffres}, executer: visites,
	},
	"rendez_vous": {
		libelle: "Rendez-vous", description: "Rendez-vous obtenus au téléphone dont la date tombe dans la période : obtenus, honorés, non honorés, reportés, par type ou par jour.",
		permission: socle.PermissionRendezVousVoir, source: "les fiches en rendez-vous, datées par leur rappel",
		axes: []string{"type", axeJour}, mesures: mesuresRendezVous, periode: periodeParDefaut, futur: true, projet: true,
		ecran: ecranOutil{"/accueil/rendez-vous", socle.PermissionRendezVousVoir, ""}, executer: rendezVous,
	},
	"appels_representants": {
		libelle: "Appels aux représentants", description: "Appels passés aux représentants syndicaux (CHUES) sur une période : appels, joints, représentants appelés, par jour ou par téléconseiller.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les appels consignés aux représentants, datés du jour de l'appel",
		axes: []string{axeJour, axeTeleconseiller}, mesures: mesuresAppelsRepresentants, periode: periodeParDefaut, portefeuille: true,
		ecran: ecranAppelsRepresentants, executer: appelsRepresentants,
	},
	"rappels": {
		libelle: "Rappels", description: "Rappels promis aux prospects dont l'échéance tombe dans la période, par téléconseiller : promis, honorés, en retard, à venir, annulés.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les rappels promis, datés par leur échéance",
		groupe: axeTeleconseiller, mesures: mesuresRappels,
		periode: periodeTrimestre, futur: true, projet: true, portefeuille: true,
		ecran: ecranOutil{"/teleconseil/rappels", socle.PermissionFichesTenir, ""}, executer: rappels,
	},
	"campagnes": {
		libelle: "Avancement des campagnes", description: "Avancement des campagnes d'appels créées sur la période : fiches confiées, fiches traitées, taux d'exploitation, appelées aujourd'hui, dernier appel.",
		permission: socle.PermissionCampagnesSuperviser, source: "les campagnes créées sur la période, une fiche étant traitée dès son premier appel",
		groupe: "campagne", mesures: mesuresCampagnes,
		periode: periodeTrimestre, projet: true, portefeuille: true,
		ecran: ecranOutil{"/teleconseil/campagnes", socle.PermissionCampagnesSuperviser, ""}, executer: campagnes,
	},
	"objectifs": {
		libelle: "Objectifs de la campagne 2026", description: "Objectifs de la campagne 2026 contre le réalisé : CHUES, Grand Public et leads marketing, avec l'avancement et les cadences quotidiennes requise et réelle. Sans période : la campagne court du 10/09 au 23/12/2026.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les objectifs de la supervision, réalisé compté depuis le début de la campagne",
		groupe: "objectif", mesures: mesuresObjectifs, periode: periodeParDefaut, sansPeriode: true,
		ecran: ecranOutil{"/teleconseil/supervision", socle.PermissionAnalyticsSuperviser, ""}, executer: objectifs,
	},
	"echeances_en_retard": {
		libelle: "Échéances en retard", description: "Ventes à crédit dont une échéance passée n'est pas couverte, et montant dû, par site, au jour d'aujourd'hui. Sans période.",
		permission: socle.PermissionVentesLire, source: "les ventes à crédit et leurs versements, au jour d'aujourd'hui",
		groupe: axeSite, mesures: mesuresEcheances, periode: periodeParDefaut, sansPeriode: true,
		ecran: ecranOutil{"/ventes", socle.PermissionVentesLire, ""}, executer: echeancesEnRetard,
	},
	"risques": {
		libelle: "Risques d'exploitation", description: "Courriels en échec et tâches planifiées en échec sur la période, imports en échec à ce jour.",
		permission: socle.PermissionExploitationAdministrer, source: "le journal des courriels, des tâches planifiées et des imports",
		groupe: "risque", mesures: mesuresRisques, periode: periodeParDefaut,
		ecran: ecranOutil{"/admin/exploitation", socle.PermissionExploitationAdministrer, ""}, executer: risques,
	},
}

var libellesAxes = map[string]string{
	axeJour: "Jour", axeSite: "Site", axeTeleconseiller: "Téléconseiller", axeCanal: libelleCanal,
	"etape": "Étape", "banque": "Banque", "objet": "Objet", "type": "Type",
	"campagne": "Campagne", "objectif": "Objectif", "risque": "Risque",
}

type outilDecrit struct {
	Description string   `json:"description"`
	Axes        []string `json:"axes,omitempty"`
}

func outilsPermis(u *socle.Utilisateur) map[string]outilDecrit {
	permis := map[string]outilDecrit{}
	for nom, o := range outils {
		if u.Peut(o.permission) {
			permis[nom] = outilDecrit{Description: o.description, Axes: o.axes}
		}
	}
	return permis
}

func taux(part, total int64) float64 {
	if total == 0 {
		return 0
	}
	return math.Round(float64(part)/float64(total)*1000) / 10
}

func pourcent(v float64) string {
	return strconv.FormatFloat(v, 'f', 1, 64) + " %"
}

func entier(v int32) string { return strconv.Itoa(int(v)) }

func fcfa(v int64) string { return parTroisChiffres(strconv.FormatInt(v, 10)) + " FCFA" }

type compte struct {
	groupe  string
	details []string
	valeurs []int64
}

// Les colonnes d'un tableau de comptes : `trace` est la valeur du graphique ;
// `taux`, s'il est nommé, rapporte la valeur `num` à la valeur `den`.
type grille struct {
	entete   string
	details  []string
	noms     []string
	montants map[int]bool
	taux     string
	num, den int
	trace    int
}

func (g *grille) ligne(c *compte) []string {
	ligne := append([]string{c.groupe}, c.details...)
	for i, v := range c.valeurs {
		if g.montants[i] {
			ligne = append(ligne, fcfa(v))
			continue
		}
		ligne = append(ligne, strconv.FormatInt(v, 10))
	}
	if g.taux != "" {
		ligne = append(ligne, pourcent(taux(c.valeurs[g.num], c.valeurs[g.den])))
	}
	return ligne
}

// Plusieurs lignes reçoivent un total : c'est lui que lit une question « combien ».
func (g *grille) resultat(comptes []compte) Resultat {
	colonnes := append(append([]string{g.entete}, g.details...), g.noms...)
	if g.taux != "" {
		colonnes = append(colonnes, g.taux)
	}
	r := Resultat{Tableau: Tableau{Colonnes: colonnes, Lignes: [][]string{}}, Serie: []Point{}, Mesure: g.noms[g.trace]}
	total := compte{groupe: libelleTotal, details: make([]string, len(g.details)), valeurs: make([]int64, len(g.noms))}
	for i := range comptes {
		r.Tableau.Lignes = append(r.Tableau.Lignes, g.ligne(&comptes[i]))
		r.Serie = append(r.Serie, Point{Libelle: comptes[i].groupe, Valeur: float64(comptes[i].valeurs[g.trace])})
		for j, v := range comptes[i].valeurs {
			total.valeurs[j] += v
		}
	}
	if len(comptes) > 1 {
		r.Tableau.Lignes = append(r.Tableau.Lignes, g.ligne(&total))
	}
	return r
}

func enteteAxe(axe string) string {
	if libelle, ok := libellesAxes[axe]; ok {
		return libelle
	}
	return libelleTotal
}

func appels(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantAppels(ctx, db.AssistantAppelsParams{Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: slices.Concat([]string{"Jour"}, mesuresAppels), Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: colonneAppels,
	}
	var total, joints int32
	for _, l := range lignes {
		total, joints = total+l.Appels, joints+l.Joints
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Jour, entier(l.Appels), entier(l.Joints), pourcent(taux(int64(l.Joints), int64(l.Appels))), entier(l.Fiches)})
		r.Serie = append(r.Serie, Point{Libelle: l.Jour, Valeur: float64(l.Appels)})
	}
	r.Tableau.Lignes = append(r.Tableau.Lignes, []string{libelleTotal, entier(total), entier(joints), pourcent(taux(int64(joints), int64(total))), ""})
	return r, nil
}

func conversionsParCanal(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantConversionsParCanal(ctx, db.AssistantConversionsParCanalParams{Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: slices.Concat([]string{libelleCanal}, mesuresConversions), Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: mesuresConversions[4],
	}
	for _, l := range lignes {
		t := taux(int64(l.Convertis), int64(l.Prospects))
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Canal, entier(l.Prospects), entier(l.Joints), entier(l.Convertis), entier(l.Perdus), pourcent(t)})
		r.Serie = append(r.Serie, Point{Libelle: l.Canal, Valeur: t})
	}
	return r, nil
}

// Le taux d'un groupe est celui de ses fiches tranchées (converties ou perdues)
// depuis six mois ; sous dix fiches tranchées il ne dit rien et n'est pas appliqué.
func prevision(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	depuis := p.au.AddDate(0, 0, -historiqueJours)
	lignes, err := q.AssistantPrevision(ctx, db.AssistantPrevisionParams{Depuis: depuis, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: slices.Concat([]string{libelleCanal, "Projet"}, mesuresPrevision), Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: mesuresPrevision[3],
	}
	attenduesTotal := 0.0
	for _, l := range lignes {
		tranchees := l.Convertis + l.Perdus
		tauxLu, attendues := "Historique insuffisant", "Non estimé"
		if tranchees >= trancheesMinimum {
			t := taux(int64(l.Convertis), int64(tranchees))
			estime := float64(l.Ouverts) * t / 100
			attenduesTotal += estime
			tauxLu, attendues = pourcent(t), strconv.FormatFloat(estime, 'f', 0, 64)
			r.Serie = append(r.Serie, Point{Libelle: fmt.Sprintf("%s %s", l.Canal, l.Projet), Valeur: float64(int(estime + 0.5))})
		}
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Canal, l.Projet, entier(l.Ouverts), entier(tranchees), tauxLu, attendues})
	}
	r.Tableau.Lignes = append(r.Tableau.Lignes, []string{libelleTotal, "", "", "", "", strconv.FormatFloat(attenduesTotal, 'f', 0, 64)})
	return r, nil
}

func ventes(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantVentes(ctx, db.AssistantVentesParams{Axe: p.axe, Du: p.du, Au: p.au})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Ventes), int64(l.Lots), l.Montant, l.Encaisse, l.Reliquat}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: mesuresVentes, montants: map[int]bool{2: true, 3: true, 4: true}, trace: 2}
	return g.resultat(comptes), nil
}

func dossiersBancaires(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantDossiersBancaires(ctx, db.AssistantDossiersBancairesParams{
		Axe: p.axe, Du: p.du, Au: p.au, Projet: p.projet, BloqueAvant: p.maintenant.AddDate(0, 0, -joursAvantBlocage),
	})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Dossiers), int64(l.Encaisses), int64(l.Rejetes), l.MontantEncaisse, int64(l.Bloques)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: mesuresDossiers, montants: map[int]bool{3: true}}
	return g.resultat(comptes), nil
}

func visites(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantVisites(ctx, db.AssistantVisitesParams{Axe: p.axe, Du: p.du, Au: p.au})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Visites)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: mesuresVisites}
	return g.resultat(comptes), nil
}

func rendezVous(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantRendezVous(ctx, db.AssistantRendezVousParams{Axe: p.axe, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Obtenus), int64(l.Honores), int64(l.NonHonores), int64(l.Reportes)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: mesuresRendezVous[:4], taux: mesuresRendezVous[4], num: 1}
	return g.resultat(comptes), nil
}

func appelsRepresentants(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantAppelsRepresentants(ctx, db.AssistantAppelsRepresentantsParams{Axe: p.axe, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Appels), int64(l.Joints), int64(l.Representants)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: mesuresAppelsRepresentants[:3], taux: mesuresAppelsRepresentants[3], num: 1}
	return g.resultat(comptes), nil
}

func rappels(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantRappels(ctx, db.AssistantRappelsParams{
		Maintenant: p.maintenant, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet,
	})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Teleconseiller, valeurs: []int64{int64(l.Promis), int64(l.Honores), int64(l.EnRetard), int64(l.AVenir), int64(l.Annules)}})
	}
	g := grille{entete: libellesAxes[axeTeleconseiller], noms: mesuresRappels, trace: 2}
	return g.resultat(comptes), nil
}

func campagnes(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AvancementCampagnes(ctx, db.AvancementCampagnesParams{
		Depuis: p.jour, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet,
	})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		etat := "Active"
		if l.EnPause {
			etat = "En pause"
		}
		comptes = append(comptes, compte{
			groupe: l.Name, details: []string{libelleProjet(l.Projet), etat, l.DernierAppel},
			valeurs: []int64{int64(l.Fiches), int64(l.Traitees), int64(l.AppeleesDepuis)},
		})
	}
	g := grille{
		entete: "Campagne", details: []string{"Projet", "État", "Dernier appel"},
		noms: mesuresCampagnes[:3], taux: mesuresCampagnes[3], num: 1, trace: 1,
	}
	return g.resultat(comptes), nil
}

func objectifs(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	o, err := analytics.Objectifs2026(ctx, q, p.zone)
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: slices.Concat([]string{libellesAxes["objectif"]}, mesuresObjectifs), Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: mesuresObjectifs[2],
	}
	for _, suivi := range []struct {
		nom string
		o   analytics.ObjectifSuivi
	}{{projetChues, o.Chues}, {"Grand Public", o.GrandPublic}, {"Leads marketing", o.LeadsMarketing}} {
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{
			suivi.nom, strconv.Itoa(suivi.o.Cible), strconv.Itoa(suivi.o.Realisations), pourcent(suivi.o.TauxAvancement),
			strconv.FormatFloat(suivi.o.CadenceQuotidienneRequise, 'f', 1, 64), strconv.FormatFloat(suivi.o.CadenceQuotidienneReelle, 'f', 1, 64),
		})
		r.Serie = append(r.Serie, Point{Libelle: suivi.nom, Valeur: suivi.o.TauxAvancement})
	}
	return r, nil
}

func echeancesEnRetard(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, _, err := ventesACredit.EcheancesEnRetard(ctx, q, p.maintenant, p.zone)
	if err != nil {
		return Resultat{}, err
	}
	rang := map[string]int{}
	comptes := []compte{}
	for j := range lignes {
		site := lignes[j].Site
		i, vu := rang[site]
		if !vu {
			i = len(comptes)
			rang[site] = i
			comptes = append(comptes, compte{groupe: site, valeurs: make([]int64, 2)})
		}
		comptes[i].valeurs[0]++
		comptes[i].valeurs[1] += lignes[j].MontantDu
	}
	slices.SortFunc(comptes, func(a, b compte) int { return cmp.Compare(b.valeurs[1], a.valeurs[1]) })
	g := grille{entete: libellesAxes[axeSite], noms: mesuresEcheances, montants: map[int]bool{1: true}, trace: 1}
	return g.resultat(comptes), nil
}

func risques(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	courriels, err := q.CourrielsSurPlage(ctx, db.CourrielsSurPlageParams{Debut: p.du, Fin: p.au})
	if err != nil {
		return Resultat{}, err
	}
	echoue := db.ImportStatusFailed
	imports, err := q.CountImportJobs(ctx, db.CountImportJobsParams{Status: &echoue})
	if err != nil {
		return Resultat{}, err
	}
	taches, err := q.CronRunsParNom(ctx, db.CronRunsParNomParams{Debut: p.du, Fin: p.au})
	if err != nil {
		return Resultat{}, err
	}
	var tachesEnEchec int64
	for _, t := range taches {
		tachesEnEchec += int64(t.Echecs)
	}
	g := grille{entete: libellesAxes["risque"], noms: mesuresRisques}
	return g.resultat([]compte{
		{groupe: "Courriels en échec", valeurs: []int64{int64(courriels.Echecs)}},
		{groupe: "Imports en échec", valeurs: []int64{imports}},
		{groupe: "Tâches planifiées en échec", valeurs: []int64{tachesEnEchec}},
	}), nil
}
