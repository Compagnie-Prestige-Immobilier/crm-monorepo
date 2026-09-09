// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_heure_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatHeureDtoCWProxy {
  VisiteStatHeureDto hour(num hour);

  VisiteStatHeureDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatHeureDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatHeureDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatHeureDto call({num hour, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatHeureDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatHeureDto.copyWith.fieldName(...)`
class _$VisiteStatHeureDtoCWProxyImpl implements _$VisiteStatHeureDtoCWProxy {
  const _$VisiteStatHeureDtoCWProxyImpl(this._value);

  final VisiteStatHeureDto _value;

  @override
  VisiteStatHeureDto hour(num hour) => this(hour: hour);

  @override
  VisiteStatHeureDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatHeureDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatHeureDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatHeureDto call({
    Object? hour = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatHeureDto(
      hour: hour == const $CopyWithPlaceholder()
          ? _value.hour
          // ignore: cast_nullable_to_non_nullable
          : hour as num,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatHeureDtoCopyWith on VisiteStatHeureDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatHeureDto.copyWith(...)` or like so:`instanceOfVisiteStatHeureDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatHeureDtoCWProxy get copyWith =>
      _$VisiteStatHeureDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatHeureDto _$VisiteStatHeureDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatHeureDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['hour', 'count']);
      final val = VisiteStatHeureDto(
        hour: $checkedConvert('hour', (v) => v as num),
        count: $checkedConvert('count', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatHeureDtoToJson(VisiteStatHeureDto instance) =>
    <String, dynamic>{'hour': instance.hour, 'count': instance.count};
