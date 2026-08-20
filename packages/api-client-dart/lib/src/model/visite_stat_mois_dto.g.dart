// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_mois_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatMoisDtoCWProxy {
  VisiteStatMoisDto month(String month);

  VisiteStatMoisDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatMoisDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatMoisDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatMoisDto call({String month, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatMoisDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatMoisDto.copyWith.fieldName(...)`
class _$VisiteStatMoisDtoCWProxyImpl implements _$VisiteStatMoisDtoCWProxy {
  const _$VisiteStatMoisDtoCWProxyImpl(this._value);

  final VisiteStatMoisDto _value;

  @override
  VisiteStatMoisDto month(String month) => this(month: month);

  @override
  VisiteStatMoisDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatMoisDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatMoisDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatMoisDto call({
    Object? month = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatMoisDto(
      month: month == const $CopyWithPlaceholder()
          ? _value.month
          // ignore: cast_nullable_to_non_nullable
          : month as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatMoisDtoCopyWith on VisiteStatMoisDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatMoisDto.copyWith(...)` or like so:`instanceOfVisiteStatMoisDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatMoisDtoCWProxy get copyWith =>
      _$VisiteStatMoisDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatMoisDto _$VisiteStatMoisDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatMoisDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['month', 'count']);
      final val = VisiteStatMoisDto(
        month: $checkedConvert('month', (v) => v as String),
        count: $checkedConvert('count', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatMoisDtoToJson(VisiteStatMoisDto instance) =>
    <String, dynamic>{'month': instance.month, 'count': instance.count};
