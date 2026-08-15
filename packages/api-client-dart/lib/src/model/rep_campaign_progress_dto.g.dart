// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_progress_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignProgressDtoCWProxy {
  RepCampaignProgressDto total(num total);

  RepCampaignProgressDto open(num open);

  RepCampaignProgressDto done(num done);

  RepCampaignProgressDto cancelled(num cancelled);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignProgressDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignProgressDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignProgressDto call({num total, num open, num done, num cancelled});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignProgressDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignProgressDto.copyWith.fieldName(...)`
class _$RepCampaignProgressDtoCWProxyImpl
    implements _$RepCampaignProgressDtoCWProxy {
  const _$RepCampaignProgressDtoCWProxyImpl(this._value);

  final RepCampaignProgressDto _value;

  @override
  RepCampaignProgressDto total(num total) => this(total: total);

  @override
  RepCampaignProgressDto open(num open) => this(open: open);

  @override
  RepCampaignProgressDto done(num done) => this(done: done);

  @override
  RepCampaignProgressDto cancelled(num cancelled) => this(cancelled: cancelled);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignProgressDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignProgressDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignProgressDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? open = const $CopyWithPlaceholder(),
    Object? done = const $CopyWithPlaceholder(),
    Object? cancelled = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignProgressDto(
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

extension $RepCampaignProgressDtoCopyWith on RepCampaignProgressDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignProgressDto.copyWith(...)` or like so:`instanceOfRepCampaignProgressDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignProgressDtoCWProxy get copyWith =>
      _$RepCampaignProgressDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignProgressDto _$RepCampaignProgressDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignProgressDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['total', 'open', 'done', 'cancelled']);
  final val = RepCampaignProgressDto(
    total: $checkedConvert('total', (v) => v as num),
    open: $checkedConvert('open', (v) => v as num),
    done: $checkedConvert('done', (v) => v as num),
    cancelled: $checkedConvert('cancelled', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignProgressDtoToJson(
  RepCampaignProgressDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'open': instance.open,
  'done': instance.done,
  'cancelled': instance.cancelled,
};
