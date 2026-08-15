import 'dart:async';
import 'dart:developer' as developer;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ce que l'interface a le droit d'affirmer sur le réseau.
///
/// Trois valeurs, et chacune repose sur une preuve différente.
///
/// `connectivity_plus` mesure **l'interface, pas l'accessibilité**. Sur les
/// réseaux mobiles sénégalais, un lien dégradé annonce `mobile` alors que plus
/// rien ne route : c'est le cas fréquent, pas le cas limite. Un état
/// « connecté » affirmé sur cette seule base serait donc un mensonge une fois
/// sur trois : c'est pourquoi [online] ne veut pas dire « ça marche », mais
/// « rien ne prouve le contraire », et l'écran n'en dit rien.
///
/// [unreachable] comble exactement ce trou, **sans un octet de réseau
/// supplémentaire** : quand le moteur de synchronisation vient d'échouer sur un
/// lien mort (`NETWORK`, `TIMEOUT`, corps non-JSON d'un portail captif), on sait
/// : par expérience directe, pas par supposition : que rien ne sort. Sans cette
/// valeur, un portail captif ou une carte SIM sans crédit affichaient
/// exactement la même chose qu'une connexion saine : rien.
enum CpiConnectivity {
  /// Une interface est active et rien ne prouve qu'elle ne route pas.
  online,

  /// Une interface est active, mais la dernière tentative réelle n'est pas
  /// sortie : portail captif, forfait épuisé, antenne saturée.
  unreachable,

  /// Aucune interface active. La seule affirmation vraiment certaine.
  offline,
}

/// Durée pendant laquelle un échec de lien reste une preuve.
///
/// Trois minutes : assez pour couvrir plusieurs cycles de synchronisation (le
/// minuteur de premier plan tourne toutes les 60 s), assez court pour que
/// l'indicateur s'efface tout seul quand le réseau revient, sans attendre un
/// succès explicite.
const Duration kUnreachableFreshness = Duration(minutes: 3);

/// Dernier instant où une requête réelle n'est pas sortie.
///
/// Alimenté par le coordinateur de synchronisation, qui est le seul endroit de
/// l'app à parler réellement au serveur. C'est de la **preuve**, pas une
/// mesure : elle ne coûte aucune requête.
final NotifierProvider<UnreachableEvidence, DateTime?> unreachableEvidenceProvider =
    NotifierProvider<UnreachableEvidence, DateTime?>(UnreachableEvidence.new);

class UnreachableEvidence extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  /// Le lien est mort : le moteur vient de rentrer bredouille.
  void record(DateTime at) => state = at;

  /// Quelque chose est passé : la preuve tombe immédiatement, sans attendre son
  /// expiration.
  void clear() => state = null;
}

/// Le verdict d'accès Internet que le SYSTÈME a déjà calculé.
///
/// ═══ POURQUOI CE CANAL PLUTÔT QU'UNE SONDE HTTP ═══
///
/// `connectivity_plus` mesure l'interface. Android, lui, sait si cette interface
/// route : `NET_CAPABILITY_VALIDATED` est posée après SA propre sonde de portail
/// captif. C'est la même capacité que `androidx.work` consulte pour
/// `NetworkType.connected`, ce qui explique que la contrainte du worker de fond
/// soit plus stricte que ce que l'application croit savoir.
///
/// L'alternative aurait été une bibliothèque de vérification qui interroge un
/// hôte public toutes les dix secondes. Elle est exclue : derrière le CGNAT d'un
/// opérateur sénégalais, une cinquantaine d'appareils partagent une IP publique
/// et épuiseraient le plafond de 300 requêtes/minute de l'API, qui répondrait
/// alors 429 au trafic de synchronisation réel. Ce canal-ci coûte **zéro octet**.
abstract interface class NetworkValidation {
  /// `true` validé, `false` infirmé, `null` « le système ne sait pas encore ».
  ///
  /// Les trois valeurs comptent. Juste après un changement d'antenne, la sonde
  /// système n'a pas tranché ; répondre `false` ferait clignoter un bandeau de
  /// panne à chaque déplacement.
  Future<bool?> isValidated();
}

class PlatformNetworkValidation implements NetworkValidation {
  const PlatformNetworkValidation();

  static const MethodChannel channel = MethodChannel('sn.cpi.go/network');

  @override
  Future<bool?> isValidated() async {
    try {
      return await channel.invokeMethod<bool>('isValidated');
    } on Object catch (error) {
      // Plateforme sans le canal (test, aperçu, iOS) : on ne sait pas, et
      // « on ne sait pas » n'est pas « en panne ».
      developer.log(
        'Verdict de validation réseau indisponible : $error',
        name: 'cpi.connectivity',
      );
      return null;
    }
  }
}

final Provider<NetworkValidation> networkValidationProvider =
    Provider<NetworkValidation>((Ref ref) => const PlatformNetworkValidation());

/// Le verdict système, relu à chaque changement d'interface.
///
/// Relu et non écouté en continu : la capacité ne change que lorsque le réseau
/// change, et c'est précisément ce que [connectivityResultsProvider] rapporte.
/// Un écouteur permanent serait un quatrième `NetworkCallback`.
final FutureProvider<bool?> networkValidatedProvider = FutureProvider<bool?>((
  Ref ref,
) async {
  // La dépendance est explicite : à chaque nouvel état d'interface, on redemande
  // au système son verdict.
  ref.watch(connectivityResultsProvider);
  return ref.watch(networkValidationProvider).isValidated();
});

/// D'où viennent les événements d'interface.
///
/// Une frontière et non un appel direct à `Connectivity()` : c'est la seule
/// façon de vérifier en test qu'une erreur du canal plateforme ne fige PAS
/// l'indicateur pour le reste de la session.
abstract interface class ConnectivitySource {
  Future<List<ConnectivityResult>> current();

  Stream<List<ConnectivityResult>> changes();
}

class PlatformConnectivitySource implements ConnectivitySource {
  PlatformConnectivitySource([Connectivity? connectivity])
    : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Future<List<ConnectivityResult>> current() => _connectivity.checkConnectivity();

  @override
  Stream<List<ConnectivityResult>> changes() => _connectivity.onConnectivityChanged;
}

final Provider<ConnectivitySource> connectivitySourceProvider =
    Provider<ConnectivitySource>((Ref ref) => PlatformConnectivitySource());

/// Anti-rebond des DÉCLENCHEURS. Un basculement Wi-Fi → mobile émet trois ou
/// quatre événements en moins d'une seconde.
const Duration kConnectivityDebounce = Duration(seconds: 2);

/// **LA** source d'événements réseau de l'application : une seule.
///
/// Il y en avait trois : celle-ci, celle du coordinateur de synchronisation et
/// celle du contrôleur de mise à jour. Chacune enregistre un `NetworkCallback`
/// côté Android, chacune réveille l'isolat Dart à chaque bascule d'antenne, et
/// chacune portait son propre anti-rebond privé, donc son propre décalage. Trois
/// vérités possibles sur une seule question, et trois fois le coût.
///
/// Un `StreamProvider` non `autoDispose` : Riverpod partage l'abonnement entre
/// tous les observateurs, donc **un** enregistrement plateforme quel que soit le
/// nombre d'écrans montés.
///
/// **Il ne lève jamais.** Sur une plateforme sans le canal (test de widget,
/// aperçu), on retombe sur [ConnectivityResult.other] : une interface inconnue,
/// donc « en ligne » pour l'affichage et « facturée » pour le téléchargement
/// d'un APK. Se tromper vers « hors ligne » afficherait une panne inexistante
/// sur chaque écran ; se tromper vers « non facturée » coûterait plusieurs
/// mégaoctets du forfait personnel du commercial.
final StreamProvider<List<ConnectivityResult>> connectivityResultsProvider =
    StreamProvider<List<ConnectivityResult>>((Ref ref) async* {
      final ConnectivitySource source = ref.watch(connectivitySourceProvider);
      try {
        yield await source.current();
      } on Object catch (error) {
        developer.log(
          'État réseau initial indisponible sur cette plateforme : $error',
          name: 'cpi.connectivity',
        );
        yield const <ConnectivityResult>[ConnectivityResult.other];
      }
      // `handleError` DANS le flux, et non un `try` autour du `yield*`.
      //
      // Le `try` englobant attrapait l'erreur, émettait « en ligne » et
      // **terminait le générateur** : l'indicateur affirmait ensuite « en
      // ligne » pour le reste de la session, quoi qu'il arrive au réseau. Une
      // erreur ponctuelle du canal plateforme condamnait donc définitivement le
      // seul signal réseau de l'application.
      //
      // Ici, l'erreur est journalisée et **avalée** : le flux continue de
      // livrer les événements suivants.
      yield* source.changes().handleError((Object error, StackTrace stack) {
        developer.log(
          'Événement réseau ignoré : $error',
          name: 'cpi.connectivity',
          stackTrace: stack,
        );
      });
    });

/// Les CHANGEMENTS de réseau, anti-rebondis, pour ceux qui en tirent une action.
///
/// Distinct de [connectivityResultsProvider], qui est lu pour AFFICHER : un
/// indicateur doit basculer tout de suite, une vidange doit attendre que
/// l'interface se stabilise. Et distinct de son premier événement : l'état
/// initial n'est pas un changement, et le confondre relançait un cycle complet à
/// chaque construction de provider.
final StreamProvider<List<ConnectivityResult>> connectivityTriggerProvider =
    StreamProvider<List<ConnectivityResult>>((Ref ref) {
      final StreamController<List<ConnectivityResult>> out =
          StreamController<List<ConnectivityResult>>();
      Timer? debounce;
      ref.listen<AsyncValue<List<ConnectivityResult>>>(connectivityResultsProvider, (
        AsyncValue<List<ConnectivityResult>>? previous,
        AsyncValue<List<ConnectivityResult>> next,
      ) {
        final List<ConnectivityResult>? results = next.value;
        // `previous?.value == null` : on passe de « pas encore connu » au
        // premier état. Ce n'est pas un changement de réseau.
        if (results == null || previous?.value == null) return;
        debounce?.cancel();
        debounce = Timer(kConnectivityDebounce, () {
          if (!out.isClosed) out.add(results);
        });
      });
      ref.onDispose(() {
        debounce?.cancel();
        unawaited(out.close());
      });
      return out.stream;
    });

/// État de l'interface réseau, tel que la plateforme le rapporte.
final Provider<AsyncValue<CpiConnectivity>> connectivityInterfaceProvider =
    Provider<AsyncValue<CpiConnectivity>>(
      (Ref ref) => ref.watch(connectivityResultsProvider).whenData(_classify),
    );

/// Le lien est-il facturé au mégaoctet ?
///
/// Wi-Fi ou Ethernet : non. Tout le reste, y compris l'inconnu : oui. Se tromper
/// vers « on demande d'abord » coûte un appui ; se tromper vers « on
/// télécharge » coûte plusieurs mégaoctets au commercial.
bool isUnmeteredLink(List<ConnectivityResult> results) => results.any(
  (ConnectivityResult r) =>
      r == ConnectivityResult.wifi || r == ConnectivityResult.ethernet,
);

/// État réseau exposé à l'interface : interface **et** preuve d'accessibilité.
///
/// Un `Provider` synchrone et non un `StreamProvider` : les écrans en tirent une
/// décision d'affichage immédiate, et un `AsyncValue` les obligeait tous à
/// écrire `.value == …`, c'est-à-dire à traiter « pas encore connu » comme
/// « en ligne » chacun de leur côté.
final Provider<CpiConnectivity> connectivityProvider = Provider<CpiConnectivity>((
  Ref ref,
) {
  final CpiConnectivity interface =
      ref.watch(connectivityInterfaceProvider).value ?? CpiConnectivity.online;
  // Aucune interface : c'est certain, et ça prime sur tout le reste.
  if (interface == CpiConnectivity.offline) return CpiConnectivity.offline;

  // ═══ LE VERDICT DU SYSTÈME, AVANT NOTRE PROPRE EXPÉRIENCE ═══
  //
  // Android a déjà sondé le portail captif. Quand il dit explicitement « non
  // validé », c'est la meilleure information disponible et elle arrive AVANT
  // notre premier échec de synchronisation : l'utilisateur voit « serveur
  // injoignable » dès qu'il entre dans la salle de formation, au lieu de le
  // découvrir après un cycle raté.
  //
  // `null` (le système n'a pas encore tranché) ne conclut rien : on retombe sur
  // la preuve d'expérience ci-dessous.
  final bool? validated = ref.watch(networkValidatedProvider).value;
  if (validated == false) return CpiConnectivity.unreachable;

  final DateTime? failedAt = ref.watch(unreachableEvidenceProvider);
  if (failedAt == null) return CpiConnectivity.online;
  final Duration age = DateTime.now().difference(failedAt);
  return age.isNegative || age > kUnreachableFreshness
      ? CpiConnectivity.online
      : CpiConnectivity.unreachable;
});

CpiConnectivity _classify(List<ConnectivityResult> results) {
  // `none` seul, ou liste vide : aucune interface active. Tout le reste est
  // « on ne sait pas », traité comme en ligne.
  final bool hasInterface = results.any(
    (ConnectivityResult r) => r != ConnectivityResult.none,
  );
  return hasInterface ? CpiConnectivity.online : CpiConnectivity.offline;
}
