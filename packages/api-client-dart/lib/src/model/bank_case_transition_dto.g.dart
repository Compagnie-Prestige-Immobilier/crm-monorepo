// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_transition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseTransitionDtoCWProxy {
  BankCaseTransitionDto id(String id);

  BankCaseTransitionDto caseId(String caseId);

  BankCaseTransitionDto fromStage(BankCaseStageDto? fromStage);

  BankCaseTransitionDto toStage(BankCaseStageDto toStage);

  BankCaseTransitionDto performedById(String performedById);

  BankCaseTransitionDto performedByName(String performedByName);

  BankCaseTransitionDto amountXof(String? amountXof);

  BankCaseTransitionDto rejectionReason(
    BankRejectionReasonDto? rejectionReason,
  );

  BankCaseTransitionDto rejectionDetail(String? rejectionDetail);

  BankCaseTransitionDto comment(String? comment);

  BankCaseTransitionDto correctionReason(String? correctionReason);

  BankCaseTransitionDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseTransitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseTransitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseTransitionDto call({
    String id,
    String caseId,
    BankCaseStageDto? fromStage,
    BankCaseStageDto toStage,
    String performedById,
    String performedByName,
    String? amountXof,
    BankRejectionReasonDto? rejectionReason,
    String? rejectionDetail,
    String? comment,
    String? correctionReason,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseTransitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseTransitionDto.copyWith.fieldName(...)`
class _$BankCaseTransitionDtoCWProxyImpl
    implements _$BankCaseTransitionDtoCWProxy {
  const _$BankCaseTransitionDtoCWProxyImpl(this._value);

  final BankCaseTransitionDto _value;

  @override
  BankCaseTransitionDto id(String id) => this(id: id);

  @override
  BankCaseTransitionDto caseId(String caseId) => this(caseId: caseId);

  @override
  BankCaseTransitionDto fromStage(BankCaseStageDto? fromStage) =>
      this(fromStage: fromStage);

  @override
  BankCaseTransitionDto toStage(BankCaseStageDto toStage) =>
      this(toStage: toStage);

  @override
  BankCaseTransitionDto performedById(String performedById) =>
      this(performedById: performedById);

  @override
  BankCaseTransitionDto performedByName(String performedByName) =>
      this(performedByName: performedByName);

  @override
  BankCaseTransitionDto amountXof(String? amountXof) =>
      this(amountXof: amountXof);

  @override
  BankCaseTransitionDto rejectionReason(
    BankRejectionReasonDto? rejectionReason,
  ) => this(rejectionReason: rejectionReason);

  @override
  BankCaseTransitionDto rejectionDetail(String? rejectionDetail) =>
      this(rejectionDetail: rejectionDetail);

  @override
  BankCaseTransitionDto comment(String? comment) => this(comment: comment);

  @override
  BankCaseTransitionDto correctionReason(String? correctionReason) =>
      this(correctionReason: correctionReason);

  @override
  BankCaseTransitionDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseTransitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseTransitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseTransitionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? caseId = const $CopyWithPlaceholder(),
    Object? fromStage = const $CopyWithPlaceholder(),
    Object? toStage = const $CopyWithPlaceholder(),
    Object? performedById = const $CopyWithPlaceholder(),
    Object? performedByName = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
    Object? rejectionReason = const $CopyWithPlaceholder(),
    Object? rejectionDetail = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? correctionReason = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return BankCaseTransitionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      caseId: caseId == const $CopyWithPlaceholder()
          ? _value.caseId
          // ignore: cast_nullable_to_non_nullable
          : caseId as String,
      fromStage: fromStage == const $CopyWithPlaceholder()
          ? _value.fromStage
          // ignore: cast_nullable_to_non_nullable
          : fromStage as BankCaseStageDto?,
      toStage: toStage == const $CopyWithPlaceholder()
          ? _value.toStage
          // ignore: cast_nullable_to_non_nullable
          : toStage as BankCaseStageDto,
      performedById: performedById == const $CopyWithPlaceholder()
          ? _value.performedById
          // ignore: cast_nullable_to_non_nullable
          : performedById as String,
      performedByName: performedByName == const $CopyWithPlaceholder()
          ? _value.performedByName
          // ignore: cast_nullable_to_non_nullable
          : performedByName as String,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as String?,
      rejectionReason: rejectionReason == const $CopyWithPlaceholder()
          ? _value.rejectionReason
          // ignore: cast_nullable_to_non_nullable
          : rejectionReason as BankRejectionReasonDto?,
      rejectionDetail: rejectionDetail == const $CopyWithPlaceholder()
          ? _value.rejectionDetail
          // ignore: cast_nullable_to_non_nullable
          : rejectionDetail as String?,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
      correctionReason: correctionReason == const $CopyWithPlaceholder()
          ? _value.correctionReason
          // ignore: cast_nullable_to_non_nullable
          : correctionReason as String?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $BankCaseTransitionDtoCopyWith on BankCaseTransitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseTransitionDto.copyWith(...)` or like so:`instanceOfBankCaseTransitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseTransitionDtoCWProxy get copyWith =>
      _$BankCaseTransitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseTransitionDto _$BankCaseTransitionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankCaseTransitionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'caseId',
      'fromStage',
      'toStage',
      'performedById',
      'performedByName',
      'amountXof',
      'rejectionReason',
      'rejectionDetail',
      'comment',
      'correctionReason',
      'createdAt',
    ],
  );
  final val = BankCaseTransitionDto(
    id: $checkedConvert('id', (v) => v as String),
    caseId: $checkedConvert('caseId', (v) => v as String),
    fromStage: $checkedConvert(
      'fromStage',
      (v) => v == null
          ? null
          : BankCaseStageDto.fromJson(v as Map<String, dynamic>),
    ),
    toStage: $checkedConvert(
      'toStage',
      (v) => BankCaseStageDto.fromJson(v as Map<String, dynamic>),
    ),
    performedById: $checkedConvert('performedById', (v) => v as String),
    performedByName: $checkedConvert('performedByName', (v) => v as String),
    amountXof: $checkedConvert('amountXof', (v) => v as String?),
    rejectionReason: $checkedConvert(
      'rejectionReason',
      (v) => v == null
          ? null
          : BankRejectionReasonDto.fromJson(v as Map<String, dynamic>),
    ),
    rejectionDetail: $checkedConvert('rejectionDetail', (v) => v as String?),
    comment: $checkedConvert('comment', (v) => v as String?),
    correctionReason: $checkedConvert('correctionReason', (v) => v as String?),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$BankCaseTransitionDtoToJson(
  BankCaseTransitionDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'caseId': instance.caseId,
  'fromStage': instance.fromStage?.toJson(),
  'toStage': instance.toStage.toJson(),
  'performedById': instance.performedById,
  'performedByName': instance.performedByName,
  'amountXof': instance.amountXof,
  'rejectionReason': instance.rejectionReason?.toJson(),
  'rejectionDetail': instance.rejectionDetail,
  'comment': instance.comment,
  'correctionReason': instance.correctionReason,
  'createdAt': instance.createdAt.toIso8601String(),
};
