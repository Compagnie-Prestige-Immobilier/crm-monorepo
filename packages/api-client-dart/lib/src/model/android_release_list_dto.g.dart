// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'android_release_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AndroidReleaseListDtoCWProxy {
  AndroidReleaseListDto items(List<AndroidReleaseDto> items);

  AndroidReleaseListDto minVersionCode(num? minVersionCode);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AndroidReleaseListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AndroidReleaseListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AndroidReleaseListDto call({
    List<AndroidReleaseDto> items,
    num? minVersionCode,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAndroidReleaseListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAndroidReleaseListDto.copyWith.fieldName(...)`
class _$AndroidReleaseListDtoCWProxyImpl
    implements _$AndroidReleaseListDtoCWProxy {
  const _$AndroidReleaseListDtoCWProxyImpl(this._value);

  final AndroidReleaseListDto _value;

  @override
  AndroidReleaseListDto items(List<AndroidReleaseDto> items) =>
      this(items: items);

  @override
  AndroidReleaseListDto minVersionCode(num? minVersionCode) =>
      this(minVersionCode: minVersionCode);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AndroidReleaseListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AndroidReleaseListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AndroidReleaseListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? minVersionCode = const $CopyWithPlaceholder(),
  }) {
    return AndroidReleaseListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<AndroidReleaseDto>,
      minVersionCode: minVersionCode == const $CopyWithPlaceholder()
          ? _value.minVersionCode
          // ignore: cast_nullable_to_non_nullable
          : minVersionCode as num?,
    );
  }
}

extension $AndroidReleaseListDtoCopyWith on AndroidReleaseListDto {
  /// Returns a callable class that can be used as follows: `instanceOfAndroidReleaseListDto.copyWith(...)` or like so:`instanceOfAndroidReleaseListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AndroidReleaseListDtoCWProxy get copyWith =>
      _$AndroidReleaseListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AndroidReleaseListDto _$AndroidReleaseListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('AndroidReleaseListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'minVersionCode']);
  final val = AndroidReleaseListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => AndroidReleaseDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    minVersionCode: $checkedConvert('minVersionCode', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$AndroidReleaseListDtoToJson(
  AndroidReleaseListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'minVersionCode': instance.minVersionCode,
};
