// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'demo_status_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DemoStatusDtoCWProxy {
  DemoStatusDto enabled(bool enabled);

  DemoStatusDto seededAt(DateTime? seededAt);

  DemoStatusDto canToggle(bool canToggle);

  DemoStatusDto reason(String? reason);

  DemoStatusDto counts(DemoCountsDto counts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoStatusDto call({
    bool enabled,
    DateTime? seededAt,
    bool canToggle,
    String? reason,
    DemoCountsDto counts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDemoStatusDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDemoStatusDto.copyWith.fieldName(...)`
class _$DemoStatusDtoCWProxyImpl implements _$DemoStatusDtoCWProxy {
  const _$DemoStatusDtoCWProxyImpl(this._value);

  final DemoStatusDto _value;

  @override
  DemoStatusDto enabled(bool enabled) => this(enabled: enabled);

  @override
  DemoStatusDto seededAt(DateTime? seededAt) => this(seededAt: seededAt);

  @override
  DemoStatusDto canToggle(bool canToggle) => this(canToggle: canToggle);

  @override
  DemoStatusDto reason(String? reason) => this(reason: reason);

  @override
  DemoStatusDto counts(DemoCountsDto counts) => this(counts: counts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoStatusDto call({
    Object? enabled = const $CopyWithPlaceholder(),
    Object? seededAt = const $CopyWithPlaceholder(),
    Object? canToggle = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? counts = const $CopyWithPlaceholder(),
  }) {
    return DemoStatusDto(
      enabled: enabled == const $CopyWithPlaceholder()
          ? _value.enabled
          // ignore: cast_nullable_to_non_nullable
          : enabled as bool,
      seededAt: seededAt == const $CopyWithPlaceholder()
          ? _value.seededAt
          // ignore: cast_nullable_to_non_nullable
          : seededAt as DateTime?,
      canToggle: canToggle == const $CopyWithPlaceholder()
          ? _value.canToggle
          // ignore: cast_nullable_to_non_nullable
          : canToggle as bool,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String?,
      counts: counts == const $CopyWithPlaceholder()
          ? _value.counts
          // ignore: cast_nullable_to_non_nullable
          : counts as DemoCountsDto,
    );
  }
}

extension $DemoStatusDtoCopyWith on DemoStatusDto {
  /// Returns a callable class that can be used as follows: `instanceOfDemoStatusDto.copyWith(...)` or like so:`instanceOfDemoStatusDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DemoStatusDtoCWProxy get copyWith => _$DemoStatusDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DemoStatusDto _$DemoStatusDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DemoStatusDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'enabled',
          'seededAt',
          'canToggle',
          'reason',
          'counts',
        ],
      );
      final val = DemoStatusDto(
        enabled: $checkedConvert('enabled', (v) => v as bool),
        seededAt: $checkedConvert(
          'seededAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        canToggle: $checkedConvert('canToggle', (v) => v as bool),
        reason: $checkedConvert('reason', (v) => v as String?),
        counts: $checkedConvert(
          'counts',
          (v) => DemoCountsDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DemoStatusDtoToJson(DemoStatusDto instance) =>
    <String, dynamic>{
      'enabled': instance.enabled,
      'seededAt': instance.seededAt?.toIso8601String(),
      'canToggle': instance.canToggle,
      'reason': instance.reason,
      'counts': instance.counts.toJson(),
    };
