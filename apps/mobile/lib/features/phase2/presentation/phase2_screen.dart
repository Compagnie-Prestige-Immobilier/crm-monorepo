import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../data/repositories/write_repository.dart';
import '../../../ui/widgets/phone_field.dart';
import '../phase2_controller.dart';

/// Phase 2 — saisie des méthodes d'enrôlement.
///
/// ## Ce que fait cet écran, et ce qu'il ne fait pas
///
/// Le commercial travaille depuis un **programme PDF imprimé** qui ne liste que
/// des numéros de téléphone — pas de noms, délibérément. Il appelle, puis vient
/// consigner ici soit la méthode d'enrôlement obtenue, soit la raison pour
/// laquelle il n'en a pas obtenu. **Le papier est le programme ; l'app est
/// l'outil d'enregistrement.** C'est pourquoi rien sur cet écran ne ressemble à
/// une liste de tâches, à un « 42 / 120 » ni à un « prochain numéro » : une app
/// qui prétendrait piloter la journée ferait sauter les numéros que le papier
/// porte et qu'elle ignore, sans que personne ne s'en aperçoive.
///
/// ## Pourquoi chaque geste est compté
///
/// Il y a une pile de numéros à passer. Chaque appui superflu se paie autant de
/// fois qu'il y a d'appels dans la journée. D'où : champ auto-focalisé au
/// démarrage et après chaque enregistrement, clavier numérique, validation à la
/// complétion du numéro sans appuyer sur « rechercher », trois cartes de méthode
/// atteignables au pouce, et retour immédiat au champ après confirmation.
///
/// ## Le retour haptique ne ment jamais
///
/// `selectionClick` au choix d'une carte — c'est un retour de sélection, il est
/// exact au moment où il est émis. La vibration de succès, elle, n'est déclenchée
/// **qu'après** que l'écriture locale a été commitée : une vibration qui précède
/// l'écriture affirme un enregistrement qui peut encore échouer. Rien ne vibre à
/// la frappe.
class Phase2Screen extends ConsumerStatefulWidget {
  const Phase2Screen({super.key});

  @override
  ConsumerState<Phase2Screen> createState() => _Phase2ScreenState();
}

class _Phase2ScreenState extends ConsumerState<Phase2Screen> {
  final TextEditingController _phone = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();

  /// Numéro pour lequel une recherche a déjà été lancée. Sans ce garde, chaque
  /// frappe au-delà du neuvième chiffre relancerait la requête.
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

  /// Recherche automatique dès que le numéro est complet.
  ///
  /// Neuf chiffres au Sénégal, sans ambiguïté de longueur : il n'existe aucun
  /// numéro dont la complétion soit un préfixe d'un autre. On peut donc chercher
  /// sans attendre un appui, ce qui retire un geste par appel. **Rien ne vibre
  /// ici** : une frappe n'est pas un événement à signaler.
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
    // Numéro inconnu de l'annuaire : c'est une erreur d'orientation, pas une
    // faute de frappe — le commercial vient peut-être de tourner une page du
    // mauvais programme. Le signaler par un retour tactile évite de lui faire
    // relire l'écran au soleil.
    if (ref.read(phase2ControllerProvider).stage == Phase2Stage.notFound) {
      await HapticFeedback.heavyImpact();
    }
  }

  /// Vide le champ et lui rend le focus. Appelée après chaque enregistrement :
  /// le numéro suivant se tape immédiatement, sans un geste de plus.
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
  }) async {
    final bool ok = await ref
        .read(phase2ControllerProvider.notifier)
        .record(outcome: outcome, method: method, comment: comment);
    if (!mounted) return;
    if (!ok) {
      // Échec : vibration d'erreur, et le message est déjà dans l'état.
      await HapticFeedback.heavyImpact();
      return;
    }
    // ÉCRITURE CONFIRMÉE, PUIS vibration. Jamais l'inverse.
    await HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final CpiMotion motion = CpiMotion.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Phase 2'),
        leading: IconButton(
          icon: const Icon(PhosphorIconsRegular.arrowLeft),
          tooltip: 'Retour',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
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
                    enabled: phase2.stage != Phase2Stage.confirmed,
                  ),
                  const SizedBox(height: CpiSpacing.md),
                  // `AnimatedSwitcher` et non trois `if` : le passage
                  // recherche → résultat → confirmation est le seul mouvement de
                  // cet écran, et il porte une information — quelque chose a
                  // changé sous les doigts. `CpiMotion.of` ramène la durée à
                  // zéro quand `MediaQuery.disableAnimations` est actif ; la
                  // logique, elle, ne change pas.
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
          ],
        ),
      ),
    );
  }

  Future<void> _openNegativeSheet() async {
    final _NegativeResult? result = await showModalBottomSheet<_NegativeResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext context) => const _NegativeSheet(),
    );
    if (result == null || !mounted) return;
    await _record(outcome: result.outcome, comment: result.comment);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bandeau d'état
// ─────────────────────────────────────────────────────────────────────────────

/// Annuaire, dernière synchronisation, écritures en attente, progression
/// personnelle.
///
/// Formulé pour ne **pas** se faire passer pour le programme officiel : « mes
/// saisies », jamais « ma campagne » ni un pourcentage d'avancement. Le
/// dénominateur du travail de la journée est sur le papier, et l'app ne le
/// connaît pas.
class _StatusStrip extends ConsumerWidget {
  const _StatusStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Phase2State phase2 = ref.watch(phase2ControllerProvider);
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;
    final SyncStateData? syncState =
        ref.watch(phase2DirectoryStateProvider).value;
    final int pending = ref.watch(phase2PendingCountProvider).value ?? 0;
    final ({int attempts, int closed, int methods})? progress =
        ref.watch(phase2ProgressProvider).value;

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
                    // `accentText` (#856011) et jamais `accent` (#C8921A) : ce
                    // chiffre est du texte, et l'or de surface fait 2,77:1.
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
    // Le libellé sous la valeur, pas à côté d'elle.
    //
    // Côte à côte, les trois métriques se partagent 109 dp sur un écran de
    // 360 dp — la largeur réelle des téléphones du parc — et « méthodes
    // obtenues » déborde de 97 px. Empilé, le libellé dispose de toute la
    // colonne et se replie sur deux lignes.
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
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.15,
            ),
          ),
        ],
      ),
    );
  }
}

/// Ligne « annuaire » : taille, fraîcheur, bouton de mise à jour, progression du
/// téléchargement.
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
        label: 'Téléchargement de l\'annuaire : ${phase2.downloaded} numéros.',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Progression INDÉTERMINÉE et un compteur, jamais une barre remplie
            // à un pourcentage : le serveur ne dit pas combien de lignes il
            // reste, et une barre inventée qui reculerait ou stagnerait à 90 %
            // est pire qu'une barre honnête qui tourne.
            const LinearProgressIndicator(minHeight: 3),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              '${_number.format(phase2.downloaded)} numéros téléchargés…',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      );
    }

    final DateTime? when = lastPulledAt;
    final String freshness =
        when == null ? 'jamais téléchargé' : 'mis à jour ${_relative(when)}';

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
                ? 'Annuaire vide — téléchargez-le avant de commencer.'
                : 'Annuaire : ${_number.format(directory)} numéros · $freshness',
            style: theme.textTheme.bodySmall?.copyWith(
              color: directory == 0
                  ? cpi.accentText
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        // 48 dp de cible minimale, imposée par la contrainte et pas seulement
        // par la taille de l'icône.
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: TextButton(
            onPressed: () => ref.read(phase2ControllerProvider.notifier).download(),
            child: Text(directory == 0 ? 'Télécharger' : 'Mettre à jour'),
          ),
        ),
      ],
    );
  }

  static final NumberFormat _number = NumberFormat.decimalPattern('fr');

  static String _relative(DateTime when) {
    final Duration delta = DateTime.now().difference(when);
    if (delta.inMinutes < 1) return 'à l\'instant';
    if (delta.inHours < 1) return 'il y a ${delta.inMinutes} min';
    if (delta.inDays < 1) return 'il y a ${delta.inHours} h';
    return 'le ${DateFormat('d MMMM à HH:mm', 'fr').format(when)}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Champ téléphone
// ─────────────────────────────────────────────────────────────────────────────

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
    final String? downloadError =
        ref.watch(phase2ControllerProvider).downloadError;
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
              // Le champ prend le focus au premier cadre : l'écran n'existe que
              // pour taper un numéro, et demander un appui préalable coûterait
              // un geste par appel de la journée.
              autofocus: true,
              label: 'Numéro appelé',
              // `done` et non `next` : il n'y a rien après. La recherche part
              // toute seule à la complétion.
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

// ─────────────────────────────────────────────────────────────────────────────
// Les cinq états
// ─────────────────────────────────────────────────────────────────────────────

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
        const SizedBox(height: CpiSpacing.md),
        Text(
          'Composez le numéro depuis votre programme papier, puis saisissez-le '
          'ici pour consigner l\'appel.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
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
              'Ce numéro n\'est pas dans votre annuaire. Vérifiez la saisie, ou '
              'mettez l\'annuaire à jour s\'il date.',
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

/// Dossier déjà clos — **lecture seule**.
///
/// Aucun bouton de correction, et c'est volontaire : le serveur refuserait toute
/// nouvelle tentative (`PHASE2_ALREADY_COMPLETED`), et seul un ADMIN peut
/// corriger depuis le panneau web. Offrir ici un formulaire qui ne peut pas
/// aboutir ferait perdre du temps au commercial et lui ferait croire qu'il a
/// corrigé quelque chose.
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
              message:
                  'Ce dossier ne peut plus être modifié depuis le terrain. '
                  'Seul un administrateur peut le corriger depuis le web.',
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

/// Les trois cartes de méthode, plus l'issue négative.
class _Capture extends StatelessWidget {
  const _Capture({
    required this.state,
    required this.onMethod,
    required this.onNegative,
  });

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
        // Trois cartes empilées et non un groupe de radios : la cible d'un
        // radio Material fait 40 dp de large pour un texte qui en fait 200, et
        // se rate au soleil, debout, à une main. Ici toute la carte est la
        // cible, sur toute la largeur.
        _MethodCard(
          method: EnrollmentMethods.platform,
          title: 'Plateforme',
          subtitle: 'Enrôlement effectué en ligne.',
          icon: PhosphorIconsRegular.deviceMobile,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.physical,
          title: 'Physique',
          subtitle: 'Dossier signé en présence.',
          icon: PhosphorIconsRegular.handshake,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.xs),
        _MethodCard(
          method: EnrollmentMethods.voiceOrElectronicMessaging,
          title: 'Voix / messagerie électronique',
          subtitle: 'Accord donné par appel, SMS ou message.',
          icon: PhosphorIconsRegular.chatCircleText,
          enabled: !state.saving,
          onTap: onMethod,
        ),
        const SizedBox(height: CpiSpacing.md),
        // Action secondaire, visuellement en retrait mais à la même portée de
        // pouce : « pas de méthode » est l'issue la plus fréquente d'une pile
        // d'appels, elle n'a pas à être cachée derrière un menu.
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
      // Retour de SÉLECTION, exact au moment où il est émis : la carte vient
      // d'être choisie, c'est un fait. La vibration de succès, elle, attend
      // l'écriture.
      HapticFeedback.selectionClick();
      onTap(method);
    }

    return Semantics(
      button: true,
      enabled: enabled,
      // Sans `onTap`, le nœud s'annonce « bouton » mais n'expose aucune action :
      // `ExcludeSemantics` a supprimé celle de l'`InkWell`. Un lecteur d'écran
      // décrit alors une carte qu'il ne peut pas activer.
      onTap: enabled ? choose : null,
      label: 'Méthode obtenue : $title. $subtitle',
      child: ExcludeSemantics(
        child: Material(
          color: theme.colorScheme.surfaceContainerLowest,
          borderRadius: CpiRadius.brLg,
          child: InkWell(
            borderRadius: CpiRadius.brLg,
            onTap: enabled ? choose : null,
            child: Container(
              // 72 dp : bien au-delà des 48 dp minimum. Une carte qui porte la
              // décision de tout l'écran ne se dimensionne pas au plancher.
              constraints: const BoxConstraints(minHeight: 72),
              padding: const EdgeInsets.all(CpiSpacing.md),
              decoration: BoxDecoration(
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
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
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
      label: 'Enregistré sur l\'appareil : ${label ?? ''}.',
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
                  Icon(
                    PhosphorIconsFill.checkCircle,
                    size: 28,
                    color: cpi.success,
                  ),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          'Enregistré sur l\'appareil',
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

// ─────────────────────────────────────────────────────────────────────────────
// Feuille « méthode non obtenue »
// ─────────────────────────────────────────────────────────────────────────────

class _NegativeResult {
  const _NegativeResult(this.outcome, this.comment);

  final String outcome;
  final String? comment;
}

/// Les cinq issues sans méthode, et le commentaire.
///
/// `OTHER` **exige** un commentaire non vide : un `CHECK` PostgreSQL
/// (`call_attempts_other_requires_comment`) le refuse sinon. On le valide donc
/// ici, à la seconde où le commercial appuie, plutôt que de découvrir le refus à
/// la synchronisation — c'est-à-dire potentiellement trois semaines plus tard,
/// quand plus personne ne se souvient de l'appel et que la saisie est
/// irrécupérable.
class _NegativeSheet extends StatefulWidget {
  const _NegativeSheet();

  @override
  State<_NegativeSheet> createState() => _NegativeSheetState();
}

class _NegativeSheetState extends State<_NegativeSheet> {
  final TextEditingController _comment = TextEditingController();
  String? _outcome;
  String? _error;

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
      subtitle: 'Pas de réponse, boîte vocale, hors service.',
      icon: PhosphorIconsRegular.phoneSlash,
    ),
    (
      outcome: CallOutcomes.callback,
      title: 'À rappeler',
      subtitle: 'La personne a demandé un autre moment.',
      icon: PhosphorIconsRegular.clockCountdown,
    ),
    (
      outcome: CallOutcomes.refused,
      title: 'Refus',
      subtitle: 'La personne ne souhaite pas s\'enrôler. Définitif.',
      icon: PhosphorIconsRegular.prohibit,
    ),
    (
      outcome: CallOutcomes.wrongNumber,
      title: 'Mauvais numéro',
      subtitle: 'Le numéro ne correspond pas. Définitif.',
      icon: PhosphorIconsRegular.warningCircle,
    ),
    (
      outcome: CallOutcomes.other,
      title: 'Autre',
      subtitle: 'Commentaire obligatoire.',
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
      // Vibration d'erreur : la saisie est refusée AVANT toute écriture.
      HapticFeedback.heavyImpact();
      setState(() => _error = problem.message);
      return;
    }
    Navigator.of(context).pop(_NegativeResult(outcome, comment));
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Padding(
      // `viewInsets` : la feuille remonte au-dessus du clavier, sinon le champ
      // de commentaire est masqué par ce qui sert à le remplir.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        // La feuille ne dépasse jamais 90 % de la hauteur : au-delà, elle
        // couvrirait le numéro qu'on est en train de traiter et on ne saurait
        // plus pour qui on saisit.
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
            // SEULES les options défilent ; les actions restent ancrées.
            //
            // Avec un `SingleChildScrollView` englobant tout, « Enregistrer »
            // passe sous la ligne de flottaison dès que le clavier s'ouvre —
            // c'est-à-dire exactement au moment où l'on veut appuyer dessus. Le
            // commercial doit alors refermer le clavier ou faire défiler pour
            // valider ce qu'il vient de taper : deux gestes de plus, à chaque
            // issue négative, qui sont la majorité des appels.
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
                            });
                          },
                        ),
                      ),
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
                        hintText: 'Ce que la personne a dit, en une phrase.',
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
                  // Le message est ANCRÉ avec le bouton, pas attaché au champ.
                  // Sous le champ, il disparaîtrait avec lui au défilement, et
                  // le commercial appuierait à nouveau sur « Enregistrer » sans
                  // jamais voir pourquoi rien ne se passe.
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
  const _OutcomeTile({
    required this.option,
    required this.selected,
    required this.onTap,
  });

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

// ─────────────────────────────────────────────────────────────────────────────

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
