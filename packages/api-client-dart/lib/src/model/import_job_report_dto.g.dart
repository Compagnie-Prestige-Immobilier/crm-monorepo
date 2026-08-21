// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_job_report_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportJobReportDtoCWProxy {
  ImportJobReportDto kind(ImportKind kind);

  ImportJobReportDto mode(ImportMode mode);

  ImportJobReportDto totalRows(num totalRows);

  ImportJobReportDto processedRows(num processedRows);

  ImportJobReportDto createdRows(num createdRows);

  ImportJobReportDto skippedRows(num skippedRows);

  ImportJobReportDto errorRows(num errorRows);

  ImportJobReportDto truncated(bool truncated);

  ImportJobReportDto maxReportedErrors(num maxReportedErrors);

  ImportJobReportDto errors(List<ImportJobErrorDto> errors);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobReportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobReportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobReportDto call({
    ImportKind kind,
    ImportMode mode,
    num totalRows,
    num processedRows,
    num createdRows,
    num skippedRows,
    num errorRows,
    bool truncated,
    num maxReportedErrors,
    List<ImportJobErrorDto> errors,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportJobReportDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportJobReportDto.copyWith.fieldName(...)`
class _$ImportJobReportDtoCWProxyImpl implements _$ImportJobReportDtoCWProxy {
  const _$ImportJobReportDtoCWProxyImpl(this._value);

  final ImportJobReportDto _value;

  @override
  ImportJobReportDto kind(ImportKind kind) => this(kind: kind);

  @override
  ImportJobReportDto mode(ImportMode mode) => this(mode: mode);

  @override
  ImportJobReportDto totalRows(num totalRows) => this(totalRows: totalRows);

  @override
  ImportJobReportDto processedRows(num processedRows) =>
      this(processedRows: processedRows);

  @override
  ImportJobReportDto createdRows(num createdRows) =>
      this(createdRows: createdRows);

  @override
  ImportJobReportDto skippedRows(num skippedRows) =>
      this(skippedRows: skippedRows);

  @override
  ImportJobReportDto errorRows(num errorRows) => this(errorRows: errorRows);

  @override
  ImportJobReportDto truncated(bool truncated) => this(truncated: truncated);

  @override
  ImportJobReportDto maxReportedErrors(num maxReportedErrors) =>
      this(maxReportedErrors: maxReportedErrors);

  @override
  ImportJobReportDto errors(List<ImportJobErrorDto> errors) =>
      this(errors: errors);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobReportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobReportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobReportDto call({
    Object? kind = const $CopyWithPlaceholder(),
    Object? mode = const $CopyWithPlaceholder(),
    Object? totalRows = const $CopyWithPlaceholder(),
    Object? processedRows = const $CopyWithPlaceholder(),
    Object? createdRows = const $CopyWithPlaceholder(),
    Object? skippedRows = const $CopyWithPlaceholder(),
    Object? errorRows = const $CopyWithPlaceholder(),
    Object? truncated = const $CopyWithPlaceholder(),
    Object? maxReportedErrors = const $CopyWithPlaceholder(),
    Object? errors = const $CopyWithPlaceholder(),
  }) {
    return ImportJobReportDto(
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as ImportKind,
      mode: mode == const $CopyWithPlaceholder()
          ? _value.mode
          // ignore: cast_nullable_to_non_nullable
          : mode as ImportMode,
      totalRows: totalRows == const $CopyWithPlaceholder()
          ? _value.totalRows
          // ignore: cast_nullable_to_non_nullable
          : totalRows as num,
      processedRows: processedRows == const $CopyWithPlaceholder()
          ? _value.processedRows
          // ignore: cast_nullable_to_non_nullable
          : processedRows as num,
      createdRows: createdRows == const $CopyWithPlaceholder()
          ? _value.createdRows
          // ignore: cast_nullable_to_non_nullable
          : createdRows as num,
      skippedRows: skippedRows == const $CopyWithPlaceholder()
          ? _value.skippedRows
          // ignore: cast_nullable_to_non_nullable
          : skippedRows as num,
      errorRows: errorRows == const $CopyWithPlaceholder()
          ? _value.errorRows
          // ignore: cast_nullable_to_non_nullable
          : errorRows as num,
      truncated: truncated == const $CopyWithPlaceholder()
          ? _value.truncated
          // ignore: cast_nullable_to_non_nullable
          : truncated as bool,
      maxReportedErrors: maxReportedErrors == const $CopyWithPlaceholder()
          ? _value.maxReportedErrors
          // ignore: cast_nullable_to_non_nullable
          : maxReportedErrors as num,
      errors: errors == const $CopyWithPlaceholder()
          ? _value.errors
          // ignore: cast_nullable_to_non_nullable
          : errors as List<ImportJobErrorDto>,
    );
  }
}

extension $ImportJobReportDtoCopyWith on ImportJobReportDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportJobReportDto.copyWith(...)` or like so:`instanceOfImportJobReportDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportJobReportDtoCWProxy get copyWith =>
      _$ImportJobReportDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportJobReportDto _$ImportJobReportDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportJobReportDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'kind',
          'mode',
          'totalRows',
          'processedRows',
          'createdRows',
          'skippedRows',
          'errorRows',
          'truncated',
          'maxReportedErrors',
          'errors',
        ],
      );
      final val = ImportJobReportDto(
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(
            _$ImportKindEnumMap,
            v,
            unknownValue: ImportKind.unknownDefaultOpenApi,
          ),
        ),
        mode: $checkedConvert(
          'mode',
          (v) => $enumDecode(
            _$ImportModeEnumMap,
            v,
            unknownValue: ImportMode.unknownDefaultOpenApi,
          ),
        ),
        totalRows: $checkedConvert('totalRows', (v) => v as num),
        processedRows: $checkedConvert('processedRows', (v) => v as num),
        createdRows: $checkedConvert('createdRows', (v) => v as num),
        skippedRows: $checkedConvert('skippedRows', (v) => v as num),
        errorRows: $checkedConvert('errorRows', (v) => v as num),
        truncated: $checkedConvert('truncated', (v) => v as bool),
        maxReportedErrors: $checkedConvert(
          'maxReportedErrors',
          (v) => v as num,
        ),
        errors: $checkedConvert(
          'errors',
          (v) => (v as List<dynamic>)
              .map((e) => ImportJobErrorDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ImportJobReportDtoToJson(ImportJobReportDto instance) =>
    <String, dynamic>{
      'kind': _$ImportKindEnumMap[instance.kind]!,
      'mode': _$ImportModeEnumMap[instance.mode]!,
      'totalRows': instance.totalRows,
      'processedRows': instance.processedRows,
      'createdRows': instance.createdRows,
      'skippedRows': instance.skippedRows,
      'errorRows': instance.errorRows,
      'truncated': instance.truncated,
      'maxReportedErrors': instance.maxReportedErrors,
      'errors': instance.errors.map((e) => e.toJson()).toList(),
    };

const _$ImportKindEnumMap = {
  ImportKind.REPRESENTANTS: 'REPRESENTANTS',
  ImportKind.PROSPECTS: 'PROSPECTS',
  ImportKind.VISITES: 'VISITES',
  ImportKind.PROSPECTS_GRAND_PUBLIC: 'PROSPECTS_GRAND_PUBLIC',
  ImportKind.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ImportModeEnumMap = {
  ImportMode.DRY_RUN: 'DRY_RUN',
  ImportMode.APPLY: 'APPLY',
  ImportMode.unknownDefaultOpenApi: 'unknown_default_open_api',
};
