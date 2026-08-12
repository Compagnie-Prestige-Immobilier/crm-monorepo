// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_representant_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopRepresentantDtoCWProxy {
  TopRepresentantDto id(String id);

  TopRepresentantDto label(String label);

  TopRepresentantDto phoneE164(String phoneE164);

  TopRepresentantDto departementName(String departementName);

  TopRepresentantDto commercialName(String commercialName);

  TopRepresentantDto prospects(num prospects);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopRepresentantDto call({
    String id,
    String label,
    String phoneE164,
    String departementName,
    String commercialName,
    num prospects,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTopRepresentantDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTopRepresentantDto.copyWith.fieldName(...)`
class _$TopRepresentantDtoCWProxyImpl implements _$TopRepresentantDtoCWProxy {
  const _$TopRepresentantDtoCWProxyImpl(this._value);

  final TopRepresentantDto _value;

  @override
  TopRepresentantDto id(String id) => this(id: id);

  @override
  TopRepresentantDto label(String label) => this(label: label);

  @override
  TopRepresentantDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  TopRepresentantDto departementName(String departementName) =>
      this(departementName: departementName);

  @override
  TopRepresentantDto commercialName(String commercialName) =>
      this(commercialName: commercialName);

  @override
  TopRepresentantDto prospects(num prospects) => this(prospects: prospects);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopRepresentantDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? departementName = const $CopyWithPlaceholder(),
    Object? commercialName = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
  }) {
    return TopRepresentantDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String,
      commercialName: commercialName == const $CopyWithPlaceholder()
          ? _value.commercialName
          // ignore: cast_nullable_to_non_nullable
          : commercialName as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
    );
  }
}

extension $TopRepresentantDtoCopyWith on TopRepresentantDto {
  /// Returns a callable class that can be used as follows: `instanceOfTopRepresentantDto.copyWith(...)` or like so:`instanceOfTopRepresentantDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopRepresentantDtoCWProxy get copyWith =>
      _$TopRepresentantDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopRepresentantDto _$TopRepresentantDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TopRepresentantDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'label',
          'phoneE164',
          'departementName',
          'commercialName',
          'prospects',
        ],
      );
      final val = TopRepresentantDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        departementName: $checkedConvert('departementName', (v) => v as String),
        commercialName: $checkedConvert('commercialName', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$TopRepresentantDtoToJson(TopRepresentantDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'phoneE164': instance.phoneE164,
      'departementName': instance.departementName,
      'commercialName': instance.commercialName,
      'prospects': instance.prospects,
    };
