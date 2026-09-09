// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_bank_case_correction_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateBankCaseCorrectionDtoCWProxy {
  CreateBankCaseCorrectionDto targetStageId(String targetStageId);

  CreateBankCaseCorrectionDto expectedRev(num expectedRev);

  CreateBankCaseCorrectionDto amountXof(String? amountXof);

  CreateBankCaseCorrectionDto rejectionReasonId(String? rejectionReasonId);

  CreateBankCaseCorrectionDto rejectionDetail(String? rejectionDetail);

  CreateBankCaseCorrectionDto comment(String? comment);

  CreateBankCaseCorrectionDto reason(String reason);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseCorrectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseCorrectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseCorrectionDto call({
    String targetStageId,
    num expectedRev,
    String? amountXof,
    String? rejectionReasonId,
    String? rejectionDetail,
    String? comment,
    String reason,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateBankCaseCorrectionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateBankCaseCorrectionDto.copyWith.fieldName(...)`
class _$CreateBankCaseCorrectionDtoCWProxyImpl
    implements _$CreateBankCaseCorrectionDtoCWProxy {
  const _$CreateBankCaseCorrectionDtoCWProxyImpl(this._value);

  final CreateBankCaseCorrectionDto _value;

  @override
  CreateBankCaseCorrectionDto targetStageId(String targetStageId) =>
      this(targetStageId: targetStageId);

  @override
  CreateBankCaseCorrectionDto expectedRev(num expectedRev) =>
      this(expectedRev: expectedRev);

  @override
  CreateBankCaseCorrectionDto amountXof(String? amountXof) =>
      this(amountXof: amountXof);

  @override
  CreateBankCaseCorrectionDto rejectionReasonId(String? rejectionReasonId) =>
      this(rejectionReasonId: rejectionReasonId);

  @override
  CreateBankCaseCorrectionDto rejectionDetail(String? rejectionDetail) =>
      this(rejectionDetail: rejectionDetail);

  @override
  CreateBankCaseCorrectionDto comment(String? comment) =>
      this(comment: comment);

  @override
  CreateBankCaseCorrectionDto reason(String reason) => this(reason: reason);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseCorrectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseCorrectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseCorrectionDto call({
    Object? targetStageId = const $CopyWithPlaceholder(),
    Object? expectedRev = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
    Object? rejectionReasonId = const $CopyWithPlaceholder(),
    Object? rejectionDetail = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
  }) {
    return CreateBankCaseCorrectionDto(
      targetStageId: targetStageId == const $CopyWithPlaceholder()
          ? _value.targetStageId
          // ignore: cast_nullable_to_non_nullable
          : targetStageId as String,
      expectedRev: expectedRev == const $CopyWithPlaceholder()
          ? _value.expectedRev
          // ignore: cast_nullable_to_non_nullable
          : expectedRev as num,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as String?,
      rejectionReasonId: rejectionReasonId == const $CopyWithPlaceholder()
          ? _value.rejectionReasonId
          // ignore: cast_nullable_to_non_nullable
          : rejectionReasonId as String?,
      rejectionDetail: rejectionDetail == const $CopyWithPlaceholder()
          ? _value.rejectionDetail
          // ignore: cast_nullable_to_non_nullable
          : rejectionDetail as String?,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String,
    );
  }
}

extension $CreateBankCaseCorrectionDtoCopyWith on CreateBankCaseCorrectionDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateBankCaseCorrectionDto.copyWith(...)` or like so:`instanceOfCreateBankCaseCorrectionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateBankCaseCorrectionDtoCWProxy get copyWith =>
      _$CreateBankCaseCorrectionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBankCaseCorrectionDto _$CreateBankCaseCorrectionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateBankCaseCorrectionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['targetStageId', 'expectedRev', 'reason'],
  );
  final val = CreateBankCaseCorrectionDto(
    targetStageId: $checkedConvert('targetStageId', (v) => v as String),
    expectedRev: $checkedConvert('expectedRev', (v) => v as num),
    amountXof: $checkedConvert('amountXof', (v) => v as String?),
    rejectionReasonId: $checkedConvert(
      'rejectionReasonId',
      (v) => v as String?,
    ),
    rejectionDetail: $checkedConvert('rejectionDetail', (v) => v as String?),
    comment: $checkedConvert('comment', (v) => v as String?),
    reason: $checkedConvert('reason', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CreateBankCaseCorrectionDtoToJson(
  CreateBankCaseCorrectionDto instance,
) => <String, dynamic>{
  'targetStageId': instance.targetStageId,
  'expectedRev': instance.expectedRev,
  if (instance.amountXof case final value?) 'amountXof': value,
  if (instance.rejectionReasonId case final value?) 'rejectionReasonId': value,
  if (instance.rejectionDetail case final value?) 'rejectionDetail': value,
  if (instance.comment case final value?) 'comment': value,
  'reason': instance.reason,
};
