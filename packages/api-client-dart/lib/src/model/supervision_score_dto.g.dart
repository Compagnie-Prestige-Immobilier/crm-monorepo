// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_score_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionScoreDtoCWProxy {
  SupervisionScoreDto teleconseillerId(String teleconseillerId);

  SupervisionScoreDto teleconseillerName(String teleconseillerName);

  SupervisionScoreDto activeSecondsInShifts(num activeSecondsInShifts);

  SupervisionScoreDto shiftSecondsElapsed(num shiftSecondsElapsed);

  SupervisionScoreDto calls(num calls);

  SupervisionScoreDto reached(num reached);

  SupervisionScoreDto qualified(num qualified);

  SupervisionScoreDto repeatCalls(num repeatCalls);

  SupervisionScoreDto deadSeconds(num deadSeconds);

  SupervisionScoreDto score(PerformanceScore score);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionScoreDto call({
    String teleconseillerId,
    String teleconseillerName,
    num activeSecondsInShifts,
    num shiftSecondsElapsed,
    num calls,
    num reached,
    num qualified,
    num repeatCalls,
    num deadSeconds,
    PerformanceScore score,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionScoreDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionScoreDto.copyWith.fieldName(...)`
class _$SupervisionScoreDtoCWProxyImpl implements _$SupervisionScoreDtoCWProxy {
  const _$SupervisionScoreDtoCWProxyImpl(this._value);

  final SupervisionScoreDto _value;

  @override
  SupervisionScoreDto teleconseillerId(String teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  SupervisionScoreDto teleconseillerName(String teleconseillerName) =>
      this(teleconseillerName: teleconseillerName);

  @override
  SupervisionScoreDto activeSecondsInShifts(num activeSecondsInShifts) =>
      this(activeSecondsInShifts: activeSecondsInShifts);

  @override
  SupervisionScoreDto shiftSecondsElapsed(num shiftSecondsElapsed) =>
      this(shiftSecondsElapsed: shiftSecondsElapsed);

  @override
  SupervisionScoreDto calls(num calls) => this(calls: calls);

  @override
  SupervisionScoreDto reached(num reached) => this(reached: reached);

  @override
  SupervisionScoreDto qualified(num qualified) => this(qualified: qualified);

  @override
  SupervisionScoreDto repeatCalls(num repeatCalls) =>
      this(repeatCalls: repeatCalls);

  @override
  SupervisionScoreDto deadSeconds(num deadSeconds) =>
      this(deadSeconds: deadSeconds);

  @override
  SupervisionScoreDto score(PerformanceScore score) => this(score: score);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionScoreDto call({
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? teleconseillerName = const $CopyWithPlaceholder(),
    Object? activeSecondsInShifts = const $CopyWithPlaceholder(),
    Object? shiftSecondsElapsed = const $CopyWithPlaceholder(),
    Object? calls = const $CopyWithPlaceholder(),
    Object? reached = const $CopyWithPlaceholder(),
    Object? qualified = const $CopyWithPlaceholder(),
    Object? repeatCalls = const $CopyWithPlaceholder(),
    Object? deadSeconds = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
  }) {
    return SupervisionScoreDto(
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
      teleconseillerName: teleconseillerName == const $CopyWithPlaceholder()
          ? _value.teleconseillerName
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerName as String,
      activeSecondsInShifts:
          activeSecondsInShifts == const $CopyWithPlaceholder()
          ? _value.activeSecondsInShifts
          // ignore: cast_nullable_to_non_nullable
          : activeSecondsInShifts as num,
      shiftSecondsElapsed: shiftSecondsElapsed == const $CopyWithPlaceholder()
          ? _value.shiftSecondsElapsed
          // ignore: cast_nullable_to_non_nullable
          : shiftSecondsElapsed as num,
      calls: calls == const $CopyWithPlaceholder()
          ? _value.calls
          // ignore: cast_nullable_to_non_nullable
          : calls as num,
      reached: reached == const $CopyWithPlaceholder()
          ? _value.reached
          // ignore: cast_nullable_to_non_nullable
          : reached as num,
      qualified: qualified == const $CopyWithPlaceholder()
          ? _value.qualified
          // ignore: cast_nullable_to_non_nullable
          : qualified as num,
      repeatCalls: repeatCalls == const $CopyWithPlaceholder()
          ? _value.repeatCalls
          // ignore: cast_nullable_to_non_nullable
          : repeatCalls as num,
      deadSeconds: deadSeconds == const $CopyWithPlaceholder()
          ? _value.deadSeconds
          // ignore: cast_nullable_to_non_nullable
          : deadSeconds as num,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as PerformanceScore,
    );
  }
}

extension $SupervisionScoreDtoCopyWith on SupervisionScoreDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionScoreDto.copyWith(...)` or like so:`instanceOfSupervisionScoreDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionScoreDtoCWProxy get copyWith =>
      _$SupervisionScoreDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionScoreDto _$SupervisionScoreDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SupervisionScoreDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'teleconseillerId',
          'teleconseillerName',
          'activeSecondsInShifts',
          'shiftSecondsElapsed',
          'calls',
          'reached',
          'qualified',
          'repeatCalls',
          'deadSeconds',
          'score',
        ],
      );
      final val = SupervisionScoreDto(
        teleconseillerId: $checkedConvert(
          'teleconseillerId',
          (v) => v as String,
        ),
        teleconseillerName: $checkedConvert(
          'teleconseillerName',
          (v) => v as String,
        ),
        activeSecondsInShifts: $checkedConvert(
          'activeSecondsInShifts',
          (v) => v as num,
        ),
        shiftSecondsElapsed: $checkedConvert(
          'shiftSecondsElapsed',
          (v) => v as num,
        ),
        calls: $checkedConvert('calls', (v) => v as num),
        reached: $checkedConvert('reached', (v) => v as num),
        qualified: $checkedConvert('qualified', (v) => v as num),
        repeatCalls: $checkedConvert('repeatCalls', (v) => v as num),
        deadSeconds: $checkedConvert('deadSeconds', (v) => v as num),
        score: $checkedConvert(
          'score',
          (v) => PerformanceScore.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SupervisionScoreDtoToJson(
  SupervisionScoreDto instance,
) => <String, dynamic>{
  'teleconseillerId': instance.teleconseillerId,
  'teleconseillerName': instance.teleconseillerName,
  'activeSecondsInShifts': instance.activeSecondsInShifts,
  'shiftSecondsElapsed': instance.shiftSecondsElapsed,
  'calls': instance.calls,
  'reached': instance.reached,
  'qualified': instance.qualified,
  'repeatCalls': instance.repeatCalls,
  'deadSeconds': instance.deadSeconds,
  'score': instance.score.toJson(),
};
