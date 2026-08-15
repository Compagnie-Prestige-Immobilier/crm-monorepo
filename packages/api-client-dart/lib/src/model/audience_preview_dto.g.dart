// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audience_preview_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AudiencePreviewDtoCWProxy {
  AudiencePreviewDto recipientCount(num recipientCount);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AudiencePreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AudiencePreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AudiencePreviewDto call({num recipientCount});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAudiencePreviewDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAudiencePreviewDto.copyWith.fieldName(...)`
class _$AudiencePreviewDtoCWProxyImpl implements _$AudiencePreviewDtoCWProxy {
  const _$AudiencePreviewDtoCWProxyImpl(this._value);

  final AudiencePreviewDto _value;

  @override
  AudiencePreviewDto recipientCount(num recipientCount) =>
      this(recipientCount: recipientCount);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AudiencePreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AudiencePreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AudiencePreviewDto call({
    Object? recipientCount = const $CopyWithPlaceholder(),
  }) {
    return AudiencePreviewDto(
      recipientCount: recipientCount == const $CopyWithPlaceholder()
          ? _value.recipientCount
          // ignore: cast_nullable_to_non_nullable
          : recipientCount as num,
    );
  }
}

extension $AudiencePreviewDtoCopyWith on AudiencePreviewDto {
  /// Returns a callable class that can be used as follows: `instanceOfAudiencePreviewDto.copyWith(...)` or like so:`instanceOfAudiencePreviewDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AudiencePreviewDtoCWProxy get copyWith =>
      _$AudiencePreviewDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AudiencePreviewDto _$AudiencePreviewDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AudiencePreviewDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['recipientCount']);
      final val = AudiencePreviewDto(
        recipientCount: $checkedConvert('recipientCount', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$AudiencePreviewDtoToJson(AudiencePreviewDto instance) =>
    <String, dynamic>{'recipientCount': instance.recipientCount};
