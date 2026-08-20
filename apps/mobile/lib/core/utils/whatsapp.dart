/// Trois états et non un booléen : sans `nonDemande`, rien ne distingue « il n'a
/// pas WhatsApp » de « on ne lui a pas posé la question », et c'est cette
/// différence qui décide de qui on rappelle.
enum WhatsappStatus {
  nonDemande('NON_DEMANDE', 'Non demandé'),
  memeNumero('MEME_NUMERO', 'Même numéro'),
  autreNumero('AUTRE_NUMERO', 'Autre numéro'),
  aucun('AUCUN', 'Pas de WhatsApp');

  const WhatsappStatus(this.code, this.label);

  final String code;
  final String label;

  /// Nul si le serveur a ajouté un état que cette version ignore. L'appelant
  /// affiche alors le code brut plutôt que de faire disparaître l'information.
  static WhatsappStatus? parse(String code) {
    for (final WhatsappStatus s in WhatsappStatus.values) {
      if (s.code == code) return s;
    }
    return null;
  }
}

const int kProfessionMaxLength = 120;
