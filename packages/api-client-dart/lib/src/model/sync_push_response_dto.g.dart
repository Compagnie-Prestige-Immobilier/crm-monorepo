// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_push_response_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncPushResponseDtoCWProxy {
  SyncPushResponseDto batchId(String batchId);

  SyncPushResponseDto serverTime(DateTime serverTime);

  SyncPushResponseDto results(List<SyncOperationResultDto> results);

  SyncPushResponseDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPushResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPushResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPushResponseDto call({
    String batchId,
    DateTime serverTime,
    List<SyncOperationResultDto> results,
    String? nextCursor,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncPushResponseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncPushResponseDto.copyWith.fieldName(...)`
class _$SyncPushResponseDtoCWProxyImpl implements _$SyncPushResponseDtoCWProxy {
  const _$SyncPushResponseDtoCWProxyImpl(this._value);

  final SyncPushResponseDto _value;

  @override
  SyncPushResponseDto batchId(String batchId) => this(batchId: batchId);

  @override
  SyncPushResponseDto serverTime(DateTime serverTime) =>
      this(serverTime: serverTime);

  @override
  SyncPushResponseDto results(List<SyncOperationResultDto> results) =>
      this(results: results);

  @override
  SyncPushResponseDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPushResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPushResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPushResponseDto call({
    Object? batchId = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
    Object? results = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return SyncPushResponseDto(
      batchId: batchId == const $CopyWithPlaceholder()
          ? _value.batchId
          // ignore: cast_nullable_to_non_nullable
          : batchId as String,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as DateTime,
      results: results == const $CopyWithPlaceholder()
          ? _value.results
          // ignore: cast_nullable_to_non_nullable
          : results as List<SyncOperationResultDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $SyncPushResponseDtoCopyWith on SyncPushResponseDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncPushResponseDto.copyWith(...)` or like so:`instanceOfSyncPushResponseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncPushResponseDtoCWProxy get copyWith =>
      _$SyncPushResponseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncPushResponseDto _$SyncPushResponseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncPushResponseDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['batchId', 'serverTime', 'results', 'nextCursor'],
      );
      final val = SyncPushResponseDto(
        batchId: $checkedConvert('batchId', (v) => v as String),
        serverTime: $checkedConvert(
          'serverTime',
          (v) => DateTime.parse(v as String),
        ),
        results: $checkedConvert(
          'results',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    SyncOperationResultDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$SyncPushResponseDtoToJson(
  SyncPushResponseDto instance,
) => <String, dynamic>{
  'batchId': instance.batchId,
  'serverTime': instance.serverTime.toIso8601String(),
  'results': instance.results.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
