// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_closed_day_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignClosedDayDtoCWProxy {
  CampaignClosedDayDto day(DateTime day);

  CampaignClosedDayDto commercialId(String commercialId);

  CampaignClosedDayDto commercialName(String commercialName);

  CampaignClosedDayDto done(num done);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignClosedDayDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignClosedDayDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignClosedDayDto call({
    DateTime day,
    String commercialId,
    String commercialName,
    num done,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignClosedDayDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignClosedDayDto.copyWith.fieldName(...)`
class _$CampaignClosedDayDtoCWProxyImpl
    implements _$CampaignClosedDayDtoCWProxy {
  const _$CampaignClosedDayDtoCWProxyImpl(this._value);

  final CampaignClosedDayDto _value;

  @override
  CampaignClosedDayDto day(DateTime day) => this(day: day);

  @override
  CampaignClosedDayDto commercialId(String commercialId) =>
      this(commercialId: commercialId);

  @override
  CampaignClosedDayDto commercialName(String commercialName) =>
      this(commercialName: commercialName);

  @override
  CampaignClosedDayDto done(num done) => this(done: done);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignClosedDayDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignClosedDayDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignClosedDayDto call({
    Object? day = const $CopyWithPlaceholder(),
    Object? commercialId = const $CopyWithPlaceholder(),
    Object? commercialName = const $CopyWithPlaceholder(),
    Object? done = const $CopyWithPlaceholder(),
  }) {
    return CampaignClosedDayDto(
      day: day == const $CopyWithPlaceholder()
          ? _value.day
          // ignore: cast_nullable_to_non_nullable
          : day as DateTime,
      commercialId: commercialId == const $CopyWithPlaceholder()
          ? _value.commercialId
          // ignore: cast_nullable_to_non_nullable
          : commercialId as String,
      commercialName: commercialName == const $CopyWithPlaceholder()
          ? _value.commercialName
          // ignore: cast_nullable_to_non_nullable
          : commercialName as String,
      done: done == const $CopyWithPlaceholder()
          ? _value.done
          // ignore: cast_nullable_to_non_nullable
          : done as num,
    );
  }
}

extension $CampaignClosedDayDtoCopyWith on CampaignClosedDayDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignClosedDayDto.copyWith(...)` or like so:`instanceOfCampaignClosedDayDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignClosedDayDtoCWProxy get copyWith =>
      _$CampaignClosedDayDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignClosedDayDto _$CampaignClosedDayDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CampaignClosedDayDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['day', 'commercialId', 'commercialName', 'done'],
  );
  final val = CampaignClosedDayDto(
    day: $checkedConvert('day', (v) => DateTime.parse(v as String)),
    commercialId: $checkedConvert('commercialId', (v) => v as String),
    commercialName: $checkedConvert('commercialName', (v) => v as String),
    done: $checkedConvert('done', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$CampaignClosedDayDtoToJson(
  CampaignClosedDayDto instance,
) => <String, dynamic>{
  'day': instance.day.toIso8601String(),
  'commercialId': instance.commercialId,
  'commercialName': instance.commercialName,
  'done': instance.done,
};
