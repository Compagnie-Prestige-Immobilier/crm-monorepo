// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'score_part.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScorePartCWProxy {
  ScorePart key(ScorePartKeyEnum key);

  ScorePart label(String label);

  ScorePart ratio(num ratio);

  ScorePart weight(num weight);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScorePart(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScorePart(...).copyWith(id: 12, name: "My name")
  /// ````
  ScorePart call({ScorePartKeyEnum key, String label, num ratio, num weight});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfScorePart.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfScorePart.copyWith.fieldName(...)`
class _$ScorePartCWProxyImpl implements _$ScorePartCWProxy {
  const _$ScorePartCWProxyImpl(this._value);

  final ScorePart _value;

  @override
  ScorePart key(ScorePartKeyEnum key) => this(key: key);

  @override
  ScorePart label(String label) => this(label: label);

  @override
  ScorePart ratio(num ratio) => this(ratio: ratio);

  @override
  ScorePart weight(num weight) => this(weight: weight);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScorePart(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScorePart(...).copyWith(id: 12, name: "My name")
  /// ````
  ScorePart call({
    Object? key = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? ratio = const $CopyWithPlaceholder(),
    Object? weight = const $CopyWithPlaceholder(),
  }) {
    return ScorePart(
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as ScorePartKeyEnum,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      ratio: ratio == const $CopyWithPlaceholder()
          ? _value.ratio
          // ignore: cast_nullable_to_non_nullable
          : ratio as num,
      weight: weight == const $CopyWithPlaceholder()
          ? _value.weight
          // ignore: cast_nullable_to_non_nullable
          : weight as num,
    );
  }
}

extension $ScorePartCopyWith on ScorePart {
  /// Returns a callable class that can be used as follows: `instanceOfScorePart.copyWith(...)` or like so:`instanceOfScorePart.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScorePartCWProxy get copyWith => _$ScorePartCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScorePart _$ScorePartFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ScorePart', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'label', 'ratio', 'weight']);
      final val = ScorePart(
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(
            _$ScorePartKeyEnumEnumMap,
            v,
            unknownValue: ScorePartKeyEnum.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        ratio: $checkedConvert('ratio', (v) => v as num),
        weight: $checkedConvert('weight', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$ScorePartToJson(ScorePart instance) => <String, dynamic>{
  'key': _$ScorePartKeyEnumEnumMap[instance.key]!,
  'label': instance.label,
  'ratio': instance.ratio,
  'weight': instance.weight,
};

const _$ScorePartKeyEnumEnumMap = {
  ScorePartKeyEnum.assiduite: 'assiduite',
  ScorePartKeyEnum.regularite: 'regularite',
  ScorePartKeyEnum.rythme: 'rythme',
  ScorePartKeyEnum.contact: 'contact',
  ScorePartKeyEnum.qualification: 'qualification',
  ScorePartKeyEnum.efficience: 'efficience',
  ScorePartKeyEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
