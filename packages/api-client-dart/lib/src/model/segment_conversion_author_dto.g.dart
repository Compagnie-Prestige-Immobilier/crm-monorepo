// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_conversion_author_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentConversionAuthorDtoCWProxy {
  SegmentConversionAuthorDto userId(String userId);

  SegmentConversionAuthorDto fullName(String fullName);

  SegmentConversionAuthorDto conversions(num conversions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionAuthorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionAuthorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionAuthorDto call({
    String userId,
    String fullName,
    num conversions,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentConversionAuthorDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentConversionAuthorDto.copyWith.fieldName(...)`
class _$SegmentConversionAuthorDtoCWProxyImpl
    implements _$SegmentConversionAuthorDtoCWProxy {
  const _$SegmentConversionAuthorDtoCWProxyImpl(this._value);

  final SegmentConversionAuthorDto _value;

  @override
  SegmentConversionAuthorDto userId(String userId) => this(userId: userId);

  @override
  SegmentConversionAuthorDto fullName(String fullName) =>
      this(fullName: fullName);

  @override
  SegmentConversionAuthorDto conversions(num conversions) =>
      this(conversions: conversions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionAuthorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionAuthorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionAuthorDto call({
    Object? userId = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? conversions = const $CopyWithPlaceholder(),
  }) {
    return SegmentConversionAuthorDto(
      userId: userId == const $CopyWithPlaceholder()
          ? _value.userId
          // ignore: cast_nullable_to_non_nullable
          : userId as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      conversions: conversions == const $CopyWithPlaceholder()
          ? _value.conversions
          // ignore: cast_nullable_to_non_nullable
          : conversions as num,
    );
  }
}

extension $SegmentConversionAuthorDtoCopyWith on SegmentConversionAuthorDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentConversionAuthorDto.copyWith(...)` or like so:`instanceOfSegmentConversionAuthorDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentConversionAuthorDtoCWProxy get copyWith =>
      _$SegmentConversionAuthorDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentConversionAuthorDto _$SegmentConversionAuthorDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SegmentConversionAuthorDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['userId', 'fullName', 'conversions']);
  final val = SegmentConversionAuthorDto(
    userId: $checkedConvert('userId', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    conversions: $checkedConvert('conversions', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$SegmentConversionAuthorDtoToJson(
  SegmentConversionAuthorDto instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'fullName': instance.fullName,
  'conversions': instance.conversions,
};
