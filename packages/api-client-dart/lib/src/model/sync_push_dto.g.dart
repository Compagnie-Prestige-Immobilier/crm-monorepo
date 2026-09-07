// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_push_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncPushDtoCWProxy {
  SyncPushDto clientBatchId(String clientBatchId);

  SyncPushDto payloadVersion(num payloadVersion);

  SyncPushDto operations(List<SyncOperationDto> operations);

  SyncPushDto pendingOps(num? pendingOps);

  SyncPushDto appVersion(String? appVersion);

  SyncPushDto journalAppelsAutorise(bool? journalAppelsAutorise);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPushDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPushDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPushDto call({
    String clientBatchId,
    num payloadVersion,
    List<SyncOperationDto> operations,
    num? pendingOps,
    String? appVersion,
    bool? journalAppelsAutorise,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncPushDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncPushDto.copyWith.fieldName(...)`
class _$SyncPushDtoCWProxyImpl implements _$SyncPushDtoCWProxy {
  const _$SyncPushDtoCWProxyImpl(this._value);

  final SyncPushDto _value;

  @override
  SyncPushDto clientBatchId(String clientBatchId) =>
      this(clientBatchId: clientBatchId);

  @override
  SyncPushDto payloadVersion(num payloadVersion) =>
      this(payloadVersion: payloadVersion);

  @override
  SyncPushDto operations(List<SyncOperationDto> operations) =>
      this(operations: operations);

  @override
  SyncPushDto pendingOps(num? pendingOps) => this(pendingOps: pendingOps);

  @override
  SyncPushDto appVersion(String? appVersion) => this(appVersion: appVersion);

  @override
  SyncPushDto journalAppelsAutorise(bool? journalAppelsAutorise) =>
      this(journalAppelsAutorise: journalAppelsAutorise);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPushDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPushDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPushDto call({
    Object? clientBatchId = const $CopyWithPlaceholder(),
    Object? payloadVersion = const $CopyWithPlaceholder(),
    Object? operations = const $CopyWithPlaceholder(),
    Object? pendingOps = const $CopyWithPlaceholder(),
    Object? appVersion = const $CopyWithPlaceholder(),
    Object? journalAppelsAutorise = const $CopyWithPlaceholder(),
  }) {
    return SyncPushDto(
      clientBatchId: clientBatchId == const $CopyWithPlaceholder()
          ? _value.clientBatchId
          // ignore: cast_nullable_to_non_nullable
          : clientBatchId as String,
      payloadVersion: payloadVersion == const $CopyWithPlaceholder()
          ? _value.payloadVersion
          // ignore: cast_nullable_to_non_nullable
          : payloadVersion as num,
      operations: operations == const $CopyWithPlaceholder()
          ? _value.operations
          // ignore: cast_nullable_to_non_nullable
          : operations as List<SyncOperationDto>,
      pendingOps: pendingOps == const $CopyWithPlaceholder()
          ? _value.pendingOps
          // ignore: cast_nullable_to_non_nullable
          : pendingOps as num?,
      appVersion: appVersion == const $CopyWithPlaceholder()
          ? _value.appVersion
          // ignore: cast_nullable_to_non_nullable
          : appVersion as String?,
      journalAppelsAutorise:
          journalAppelsAutorise == const $CopyWithPlaceholder()
          ? _value.journalAppelsAutorise
          // ignore: cast_nullable_to_non_nullable
          : journalAppelsAutorise as bool?,
    );
  }
}

extension $SyncPushDtoCopyWith on SyncPushDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncPushDto.copyWith(...)` or like so:`instanceOfSyncPushDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncPushDtoCWProxy get copyWith => _$SyncPushDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncPushDto _$SyncPushDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncPushDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['clientBatchId', 'payloadVersion', 'operations'],
      );
      final val = SyncPushDto(
        clientBatchId: $checkedConvert('clientBatchId', (v) => v as String),
        payloadVersion: $checkedConvert('payloadVersion', (v) => v as num),
        operations: $checkedConvert(
          'operations',
          (v) => (v as List<dynamic>)
              .map((e) => SyncOperationDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        pendingOps: $checkedConvert('pendingOps', (v) => v as num?),
        appVersion: $checkedConvert('appVersion', (v) => v as String?),
        journalAppelsAutorise: $checkedConvert(
          'journalAppelsAutorise',
          (v) => v as bool?,
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncPushDtoToJson(SyncPushDto instance) =>
    <String, dynamic>{
      'clientBatchId': instance.clientBatchId,
      'payloadVersion': instance.payloadVersion,
      'operations': instance.operations.map((e) => e.toJson()).toList(),
      if (instance.pendingOps case final value?) 'pendingOps': value,
      if (instance.appVersion case final value?) 'appVersion': value,
      if (instance.journalAppelsAutorise case final value?)
        'journalAppelsAutorise': value,
    };
