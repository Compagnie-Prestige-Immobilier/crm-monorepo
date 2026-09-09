// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_aging_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankAgingDtoCWProxy {
  BankAgingDto buckets(List<BankAgingBucketDto> buckets);

  BankAgingDto stages(List<BankAgingStageDto> stages);

  BankAgingDto total(num total);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingDto call({
    List<BankAgingBucketDto> buckets,
    List<BankAgingStageDto> stages,
    num total,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankAgingDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankAgingDto.copyWith.fieldName(...)`
class _$BankAgingDtoCWProxyImpl implements _$BankAgingDtoCWProxy {
  const _$BankAgingDtoCWProxyImpl(this._value);

  final BankAgingDto _value;

  @override
  BankAgingDto buckets(List<BankAgingBucketDto> buckets) =>
      this(buckets: buckets);

  @override
  BankAgingDto stages(List<BankAgingStageDto> stages) => this(stages: stages);

  @override
  BankAgingDto total(num total) => this(total: total);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingDto call({
    Object? buckets = const $CopyWithPlaceholder(),
    Object? stages = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
  }) {
    return BankAgingDto(
      buckets: buckets == const $CopyWithPlaceholder()
          ? _value.buckets
          // ignore: cast_nullable_to_non_nullable
          : buckets as List<BankAgingBucketDto>,
      stages: stages == const $CopyWithPlaceholder()
          ? _value.stages
          // ignore: cast_nullable_to_non_nullable
          : stages as List<BankAgingStageDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
    );
  }
}

extension $BankAgingDtoCopyWith on BankAgingDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankAgingDto.copyWith(...)` or like so:`instanceOfBankAgingDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankAgingDtoCWProxy get copyWith => _$BankAgingDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankAgingDto _$BankAgingDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankAgingDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['buckets', 'stages', 'total']);
      final val = BankAgingDto(
        buckets: $checkedConvert(
          'buckets',
          (v) => (v as List<dynamic>)
              .map(
                (e) => BankAgingBucketDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        stages: $checkedConvert(
          'stages',
          (v) => (v as List<dynamic>)
              .map((e) => BankAgingStageDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$BankAgingDtoToJson(BankAgingDto instance) =>
    <String, dynamic>{
      'buckets': instance.buckets.map((e) => e.toJson()).toList(),
      'stages': instance.stages.map((e) => e.toJson()).toList(),
      'total': instance.total,
    };
