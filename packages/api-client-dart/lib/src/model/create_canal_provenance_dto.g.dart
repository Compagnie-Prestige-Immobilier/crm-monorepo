// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_canal_provenance_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateCanalProvenanceDtoCWProxy {
  CreateCanalProvenanceDto code(String code);

  CreateCanalProvenanceDto label(String label);

  CreateCanalProvenanceDto position(num? position);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCanalProvenanceDto call({String code, String label, num? position});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateCanalProvenanceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateCanalProvenanceDto.copyWith.fieldName(...)`
class _$CreateCanalProvenanceDtoCWProxyImpl
    implements _$CreateCanalProvenanceDtoCWProxy {
  const _$CreateCanalProvenanceDtoCWProxyImpl(this._value);

  final CreateCanalProvenanceDto _value;

  @override
  CreateCanalProvenanceDto code(String code) => this(code: code);

  @override
  CreateCanalProvenanceDto label(String label) => this(label: label);

  @override
  CreateCanalProvenanceDto position(num? position) => this(position: position);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCanalProvenanceDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
  }) {
    return CreateCanalProvenanceDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num?,
    );
  }
}

extension $CreateCanalProvenanceDtoCopyWith on CreateCanalProvenanceDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateCanalProvenanceDto.copyWith(...)` or like so:`instanceOfCreateCanalProvenanceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateCanalProvenanceDtoCWProxy get copyWith =>
      _$CreateCanalProvenanceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateCanalProvenanceDto _$CreateCanalProvenanceDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateCanalProvenanceDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code', 'label']);
  final val = CreateCanalProvenanceDto(
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    position: $checkedConvert('position', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$CreateCanalProvenanceDtoToJson(
  CreateCanalProvenanceDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  if (instance.position case final value?) 'position': value,
};
