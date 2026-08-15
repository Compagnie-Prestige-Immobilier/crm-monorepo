// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_aging_bucket_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankAgingBucketDtoCWProxy {
  BankAgingBucketDto bucket(BankAgeBucket bucket);

  BankAgingBucketDto label(String label);

  BankAgingBucketDto dossiers(num dossiers);

  BankAgingBucketDto share(num? share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingBucketDto call({
    BankAgeBucket bucket,
    String label,
    num dossiers,
    num? share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankAgingBucketDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankAgingBucketDto.copyWith.fieldName(...)`
class _$BankAgingBucketDtoCWProxyImpl implements _$BankAgingBucketDtoCWProxy {
  const _$BankAgingBucketDtoCWProxyImpl(this._value);

  final BankAgingBucketDto _value;

  @override
  BankAgingBucketDto bucket(BankAgeBucket bucket) => this(bucket: bucket);

  @override
  BankAgingBucketDto label(String label) => this(label: label);

  @override
  BankAgingBucketDto dossiers(num dossiers) => this(dossiers: dossiers);

  @override
  BankAgingBucketDto share(num? share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingBucketDto call({
    Object? bucket = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? dossiers = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return BankAgingBucketDto(
      bucket: bucket == const $CopyWithPlaceholder()
          ? _value.bucket
          // ignore: cast_nullable_to_non_nullable
          : bucket as BankAgeBucket,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      dossiers: dossiers == const $CopyWithPlaceholder()
          ? _value.dossiers
          // ignore: cast_nullable_to_non_nullable
          : dossiers as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num?,
    );
  }
}

extension $BankAgingBucketDtoCopyWith on BankAgingBucketDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankAgingBucketDto.copyWith(...)` or like so:`instanceOfBankAgingBucketDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankAgingBucketDtoCWProxy get copyWith =>
      _$BankAgingBucketDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankAgingBucketDto _$BankAgingBucketDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankAgingBucketDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['bucket', 'label', 'dossiers', 'share'],
      );
      final val = BankAgingBucketDto(
        bucket: $checkedConvert(
          'bucket',
          (v) => $enumDecode(
            _$BankAgeBucketEnumMap,
            v,
            unknownValue: BankAgeBucket.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        dossiers: $checkedConvert('dossiers', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$BankAgingBucketDtoToJson(BankAgingBucketDto instance) =>
    <String, dynamic>{
      'bucket': _$BankAgeBucketEnumMap[instance.bucket]!,
      'label': instance.label,
      'dossiers': instance.dossiers,
      'share': instance.share,
    };

const _$BankAgeBucketEnumMap = {
  BankAgeBucket.J0_7: 'J0_7',
  BankAgeBucket.J8_15: 'J8_15',
  BankAgeBucket.J16_30: 'J16_30',
  BankAgeBucket.J31_60: 'J31_60',
  BankAgeBucket.J60_PLUS: 'J60_PLUS',
  BankAgeBucket.unknownDefaultOpenApi: 'unknown_default_open_api',
};
