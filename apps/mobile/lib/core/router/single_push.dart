import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Empile une route **une seule fois**, quoi que fasse le pouce.
///
/// ## Le geste, et pourquoi il produit deux écrans
///
/// Sur un Tecno ou un Infinix d'entrée de gamme, l'ouverture d'un écran de
/// formulaire prend 200 à 400 ms : construction des widgets, ouverture du
/// brouillon, première requête drift. Pendant ce temps, RIEN ne bouge à l'écran.
/// L'utilisateur, debout, au soleil, appuie une seconde fois. `context.push`
/// n'a aucune mémoire : les deux appuis empilent deux fois la même route, et le
/// commercial doit revenir deux fois pour sortir d'un écran qu'il croyait avoir
/// ouvert une fois. Sur un formulaire de saisie, les deux exemplaires ouvrent
/// en plus **deux brouillons** pour une seule intention.
///
/// ## Deux gardes, parce qu'une seule ne suffit pas
///
/// 1. **La fenêtre de refroidissement.** Deux appuis dans la même fenêtre de
///    [cooldown] vers la même destination ne comptent que pour un. C'est le seul
///    garde qui tienne pendant la frame où la navigation n'a pas encore été
///    appliquée : à ce moment-là, l'adresse courante est encore l'ancienne pour
///    les deux appuis.
/// 2. **L'adresse courante.** Elle rattrape le cas lent : l'utilisateur revient
///    en arrière puis réappuie une seconde plus tard, ou un déclencheur
///    programmatique redemande une route déjà ouverte.
///
/// L'état est statique : un `StatefulWidget` par bouton ne verrait pas les
/// appuis d'un AUTRE bouton menant à la même route, et la barre du bas comme la
/// carte d'accueil pointent toutes deux vers le sélecteur de représentants.
abstract final class SinglePush {
  /// Assez pour couvrir un double appui involontaire (150 à 400 ms d'après les
  /// mesures d'accessibilité Android), assez court pour ne jamais gêner une
  /// navigation délibérée : personne ne rouvre volontairement le même écran en
  /// moins d'une seconde.
  static const Duration cooldown = Duration(milliseconds: 700);

  /// Horloge injectable, pour que le test n'attende pas 700 ms réelles.
  static DateTime Function() now = DateTime.now;

  static String? _lastTarget;
  static DateTime? _lastAt;

  /// Remet le garde à zéro. Utilisée entre deux tests : l'état est statique, et
  /// un test qui hériterait de la fenêtre du précédent serait faussement vert.
  static void reset() {
    _lastTarget = null;
    _lastAt = null;
  }

  /// Renvoie `true` si la navigation doit réellement avoir lieu.
  ///
  /// Séparée de [push] pour être testable sans arbre de widgets : c'est ici que
  /// vit la décision, et c'est elle qu'on veut voir échouer si on la casse.
  static bool shouldNavigate(String target, {String? currentLocation}) {
    if (currentLocation != null && currentLocation == target) return false;
    final DateTime at = now();
    final DateTime? previous = _lastAt;
    if (_lastTarget == target &&
        previous != null &&
        at.difference(previous) < cooldown) {
      return false;
    }
    _lastTarget = target;
    _lastAt = at;
    return true;
  }
}

extension SinglePushX on BuildContext {
  /// `context.push`, mais un seul écran par intention. Voir [SinglePush].
  void pushOnce(String location) {
    final GoRouter router = GoRouter.of(this);
    final String current = router.routerDelegate.currentConfiguration.uri.toString();
    if (!SinglePush.shouldNavigate(location, currentLocation: current)) return;
    router.push<Object?>(location).ignore();
  }
}
