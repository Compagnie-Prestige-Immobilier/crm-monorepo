import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/background/background_sync.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/sync_engine.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../auth/auth_state.dart';

/// Réglages : profil, synchronisation manuelle, déconnexion.
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

    return Scaffold(
      appBar: AppBar(title: const Text('Réglages')),
      body: ListView(
        padding: const EdgeInsets.all(CpiSpacing.md),
        children: <Widget>[
          _Section(
            title: 'Profil',
            children: <Widget>[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: theme.colorScheme.primary,
                  child: Text(
                    _initials(auth.fullName),
                    style: TextStyle(color: theme.colorScheme.onPrimary),
                  ),
                ),
                title: Text(auth.fullName ?? 'Commercial'),
                subtitle: Text(auth.userId ?? '—', style: theme.textTheme.bodySmall),
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
                  color: pending == 0 ? cpi.success : cpi.accentText,
                ),
                title: Text(
                  pending == 0
                      ? 'Tout est envoyé'
                      : '$pending élément${pending > 1 ? 's' : ''} en attente',
                ),
                // Aucune promesse de délai : WorkManager ne la tiendrait pas, et
                // une promesse non tenue sur des données saisies détruit la
                // confiance dans l'app entière.
                subtitle: Text(
                  pending == 0
                      ? sync.lastRunAt == null
                            ? 'Aucune synchronisation depuis le lancement.'
                            : 'Dernier envoi ${_relative(sync.lastRunAt!)}.'
                      : 'Sera envoyé dès que possible.',
                ),
              ),
              if (sync.lastError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                  child: Text(
                    'Dernière erreur : ${sync.lastError}',
                    style: theme.textTheme.bodySmall?.copyWith(color: cpi.syncFailed),
                  ),
                ),
              FilledButton.tonalIcon(
                onPressed: sync.running
                    ? null
                    : () => ref.read(syncCoordinatorProvider.notifier).run(),
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
          if (_shouldSuggestBatteryHelp)
            _Section(
              title: 'Arrière-plan',
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(CpiSpacing.sm),
                  decoration: BoxDecoration(
                    color: cpi.accentSurface,
                    borderRadius: CpiRadius.brMd,
                    border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        _backgroundDiagnosis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: cpi.accentText,
                        ),
                      ),
                      const SizedBox(height: CpiSpacing.xs),
                      TextButton.icon(
                        onPressed: () => context.go(Routes.batteryHelp),
                        icon: const Icon(PhosphorIconsRegular.batteryWarning, size: 18),
                        label: const Text('Autorisations & batterie'),
                      ),
                    ],
                  ),
                ),
              ],
            )
          else
            _Section(
              title: 'Arrière-plan',
              children: <Widget>[
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(PhosphorIconsRegular.batteryCharging),
                  title: const Text('Autorisations & batterie'),
                  subtitle: const Text(
                    'Vérifier que le téléphone laisse l\'app envoyer en fond.',
                  ),
                  trailing: const Icon(PhosphorIconsRegular.caretRight, size: 18),
                  onTap: () => context.go(Routes.batteryHelp),
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
          const SizedBox(height: CpiSpacing.md),
          Center(
            child: Text(
              'Version ${ref.watch(buildNumberProvider)} · '
              'payload v${SyncEngine.payloadVersion}',
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Heuristique « la dernière tâche de fond date de N jours ».
  ///
  /// C'est le seul signal observable qu'une ROM constructeur tue nos workers :
  /// Android ne dit jamais « j'ai supprimé votre tâche ». On ne l'affiche pas
  /// tout de suite après l'installation — un utilisateur qui vient d'installer
  /// n'a évidemment pas encore de tâche de fond exécutée, et l'alerter serait
  /// l'inquiéter pour rien.
  bool get _shouldSuggestBatteryHelp {
    if (!_loadedBackground) return false;
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return false;
    return DateTime.now().toUtc().difference(last) > const Duration(days: 2);
  }

  String get _backgroundDiagnosis {
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return 'Aucun envoi en arrière-plan n\'a encore eu lieu.';
    final int days = DateTime.now().toUtc().difference(last).inDays;
    return 'Le dernier envoi en arrière-plan date de $days jour'
        '${days > 1 ? 's' : ''}. Votre téléphone bloque probablement l\'app '
        'quand elle est fermée.';
  }

  Future<void> _signOut(BuildContext context, int pending) async {
    // Déconnexion BLOQUÉE tant que la file n'est pas vide.
    //
    // `signOut` efface les jetons ; l'outbox, elle, survit dans la base. Mais
    // sans session, plus rien ne peut partir, et si l'utilisateur se reconnecte
    // avec un autre compte, ses opérations partiraient sous une identité qui
    // n'est pas celle qui les a saisies — le serveur les refuserait en
    // `ENTITY_ID_OWNED_BY_ANOTHER_USER`. Mieux vaut un avertissement explicite
    // qu'une perte silencieuse.
    if (pending > 0) {
      final bool? force = await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text('Des saisies ne sont pas encore envoyées'),
          content: Text(
            '$pending élément${pending > 1 ? 's' : ''} attend'
            '${pending > 1 ? 'ent' : ''} d\'être envoyé'
            '${pending > 1 ? 's' : ''} au serveur.\n\n'
            'Si vous vous déconnectez maintenant, ces saisies resteront sur '
            'l\'appareil et ne partiront qu\'à votre prochaine connexion avec '
            'CE compte. Connectez-vous à une autre session et elles seront '
            'refusées.\n\n'
            'Synchronisez d\'abord si vous avez du réseau.',
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
              child: const Text('Se déconnecter quand même'),
            ),
          ],
        ),
      );
      if (force != true) return;
    }
    await ref.read(authControllerProvider.notifier).signOut();
    await ref.read(routeMemoryProvider).clear();
  }

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

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: CpiSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            title.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          ...children,
        ],
      ),
    );
  }
}
