import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// Où en est l'application vis-à-vis de la position de l'appareil.
///
/// Quatre états, pas un booléen : « refusé une fois » et « refusé
/// définitivement » n'appellent pas la même réponse — le premier peut être
/// redemandé, le second ne peut être levé que dans les réglages du système.
enum LocationStatus {
  unknown,
  granted,
  denied,
  deniedForever,
  serviceDisabled,
}

class LocationState {
  const LocationState({
    this.status = LocationStatus.unknown,
    this.latitude,
    this.longitude,
    this.isResolving = false,
  });

  final LocationStatus status;
  final double? latitude;
  final double? longitude;
  final bool isResolving;

  bool get hasPosition => latitude != null && longitude != null;

  LocationState copyWith({
    LocationStatus? status,
    double? latitude,
    double? longitude,
    bool? isResolving,
    bool clearPosition = false,
  }) {
    return LocationState(
      status: status ?? this.status,
      latitude: clearPosition ? null : latitude ?? this.latitude,
      longitude: clearPosition ? null : longitude ?? this.longitude,
      isResolving: isResolving ?? this.isResolving,
    );
  }
}

/// La position du client, quand il l'a accordée.
///
/// Rien n'est demandé au démarrage : l'accueil affiche « Près de chez vous »
/// avec un bouton, et la permission n'est réclamée qu'à ce moment. Avant cela
/// l'application ne suppose aucune position — elle en inventait une, le centre
/// de Dakar, pour tout le pays.
class LocationController extends Notifier<LocationState> {
  @override
  LocationState build() => const LocationState();

  /// Reprend une autorisation déjà accordée, sans jamais afficher de demande.
  Future<void> refreshIfGranted() async {
    final permission = await Geolocator.checkPermission();
    if (permission != LocationPermission.always &&
        permission != LocationPermission.whileInUse) {
      return;
    }
    await _resolvePosition();
  }

  /// Demande la permission puis la position. Appelé par un geste explicite.
  Future<void> requestPosition() async {
    if (state.isResolving) return;
    state = state.copyWith(isResolving: true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        state = state.copyWith(status: LocationStatus.serviceDisabled);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(status: LocationStatus.deniedForever);
        return;
      }
      if (permission == LocationPermission.denied) {
        state = state.copyWith(status: LocationStatus.denied);
        return;
      }
      await _resolvePosition();
    } finally {
      state = state.copyWith(isResolving: false);
    }
  }

  /// Ouvre les réglages du système : seul recours après un refus définitif.
  Future<void> openSystemSettings() => Geolocator.openAppSettings();

  void clear() {
    state = const LocationState(status: LocationStatus.denied);
  }

  Future<void> _resolvePosition() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );
      state = state.copyWith(
        status: LocationStatus.granted,
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (_) {
      // Un relevé qui n'aboutit pas n'est pas un refus : la permission reste
      // accordée, il n'y a simplement pas de point à montrer.
      state = state.copyWith(
        status: LocationStatus.granted,
        clearPosition: true,
      );
    }
  }
}

final locationControllerProvider =
    NotifierProvider<LocationController, LocationState>(LocationController.new);
