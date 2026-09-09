// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_activity_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionActivityDtoCWProxy {
  SupervisionActivityDto from(DateTime? from);

  SupervisionActivityDto to(DateTime? to);

  SupervisionActivityDto granularity(SupervisionGranularity granularity);

  SupervisionActivityDto items(List<SupervisionActivityRowDto> items);

  SupervisionActivityDto totals(SupervisionActivityCountsDto totals);

  SupervisionActivityDto teleconseillers(
    List<SupervisionTeleconseillerDto> teleconseillers,
  );

  SupervisionActivityDto scores(List<SupervisionScoreDto> scores);

  SupervisionActivityDto prospectsByTeleconseiller(
    List<SupervisionHistogramBarDto> prospectsByTeleconseiller,
  );

  SupervisionActivityDto prospectsByRepresentant(
    List<SupervisionHistogramBarDto> prospectsByRepresentant,
  );

  SupervisionActivityDto repQualificationStatuses(
    SupervisionRepStatutsDto? repQualificationStatuses,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionActivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionActivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionActivityDto call({
    DateTime? from,
    DateTime? to,
    SupervisionGranularity granularity,
    List<SupervisionActivityRowDto> items,
    SupervisionActivityCountsDto totals,
    List<SupervisionTeleconseillerDto> teleconseillers,
    List<SupervisionScoreDto> scores,
    List<SupervisionHistogramBarDto> prospectsByTeleconseiller,
    List<SupervisionHistogramBarDto> prospectsByRepresentant,
    SupervisionRepStatutsDto? repQualificationStatuses,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionActivityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionActivityDto.copyWith.fieldName(...)`
class _$SupervisionActivityDtoCWProxyImpl
    implements _$SupervisionActivityDtoCWProxy {
  const _$SupervisionActivityDtoCWProxyImpl(this._value);

  final SupervisionActivityDto _value;

  @override
  SupervisionActivityDto from(DateTime? from) => this(from: from);

  @override
  SupervisionActivityDto to(DateTime? to) => this(to: to);

  @override
  SupervisionActivityDto granularity(SupervisionGranularity granularity) =>
      this(granularity: granularity);

  @override
  SupervisionActivityDto items(List<SupervisionActivityRowDto> items) =>
      this(items: items);

  @override
  SupervisionActivityDto totals(SupervisionActivityCountsDto totals) =>
      this(totals: totals);

  @override
  SupervisionActivityDto teleconseillers(
    List<SupervisionTeleconseillerDto> teleconseillers,
  ) => this(teleconseillers: teleconseillers);

  @override
  SupervisionActivityDto scores(List<SupervisionScoreDto> scores) =>
      this(scores: scores);

  @override
  SupervisionActivityDto prospectsByTeleconseiller(
    List<SupervisionHistogramBarDto> prospectsByTeleconseiller,
  ) => this(prospectsByTeleconseiller: prospectsByTeleconseiller);

  @override
  SupervisionActivityDto prospectsByRepresentant(
    List<SupervisionHistogramBarDto> prospectsByRepresentant,
  ) => this(prospectsByRepresentant: prospectsByRepresentant);

  @override
  SupervisionActivityDto repQualificationStatuses(
    SupervisionRepStatutsDto? repQualificationStatuses,
  ) => this(repQualificationStatuses: repQualificationStatuses);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionActivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionActivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionActivityDto call({
    Object? from = const $CopyWithPlaceholder(),
    Object? to = const $CopyWithPlaceholder(),
    Object? granularity = const $CopyWithPlaceholder(),
    Object? items = const $CopyWithPlaceholder(),
    Object? totals = const $CopyWithPlaceholder(),
    Object? teleconseillers = const $CopyWithPlaceholder(),
    Object? scores = const $CopyWithPlaceholder(),
    Object? prospectsByTeleconseiller = const $CopyWithPlaceholder(),
    Object? prospectsByRepresentant = const $CopyWithPlaceholder(),
    Object? repQualificationStatuses = const $CopyWithPlaceholder(),
  }) {
    return SupervisionActivityDto(
      from: from == const $CopyWithPlaceholder()
          ? _value.from
          // ignore: cast_nullable_to_non_nullable
          : from as DateTime?,
      to: to == const $CopyWithPlaceholder()
          ? _value.to
          // ignore: cast_nullable_to_non_nullable
          : to as DateTime?,
      granularity: granularity == const $CopyWithPlaceholder()
          ? _value.granularity
          // ignore: cast_nullable_to_non_nullable
          : granularity as SupervisionGranularity,
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SupervisionActivityRowDto>,
      totals: totals == const $CopyWithPlaceholder()
          ? _value.totals
          // ignore: cast_nullable_to_non_nullable
          : totals as SupervisionActivityCountsDto,
      teleconseillers: teleconseillers == const $CopyWithPlaceholder()
          ? _value.teleconseillers
          // ignore: cast_nullable_to_non_nullable
          : teleconseillers as List<SupervisionTeleconseillerDto>,
      scores: scores == const $CopyWithPlaceholder()
          ? _value.scores
          // ignore: cast_nullable_to_non_nullable
          : scores as List<SupervisionScoreDto>,
      prospectsByTeleconseiller:
          prospectsByTeleconseiller == const $CopyWithPlaceholder()
          ? _value.prospectsByTeleconseiller
          // ignore: cast_nullable_to_non_nullable
          : prospectsByTeleconseiller as List<SupervisionHistogramBarDto>,
      prospectsByRepresentant:
          prospectsByRepresentant == const $CopyWithPlaceholder()
          ? _value.prospectsByRepresentant
          // ignore: cast_nullable_to_non_nullable
          : prospectsByRepresentant as List<SupervisionHistogramBarDto>,
      repQualificationStatuses:
          repQualificationStatuses == const $CopyWithPlaceholder()
          ? _value.repQualificationStatuses
          // ignore: cast_nullable_to_non_nullable
          : repQualificationStatuses as SupervisionRepStatutsDto?,
    );
  }
}

extension $SupervisionActivityDtoCopyWith on SupervisionActivityDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionActivityDto.copyWith(...)` or like so:`instanceOfSupervisionActivityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionActivityDtoCWProxy get copyWith =>
      _$SupervisionActivityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionActivityDto _$SupervisionActivityDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionActivityDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'from',
      'to',
      'granularity',
      'items',
      'totals',
      'teleconseillers',
      'scores',
      'prospectsByTeleconseiller',
      'prospectsByRepresentant',
      'repQualificationStatuses',
    ],
  );
  final val = SupervisionActivityDto(
    from: $checkedConvert(
      'from',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    to: $checkedConvert(
      'to',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    granularity: $checkedConvert(
      'granularity',
      (v) => $enumDecode(
        _$SupervisionGranularityEnumMap,
        v,
        unknownValue: SupervisionGranularity.unknownDefaultOpenApi,
      ),
    ),
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                SupervisionActivityRowDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    totals: $checkedConvert(
      'totals',
      (v) => SupervisionActivityCountsDto.fromJson(v as Map<String, dynamic>),
    ),
    teleconseillers: $checkedConvert(
      'teleconseillers',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SupervisionTeleconseillerDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    scores: $checkedConvert(
      'scores',
      (v) => (v as List<dynamic>)
          .map((e) => SupervisionScoreDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    prospectsByTeleconseiller: $checkedConvert(
      'prospectsByTeleconseiller',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                SupervisionHistogramBarDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    prospectsByRepresentant: $checkedConvert(
      'prospectsByRepresentant',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                SupervisionHistogramBarDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    repQualificationStatuses: $checkedConvert(
      'repQualificationStatuses',
      (v) => v == null
          ? null
          : SupervisionRepStatutsDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$SupervisionActivityDtoToJson(
  SupervisionActivityDto instance,
) => <String, dynamic>{
  'from': instance.from?.toIso8601String(),
  'to': instance.to?.toIso8601String(),
  'granularity': _$SupervisionGranularityEnumMap[instance.granularity]!,
  'items': instance.items.map((e) => e.toJson()).toList(),
  'totals': instance.totals.toJson(),
  'teleconseillers': instance.teleconseillers.map((e) => e.toJson()).toList(),
  'scores': instance.scores.map((e) => e.toJson()).toList(),
  'prospectsByTeleconseiller': instance.prospectsByTeleconseiller
      .map((e) => e.toJson())
      .toList(),
  'prospectsByRepresentant': instance.prospectsByRepresentant
      .map((e) => e.toJson())
      .toList(),
  'repQualificationStatuses': instance.repQualificationStatuses?.toJson(),
};

const _$SupervisionGranularityEnumMap = {
  SupervisionGranularity.day: 'day',
  SupervisionGranularity.week: 'week',
  SupervisionGranularity.unknownDefaultOpenApi: 'unknown_default_open_api',
};
