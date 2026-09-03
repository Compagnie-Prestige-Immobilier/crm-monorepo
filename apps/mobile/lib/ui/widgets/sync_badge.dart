import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../features/shell/app_shell.dart';
import 'appbar_badge.dart';

class SyncBadge extends ConsumerWidget {
  const SyncBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Le badge mène à « À corriger » : il doit donc compter AUSSI ce qui y
    // attend, sinon il annonce « Tout est synchronisé » sur une file bloquée.
    final int enAttente = ref.watch(pendingSyncCountProvider).value ?? 0;
    final int bloquees = ref.watch(blockedSyncCountProvider).value ?? 0;
    final int count = enAttente + bloquees;
    final bool clean = count == 0;

    return CpiAppBarBadge(
      icon: clean
          ? PhosphorIconsRegular.checkCircle
          : PhosphorIconsRegular.cloudSlash,
      label: clean
          ? 'Tout est synchronisé'
          : bloquees > 0
          ? '$bloquees saisie${bloquees > 1 ? 's' : ''} à corriger, '
                '$enAttente en attente d\'envoi'
          : '$count élément${count > 1 ? 's' : ''} en attente de synchronisation',
      count: count,
      emphasis: !clean,
      onTap: () => ouvrirCorrections(context),
    );
  }
}
