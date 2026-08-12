// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UserListDtoCWProxy {
  UserListDto items(List<UserDto> items);

  UserListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserListDto call({List<UserDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUserListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUserListDto.copyWith.fieldName(...)`
class _$UserListDtoCWProxyImpl implements _$UserListDtoCWProxy {
  const _$UserListDtoCWProxyImpl(this._value);

  final UserListDto _value;

  @override
  UserListDto items(List<UserDto> items) => this(items: items);

  @override
  UserListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return UserListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<UserDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $UserListDtoCopyWith on UserListDto {
  /// Returns a callable class that can be used as follows: `instanceOfUserListDto.copyWith(...)` or like so:`instanceOfUserListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UserListDtoCWProxy get copyWith => _$UserListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserListDto _$UserListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = UserListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => UserDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$UserListDtoToJson(UserListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
