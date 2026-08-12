// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_rejection_breakdown_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankRejectionBreakdownDtoCWProxy {
  BankRejectionBreakdownDto reasonId(String reasonId);

  BankRejectionBreakdownDto code(String code);

  BankRejectionBreakdownDto label(String label);

  BankRejectionBreakdownDto cases(num cases);

  BankRejectionBreakdownDto share(num share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionBreakdownDto call({
    String reasonId,
    String code,
    String label,
    num cases,
    num share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankRejectionBreakdownDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankRejectionBreakdownDto.copyWith.fieldName(...)`
class _$BankRejectionBreakdownDtoCWProxyImpl
    implements _$BankRejectionBreakdownDtoCWProxy {
  const _$BankRejectionBreakdownDtoCWProxyImpl(this._value);

  final BankRejectionBreakdownDto _value;

  @override
  BankRejectionBreakdownDto reasonId(String reasonId) =>
      this(reasonId: reasonId);

  @override
  BankRejectionBreakdownDto code(String code) => this(code: code);

  @override
  BankRejectionBreakdownDto label(String label) => this(label: label);

  @override
  BankRejectionBreakdownDto cases(num cases) => this(cases: cases);

  @override
  BankRejectionBreakdownDto share(num share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionBreakdownDto call({
    Object? reasonId = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return BankRejectionBreakdownDto(
      reasonId: reasonId == const $CopyWithPlaceholder()
          ? _value.reasonId
          // ignore: cast_nullable_to_non_nullable
          : reasonId as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      cases: cases == const $CopyWithPlaceholder()
          ? _value.cases
          // ignore: cast_nullable_to_non_nullable
          : cases as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
    );
  }
}

extension $BankRejectionBreakdownDtoCopyWith on BankRejectionBreakdownDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankRejectionBreakdownDto.copyWith(...)` or like so:`instanceOfBankRejectionBreakdownDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankRejectionBreakdownDtoCWProxy get copyWith =>
      _$BankRejectionBreakdownDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankRejectionBreakdownDto _$BankRejectionBreakdownDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankRejectionBreakdownDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['reasonId', 'code', 'label', 'cases', 'share'],
  );
  final val = BankRejectionBreakdownDto(
    reasonId: $checkedConvert('reasonId', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    cases: $checkedConvert('cases', (v) => v as num),
    share: $checkedConvert('share', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$BankRejectionBreakdownDtoToJson(
  BankRejectionBreakdownDto instance,
) => <String, dynamic>{
  'reasonId': instance.reasonId,
  'code': instance.code,
  'label': instance.label,
  'cases': instance.cases,
  'share': instance.share,
};
