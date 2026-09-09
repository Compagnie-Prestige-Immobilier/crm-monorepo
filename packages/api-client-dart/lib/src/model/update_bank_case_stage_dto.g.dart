// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_bank_case_stage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateBankCaseStageDtoCWProxy {
  UpdateBankCaseStageDto label(String? label);

  UpdateBankCaseStageDto color(String? color);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBankCaseStageDto call({String? label, String? color});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateBankCaseStageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateBankCaseStageDto.copyWith.fieldName(...)`
class _$UpdateBankCaseStageDtoCWProxyImpl
    implements _$UpdateBankCaseStageDtoCWProxy {
  const _$UpdateBankCaseStageDtoCWProxyImpl(this._value);

  final UpdateBankCaseStageDto _value;

  @override
  UpdateBankCaseStageDto label(String? label) => this(label: label);

  @override
  UpdateBankCaseStageDto color(String? color) => this(color: color);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBankCaseStageDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
  }) {
    return UpdateBankCaseStageDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String?,
    );
  }
}

extension $UpdateBankCaseStageDtoCopyWith on UpdateBankCaseStageDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateBankCaseStageDto.copyWith(...)` or like so:`instanceOfUpdateBankCaseStageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateBankCaseStageDtoCWProxy get copyWith =>
      _$UpdateBankCaseStageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateBankCaseStageDto _$UpdateBankCaseStageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateBankCaseStageDto', json, ($checkedConvert) {
  final val = UpdateBankCaseStageDto(
    label: $checkedConvert('label', (v) => v as String?),
    color: $checkedConvert('color', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$UpdateBankCaseStageDtoToJson(
  UpdateBankCaseStageDto instance,
) => <String, dynamic>{
  if (instance.label case final value?) 'label': value,
  if (instance.color case final value?) 'color': value,
};
