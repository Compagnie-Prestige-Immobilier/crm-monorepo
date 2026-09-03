// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'score_part_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScorePartDtoCWProxy {
  ScorePartDto key(ScorePartDtoKeyEnum key);

  ScorePartDto label(String label);

  ScorePartDto ratio(num ratio);

  ScorePartDto weight(num weight);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScorePartDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScorePartDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScorePartDto call({
    ScorePartDtoKeyEnum key,
    String label,
    num ratio,
    num weight,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfScorePartDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfScorePartDto.copyWith.fieldName(...)`
class _$ScorePartDtoCWProxyImpl implements _$ScorePartDtoCWProxy {
  const _$ScorePartDtoCWProxyImpl(this._value);

  final ScorePartDto _value;

  @override
  ScorePartDto key(ScorePartDtoKeyEnum key) => this(key: key);

  @override
  ScorePartDto label(String label) => this(label: label);

  @override
  ScorePartDto ratio(num ratio) => this(ratio: ratio);

  @override
  ScorePartDto weight(num weight) => this(weight: weight);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScorePartDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScorePartDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScorePartDto call({
    Object? key = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? ratio = const $CopyWithPlaceholder(),
    Object? weight = const $CopyWithPlaceholder(),
  }) {
    return ScorePartDto(
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as ScorePartDtoKeyEnum,
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

extension $ScorePartDtoCopyWith on ScorePartDto {
  /// Returns a callable class that can be used as follows: `instanceOfScorePartDto.copyWith(...)` or like so:`instanceOfScorePartDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScorePartDtoCWProxy get copyWith => _$ScorePartDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScorePartDto _$ScorePartDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ScorePartDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'label', 'ratio', 'weight']);
      final val = ScorePartDto(
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(
            _$ScorePartDtoKeyEnumEnumMap,
            v,
            unknownValue: ScorePartDtoKeyEnum.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        ratio: $checkedConvert('ratio', (v) => v as num),
        weight: $checkedConvert('weight', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$ScorePartDtoToJson(ScorePartDto instance) =>
    <String, dynamic>{
      'key': _$ScorePartDtoKeyEnumEnumMap[instance.key]!,
      'label': instance.label,
      'ratio': instance.ratio,
      'weight': instance.weight,
    };

const _$ScorePartDtoKeyEnumEnumMap = {
  ScorePartDtoKeyEnum.assiduite: 'assiduite',
  ScorePartDtoKeyEnum.regularite: 'regularite',
  ScorePartDtoKeyEnum.rythme: 'rythme',
  ScorePartDtoKeyEnum.contact: 'contact',
  ScorePartDtoKeyEnum.qualification: 'qualification',
  ScorePartDtoKeyEnum.efficience: 'efficience',
  ScorePartDtoKeyEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
