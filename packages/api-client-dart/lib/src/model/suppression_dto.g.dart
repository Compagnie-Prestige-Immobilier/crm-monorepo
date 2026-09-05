// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'suppression_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SuppressionDtoCWProxy {
  SuppressionDto supprimees(num supprimees);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuppressionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuppressionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuppressionDto call({num supprimees});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSuppressionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSuppressionDto.copyWith.fieldName(...)`
class _$SuppressionDtoCWProxyImpl implements _$SuppressionDtoCWProxy {
  const _$SuppressionDtoCWProxyImpl(this._value);

  final SuppressionDto _value;

  @override
  SuppressionDto supprimees(num supprimees) => this(supprimees: supprimees);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuppressionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuppressionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuppressionDto call({Object? supprimees = const $CopyWithPlaceholder()}) {
    return SuppressionDto(
      supprimees: supprimees == const $CopyWithPlaceholder()
          ? _value.supprimees
          // ignore: cast_nullable_to_non_nullable
          : supprimees as num,
    );
  }
}

extension $SuppressionDtoCopyWith on SuppressionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSuppressionDto.copyWith(...)` or like so:`instanceOfSuppressionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SuppressionDtoCWProxy get copyWith => _$SuppressionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SuppressionDto _$SuppressionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SuppressionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['supprimees']);
      final val = SuppressionDto(
        supprimees: $checkedConvert('supprimees', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$SuppressionDtoToJson(SuppressionDto instance) =>
    <String, dynamic>{'supprimees': instance.supprimees};
