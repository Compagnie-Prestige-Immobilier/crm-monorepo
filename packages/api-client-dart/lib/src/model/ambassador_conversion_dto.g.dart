// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ambassador_conversion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AmbassadorConversionDtoCWProxy {
  AmbassadorConversionDto contacted(num contacted);

  AmbassadorConversionDto ambassadors(num ambassadors);

  AmbassadorConversionDto conversionRate(num? conversionRate);

  AmbassadorConversionDto reverted(num reverted);

  AmbassadorConversionDto untracked(num untracked);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AmbassadorConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AmbassadorConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AmbassadorConversionDto call({
    num contacted,
    num ambassadors,
    num? conversionRate,
    num reverted,
    num untracked,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAmbassadorConversionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAmbassadorConversionDto.copyWith.fieldName(...)`
class _$AmbassadorConversionDtoCWProxyImpl
    implements _$AmbassadorConversionDtoCWProxy {
  const _$AmbassadorConversionDtoCWProxyImpl(this._value);

  final AmbassadorConversionDto _value;

  @override
  AmbassadorConversionDto contacted(num contacted) =>
      this(contacted: contacted);

  @override
  AmbassadorConversionDto ambassadors(num ambassadors) =>
      this(ambassadors: ambassadors);

  @override
  AmbassadorConversionDto conversionRate(num? conversionRate) =>
      this(conversionRate: conversionRate);

  @override
  AmbassadorConversionDto reverted(num reverted) => this(reverted: reverted);

  @override
  AmbassadorConversionDto untracked(num untracked) =>
      this(untracked: untracked);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AmbassadorConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AmbassadorConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AmbassadorConversionDto call({
    Object? contacted = const $CopyWithPlaceholder(),
    Object? ambassadors = const $CopyWithPlaceholder(),
    Object? conversionRate = const $CopyWithPlaceholder(),
    Object? reverted = const $CopyWithPlaceholder(),
    Object? untracked = const $CopyWithPlaceholder(),
  }) {
    return AmbassadorConversionDto(
      contacted: contacted == const $CopyWithPlaceholder()
          ? _value.contacted
          // ignore: cast_nullable_to_non_nullable
          : contacted as num,
      ambassadors: ambassadors == const $CopyWithPlaceholder()
          ? _value.ambassadors
          // ignore: cast_nullable_to_non_nullable
          : ambassadors as num,
      conversionRate: conversionRate == const $CopyWithPlaceholder()
          ? _value.conversionRate
          // ignore: cast_nullable_to_non_nullable
          : conversionRate as num?,
      reverted: reverted == const $CopyWithPlaceholder()
          ? _value.reverted
          // ignore: cast_nullable_to_non_nullable
          : reverted as num,
      untracked: untracked == const $CopyWithPlaceholder()
          ? _value.untracked
          // ignore: cast_nullable_to_non_nullable
          : untracked as num,
    );
  }
}

extension $AmbassadorConversionDtoCopyWith on AmbassadorConversionDto {
  /// Returns a callable class that can be used as follows: `instanceOfAmbassadorConversionDto.copyWith(...)` or like so:`instanceOfAmbassadorConversionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AmbassadorConversionDtoCWProxy get copyWith =>
      _$AmbassadorConversionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AmbassadorConversionDto _$AmbassadorConversionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('AmbassadorConversionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'contacted',
      'ambassadors',
      'conversionRate',
      'reverted',
      'untracked',
    ],
  );
  final val = AmbassadorConversionDto(
    contacted: $checkedConvert('contacted', (v) => v as num),
    ambassadors: $checkedConvert('ambassadors', (v) => v as num),
    conversionRate: $checkedConvert('conversionRate', (v) => v as num?),
    reverted: $checkedConvert('reverted', (v) => v as num),
    untracked: $checkedConvert('untracked', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$AmbassadorConversionDtoToJson(
  AmbassadorConversionDto instance,
) => <String, dynamic>{
  'contacted': instance.contacted,
  'ambassadors': instance.ambassadors,
  'conversionRate': instance.conversionRate,
  'reverted': instance.reverted,
  'untracked': instance.untracked,
};
