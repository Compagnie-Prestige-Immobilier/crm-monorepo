// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_time_bucket_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankTimeBucketDtoCWProxy {
  BankTimeBucketDto bucket(DateTime bucket);

  BankTimeBucketDto cases(num cases);

  BankTimeBucketDto amountXof(String amountXof);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankTimeBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankTimeBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankTimeBucketDto call({DateTime bucket, num cases, String amountXof});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankTimeBucketDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankTimeBucketDto.copyWith.fieldName(...)`
class _$BankTimeBucketDtoCWProxyImpl implements _$BankTimeBucketDtoCWProxy {
  const _$BankTimeBucketDtoCWProxyImpl(this._value);

  final BankTimeBucketDto _value;

  @override
  BankTimeBucketDto bucket(DateTime bucket) => this(bucket: bucket);

  @override
  BankTimeBucketDto cases(num cases) => this(cases: cases);

  @override
  BankTimeBucketDto amountXof(String amountXof) => this(amountXof: amountXof);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankTimeBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankTimeBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankTimeBucketDto call({
    Object? bucket = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
  }) {
    return BankTimeBucketDto(
      bucket: bucket == const $CopyWithPlaceholder()
          ? _value.bucket
          // ignore: cast_nullable_to_non_nullable
          : bucket as DateTime,
      cases: cases == const $CopyWithPlaceholder()
          ? _value.cases
          // ignore: cast_nullable_to_non_nullable
          : cases as num,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as String,
    );
  }
}

extension $BankTimeBucketDtoCopyWith on BankTimeBucketDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankTimeBucketDto.copyWith(...)` or like so:`instanceOfBankTimeBucketDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankTimeBucketDtoCWProxy get copyWith =>
      _$BankTimeBucketDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankTimeBucketDto _$BankTimeBucketDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankTimeBucketDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['bucket', 'cases', 'amountXof']);
      final val = BankTimeBucketDto(
        bucket: $checkedConvert('bucket', (v) => DateTime.parse(v as String)),
        cases: $checkedConvert('cases', (v) => v as num),
        amountXof: $checkedConvert('amountXof', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$BankTimeBucketDtoToJson(BankTimeBucketDto instance) =>
    <String, dynamic>{
      'bucket': instance.bucket.toIso8601String(),
      'cases': instance.cases,
      'amountXof': instance.amountXof,
    };
