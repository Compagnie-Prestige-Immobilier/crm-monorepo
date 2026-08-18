// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_job_error_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportJobErrorDtoCWProxy {
  ImportJobErrorDto rowNumber(num rowNumber);

  ImportJobErrorDto column(String? column);

  ImportJobErrorDto code(String code);

  ImportJobErrorDto message(String message);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobErrorDto call({
    num rowNumber,
    String? column,
    String code,
    String message,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportJobErrorDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportJobErrorDto.copyWith.fieldName(...)`
class _$ImportJobErrorDtoCWProxyImpl implements _$ImportJobErrorDtoCWProxy {
  const _$ImportJobErrorDtoCWProxyImpl(this._value);

  final ImportJobErrorDto _value;

  @override
  ImportJobErrorDto rowNumber(num rowNumber) => this(rowNumber: rowNumber);

  @override
  ImportJobErrorDto column(String? column) => this(column: column);

  @override
  ImportJobErrorDto code(String code) => this(code: code);

  @override
  ImportJobErrorDto message(String message) => this(message: message);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobErrorDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobErrorDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobErrorDto call({
    Object? rowNumber = const $CopyWithPlaceholder(),
    Object? column = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? message = const $CopyWithPlaceholder(),
  }) {
    return ImportJobErrorDto(
      rowNumber: rowNumber == const $CopyWithPlaceholder()
          ? _value.rowNumber
          // ignore: cast_nullable_to_non_nullable
          : rowNumber as num,
      column: column == const $CopyWithPlaceholder()
          ? _value.column
          // ignore: cast_nullable_to_non_nullable
          : column as String?,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      message: message == const $CopyWithPlaceholder()
          ? _value.message
          // ignore: cast_nullable_to_non_nullable
          : message as String,
    );
  }
}

extension $ImportJobErrorDtoCopyWith on ImportJobErrorDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportJobErrorDto.copyWith(...)` or like so:`instanceOfImportJobErrorDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportJobErrorDtoCWProxy get copyWith =>
      _$ImportJobErrorDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportJobErrorDto _$ImportJobErrorDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportJobErrorDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['rowNumber', 'column', 'code', 'message'],
      );
      final val = ImportJobErrorDto(
        rowNumber: $checkedConvert('rowNumber', (v) => v as num),
        column: $checkedConvert('column', (v) => v as String?),
        code: $checkedConvert('code', (v) => v as String),
        message: $checkedConvert('message', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ImportJobErrorDtoToJson(ImportJobErrorDto instance) =>
    <String, dynamic>{
      'rowNumber': instance.rowNumber,
      'column': instance.column,
      'code': instance.code,
      'message': instance.message,
    };
