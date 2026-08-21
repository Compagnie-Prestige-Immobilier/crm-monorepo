import 'dart:async';
import 'dart:io';

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
import 'call_audio_recorder.dart';

class Phase2Screen extends ConsumerStatefulWidget {
  const Phase2Screen({super.key, this.prefillPhone});

  /// Le numero de la fiche depuis laquelle on arrive, quand on vient d'une file
  /// de campagne. Sans lui, ouvrir une ligne du programme rendait un ecran vide
  /// et le teleconseiller retapait le numero qu'il venait de choisir.
  final String? prefillPhone;

  @override
  ConsumerState<Phase2Screen> createState() => _Phase2ScreenState();
}

class _Phase2ScreenState extends ConsumerState<Phase2Screen> {
  final TextEditingController _phone = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();

  String? _lastSearched;
  String? _recordingPath;
  String? _activeRecordingPath;
  bool _savingRecording = false;

  bool get _recordingActive => _activeRecordingPath != null;

  @override
  void initState() {
    super.initState();
    final String? prefill = widget.prefillPhone;
    if (prefill != null && prefill.isNotEmpty) _phone.text = prefill;
    _phone.addListener(_onPhoneChanged);
  }

  @override
  void dispose() {
    if (!_savingRecording) _discardRecording();
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
        _discardRecording();
        _lastSearched = null;
        ref.read(phase2ControllerProvider.notifier).next();
      }
      return;
    }
    if (_lastSearched == parsed.e164) return;
    _discardRecording();
    _lastSearched = parsed.e164;
    unawaited(_runSearch(parsed.e164));
  }

  Future<void> _runSearch(String e164) async {
    await ref.read(phase2ControllerProvider.notifier).search(e164);
    if (!mounted) return;
    if (ref.read(phase2ControllerProvider).stage == Phase2Stage.notFound) {
      await HapticFeedback.heavyImpact();
    }
  }

  void _resetForNext() {
    _discardRecording();
    _lastSearched = null;
    _phone.clear();
    ref.read(phase2ControllerProvider.notifier).next();
    _phoneFocus.requestFocus();
  }

  void _discardRecording() {
    for (final String? path in <String?>{
      _recordingPath,
      _activeRecordingPath,
    }) {
      if (path == null) continue;
      final File recording = File(path);
      if (recording.existsSync()) recording.deleteSync();
    }
    _recordingPath = null;
    _activeRecordingPath = null;
  }

  Future<void> _record({
    required CallReason reason,
    String? method,
    String? comment,
    DateTime? callbackAt,
  }) async {
    bool ok = false;
    _savingRecording = true;
    try {
      ok = await ref
          .read(phase2ControllerProvider.notifier)
          .record(
            reason: reason,
            method: method,
            comment: comment,
            callbackAt: callbackAt,
            recordingPath: _recordingPath,
          );
      if (ok) _recordingPath = null;
    } finally {
      _savingRecording = false;
      if (!mounted && !ok) _discardRecording();
    }
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
    // Avant la première synchronisation la table est vide et le repli sert les
    // six motifs système : la saisie ne dépend jamais du réseau.
    final List<CallReason> reasons =
        ref.watch(callReasonsProvider).value ?? SystemCallReasons.all;

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Phase 2'),
          leading: const CpiBackButton(),
        ),
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
                      enabled:
                          phase2.stage != Phase2Stage.confirmed &&
                          !phase2.saving &&
                          !_recordingActive,
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
                          Phase2Stage.search => _SearchHint(
                            message: phase2.errorMessage,
                          ),
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
                            recording: _recordingActive,
                            onRecordingChanged: (String? path) =>
                                _recordingPath = path,
                            onRecordingStateChanged: (String? path) {
                              setState(() => _activeRecordingPath = path);
                            },
                            onMethod: (String method) => _record(
                              reason: methodReasonOf(reasons),
                              method: method,
                            ),
                            onNegative: () => _openNegativeSheet(reasons),
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

  Future<void> _openNegativeSheet(List<CallReason> reasons) async {
    final CallOutcomeChoice? result =
        await showModalBottomSheet<CallOutcomeChoice>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (BuildContext context) => CallOutcomeSheet(
            now: ref.read(clockProvider).now(),
            reasons: reasons,
          ),
        );
    if (result == null || !mounted) return;
    await _record(
      reason: result.reason,
      comment: result.comment,
      callbackAt: result.callbackAt,
    );
  }
}

/// Le motif qui ferme sur une méthode obtenue. Le serveur en garantit un seul,
/// et le repli système le porte tant que la table locale est vide.
CallReason methodReasonOf(List<CallReason> reasons) => reasons.firstWhere(
  (CallReason r) => r.effect == CallEffects.closeMethod,
  orElse: () => SystemCallReasons.byCode[CallOutcomes.methodObtained]!,
);

class _StatusStrip extends ConsumerWidget {
  const _StatusStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final SyncStateData? syncState = ref
        .watch(phase2DirectoryStateProvider)
        .value;
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
                unawaited(HapticFeedback.selectionClick());
                unawaited(
                  ref.read(phase2ControllerProvider.notifier).download(),
                );
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
          color: directory == 0
              ? cpi.accentText
              : theme.colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: CpiSpacing.xxs),
        Expanded(
          child: Text(
            directory == 0
                ? 'Annuaire non téléchargé'
                : 'Annuaire : ${_number.format(directory)} numéros · $freshness',
            style: theme.textTheme.bodySmall?.copyWith(
              color: directory == 0
                  ? cpi.accentText
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        if (directory > 0)
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: TextButton(
              onPressed: () =>
                  ref.read(phase2ControllerProvider.notifier).download(),
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
    final String? downloadError = ref
        .watch(phase2ControllerProvider)
        .downloadError;
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
              enabled: enabled,
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
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: tone,
                          ),
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
  const _Capture({
    required this.state,
    required this.recording,
    required this.onMethod,
    required this.onNegative,
    required this.onRecordingChanged,
    required this.onRecordingStateChanged,
  });

  final Phase2State state;
  final bool recording;
  final ValueChanged<String> onMethod;
  final VoidCallback onNegative;
  final ValueChanged<String?> onRecordingChanged;
  final ValueChanged<String?> onRecordingStateChanged;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final bool enabled = !state.saving && !recording;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CallAudioRecorder(
          enabled: !state.saving,
          onChanged: onRecordingChanged,
          onRecordingStateChanged: onRecordingStateChanged,
        ),
        const SizedBox(height: CpiSpacing.md),
        Text(
          'Méthode d\'enrôlement obtenue',
          style: theme.textTheme.titleMedium,
        ),
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
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.physical,
          title: 'Physique',
          subtitle: 'Dossier signé en présence',
          icon: PhosphorIconsRegular.handshake,
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.voiceOrElectronicMessaging,
          title: 'Voix / messagerie électronique',
          subtitle: 'Accord par appel, SMS ou message',
          icon: PhosphorIconsRegular.chatCircleText,
          enabled: enabled,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.md),
        SizedBox(
          height: 52,
          child: OutlinedButton.icon(
            onPressed: enabled ? onNegative : null,
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
      unawaited(HapticFeedback.selectionClick());
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

class CallOutcomeChoice {
  const CallOutcomeChoice(this.reason, this.comment, this.callbackAt);

  final CallReason reason;
  final String? comment;
  final DateTime? callbackAt;
}

/// La feuille des issues autres qu'une méthode obtenue.
///
/// Elle ne cite aucun motif : elle rend ce que porte la table locale, groupé par
/// EFFET, parce que c'est l'effet qui dit au téléconseiller ce que sa réponse
/// fait au dossier, et trié par l'ordre que l'équipe du client a choisi.
class CallOutcomeSheet extends StatefulWidget {
  const CallOutcomeSheet({required this.now, required this.reasons, super.key});

  final DateTime now;
  final List<CallReason> reasons;

  @override
  State<CallOutcomeSheet> createState() => _CallOutcomeSheetState();
}

class _CallOutcomeSheetState extends State<CallOutcomeSheet> {
  final TextEditingController _comment = TextEditingController();
  CallReason? _reason;
  String? _error;
  DateTime? _callbackAt;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  static const List<String> _effectOrder = <String>[
    CallEffects.keepOpen,
    CallEffects.scheduleCallback,
    CallEffects.closeRefused,
    CallEffects.closeWrongNumber,
  ];

  static const Map<String, String> _effectHeader = <String, String>{
    CallEffects.keepOpen: 'Le dossier reste ouvert',
    CallEffects.scheduleCallback: 'Un rappel est à programmer',
    CallEffects.closeRefused: 'Refus, le dossier se ferme',
    CallEffects.closeWrongNumber: 'Numéro hors service, le dossier se ferme',
  };

  List<({String header, List<CallReason> items})> _groups() {
    final List<CallReason> sorted =
        widget.reasons
            .where((CallReason r) => r.effect != CallEffects.closeMethod)
            .toList()
          ..sort(
            (CallReason a, CallReason b) => a.sortOrder.compareTo(b.sortOrder),
          );

    final Map<String, List<CallReason>> byEffect = <String, List<CallReason>>{};
    for (final CallReason r in sorted) {
      byEffect.putIfAbsent(r.effect, () => <CallReason>[]).add(r);
    }
    // Un effet que cette version ignore passe en fin de liste plutôt que d'être
    // écarté : un motif invisible est exactement le défaut qu'on corrige.
    final List<String> effects = <String>[
      ..._effectOrder.where(byEffect.containsKey),
      ...byEffect.keys.where((String e) => !_effectOrder.contains(e)),
    ];
    return <({String header, List<CallReason> items})>[
      for (final String effect in effects)
        (
          header: _effectHeader[effect] ?? 'Autres motifs',
          items: byEffect[effect]!,
        ),
    ];
  }

  bool get _needsComment => _reason?.requiresComment ?? false;

  void _submit() {
    final CallReason? reason = _reason;
    if (reason == null) {
      setState(() => _error = 'Choisissez une issue.');
      return;
    }
    final String? comment = WriteRepository.normalizeComment(_comment.text);
    final CallAttemptProblem? problem = WriteRepository.validateCallAttempt(
      reason: reason,
      comment: comment,
    );
    if (problem != null) {
      unawaited(HapticFeedback.heavyImpact());
      setState(() => _error = problem.message);
      return;
    }
    Navigator.of(context).pop(CallOutcomeChoice(reason, comment, _callbackAt));
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
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
                  Text(
                    'Méthode non obtenue',
                    style: theme.textTheme.titleLarge,
                  ),
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
                    for (final ({String header, List<CallReason> items}) group
                        in _groups()) ...<Widget>[
                      Padding(
                        padding: const EdgeInsets.only(
                          top: CpiSpacing.xs,
                          bottom: CpiSpacing.xxs,
                        ),
                        child: Text(
                          group.header,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                      for (final CallReason reason in group.items)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: CpiSpacing.xxs,
                          ),
                          child: _OutcomeTile(
                            reason: reason,
                            selected: _reason == reason,
                            onTap: () {
                              unawaited(HapticFeedback.selectionClick());
                              setState(() {
                                // L'heure ne se remet à zéro que si le
                                // sélecteur disparaît : entre deux motifs qui
                                // programment tous deux un rappel il n'est pas
                                // démonté, sa puce restait allumée sur une
                                // heure qui venait d'être effacée.
                                if (_reason?.effect != reason.effect) {
                                  _callbackAt = null;
                                }
                                _reason = reason;
                                _error = null;
                              });
                            },
                          ),
                        ),
                    ],
                    if (_reason?.effect ==
                        CallEffects.scheduleCallback) ...<Widget>[
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
                      icon: const Icon(
                        PhosphorIconsRegular.floppyDisk,
                        size: 20,
                      ),
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
  const _OutcomeTile({
    required this.reason,
    required this.selected,
    required this.onTap,
  });

  final CallReason reason;
  final bool selected;
  final VoidCallback onTap;

  static IconData _icon(String effect) => switch (effect) {
    CallEffects.scheduleCallback => PhosphorIconsRegular.clockCountdown,
    CallEffects.closeRefused => PhosphorIconsRegular.prohibit,
    CallEffects.closeWrongNumber => PhosphorIconsRegular.warningCircle,
    CallEffects.keepOpen => PhosphorIconsRegular.phoneSlash,
    _ => PhosphorIconsRegular.dotsThreeCircle,
  };

  /// La couleur choisie par l'équipe du client, en `#RRGGBB`. Illisible ou
  /// absente, la puce reprend celle du thème plutôt que de disparaître.
  static Color? _tint(String? hex) {
    if (hex == null) return null;
    final int? rgb = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    return rgb == null || rgb > 0xFFFFFF ? null : Color(0xFF000000 | rgb);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final String hint = reason.requiresComment ? 'Commentaire obligatoire' : '';
    return Semantics(
      button: true,
      selected: selected,
      onTap: onTap,
      label: '${reason.label}. $hint',
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
                  color: selected
                      ? theme.colorScheme.primary
                      : cpi.borderSubtle,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    _icon(reason.effect),
                    size: 20,
                    color: selected
                        ? theme.colorScheme.primary
                        : (_tint(reason.color) ??
                              theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(reason.label, style: theme.textTheme.titleSmall),
                        if (hint.isNotEmpty)
                          Text(
                            hint,
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

class _SpringInState extends State<_SpringIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: Curves.linear,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final Duration duration = CpiMotion.of(context).component;
    _controller.duration = duration;
    _curved.curve = CpiMotion.of(context).easeSpring;
    if (duration == Duration.zero) {
      _controller.value = 1;
    } else if (!_controller.isAnimating && _controller.value == 0) {
      unawaited(_controller.forward());
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(scale: _curved, child: widget.child);
  }
}
