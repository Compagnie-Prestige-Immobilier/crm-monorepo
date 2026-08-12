// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_progress_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignProgressDtoCWProxy {
  CampaignProgressDto total(num total);

  CampaignProgressDto open(num open);

  CampaignProgressDto done(num done);

  CampaignProgressDto cancelled(num cancelled);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignProgressDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignProgressDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignProgressDto call({num total, num open, num done, num cancelled});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignProgressDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignProgressDto.copyWith.fieldName(...)`
class _$CampaignProgressDtoCWProxyImpl implements _$CampaignProgressDtoCWProxy {
  const _$CampaignProgressDtoCWProxyImpl(this._value);

  final CampaignProgressDto _value;

  @override
  CampaignProgressDto total(num total) => this(total: total);

  @override
  CampaignProgressDto open(num open) => this(open: open);

  @override
  CampaignProgressDto done(num done) => this(done: done);

  @override
  CampaignProgressDto cancelled(num cancelled) => this(cancelled: cancelled);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignProgressDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignProgressDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignProgressDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? open = const $CopyWithPlaceholder(),
    Object? done = const $CopyWithPlaceholder(),
    Object? cancelled = const $CopyWithPlaceholder(),
  }) {
    return CampaignProgressDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      open: open == const $CopyWithPlaceholder()
          ? _value.open
          // ignore: cast_nullable_to_non_nullable
          : open as num,
      done: done == const $CopyWithPlaceholder()
          ? _value.done
          // ignore: cast_nullable_to_non_nullable
          : done as num,
      cancelled: cancelled == const $CopyWithPlaceholder()
          ? _value.cancelled
          // ignore: cast_nullable_to_non_nullable
          : cancelled as num,
    );
  }
}

extension $CampaignProgressDtoCopyWith on CampaignProgressDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignProgressDto.copyWith(...)` or like so:`instanceOfCampaignProgressDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignProgressDtoCWProxy get copyWith =>
      _$CampaignProgressDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignProgressDto _$CampaignProgressDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CampaignProgressDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['total', 'open', 'done', 'cancelled'],
      );
      final val = CampaignProgressDto(
        total: $checkedConvert('total', (v) => v as num),
        open: $checkedConvert('open', (v) => v as num),
        done: $checkedConvert('done', (v) => v as num),
        cancelled: $checkedConvert('cancelled', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$CampaignProgressDtoToJson(
  CampaignProgressDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'open': instance.open,
  'done': instance.done,
  'cancelled': instance.cancelled,
};
