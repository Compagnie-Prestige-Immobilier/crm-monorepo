// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_bank_case_transition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateBankCaseTransitionDtoCWProxy {
  CreateBankCaseTransitionDto targetStageId(String targetStageId);

  CreateBankCaseTransitionDto expectedRev(num expectedRev);

  CreateBankCaseTransitionDto amountXof(String? amountXof);

  CreateBankCaseTransitionDto rejectionReasonId(String? rejectionReasonId);

  CreateBankCaseTransitionDto rejectionDetail(String? rejectionDetail);

  CreateBankCaseTransitionDto comment(String? comment);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseTransitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseTransitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseTransitionDto call({
    String targetStageId,
    num expectedRev,
    String? amountXof,
    String? rejectionReasonId,
    String? rejectionDetail,
    String? comment,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateBankCaseTransitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateBankCaseTransitionDto.copyWith.fieldName(...)`
class _$CreateBankCaseTransitionDtoCWProxyImpl
    implements _$CreateBankCaseTransitionDtoCWProxy {
  const _$CreateBankCaseTransitionDtoCWProxyImpl(this._value);

  final CreateBankCaseTransitionDto _value;

  @override
  CreateBankCaseTransitionDto targetStageId(String targetStageId) =>
      this(targetStageId: targetStageId);

  @override
  CreateBankCaseTransitionDto expectedRev(num expectedRev) =>
      this(expectedRev: expectedRev);

  @override
  CreateBankCaseTransitionDto amountXof(String? amountXof) =>
      this(amountXof: amountXof);

  @override
  CreateBankCaseTransitionDto rejectionReasonId(String? rejectionReasonId) =>
      this(rejectionReasonId: rejectionReasonId);

  @override
  CreateBankCaseTransitionDto rejectionDetail(String? rejectionDetail) =>
      this(rejectionDetail: rejectionDetail);

  @override
  CreateBankCaseTransitionDto comment(String? comment) =>
      this(comment: comment);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBankCaseTransitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBankCaseTransitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBankCaseTransitionDto call({
    Object? targetStageId = const $CopyWithPlaceholder(),
    Object? expectedRev = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
    Object? rejectionReasonId = const $CopyWithPlaceholder(),
    Object? rejectionDetail = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
  }) {
    return CreateBankCaseTransitionDto(
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
    );
  }
}

extension $CreateBankCaseTransitionDtoCopyWith on CreateBankCaseTransitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateBankCaseTransitionDto.copyWith(...)` or like so:`instanceOfCreateBankCaseTransitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateBankCaseTransitionDtoCWProxy get copyWith =>
      _$CreateBankCaseTransitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBankCaseTransitionDto _$CreateBankCaseTransitionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateBankCaseTransitionDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['targetStageId', 'expectedRev']);
  final val = CreateBankCaseTransitionDto(
    targetStageId: $checkedConvert('targetStageId', (v) => v as String),
    expectedRev: $checkedConvert('expectedRev', (v) => v as num),
    amountXof: $checkedConvert('amountXof', (v) => v as String?),
    rejectionReasonId: $checkedConvert(
      'rejectionReasonId',
      (v) => v as String?,
    ),
    rejectionDetail: $checkedConvert('rejectionDetail', (v) => v as String?),
    comment: $checkedConvert('comment', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$CreateBankCaseTransitionDtoToJson(
  CreateBankCaseTransitionDto instance,
) => <String, dynamic>{
  'targetStageId': instance.targetStageId,
  'expectedRev': instance.expectedRev,
  if (instance.amountXof case final value?) 'amountXof': value,
  if (instance.rejectionReasonId case final value?) 'rejectionReasonId': value,
  if (instance.rejectionDetail case final value?) 'rejectionDetail': value,
  if (instance.comment case final value?) 'comment': value,
};
