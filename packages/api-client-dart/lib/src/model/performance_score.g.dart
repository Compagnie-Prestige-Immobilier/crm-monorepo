// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'performance_score.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PerformanceScoreCWProxy {
  PerformanceScore value(num? value);

  PerformanceScore reason(PerformanceScoreReasonEnum? reason);

  PerformanceScore parts(List<ScorePart> parts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PerformanceScore(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PerformanceScore(...).copyWith(id: 12, name: "My name")
  /// ````
  PerformanceScore call({
    num? value,
    PerformanceScoreReasonEnum? reason,
    List<ScorePart> parts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPerformanceScore.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPerformanceScore.copyWith.fieldName(...)`
class _$PerformanceScoreCWProxyImpl implements _$PerformanceScoreCWProxy {
  const _$PerformanceScoreCWProxyImpl(this._value);

  final PerformanceScore _value;

  @override
  PerformanceScore value(num? value) => this(value: value);

  @override
  PerformanceScore reason(PerformanceScoreReasonEnum? reason) =>
      this(reason: reason);

  @override
  PerformanceScore parts(List<ScorePart> parts) => this(parts: parts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PerformanceScore(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PerformanceScore(...).copyWith(id: 12, name: "My name")
  /// ````
  PerformanceScore call({
    Object? value = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? parts = const $CopyWithPlaceholder(),
  }) {
    return PerformanceScore(
      value: value == const $CopyWithPlaceholder()
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as num?,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as PerformanceScoreReasonEnum?,
      parts: parts == const $CopyWithPlaceholder()
          ? _value.parts
          // ignore: cast_nullable_to_non_nullable
          : parts as List<ScorePart>,
    );
  }
}

extension $PerformanceScoreCopyWith on PerformanceScore {
  /// Returns a callable class that can be used as follows: `instanceOfPerformanceScore.copyWith(...)` or like so:`instanceOfPerformanceScore.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PerformanceScoreCWProxy get copyWith => _$PerformanceScoreCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PerformanceScore _$PerformanceScoreFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PerformanceScore', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['value', 'reason', 'parts']);
      final val = PerformanceScore(
        value: $checkedConvert('value', (v) => v as num?),
        reason: $checkedConvert(
          'reason',
          (v) => $enumDecodeNullable(
            _$PerformanceScoreReasonEnumEnumMap,
            v,
            unknownValue: PerformanceScoreReasonEnum.unknownDefaultOpenApi,
          ),
        ),
        parts: $checkedConvert(
          'parts',
          (v) => (v as List<dynamic>)
              .map((e) => ScorePart.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PerformanceScoreToJson(PerformanceScore instance) =>
    <String, dynamic>{
      'value': instance.value,
      'reason': _$PerformanceScoreReasonEnumEnumMap[instance.reason],
      'parts': instance.parts.map((e) => e.toJson()).toList(),
    };

const _$PerformanceScoreReasonEnumEnumMap = {
  PerformanceScoreReasonEnum.journeeNonCommencee: 'journee_non_commencee',
  PerformanceScoreReasonEnum.presenceNonMesuree: 'presence_non_mesuree',
  PerformanceScoreReasonEnum.aucunAppel: 'aucun_appel',
  PerformanceScoreReasonEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
