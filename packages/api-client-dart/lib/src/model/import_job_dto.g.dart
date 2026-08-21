// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_job_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportJobDtoCWProxy {
  ImportJobDto id(String id);

  ImportJobDto kind(ImportKind kind);

  ImportJobDto status(ImportStatus status);

  ImportJobDto mode(ImportMode mode);

  ImportJobDto requestedById(String requestedById);

  ImportJobDto fileName(String fileName);

  ImportJobDto fileBytes(num fileBytes);

  ImportJobDto totalRows(num? totalRows);

  ImportJobDto processedRows(num processedRows);

  ImportJobDto createdRows(num createdRows);

  ImportJobDto skippedRows(num skippedRows);

  ImportJobDto errorRows(num errorRows);

  ImportJobDto report(ImportJobReportDto? report);

  ImportJobDto failureCode(String? failureCode);

  ImportJobDto failureMsg(String? failureMsg);

  ImportJobDto startedAt(DateTime? startedAt);

  ImportJobDto finishedAt(DateTime? finishedAt);

  ImportJobDto expiresAt(DateTime expiresAt);

  ImportJobDto createdAt(DateTime createdAt);

  ImportJobDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobDto call({
    String id,
    ImportKind kind,
    ImportStatus status,
    ImportMode mode,
    String requestedById,
    String fileName,
    num fileBytes,
    num? totalRows,
    num processedRows,
    num createdRows,
    num skippedRows,
    num errorRows,
    ImportJobReportDto? report,
    String? failureCode,
    String? failureMsg,
    DateTime? startedAt,
    DateTime? finishedAt,
    DateTime expiresAt,
    DateTime createdAt,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportJobDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportJobDto.copyWith.fieldName(...)`
class _$ImportJobDtoCWProxyImpl implements _$ImportJobDtoCWProxy {
  const _$ImportJobDtoCWProxyImpl(this._value);

  final ImportJobDto _value;

  @override
  ImportJobDto id(String id) => this(id: id);

  @override
  ImportJobDto kind(ImportKind kind) => this(kind: kind);

  @override
  ImportJobDto status(ImportStatus status) => this(status: status);

  @override
  ImportJobDto mode(ImportMode mode) => this(mode: mode);

  @override
  ImportJobDto requestedById(String requestedById) =>
      this(requestedById: requestedById);

  @override
  ImportJobDto fileName(String fileName) => this(fileName: fileName);

  @override
  ImportJobDto fileBytes(num fileBytes) => this(fileBytes: fileBytes);

  @override
  ImportJobDto totalRows(num? totalRows) => this(totalRows: totalRows);

  @override
  ImportJobDto processedRows(num processedRows) =>
      this(processedRows: processedRows);

  @override
  ImportJobDto createdRows(num createdRows) => this(createdRows: createdRows);

  @override
  ImportJobDto skippedRows(num skippedRows) => this(skippedRows: skippedRows);

  @override
  ImportJobDto errorRows(num errorRows) => this(errorRows: errorRows);

  @override
  ImportJobDto report(ImportJobReportDto? report) => this(report: report);

  @override
  ImportJobDto failureCode(String? failureCode) =>
      this(failureCode: failureCode);

  @override
  ImportJobDto failureMsg(String? failureMsg) => this(failureMsg: failureMsg);

  @override
  ImportJobDto startedAt(DateTime? startedAt) => this(startedAt: startedAt);

  @override
  ImportJobDto finishedAt(DateTime? finishedAt) => this(finishedAt: finishedAt);

  @override
  ImportJobDto expiresAt(DateTime expiresAt) => this(expiresAt: expiresAt);

  @override
  ImportJobDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  ImportJobDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? mode = const $CopyWithPlaceholder(),
    Object? requestedById = const $CopyWithPlaceholder(),
    Object? fileName = const $CopyWithPlaceholder(),
    Object? fileBytes = const $CopyWithPlaceholder(),
    Object? totalRows = const $CopyWithPlaceholder(),
    Object? processedRows = const $CopyWithPlaceholder(),
    Object? createdRows = const $CopyWithPlaceholder(),
    Object? skippedRows = const $CopyWithPlaceholder(),
    Object? errorRows = const $CopyWithPlaceholder(),
    Object? report = const $CopyWithPlaceholder(),
    Object? failureCode = const $CopyWithPlaceholder(),
    Object? failureMsg = const $CopyWithPlaceholder(),
    Object? startedAt = const $CopyWithPlaceholder(),
    Object? finishedAt = const $CopyWithPlaceholder(),
    Object? expiresAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return ImportJobDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as ImportKind,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as ImportStatus,
      mode: mode == const $CopyWithPlaceholder()
          ? _value.mode
          // ignore: cast_nullable_to_non_nullable
          : mode as ImportMode,
      requestedById: requestedById == const $CopyWithPlaceholder()
          ? _value.requestedById
          // ignore: cast_nullable_to_non_nullable
          : requestedById as String,
      fileName: fileName == const $CopyWithPlaceholder()
          ? _value.fileName
          // ignore: cast_nullable_to_non_nullable
          : fileName as String,
      fileBytes: fileBytes == const $CopyWithPlaceholder()
          ? _value.fileBytes
          // ignore: cast_nullable_to_non_nullable
          : fileBytes as num,
      totalRows: totalRows == const $CopyWithPlaceholder()
          ? _value.totalRows
          // ignore: cast_nullable_to_non_nullable
          : totalRows as num?,
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
      report: report == const $CopyWithPlaceholder()
          ? _value.report
          // ignore: cast_nullable_to_non_nullable
          : report as ImportJobReportDto?,
      failureCode: failureCode == const $CopyWithPlaceholder()
          ? _value.failureCode
          // ignore: cast_nullable_to_non_nullable
          : failureCode as String?,
      failureMsg: failureMsg == const $CopyWithPlaceholder()
          ? _value.failureMsg
          // ignore: cast_nullable_to_non_nullable
          : failureMsg as String?,
      startedAt: startedAt == const $CopyWithPlaceholder()
          ? _value.startedAt
          // ignore: cast_nullable_to_non_nullable
          : startedAt as DateTime?,
      finishedAt: finishedAt == const $CopyWithPlaceholder()
          ? _value.finishedAt
          // ignore: cast_nullable_to_non_nullable
          : finishedAt as DateTime?,
      expiresAt: expiresAt == const $CopyWithPlaceholder()
          ? _value.expiresAt
          // ignore: cast_nullable_to_non_nullable
          : expiresAt as DateTime,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $ImportJobDtoCopyWith on ImportJobDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportJobDto.copyWith(...)` or like so:`instanceOfImportJobDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportJobDtoCWProxy get copyWith => _$ImportJobDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportJobDto _$ImportJobDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ImportJobDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'kind',
      'status',
      'mode',
      'requestedById',
      'fileName',
      'fileBytes',
      'totalRows',
      'processedRows',
      'createdRows',
      'skippedRows',
      'errorRows',
      'report',
      'failureCode',
      'failureMsg',
      'startedAt',
      'finishedAt',
      'expiresAt',
      'createdAt',
      'updatedAt',
    ],
  );
  final val = ImportJobDto(
    id: $checkedConvert('id', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$ImportKindEnumMap,
        v,
        unknownValue: ImportKind.unknownDefaultOpenApi,
      ),
    ),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$ImportStatusEnumMap,
        v,
        unknownValue: ImportStatus.unknownDefaultOpenApi,
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
    requestedById: $checkedConvert('requestedById', (v) => v as String),
    fileName: $checkedConvert('fileName', (v) => v as String),
    fileBytes: $checkedConvert('fileBytes', (v) => v as num),
    totalRows: $checkedConvert('totalRows', (v) => v as num?),
    processedRows: $checkedConvert('processedRows', (v) => v as num),
    createdRows: $checkedConvert('createdRows', (v) => v as num),
    skippedRows: $checkedConvert('skippedRows', (v) => v as num),
    errorRows: $checkedConvert('errorRows', (v) => v as num),
    report: $checkedConvert(
      'report',
      (v) => v == null
          ? null
          : ImportJobReportDto.fromJson(v as Map<String, dynamic>),
    ),
    failureCode: $checkedConvert('failureCode', (v) => v as String?),
    failureMsg: $checkedConvert('failureMsg', (v) => v as String?),
    startedAt: $checkedConvert(
      'startedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    finishedAt: $checkedConvert(
      'finishedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    expiresAt: $checkedConvert('expiresAt', (v) => DateTime.parse(v as String)),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$ImportJobDtoToJson(ImportJobDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': _$ImportKindEnumMap[instance.kind]!,
      'status': _$ImportStatusEnumMap[instance.status]!,
      'mode': _$ImportModeEnumMap[instance.mode]!,
      'requestedById': instance.requestedById,
      'fileName': instance.fileName,
      'fileBytes': instance.fileBytes,
      'totalRows': instance.totalRows,
      'processedRows': instance.processedRows,
      'createdRows': instance.createdRows,
      'skippedRows': instance.skippedRows,
      'errorRows': instance.errorRows,
      'report': instance.report?.toJson(),
      'failureCode': instance.failureCode,
      'failureMsg': instance.failureMsg,
      'startedAt': instance.startedAt?.toIso8601String(),
      'finishedAt': instance.finishedAt?.toIso8601String(),
      'expiresAt': instance.expiresAt.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$ImportKindEnumMap = {
  ImportKind.REPRESENTANTS: 'REPRESENTANTS',
  ImportKind.PROSPECTS: 'PROSPECTS',
  ImportKind.VISITES: 'VISITES',
  ImportKind.PROSPECTS_GRAND_PUBLIC: 'PROSPECTS_GRAND_PUBLIC',
  ImportKind.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ImportStatusEnumMap = {
  ImportStatus.queued: 'queued',
  ImportStatus.running: 'running',
  ImportStatus.succeeded: 'succeeded',
  ImportStatus.failed: 'failed',
  ImportStatus.expired: 'expired',
  ImportStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ImportModeEnumMap = {
  ImportMode.DRY_RUN: 'DRY_RUN',
  ImportMode.APPLY: 'APPLY',
  ImportMode.unknownDefaultOpenApi: 'unknown_default_open_api',
};
