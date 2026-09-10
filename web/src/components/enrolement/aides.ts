/** Les explications partagées par l'écran d'une plateforme et par la synthèse. */

export const AIDE_RAPPROCHEMENT =
  'Cette personne était-elle déjà connue du CRM ? À chaque tirage, le connecteur cherche un prospect du même projet portant le même téléphone, puis à défaut le même e-mail. S’il en trouve un, l’inscription est rapprochée et son détail ouvre la fiche. Sinon elle reste non rapprochée. Rien n’est écrit sur le prospect.\n\nCe que ça mesure : ces enrôlements viennent-ils de notre prospection, ou les gens arrivent-ils d’eux-mêmes sur la plateforme ?';

export const AIDE_TAUX_RAPPROCHEMENT =
  'Part des inscriptions déjà connues du CRM.\n\nUn taux élevé veut dire que le travail des teleconseillers se retrouve sur les plateformes. Un taux bas veut dire soit que ces inscriptions sont spontanées, soit que le rapprochement échoue, par exemple parce que le téléphone n’est pas saisi de la même façon des deux côtés.';

export const AIDE_DECISION =
  'Grand Public n’expose aucune date de décision. Côté CHUES, la date vit sur la demande d’adhésion, que seul l’e-mail relie au compte, et aucun e-mail ne correspond aujourd’hui. Rien n’est mesurable tant que les plateformes n’exposent pas ce lien.';

export const AIDE_DELAIS =
  'Deux façons de résumer les mêmes dossiers.\n\nLa moyenne additionne tous les délais et divise par le nombre de dossiers. Un seul dossier oublié six mois la fait bondir, alors que tous les autres ont été rapides.\n\n« La moitié en moins de X » range les dossiers du plus rapide au plus lent et prend celui du milieu. Un cas extrême ne le déplace pas.\n\nQuand les deux chiffres s’éloignent, c’est qu’un dossier traîne loin derrière les autres.';

export const AIDE_DELAI_SOUMISSION =
  'Le temps qu’une personne met, après avoir créé son compte, à déposer son dossier.\n\nCe que ça mesure : la friction de la constitution du dossier. Attention, seuls les dossiers réellement soumis sont comptés. Ceux qui traînent encore n’entrent pas dans le calcul, donc un délai court peut cacher une majorité de dossiers jamais déposés : lisez-le avec l’entonnoir.';

/** L'aide dépend du tronçon, que le serveur nomme dans `leg`. */
export function aideDelai(leg: string): string {
  return leg === 'SOUMISSION_TO_DECISION' ? AIDE_DECISION : AIDE_DELAI_SOUMISSION;
}
