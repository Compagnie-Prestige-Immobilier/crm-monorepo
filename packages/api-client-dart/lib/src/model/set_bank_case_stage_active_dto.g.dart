// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_bank_case_stage_active_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetBankCaseStageActiveDtoCWProxy {
  SetBankCaseStageActiveDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetBankCaseStageActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetBankCaseStageActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetBankCaseStageActiveDto call({bool isActive});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetBankCaseStageActiveDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetBankCaseStageActiveDto.copyWith.fieldName(...)`
class _$SetBankCaseStageActiveDtoCWProxyImpl
    implements _$SetBankCaseStageActiveDtoCWProxy {
  const _$SetBankCaseStageActiveDtoCWProxyImpl(this._value);

  final SetBankCaseStageActiveDto _value;

  @override
  SetBankCaseStageActiveDto isActive(bool isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetBankCaseStageActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetBankCaseStageActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetBankCaseStageActiveDto call({
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return SetBankCaseStageActiveDto(
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $SetBankCaseStageActiveDtoCopyWith on SetBankCaseStageActiveDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetBankCaseStageActiveDto.copyWith(...)` or like so:`instanceOfSetBankCaseStageActiveDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetBankCaseStageActiveDtoCWProxy get copyWith =>
      _$SetBankCaseStageActiveDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetBankCaseStageActiveDto _$SetBankCaseStageActiveDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SetBankCaseStageActiveDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['isActive']);
  final val = SetBankCaseStageActiveDto(
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SetBankCaseStageActiveDtoToJson(
  SetBankCaseStageActiveDto instance,
) => <String, dynamic>{'isActive': instance.isActive};
