// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_bank_breakdown_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankBankBreakdownDtoCWProxy {
  BankBankBreakdownDto banqueId(String banqueId);

  BankBankBreakdownDto label(String label);

  BankBankBreakdownDto cases(num cases);

  BankBankBreakdownDto cashed(num cashed);

  BankBankBreakdownDto rejected(num rejected);

  BankBankBreakdownDto amountXof(String amountXof);

  BankBankBreakdownDto share(num share);

  BankBankBreakdownDto meanProcessingHours(num? meanProcessingHours);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankBankBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankBankBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankBankBreakdownDto call({
    String banqueId,
    String label,
    num cases,
    num cashed,
    num rejected,
    String amountXof,
    num share,
    num? meanProcessingHours,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankBankBreakdownDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankBankBreakdownDto.copyWith.fieldName(...)`
class _$BankBankBreakdownDtoCWProxyImpl
    implements _$BankBankBreakdownDtoCWProxy {
  const _$BankBankBreakdownDtoCWProxyImpl(this._value);

  final BankBankBreakdownDto _value;

  @override
  BankBankBreakdownDto banqueId(String banqueId) => this(banqueId: banqueId);

  @override
  BankBankBreakdownDto label(String label) => this(label: label);

  @override
  BankBankBreakdownDto cases(num cases) => this(cases: cases);

  @override
  BankBankBreakdownDto cashed(num cashed) => this(cashed: cashed);

  @override
  BankBankBreakdownDto rejected(num rejected) => this(rejected: rejected);

  @override
  BankBankBreakdownDto amountXof(String amountXof) =>
      this(amountXof: amountXof);

  @override
  BankBankBreakdownDto share(num share) => this(share: share);

  @override
  BankBankBreakdownDto meanProcessingHours(num? meanProcessingHours) =>
      this(meanProcessingHours: meanProcessingHours);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankBankBreakdownDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankBankBreakdownDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankBankBreakdownDto call({
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? cashed = const $CopyWithPlaceholder(),
    Object? rejected = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
    Object? meanProcessingHours = const $CopyWithPlaceholder(),
  }) {
    return BankBankBreakdownDto(
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      cases: cases == const $CopyWithPlaceholder()
          ? _value.cases
          // ignore: cast_nullable_to_non_nullable
          : cases as num,
      cashed: cashed == const $CopyWithPlaceholder()
          ? _value.cashed
          // ignore: cast_nullable_to_non_nullable
          : cashed as num,
      rejected: rejected == const $CopyWithPlaceholder()
          ? _value.rejected
          // ignore: cast_nullable_to_non_nullable
          : rejected as num,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as String,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
      meanProcessingHours: meanProcessingHours == const $CopyWithPlaceholder()
          ? _value.meanProcessingHours
          // ignore: cast_nullable_to_non_nullable
          : meanProcessingHours as num?,
    );
  }
}

extension $BankBankBreakdownDtoCopyWith on BankBankBreakdownDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankBankBreakdownDto.copyWith(...)` or like so:`instanceOfBankBankBreakdownDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankBankBreakdownDtoCWProxy get copyWith =>
      _$BankBankBreakdownDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankBankBreakdownDto _$BankBankBreakdownDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankBankBreakdownDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'banqueId',
      'label',
      'cases',
      'cashed',
      'rejected',
      'amountXof',
      'share',
      'meanProcessingHours',
    ],
  );
  final val = BankBankBreakdownDto(
    banqueId: $checkedConvert('banqueId', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    cases: $checkedConvert('cases', (v) => v as num),
    cashed: $checkedConvert('cashed', (v) => v as num),
    rejected: $checkedConvert('rejected', (v) => v as num),
    amountXof: $checkedConvert('amountXof', (v) => v as String),
    share: $checkedConvert('share', (v) => v as num),
    meanProcessingHours: $checkedConvert(
      'meanProcessingHours',
      (v) => v as num?,
    ),
  );
  return val;
});

Map<String, dynamic> _$BankBankBreakdownDtoToJson(
  BankBankBreakdownDto instance,
) => <String, dynamic>{
  'banqueId': instance.banqueId,
  'label': instance.label,
  'cases': instance.cases,
  'cashed': instance.cashed,
  'rejected': instance.rejected,
  'amountXof': instance.amountXof,
  'share': instance.share,
  'meanProcessingHours': instance.meanProcessingHours,
};
