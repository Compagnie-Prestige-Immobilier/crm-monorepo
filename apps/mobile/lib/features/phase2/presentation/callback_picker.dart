import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';

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
  const CallbackPicker({super.key, required this.now, required this.onChanged});

  final DateTime now;
  final ValueChanged<DateTime?> onChanged;

  @override
  State<CallbackPicker> createState() => _CallbackPickerState();
}

class _CallbackPickerState extends State<CallbackPicker> {
  DateTime? _selected;
  bool _wheel = false;

  void _pick(DateTime? at, {bool wheel = false}) {
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _selected = at;
      _wheel = wheel;
    });
    widget.onChanged(at);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final List<CallbackSlot> slots = callbackSlots(widget.now);
    final List<CallbackSlot> halfHours = callbackHalfHours(widget.now);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'Quand rappeler ? (facultatif)',
          style: theme.textTheme.titleSmall,
        ),
        const SizedBox(height: CpiSpacing.xs),
        Wrap(
          spacing: CpiSpacing.xs,
          runSpacing: CpiSpacing.xs,
          children: <Widget>[
            for (final CallbackSlot slot in slots)
              ChoiceChip(
                label: Text(
                  slot.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                selected: !_wheel && _selected == slot.at,
                onSelected: (bool on) => _pick(on ? slot.at : null),
              ),
            if (halfHours.isNotEmpty)
              ChoiceChip(
                avatar: const Icon(
                  PhosphorIconsRegular.clock,
                  size: CpiIconSize.xs,
                ),
                label: const Text(
                  'Autre heure',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                selected: _wheel,
                onSelected: (bool on) =>
                    _pick(on ? halfHours.first.at : null, wheel: on),
              ),
          ],
        ),
        if (_wheel && halfHours.isNotEmpty) ...<Widget>[
          const SizedBox(height: CpiSpacing.xs),
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: CpiRadius.brMd,
              border: Border.all(color: cpi.borderSubtle),
            ),
            child: SizedBox(
              height: 132,
              child: ListWheelScrollView.useDelegate(
                itemExtent: 44,
                diameterRatio: 1.6,
                physics: const FixedExtentScrollPhysics(),
                onSelectedItemChanged: (int i) =>
                    _pick(halfHours[i].at, wheel: true),
                childDelegate: ListWheelChildBuilderDelegate(
                  childCount: halfHours.length,
                  builder: (BuildContext context, int i) => Center(
                    child: Text(
                      halfHours[i].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
