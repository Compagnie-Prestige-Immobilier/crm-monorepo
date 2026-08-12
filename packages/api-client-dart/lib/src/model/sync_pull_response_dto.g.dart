// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_pull_response_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncPullResponseDtoCWProxy {
  SyncPullResponseDto changes(SyncChangesDto changes);

  SyncPullResponseDto deletions(List<SyncDeletionDto> deletions);

  SyncPullResponseDto nextCursor(String nextCursor);

  SyncPullResponseDto hasMore(bool hasMore);

  SyncPullResponseDto serverTime(DateTime serverTime);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPullResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPullResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPullResponseDto call({
    SyncChangesDto changes,
    List<SyncDeletionDto> deletions,
    String nextCursor,
    bool hasMore,
    DateTime serverTime,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncPullResponseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncPullResponseDto.copyWith.fieldName(...)`
class _$SyncPullResponseDtoCWProxyImpl implements _$SyncPullResponseDtoCWProxy {
  const _$SyncPullResponseDtoCWProxyImpl(this._value);

  final SyncPullResponseDto _value;

  @override
  SyncPullResponseDto changes(SyncChangesDto changes) => this(changes: changes);

  @override
  SyncPullResponseDto deletions(List<SyncDeletionDto> deletions) =>
      this(deletions: deletions);

  @override
  SyncPullResponseDto nextCursor(String nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  SyncPullResponseDto hasMore(bool hasMore) => this(hasMore: hasMore);

  @override
  SyncPullResponseDto serverTime(DateTime serverTime) =>
      this(serverTime: serverTime);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncPullResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncPullResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncPullResponseDto call({
    Object? changes = const $CopyWithPlaceholder(),
    Object? deletions = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
    Object? hasMore = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
  }) {
    return SyncPullResponseDto(
      changes: changes == const $CopyWithPlaceholder()
          ? _value.changes
          // ignore: cast_nullable_to_non_nullable
          : changes as SyncChangesDto,
      deletions: deletions == const $CopyWithPlaceholder()
          ? _value.deletions
          // ignore: cast_nullable_to_non_nullable
          : deletions as List<SyncDeletionDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String,
      hasMore: hasMore == const $CopyWithPlaceholder()
          ? _value.hasMore
          // ignore: cast_nullable_to_non_nullable
          : hasMore as bool,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as DateTime,
    );
  }
}

extension $SyncPullResponseDtoCopyWith on SyncPullResponseDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncPullResponseDto.copyWith(...)` or like so:`instanceOfSyncPullResponseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncPullResponseDtoCWProxy get copyWith =>
      _$SyncPullResponseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncPullResponseDto _$SyncPullResponseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncPullResponseDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'changes',
          'deletions',
          'nextCursor',
          'hasMore',
          'serverTime',
        ],
      );
      final val = SyncPullResponseDto(
        changes: $checkedConvert(
          'changes',
          (v) => SyncChangesDto.fromJson(v as Map<String, dynamic>),
        ),
        deletions: $checkedConvert(
          'deletions',
          (v) => (v as List<dynamic>)
              .map((e) => SyncDeletionDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String),
        hasMore: $checkedConvert('hasMore', (v) => v as bool),
        serverTime: $checkedConvert(
          'serverTime',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncPullResponseDtoToJson(
  SyncPullResponseDto instance,
) => <String, dynamic>{
  'changes': instance.changes.toJson(),
  'deletions': instance.deletions.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
  'hasMore': instance.hasMore,
  'serverTime': instance.serverTime.toIso8601String(),
};
