import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_forui.dart';

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

/// Les demi-heures ouvrées d'aujourd'hui puis de demain, pour la roulette.
List<CallbackSlot> callbackHalfHours(DateTime now) {
  final DateTime nowUtc = now.toUtc();
  final List<CallbackSlot> slots = <CallbackSlot>[];
  for (final (int offset, String prefix) in const <(int, String)>[
    (0, 'Aujourd\'hui'),
    (1, 'Demain'),
  ]) {
    final DateTime day = nowUtc.add(Duration(days: offset));
    for (int half = 16; half <= 38; half++) {
      final DateTime at = _businessTime(day, half ~/ 2, half.isEven ? 0 : 30);
      if (!at.isAfter(nowUtc)) continue;
      final String hh = at.hour.toString().padLeft(2, '0');
      final String mm = at.minute.toString().padLeft(2, '0');
      slots.add(CallbackSlot('$prefix $hh h $mm', at));
    }
  }
  return slots;
}

/// Choix de l'heure d'un rappel SANS CLAVIER.
///
/// Le terrain saisit debout, souvent d'une main, sur des appareils dont le
/// clavier couvre la moitié de l'écran : les puces couvrent les cas courants et
/// la roulette de demi-heures couvre le reste.
class CallbackPicker extends StatefulWidget {
  const CallbackPicker({
    super.key,
    required this.now,
    required this.onChanged,
    this.required = false,
  });

  final DateTime now;
  final ValueChanged<DateTime?> onChanged;

  /// Retire le « (facultatif) » du titre : un appelant qui bloque
  /// l'enregistrement tant qu'aucune date n'est choisie ne doit pas afficher
  /// un titre qui dit le contraire.
  final bool required;

  @override
  State<CallbackPicker> createState() => _CallbackPickerState();
}

class _CallbackPickerState extends State<CallbackPicker> {
  DateTime? _selected;
  bool _wheel = false;
  int _index = 0;

  /// Tenu ici et non par la roue : c'est ce qui permet de la déplacer sans
  /// glisser, depuis le lecteur d'écran.
  final FPickerController _roue = FPickerController(indexes: <int>[0]);

  @override
  void dispose() {
    _roue.dispose();
    super.dispose();
  }

  void _pick(DateTime? at, {bool wheel = false, int? index}) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _selected = at;
      _wheel = wheel;
      if (index != null) _index = index;
    });
    widget.onChanged(at);
  }

  void _glisserVers(int index, List<CallbackSlot> halfHours) {
    if (index < 0 || index >= halfHours.length) return;
    _pick(halfHours[index].at, wheel: true, index: index);
    unawaited(_roue.animateTo(<int>[index]));
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final List<CallbackSlot> slots = callbackSlots(widget.now);
      final List<CallbackSlot> halfHours = callbackHalfHours(widget.now);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            widget.required
                ? 'Quand rappeler ?'
                : 'Quand rappeler ? (facultatif)',
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
                  selected: !_wheel && _selected == slot.at,
                  onPress: () =>
                      _pick(!_wheel && _selected == slot.at ? null : slot.at),
                ),
              if (halfHours.isNotEmpty)
                CallbackPill(
                  label: 'Autre heure',
                  icon: PhosphorIconsRegular.clock,
                  selected: _wheel,
                  onPress: () {
                    if (_wheel) {
                      _pick(null);
                      return;
                    }
                    // La roue se reconstruit sur la valeur du contrôleur : sans
                    // ce retour à zéro elle rouvrirait sur la demi-heure d'un
                    // choix précédent, pas sur celle que la puce vient de poser.
                    _roue.value = <int>[0];
                    _pick(halfHours.first.at, wheel: true, index: 0);
                  },
                ),
            ],
          ),
          if (_wheel && halfHours.isNotEmpty) ...<Widget>[
            const SizedBox(height: CpiSpacing.xs),
            // La roue ne se règle qu'au glissé, geste qu'un lecteur d'écran ne
            // produit pas : elle porte son nom, sa valeur et de quoi passer
            // d'une demi-heure à l'autre sans glisser.
            Semantics(
              container: true,
              label: 'Heure du rappel',
              value: halfHours[_index.clamp(0, halfHours.length - 1)].label,
              increasedValue:
                  halfHours[(_index + 1).clamp(0, halfHours.length - 1)].label,
              decreasedValue:
                  halfHours[(_index - 1).clamp(0, halfHours.length - 1)].label,
              onIncrease: () => _glisserVers(_index + 1, halfHours),
              onDecrease: () => _glisserVers(_index - 1, halfHours),
              excludeSemantics: true,
              child: SizedBox(
                // La roulette montre trois lignes : sa hauteur suit donc la
                // taille de texte du système, sinon la ligne du milieu est
                // rognée dès « Très grand ».
                height:
                    MediaQuery.textScalerOf(context).scale(CpiSpacing.huge) * 3,
                child: FPicker(
                  control: FPickerControl.managed(
                    controller: _roue,
                    onChange: (List<int> indexes) => _pick(
                      halfHours[indexes.first].at,
                      wheel: true,
                      index: indexes.first,
                    ),
                  ),
                  children: <Widget>[
                    FPickerWheel(
                      children: <Widget>[
                        for (final CallbackSlot slot in halfHours)
                          Text(
                            slot.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      );
    },
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
