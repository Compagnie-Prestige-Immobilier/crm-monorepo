// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_heure_jour_semaine_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatHeureJourSemaineDtoCWProxy {
  VisiteStatHeureJourSemaineDto weekday(num weekday);

  VisiteStatHeureJourSemaineDto hour(num hour);

  VisiteStatHeureJourSemaineDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatHeureJourSemaineDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatHeureJourSemaineDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatHeureJourSemaineDto call({num weekday, num hour, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatHeureJourSemaineDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatHeureJourSemaineDto.copyWith.fieldName(...)`
class _$VisiteStatHeureJourSemaineDtoCWProxyImpl
    implements _$VisiteStatHeureJourSemaineDtoCWProxy {
  const _$VisiteStatHeureJourSemaineDtoCWProxyImpl(this._value);

  final VisiteStatHeureJourSemaineDto _value;

  @override
  VisiteStatHeureJourSemaineDto weekday(num weekday) => this(weekday: weekday);

  @override
  VisiteStatHeureJourSemaineDto hour(num hour) => this(hour: hour);

  @override
  VisiteStatHeureJourSemaineDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatHeureJourSemaineDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatHeureJourSemaineDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatHeureJourSemaineDto call({
    Object? weekday = const $CopyWithPlaceholder(),
    Object? hour = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatHeureJourSemaineDto(
      weekday: weekday == const $CopyWithPlaceholder()
          ? _value.weekday
          // ignore: cast_nullable_to_non_nullable
          : weekday as num,
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

extension $VisiteStatHeureJourSemaineDtoCopyWith
    on VisiteStatHeureJourSemaineDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatHeureJourSemaineDto.copyWith(...)` or like so:`instanceOfVisiteStatHeureJourSemaineDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatHeureJourSemaineDtoCWProxy get copyWith =>
      _$VisiteStatHeureJourSemaineDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatHeureJourSemaineDto _$VisiteStatHeureJourSemaineDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteStatHeureJourSemaineDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['weekday', 'hour', 'count']);
  final val = VisiteStatHeureJourSemaineDto(
    weekday: $checkedConvert('weekday', (v) => v as num),
    hour: $checkedConvert('hour', (v) => v as num),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$VisiteStatHeureJourSemaineDtoToJson(
  VisiteStatHeureJourSemaineDto instance,
) => <String, dynamic>{
  'weekday': instance.weekday,
  'hour': instance.hour,
  'count': instance.count,
};
