package support

import (
	"context"
	"cpi-go/db"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	etatEnAttente = "en_attente"
	etatReessai   = "reessai_planifie"
	etatAVerifier = "a_verifier"
	etatEchec     = "echec"

	codeInjoignable = "SUPPORT_GLPI_INJOIGNABLE"
	codeRefuse      = "SUPPORT_GLPI_REFUSE"
	codeAVerifier   = "SUPPORT_GLPI_A_VERIFIER"
	codeEpuise      = "SUPPORT_TENTATIVES_EPUISEES"
	codeNonRelie    = "SUPPORT_NON_CONFIGURE"

	// Le bail couvre le délai de traitement ; au-delà, une autre instance peut
	// reprendre la demande, et l'étape distante sera vérifiée avant d'agir.
	baiTransmission  = 6 * time.Minute
	delaiTraitement  = 5 * time.Minute
	signalementsDus  = 20
	tentativesMax    = 5
	referenceSignale = "CRM-"
)

// Espacements avant reprise, tentative par tentative.
var attentes = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute}

func (s *service) balayerSignalements(ctx context.Context) error {
	maintenant := time.Now()
	dus, err := s.Q.SupportSignalementsDus(ctx, db.SupportSignalementsDusParams{
		Now: maintenant, BailExpire: maintenant.Add(-baiTransmission), Prendre: signalementsDus,
	})
	if err != nil {
		return err
	}
	for _, id := range dus {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		s.transmettre(ctx, id)
	}
	return nil
}

func (s *service) transmettre(ctx context.Context, id string) {
	if err := s.transmettreUn(ctx, id); err != nil {
		slog.Error("signalement non transmis", "signalement", id, "err", err)
	}
}

func (s *service) transmettreUn(parent context.Context, id string) error {
	maintenant := time.Now()
	jeton := uuid.NewString()
	sig, err := s.Q.ClaimSupportSignalement(parent, db.ClaimSupportSignalementParams{
		ID: id, Jeton: jeton, Now: maintenant, BailExpire: maintenant.Add(-baiTransmission),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	ctx, annuler := context.WithTimeout(parent, delaiTraitement)
	defer annuler()
	if err := s.poursuivre(ctx, &sig, jeton); err != nil {
		return s.interrompre(parent, &sig, jeton, err)
	}
	_, err = s.Q.SupportTermine(parent, db.SupportTermineParams{ID: sig.ID, Jeton: jeton, Now: time.Now()})
	return err
}

var errNonRelie = errors.New("GLPI_URL, GLPI_APP_TOKEN ou GLPI_USER_TOKEN manquant")

func (s *service) poursuivre(ctx context.Context, sig *db.SupportSignalement, jeton string) error {
	if !s.g.configure() {
		return errNonRelie
	}
	session, err := s.g.ouvrirSession(ctx)
	if err != nil {
		return err
	}
	defer s.g.fermerSession(ctx, session)
	numero := sig.NumeroGlpi
	if numero == nil {
		obtenu, err := s.numeroDuTicket(ctx, session, sig, jeton)
		if err != nil {
			return err
		}
		numero = &obtenu
	}
	return s.joindreLesImages(ctx, session, sig, jeton, int(*numero))
}

// Un numéro connu est enregistré AVANT de poursuivre : une interruption après
// cette écriture ne peut plus recréer le ticket.
func (s *service) numeroDuTicket(ctx context.Context, session string, sig *db.SupportSignalement, jeton string) (int32, error) {
	numero, err := s.creerOuRetrouver(ctx, session, sig, jeton)
	if err != nil {
		return 0, err
	}
	lignes, err := s.Q.SupportNumeroEnregistre(ctx, db.SupportNumeroEnregistreParams{
		ID: sig.ID, Jeton: jeton, Numero: numero, Now: time.Now(),
	})
	if err != nil {
		return 0, err
	}
	if lignes == 0 {
		return 0, errBailPerdu
	}
	return numero, nil
}

var errBailPerdu = errors.New("bail perdu pendant la transmission")

// Une création déjà engagée dont le résultat est inconnu se réconcilie par la
// référence CRM inscrite dans le ticket ; sans preuve, la demande passe à
// vérifier plutôt que de créer un doublon.
func (s *service) creerOuRetrouver(ctx context.Context, session string, sig *db.SupportSignalement, jeton string) (int32, error) {
	reference := referenceSignale + sig.ID
	if sig.CreationEngagee {
		retrouve, err := s.g.ticketDeLaReference(ctx, session, reference)
		if err != nil {
			return 0, err
		}
		if retrouve == 0 {
			return 0, errACreuser
		}
		return entier32(retrouve), nil
	}
	if lignes, err := s.Q.SupportCreationEngagee(ctx, db.SupportCreationEngageeParams{ID: sig.ID, Jeton: jeton}); err != nil {
		return 0, err
	} else if lignes == 0 {
		return 0, errBailPerdu
	}
	numero, err := s.g.creerTicket(ctx, session, &demande{
		login: sig.AuteurLogin, nom: sig.AuteurNom, email: sig.AuteurEmail,
		roleLibelle: sig.AuteurRoleLibelle, pilotage: sig.AuteurPilotage, groupe: sig.AuteurGroupe,
		description: sig.Description, contexte: sig.Contexte,
		urgence: sig.Urgence, categorie: sig.Categorie, reference: reference,
	})
	return entier32(numero), err
}

var errACreuser = errors.New("création engagée sans ticket retrouvé chez GLPI")

func (s *service) joindreLesImages(ctx context.Context, session string, sig *db.SupportSignalement, jeton string, ticket int) error {
	images, err := s.Q.SupportImagesAEnvoyer(ctx, sig.ID)
	if err != nil {
		return err
	}
	for i := range images {
		document, err := s.g.joindreImage(ctx, session, ticket, images[i].Nom, images[i].Contenu)
		if err != nil {
			return err
		}
		var lie *int32
		if document > 0 {
			numero := entier32(document)
			lie = &numero
		}
		lignes, err := s.Q.SupportImageTransmise(ctx, db.SupportImageTransmiseParams{
			ID: images[i].ID, SignalementID: sig.ID, Jeton: jeton, Document: lie, Now: time.Now(),
		})
		if err != nil {
			return err
		}
		if lignes == 0 {
			return errBailPerdu
		}
	}
	return nil
}

// Une erreur ambiguë ou un bail perdu ne relancent rien d'eux-mêmes : c'est la
// prise en charge suivante qui vérifiera l'étape distante.
func (s *service) interrompre(ctx context.Context, sig *db.SupportSignalement, jeton string, cause error) error {
	if errors.Is(cause, errBailPerdu) {
		return nil
	}
	etat, code := etatReessai, codeInjoignable
	var refus *appelGlpiError
	switch {
	case errors.Is(cause, errNonRelie):
		etat, code = etatEchec, codeNonRelie
	case errors.Is(cause, errACreuser):
		etat, code = etatAVerifier, codeAVerifier
	case errors.As(cause, &refus) && refus.definitif():
		etat, code = etatEchec, codeRefuse
	case sig.Tentatives >= tentativesMax:
		etat, code = etatEchec, codeEpuise
	// Une création engagée coupée en route peut avoir abouti chez GLPI.
	case sig.CreationEngagee && sig.NumeroGlpi == nil && errors.Is(cause, context.DeadlineExceeded):
		etat, code = etatAVerifier, codeAVerifier
	}
	maintenant := time.Now()
	_, err := s.Q.SupportInterrompu(ctx, db.SupportInterrompuParams{
		ID: sig.ID, Jeton: jeton, Etat: etat, Code: code,
		Diagnostic: tronquer(cause.Error(), diagnosticMaxLen),
		Prochaine:  maintenant.Add(attente(sig.Tentatives)), Now: maintenant,
	})
	slog.Warn("transmission du signalement interrompue", "signalement", sig.ID, "etat", etat, "code", code, "err", cause)
	return err
}

func attente(tentatives int32) time.Duration {
	rang := int(tentatives) - 1
	if rang < 0 {
		rang = 0
	}
	if rang >= len(attentes) {
		rang = len(attentes) - 1
	}
	// Un peu de dispersion : deux demandes tombées ensemble ne repartent pas ensemble.
	return attentes[rang] + time.Duration(time.Now().UnixNano()%int64(10*time.Second))
}

func tronquer(texte string, maximum int) string {
	if runes := []rune(texte); len(runes) > maximum {
		return string(runes[:maximum])
	}
	return texte
}

func (s *service) releverCategories(ctx context.Context) error {
	if !s.g.configure() {
		return nil
	}
	session, err := s.g.ouvrirSession(ctx)
	if err != nil {
		return err
	}
	defer s.g.fermerSession(ctx, session)
	catalogue, err := s.g.categories(ctx, session)
	if err != nil {
		return err
	}
	if len(catalogue) == 0 {
		return nil
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	if err := q.SupportCategoriesVidees(ctx); err != nil {
		return err
	}
	for _, c := range catalogue {
		if err := q.SupportCategorieEnregistree(ctx, db.SupportCategorieEnregistreeParams{ID: entier32(c.ID), Nom: c.Nom}); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
