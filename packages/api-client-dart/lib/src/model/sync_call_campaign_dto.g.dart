// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_call_campaign_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncCallCampaignDtoCWProxy {
  SyncCallCampaignDto id(String id);

  SyncCallCampaignDto name(String name);

  SyncCallCampaignDto status(CampaignStatus status);

  SyncCallCampaignDto spreadDays(num spreadDays);

  SyncCallCampaignDto updatedAt(DateTime updatedAt);

  SyncCallCampaignDto closedAt(DateTime? closedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncCallCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncCallCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncCallCampaignDto call({
    String id,
    String name,
    CampaignStatus status,
    num spreadDays,
    DateTime updatedAt,
    DateTime? closedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncCallCampaignDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncCallCampaignDto.copyWith.fieldName(...)`
class _$SyncCallCampaignDtoCWProxyImpl implements _$SyncCallCampaignDtoCWProxy {
  const _$SyncCallCampaignDtoCWProxyImpl(this._value);

  final SyncCallCampaignDto _value;

  @override
  SyncCallCampaignDto id(String id) => this(id: id);

  @override
  SyncCallCampaignDto name(String name) => this(name: name);

  @override
  SyncCallCampaignDto status(CampaignStatus status) => this(status: status);

  @override
  SyncCallCampaignDto spreadDays(num spreadDays) =>
      this(spreadDays: spreadDays);

  @override
  SyncCallCampaignDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  SyncCallCampaignDto closedAt(DateTime? closedAt) => this(closedAt: closedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncCallCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncCallCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncCallCampaignDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
    Object? closedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncCallCampaignDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as CampaignStatus,
      spreadDays: spreadDays == const $CopyWithPlaceholder()
          ? _value.spreadDays
          // ignore: cast_nullable_to_non_nullable
          : spreadDays as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
      closedAt: closedAt == const $CopyWithPlaceholder()
          ? _value.closedAt
          // ignore: cast_nullable_to_non_nullable
          : closedAt as DateTime?,
    );
  }
}

extension $SyncCallCampaignDtoCopyWith on SyncCallCampaignDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncCallCampaignDto.copyWith(...)` or like so:`instanceOfSyncCallCampaignDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncCallCampaignDtoCWProxy get copyWith =>
      _$SyncCallCampaignDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncCallCampaignDto _$SyncCallCampaignDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncCallCampaignDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['id', 'name', 'status', 'spreadDays', 'updatedAt'],
      );
      final val = SyncCallCampaignDto(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$CampaignStatusEnumMap,
            v,
            unknownValue: CampaignStatus.unknownDefaultOpenApi,
          ),
        ),
        spreadDays: $checkedConvert('spreadDays', (v) => v as num),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
        closedAt: $checkedConvert(
          'closedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncCallCampaignDtoToJson(
  SyncCallCampaignDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'status': _$CampaignStatusEnumMap[instance.status]!,
  'spreadDays': instance.spreadDays,
  'updatedAt': instance.updatedAt.toIso8601String(),
  if (instance.closedAt?.toIso8601String() case final value?) 'closedAt': value,
};

const _$CampaignStatusEnumMap = {
  CampaignStatus.DRAFT: 'DRAFT',
  CampaignStatus.ACTIVE: 'ACTIVE',
  CampaignStatus.PAUSED: 'PAUSED',
  CampaignStatus.CLOSED: 'CLOSED',
  CampaignStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};
