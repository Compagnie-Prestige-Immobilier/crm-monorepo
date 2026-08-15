// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'data_quality_row_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DataQualityRowDtoCWProxy {
  DataQualityRowDto id(String id);

  DataQualityRowDto label(String label);

  DataQualityRowDto attempts(num attempts);

  DataQualityRowDto unreachable(num unreachable);

  DataQualityRowDto wrongNumber(num wrongNumber);

  DataQualityRowDto badRate(num? badRate);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DataQualityRowDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DataQualityRowDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DataQualityRowDto call({
    String id,
    String label,
    num attempts,
    num unreachable,
    num wrongNumber,
    num? badRate,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDataQualityRowDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDataQualityRowDto.copyWith.fieldName(...)`
class _$DataQualityRowDtoCWProxyImpl implements _$DataQualityRowDtoCWProxy {
  const _$DataQualityRowDtoCWProxyImpl(this._value);

  final DataQualityRowDto _value;

  @override
  DataQualityRowDto id(String id) => this(id: id);

  @override
  DataQualityRowDto label(String label) => this(label: label);

  @override
  DataQualityRowDto attempts(num attempts) => this(attempts: attempts);

  @override
  DataQualityRowDto unreachable(num unreachable) =>
      this(unreachable: unreachable);

  @override
  DataQualityRowDto wrongNumber(num wrongNumber) =>
      this(wrongNumber: wrongNumber);

  @override
  DataQualityRowDto badRate(num? badRate) => this(badRate: badRate);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DataQualityRowDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DataQualityRowDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DataQualityRowDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? attempts = const $CopyWithPlaceholder(),
    Object? unreachable = const $CopyWithPlaceholder(),
    Object? wrongNumber = const $CopyWithPlaceholder(),
    Object? badRate = const $CopyWithPlaceholder(),
  }) {
    return DataQualityRowDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      attempts: attempts == const $CopyWithPlaceholder()
          ? _value.attempts
          // ignore: cast_nullable_to_non_nullable
          : attempts as num,
      unreachable: unreachable == const $CopyWithPlaceholder()
          ? _value.unreachable
          // ignore: cast_nullable_to_non_nullable
          : unreachable as num,
      wrongNumber: wrongNumber == const $CopyWithPlaceholder()
          ? _value.wrongNumber
          // ignore: cast_nullable_to_non_nullable
          : wrongNumber as num,
      badRate: badRate == const $CopyWithPlaceholder()
          ? _value.badRate
          // ignore: cast_nullable_to_non_nullable
          : badRate as num?,
    );
  }
}

extension $DataQualityRowDtoCopyWith on DataQualityRowDto {
  /// Returns a callable class that can be used as follows: `instanceOfDataQualityRowDto.copyWith(...)` or like so:`instanceOfDataQualityRowDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DataQualityRowDtoCWProxy get copyWith =>
      _$DataQualityRowDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DataQualityRowDto _$DataQualityRowDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DataQualityRowDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'label',
          'attempts',
          'unreachable',
          'wrongNumber',
          'badRate',
        ],
      );
      final val = DataQualityRowDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        attempts: $checkedConvert('attempts', (v) => v as num),
        unreachable: $checkedConvert('unreachable', (v) => v as num),
        wrongNumber: $checkedConvert('wrongNumber', (v) => v as num),
        badRate: $checkedConvert('badRate', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$DataQualityRowDtoToJson(DataQualityRowDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'attempts': instance.attempts,
      'unreachable': instance.unreachable,
      'wrongNumber': instance.wrongNumber,
      'badRate': instance.badRate,
    };
