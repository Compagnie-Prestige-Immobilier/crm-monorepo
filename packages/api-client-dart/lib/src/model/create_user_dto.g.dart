// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_user_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateUserDtoCWProxy {
  CreateUserDto email(String email);

  CreateUserDto username(String username);

  CreateUserDto fullName(String fullName);

  CreateUserDto password(String password);

  CreateUserDto role(Role? role);

  CreateUserDto departementId(String? departementId);

  CreateUserDto phone(String? phone);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateUserDto call({
    String email,
    String username,
    String fullName,
    String password,
    Role? role,
    String? departementId,
    String? phone,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateUserDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateUserDto.copyWith.fieldName(...)`
class _$CreateUserDtoCWProxyImpl implements _$CreateUserDtoCWProxy {
  const _$CreateUserDtoCWProxyImpl(this._value);

  final CreateUserDto _value;

  @override
  CreateUserDto email(String email) => this(email: email);

  @override
  CreateUserDto username(String username) => this(username: username);

  @override
  CreateUserDto fullName(String fullName) => this(fullName: fullName);

  @override
  CreateUserDto password(String password) => this(password: password);

  @override
  CreateUserDto role(Role? role) => this(role: role);

  @override
  CreateUserDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  CreateUserDto phone(String? phone) => this(phone: phone);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateUserDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateUserDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateUserDto call({
    Object? email = const $CopyWithPlaceholder(),
    Object? username = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? password = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
  }) {
    return CreateUserDto(
      email: email == const $CopyWithPlaceholder()
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String,
      username: username == const $CopyWithPlaceholder()
          ? _value.username
          // ignore: cast_nullable_to_non_nullable
          : username as String,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      password: password == const $CopyWithPlaceholder()
          ? _value.password
          // ignore: cast_nullable_to_non_nullable
          : password as String,
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

extension $CreateUserDtoCopyWith on CreateUserDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateUserDto.copyWith(...)` or like so:`instanceOfCreateUserDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateUserDtoCWProxy get copyWith => _$CreateUserDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateUserDto _$CreateUserDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateUserDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['email', 'username', 'fullName', 'password'],
      );
      final val = CreateUserDto(
        email: $checkedConvert('email', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String),
        fullName: $checkedConvert('fullName', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
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

Map<String, dynamic> _$CreateUserDtoToJson(CreateUserDto instance) =>
    <String, dynamic>{
      'email': instance.email,
      'username': instance.username,
      'fullName': instance.fullName,
      'password': instance.password,
      if (_$RoleEnumMap[instance.role] case final value?) 'role': value,
      if (instance.departementId case final value?) 'departementId': value,
      if (instance.phone case final value?) 'phone': value,
    };

const _$RoleEnumMap = {
  Role.ADMIN: 'ADMIN',
  Role.COMMERCIAL: 'COMMERCIAL',
  Role.BANQUE_FINANCE: 'BANQUE_FINANCE',
  Role.SUPERVISEUR: 'SUPERVISEUR',
  Role.unknownDefaultOpenApi: 'unknown_default_open_api',
};
