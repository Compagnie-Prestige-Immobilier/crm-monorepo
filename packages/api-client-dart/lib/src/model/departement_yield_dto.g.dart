// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'departement_yield_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DepartementYieldDtoCWProxy {
  DepartementYieldDto id(String id);

  DepartementYieldDto label(String label);

  DepartementYieldDto prospects(num prospects);

  DepartementYieldDto methodObtained(num methodObtained);

  DepartementYieldDto cases(num cases);

  DepartementYieldDto cashed(num cashed);

  DepartementYieldDto cashedAmountXof(String cashedAmountXof);

  DepartementYieldDto methodRate(num? methodRate);

  DepartementYieldDto conversionRate(num? conversionRate);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementYieldDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementYieldDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementYieldDto call({
    String id,
    String label,
    num prospects,
    num methodObtained,
    num cases,
    num cashed,
    String cashedAmountXof,
    num? methodRate,
    num? conversionRate,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDepartementYieldDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDepartementYieldDto.copyWith.fieldName(...)`
class _$DepartementYieldDtoCWProxyImpl implements _$DepartementYieldDtoCWProxy {
  const _$DepartementYieldDtoCWProxyImpl(this._value);

  final DepartementYieldDto _value;

  @override
  DepartementYieldDto id(String id) => this(id: id);

  @override
  DepartementYieldDto label(String label) => this(label: label);

  @override
  DepartementYieldDto prospects(num prospects) => this(prospects: prospects);

  @override
  DepartementYieldDto methodObtained(num methodObtained) =>
      this(methodObtained: methodObtained);

  @override
  DepartementYieldDto cases(num cases) => this(cases: cases);

  @override
  DepartementYieldDto cashed(num cashed) => this(cashed: cashed);

  @override
  DepartementYieldDto cashedAmountXof(String cashedAmountXof) =>
      this(cashedAmountXof: cashedAmountXof);

  @override
  DepartementYieldDto methodRate(num? methodRate) =>
      this(methodRate: methodRate);

  @override
  DepartementYieldDto conversionRate(num? conversionRate) =>
      this(conversionRate: conversionRate);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DepartementYieldDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DepartementYieldDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DepartementYieldDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? methodObtained = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? cashed = const $CopyWithPlaceholder(),
    Object? cashedAmountXof = const $CopyWithPlaceholder(),
    Object? methodRate = const $CopyWithPlaceholder(),
    Object? conversionRate = const $CopyWithPlaceholder(),
  }) {
    return DepartementYieldDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
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
      methodRate: methodRate == const $CopyWithPlaceholder()
          ? _value.methodRate
          // ignore: cast_nullable_to_non_nullable
          : methodRate as num?,
      conversionRate: conversionRate == const $CopyWithPlaceholder()
          ? _value.conversionRate
          // ignore: cast_nullable_to_non_nullable
          : conversionRate as num?,
    );
  }
}

extension $DepartementYieldDtoCopyWith on DepartementYieldDto {
  /// Returns a callable class that can be used as follows: `instanceOfDepartementYieldDto.copyWith(...)` or like so:`instanceOfDepartementYieldDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DepartementYieldDtoCWProxy get copyWith =>
      _$DepartementYieldDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepartementYieldDto _$DepartementYieldDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DepartementYieldDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'label',
          'prospects',
          'methodObtained',
          'cases',
          'cashed',
          'cashedAmountXof',
          'methodRate',
          'conversionRate',
        ],
      );
      final val = DepartementYieldDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        methodObtained: $checkedConvert('methodObtained', (v) => v as num),
        cases: $checkedConvert('cases', (v) => v as num),
        cashed: $checkedConvert('cashed', (v) => v as num),
        cashedAmountXof: $checkedConvert('cashedAmountXof', (v) => v as String),
        methodRate: $checkedConvert('methodRate', (v) => v as num?),
        conversionRate: $checkedConvert('conversionRate', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$DepartementYieldDtoToJson(
  DepartementYieldDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'label': instance.label,
  'prospects': instance.prospects,
  'methodObtained': instance.methodObtained,
  'cases': instance.cases,
  'cashed': instance.cashed,
  'cashedAmountXof': instance.cashedAmountXof,
  'methodRate': instance.methodRate,
  'conversionRate': instance.conversionRate,
};
