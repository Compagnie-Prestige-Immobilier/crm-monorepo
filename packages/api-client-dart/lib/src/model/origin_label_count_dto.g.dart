// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'origin_label_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OriginLabelCountDtoCWProxy {
  OriginLabelCountDto origin(String? origin);

  OriginLabelCountDto label(String label);

  OriginLabelCountDto prospects(num prospects);

  OriginLabelCountDto share(num? share);

  OriginLabelCountDto originLabel(String? originLabel);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginLabelCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginLabelCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginLabelCountDto call({
    String? origin,
    String label,
    num prospects,
    num? share,
    String? originLabel,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOriginLabelCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOriginLabelCountDto.copyWith.fieldName(...)`
class _$OriginLabelCountDtoCWProxyImpl implements _$OriginLabelCountDtoCWProxy {
  const _$OriginLabelCountDtoCWProxyImpl(this._value);

  final OriginLabelCountDto _value;

  @override
  OriginLabelCountDto origin(String? origin) => this(origin: origin);

  @override
  OriginLabelCountDto label(String label) => this(label: label);

  @override
  OriginLabelCountDto prospects(num prospects) => this(prospects: prospects);

  @override
  OriginLabelCountDto share(num? share) => this(share: share);

  @override
  OriginLabelCountDto originLabel(String? originLabel) =>
      this(originLabel: originLabel);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OriginLabelCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OriginLabelCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OriginLabelCountDto call({
    Object? origin = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
    Object? originLabel = const $CopyWithPlaceholder(),
  }) {
    return OriginLabelCountDto(
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
      originLabel: originLabel == const $CopyWithPlaceholder()
          ? _value.originLabel
          // ignore: cast_nullable_to_non_nullable
          : originLabel as String?,
    );
  }
}

extension $OriginLabelCountDtoCopyWith on OriginLabelCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfOriginLabelCountDto.copyWith(...)` or like so:`instanceOfOriginLabelCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OriginLabelCountDtoCWProxy get copyWith =>
      _$OriginLabelCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OriginLabelCountDto _$OriginLabelCountDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OriginLabelCountDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'origin',
          'label',
          'prospects',
          'share',
          'originLabel',
        ],
      );
      final val = OriginLabelCountDto(
        origin: $checkedConvert('origin', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num?),
        originLabel: $checkedConvert('originLabel', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$OriginLabelCountDtoToJson(
  OriginLabelCountDto instance,
) => <String, dynamic>{
  'origin': instance.origin,
  'label': instance.label,
  'prospects': instance.prospects,
  'share': instance.share,
  'originLabel': instance.originLabel,
};
