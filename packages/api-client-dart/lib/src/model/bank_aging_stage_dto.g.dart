// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_aging_stage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankAgingStageDtoCWProxy {
  BankAgingStageDto stageId(String stageId);

  BankAgingStageDto label(String label);

  BankAgingStageDto dossiers(num dossiers);

  BankAgingStageDto share(num? share);

  BankAgingStageDto medianStationDays(num? medianStationDays);

  BankAgingStageDto buckets(List<BankAgingBucketDto> buckets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingStageDto call({
    String stageId,
    String label,
    num dossiers,
    num? share,
    num? medianStationDays,
    List<BankAgingBucketDto> buckets,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankAgingStageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankAgingStageDto.copyWith.fieldName(...)`
class _$BankAgingStageDtoCWProxyImpl implements _$BankAgingStageDtoCWProxy {
  const _$BankAgingStageDtoCWProxyImpl(this._value);

  final BankAgingStageDto _value;

  @override
  BankAgingStageDto stageId(String stageId) => this(stageId: stageId);

  @override
  BankAgingStageDto label(String label) => this(label: label);

  @override
  BankAgingStageDto dossiers(num dossiers) => this(dossiers: dossiers);

  @override
  BankAgingStageDto share(num? share) => this(share: share);

  @override
  BankAgingStageDto medianStationDays(num? medianStationDays) =>
      this(medianStationDays: medianStationDays);

  @override
  BankAgingStageDto buckets(List<BankAgingBucketDto> buckets) =>
      this(buckets: buckets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgingStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgingStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgingStageDto call({
    Object? stageId = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? dossiers = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
    Object? medianStationDays = const $CopyWithPlaceholder(),
    Object? buckets = const $CopyWithPlaceholder(),
  }) {
    return BankAgingStageDto(
      stageId: stageId == const $CopyWithPlaceholder()
          ? _value.stageId
          // ignore: cast_nullable_to_non_nullable
          : stageId as String,
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
      medianStationDays: medianStationDays == const $CopyWithPlaceholder()
          ? _value.medianStationDays
          // ignore: cast_nullable_to_non_nullable
          : medianStationDays as num?,
      buckets: buckets == const $CopyWithPlaceholder()
          ? _value.buckets
          // ignore: cast_nullable_to_non_nullable
          : buckets as List<BankAgingBucketDto>,
    );
  }
}

extension $BankAgingStageDtoCopyWith on BankAgingStageDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankAgingStageDto.copyWith(...)` or like so:`instanceOfBankAgingStageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankAgingStageDtoCWProxy get copyWith =>
      _$BankAgingStageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankAgingStageDto _$BankAgingStageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankAgingStageDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'stageId',
      'label',
      'dossiers',
      'share',
      'medianStationDays',
      'buckets',
    ],
  );
  final val = BankAgingStageDto(
    stageId: $checkedConvert('stageId', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    dossiers: $checkedConvert('dossiers', (v) => v as num),
    share: $checkedConvert('share', (v) => v as num?),
    medianStationDays: $checkedConvert('medianStationDays', (v) => v as num?),
    buckets: $checkedConvert(
      'buckets',
      (v) => (v as List<dynamic>)
          .map((e) => BankAgingBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$BankAgingStageDtoToJson(BankAgingStageDto instance) =>
    <String, dynamic>{
      'stageId': instance.stageId,
      'label': instance.label,
      'dossiers': instance.dossiers,
      'share': instance.share,
      'medianStationDays': instance.medianStationDays,
      'buckets': instance.buckets.map((e) => e.toJson()).toList(),
    };
