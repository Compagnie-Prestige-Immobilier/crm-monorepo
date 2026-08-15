// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'delay_leg_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DelayLegDtoCWProxy {
  DelayLegDto leg(DelayLeg leg);

  DelayLegDto label(String label);

  DelayLegDto medianDays(num? medianDays);

  DelayLegDto p90Days(num? p90Days);

  DelayLegDto sample(num sample);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DelayLegDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DelayLegDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DelayLegDto call({
    DelayLeg leg,
    String label,
    num? medianDays,
    num? p90Days,
    num sample,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDelayLegDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDelayLegDto.copyWith.fieldName(...)`
class _$DelayLegDtoCWProxyImpl implements _$DelayLegDtoCWProxy {
  const _$DelayLegDtoCWProxyImpl(this._value);

  final DelayLegDto _value;

  @override
  DelayLegDto leg(DelayLeg leg) => this(leg: leg);

  @override
  DelayLegDto label(String label) => this(label: label);

  @override
  DelayLegDto medianDays(num? medianDays) => this(medianDays: medianDays);

  @override
  DelayLegDto p90Days(num? p90Days) => this(p90Days: p90Days);

  @override
  DelayLegDto sample(num sample) => this(sample: sample);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DelayLegDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DelayLegDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DelayLegDto call({
    Object? leg = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? medianDays = const $CopyWithPlaceholder(),
    Object? p90Days = const $CopyWithPlaceholder(),
    Object? sample = const $CopyWithPlaceholder(),
  }) {
    return DelayLegDto(
      leg: leg == const $CopyWithPlaceholder()
          ? _value.leg
          // ignore: cast_nullable_to_non_nullable
          : leg as DelayLeg,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      medianDays: medianDays == const $CopyWithPlaceholder()
          ? _value.medianDays
          // ignore: cast_nullable_to_non_nullable
          : medianDays as num?,
      p90Days: p90Days == const $CopyWithPlaceholder()
          ? _value.p90Days
          // ignore: cast_nullable_to_non_nullable
          : p90Days as num?,
      sample: sample == const $CopyWithPlaceholder()
          ? _value.sample
          // ignore: cast_nullable_to_non_nullable
          : sample as num,
    );
  }
}

extension $DelayLegDtoCopyWith on DelayLegDto {
  /// Returns a callable class that can be used as follows: `instanceOfDelayLegDto.copyWith(...)` or like so:`instanceOfDelayLegDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DelayLegDtoCWProxy get copyWith => _$DelayLegDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DelayLegDto _$DelayLegDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DelayLegDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['leg', 'label', 'medianDays', 'p90Days', 'sample'],
      );
      final val = DelayLegDto(
        leg: $checkedConvert(
          'leg',
          (v) => $enumDecode(
            _$DelayLegEnumMap,
            v,
            unknownValue: DelayLeg.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        medianDays: $checkedConvert('medianDays', (v) => v as num?),
        p90Days: $checkedConvert('p90Days', (v) => v as num?),
        sample: $checkedConvert('sample', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$DelayLegDtoToJson(DelayLegDto instance) =>
    <String, dynamic>{
      'leg': _$DelayLegEnumMap[instance.leg]!,
      'label': instance.label,
      'medianDays': instance.medianDays,
      'p90Days': instance.p90Days,
      'sample': instance.sample,
    };

const _$DelayLegEnumMap = {
  DelayLeg.CREATION_TO_METHOD: 'CREATION_TO_METHOD',
  DelayLeg.METHOD_TO_CASE: 'METHOD_TO_CASE',
  DelayLeg.CASE_TO_CASHED: 'CASE_TO_CASHED',
  DelayLeg.unknownDefaultOpenApi: 'unknown_default_open_api',
};
