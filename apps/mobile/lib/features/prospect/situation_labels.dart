library;

/// Les libellés FR des énumérations de situation d'un prospect Grand Public.
/// Partagés par le formulaire de saisie et la fiche : deux tables jumelles
/// finissent par diverger, et c'est la fiche qui affiche alors un code brut.
const Map<String, String> kSituationLabels = <String, String>{
  'FONCTIONNAIRE': 'Fonctionnaire',
  'SECTEUR_PRIVE': 'Secteur privé',
  'INFORMEL': 'Informel',
  'DIASPORA': 'Diaspora',
};

const Map<String, String> kTypeContratLabels = <String, String>{
  'CDI': 'CDI',
  'CDD': 'CDD',
  'AUTRE': 'Autre',
};

const Map<String, String> kModeEpargneLabels = <String, String>{
  'TONTINE': 'Tontine',
  'MOBILE_MONEY': 'Mobile money',
  'BANQUE': 'Banque',
  'AUCUN': 'Aucun',
};
