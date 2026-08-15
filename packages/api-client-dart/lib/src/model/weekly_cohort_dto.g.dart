// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'weekly_cohort_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$WeeklyCohortDtoCWProxy {
  WeeklyCohortDto week(DateTime week);

  WeeklyCohortDto prospects(num prospects);

  WeeklyCohortDto methodObtained(num methodObtained);

  WeeklyCohortDto cases(num cases);

  WeeklyCohortDto cashed(num cashed);

  WeeklyCohortDto cashedAmountXof(String cashedAmountXof);

  WeeklyCohortDto conversionRate(num? conversionRate);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WeeklyCohortDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WeeklyCohortDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WeeklyCohortDto call({
    DateTime week,
    num prospects,
    num methodObtained,
    num cases,
    num cashed,
    String cashedAmountXof,
    num? conversionRate,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfWeeklyCohortDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfWeeklyCohortDto.copyWith.fieldName(...)`
class _$WeeklyCohortDtoCWProxyImpl implements _$WeeklyCohortDtoCWProxy {
  const _$WeeklyCohortDtoCWProxyImpl(this._value);

  final WeeklyCohortDto _value;

  @override
  WeeklyCohortDto week(DateTime week) => this(week: week);

  @override
  WeeklyCohortDto prospects(num prospects) => this(prospects: prospects);

  @override
  WeeklyCohortDto methodObtained(num methodObtained) =>
      this(methodObtained: methodObtained);

  @override
  WeeklyCohortDto cases(num cases) => this(cases: cases);

  @override
  WeeklyCohortDto cashed(num cashed) => this(cashed: cashed);

  @override
  WeeklyCohortDto cashedAmountXof(String cashedAmountXof) =>
      this(cashedAmountXof: cashedAmountXof);

  @override
  WeeklyCohortDto conversionRate(num? conversionRate) =>
      this(conversionRate: conversionRate);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WeeklyCohortDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WeeklyCohortDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WeeklyCohortDto call({
    Object? week = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? methodObtained = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? cashed = const $CopyWithPlaceholder(),
    Object? cashedAmountXof = const $CopyWithPlaceholder(),
    Object? conversionRate = const $CopyWithPlaceholder(),
  }) {
    return WeeklyCohortDto(
      week: week == const $CopyWithPlaceholder()
          ? _value.week
          // ignore: cast_nullable_to_non_nullable
          : week as DateTime,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      methodObtained: methodObtained == const $CopyWithPlaceholder()
          ? _value.methodObtained
          // ignore: cast_nullable_to_non_nullable
          : methodObtained as num,
      cases: cases == const $CopyWithPlaceholder()
          ? _value.cases
          // ignore: cast_nullable_to_non_nullable
          : cases as num,
      cashed: cashed == const $CopyWithPlaceholder()
          ? _value.cashed
          // ignore: cast_nullable_to_non_nullable
          : cashed as num,
      cashedAmountXof: cashedAmountXof == const $CopyWithPlaceholder()
          ? _value.cashedAmountXof
          // ignore: cast_nullable_to_non_nullable
          : cashedAmountXof as String,
      conversionRate: conversionRate == const $CopyWithPlaceholder()
          ? _value.conversionRate
          // ignore: cast_nullable_to_non_nullable
          : conversionRate as num?,
    );
  }
}

extension $WeeklyCohortDtoCopyWith on WeeklyCohortDto {
  /// Returns a callable class that can be used as follows: `instanceOfWeeklyCohortDto.copyWith(...)` or like so:`instanceOfWeeklyCohortDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$WeeklyCohortDtoCWProxy get copyWith => _$WeeklyCohortDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WeeklyCohortDto _$WeeklyCohortDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('WeeklyCohortDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'week',
          'prospects',
          'methodObtained',
          'cases',
          'cashed',
          'cashedAmountXof',
          'conversionRate',
        ],
      );
      final val = WeeklyCohortDto(
        week: $checkedConvert('week', (v) => DateTime.parse(v as String)),
        prospects: $checkedConvert('prospects', (v) => v as num),
        methodObtained: $checkedConvert('methodObtained', (v) => v as num),
        cases: $checkedConvert('cases', (v) => v as num),
        cashed: $checkedConvert('cashed', (v) => v as num),
        cashedAmountXof: $checkedConvert('cashedAmountXof', (v) => v as String),
        conversionRate: $checkedConvert('conversionRate', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$WeeklyCohortDtoToJson(WeeklyCohortDto instance) =>
    <String, dynamic>{
      'week': instance.week.toIso8601String(),
      'prospects': instance.prospects,
      'methodObtained': instance.methodObtained,
      'cases': instance.cases,
      'cashed': instance.cashed,
      'cashedAmountXof': instance.cashedAmountXof,
      'conversionRate': instance.conversionRate,
    };
