/// Chemins de l'application, en un seul endroit.
///
/// Une chaîne de route écrite en dur dans un widget est une redirection cassée
/// qui attend son heure : elle ne se voit ni à la compilation, ni au lint.
abstract final class Routes {
  static const String login = '/login';
  static const String home = '/';

  static const String representants = '/representants';
  static const String newRepresentant = '/representants/nouveau';
  static const String representantDetail = '/representants/:id';

  static const String prospects = '/prospects';
  static const String newProspect = '/prospects/nouveau';

  /// Historique : mes représentants dépliables vers leurs prospects.
  static const String historique = '/historique';

  /// Phase 2 — saisie des méthodes d'enrôlement.
  ///
  /// Route de premier niveau, hors coque de navigation et **hors du parcours de
  /// phase 1** : c'est un autre travail, mené depuis un autre support (un
  /// programme PDF imprimé), et le glisser dans un onglet le mêlerait à la
  /// prospection.
  static const String phase2 = '/phase2';

  /// File des opérations en `conflict` ou `failed`.
  static const String corrections = '/a-corriger';

  /// Centre de notifications. C'est aussi la destination par défaut du tap
  /// sur une notification qui ne porte pas de route.
  static const String notifications = '/notifications';

  static const String reglages = '/reglages';
  static const String batteryHelp = '/reglages/autorisations';

  /// « À propos » : version, environnement, serveur, informations de support.
  static const String about = '/reglages/a-propos';

  /// Nom du paramètre de requête qui transporte la destination initiale.
  static const String nextParam = 'next';

  /// Nom du paramètre qui transporte la **référence** au brouillon.
  ///
  /// On ne sérialise jamais l'état du formulaire dans l'URL : cela coupleraient
  /// la restauration de navigation et la restauration des données, et une panne
  /// de l'une deviendrait la panne des deux.
  static const String draftParam = 'draft';

  /// Représentant pré-sélectionné pour la saisie de prospects.
  static const String repParam = 'rep';

  static String representantDetailFor(String id) => '/representants/$id';

  static String newProspectFor(String representantId, {String? draftId}) {
    final Map<String, String> q = <String, String>{repParam: representantId};
    if (draftId != null) q[draftParam] = draftId;
    return Uri(path: newProspect, queryParameters: q).toString();
  }

  static String newRepresentantWithDraft(String draftId) => Uri(
    path: newRepresentant,
    queryParameters: <String, String>{draftParam: draftId},
  ).toString();

  /// `/login?next=<uri encodée>`.
  ///
  /// La destination est encodée en composant d'URI : elle contient elle-même des
  /// `/`, souvent un `?` et parfois un `&`. Concaténée telle quelle, la partie
  /// après le premier `&` deviendrait un paramètre de `/login` et serait perdue
  /// au retour.
  static String loginWithNext(String target) {
    if (target.isEmpty || target == login) return login;
    return '$login?$nextParam=${Uri.encodeComponent(target)}';
  }

  /// Chemins accessibles sans session.
  static bool isPublic(String location) => location.startsWith(login);
}
