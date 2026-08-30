import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/sync/sync_providers.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/utils/app_logger.dart';
import '../../operations/controllers/operations_providers.dart';

/// Fait remonter un client au serveur.
///
/// Vivait uniquement dans le formulaire complet : un client créé pendant une
/// commande — le chemin le plus courant — restait sur l'appareil et n'existait
/// pour le serveur qu'après avoir été rouvert et réenregistré depuis la fiche.
/// Les commandes qui le désignent ne pouvaient donc pas être recopiées non plus.
class ClientSync {
  const ClientSync(this._ref);

  final Ref _ref;

  Future<void> queue(ClientModel client) async {
    try {
      final atelier = await _ref.read(primaryRemoteAtelierProvider.future);
      if (atelier == null) return;
      final coordinator = await _ref.read(syncCoordinatorProvider.future);
      await coordinator.enqueueClient(
        atelierId: atelier.id,
        localId: client.id.toString(),
        fullName: client.displayName,
        phone: client.phone,
        email: client.email,
        notes: client.notes,
      );
      _ref.invalidate(primarySyncSnapshotProvider);
      unawaited(coordinator.synchronize(atelier.id));
    } catch (error, stackTrace) {
      // Hors ligne, le client reste local et fait autorité : la file de
      // synchronisation le reprendra. L'échec n'interrompt jamais la saisie.
      AppLogger.e(
        'Client enregistré localement mais non mis en file de synchronisation',
        error,
        stackTrace,
      );
    }
  }
}

final clientSyncProvider = Provider<ClientSync>(ClientSync.new);
