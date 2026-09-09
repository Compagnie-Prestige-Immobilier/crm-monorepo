// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'data_quality_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DataQualityDtoCWProxy {
  DataQualityDto representants(List<DataQualityRowDto> representants);

  DataQualityDto departements(List<DataQualityRowDto> departements);

  DataQualityDto attempts(num attempts);

  DataQualityDto badRate(num? badRate);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DataQualityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DataQualityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DataQualityDto call({
    List<DataQualityRowDto> representants,
    List<DataQualityRowDto> departements,
    num attempts,
    num? badRate,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDataQualityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDataQualityDto.copyWith.fieldName(...)`
class _$DataQualityDtoCWProxyImpl implements _$DataQualityDtoCWProxy {
  const _$DataQualityDtoCWProxyImpl(this._value);

  final DataQualityDto _value;

  @override
  DataQualityDto representants(List<DataQualityRowDto> representants) =>
      this(representants: representants);

  @override
  DataQualityDto departements(List<DataQualityRowDto> departements) =>
      this(departements: departements);

  @override
  DataQualityDto attempts(num attempts) => this(attempts: attempts);

  @override
  DataQualityDto badRate(num? badRate) => this(badRate: badRate);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DataQualityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DataQualityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DataQualityDto call({
    Object? representants = const $CopyWithPlaceholder(),
    Object? departements = const $CopyWithPlaceholder(),
    Object? attempts = const $CopyWithPlaceholder(),
    Object? badRate = const $CopyWithPlaceholder(),
  }) {
    return DataQualityDto(
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as List<DataQualityRowDto>,
      departements: departements == const $CopyWithPlaceholder()
          ? _value.departements
          // ignore: cast_nullable_to_non_nullable
          : departements as List<DataQualityRowDto>,
      attempts: attempts == const $CopyWithPlaceholder()
          ? _value.attempts
          // ignore: cast_nullable_to_non_nullable
          : attempts as num,
      badRate: badRate == const $CopyWithPlaceholder()
          ? _value.badRate
          // ignore: cast_nullable_to_non_nullable
          : badRate as num?,
    );
  }
}

extension $DataQualityDtoCopyWith on DataQualityDto {
  /// Returns a callable class that can be used as follows: `instanceOfDataQualityDto.copyWith(...)` or like so:`instanceOfDataQualityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DataQualityDtoCWProxy get copyWith => _$DataQualityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DataQualityDto _$DataQualityDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DataQualityDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'representants',
          'departements',
          'attempts',
          'badRate',
        ],
      );
      final val = DataQualityDto(
        representants: $checkedConvert(
          'representants',
          (v) => (v as List<dynamic>)
              .map((e) => DataQualityRowDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        departements: $checkedConvert(
          'departements',
          (v) => (v as List<dynamic>)
              .map((e) => DataQualityRowDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        attempts: $checkedConvert('attempts', (v) => v as num),
        badRate: $checkedConvert('badRate', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$DataQualityDtoToJson(DataQualityDto instance) =>
    <String, dynamic>{
      'representants': instance.representants.map((e) => e.toJson()).toList(),
      'departements': instance.departements.map((e) => e.toJson()).toList(),
      'attempts': instance.attempts,
      'badRate': instance.badRate,
    };
