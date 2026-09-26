package exports

import "github.com/danielgtaylor/huma/v2"

// Un tableau déjà composé en texte, sur une feuille, avec le style des autres exports.
func ClasseurTableau(nom string, colonnes []string, lignes [][]string) (*huma.StreamResponse, error) {
	c, err := exportNouveauClasseur()
	if err != nil {
		return nil, err
	}
	if err := ecrireTableau(c, colonnes, lignes); err != nil {
		_ = c.f.Close()
		return nil, err
	}
	return exportReponseClasseur(c, nom), nil
}

func ecrireTableau(c *exportClasseur, colonnes []string, lignes [][]string) error {
	feuille, err := c.nouvelleFeuille("Tableau", colonnes, nil, nil)
	if err != nil {
		return err
	}
	for _, ligne := range lignes {
		valeurs := make([]any, len(ligne))
		for i, valeur := range ligne {
			valeurs[i] = valeur
		}
		if err := feuille.ecrire(valeurs...); err != nil {
			return err
		}
	}
	return feuille.fermer(true)
}
