// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_jour_semaine_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatJourSemaineDtoCWProxy {
  VisiteStatJourSemaineDto weekday(num weekday);

  VisiteStatJourSemaineDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatJourSemaineDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatJourSemaineDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatJourSemaineDto call({num weekday, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatJourSemaineDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatJourSemaineDto.copyWith.fieldName(...)`
class _$VisiteStatJourSemaineDtoCWProxyImpl
    implements _$VisiteStatJourSemaineDtoCWProxy {
  const _$VisiteStatJourSemaineDtoCWProxyImpl(this._value);

  final VisiteStatJourSemaineDto _value;

  @override
  VisiteStatJourSemaineDto weekday(num weekday) => this(weekday: weekday);

  @override
  VisiteStatJourSemaineDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatJourSemaineDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatJourSemaineDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatJourSemaineDto call({
    Object? weekday = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatJourSemaineDto(
      weekday: weekday == const $CopyWithPlaceholder()
          ? _value.weekday
          // ignore: cast_nullable_to_non_nullable
          : weekday as num,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatJourSemaineDtoCopyWith on VisiteStatJourSemaineDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatJourSemaineDto.copyWith(...)` or like so:`instanceOfVisiteStatJourSemaineDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatJourSemaineDtoCWProxy get copyWith =>
      _$VisiteStatJourSemaineDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatJourSemaineDto _$VisiteStatJourSemaineDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteStatJourSemaineDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['weekday', 'count']);
  final val = VisiteStatJourSemaineDto(
    weekday: $checkedConvert('weekday', (v) => v as num),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$VisiteStatJourSemaineDtoToJson(
  VisiteStatJourSemaineDto instance,
) => <String, dynamic>{'weekday': instance.weekday, 'count': instance.count};
