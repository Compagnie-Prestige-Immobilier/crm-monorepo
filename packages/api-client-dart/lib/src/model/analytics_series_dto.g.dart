// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analytics_series_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnalyticsSeriesDtoCWProxy {
  AnalyticsSeriesDto buckets(List<TimeBucketDto> buckets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsSeriesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsSeriesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsSeriesDto call({List<TimeBucketDto> buckets});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnalyticsSeriesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnalyticsSeriesDto.copyWith.fieldName(...)`
class _$AnalyticsSeriesDtoCWProxyImpl implements _$AnalyticsSeriesDtoCWProxy {
  const _$AnalyticsSeriesDtoCWProxyImpl(this._value);

  final AnalyticsSeriesDto _value;

  @override
  AnalyticsSeriesDto buckets(List<TimeBucketDto> buckets) =>
      this(buckets: buckets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsSeriesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsSeriesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsSeriesDto call({Object? buckets = const $CopyWithPlaceholder()}) {
    return AnalyticsSeriesDto(
      buckets: buckets == const $CopyWithPlaceholder()
          ? _value.buckets
          // ignore: cast_nullable_to_non_nullable
          : buckets as List<TimeBucketDto>,
    );
  }
}

extension $AnalyticsSeriesDtoCopyWith on AnalyticsSeriesDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnalyticsSeriesDto.copyWith(...)` or like so:`instanceOfAnalyticsSeriesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnalyticsSeriesDtoCWProxy get copyWith =>
      _$AnalyticsSeriesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalyticsSeriesDto _$AnalyticsSeriesDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AnalyticsSeriesDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['buckets']);
      final val = AnalyticsSeriesDto(
        buckets: $checkedConvert(
          'buckets',
          (v) => (v as List<dynamic>)
              .map((e) => TimeBucketDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AnalyticsSeriesDtoToJson(AnalyticsSeriesDto instance) =>
    <String, dynamic>{
      'buckets': instance.buckets.map((e) => e.toJson()).toList(),
    };
