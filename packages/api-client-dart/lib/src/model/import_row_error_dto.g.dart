// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_row_error_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportRowErrorDtoCWProxy {
  ImportRowErrorDto line(num line);

  ImportRowErrorDto code(String code);

  ImportRowErrorDto message(String message);

  ImportRowErrorDto value(String? value);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportRowErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportRowErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportRowErrorDto call({
    num line,
    String code,
    String message,
    String? value,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportRowErrorDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportRowErrorDto.copyWith.fieldName(...)`
class _$ImportRowErrorDtoCWProxyImpl implements _$ImportRowErrorDtoCWProxy {
  const _$ImportRowErrorDtoCWProxyImpl(this._value);

  final ImportRowErrorDto _value;

  @override
  ImportRowErrorDto line(num line) => this(line: line);

  @override
  ImportRowErrorDto code(String code) => this(code: code);

  @override
  ImportRowErrorDto message(String message) => this(message: message);

  @override
  ImportRowErrorDto value(String? value) => this(value: value);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportRowErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportRowErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportRowErrorDto call({
    Object? line = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? message = const $CopyWithPlaceholder(),
    Object? value = const $CopyWithPlaceholder(),
  }) {
    return ImportRowErrorDto(
      line: line == const $CopyWithPlaceholder()
          ? _value.line
          // ignore: cast_nullable_to_non_nullable
          : line as num,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      message: message == const $CopyWithPlaceholder()
          ? _value.message
          // ignore: cast_nullable_to_non_nullable
          : message as String,
      value: value == const $CopyWithPlaceholder()
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as String?,
    );
  }
}

extension $ImportRowErrorDtoCopyWith on ImportRowErrorDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportRowErrorDto.copyWith(...)` or like so:`instanceOfImportRowErrorDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportRowErrorDtoCWProxy get copyWith =>
      _$ImportRowErrorDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportRowErrorDto _$ImportRowErrorDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportRowErrorDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['line', 'code', 'message', 'value'],
      );
      final val = ImportRowErrorDto(
        line: $checkedConvert('line', (v) => v as num),
        code: $checkedConvert('code', (v) => v as String),
        message: $checkedConvert('message', (v) => v as String),
        value: $checkedConvert('value', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$ImportRowErrorDtoToJson(ImportRowErrorDto instance) =>
    <String, dynamic>{
      'line': instance.line,
      'code': instance.code,
      'message': instance.message,
      'value': instance.value,
    };
