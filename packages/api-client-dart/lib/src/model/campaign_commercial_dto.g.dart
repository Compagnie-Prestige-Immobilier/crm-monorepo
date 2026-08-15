// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_commercial_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignCommercialDtoCWProxy {
  CampaignCommercialDto userId(String userId);

  CampaignCommercialDto fullName(String fullName);

  CampaignCommercialDto username(String username);

  CampaignCommercialDto position(num position);

  CampaignCommercialDto progress(CampaignProgressDto progress);

  CampaignCommercialDto perDay(List<num> perDay);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignCommercialDto call({
    String userId,
    String fullName,
    String username,
    num position,
    CampaignProgressDto progress,
    List<num> perDay,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignCommercialDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignCommercialDto.copyWith.fieldName(...)`
class _$CampaignCommercialDtoCWProxyImpl
    implements _$CampaignCommercialDtoCWProxy {
  const _$CampaignCommercialDtoCWProxyImpl(this._value);

  final CampaignCommercialDto _value;

  @override
  CampaignCommercialDto userId(String userId) => this(userId: userId);

  @override
  CampaignCommercialDto fullName(String fullName) => this(fullName: fullName);

  @override
  CampaignCommercialDto username(String username) => this(username: username);

  @override
  CampaignCommercialDto position(num position) => this(position: position);

  @override
  CampaignCommercialDto progress(CampaignProgressDto progress) =>
      this(progress: progress);

  @override
  CampaignCommercialDto perDay(List<num> perDay) => this(perDay: perDay);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignCommercialDto call({
    Object? userId = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? perDay = const $CopyWithPlaceholder(),
  }) {
    return CampaignCommercialDto(
      userId: userId == const $CopyWithPlaceholder()
          ? _value.userId
          // ignore: cast_nullable_to_non_nullable
          : userId as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num,
      progress: progress == const $CopyWithPlaceholder()
          ? _value.progress
          // ignore: cast_nullable_to_non_nullable
          : progress as CampaignProgressDto,
      perDay: perDay == const $CopyWithPlaceholder()
          ? _value.perDay
          // ignore: cast_nullable_to_non_nullable
          : perDay as List<num>,
    );
  }
}

extension $CampaignCommercialDtoCopyWith on CampaignCommercialDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignCommercialDto.copyWith(...)` or like so:`instanceOfCampaignCommercialDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignCommercialDtoCWProxy get copyWith =>
      _$CampaignCommercialDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignCommercialDto _$CampaignCommercialDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CampaignCommercialDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'userId',
      'fullName',
      'username',
      'position',
      'progress',
      'perDay',
    ],
  );
  final val = CampaignCommercialDto(
    userId: $checkedConvert('userId', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    username: $checkedConvert('username', (v) => v as String),
    position: $checkedConvert('position', (v) => v as num),
    progress: $checkedConvert(
      'progress',
      (v) => CampaignProgressDto.fromJson(v as Map<String, dynamic>),
    ),
    perDay: $checkedConvert(
      'perDay',
      (v) => (v as List<dynamic>).map((e) => e as num).toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$CampaignCommercialDtoToJson(
  CampaignCommercialDto instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'fullName': instance.fullName,
  'username': instance.username,
  'position': instance.position,
  'progress': instance.progress.toJson(),
  'perDay': instance.perDay,
};
