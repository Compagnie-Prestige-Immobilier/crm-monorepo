import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ce que le canal `sn.cpi.go/updates` sait faire. Interface pour que les tests
/// n'aient pas besoin d'un vrai `PackageInstaller`.
abstract interface class UpdateInstaller {
  Future<bool> canInstall();

  Future<int> freeSpaceBytes(String directory);

  Future<void> install({required String path, String? signerSha256});

  Future<void> openUnknownSourcesSettings();

  /// Le verdict d'une session posée : appelé seulement quand elle échoue. Un
  /// succès n'arrive jamais ici, le processus est remplacé avant.
  void onFailure(void Function(String message) handler);
}

class PlatformUpdateInstaller implements UpdateInstaller {
  PlatformUpdateInstaller([
    this.channel = const MethodChannel(UpdatesChannelNames.installer),
  ]);

  final MethodChannel channel;
  void Function(String message)? _handler;
  bool _listening = false;

  @override
  Future<bool> canInstall() async =>
      await channel.invokeMethod<bool>('canInstall') ?? false;

  @override
  Future<int> freeSpaceBytes(String directory) async =>
      await channel.invokeMethod<int>('freeSpaceBytes', <String, dynamic>{
        'path': directory,
      }) ??
      0;

  @override
  Future<void> install({required String path, String? signerSha256}) async {
    await channel.invokeMethod<int>('install', <String, dynamic>{
      'path': path,
      'signerSha256': signerSha256,
    });
  }

  @override
  Future<void> openUnknownSourcesSettings() =>
      channel.invokeMethod<void>('openUnknownSourcesSettings');

  @override
  void onFailure(void Function(String message) handler) {
    _handler = handler;
    if (_listening) return;
    _listening = true;
    channel.setMethodCallHandler((MethodCall call) async {
      if (call.method != 'installFailed') return null;
      final Map<Object?, Object?> body = Map<Object?, Object?>.from(
        call.arguments as Map,
      );
      _handler?.call(
        installFailureMessage(
          (body['status'] as num?)?.toInt(),
          body['message'] as String?,
        ),
      );
      return null;
    });
  }
}

abstract final class UpdatesChannelNames {
  static const String installer = 'sn.cpi.go/updates';
}

/// Les `STATUS_FAILURE_*` de `PackageInstaller`, en français. Le détail système
/// est gardé en fin de phrase : c'est lui qui distingue deux refus de blocage.
String installFailureMessage(int? status, String? detail) {
  final String phrase = switch (status) {
    2 => 'L\'installation a été bloquée par le téléphone.',
    3 => 'L\'installation a été annulée.',
    4 => 'Le fichier de mise à jour est inutilisable.',
    5 => 'Cette mise à jour n\'est pas compatible avec la version installée.',
    6 => 'Espace insuffisant pour installer la mise à jour.',
    7 => 'L\'installation a échoué : incompatibilité avec cet appareil.',
    _ => 'L\'installation a échoué.',
  };
  final String? extra = detail?.trim();
  return extra == null || extra.isEmpty ? phrase : '$phrase ($extra)';
}

final Provider<UpdateInstaller> updateInstallerProvider =
    Provider<UpdateInstaller>((Ref ref) => PlatformUpdateInstaller());
