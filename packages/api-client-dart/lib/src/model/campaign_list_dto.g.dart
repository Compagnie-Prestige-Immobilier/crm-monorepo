// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignListDtoCWProxy {
  CampaignListDto items(List<CampaignSummaryDto> items);

  CampaignListDto meta(Phase2PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignListDto call({
    List<CampaignSummaryDto> items,
    Phase2PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignListDto.copyWith.fieldName(...)`
class _$CampaignListDtoCWProxyImpl implements _$CampaignListDtoCWProxy {
  const _$CampaignListDtoCWProxyImpl(this._value);

  final CampaignListDto _value;

  @override
  CampaignListDto items(List<CampaignSummaryDto> items) => this(items: items);

  @override
  CampaignListDto meta(Phase2PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return CampaignListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<CampaignSummaryDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as Phase2PageMetaDto,
    );
  }
}

extension $CampaignListDtoCopyWith on CampaignListDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignListDto.copyWith(...)` or like so:`instanceOfCampaignListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignListDtoCWProxy get copyWith => _$CampaignListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignListDto _$CampaignListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CampaignListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = CampaignListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) => CampaignSummaryDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => Phase2PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CampaignListDtoToJson(CampaignListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
