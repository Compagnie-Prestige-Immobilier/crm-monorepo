// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_rep_campaign_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateRepCampaignDtoCWProxy {
  CreateRepCampaignDto name(String name);

  CreateRepCampaignDto commercialIds(List<String> commercialIds);

  CreateRepCampaignDto departementId(String? departementId);

  CreateRepCampaignDto iefId(String? iefId);

  CreateRepCampaignDto onlyWithoutProspects(bool? onlyWithoutProspects);

  CreateRepCampaignDto spreadDays(num? spreadDays);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepCampaignDto call({
    String name,
    List<String> commercialIds,
    String? departementId,
    String? iefId,
    bool? onlyWithoutProspects,
    num? spreadDays,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateRepCampaignDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateRepCampaignDto.copyWith.fieldName(...)`
class _$CreateRepCampaignDtoCWProxyImpl
    implements _$CreateRepCampaignDtoCWProxy {
  const _$CreateRepCampaignDtoCWProxyImpl(this._value);

  final CreateRepCampaignDto _value;

  @override
  CreateRepCampaignDto name(String name) => this(name: name);

  @override
  CreateRepCampaignDto commercialIds(List<String> commercialIds) =>
      this(commercialIds: commercialIds);

  @override
  CreateRepCampaignDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  CreateRepCampaignDto iefId(String? iefId) => this(iefId: iefId);

  @override
  CreateRepCampaignDto onlyWithoutProspects(bool? onlyWithoutProspects) =>
      this(onlyWithoutProspects: onlyWithoutProspects);

  @override
  CreateRepCampaignDto spreadDays(num? spreadDays) =>
      this(spreadDays: spreadDays);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepCampaignDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? commercialIds = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? iefId = const $CopyWithPlaceholder(),
    Object? onlyWithoutProspects = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
  }) {
    return CreateRepCampaignDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      commercialIds: commercialIds == const $CopyWithPlaceholder()
          ? _value.commercialIds
          // ignore: cast_nullable_to_non_nullable
          : commercialIds as List<String>,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      iefId: iefId == const $CopyWithPlaceholder()
          ? _value.iefId
          // ignore: cast_nullable_to_non_nullable
          : iefId as String?,
      onlyWithoutProspects: onlyWithoutProspects == const $CopyWithPlaceholder()
          ? _value.onlyWithoutProspects
          // ignore: cast_nullable_to_non_nullable
          : onlyWithoutProspects as bool?,
      spreadDays: spreadDays == const $CopyWithPlaceholder()
          ? _value.spreadDays
          // ignore: cast_nullable_to_non_nullable
          : spreadDays as num?,
    );
  }
}

extension $CreateRepCampaignDtoCopyWith on CreateRepCampaignDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateRepCampaignDto.copyWith(...)` or like so:`instanceOfCreateRepCampaignDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateRepCampaignDtoCWProxy get copyWith =>
      _$CreateRepCampaignDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateRepCampaignDto _$CreateRepCampaignDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateRepCampaignDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['name', 'commercialIds']);
  final val = CreateRepCampaignDto(
    name: $checkedConvert('name', (v) => v as String),
    commercialIds: $checkedConvert(
      'commercialIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    departementId: $checkedConvert('departementId', (v) => v as String?),
    iefId: $checkedConvert('iefId', (v) => v as String?),
    onlyWithoutProspects: $checkedConvert(
      'onlyWithoutProspects',
      (v) => v as bool? ?? false,
    ),
    spreadDays: $checkedConvert('spreadDays', (v) => v as num? ?? 1),
  );
  return val;
});

Map<String, dynamic> _$CreateRepCampaignDtoToJson(
  CreateRepCampaignDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'commercialIds': instance.commercialIds,
  if (instance.departementId case final value?) 'departementId': value,
  if (instance.iefId case final value?) 'iefId': value,
  if (instance.onlyWithoutProspects case final value?)
    'onlyWithoutProspects': value,
  if (instance.spreadDays case final value?) 'spreadDays': value,
};
