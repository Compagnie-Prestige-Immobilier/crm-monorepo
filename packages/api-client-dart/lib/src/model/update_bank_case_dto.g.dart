// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_bank_case_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateBankCaseDtoCWProxy {
  UpdateBankCaseDto expectedRev(num expectedRev);

  UpdateBankCaseDto reference(String? reference);

  UpdateBankCaseDto processingBankId(String? processingBankId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBankCaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBankCaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBankCaseDto call({
    num expectedRev,
    String? reference,
    String? processingBankId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateBankCaseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateBankCaseDto.copyWith.fieldName(...)`
class _$UpdateBankCaseDtoCWProxyImpl implements _$UpdateBankCaseDtoCWProxy {
  const _$UpdateBankCaseDtoCWProxyImpl(this._value);

  final UpdateBankCaseDto _value;

  @override
  UpdateBankCaseDto expectedRev(num expectedRev) =>
      this(expectedRev: expectedRev);

  @override
  UpdateBankCaseDto reference(String? reference) => this(reference: reference);

  @override
  UpdateBankCaseDto processingBankId(String? processingBankId) =>
      this(processingBankId: processingBankId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBankCaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBankCaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBankCaseDto call({
    Object? expectedRev = const $CopyWithPlaceholder(),
    Object? reference = const $CopyWithPlaceholder(),
    Object? processingBankId = const $CopyWithPlaceholder(),
  }) {
    return UpdateBankCaseDto(
      expectedRev: expectedRev == const $CopyWithPlaceholder()
          ? _value.expectedRev
          // ignore: cast_nullable_to_non_nullable
          : expectedRev as num,
      reference: reference == const $CopyWithPlaceholder()
          ? _value.reference
          // ignore: cast_nullable_to_non_nullable
          : reference as String?,
      processingBankId: processingBankId == const $CopyWithPlaceholder()
          ? _value.processingBankId
          // ignore: cast_nullable_to_non_nullable
          : processingBankId as String?,
    );
  }
}

extension $UpdateBankCaseDtoCopyWith on UpdateBankCaseDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateBankCaseDto.copyWith(...)` or like so:`instanceOfUpdateBankCaseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateBankCaseDtoCWProxy get copyWith =>
      _$UpdateBankCaseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateBankCaseDto _$UpdateBankCaseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateBankCaseDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['expectedRev']);
      final val = UpdateBankCaseDto(
        expectedRev: $checkedConvert('expectedRev', (v) => v as num),
        reference: $checkedConvert('reference', (v) => v as String?),
        processingBankId: $checkedConvert(
          'processingBankId',
          (v) => v as String?,
        ),
      );
      return val;
    });

Map<String, dynamic> _$UpdateBankCaseDtoToJson(
  UpdateBankCaseDto instance,
) => <String, dynamic>{
  'expectedRev': instance.expectedRev,
  if (instance.reference case final value?) 'reference': value,
  if (instance.processingBankId case final value?) 'processingBankId': value,
};
