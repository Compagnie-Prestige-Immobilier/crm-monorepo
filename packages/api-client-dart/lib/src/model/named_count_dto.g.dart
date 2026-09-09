// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'named_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$NamedCountDtoCWProxy {
  NamedCountDto id(String? id);

  NamedCountDto label(String label);

  NamedCountDto prospects(num prospects);

  NamedCountDto share(num share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NamedCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NamedCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NamedCountDto call({String? id, String label, num prospects, num share});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfNamedCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfNamedCountDto.copyWith.fieldName(...)`
class _$NamedCountDtoCWProxyImpl implements _$NamedCountDtoCWProxy {
  const _$NamedCountDtoCWProxyImpl(this._value);

  final NamedCountDto _value;

  @override
  NamedCountDto id(String? id) => this(id: id);

  @override
  NamedCountDto label(String label) => this(label: label);

  @override
  NamedCountDto prospects(num prospects) => this(prospects: prospects);

  @override
  NamedCountDto share(num share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `NamedCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// NamedCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  NamedCountDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return NamedCountDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
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
          : share as num,
    );
  }
}

extension $NamedCountDtoCopyWith on NamedCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfNamedCountDto.copyWith(...)` or like so:`instanceOfNamedCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$NamedCountDtoCWProxy get copyWith => _$NamedCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NamedCountDto _$NamedCountDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NamedCountDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['id', 'label', 'prospects', 'share'],
      );
      final val = NamedCountDto(
        id: $checkedConvert('id', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$NamedCountDtoToJson(NamedCountDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'prospects': instance.prospects,
      'share': instance.share,
    };
