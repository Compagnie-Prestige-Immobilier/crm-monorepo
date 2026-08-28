import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:go_router/go_router.dart';

import '../../../core/background/background_sync.dart';
import '../../../core/feedback/feedback.dart';
import '../../../core/providers/app_providers.dart';
import '../../auth/auth_controller.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_memory.dart';
import '../../../core/router/route_paths.dart';
import '../../shell/app_shell.dart';
import '../../../core/settings/display_settings.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../accueil/visites_repository.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_kit.dart';
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

  void _persist(BuildContext context, Future<void> write) {
    unawaited(
      write.onError((Object _, StackTrace _) {
        if (!mounted || !context.mounted) return;
        cpiToast(
          context,
          'Réglage appliqué, mais pas enregistré : il repartira au '
          'redémarrage.',
          persistent: true,
        );
      }),
    );
  }

  void _basculerAnimations(BuildContext context, {required bool value}) {
    HapticFeedback.selectionClick().ignore();
    _persist(
      context,
      ref.read(displaySettingsProvider.notifier).setReduceMotion(value: value),
    );
  }

  /// Le réglage est écrit AVANT le retour : allumer les vibrations les fait
  /// sentir tout de suite, les éteindre ne vibre pas une dernière fois.
  void _basculerHaptiques(BuildContext context, {required bool value}) {
    _persist(
      context,
      ref.read(displaySettingsProvider.notifier).setHaptiques(value: value),
    );
    ref.read(feedbackProvider).choix();
  }

  void _basculerSons(BuildContext context, {required bool value}) {
    _persist(
      context,
      ref.read(displaySettingsProvider.notifier).setSons(value: value),
    );
    ref.read(feedbackProvider).etape();
  }

  @override
  Widget build(BuildContext context) {
    return CpiScaffold(
      title: 'Réglages',
      // `Builder` : les messages brefs et la feuille de déconnexion ont besoin
      // d'un contexte SOUS le `FToaster` que pose `CpiScaffold`.
      body: Builder(builder: _body),
    );
  }

  Widget _body(BuildContext context) {
    final AuthState auth = ref.watch(authControllerProvider);
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final int aCorriger = ref.watch(needsAttentionCountProvider).value ?? 0;
    final DisplaySettings display = ref.watch(displaySettingsProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.xl,
      ),
      children: <Widget>[
        _Section(
          title: 'Compte',
          card: CpiCard.rows(<CpiRow>[
            CpiRow(
              leading: FAvatar.raw(child: Text(_initials(auth.fullName))),
              title: auth.fullName ?? 'Compte',
              subtitle: auth.roleLabel ?? 'Session active',
            ),
            // Le registre est un autre projet : il se rejoint comme depuis le
            // hub, sans empiler d'écran par-dessus la coque CHUES.
            if (peutTenirLeRegistre(auth.role))
              CpiRow(
                title: 'Registre de l\'accueil',
                onTap: () => context.go(Routes.accueil),
              ),
          ]),
        ),

        _Section(
          title: 'Envois',
          band: _shouldSuggestBatteryHelp
              ? CpiStatusBand(
                  text: _backgroundDiagnosis,
                  tone: CpiTone.warning,
                  actionLabel: 'Corriger',
                  onAction: () => context.pushOnce(Routes.batteryHelp),
                )
              : null,
          card: CpiCard.rows(<CpiRow>[
            CpiRow(
              title: 'État',
              subtitle: _envoiLine(sync),
              trailing: pending == 0
                  ? const _Valeur('Tout est envoyé')
                  : CpiTag('$pending à envoyer', tone: CpiTone.warning),
            ),
            CpiRow(
              title: 'À corriger',
              trailing: _Valeur('$aCorriger', chevron: true),
              onTap: () => context.go(correctionsDeLaCoque(context)),
            ),
            CpiRow(
              leading: const Icon(
                PhosphorIconsRegular.cloudArrowUp,
                size: CpiIconSize.xl,
              ),
              title: 'Envoyer maintenant',
              trailing: sync.running
                  ? const FCircularProgress(
                      size: FCircularProgressSizeVariant.sm,
                    )
                  : _sansChevron,
              onTap: sync.running
                  ? null
                  : () => unawaited(
                      ref.read(syncCoordinatorProvider.notifier).run(),
                    ),
            ),
          ]),
        ),

        _Section(
          title: 'Affichage et retours',
          card: CpiCard.rows(<CpiRow>[
            CpiRow(
              title: 'Thème',
              trailing: _Valeur(
                _themeLabels[display.themeMode]!,
                chevron: true,
              ),
              onTap: () => _choisirTheme(context, display.themeMode),
            ),
            CpiRow(
              title: 'Taille du texte',
              trailing: _Valeur(display.textScale.label, chevron: true),
              onTap: () => _choisirTaille(context, display.textScale),
            ),
            _LigneInterrupteur(
              title: 'Réduire les animations',
              subtitle: 'Transitions instantanées',
              value: display.reduceMotion,
              trailing: FSwitch(
                value: display.reduceMotion,
                onChange: (bool value) =>
                    _basculerAnimations(context, value: value),
              ),
              onTap: () =>
                  _basculerAnimations(context, value: !display.reduceMotion),
            ),
            _LigneInterrupteur(
              title: 'Vibrations',
              subtitle: 'Retour au toucher et à l\'enregistrement',
              value: display.haptiques,
              trailing: FSwitch(
                value: display.haptiques,
                onChange: (bool value) =>
                    _basculerHaptiques(context, value: value),
              ),
              onTap: () =>
                  _basculerHaptiques(context, value: !display.haptiques),
            ),
            _LigneInterrupteur(
              title: 'Sons',
              subtitle: 'Coupés en mode silencieux',
              value: display.sons,
              trailing: FSwitch(
                value: display.sons,
                onChange: (bool value) => _basculerSons(context, value: value),
              ),
              onTap: () => _basculerSons(context, value: !display.sons),
            ),
          ]),
        ),

        _Section(
          title: 'Aide',
          card: CpiCard.rows(<CpiRow>[
            CpiRow(
              title: 'L\'app s\'arrête toute seule ?',
              onTap: () => context.pushOnce(Routes.batteryHelp),
            ),
            CpiRow(
              title: 'À propos',
              onTap: () => context.pushOnce(Routes.about),
            ),
          ]),
        ),

        _Section(
          title: 'Session',
          card: CpiCard.rows(<CpiRow>[
            CpiRow(
              title: 'Se déconnecter',
              danger: true,
              trailing: _sansChevron,
              onTap: () => unawaited(_signOut(context, pending)),
            ),
          ]),
        ),
      ],
    );
  }

  /// Un chevron promettrait un écran de plus : ces lignes AGISSENT.
  static const Widget _sansChevron = SizedBox.shrink();

  static const Map<ThemeMode, String> _themeLabels = <ThemeMode, String>{
    ThemeMode.system: 'Système',
    ThemeMode.light: 'Clair',
    ThemeMode.dark: 'Sombre',
  };

  static String? _envoiLine(SyncUiState sync) =>
      sync.failureLabel ??
      (sync.lastRunAt == null
          ? null
          : 'Dernier envoi ${relativeTime(sync.lastRunAt!)}');

  void _choisirTheme(BuildContext context, ThemeMode courant) {
    unawaited(
      showCpiSheet<void>(
        context,
        builder: (BuildContext sheet) => CpiChoiceGroup<ThemeMode>(
          label: 'Thème',
          value: courant,
          options: <CpiChoice<ThemeMode>>[
            for (final MapEntry<ThemeMode, String> entry
                in _themeLabels.entries)
              CpiChoice<ThemeMode>(value: entry.key, label: entry.value),
          ],
          onChanged: (ThemeMode mode) {
            Navigator.of(sheet).pop();
            if (mode == courant) return;
            _persist(
              context,
              ref.read(displaySettingsProvider.notifier).setThemeMode(mode),
            );
          },
        ),
      ),
    );
  }

  void _choisirTaille(BuildContext context, CpiTextScale courant) {
    unawaited(
      showCpiSheet<void>(
        context,
        builder: (BuildContext sheet) => CpiChoiceGroup<CpiTextScale>(
          label: 'Taille du texte',
          value: courant,
          options: <CpiChoice<CpiTextScale>>[
            for (final CpiTextScale scale in CpiTextScale.values)
              CpiChoice<CpiTextScale>(value: scale, label: scale.label),
          ],
          onChanged: (CpiTextScale scale) {
            Navigator.of(sheet).pop();
            if (scale == courant) return;
            HapticFeedback.selectionClick().ignore();
            _persist(
              context,
              ref.read(displaySettingsProvider.notifier).setTextScale(scale),
            );
          },
        ),
      ),
    );
  }

  bool get _shouldSuggestBatteryHelp {
    if (!_loadedBackground) return false;
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return false;
    return DateTime.now().toUtc().difference(last) > const Duration(days: 2);
  }

  String get _backgroundDiagnosis {
    final DateTime? last = _lastBackgroundRun;
    if (last == null) return 'L\'app n\'envoie rien quand elle est fermée.';
    final int days = DateTime.now().toUtc().difference(last).inDays;
    return 'L\'app n\'a rien envoyé depuis $days jour${days > 1 ? 's' : ''}. '
        'Le téléphone la bloque.';
  }

  Future<void> _signOut(BuildContext context, int pending) async {
    // Lus AVANT toute attente : la feuille de confirmation puis `signOut`
    // démontent l'écran, et un `ref` relu après porterait sur un widget mort —
    // la mémoire de route n'était jamais effacée, la session suivante rouvrait
    // l'écran du précédent utilisateur.
    final RouteMemory memoire = ref.read(routeMemoryProvider);
    final AuthController auth = ref.read(authControllerProvider.notifier);
    final SyncCoordinator sync = ref.read(syncCoordinatorProvider.notifier);

    final bool? partir = await _demanderLeDepart(context, pending, sync);
    if (partir != true) return;

    try {
      await auth.signOut();
      await memoire.clear();
    } on Object {
      if (!mounted || !context.mounted) return;
      cpiToast(context, 'Déconnexion impossible. Réessayez.', persistent: true);
    }
  }

  /// Partir n'est jamais silencieux : avec des saisies en attente la feuille
  /// propose d'abord de les envoyer, sinon une simple confirmation.
  Future<bool?> _demanderLeDepart(
    BuildContext context,
    int pending,
    SyncCoordinator sync,
  ) => pending > 0
      ? showCpiSheet<bool>(
          context,
          title: _pendingTitle,
          builder: (BuildContext sheet) => _PendingSignOut(sync: sync),
        )
      : cpiConfirm(
          context,
          title: _pendingTitle,
          message:
              'Vous devrez retaper votre mot de passe, et il faudra du réseau.',
          confirmLabel: 'Se déconnecter',
          danger: true,
        );

  static const String _pendingTitle = 'Se déconnecter ?';

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'C';
    final List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }
}

/// Valeur courante d'une ligne de réglage, à droite du nom.
class _Valeur extends StatelessWidget {
  const _Valeur(this.text, {this.chevron = false});

  final String text;

  /// Vrai quand la ligne ouvre une feuille de choix.
  final bool chevron;

  @override
  Widget build(BuildContext context) {
    final Color encre = Theme.of(context).colorScheme.onSurfaceVariant;
    final Widget label = Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(color: encre),
    );
    if (!chevron) return label;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Flexible(child: label),
        Icon(
          PhosphorIconsRegular.caretRight,
          size: CpiIconSize.lg,
          color: encre,
        ),
      ],
    );
  }
}

/// Une ligne à interrupteur rend UN seul nœud : nom, état et geste au même
/// endroit, sur toute la ligne et non sur les 59×39 dp de l'interrupteur.
/// La coquille est ici et non autour de la carte : `CpiCard.rows` n'accepte
/// que des `CpiRow`, et la carte porte d'autres lignes.
class _LigneInterrupteur extends CpiRow {
  const _LigneInterrupteur({
    required super.title,
    required String super.subtitle,
    required super.trailing,
    required VoidCallback super.onTap,
    required this.value,
  });

  final bool value;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    toggled: value,
    label: '$title. $subtitle',
    excludeSemantics: true,
    onTap: onTap,
    child: super.build(context),
  );
}

/// La feuille qui garde les saisies : elle reste ouverte pendant l'envoi et
/// rend compte du résultat, au lieu de se refermer sur une promesse.
class _PendingSignOut extends ConsumerStatefulWidget {
  const _PendingSignOut({required this.sync});

  final SyncCoordinator sync;

  @override
  ConsumerState<_PendingSignOut> createState() => _PendingSignOutState();
}

class _PendingSignOutState extends ConsumerState<_PendingSignOut> {
  bool _running = false;
  bool _ran = false;

  Future<void> _envoyer() async {
    setState(() => _running = true);
    await widget.sync.run();
    if (!mounted) return;
    setState(() {
      _running = false;
      _ran = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final bool parti = _ran && pending == 0;
    final String fiches = '$pending fiche${pending > 1 ? 's' : ''}';

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          switch ((parti, _ran)) {
            (true, _) => 'Tout est parti.',
            (_, true) =>
              'Il reste $fiches. Réessayez ou déconnectez-vous quand même.',
            _ =>
              '$fiches ne sont pas encore parties. '
                  'Elles attendront votre prochaine connexion.',
          },
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.lg),
        if (parti)
          CpiButton(
            'Se déconnecter',
            variant: CpiButtonVariant.danger,
            onPressed: () => Navigator.of(context).pop(true),
          )
        else ...<Widget>[
          CpiButton(
            _ran ? 'Réessayer' : 'Envoyer maintenant',
            icon: PhosphorIconsRegular.cloudArrowUp,
            loading: _running,
            onPressed: () => unawaited(_envoyer()),
          ),
          const SizedBox(height: CpiSpacing.xs),
          CpiButton(
            'Se déconnecter quand même',
            variant: CpiButtonVariant.danger,
            onPressed: _running ? null : () => Navigator.of(context).pop(true),
          ),
        ],
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Annuler',
          variant: CpiButtonVariant.ghost,
          onPressed: _running ? null : () => Navigator.of(context).pop(false),
        ),
      ],
    );
  }
}

/// En-tête muet puis UNE carte : deux cartes dans une section rendraient des
/// lignes flottantes séparées par des trous, ce que l'écran fuit.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.card, this.band});

  final String title;
  final CpiCard card;

  /// Bandeau d'état, entre l'en-tête et la carte.
  final Widget? band;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            title.toUpperCase(),
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          ?band,
          card,
        ],
      ),
    );
  }
}
