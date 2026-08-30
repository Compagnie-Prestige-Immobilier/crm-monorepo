import '../widgets/visuals/social_icon.dart';

/// Le champ ne demande plus un lien mais un identifiant : l'atelier tape
/// juste "monatelier" au lieu de "tiktok.com/@monatelier". Ce fichier fait le
/// même travail que [CommunicationUtils] pour WhatsApp — nettoyer l'entrée
/// brute, construire l'URL canonique — mais pour les trois réseaux sociaux.
/// Aucun changement côté stockage : la colonne reste une URL en texte libre,
/// seule la saisie change.
class SocialLinkUtils {
  static const Map<SocialNetwork, String> _domains = {
    SocialNetwork.tiktok: 'tiktok.com/@',
    SocialNetwork.instagram: 'instagram.com/',
    SocialNetwork.facebook: 'facebook.com/',
  };

  /// Le préfixe affiché devant le champ ("tiktok.com/@").
  static String prefix(SocialNetwork network) => '${_domains[network]}';

  /// Nettoie une saisie utilisateur — identifiant seul, avec ou sans "@", ou
  /// lien complet collé par erreur — pour ne garder que l'identifiant brut.
  static String _cleanHandle(SocialNetwork network, String raw) {
    var value = raw.trim();
    if (value.isEmpty) return value;

    // Un lien complet a pu être collé malgré le nouveau champ ; on en extrait
    // le dernier segment plutôt que de le stocker tel quel.
    final withoutScheme = value.replaceFirst(RegExp(r'^https?://'), '');
    final domain = _domains[network]!.replaceAll('/@', '').replaceAll('/', '');
    if (withoutScheme.toLowerCase().startsWith(domain)) {
      value = withoutScheme.substring(domain.length);
    } else {
      value = withoutScheme;
    }

    value = value.replaceAll(RegExp(r'^/+'), '').replaceAll(RegExp(r'/+$'), '');
    if (value.startsWith('@')) value = value.substring(1);
    return value;
  }

  /// Construit l'URL canonique à stocker à partir de ce que l'atelier a tapé.
  /// Chaîne vide -> chaîne vide (retire le lien, comportement inchangé).
  static String canonicalUrl(SocialNetwork network, String rawInput) {
    final handle = _cleanHandle(network, rawInput);
    if (handle.isEmpty) return '';
    return 'https://${_domains[network]}$handle';
  }

  /// Ré-affiche un identifiant nu dans le champ d'édition à partir de l'URL
  /// stockée (qui peut être une ancienne URL complète tapée avant ce champ).
  static String usernameFromUrl(SocialNetwork network, String? storedUrl) {
    if (storedUrl == null || storedUrl.trim().isEmpty) return '';
    return _cleanHandle(network, storedUrl);
  }
}
