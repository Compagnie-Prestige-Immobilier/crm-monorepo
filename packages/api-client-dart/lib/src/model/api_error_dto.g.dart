// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_error_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ApiErrorDtoCWProxy {
  ApiErrorDto statusCode(num statusCode);

  ApiErrorDto code(String code);

  ApiErrorDto message(String message);

  ApiErrorDto details(List<String>? details);

  ApiErrorDto requestId(String? requestId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ApiErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ApiErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ApiErrorDto call({
    num statusCode,
    String code,
    String message,
    List<String>? details,
    String? requestId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfApiErrorDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfApiErrorDto.copyWith.fieldName(...)`
class _$ApiErrorDtoCWProxyImpl implements _$ApiErrorDtoCWProxy {
  const _$ApiErrorDtoCWProxyImpl(this._value);

  final ApiErrorDto _value;

  @override
  ApiErrorDto statusCode(num statusCode) => this(statusCode: statusCode);

  @override
  ApiErrorDto code(String code) => this(code: code);

  @override
  ApiErrorDto message(String message) => this(message: message);

  @override
  ApiErrorDto details(List<String>? details) => this(details: details);

  @override
  ApiErrorDto requestId(String? requestId) => this(requestId: requestId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ApiErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ApiErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ApiErrorDto call({
    Object? statusCode = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? message = const $CopyWithPlaceholder(),
    Object? details = const $CopyWithPlaceholder(),
    Object? requestId = const $CopyWithPlaceholder(),
  }) {
    return ApiErrorDto(
      statusCode: statusCode == const $CopyWithPlaceholder()
          ? _value.statusCode
          // ignore: cast_nullable_to_non_nullable
          : statusCode as num,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      message: message == const $CopyWithPlaceholder()
          ? _value.message
          // ignore: cast_nullable_to_non_nullable
          : message as String,
      details: details == const $CopyWithPlaceholder()
          ? _value.details
          // ignore: cast_nullable_to_non_nullable
          : details as List<String>?,
      requestId: requestId == const $CopyWithPlaceholder()
          ? _value.requestId
          // ignore: cast_nullable_to_non_nullable
          : requestId as String?,
    );
  }
}

extension $ApiErrorDtoCopyWith on ApiErrorDto {
  /// Returns a callable class that can be used as follows: `instanceOfApiErrorDto.copyWith(...)` or like so:`instanceOfApiErrorDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ApiErrorDtoCWProxy get copyWith => _$ApiErrorDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ApiErrorDto _$ApiErrorDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ApiErrorDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['statusCode', 'code', 'message']);
      final val = ApiErrorDto(
        statusCode: $checkedConvert('statusCode', (v) => v as num),
        code: $checkedConvert('code', (v) => v as String),
        message: $checkedConvert('message', (v) => v as String),
        details: $checkedConvert(
          'details',
          (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
        ),
        requestId: $checkedConvert('requestId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$ApiErrorDtoToJson(ApiErrorDto instance) =>
    <String, dynamic>{
      'statusCode': instance.statusCode,
      'code': instance.code,
      'message': instance.message,
      if (instance.details case final value?) 'details': value,
      if (instance.requestId case final value?) 'requestId': value,
    };
