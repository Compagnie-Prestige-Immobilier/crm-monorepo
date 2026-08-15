// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'origin_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OriginCountDtoCWProxy {
  OriginCountDto origin(String? origin);

  OriginCountDto label(String label);

  OriginCountDto prospects(num prospects);

  OriginCountDto share(num? share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginCountDto call({
    String? origin,
    String label,
    num prospects,
    num? share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOriginCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOriginCountDto.copyWith.fieldName(...)`
class _$OriginCountDtoCWProxyImpl implements _$OriginCountDtoCWProxy {
  const _$OriginCountDtoCWProxyImpl(this._value);

  final OriginCountDto _value;

  @override
  OriginCountDto origin(String? origin) => this(origin: origin);

  @override
  OriginCountDto label(String label) => this(label: label);

  @override
  OriginCountDto prospects(num prospects) => this(prospects: prospects);

  @override
  OriginCountDto share(num? share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginCountDto call({
    Object? origin = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return OriginCountDto(
      origin: origin == const $CopyWithPlaceholder()
          ? _value.origin
          // ignore: cast_nullable_to_non_nullable
          : origin as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num?,
    );
  }
}

extension $OriginCountDtoCopyWith on OriginCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfOriginCountDto.copyWith(...)` or like so:`instanceOfOriginCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OriginCountDtoCWProxy get copyWith => _$OriginCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OriginCountDto _$OriginCountDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OriginCountDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['origin', 'label', 'prospects', 'share'],
      );
      final val = OriginCountDto(
        origin: $checkedConvert('origin', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$OriginCountDtoToJson(OriginCountDto instance) =>
    <String, dynamic>{
      'origin': instance.origin,
      'label': instance.label,
      'prospects': instance.prospects,
      'share': instance.share,
    };
