abstract final class Routes {
  static const String login = '/login';

  /// L'écran-hub des trois projets. Le tableau de bord CHUES, lui, est sur
  /// [chues] : `HomeScreen` a quitté `/` quand le hub l'a pris.
  static const String home = '/';

  static const String accueil = '/accueil';
  static const String accueilChiffres = '/accueil/chiffres';
  static const String accueilVisiteNew = '/accueil/nouvelle-visite';

  /// Mêmes écrans que côté CHUES, sous un autre chemin : voir
  /// [grandPublicCorrections].
  static const String accueilCorrections = '/accueil/a-corriger';
  static const String accueilReglages = '/accueil/reglages';
  static const String chues = '/chues';
  static const String grandPublic = '/grand-public';
  static const String grandPublicNew = '/grand-public/nouveau';
  static const String grandPublicFiches = '/grand-public/fiches';

  /// Les rappels promis. Deux chemins pour un seul écran : la liste vit hors des
  /// coques, et une même route dans deux coques n'est pas admise par
  /// `go_router`. Voir [grandPublicCorrections].
  static const String grandPublicRappels = '/grand-public/rappels';
  static const String rappels = '/rappels';

  /// Les personnes que j'ai appelées. Deux chemins pour un seul écran, même
  /// raison que [rappels].
  static const String grandPublicMesContacts = '/grand-public/mes-contacts';
  static const String mesContacts = '/mes-contacts';

  /// « À corriger » et « Réglages » sont les mêmes écrans que côté CHUES, sous
  /// un autre chemin : `go_router` n'admet pas une même route dans deux coques,
  /// et un onglet qui ferait changer de coque perdrait la palette et la pile du
  /// projet en cours.
  static const String grandPublicCorrections = '/grand-public/a-corriger';
  static const String grandPublicReglages = '/grand-public/reglages';

  static const String representants = '/representants';
  static const String newRepresentant = '/representants/nouveau';
  static const String representantDetail = '/representants/:id';
  static const String representantQualification =
      '/representants/:id/qualifier';

  static const String prospects = '/prospects';
  static const String newProspect = '/prospects/nouveau';
  static const String prospectDetail = '/prospects/:id';

  static const String historique = '/historique';

  static const String phase2 = '/phase2';

  static const String corrections = '/a-corriger';

  static const String notifications = '/notifications';

  static const String reglages = '/reglages';
  static const String batteryHelp = '/reglages/autorisations';

  static const String about = '/reglages/a-propos';

  static const String nextParam = 'next';

  static const String draftParam = 'draft';

  static const String repParam = 'rep';

  /// Le sélecteur de représentants sert deux gestes : saisir un prospect (par
  /// défaut) ou consigner l'appel d'un représentant, quand aucune liste n'a été
  /// confiée et qu'on cherche la personne à la main.
  static const String butParam = 'but';
  static const String butQualifier = 'qualifier';

  static String representantsPourQualifier() => Uri(
    path: representants,
    queryParameters: <String, String>{butParam: butQualifier},
  ).toString();

  static String representantDetailFor(String id) => '/representants/$id';

  static String prospectDetailFor(String id) =>
      '/prospects/${Uri.encodeComponent(id)}';

  static String representantQualificationFor(String id) =>
      '/representants/${Uri.encodeComponent(id)}/qualifier';

  static String newProspectFor(String representantId, {String? draftId}) {
    final Map<String, String> q = <String, String>{repParam: representantId};
    if (draftId != null) q[draftParam] = draftId;
    return Uri(path: newProspect, queryParameters: q).toString();
  }

  /// La fiche d'un représentant DÉJÀ enregistré, ouverte pour la compléter.
  /// Même écran que la création, et donc même chemin : `app_router` lit `id`.
  static String representantFormFor(String id) => Uri(
    path: newRepresentant,
    queryParameters: <String, String>{'id': id},
  ).toString();

  static String newRepresentantWithDraft(String draftId) => Uri(
    path: newRepresentant,
    queryParameters: <String, String>{draftParam: draftId},
  ).toString();

  static String grandPublicNewWithDraft(String draftId) => Uri(
    path: grandPublicNew,
    queryParameters: <String, String>{draftParam: draftId},
  ).toString();

  static String accueilVisiteNewWithDraft(String draftId) => Uri(
    path: accueilVisiteNew,
    queryParameters: <String, String>{draftParam: draftId},
  ).toString();

  static const String prefillNameParam = 'nom';
  static const String prefillPhoneParam = 'tel';

  static String newRepresentantPrefilled(String query) {
    final String trimmed = query.trim();
    if (trimmed.isEmpty) return newRepresentant;
    final bool looksLikePhone = RegExp(r'^[0-9+\s().-]+$').hasMatch(trimmed);
    return Uri(
      path: newRepresentant,
      queryParameters: <String, String>{
        looksLikePhone ? prefillPhoneParam : prefillNameParam: trimmed,
      },
    ).toString();
  }

  static String loginWithNext(String target) {
    if (target.isEmpty || target == login) return login;
    return '$login?$nextParam=${Uri.encodeComponent(target)}';
  }

  static bool isPublic(String location) => location.startsWith(login);
}
