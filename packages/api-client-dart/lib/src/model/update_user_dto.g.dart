// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateUserDtoCWProxy {
  UpdateUserDto email(String? email);

  UpdateUserDto username(String? username);

  UpdateUserDto fullName(String? fullName);

  UpdateUserDto role(Role? role);

  UpdateUserDto departementId(String? departementId);

  UpdateUserDto phone(String? phone);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateUserDto call({
    String? email,
    String? username,
    String? fullName,
    Role? role,
    String? departementId,
    String? phone,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateUserDto.copyWith.fieldName(...)`
class _$UpdateUserDtoCWProxyImpl implements _$UpdateUserDtoCWProxy {
  const _$UpdateUserDtoCWProxyImpl(this._value);

  final UpdateUserDto _value;

  @override
  UpdateUserDto email(String? email) => this(email: email);

  @override
  UpdateUserDto username(String? username) => this(username: username);

  @override
  UpdateUserDto fullName(String? fullName) => this(fullName: fullName);

  @override
  UpdateUserDto role(Role? role) => this(role: role);

  @override
  UpdateUserDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  UpdateUserDto phone(String? phone) => this(phone: phone);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateUserDto call({
    Object? email = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
  }) {
    return UpdateUserDto(
      email: email == const $CopyWithPlaceholder()
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String?,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String?,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String?,
      role: role == const $CopyWithPlaceholder()
          ? _value.role
          // ignore: cast_nullable_to_non_nullable
          : role as Role?,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String?,
    );
  }
}

extension $UpdateUserDtoCopyWith on UpdateUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateUserDto.copyWith(...)` or like so:`instanceOfUpdateUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateUserDtoCWProxy get copyWith => _$UpdateUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateUserDto _$UpdateUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateUserDto', json, ($checkedConvert) {
      final val = UpdateUserDto(
        email: $checkedConvert('email', (v) => v as String?),
        username: $checkedConvert('username', (v) => v as String?),
        fullName: $checkedConvert('fullName', (v) => v as String?),
        role: $checkedConvert(
          'role',
          (v) =>
              $enumDecodeNullable(
                _$RoleEnumMap,
                v,
                unknownValue: Role.unknownDefaultOpenApi,
              ) ??
              Role.COMMERCIAL,
        ),
        departementId: $checkedConvert('departementId', (v) => v as String?),
        phone: $checkedConvert('phone', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$UpdateUserDtoToJson(UpdateUserDto instance) =>
    <String, dynamic>{
      if (instance.email case final value?) 'email': value,
      if (instance.username case final value?) 'username': value,
      if (instance.fullName case final value?) 'fullName': value,
      if (_$RoleEnumMap[instance.role] case final value?) 'role': value,
      if (instance.departementId case final value?) 'departementId': value,
      if (instance.phone case final value?) 'phone': value,
    };

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.DIRECTION: 'DIRECTION',
  Role.ACCUEIL: 'ACCUEIL',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};
