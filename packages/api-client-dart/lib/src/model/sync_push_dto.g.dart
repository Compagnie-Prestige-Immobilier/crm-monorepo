// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_push_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncPushDtoCWProxy {
  SyncPushDto clientBatchId(String clientBatchId);

  SyncPushDto payloadVersion(num payloadVersion);

  SyncPushDto operations(List<SyncOperationDto> operations);

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
      );
      return val;
    });

Map<String, dynamic> _$SyncPushDtoToJson(SyncPushDto instance) =>
    <String, dynamic>{
      'clientBatchId': instance.clientBatchId,
      'payloadVersion': instance.payloadVersion,
      'operations': instance.operations.map((e) => e.toJson()).toList(),
    };
