// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'score_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScoreDtoCWProxy {
  ScoreDto value(num? value);

  ScoreDto reason(ScoreDtoReasonEnum? reason);

  ScoreDto parts(List<ScorePartDto> parts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScoreDto call({
    num? value,
    ScoreDtoReasonEnum? reason,
    List<ScorePartDto> parts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfScoreDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfScoreDto.copyWith.fieldName(...)`
class _$ScoreDtoCWProxyImpl implements _$ScoreDtoCWProxy {
  const _$ScoreDtoCWProxyImpl(this._value);

  final ScoreDto _value;

  @override
  ScoreDto value(num? value) => this(value: value);

  @override
  ScoreDto reason(ScoreDtoReasonEnum? reason) => this(reason: reason);

  @override
  ScoreDto parts(List<ScorePartDto> parts) => this(parts: parts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ScoreDto call({
    Object? value = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? parts = const $CopyWithPlaceholder(),
  }) {
    return ScoreDto(
      value: value == const $CopyWithPlaceholder()
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as num?,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as ScoreDtoReasonEnum?,
      parts: parts == const $CopyWithPlaceholder()
          ? _value.parts
          // ignore: cast_nullable_to_non_nullable
          : parts as List<ScorePartDto>,
    );
  }
}

extension $ScoreDtoCopyWith on ScoreDto {
  /// Returns a callable class that can be used as follows: `instanceOfScoreDto.copyWith(...)` or like so:`instanceOfScoreDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScoreDtoCWProxy get copyWith => _$ScoreDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScoreDto _$ScoreDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ScoreDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['value', 'reason', 'parts']);
      final val = ScoreDto(
        value: $checkedConvert('value', (v) => v as num?),
        reason: $checkedConvert(
          'reason',
          (v) => $enumDecodeNullable(
            _$ScoreDtoReasonEnumEnumMap,
            v,
            unknownValue: ScoreDtoReasonEnum.unknownDefaultOpenApi,
          ),
        ),
        parts: $checkedConvert(
          'parts',
          (v) => (v as List<dynamic>)
              .map((e) => ScorePartDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ScoreDtoToJson(ScoreDto instance) => <String, dynamic>{
  'value': instance.value,
  'reason': _$ScoreDtoReasonEnumEnumMap[instance.reason],
  'parts': instance.parts.map((e) => e.toJson()).toList(),
};

const _$ScoreDtoReasonEnumEnumMap = {
  ScoreDtoReasonEnum.journeeNonCommencee: 'journee_non_commencee',
  ScoreDtoReasonEnum.presenceNonMesuree: 'presence_non_mesuree',
  ScoreDtoReasonEnum.aucunAppel: 'aucun_appel',
  ScoreDtoReasonEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
