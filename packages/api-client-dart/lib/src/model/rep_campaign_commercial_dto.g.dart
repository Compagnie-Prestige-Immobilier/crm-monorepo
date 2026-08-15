// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_commercial_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignCommercialDtoCWProxy {
  RepCampaignCommercialDto userId(String userId);

  RepCampaignCommercialDto fullName(String fullName);

  RepCampaignCommercialDto username(String username);

  RepCampaignCommercialDto position(num position);

  RepCampaignCommercialDto progress(RepCampaignProgressDto progress);

  RepCampaignCommercialDto perDay(List<num> perDay);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignCommercialDto call({
    String userId,
    String fullName,
    String username,
    num position,
    RepCampaignProgressDto progress,
    List<num> perDay,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignCommercialDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignCommercialDto.copyWith.fieldName(...)`
class _$RepCampaignCommercialDtoCWProxyImpl
    implements _$RepCampaignCommercialDtoCWProxy {
  const _$RepCampaignCommercialDtoCWProxyImpl(this._value);

  final RepCampaignCommercialDto _value;

  @override
  RepCampaignCommercialDto userId(String userId) => this(userId: userId);

  @override
  RepCampaignCommercialDto fullName(String fullName) =>
      this(fullName: fullName);

  @override
  RepCampaignCommercialDto username(String username) =>
      this(username: username);

  @override
  RepCampaignCommercialDto position(num position) => this(position: position);

  @override
  RepCampaignCommercialDto progress(RepCampaignProgressDto progress) =>
      this(progress: progress);

  @override
  RepCampaignCommercialDto perDay(List<num> perDay) => this(perDay: perDay);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignCommercialDto call({
    Object? userId = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? perDay = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignCommercialDto(
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
          : progress as RepCampaignProgressDto,
      perDay: perDay == const $CopyWithPlaceholder()
          ? _value.perDay
          // ignore: cast_nullable_to_non_nullable
          : perDay as List<num>,
    );
  }
}

extension $RepCampaignCommercialDtoCopyWith on RepCampaignCommercialDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignCommercialDto.copyWith(...)` or like so:`instanceOfRepCampaignCommercialDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignCommercialDtoCWProxy get copyWith =>
      _$RepCampaignCommercialDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignCommercialDto _$RepCampaignCommercialDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignCommercialDto', json, ($checkedConvert) {
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
  final val = RepCampaignCommercialDto(
    userId: $checkedConvert('userId', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    username: $checkedConvert('username', (v) => v as String),
    position: $checkedConvert('position', (v) => v as num),
    progress: $checkedConvert(
      'progress',
      (v) => RepCampaignProgressDto.fromJson(v as Map<String, dynamic>),
    ),
    perDay: $checkedConvert(
      'perDay',
      (v) => (v as List<dynamic>).map((e) => e as num).toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignCommercialDtoToJson(
  RepCampaignCommercialDto instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'fullName': instance.fullName,
  'username': instance.username,
  'position': instance.position,
  'progress': instance.progress.toJson(),
  'perDay': instance.perDay,
};
