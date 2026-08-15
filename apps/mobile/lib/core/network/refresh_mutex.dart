/// Exclusion mutuelle du renouvellement de jeton, **entre isolats**.
///
/// Dart pur, aucune dépendance drift : `AuthInterceptor` ne doit pas connaître
/// la base. L'implémentation réelle vit dans `data/local`, comme celle de
/// `TokenStore` vit dans `data/secure`.
///
/// ## Pourquoi ce verrou existe
///
/// `AuthInterceptor` porte déjà un vol unique : mais **par instance**, donc par
/// isolat. Or l'app a deux isolats qui parlent au serveur avec le MÊME jeton de
/// renouvellement persisté : l'isolat UI et celui de WorkManager.
///
/// Le jeton d'accès, lui, est en mémoire et n'est jamais partagé. Un isolat qui
/// démarre n'en a donc aucun : sa première requête authentifiée part sans
/// porteur valide, revient en 401, et déclenche un renouvellement. C'est vrai à
/// *chaque* réveil du worker, et à *chaque* démarrage à froid de l'app.
///
/// Quand les deux coïncident : un worker périodique toutes les 15 minutes, une
/// app qu'on ouvre : les deux isolats présentent le même jeton de
/// renouvellement à quelques millisecondes d'intervalle. Le serveur fait
/// tourner le jeton pour le premier et voit un **rejeu** pour le second : il
/// révoque toute la famille (`REFRESH_TOKEN_REPLAYED`), et le commercial est
/// déconnecté en pleine tournée, sans avoir rien fait de mal.
///
/// Le verrou sérialise les deux renouvellements. Deux rotations *successives*
/// sont parfaitement légales : c'est leur simultanéité qui déclenche la
/// détection de rejeu.
abstract interface class RefreshMutex {
  /// Exécute [body] en exclusion mutuelle avec les autres isolats.
  ///
  /// L'implémentation doit relire le jeton **après** avoir pris le verrou :
  /// l'isolat qui vient de le libérer l'a très probablement fait tourner, et
  /// rejouer celui qu'on avait lu avant d'attendre serait exactement le rejeu
  /// qu'on cherche à éviter.
  Future<T> protect<T>(Future<T> Function() body);
}

/// Implémentation neutre : exécute sans verrouiller.
///
/// C'est le comportement attendu partout où il n'y a qu'un isolat : les tests,
/// et tout client construit sans base.
class NoRefreshMutex implements RefreshMutex {
  const NoRefreshMutex();

  @override
  Future<T> protect<T>(Future<T> Function() body) => body();
}
