// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_bucket_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatBucketDtoCWProxy {
  VisiteStatBucketDto id(String id);

  VisiteStatBucketDto code(String code);

  VisiteStatBucketDto label(String label);

  VisiteStatBucketDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatBucketDto call({String id, String code, String label, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatBucketDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatBucketDto.copyWith.fieldName(...)`
class _$VisiteStatBucketDtoCWProxyImpl implements _$VisiteStatBucketDtoCWProxy {
  const _$VisiteStatBucketDtoCWProxyImpl(this._value);

  final VisiteStatBucketDto _value;

  @override
  VisiteStatBucketDto id(String id) => this(id: id);

  @override
  VisiteStatBucketDto code(String code) => this(code: code);

  @override
  VisiteStatBucketDto label(String label) => this(label: label);

  @override
  VisiteStatBucketDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatBucketDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatBucketDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatBucketDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatBucketDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatBucketDtoCopyWith on VisiteStatBucketDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatBucketDto.copyWith(...)` or like so:`instanceOfVisiteStatBucketDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatBucketDtoCWProxy get copyWith =>
      _$VisiteStatBucketDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatBucketDto _$VisiteStatBucketDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatBucketDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'code', 'label', 'count']);
      final val = VisiteStatBucketDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        count: $checkedConvert('count', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatBucketDtoToJson(
  VisiteStatBucketDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'count': instance.count,
};
