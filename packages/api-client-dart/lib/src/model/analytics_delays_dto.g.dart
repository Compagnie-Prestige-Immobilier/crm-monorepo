// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analytics_delays_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnalyticsDelaysDtoCWProxy {
  AnalyticsDelaysDto legs(List<DelayLegDto> legs);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsDelaysDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsDelaysDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsDelaysDto call({List<DelayLegDto> legs});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnalyticsDelaysDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnalyticsDelaysDto.copyWith.fieldName(...)`
class _$AnalyticsDelaysDtoCWProxyImpl implements _$AnalyticsDelaysDtoCWProxy {
  const _$AnalyticsDelaysDtoCWProxyImpl(this._value);

  final AnalyticsDelaysDto _value;

  @override
  AnalyticsDelaysDto legs(List<DelayLegDto> legs) => this(legs: legs);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsDelaysDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsDelaysDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsDelaysDto call({Object? legs = const $CopyWithPlaceholder()}) {
    return AnalyticsDelaysDto(
      legs: legs == const $CopyWithPlaceholder()
          ? _value.legs
          // ignore: cast_nullable_to_non_nullable
          : legs as List<DelayLegDto>,
    );
  }
}

extension $AnalyticsDelaysDtoCopyWith on AnalyticsDelaysDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnalyticsDelaysDto.copyWith(...)` or like so:`instanceOfAnalyticsDelaysDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnalyticsDelaysDtoCWProxy get copyWith =>
      _$AnalyticsDelaysDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalyticsDelaysDto _$AnalyticsDelaysDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AnalyticsDelaysDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['legs']);
      final val = AnalyticsDelaysDto(
        legs: $checkedConvert(
          'legs',
          (v) => (v as List<dynamic>)
              .map((e) => DelayLegDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AnalyticsDelaysDtoToJson(AnalyticsDelaysDto instance) =>
    <String, dynamic>{'legs': instance.legs.map((e) => e.toJson()).toList()};
