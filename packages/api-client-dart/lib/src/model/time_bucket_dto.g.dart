// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'time_bucket_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TimeBucketDtoCWProxy {
  TimeBucketDto bucket(DateTime bucket);

  TimeBucketDto prospects(num prospects);

  TimeBucketDto representants(num representants);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TimeBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TimeBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TimeBucketDto call({DateTime bucket, num prospects, num representants});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTimeBucketDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTimeBucketDto.copyWith.fieldName(...)`
class _$TimeBucketDtoCWProxyImpl implements _$TimeBucketDtoCWProxy {
  const _$TimeBucketDtoCWProxyImpl(this._value);

  final TimeBucketDto _value;

  @override
  TimeBucketDto bucket(DateTime bucket) => this(bucket: bucket);

  @override
  TimeBucketDto prospects(num prospects) => this(prospects: prospects);

  @override
  TimeBucketDto representants(num representants) =>
      this(representants: representants);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TimeBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TimeBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TimeBucketDto call({
    Object? bucket = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
  }) {
    return TimeBucketDto(
      bucket: bucket == const $CopyWithPlaceholder()
          ? _value.bucket
          // ignore: cast_nullable_to_non_nullable
          : bucket as DateTime,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as num,
    );
  }
}

extension $TimeBucketDtoCopyWith on TimeBucketDto {
  /// Returns a callable class that can be used as follows: `instanceOfTimeBucketDto.copyWith(...)` or like so:`instanceOfTimeBucketDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TimeBucketDtoCWProxy get copyWith => _$TimeBucketDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TimeBucketDto _$TimeBucketDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TimeBucketDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['bucket', 'prospects', 'representants'],
      );
      final val = TimeBucketDto(
        bucket: $checkedConvert('bucket', (v) => DateTime.parse(v as String)),
        prospects: $checkedConvert('prospects', (v) => v as num),
        representants: $checkedConvert('representants', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$TimeBucketDtoToJson(TimeBucketDto instance) =>
    <String, dynamic>{
      'bucket': instance.bucket.toIso8601String(),
      'prospects': instance.prospects,
      'representants': instance.representants,
    };
