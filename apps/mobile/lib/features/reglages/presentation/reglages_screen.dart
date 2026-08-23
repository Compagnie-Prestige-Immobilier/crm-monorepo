import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/background/background_sync.dart';
import '../../../core/providers/app_providers.dart';
import '../../auth/auth_controller.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_memory.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/settings/display_settings.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/theme/cpi_typography.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../auth/auth_state.dart';
import '../../../core/router/single_push.dart';

class ReglagesScreen extends ConsumerStatefulWidget {
  const ReglagesScreen({super.key});

  @override
  ConsumerState<ReglagesScreen> createState() => _ReglagesScreenState();
}

class _ReglagesScreenState extends ConsumerState<ReglagesScreen> {
  DateTime? _lastBackgroundRun;
  bool _loadedBackground = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadBackgroundRun());
  }

  Future<void> _loadBackgroundRun() async {
    DateTime? value;
    try {
      value = await BackgroundSync.lastRunAt();
    } on Object {
      value = null;
    }
    if (!mounted) return;
    setState(() {
      _lastBackgroundRun = value;
      _loadedBackground = true;
    });
  }

  void _persist(Future<void> write) {
    unawaited(
      write.onError((Object _, StackTrace _) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Réglage appliqué, mais pas enregistré : il repartira au '
              'redémarrage.',
            ),
          ),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AuthState auth = ref.watch(authControllerProvider);
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final DisplaySettings display = ref.watch(displaySettingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Réglages'),
        actions: const <Widget>[
          OfflineIndicator(),
          SyncBadge(),
          SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          CpiSpacing.sm,
          CpiSpacing.md,
          CpiSpacing.md,
        ),
        children: <Widget>[
          _Section(
            title: 'Profil',
            children: <Widget>[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  radius: 24,
                  backgroundColor: theme.colorScheme.primary,
                  child: Text(
                    _initials(auth.fullName),
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: theme.colorScheme.onPrimary,
                    ),
                  ),
                ),
                title: Text(
                  auth.fullName ?? 'Compte',
                  style: theme.textTheme.titleSmall,
                ),
                subtitle: Text(_profileLine(auth)),
              ),
            ],
          ),
          _Section(
            title: 'Synchronisation',
            children: <Widget>[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  pending == 0
                      ? PhosphorIconsRegular.checkCircle
                      : PhosphorIconsRegular.cloudArrowUp,
                  size: CpiIconSize.xl,
                  color: pending == 0 ? cpi.success : cpi.accentText,
                ),
                title: Text(
                  pending == 0
                      ? 'Tout est envoyé'
                      : '$pending élément${pending > 1 ? 's' : ''} en attente',
                ),
                subtitle: Text(
                  pending == 0
                      ? sync.lastRunAt == null
                            ? 'Aucun envoi'
                            : 'Dernier envoi ${relativeTime(sync.lastRunAt!)}'
                      : 'En attente d\'envoi',
                ),
              ),
              if (sync.lastError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                  child: Text(
                    'Dernière erreur : ${sync.lastError}',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cpi.syncFailed,
                    ),
                  ),
                ),
              FilledButton.tonalIcon(
                style: FilledButton.styleFrom(
                  backgroundColor: theme.colorScheme.secondaryContainer,
                  foregroundColor: theme.colorScheme.primary,
                ),
                onPressed: sync.running
                    ? null
                    : () {
                        HapticFeedback.selectionClick().ignore();
                        unawaited(
                          ref.read(syncCoordinatorProvider.notifier).run(),
                        );
                      },
                icon: sync.running
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(
                        PhosphorIconsRegular.arrowsClockwise,
                        size: CpiIconSize.md,
                      ),
                label: const Text('Synchroniser maintenant'),
              ),
            ],
          ),

          _Section(
            title: 'Affichage',
            children: <Widget>[
              Text('Taille du texte', style: theme.textTheme.bodyLarge),
              const SizedBox(height: CpiSpacing.xs),
              _TextScaleChoice(
                value: display.textScale,
                onChanged: (CpiTextScale value) {
                  HapticFeedback.selectionClick().ignore();
                  _persist(
                    ref
                        .read(displaySettingsProvider.notifier)
                        .setTextScale(value),
                  );
                },
              ),
              const SizedBox(height: CpiSpacing.xs),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: display.reduceMotion,
                onChanged: (bool value) {
                  HapticFeedback.selectionClick().ignore();
                  _persist(
                    ref
                        .read(displaySettingsProvider.notifier)
                        .setReduceMotion(value: value),
                  );
                },
                title: const Text('Réduire les animations'),
                subtitle: const Text('Transitions instantanées'),
              ),
            ],
          ),

          _Section(
            title: 'Arrière-plan',
            children: <Widget>[
              if (_shouldSuggestBatteryHelp) ...<Widget>[
                Container(
                  padding: const EdgeInsets.all(CpiSpacing.sm),
                  decoration: BoxDecoration(
                    color: cpi.accentSurface,
                    borderRadius: CpiRadius.brMd,
                    border: Border.all(
                      color: cpi.accentBorder.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Text(
                    _backgroundDiagnosis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cpi.accentText,
                    ),
                  ),
                ),
                const SizedBox(height: CpiSpacing.xs),
              ],
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  PhosphorIconsRegular.batteryCharging,
                  size: CpiIconSize.xl,
                ),
                title: const Text('Autorisations d\'arrière-plan'),
                trailing: const Icon(
                  PhosphorIconsRegular.caretRight,
                  size: CpiIconSize.md,
                ),
                onTap: () => context.pushOnce(Routes.batteryHelp),
              ),
            ],
          ),

          _Section(
            title: 'Application',
            children: <Widget>[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  PhosphorIconsRegular.info,
                  size: CpiIconSize.xl,
                ),
                title: const Text('À propos'),
                subtitle: const Text('Version, serveur, support'),
                trailing: const Icon(
                  PhosphorIconsRegular.caretRight,
                  size: CpiIconSize.md,
                ),
                onTap: () => context.pushOnce(Routes.about),
              ),
            ],
          ),

          _Section(
            title: 'Session',
            children: <Widget>[
              OutlinedButton.icon(
                onPressed: () => unawaited(_signOut(pending)),
                icon: const Icon(
                  PhosphorIconsRegular.signOut,
                  size: CpiIconSize.md,
                ),
                label: const Text('Se déconnecter'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _profileLine(AuthState auth) {
    final List<String> parts = <String>[
      if (auth.roleLabel != null) auth.roleLabel!,
      if (auth.email != null && auth.email!.isNotEmpty) auth.email!,
    ];
    return parts.isEmpty ? 'Session active' : parts.join(' · ');
  }

  bool get _shouldSuggestBatteryHelp {
    if (!_loadedBackground) return false;
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return false;
    return DateTime.now().toUtc().difference(last) > const Duration(days: 2);
  }

  String get _backgroundDiagnosis {
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return 'Aucun envoi en arrière-plan.';
    final int days = DateTime.now().toUtc().difference(last).inDays;
    return 'Dernier envoi en arrière-plan il y a $days jour'
        '${days > 1 ? 's' : ''}. Le téléphone bloque l\'app en arrière-plan.';
  }

  Future<void> _signOut(int pending) async {
    // Lus AVANT toute attente : la boîte de confirmation puis `signOut`
    // démontent l'écran, et un `ref` relu après porterait sur un widget mort —
    // la mémoire de route n'était jamais effacée, la session suivante rouvrait
    // l'écran du précédent utilisateur.
    final RouteMemory memoire = ref.read(routeMemoryProvider);
    final AuthController auth = ref.read(authControllerProvider.notifier);

    if (pending > 0) {
      final bool? force = await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text(_pendingTitle),
          content: Text(
            '$pending élément${pending > 1 ? 's' : ''} en attente d\'envoi. '
            'Ces saisies ne partiront qu\'à la prochaine connexion avec ce '
            'compte. Synchronisez d\'abord.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop(false);
                unawaited(ref.read(syncCoordinatorProvider.notifier).run());
              },
              child: const Text('Synchroniser'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Se déconnecter'),
            ),
          ],
        ),
      );
      if (force != true) return;
    }
    try {
      await auth.signOut();
      await memoire.clear();
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Déconnexion impossible. Réessayez.')),
      );
    }
  }

  static const String _pendingTitle = 'Saisies en attente';

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'C';
    final List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }
}

class _TextScaleChoice extends StatelessWidget {
  const _TextScaleChoice({required this.value, required this.onChanged});

  final CpiTextScale value;
  final ValueChanged<CpiTextScale> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<CpiTextScale>(
      segments: <ButtonSegment<CpiTextScale>>[
        for (final CpiTextScale scale in CpiTextScale.values)
          ButtonSegment<CpiTextScale>(value: scale, label: Text(scale.label)),
      ],
      selected: <CpiTextScale>{value},
      showSelectedIcon: false,
      onSelectionChanged: (Set<CpiTextScale> selection) =>
          onChanged(selection.first),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: CpiSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            title.toUpperCase(),
            style: CpiTypography.sectionLabel.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          ...children,
        ],
      ),
    );
  }
}
