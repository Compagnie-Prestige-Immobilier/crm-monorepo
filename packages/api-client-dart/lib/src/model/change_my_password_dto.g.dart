// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'change_my_password_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChangeMyPasswordDtoCWProxy {
  ChangeMyPasswordDto currentPassword(String currentPassword);

  ChangeMyPasswordDto newPassword(String newPassword);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChangeMyPasswordDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChangeMyPasswordDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChangeMyPasswordDto call({String currentPassword, String newPassword});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfChangeMyPasswordDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfChangeMyPasswordDto.copyWith.fieldName(...)`
class _$ChangeMyPasswordDtoCWProxyImpl implements _$ChangeMyPasswordDtoCWProxy {
  const _$ChangeMyPasswordDtoCWProxyImpl(this._value);

  final ChangeMyPasswordDto _value;

  @override
  ChangeMyPasswordDto currentPassword(String currentPassword) =>
      this(currentPassword: currentPassword);

  @override
  ChangeMyPasswordDto newPassword(String newPassword) =>
      this(newPassword: newPassword);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChangeMyPasswordDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChangeMyPasswordDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChangeMyPasswordDto call({
    Object? currentPassword = const $CopyWithPlaceholder(),
    Object? newPassword = const $CopyWithPlaceholder(),
  }) {
    return ChangeMyPasswordDto(
      currentPassword: currentPassword == const $CopyWithPlaceholder()
          ? _value.currentPassword
          // ignore: cast_nullable_to_non_nullable
          : currentPassword as String,
      newPassword: newPassword == const $CopyWithPlaceholder()
          ? _value.newPassword
          // ignore: cast_nullable_to_non_nullable
          : newPassword as String,
    );
  }
}

extension $ChangeMyPasswordDtoCopyWith on ChangeMyPasswordDto {
  /// Returns a callable class that can be used as follows: `instanceOfChangeMyPasswordDto.copyWith(...)` or like so:`instanceOfChangeMyPasswordDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChangeMyPasswordDtoCWProxy get copyWith =>
      _$ChangeMyPasswordDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChangeMyPasswordDto _$ChangeMyPasswordDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ChangeMyPasswordDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['currentPassword', 'newPassword']);
      final val = ChangeMyPasswordDto(
        currentPassword: $checkedConvert('currentPassword', (v) => v as String),
        newPassword: $checkedConvert('newPassword', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ChangeMyPasswordDtoToJson(
  ChangeMyPasswordDto instance,
) => <String, dynamic>{
  'currentPassword': instance.currentPassword,
  'newPassword': instance.newPassword,
};
