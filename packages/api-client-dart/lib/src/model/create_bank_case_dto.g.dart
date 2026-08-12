// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_bank_case_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateBankCaseDtoCWProxy {
  CreateBankCaseDto prospectId(String prospectId);

  CreateBankCaseDto reference(String reference);

  CreateBankCaseDto processingBankId(String? processingBankId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseDto call({
    String prospectId,
    String reference,
    String? processingBankId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateBankCaseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateBankCaseDto.copyWith.fieldName(...)`
class _$CreateBankCaseDtoCWProxyImpl implements _$CreateBankCaseDtoCWProxy {
  const _$CreateBankCaseDtoCWProxyImpl(this._value);

  final CreateBankCaseDto _value;

  @override
  CreateBankCaseDto prospectId(String prospectId) =>
      this(prospectId: prospectId);

  @override
  CreateBankCaseDto reference(String reference) => this(reference: reference);

  @override
  CreateBankCaseDto processingBankId(String? processingBankId) =>
      this(processingBankId: processingBankId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseDto call({
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? reference = const $CopyWithPlaceholder(),
    Object? processingBankId = const $CopyWithPlaceholder(),
  }) {
    return CreateBankCaseDto(
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
      reference: reference == const $CopyWithPlaceholder()
          ? _value.reference
          // ignore: cast_nullable_to_non_nullable
          : reference as String,
      processingBankId: processingBankId == const $CopyWithPlaceholder()
          ? _value.processingBankId
          // ignore: cast_nullable_to_non_nullable
          : processingBankId as String?,
    );
  }
}

extension $CreateBankCaseDtoCopyWith on CreateBankCaseDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateBankCaseDto.copyWith(...)` or like so:`instanceOfCreateBankCaseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateBankCaseDtoCWProxy get copyWith =>
      _$CreateBankCaseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBankCaseDto _$CreateBankCaseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateBankCaseDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['prospectId', 'reference']);
      final val = CreateBankCaseDto(
        prospectId: $checkedConvert('prospectId', (v) => v as String),
        reference: $checkedConvert('reference', (v) => v as String),
        processingBankId: $checkedConvert(
          'processingBankId',
          (v) => v as String?,
        ),
      );
      return val;
    });

Map<String, dynamic> _$CreateBankCaseDtoToJson(
  CreateBankCaseDto instance,
) => <String, dynamic>{
  'prospectId': instance.prospectId,
  'reference': instance.reference,
  if (instance.processingBankId case final value?) 'processingBankId': value,
};
