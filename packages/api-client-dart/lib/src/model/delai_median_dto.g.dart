// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'delai_median_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DelaiMedianDtoCWProxy {
  DelaiMedianDto leg(String leg);

  DelaiMedianDto label(String label);

  DelaiMedianDto medianDays(num? medianDays);

  DelaiMedianDto sample(num sample);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DelaiMedianDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DelaiMedianDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DelaiMedianDto call({String leg, String label, num? medianDays, num sample});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDelaiMedianDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDelaiMedianDto.copyWith.fieldName(...)`
class _$DelaiMedianDtoCWProxyImpl implements _$DelaiMedianDtoCWProxy {
  const _$DelaiMedianDtoCWProxyImpl(this._value);

  final DelaiMedianDto _value;

  @override
  DelaiMedianDto leg(String leg) => this(leg: leg);

  @override
  DelaiMedianDto label(String label) => this(label: label);

  @override
  DelaiMedianDto medianDays(num? medianDays) => this(medianDays: medianDays);

  @override
  DelaiMedianDto sample(num sample) => this(sample: sample);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DelaiMedianDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DelaiMedianDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DelaiMedianDto call({
    Object? leg = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? medianDays = const $CopyWithPlaceholder(),
    Object? sample = const $CopyWithPlaceholder(),
  }) {
    return DelaiMedianDto(
      leg: leg == const $CopyWithPlaceholder()
          ? _value.leg
          // ignore: cast_nullable_to_non_nullable
          : leg as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      medianDays: medianDays == const $CopyWithPlaceholder()
          ? _value.medianDays
          // ignore: cast_nullable_to_non_nullable
          : medianDays as num?,
      sample: sample == const $CopyWithPlaceholder()
          ? _value.sample
          // ignore: cast_nullable_to_non_nullable
          : sample as num,
    );
  }
}

extension $DelaiMedianDtoCopyWith on DelaiMedianDto {
  /// Returns a callable class that can be used as follows: `instanceOfDelaiMedianDto.copyWith(...)` or like so:`instanceOfDelaiMedianDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DelaiMedianDtoCWProxy get copyWith => _$DelaiMedianDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DelaiMedianDto _$DelaiMedianDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DelaiMedianDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['leg', 'label', 'medianDays', 'sample'],
      );
      final val = DelaiMedianDto(
        leg: $checkedConvert('leg', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        medianDays: $checkedConvert('medianDays', (v) => v as num?),
        sample: $checkedConvert('sample', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$DelaiMedianDtoToJson(DelaiMedianDto instance) =>
    <String, dynamic>{
      'leg': instance.leg,
      'label': instance.label,
      'medianDays': instance.medianDays,
      'sample': instance.sample,
    };
