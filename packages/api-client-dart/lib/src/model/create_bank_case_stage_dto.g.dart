// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_bank_case_stage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateBankCaseStageDtoCWProxy {
  CreateBankCaseStageDto code(String code);

  CreateBankCaseStageDto label(String label);

  CreateBankCaseStageDto color(String color);

  CreateBankCaseStageDto position(num? position);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseStageDto call({
    String code,
    String label,
    String color,
    num? position,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateBankCaseStageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateBankCaseStageDto.copyWith.fieldName(...)`
class _$CreateBankCaseStageDtoCWProxyImpl
    implements _$CreateBankCaseStageDtoCWProxy {
  const _$CreateBankCaseStageDtoCWProxyImpl(this._value);

  final CreateBankCaseStageDto _value;

  @override
  CreateBankCaseStageDto code(String code) => this(code: code);

  @override
  CreateBankCaseStageDto label(String label) => this(label: label);

  @override
  CreateBankCaseStageDto color(String color) => this(color: color);

  @override
  CreateBankCaseStageDto position(num? position) => this(position: position);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseStageDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
  }) {
    return CreateBankCaseStageDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num?,
    );
  }
}

extension $CreateBankCaseStageDtoCopyWith on CreateBankCaseStageDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateBankCaseStageDto.copyWith(...)` or like so:`instanceOfCreateBankCaseStageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateBankCaseStageDtoCWProxy get copyWith =>
      _$CreateBankCaseStageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBankCaseStageDto _$CreateBankCaseStageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateBankCaseStageDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code', 'label', 'color']);
  final val = CreateBankCaseStageDto(
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    color: $checkedConvert('color', (v) => v as String),
    position: $checkedConvert('position', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$CreateBankCaseStageDtoToJson(
  CreateBankCaseStageDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  'color': instance.color,
  if (instance.position case final value?) 'position': value,
};
