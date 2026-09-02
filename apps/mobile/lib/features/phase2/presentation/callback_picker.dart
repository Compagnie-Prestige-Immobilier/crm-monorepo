import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_forui.dart';
import '../../../ui/widgets/cpi_kit.dart';

/// Instant proposé pour un rappel, avec le libellé qui le désigne.
@immutable
class CallbackSlot {
  const CallbackSlot(this.label, this.at);

  final String label;
  final DateTime at;
}

/// Africa/Dakar est sur UTC+0 toute l'année : aucune base de fuseaux n'est
/// embarquée dans l'application, et l'heure murale de Dakar se construit donc
/// directement en UTC.
DateTime _businessTime(DateTime day, int hour, [int minute = 0]) =>
    DateTime.utc(day.year, day.month, day.day, hour, minute);

/// Les propositions d'un tap, dans l'ordre où le terrain les demande.
///
/// Celles qui seraient déjà passées sont retirées : « Cet après-midi » n'a
/// aucun sens à 17 h, et un rappel dans le passé n'est pas planifiable.
List<CallbackSlot> callbackSlots(DateTime now) {
  final DateTime nowUtc = now.toUtc();
  final DateTime inOneHour = nowUtc.add(const Duration(hours: 1));
  final DateTime tomorrow = nowUtc.add(const Duration(days: 1));
  final DateTime inThreeDays = nowUtc.add(const Duration(days: 3));
  final DateTime monday = nowUtc.add(Duration(days: 8 - nowUtc.weekday));

  final List<CallbackSlot> slots = <CallbackSlot>[
    CallbackSlot(
      'Dans 1 h',
      _businessTime(inOneHour, inOneHour.hour, inOneHour.minute),
    ),
    CallbackSlot('Cet après-midi (15 h)', _businessTime(nowUtc, 15)),
    CallbackSlot('Demain 9 h', _businessTime(tomorrow, 9)),
    CallbackSlot('Demain 15 h', _businessTime(tomorrow, 15)),
    CallbackSlot('Lundi 9 h', _businessTime(monday, 9)),
    CallbackSlot('Dans 3 jours', _businessTime(inThreeDays, 9)),
  ];

  final Set<DateTime> seen = <DateTime>{};
  return slots
      .where((CallbackSlot s) => s.at.isAfter(nowUtc) && seen.add(s.at))
      .toList(growable: false);
}

/// Les demi-heures ouvrées d'un jour, pour la roulette. Celles déjà passées
/// sont retirées : un rappel dans le passé n'est pas planifiable.
List<CallbackSlot> callbackHalfHours(DateTime now, DateTime day) {
  final DateTime nowUtc = now.toUtc();
  final List<CallbackSlot> slots = <CallbackSlot>[];
  for (int half = 16; half <= 38; half++) {
    final DateTime at = _businessTime(day, half ~/ 2, half.isEven ? 0 : 30);
    if (!at.isAfter(nowUtc)) continue;
    final String hh = at.hour.toString().padLeft(2, '0');
    final String mm = at.minute.toString().padLeft(2, '0');
    slots.add(CallbackSlot('$hh h $mm', at));
  }
  return slots;
}

String _libelleDe(BuildContext context, DateTime at) {
  final MaterialLocalizations l10n = MaterialLocalizations.of(context);
  final String hh = at.hour.toString().padLeft(2, '0');
  final String mm = at.minute.toString().padLeft(2, '0');
  return '${l10n.formatMediumDate(at)}, $hh h $mm';
}

/// Choix de l'heure d'un rappel SANS CLAVIER.
///
/// Le terrain saisit debout, souvent d'une main, sur des appareils dont le
/// clavier couvre la moitié de l'écran : les puces couvrent les cas courants et
/// la feuille « date puis heure » couvre le reste.
class CallbackPicker extends StatefulWidget {
  const CallbackPicker({
    super.key,
    required this.now,
    required this.onChanged,
    this.required = false,
    this.title,
  });

  final DateTime now;
  final ValueChanged<DateTime?> onChanged;

  /// Remplace « Quand rappeler ? » quand la question se pose autrement : sur un
  /// appel abouti, le rappel est une option et non le résultat de l'appel.
  final String? title;

  /// Retire le « (facultatif) » du titre : un appelant qui bloque
  /// l'enregistrement tant qu'aucune date n'est choisie ne doit pas afficher
  /// un titre qui dit le contraire.
  final bool required;

  @override
  State<CallbackPicker> createState() => _CallbackPickerState();
}

class _CallbackPickerState extends State<CallbackPicker> {
  DateTime? _selected;

  /// Vrai quand l'instant vient de la feuille et non d'une puce toute faite.
  bool _perso = false;

  void _pick(DateTime? at, {bool perso = false}) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _selected = at;
      _perso = perso;
    });
    widget.onChanged(at);
  }

  Future<void> _ouvrirLaFeuille() async {
    final DateTime? at = await choisirDateEtHeure(
      context,
      now: widget.now,
      initial: _perso ? _selected : null,
    );
    if (at != null) _pick(at, perso: true);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final List<CallbackSlot> slots = callbackSlots(widget.now);
      final DateTime? perso = _perso ? _selected : null;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            widget.title ??
                (widget.required
                    ? 'Quand rappeler ?'
                    : 'Quand rappeler ? (facultatif)'),
            style: theme.textTheme.titleSmall,
          ),
          const SizedBox(height: CpiSpacing.xs),
          Wrap(
            spacing: CpiSpacing.xs,
            runSpacing: CpiSpacing.xs,
            children: <Widget>[
              for (final CallbackSlot slot in slots)
                CallbackPill(
                  label: slot.label,
                  selected: !_perso && _selected == slot.at,
                  onPress: () =>
                      _pick(!_perso && _selected == slot.at ? null : slot.at),
                ),
              CallbackPill(
                label: perso == null
                    ? 'Choisir une date'
                    : _libelleDe(context, perso),
                icon: PhosphorIconsRegular.calendarBlank,
                selected: perso != null,
                onPress: () => unawaited(_ouvrirLaFeuille()),
              ),
            ],
          ),
        ],
      );
    },
  );
}

/// Feuille « la date, puis l'heure » : le calendrier occupe l'écran seul, et la
/// roue des demi-heures ne s'ouvre qu'une fois le jour arrêté.
Future<DateTime?> choisirDateEtHeure(
  BuildContext context, {
  required DateTime now,
  DateTime? initial,
}) => showCpiSheet<DateTime>(
  context,
  title: 'Quand rappeler ?',
  builder: (BuildContext context) =>
      _FeuilleDateHeure(now: now, initial: initial),
);

class _FeuilleDateHeure extends StatefulWidget {
  const _FeuilleDateHeure({required this.now, this.initial});

  final DateTime now;
  final DateTime? initial;

  @override
  State<_FeuilleDateHeure> createState() => _FeuilleDateHeureState();
}

class _FeuilleDateHeureState extends State<_FeuilleDateHeure> {
  late DateTime? _jour = widget.initial == null
      ? null
      : DateTime.utc(
          widget.initial!.year,
          widget.initial!.month,
          widget.initial!.day,
        );
  late DateTime? _heure = widget.initial;
  int _index = 0;

  /// Tenu ici et non par la roue : c'est ce qui permet de la déplacer sans
  /// glisser, depuis le lecteur d'écran.
  final FPickerController _roue = FPickerController(indexes: <int>[0]);

  @override
  void dispose() {
    _roue.dispose();
    super.dispose();
  }

  DateTime get _premierJour {
    final DateTime n = widget.now.toUtc();
    return DateTime.utc(n.year, n.month, n.day);
  }

  List<CallbackSlot> get _heures {
    final DateTime? jour = _jour;
    if (jour == null) return const <CallbackSlot>[];
    return callbackHalfHours(widget.now, jour);
  }

  void _choisirLeJour(DateTime jour) {
    final DateTime cible = DateTime.utc(jour.year, jour.month, jour.day);
    final List<CallbackSlot> heures = callbackHalfHours(widget.now, cible);
    // La roue se reconstruit sur la valeur du contrôleur : sans ce retour à
    // zéro elle rouvrirait sur la demi-heure d'un jour précédent.
    _roue.value = <int>[0];
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _jour = cible;
      _index = 0;
      _heure = heures.isEmpty ? null : heures.first.at;
    });
  }

  void _glisserVers(int index) {
    final List<CallbackSlot> heures = _heures;
    if (index < 0 || index >= heures.length) return;
    setState(() {
      _index = index;
      _heure = heures[index].at;
    });
    unawaited(_roue.animateTo(<int>[index]));
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final DateTime? jour = _jour;
    final List<CallbackSlot> heures = _heures;

    if (jour == null) return _calendrier();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CpiRow(
          leading: const Icon(
            PhosphorIconsRegular.calendarBlank,
            size: CpiIconSize.md,
          ),
          title: MaterialLocalizations.of(context).formatFullDate(jour),
          subtitle: 'Changer de date',
          onTap: () => setState(() {
            _jour = null;
            _heure = null;
          }),
        ),
        const SizedBox(height: CpiSpacing.sm),
        if (heures.isEmpty)
          Text(
            'Plus d\'heure disponible ce jour-là. Choisissez un autre jour.',
            style: theme.textTheme.bodyMedium,
          )
        else
          _roulette(heures),
        const SizedBox(height: CpiSpacing.lg),
        CpiButton(
          'Valider',
          icon: PhosphorIconsRegular.check,
          onPressed: _heure == null
              ? null
              : () => Navigator.of(context).pop(_heure),
        ),
      ],
    );
  }

  Widget _calendrier() => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      Center(
        child: FCalendar(
          control: FCalendarControl.managedDate(
            toggleable: false,
            selectable: (DateTime d) =>
                !DateTime.utc(d.year, d.month, d.day).isBefore(_premierJour),
            onChange: (DateTime? d) {
              if (d != null) _choisirLeJour(d);
            },
          ),
          start: _premierJour,
          end: _premierJour.add(const Duration(days: 365)),
          today: widget.now.toUtc(),
        ),
      ),
      const SizedBox(height: CpiSpacing.md),
      CpiButton(
        'Annuler',
        variant: CpiButtonVariant.ghost,
        onPressed: () => Navigator.of(context).pop(),
      ),
    ],
  );

  /// La roue ne se règle qu'au glissé, geste qu'un lecteur d'écran ne produit
  /// pas : elle porte son nom, sa valeur et de quoi passer d'une demi-heure à
  /// l'autre sans glisser.
  Widget _roulette(List<CallbackSlot> heures) => Semantics(
    container: true,
    label: 'Heure du rappel',
    value: heures[_index.clamp(0, heures.length - 1)].label,
    increasedValue: heures[(_index + 1).clamp(0, heures.length - 1)].label,
    decreasedValue: heures[(_index - 1).clamp(0, heures.length - 1)].label,
    onIncrease: () => _glisserVers(_index + 1),
    onDecrease: () => _glisserVers(_index - 1),
    excludeSemantics: true,
    child: SizedBox(
      // La roulette montre trois lignes : sa hauteur suit donc la taille de
      // texte du système, sinon la ligne du milieu est rognée dès « Très
      // grand ».
      height: MediaQuery.textScalerOf(context).scale(CpiSpacing.huge) * 3,
      child: FPicker(
        control: FPickerControl.managed(
          controller: _roue,
          onChange: (List<int> indexes) => setState(() {
            _index = indexes.first;
            _heure = heures[indexes.first].at;
          }),
        ),
        children: <Widget>[
          FPickerWheel(
            children: <Widget>[
              for (final CallbackSlot slot in heures)
                Text(slot.label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ],
      ),
    ),
  );
}

/// Puce d'un choix bref : le libellé tient sur une ligne et la sélection se lit
/// à l'aplat, pas à une coche.
///
/// Publique parce que les tests d'écran vérifient l'état sélectionné.
class CallbackPill extends StatelessWidget {
  const CallbackPill({
    super.key,
    required this.label,
    required this.selected,
    required this.onPress,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onPress;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => ConstrainedBox(
      constraints: const BoxConstraints(minHeight: kCpiMinTouchTarget),
      child: FButton(
        variant: selected ? FButtonVariant.primary : FButtonVariant.outline,
        selected: selected,
        mainAxisSize: MainAxisSize.min,
        onPress: onPress,
        prefix: icon == null ? null : Icon(icon, size: CpiIconSize.xs),
        child: Flexible(
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ),
    ),
  );
}
