/// Normalisation du téléphone en E.164 : **Dart pur**.
///
/// C'est la clé de déduplication du système, adossée aux index uniques partiels
/// `representants_phone_unique` et `prospects_phone_unique`. Elle doit donc être
/// **déterministe** : « 77 123 45 67 » saisi à Dakar et « +221 77 123 45 67 »
/// saisi à Thiès doivent produire exactement la même chaîne, sinon la contrainte
/// d'unicité ne contraint plus rien.
///
/// **Le serveur reste l'autorité.** `apps/api/src/common/phone.ts` normalise avec
/// `libphonenumber-js` et la région par défaut `SN` ; le payload part en saisie
/// libre dans le champ `phone` et c'est la valeur serveur qui fait foi. Ce
/// fichier ne réimplémente pas libphonenumber : 300 ko de métadonnées pour un
/// seul pays : mais reproduit son verdict sur le plan de numérotation sénégalais,
/// qui est le seul que l'app rencontre. Toute divergence se solderait par un
/// doublon accepté localement puis refusé en 409 : visible, pas silencieux.
library;

/// Indicatif pays du Sénégal.
const String kSenegalCallingCode = '221';

/// Longueur du numéro national sénégalais.
const int kSenegalNationalLength = 9;

/// Préfixes nationaux **connus** (2 chiffres).
///
/// Mobiles : Orange 77/78, Free 76, Expresso 70, Promobile 75.
/// Fixes : 33 (Orange), 30 (VoIP), 32/39 (opérateurs alternatifs).
///
/// ═══ CETTE LISTE AVERTIT, ELLE NE REFUSE PLUS ═══
///
/// Elle a servi de liste blanche bloquante : un préfixe absent rendait
/// `toE164()` nul, `_canSave` restait faux, et **le commercial ne pouvait
/// physiquement pas enregistrer le prospect**. Or l'ARTP ouvre des tranches
/// (76 en 2016, 75 en 2019, et la suite viendra) : le jour où elle en ouvre une
/// nouvelle, la seule issue est un APK poussé sur toute la flotte, par 2G, à
/// des gens en tournée. C'est une panne totale de saisie causée par une
/// constante.
///
/// Le doc-comment de ce fichier nomme déjà le bon arbitre : `apps/api` valide
/// avec `libphonenumber-js`, met à jour ses métadonnées à chaque release, et
/// c'est **sa** valeur qui fait foi. On garde donc la liste pour prévenir d'une
/// probable faute de frappe : elle en attrape beaucoup : mais l'utilisateur
/// reste libre de passer outre, et le serveur tranchera.
const Set<String> kSenegalPrefixes = <String>{
  '70', '75', '76', '77', '78', // mobiles
  '30', '32', '33', '39', // fixes
};

/// Séparateurs de présentation tolérés dans une saisie humaine. Même jeu que
/// `SEPARATORS` côté serveur, tirets Unicode compris : un numéro copié depuis
/// WhatsApp en contient régulièrement.
final RegExp _separators = RegExp(r'[\s.\-()‐-―/]');

/// Résultat d'une normalisation. Un `sealed` plutôt qu'une exception : un champ
/// de saisie valide **à chaque frappe**, et lever à chaque caractère
/// incomplet coûterait une pile d'exceptions par touche.
sealed class PhoneResult {
  const PhoneResult();
}

class PhoneValid extends PhoneResult {
  const PhoneValid(this.e164, this.national, {this.warning});

  /// Forme canonique, par exemple `+221771234567`.
  final String e164;

  /// Les 9 chiffres nationaux, par exemple `771234567`.
  final String national;

  /// Réserve **non bloquante**. La saisie est enregistrable ; on signale
  /// seulement qu'elle sort de ce que cette version de l'app connaît.
  final PhoneWarning? warning;

  String? get warningMessage => switch (warning) {
    PhoneWarning.unknownPrefix =>
      'Préfixe inhabituel : vérifiez le numéro. Il sera enregistré.',
    null => null,
  };
}

/// Ce qui mérite un mot sans mériter un refus.
enum PhoneWarning {
  /// Le préfixe n'est pas dans [kSenegalPrefixes]. Faute de frappe la plupart du
  /// temps ; nouvelle tranche ARTP le reste du temps. Dans les deux cas,
  /// l'utilisateur en sait plus que la constante.
  unknownPrefix,
}

class PhoneInvalid extends PhoneResult {
  const PhoneInvalid(this.reason);

  final PhoneProblem reason;

  String get message => switch (reason) {
    PhoneProblem.empty => 'Le numéro est obligatoire.',
    PhoneProblem.tooShort => 'Numéro incomplet : 9 chiffres attendus.',
    PhoneProblem.tooLong => 'Numéro trop long : 9 chiffres attendus.',
    PhoneProblem.notDigits => 'Le numéro ne doit contenir que des chiffres.',
  };
}

/// Ce qui rend une saisie **inexploitable**, et rien d'autre.
///
/// `unknownPrefix` n'y figure plus : un préfixe inconnu produit un numéro
/// parfaitement formé, que le serveur sait valider. Voir [PhoneWarning].
enum PhoneProblem { empty, tooShort, tooLong, notDigits }

abstract final class Phone {
  /// Ramène une saisie quelconque à ses chiffres nationaux, en retirant les
  /// préfixes internationaux écrits à la main.
  ///
  /// `00221…` (préfixe de sortie UIT), `221…` (indicatif nu, tel que le recopie
  /// un abonné) et `+221…` désignent le même abonné. Les trois doivent converger,
  /// sinon la clé de déduplication dépend de la façon dont l'utilisateur a tapé.
  static String digitsOf(String raw) {
    String compact = raw.replaceAll(_separators, '');
    if (compact.startsWith('+')) {
      compact = compact.substring(1);
    } else if (compact.startsWith('00')) {
      compact = compact.substring(2);
    }
    compact = compact.replaceAll(RegExp(r'[^0-9]'), '');

    // On ne retire l'indicatif que si ce qui reste a la bonne longueur pour un
    // numéro national. Sans ce garde-fou, un national qui commencerait par les
    // mêmes chiffres que l'indicatif serait amputé.
    if (compact.startsWith(kSenegalCallingCode) &&
        compact.length > kSenegalNationalLength) {
      final String national = compact.substring(kSenegalCallingCode.length);
      if (national.length == kSenegalNationalLength) return national;
    }
    return compact;
  }

  /// Verdict complet. [PhoneValid.e164] est la seule valeur écrite en base.
  static PhoneResult parse(String raw) {
    if (raw.trim().isEmpty) return const PhoneInvalid(PhoneProblem.empty);
    if (RegExp(r'[a-zA-Z]').hasMatch(raw)) {
      return const PhoneInvalid(PhoneProblem.notDigits);
    }
    final String digits = digitsOf(raw);
    if (digits.length < kSenegalNationalLength) {
      return const PhoneInvalid(PhoneProblem.tooShort);
    }
    if (digits.length > kSenegalNationalLength) {
      return const PhoneInvalid(PhoneProblem.tooLong);
    }
    // Préfixe inconnu : AVERTISSEMENT, jamais refus. Bloquer ici a un coût
    // asymétrique : un faux positif (nouvelle tranche ARTP) rend l'application
    // inutilisable pour tout un opérateur jusqu'à un déploiement d'APK, alors
    // qu'un faux négatif (vraie faute de frappe) se solde par un refus serveur
    // lisible dans « À corriger ».
    final bool known = kSenegalPrefixes.contains(digits.substring(0, 2));
    return PhoneValid(
      '+$kSenegalCallingCode$digits',
      digits,
      warning: known ? null : PhoneWarning.unknownPrefix,
    );
  }

  /// Forme canonique, ou `null` si la saisie n'est pas exploitable.
  static String? toE164(String raw) {
    final PhoneResult result = parse(raw);
    return result is PhoneValid ? result.e164 : null;
  }

  /// Présentation `+221 77 123 45 67`. Utilisée en lecture (listes, fiches) ;
  /// la saisie, elle, passe par le masque de `lib/ui/widgets/phone_field.dart`.
  static String format(String e164OrRaw) {
    final String d = digitsOf(e164OrRaw);
    if (d.length != kSenegalNationalLength) return e164OrRaw;
    return '+$kSenegalCallingCode ${d.substring(0, 2)} ${d.substring(2, 5)} '
        '${d.substring(5, 7)} ${d.substring(7, 9)}';
  }

  /// Groupage `77 123 45 67` des chiffres déjà saisis, sans indicatif. Le champ
  /// de saisie affiche l'indicatif comme préfixe fixe : le rendre éditable
  /// laisserait l'utilisateur l'effacer sans s'en apercevoir.
  static String groupNational(String digits) {
    final StringBuffer out = StringBuffer();
    for (int i = 0; i < digits.length && i < kSenegalNationalLength; i++) {
      if (i == 2 || i == 5 || i == 7) out.write(' ');
      out.write(digits[i]);
    }
    return out.toString();
  }
}
