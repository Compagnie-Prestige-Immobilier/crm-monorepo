// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purge_result_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PurgeResultDtoCWProxy {
  PurgeResultDto deleted(List<PurgeDeletionDto> deleted);

  PurgeResultDto total(num total);

  PurgeResultDto purgedAt(DateTime purgedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeResultDto call({
    List<PurgeDeletionDto> deleted,
    num total,
    DateTime purgedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPurgeResultDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPurgeResultDto.copyWith.fieldName(...)`
class _$PurgeResultDtoCWProxyImpl implements _$PurgeResultDtoCWProxy {
  const _$PurgeResultDtoCWProxyImpl(this._value);

  final PurgeResultDto _value;

  @override
  PurgeResultDto deleted(List<PurgeDeletionDto> deleted) =>
      this(deleted: deleted);

  @override
  PurgeResultDto total(num total) => this(total: total);

  @override
  PurgeResultDto purgedAt(DateTime purgedAt) => this(purgedAt: purgedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeResultDto call({
    Object? deleted = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
    Object? purgedAt = const $CopyWithPlaceholder(),
  }) {
    return PurgeResultDto(
      deleted: deleted == const $CopyWithPlaceholder()
          ? _value.deleted
          // ignore: cast_nullable_to_non_nullable
          : deleted as List<PurgeDeletionDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      purgedAt: purgedAt == const $CopyWithPlaceholder()
          ? _value.purgedAt
          // ignore: cast_nullable_to_non_nullable
          : purgedAt as DateTime,
    );
  }
}

extension $PurgeResultDtoCopyWith on PurgeResultDto {
  /// Returns a callable class that can be used as follows: `instanceOfPurgeResultDto.copyWith(...)` or like so:`instanceOfPurgeResultDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PurgeResultDtoCWProxy get copyWith => _$PurgeResultDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurgeResultDto _$PurgeResultDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PurgeResultDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['deleted', 'total', 'purgedAt']);
      final val = PurgeResultDto(
        deleted: $checkedConvert(
          'deleted',
          (v) => (v as List<dynamic>)
              .map((e) => PurgeDeletionDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        total: $checkedConvert('total', (v) => v as num),
        purgedAt: $checkedConvert(
          'purgedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PurgeResultDtoToJson(PurgeResultDto instance) =>
    <String, dynamic>{
      'deleted': instance.deleted.map((e) => e.toJson()).toList(),
      'total': instance.total,
      'purgedAt': instance.purgedAt.toIso8601String(),
    };
