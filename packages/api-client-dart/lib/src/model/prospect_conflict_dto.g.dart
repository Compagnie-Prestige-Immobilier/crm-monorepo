// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_conflict_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectConflictDtoCWProxy {
  ProspectConflictDto code(ProspectConflictDtoCodeEnum code);

  ProspectConflictDto message(String message);

  ProspectConflictDto existing(ProspectConflictExistingDto existing);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectConflictDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectConflictDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectConflictDto call({
    ProspectConflictDtoCodeEnum code,
    String message,
    ProspectConflictExistingDto existing,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectConflictDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectConflictDto.copyWith.fieldName(...)`
class _$ProspectConflictDtoCWProxyImpl implements _$ProspectConflictDtoCWProxy {
  const _$ProspectConflictDtoCWProxyImpl(this._value);

  final ProspectConflictDto _value;

  @override
  ProspectConflictDto code(ProspectConflictDtoCodeEnum code) =>
      this(code: code);

  @override
  ProspectConflictDto message(String message) => this(message: message);

  @override
  ProspectConflictDto existing(ProspectConflictExistingDto existing) =>
      this(existing: existing);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectConflictDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectConflictDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectConflictDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? message = const $CopyWithPlaceholder(),
    Object? existing = const $CopyWithPlaceholder(),
  }) {
    return ProspectConflictDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as ProspectConflictDtoCodeEnum,
      message: message == const $CopyWithPlaceholder()
          ? _value.message
          // ignore: cast_nullable_to_non_nullable
          : message as String,
      existing: existing == const $CopyWithPlaceholder()
          ? _value.existing
          // ignore: cast_nullable_to_non_nullable
          : existing as ProspectConflictExistingDto,
    );
  }
}

extension $ProspectConflictDtoCopyWith on ProspectConflictDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectConflictDto.copyWith(...)` or like so:`instanceOfProspectConflictDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectConflictDtoCWProxy get copyWith =>
      _$ProspectConflictDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectConflictDto _$ProspectConflictDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ProspectConflictDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'message', 'existing']);
      final val = ProspectConflictDto(
        code: $checkedConvert(
          'code',
          (v) => $enumDecode(
            _$ProspectConflictDtoCodeEnumEnumMap,
            v,
            unknownValue: ProspectConflictDtoCodeEnum.unknownDefaultOpenApi,
          ),
        ),
        message: $checkedConvert('message', (v) => v as String),
        existing: $checkedConvert(
          'existing',
          (v) =>
              ProspectConflictExistingDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProspectConflictDtoToJson(
  ProspectConflictDto instance,
) => <String, dynamic>{
  'code': _$ProspectConflictDtoCodeEnumEnumMap[instance.code]!,
  'message': instance.message,
  'existing': instance.existing.toJson(),
};

const _$ProspectConflictDtoCodeEnumEnumMap = {
  ProspectConflictDtoCodeEnum.PROSPECT_PHONE_CONFLICT:
      'PROSPECT_PHONE_CONFLICT',
  ProspectConflictDtoCodeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
