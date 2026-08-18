import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/utils/relative_time.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/phone_field.dart';
import '../phase2_controller.dart';
import 'callback_picker.dart';

class Phase2Screen extends ConsumerStatefulWidget {
  const Phase2Screen({super.key});

  @override
  ConsumerState<Phase2Screen> createState() => _Phase2ScreenState();
}

class _Phase2ScreenState extends ConsumerState<Phase2Screen> {
  final TextEditingController _phone = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();

  String? _lastSearched;

  @override
  void initState() {
    super.initState();
    _phone.addListener(_onPhoneChanged);
  }

  @override
  void dispose() {
    _phone.removeListener(_onPhoneChanged);
    _phone.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  void _onPhoneChanged() {
    final String raw = _phone.text;
    final PhoneResult parsed = Phone.parse(raw);
    if (parsed is! PhoneValid) {
      if (_lastSearched != null) {
        _lastSearched = null;
        ref.read(phase2ControllerProvider.notifier).next();
      }
      return;
    }
    if (_lastSearched == parsed.e164) return;
    _lastSearched = parsed.e164;
    _runSearch(parsed.e164);
  }

  Future<void> _runSearch(String e164) async {
    await ref.read(phase2ControllerProvider.notifier).search(e164);
    if (!mounted) return;
    if (ref.read(phase2ControllerProvider).stage == Phase2Stage.notFound) {
      await HapticFeedback.heavyImpact();
    }
  }

  void _resetForNext() {
    _lastSearched = null;
    _phone.clear();
    ref.read(phase2ControllerProvider.notifier).next();
    _phoneFocus.requestFocus();
  }

  Future<void> _record({
    required String outcome,
    String? method,
    String? comment,
    DateTime? callbackAt,
  }) async {
    final bool ok = await ref
        .read(phase2ControllerProvider.notifier)
        .record(
          outcome: outcome,
          method: method,
          comment: comment,
          callbackAt: callbackAt,
        );
    if (!mounted) return;
    if (!ok) {
      await HapticFeedback.heavyImpact();
      return;
    }
    await HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final CpiMotion motion = CpiMotion.of(context);

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(title: const Text('Phase 2'), leading: const CpiBackButton()),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              const _StatusStrip(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    CpiSpacing.md,
                    CpiSpacing.sm,
                    CpiSpacing.md,
                    CpiSpacing.xl,
                  ),
                  children: <Widget>[
                    _PhoneBlock(
                      controller: _phone,
                      focusNode: _phoneFocus,
                      enabled: phase2.stage != Phase2Stage.confirmed,
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    AnimatedSwitcher(
                      duration: motion.component,
                      switchInCurve: motion.easeOut,
                      switchOutCurve: motion.easeOut,
                      child: KeyedSubtree(
                        key: ValueKey<String>(
                          '${phase2.stage.name}:${phase2.entry?.prospectId ?? ''}',
                        ),
                        child: switch (phase2.stage) {
                          Phase2Stage.search => _SearchHint(message: phase2.errorMessage),
                          Phase2Stage.notFound => _NotFound(
                            phone: phase2.searchedPhone,
                            onClear: _resetForNext,
                          ),
                          Phase2Stage.alreadyClosed => _AlreadyClosed(
                            entry: phase2.entry!,
                            onNext: _resetForNext,
                          ),
                          Phase2Stage.capture => _Capture(
                            state: phase2,
                            onMethod: (String method) => _record(
                              outcome: CallOutcomes.methodObtained,
                              method: method,
                            ),
                            onNegative: _openNegativeSheet,
                          ),
                          Phase2Stage.confirmed => _Confirmed(
                            label: phase2.confirmation,
                            onNext: _resetForNext,
                          ),
                        },
                      ),
                    ),
                  ],
                ),
              ),
              const _DownloadBar(),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openNegativeSheet() async {
    final _NegativeResult? result = await showModalBottomSheet<_NegativeResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext context) =>
          _NegativeSheet(now: ref.read(clockProvider).now()),
    );
    if (result == null || !mounted) return;
    await _record(
      outcome: result.outcome,
      comment: result.comment,
      callbackAt: result.callbackAt,
    );
  }
}


class _StatusStrip extends ConsumerWidget {
  const _StatusStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final SyncStateData? syncState = ref.watch(phase2DirectoryStateProvider).value;
    final int pending = ref.watch(phase2PendingCountProvider).value ?? 0;
    final ({int attempts, int closed, int methods})? progress = ref
        .watch(phase2ProgressProvider)
        .value;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        border: Border(bottom: BorderSide(color: cpi.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Semantics(
            label:
                'Mes saisies : ${progress?.attempts ?? 0} appels consignés, '
                '${progress?.methods ?? 0} méthodes obtenues. '
                '$pending en attente d\'envoi.',
            child: ExcludeSemantics(
              child: Row(
                children: <Widget>[
                  _Metric(
                    icon: PhosphorIconsRegular.phoneCall,
                    value: '${progress?.attempts ?? 0}',
                    label: 'appels consignés',
                    color: theme.colorScheme.primary,
                  ),
                  _Metric(
                    icon: PhosphorIconsRegular.checkCircle,
                    value: '${progress?.methods ?? 0}',
                    label: 'méthodes obtenues',
                    color: cpi.success,
                  ),
                  _Metric(
                    icon: pending == 0
                        ? PhosphorIconsRegular.cloudCheck
                        : PhosphorIconsRegular.cloudSlash,
                    value: '$pending',
                    label: 'à envoyer',
                    color: pending == 0 ? cpi.syncSynced : cpi.accentText,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
          _DirectoryLine(
            directory: directory,
            lastPulledAt: syncState?.lastPulledAt,
            phase2: phase2,
          ),
        ],
      ),
    );
  }
}

class _DownloadBar extends ConsumerWidget {
  const _DownloadBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final bool downloading = ref.watch(phase2ControllerProvider).downloading;
    if (directory > 0) return const SizedBox.shrink();

    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: FilledButton.icon(
        onPressed: downloading
            ? null
            : () {
                HapticFeedback.selectionClick();
                ref.read(phase2ControllerProvider.notifier).download();
              },
        icon: downloading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(PhosphorIconsRegular.cloudArrowDown, size: 20),
        label: const Text('Télécharger l\'annuaire'),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icon, size: 18, color: color),
              const SizedBox(width: CpiSpacing.xxs),
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(color: color),
                ),
              ),
            ],
          ),
          Text(
            label,
            maxLines: 2,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _DirectoryLine extends ConsumerWidget {
  const _DirectoryLine({
    required this.directory,
    required this.lastPulledAt,
    required this.phase2,
  });

  final int directory;
  final DateTime? lastPulledAt;
  final Phase2State phase2;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    if (phase2.downloading) {
      return Semantics(
        liveRegion: true,
        label: 'Téléchargement : ${phase2.downloaded} numéros.',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const LinearProgressIndicator(minHeight: 3),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              '${_number.format(phase2.downloaded)} numéros',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      );
    }

    final DateTime? when = lastPulledAt;
    final String freshness = when == null
        ? 'jamais téléchargé'
        : 'mis à jour ${relativeTime(when)}';

    return Row(
      children: <Widget>[
        Icon(
          directory == 0
              ? PhosphorIconsRegular.cloudArrowDown
              : PhosphorIconsRegular.addressBook,
          size: 18,
          color: directory == 0 ? cpi.accentText : theme.colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: CpiSpacing.xxs),
        Expanded(
          child: Text(
            directory == 0
                ? 'Annuaire non téléchargé'
                : 'Annuaire : ${_number.format(directory)} numéros · $freshness',
            style: theme.textTheme.bodySmall?.copyWith(
              color: directory == 0 ? cpi.accentText : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        if (directory > 0)
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: TextButton(
              onPressed: () => ref.read(phase2ControllerProvider.notifier).download(),
              child: const Text('Mettre à jour'),
            ),
          ),
      ],
    );
  }

  static final NumberFormat _number = NumberFormat.decimalPattern('fr');

}


class _PhoneBlock extends ConsumerWidget {
  const _PhoneBlock({
    required this.controller,
    required this.focusNode,
    required this.enabled,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? downloadError = ref.watch(phase2ControllerProvider).downloadError;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Semantics(
          textField: true,
          label: 'Numéro appelé, neuf chiffres',
          hint: 'La recherche se lance dès que le numéro est complet.',
          child: ExcludeSemantics(
            child: PhoneField(
              controller: controller,
              focusNode: focusNode,
              autofocus: true,
              label: 'Numéro appelé',
              textInputAction: TextInputAction.done,
              helper: 'Recherche automatique',
            ),
          ),
        ),
        if (downloadError != null)
          Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.xs),
            child: _Notice(
              icon: PhosphorIconsRegular.warningCircle,
              color: context.cpi.syncFailed,
              surface: context.cpi.warningSurface,
              message: downloadError,
            ),
          ),
      ],
    );
  }
}


class _SearchHint extends StatelessWidget {
  const _SearchHint({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    if (message != null) {
      return _Notice(
        icon: PhosphorIconsRegular.warningCircle,
        color: cpi.syncFailed,
        surface: cpi.warningSurface,
        message: message!,
      );
    }
    return Column(
      children: <Widget>[
        const SizedBox(height: CpiSpacing.xxl),
        Icon(
          PhosphorIconsDuotone.phoneList,
          size: 56,
          color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
        ),
      ],
    );
  }
}

class _NotFound extends StatelessWidget {
  const _NotFound({required this.phone, required this.onClear});

  final String? phone;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _Notice(
          icon: PhosphorIconsRegular.magnifyingGlass,
          color: cpi.syncFailed,
          surface: cpi.warningSurface,
          message:
              'Numéro absent de l\'annuaire. Vérifiez la saisie ou mettez '
              'l\'annuaire à jour.',
        ),
        const SizedBox(height: CpiSpacing.xs),
        if (phone != null)
          Text(
            Phone.format(phone!),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
        const SizedBox(height: CpiSpacing.md),
        OutlinedButton.icon(
          onPressed: onClear,
          icon: const Icon(PhosphorIconsRegular.eraser, size: 20),
          label: const Text('Effacer et recommencer'),
        ),
      ],
    );
  }
}

class _AlreadyClosed extends StatelessWidget {
  const _AlreadyClosed({required this.entry, required this.onNext});

  final Phase2DirectoryData entry;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool obtained = entry.phase2Status == Phase2Statuses.methodObtained;
    final Color tone = obtained ? cpi.success : cpi.info;

    return Semantics(
      label:
          'Dossier déjà traité : ${Phase2Controller.labelForStatus(entry.phase2Status)}.'
          '${obtained && entry.enrollmentMethod != null ? ' Méthode ${Phase2Controller.labelForMethod(entry.enrollmentMethod!)}.' : ''} '
          'Lecture seule.',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(CpiSpacing.md),
              decoration: BoxDecoration(
                color: obtained ? cpi.successSurface : cpi.infoSurface,
                borderRadius: CpiRadius.brLg,
                border: Border.all(color: tone.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(
                        obtained
                            ? PhosphorIconsFill.checkCircle
                            : PhosphorIconsFill.prohibit,
                        size: 22,
                        color: tone,
                      ),
                      const SizedBox(width: CpiSpacing.xs),
                      Expanded(
                        child: Text(
                          'Dossier déjà traité',
                          style: theme.textTheme.titleMedium?.copyWith(color: tone),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: CpiSpacing.xs),
                  Text(
                    Phase2Controller.labelForStatus(entry.phase2Status),
                    style: theme.textTheme.headlineSmall,
                  ),
                  if (entry.enrollmentMethod != null) ...<Widget>[
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      'Méthode : '
                      '${Phase2Controller.labelForMethod(entry.enrollmentMethod!)}',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                  const SizedBox(height: CpiSpacing.xs),
                  Text(
                    Phone.format(entry.phoneE164),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.sm),
            _Notice(
              icon: PhosphorIconsRegular.lockSimple,
              color: cpi.accentText,
              surface: cpi.accentSurface,
              message: 'Modifiable par un administrateur uniquement.',
            ),
            const SizedBox(height: CpiSpacing.md),
            FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(PhosphorIconsRegular.arrowRight, size: 20),
              label: const Text('Numéro suivant'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Capture extends StatelessWidget {
  const _Capture({required this.state, required this.onMethod, required this.onNegative});

  final Phase2State state;
  final ValueChanged<String> onMethod;
  final VoidCallback onNegative;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('Méthode d\'enrôlement obtenue', style: theme.textTheme.titleMedium),
        const SizedBox(height: CpiSpacing.xxs),
        Text(
          'Une seule réponse.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.sm),
        _MethodCard(
          method: EnrollmentMethods.platform,
          title: 'Plateforme',
          subtitle: 'En ligne',
          icon: PhosphorIconsRegular.deviceMobile,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.physical,
          title: 'Physique',
          subtitle: 'Dossier signé en présence',
          icon: PhosphorIconsRegular.handshake,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.voiceOrElectronicMessaging,
          title: 'Voix / messagerie électronique',
          subtitle: 'Accord par appel, SMS ou message',
          icon: PhosphorIconsRegular.chatCircleText,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.md),
        SizedBox(
          height: 52,
          child: OutlinedButton.icon(
            onPressed: state.saving ? null : onNegative,
            icon: const Icon(PhosphorIconsRegular.phoneX, size: 20),
            label: const Text('Méthode non obtenue'),
          ),
        ),
        if (state.errorMessage != null) ...<Widget>[
          const SizedBox(height: CpiSpacing.sm),
          _Notice(
            icon: PhosphorIconsRegular.warningCircle,
            color: cpi.syncFailed,
            surface: cpi.warningSurface,
            message: state.errorMessage!,
          ),
        ],
      ],
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.method,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final String method;
  final String title;
  final String subtitle;
  final IconData icon;
  final bool enabled;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    void choose() {
      HapticFeedback.selectionClick();
      onTap(method);
    }

    return Semantics(
      button: true,
      enabled: enabled,
      onTap: enabled ? choose : null,
      label: 'Méthode obtenue : $title. $subtitle',
      child: ExcludeSemantics(
        child: CpiPressable(
          onTap: enabled ? choose : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: 72),
            padding: const EdgeInsets.all(CpiSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerLowest,
              borderRadius: CpiRadius.brLg,
              border: Border.all(color: cpi.borderSubtle),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondary,
                    borderRadius: CpiRadius.brMd,
                  ),
                  child: Icon(icon, size: 22, color: theme.colorScheme.primary),
                ),
                const SizedBox(width: CpiSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  PhosphorIconsRegular.caretRight,
                  size: 20,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Confirmed extends StatelessWidget {
  const _Confirmed({required this.label, required this.onNext});

  final String? label;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Semantics(
      liveRegion: true,
      label: 'Enregistré : ${label ?? ''}.',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(CpiSpacing.md),
              decoration: BoxDecoration(
                color: cpi.successSurface,
                borderRadius: CpiRadius.brLg,
              ),
              child: Row(
                children: <Widget>[
                  _SpringIn(
                    child: Icon(
                      PhosphorIconsFill.checkCircle,
                      size: 30,
                      color: cpi.success,
                    ),
                  ),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          'Enregistré',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: cpi.success,
                          ),
                        ),
                        if (label != null)
                          Text(label!, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.md),
            FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(PhosphorIconsRegular.arrowRight, size: 20),
              label: const Text('Numéro suivant'),
            ),
          ],
        ),
      ),
    );
  }
}


class _NegativeResult {
  const _NegativeResult(this.outcome, this.comment, this.callbackAt);

  final String outcome;
  final String? comment;
  final DateTime? callbackAt;
}

class _NegativeSheet extends StatefulWidget {
  const _NegativeSheet({required this.now});

  final DateTime now;

  @override
  State<_NegativeSheet> createState() => _NegativeSheetState();
}

class _NegativeSheetState extends State<_NegativeSheet> {
  final TextEditingController _comment = TextEditingController();
  String? _outcome;
  String? _error;
  DateTime? _callbackAt;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  static const List<({String outcome, String title, String subtitle, IconData icon})>
  _options = <({String outcome, String title, String subtitle, IconData icon})>[
    (
      outcome: CallOutcomes.unreachable,
      title: 'Injoignable',
      subtitle: 'Pas de réponse, boîte vocale, hors service',
      icon: PhosphorIconsRegular.phoneSlash,
    ),
    (
      outcome: CallOutcomes.callback,
      title: 'À rappeler',
      subtitle: 'Rappel demandé',
      icon: PhosphorIconsRegular.clockCountdown,
    ),
    (
      outcome: CallOutcomes.refused,
      title: 'Refus',
      subtitle: 'Refus définitif',
      icon: PhosphorIconsRegular.prohibit,
    ),
    (
      outcome: CallOutcomes.wrongNumber,
      title: 'Mauvais numéro',
      subtitle: 'Numéro erroné. Définitif',
      icon: PhosphorIconsRegular.warningCircle,
    ),
    (
      outcome: CallOutcomes.other,
      title: 'Autre',
      subtitle: 'Commentaire obligatoire',
      icon: PhosphorIconsRegular.dotsThreeCircle,
    ),
  ];

  bool get _needsComment => _outcome == CallOutcomes.other;

  void _submit() {
    final String? outcome = _outcome;
    if (outcome == null) {
      setState(() => _error = 'Choisissez une issue.');
      return;
    }
    final String? comment = WriteRepository.normalizeComment(_comment.text);
    final CallAttemptProblem? problem = WriteRepository.validateCallAttempt(
      outcome: outcome,
      comment: comment,
    );
    if (problem != null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = problem.message);
      return;
    }
    Navigator.of(context).pop(_NegativeResult(outcome, comment, _callbackAt));
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.sm,
                CpiSpacing.md,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: CpiSpacing.sm),
                      decoration: BoxDecoration(
                        color: cpi.borderSubtle,
                        borderRadius: CpiRadius.brFull,
                      ),
                    ),
                  ),
                  Text('Méthode non obtenue', style: theme.textTheme.titleLarge),
                  const SizedBox(height: CpiSpacing.xxs),
                  Text(
                    'Pourquoi l\'appel n\'a pas abouti à une méthode.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.sm),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: CpiSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    for (final ({
                          String outcome,
                          String title,
                          String subtitle,
                          IconData icon,
                        })
                        option
                        in _options)
                      Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.xxs),
                        child: _OutcomeTile(
                          option: option,
                          selected: _outcome == option.outcome,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _outcome = option.outcome;
                              _error = null;
                              _callbackAt = null;
                            });
                          },
                        ),
                      ),
                    if (_outcome == CallOutcomes.callback) ...<Widget>[
                      const SizedBox(height: CpiSpacing.sm),
                      CallbackPicker(
                        key: const ValueKey<String>('callback-picker'),
                        now: widget.now,
                        onChanged: (DateTime? at) => _callbackAt = at,
                      ),
                    ],
                    const SizedBox(height: CpiSpacing.sm),
                    TextField(
                      controller: _comment,
                      maxLines: 3,
                      maxLength: kCallAttemptCommentMaxLength,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (String _) {
                        if (_error != null) setState(() => _error = null);
                      },
                      decoration: InputDecoration(
                        labelText: _needsComment
                            ? 'Commentaire (obligatoire)'
                            : 'Commentaire (facultatif)',
                        hintText: 'En une phrase',
                        alignLabelWithHint: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.xs,
                CpiSpacing.md,
                CpiSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  if (_error != null) ...<Widget>[
                    Semantics(
                      liveRegion: true,
                      child: Row(
                        children: <Widget>[
                          Icon(
                            PhosphorIconsRegular.warningCircle,
                            size: 18,
                            color: cpi.syncFailed,
                          ),
                          const SizedBox(width: CpiSpacing.xs),
                          Expanded(
                            child: Text(
                              _error!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: cpi.syncFailed,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xs),
                  ],
                  SizedBox(
                    height: 52,
                    child: FilledButton.icon(
                      onPressed: _submit,
                      icon: const Icon(PhosphorIconsRegular.floppyDisk, size: 20),
                      label: const Text('Enregistrer'),
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.xs),
                  SizedBox(
                    height: 48,
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Annuler'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutcomeTile extends StatelessWidget {
  const _OutcomeTile({required this.option, required this.selected, required this.onTap});

  final ({String outcome, String title, String subtitle, IconData icon}) option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Semantics(
      button: true,
      selected: selected,
      onTap: onTap,
      label: '${option.title}. ${option.subtitle}',
      child: ExcludeSemantics(
        child: Material(
          color: selected
              ? theme.colorScheme.secondary
              : theme.colorScheme.surfaceContainerLowest,
          borderRadius: CpiRadius.brMd,
          child: InkWell(
            borderRadius: CpiRadius.brMd,
            onTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 56),
              padding: const EdgeInsets.symmetric(
                horizontal: CpiSpacing.sm,
                vertical: CpiSpacing.xs,
              ),
              decoration: BoxDecoration(
                borderRadius: CpiRadius.brMd,
                border: Border.all(
                  color: selected ? theme.colorScheme.primary : cpi.borderSubtle,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    option.icon,
                    size: 20,
                    color: selected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(option.title, style: theme.textTheme.titleSmall),
                        Text(
                          option.subtitle,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (selected)
                    Icon(
                      PhosphorIconsFill.checkCircle,
                      size: 20,
                      color: theme.colorScheme.primary,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}


class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.color,
    required this.surface,
    required this.message,
  });

  final IconData icon;
  final Color color;
  final Color surface;
  final String message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(color: surface, borderRadius: CpiRadius.brMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 18, color: color),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpringIn extends StatefulWidget {
  const _SpringIn({required this.child});

  final Widget child;

  @override
  State<_SpringIn> createState() => _SpringInState();
}

class _SpringInState extends State<_SpringIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final Duration duration = CpiMotion.of(context).component;
    _controller.duration = duration;
    if (duration == Duration.zero) {
      _controller.value = 1;
    } else if (!_controller.isAnimating && _controller.value == 0) {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: CurvedAnimation(
        parent: _controller,
        curve: CpiMotion.of(context).easeSpring,
      ),
      child: widget.child,
    );
  }
}
