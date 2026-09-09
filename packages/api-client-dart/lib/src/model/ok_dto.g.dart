// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ok_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OkDtoCWProxy {
  OkDto ok(bool ok);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OkDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OkDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OkDto call({bool ok});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOkDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOkDto.copyWith.fieldName(...)`
class _$OkDtoCWProxyImpl implements _$OkDtoCWProxy {
  const _$OkDtoCWProxyImpl(this._value);

  final OkDto _value;

  @override
  OkDto ok(bool ok) => this(ok: ok);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OkDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OkDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OkDto call({Object? ok = const $CopyWithPlaceholder()}) {
    return OkDto(
      ok: ok == const $CopyWithPlaceholder()
          ? _value.ok
          // ignore: cast_nullable_to_non_nullable
          : ok as bool,
    );
  }
}

extension $OkDtoCopyWith on OkDto {
  /// Returns a callable class that can be used as follows: `instanceOfOkDto.copyWith(...)` or like so:`instanceOfOkDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OkDtoCWProxy get copyWith => _$OkDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OkDto _$OkDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OkDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['ok']);
      final val = OkDto(ok: $checkedConvert('ok', (v) => v as bool));
      return val;
    });

Map<String, dynamic> _$OkDtoToJson(OkDto instance) => <String, dynamic>{
  'ok': instance.ok,
};
