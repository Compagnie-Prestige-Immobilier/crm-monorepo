import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/background/background_sync.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/settings/display_settings.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/theme/cpi_typography.dart';
import '../../auth/auth_state.dart';

/// Réglages : profil, synchronisation, affichage, session.
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
    BackgroundSync.lastRunAt().then((DateTime? value) {
      if (mounted) {
        setState(() {
          _lastBackgroundRun = value;
          _loadedBackground = true;
        });
      }
    });
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
      appBar: AppBar(title: const Text('Réglages')),
      body: ListView(
        // Marge haute réduite : le premier contenu utile commence à 12 dp du
        // bandeau, pas à 16. Sur un écran de 360 dp, chaque bande vide en haut
        // pousse le reste hors de portée du pouce.
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
                // L'identifiant technique a disparu d'ici. Un UUID sous un nom
                // n'apprend rien à personne ; il vit désormais dans
                // « À propos », où il sert au support.
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
                  size: 26,
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
                            : 'Dernier envoi ${_relative(sync.lastRunAt!)}'
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
                onPressed: sync.running
                    ? null
                    : () {
                        HapticFeedback.selectionClick();
                        ref.read(syncCoordinatorProvider.notifier).run();
                      },
                icon: sync.running
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(PhosphorIconsRegular.arrowsClockwise, size: 20),
                label: const Text('Synchroniser maintenant'),
              ),
            ],
          ),

          // ── Affichage ────────────────────────────────────────────────────
          //
          // Le réglage vit ici et pas dans les réglages d'Android : la moitié
          // des ROM du parc enterrent la taille de police sous trois niveaux de
          // menu, et un utilisateur qui ne lit pas l'écran ne va pas partir la
          // chercher. Le choix de l'app se multiplie au choix système, il ne le
          // remplace pas.
          _Section(
            title: 'Affichage',
            children: <Widget>[
              Text(
                'Taille du texte',
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: CpiSpacing.xs),
              _TextScaleChoice(
                value: display.textScale,
                onChanged: (CpiTextScale value) {
                  HapticFeedback.selectionClick();
                  ref
                      .read(displaySettingsProvider.notifier)
                      .setTextScale(value);
                },
              ),
              const SizedBox(height: CpiSpacing.xs),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: display.reduceMotion,
                onChanged: (bool value) {
                  HapticFeedback.selectionClick();
                  ref
                      .read(displaySettingsProvider.notifier)
                      .setReduceMotion(value: value);
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
                    border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.4)),
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
                  size: 26,
                ),
                title: const Text('Autorisations d\'arrière-plan'),
                trailing: const Icon(PhosphorIconsRegular.caretRight, size: 20),
                // `push` et non `go` : `go` remplace la pile de navigation, et
                // la flèche de retour de l'écran d'arrivée n'a alors plus rien
                // à dépiler.
                onTap: () => context.push(Routes.batteryHelp),
              ),
            ],
          ),

          _Section(
            title: 'Application',
            children: <Widget>[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(PhosphorIconsRegular.info, size: 26),
                title: const Text('À propos'),
                subtitle: Text('Version, serveur, support'),
                trailing: const Icon(PhosphorIconsRegular.caretRight, size: 20),
                onTap: () => context.push(Routes.about),
              ),
            ],
          ),

          _Section(
            title: 'Session',
            children: <Widget>[
              OutlinedButton.icon(
                onPressed: () => _signOut(context, pending),
                icon: const Icon(PhosphorIconsRegular.signOut, size: 20),
                label: const Text('Se déconnecter'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Ligne d'identité : rôle et adresse, dans cet ordre de priorité.
  static String _profileLine(AuthState auth) {
    final List<String> parts = <String>[
      if (auth.roleLabel != null) auth.roleLabel!,
      if (auth.email != null && auth.email!.isNotEmpty) auth.email!,
    ];
    return parts.isEmpty ? 'Session active' : parts.join(' · ');
  }

  /// Heuristique « la dernière tâche de fond date de N jours ».
  ///
  /// C'est le seul signal observable qu'une ROM constructeur tue nos workers :
  /// Android ne dit jamais « j'ai supprimé votre tâche ». On ne l'affiche pas
  /// tout de suite après l'installation : quelqu'un qui vient d'installer n'a
  /// évidemment pas encore de tâche de fond exécutée.
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

  Future<void> _signOut(BuildContext context, int pending) async {
    // Déconnexion BLOQUÉE tant que la file n'est pas vide.
    //
    // `signOut` efface les jetons ; l'outbox, elle, survit dans la base. Mais
    // sans session, plus rien ne peut partir, et si l'utilisateur se reconnecte
    // avec un autre compte, ses opérations partiraient sous une identité qui
    // n'est pas celle qui les a saisies : le serveur les refuserait en
    // `ENTITY_ID_OWNED_BY_ANOTHER_USER`.
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
                ref.read(syncCoordinatorProvider.notifier).run();
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
    await ref.read(authControllerProvider.notifier).signOut();
    await ref.read(routeMemoryProvider).clear();
  }

  static const String _pendingTitle = 'Saisies en attente';

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'C';
    final List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first).toUpperCase();
  }

  static String _relative(DateTime when) {
    final Duration delta = DateTime.now().difference(when);
    if (delta.inMinutes < 1) return 'à l\'instant';
    if (delta.inHours < 1) return 'il y a ${delta.inMinutes} min';
    if (delta.inDays < 1) return 'il y a ${delta.inHours} h';
    return 'le ${DateFormat('d MMMM à HH:mm', 'fr').format(when)}';
  }
}

/// Trois paliers de taille, en segments.
///
/// Segments et non menu déroulant : les trois choix sont visibles d'un coup, et
/// le résultat se voit immédiatement sur l'écran qui les porte.
class _TextScaleChoice extends StatelessWidget {
  const _TextScaleChoice({required this.value, required this.onChanged});

  final CpiTextScale value;
  final ValueChanged<CpiTextScale> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<CpiTextScale>(
      segments: <ButtonSegment<CpiTextScale>>[
        for (final CpiTextScale scale in CpiTextScale.values)
          ButtonSegment<CpiTextScale>(
            value: scale,
            label: Text(scale.label),
          ),
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
          // 14 sp gras et non `labelSmall` 11 : capitalisé et espacé, un
          // libellé perd en lisibilité à taille égale (voir CpiTypography).
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
