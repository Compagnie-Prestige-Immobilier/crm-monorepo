// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analytics_funnel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnalyticsFunnelDtoCWProxy {
  AnalyticsFunnelDto etapes(List<FunnelStageDto> etapes);

  AnalyticsFunnelDto finance(AnalyticsFinanceDto finance);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsFunnelDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsFunnelDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsFunnelDto call({
    List<FunnelStageDto> etapes,
    AnalyticsFinanceDto finance,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnalyticsFunnelDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnalyticsFunnelDto.copyWith.fieldName(...)`
class _$AnalyticsFunnelDtoCWProxyImpl implements _$AnalyticsFunnelDtoCWProxy {
  const _$AnalyticsFunnelDtoCWProxyImpl(this._value);

  final AnalyticsFunnelDto _value;

  @override
  AnalyticsFunnelDto etapes(List<FunnelStageDto> etapes) =>
      this(etapes: etapes);

  @override
  AnalyticsFunnelDto finance(AnalyticsFinanceDto finance) =>
      this(finance: finance);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsFunnelDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsFunnelDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsFunnelDto call({
    Object? etapes = const $CopyWithPlaceholder(),
    Object? finance = const $CopyWithPlaceholder(),
  }) {
    return AnalyticsFunnelDto(
      etapes: etapes == const $CopyWithPlaceholder()
          ? _value.etapes
          // ignore: cast_nullable_to_non_nullable
          : etapes as List<FunnelStageDto>,
      finance: finance == const $CopyWithPlaceholder()
          ? _value.finance
          // ignore: cast_nullable_to_non_nullable
          : finance as AnalyticsFinanceDto,
    );
  }
}

extension $AnalyticsFunnelDtoCopyWith on AnalyticsFunnelDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnalyticsFunnelDto.copyWith(...)` or like so:`instanceOfAnalyticsFunnelDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnalyticsFunnelDtoCWProxy get copyWith =>
      _$AnalyticsFunnelDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalyticsFunnelDto _$AnalyticsFunnelDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AnalyticsFunnelDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['etapes', 'finance']);
      final val = AnalyticsFunnelDto(
        etapes: $checkedConvert(
          'etapes',
          (v) => (v as List<dynamic>)
              .map((e) => FunnelStageDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        finance: $checkedConvert(
          'finance',
          (v) => AnalyticsFinanceDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AnalyticsFunnelDtoToJson(AnalyticsFunnelDto instance) =>
    <String, dynamic>{
      'etapes': instance.etapes.map((e) => e.toJson()).toList(),
      'finance': instance.finance.toJson(),
    };
