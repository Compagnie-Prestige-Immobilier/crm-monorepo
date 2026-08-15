// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignListDtoCWProxy {
  RepCampaignListDto items(List<RepCampaignSummaryDto> items);

  RepCampaignListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignListDto call({
    List<RepCampaignSummaryDto> items,
    PageMetaDto meta,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignListDto.copyWith.fieldName(...)`
class _$RepCampaignListDtoCWProxyImpl implements _$RepCampaignListDtoCWProxy {
  const _$RepCampaignListDtoCWProxyImpl(this._value);

  final RepCampaignListDto _value;

  @override
  RepCampaignListDto items(List<RepCampaignSummaryDto> items) =>
      this(items: items);

  @override
  RepCampaignListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepCampaignSummaryDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $RepCampaignListDtoCopyWith on RepCampaignListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignListDto.copyWith(...)` or like so:`instanceOfRepCampaignListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignListDtoCWProxy get copyWith =>
      _$RepCampaignListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignListDto _$RepCampaignListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepCampaignListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = RepCampaignListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    RepCampaignSummaryDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RepCampaignListDtoToJson(RepCampaignListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
