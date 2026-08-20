// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_jour_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatJourDtoCWProxy {
  VisiteStatJourDto date(String date);

  VisiteStatJourDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatJourDto call({String date, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatJourDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatJourDto.copyWith.fieldName(...)`
class _$VisiteStatJourDtoCWProxyImpl implements _$VisiteStatJourDtoCWProxy {
  const _$VisiteStatJourDtoCWProxyImpl(this._value);

  final VisiteStatJourDto _value;

  @override
  VisiteStatJourDto date(String date) => this(date: date);

  @override
  VisiteStatJourDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatJourDto call({
    Object? date = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatJourDto(
      date: date == const $CopyWithPlaceholder()
          ? _value.date
          // ignore: cast_nullable_to_non_nullable
          : date as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatJourDtoCopyWith on VisiteStatJourDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatJourDto.copyWith(...)` or like so:`instanceOfVisiteStatJourDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatJourDtoCWProxy get copyWith =>
      _$VisiteStatJourDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatJourDto _$VisiteStatJourDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatJourDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['date', 'count']);
      final val = VisiteStatJourDto(
        date: $checkedConvert('date', (v) => v as String),
        count: $checkedConvert('count', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatJourDtoToJson(VisiteStatJourDto instance) =>
    <String, dynamic>{'date': instance.date, 'count': instance.count};
