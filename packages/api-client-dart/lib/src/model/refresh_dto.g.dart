// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'refresh_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RefreshDtoCWProxy {
  RefreshDto refreshToken(String refreshToken);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RefreshDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RefreshDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RefreshDto call({String refreshToken});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRefreshDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRefreshDto.copyWith.fieldName(...)`
class _$RefreshDtoCWProxyImpl implements _$RefreshDtoCWProxy {
  const _$RefreshDtoCWProxyImpl(this._value);

  final RefreshDto _value;

  @override
  RefreshDto refreshToken(String refreshToken) =>
      this(refreshToken: refreshToken);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RefreshDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RefreshDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RefreshDto call({Object? refreshToken = const $CopyWithPlaceholder()}) {
    return RefreshDto(
      refreshToken: refreshToken == const $CopyWithPlaceholder()
          ? _value.refreshToken
          // ignore: cast_nullable_to_non_nullable
          : refreshToken as String,
    );
  }
}

extension $RefreshDtoCopyWith on RefreshDto {
  /// Returns a callable class that can be used as follows: `instanceOfRefreshDto.copyWith(...)` or like so:`instanceOfRefreshDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RefreshDtoCWProxy get copyWith => _$RefreshDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RefreshDto _$RefreshDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RefreshDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['refreshToken']);
      final val = RefreshDto(
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$RefreshDtoToJson(RefreshDto instance) =>
    <String, dynamic>{'refreshToken': instance.refreshToken};
