// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_deletion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncDeletionDtoCWProxy {
  SyncDeletionDto entity(SyncEntity entity);

  SyncDeletionDto id(String id);

  SyncDeletionDto deletedAt(DateTime deletedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncDeletionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncDeletionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncDeletionDto call({SyncEntity entity, String id, DateTime deletedAt});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncDeletionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncDeletionDto.copyWith.fieldName(...)`
class _$SyncDeletionDtoCWProxyImpl implements _$SyncDeletionDtoCWProxy {
  const _$SyncDeletionDtoCWProxyImpl(this._value);

  final SyncDeletionDto _value;

  @override
  SyncDeletionDto entity(SyncEntity entity) => this(entity: entity);

  @override
  SyncDeletionDto id(String id) => this(id: id);

  @override
  SyncDeletionDto deletedAt(DateTime deletedAt) => this(deletedAt: deletedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncDeletionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncDeletionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncDeletionDto call({
    Object? entity = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? deletedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncDeletionDto(
      entity: entity == const $CopyWithPlaceholder()
          ? _value.entity
          // ignore: cast_nullable_to_non_nullable
          : entity as SyncEntity,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      deletedAt: deletedAt == const $CopyWithPlaceholder()
          ? _value.deletedAt
          // ignore: cast_nullable_to_non_nullable
          : deletedAt as DateTime,
    );
  }
}

extension $SyncDeletionDtoCopyWith on SyncDeletionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncDeletionDto.copyWith(...)` or like so:`instanceOfSyncDeletionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncDeletionDtoCWProxy get copyWith => _$SyncDeletionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncDeletionDto _$SyncDeletionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncDeletionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['entity', 'id', 'deletedAt']);
      final val = SyncDeletionDto(
        entity: $checkedConvert(
          'entity',
          (v) => $enumDecode(
            _$SyncEntityEnumMap,
            v,
            unknownValue: SyncEntity.unknownDefaultOpenApi,
          ),
        ),
        id: $checkedConvert('id', (v) => v as String),
        deletedAt: $checkedConvert(
          'deletedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncDeletionDtoToJson(SyncDeletionDto instance) =>
    <String, dynamic>{
      'entity': _$SyncEntityEnumMap[instance.entity]!,
      'id': instance.id,
      'deletedAt': instance.deletedAt.toIso8601String(),
    };

const _$SyncEntityEnumMap = {
  SyncEntity.representant: 'representant',
  SyncEntity.representantComment: 'representant_comment',
  SyncEntity.prospect: 'prospect',
  SyncEntity.callAttempt: 'call_attempt',
  SyncEntity.visite: 'visite',
  SyncEntity.appelDetecte: 'appel_detecte',
  SyncEntity.unknownDefaultOpenApi: 'unknown_default_open_api',
};
