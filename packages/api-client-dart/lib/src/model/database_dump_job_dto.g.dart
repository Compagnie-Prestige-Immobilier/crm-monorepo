// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database_dump_job_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DatabaseDumpJobDtoCWProxy {
  DatabaseDumpJobDto id(String? id);

  DatabaseDumpJobDto status(DatabaseDumpJobDtoStatusEnum status);

  DatabaseDumpJobDto requestedByName(String? requestedByName);

  DatabaseDumpJobDto requestedAt(DateTime? requestedAt);

  DatabaseDumpJobDto finishedAt(DateTime? finishedAt);

  DatabaseDumpJobDto fileSize(num? fileSize);

  DatabaseDumpJobDto sha256(String? sha256);

  DatabaseDumpJobDto expiresAt(DateTime? expiresAt);

  DatabaseDumpJobDto failureReason(String? failureReason);

  DatabaseDumpJobDto noticeStatus(String? noticeStatus);

  DatabaseDumpJobDto noticeDetail(String? noticeDetail);

  DatabaseDumpJobDto downloadable(bool downloadable);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DatabaseDumpJobDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DatabaseDumpJobDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DatabaseDumpJobDto call({
    String? id,
    DatabaseDumpJobDtoStatusEnum status,
    String? requestedByName,
    DateTime? requestedAt,
    DateTime? finishedAt,
    num? fileSize,
    String? sha256,
    DateTime? expiresAt,
    String? failureReason,
    String? noticeStatus,
    String? noticeDetail,
    bool downloadable,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDatabaseDumpJobDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDatabaseDumpJobDto.copyWith.fieldName(...)`
class _$DatabaseDumpJobDtoCWProxyImpl implements _$DatabaseDumpJobDtoCWProxy {
  const _$DatabaseDumpJobDtoCWProxyImpl(this._value);

  final DatabaseDumpJobDto _value;

  @override
  DatabaseDumpJobDto id(String? id) => this(id: id);

  @override
  DatabaseDumpJobDto status(DatabaseDumpJobDtoStatusEnum status) =>
      this(status: status);

  @override
  DatabaseDumpJobDto requestedByName(String? requestedByName) =>
      this(requestedByName: requestedByName);

  @override
  DatabaseDumpJobDto requestedAt(DateTime? requestedAt) =>
      this(requestedAt: requestedAt);

  @override
  DatabaseDumpJobDto finishedAt(DateTime? finishedAt) =>
      this(finishedAt: finishedAt);

  @override
  DatabaseDumpJobDto fileSize(num? fileSize) => this(fileSize: fileSize);

  @override
  DatabaseDumpJobDto sha256(String? sha256) => this(sha256: sha256);

  @override
  DatabaseDumpJobDto expiresAt(DateTime? expiresAt) =>
      this(expiresAt: expiresAt);

  @override
  DatabaseDumpJobDto failureReason(String? failureReason) =>
      this(failureReason: failureReason);

  @override
  DatabaseDumpJobDto noticeStatus(String? noticeStatus) =>
      this(noticeStatus: noticeStatus);

  @override
  DatabaseDumpJobDto noticeDetail(String? noticeDetail) =>
      this(noticeDetail: noticeDetail);

  @override
  DatabaseDumpJobDto downloadable(bool downloadable) =>
      this(downloadable: downloadable);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DatabaseDumpJobDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DatabaseDumpJobDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DatabaseDumpJobDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? requestedByName = const $CopyWithPlaceholder(),
    Object? requestedAt = const $CopyWithPlaceholder(),
    Object? finishedAt = const $CopyWithPlaceholder(),
    Object? fileSize = const $CopyWithPlaceholder(),
    Object? sha256 = const $CopyWithPlaceholder(),
    Object? expiresAt = const $CopyWithPlaceholder(),
    Object? failureReason = const $CopyWithPlaceholder(),
    Object? noticeStatus = const $CopyWithPlaceholder(),
    Object? noticeDetail = const $CopyWithPlaceholder(),
    Object? downloadable = const $CopyWithPlaceholder(),
  }) {
    return DatabaseDumpJobDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as DatabaseDumpJobDtoStatusEnum,
      requestedByName: requestedByName == const $CopyWithPlaceholder()
          ? _value.requestedByName
          // ignore: cast_nullable_to_non_nullable
          : requestedByName as String?,
      requestedAt: requestedAt == const $CopyWithPlaceholder()
          ? _value.requestedAt
          // ignore: cast_nullable_to_non_nullable
          : requestedAt as DateTime?,
      finishedAt: finishedAt == const $CopyWithPlaceholder()
          ? _value.finishedAt
          // ignore: cast_nullable_to_non_nullable
          : finishedAt as DateTime?,
      fileSize: fileSize == const $CopyWithPlaceholder()
          ? _value.fileSize
          // ignore: cast_nullable_to_non_nullable
          : fileSize as num?,
      sha256: sha256 == const $CopyWithPlaceholder()
          ? _value.sha256
          // ignore: cast_nullable_to_non_nullable
          : sha256 as String?,
      expiresAt: expiresAt == const $CopyWithPlaceholder()
          ? _value.expiresAt
          // ignore: cast_nullable_to_non_nullable
          : expiresAt as DateTime?,
      failureReason: failureReason == const $CopyWithPlaceholder()
          ? _value.failureReason
          // ignore: cast_nullable_to_non_nullable
          : failureReason as String?,
      noticeStatus: noticeStatus == const $CopyWithPlaceholder()
          ? _value.noticeStatus
          // ignore: cast_nullable_to_non_nullable
          : noticeStatus as String?,
      noticeDetail: noticeDetail == const $CopyWithPlaceholder()
          ? _value.noticeDetail
          // ignore: cast_nullable_to_non_nullable
          : noticeDetail as String?,
      downloadable: downloadable == const $CopyWithPlaceholder()
          ? _value.downloadable
          // ignore: cast_nullable_to_non_nullable
          : downloadable as bool,
    );
  }
}

extension $DatabaseDumpJobDtoCopyWith on DatabaseDumpJobDto {
  /// Returns a callable class that can be used as follows: `instanceOfDatabaseDumpJobDto.copyWith(...)` or like so:`instanceOfDatabaseDumpJobDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DatabaseDumpJobDtoCWProxy get copyWith =>
      _$DatabaseDumpJobDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DatabaseDumpJobDto _$DatabaseDumpJobDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DatabaseDumpJobDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'status',
          'requestedByName',
          'requestedAt',
          'finishedAt',
          'fileSize',
          'sha256',
          'expiresAt',
          'failureReason',
          'noticeStatus',
          'noticeDetail',
          'downloadable',
        ],
      );
      final val = DatabaseDumpJobDto(
        id: $checkedConvert('id', (v) => v as String?),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$DatabaseDumpJobDtoStatusEnumEnumMap,
            v,
            unknownValue: DatabaseDumpJobDtoStatusEnum.unknownDefaultOpenApi,
          ),
        ),
        requestedByName: $checkedConvert(
          'requestedByName',
          (v) => v as String?,
        ),
        requestedAt: $checkedConvert(
          'requestedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        finishedAt: $checkedConvert(
          'finishedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        fileSize: $checkedConvert('fileSize', (v) => v as num?),
        sha256: $checkedConvert('sha256', (v) => v as String?),
        expiresAt: $checkedConvert(
          'expiresAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        failureReason: $checkedConvert('failureReason', (v) => v as String?),
        noticeStatus: $checkedConvert('noticeStatus', (v) => v as String?),
        noticeDetail: $checkedConvert('noticeDetail', (v) => v as String?),
        downloadable: $checkedConvert('downloadable', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$DatabaseDumpJobDtoToJson(DatabaseDumpJobDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$DatabaseDumpJobDtoStatusEnumEnumMap[instance.status]!,
      'requestedByName': instance.requestedByName,
      'requestedAt': instance.requestedAt?.toIso8601String(),
      'finishedAt': instance.finishedAt?.toIso8601String(),
      'fileSize': instance.fileSize,
      'sha256': instance.sha256,
      'expiresAt': instance.expiresAt?.toIso8601String(),
      'failureReason': instance.failureReason,
      'noticeStatus': instance.noticeStatus,
      'noticeDetail': instance.noticeDetail,
      'downloadable': instance.downloadable,
    };

const _$DatabaseDumpJobDtoStatusEnumEnumMap = {
  DatabaseDumpJobDtoStatusEnum.idle: 'idle',
  DatabaseDumpJobDtoStatusEnum.queued: 'queued',
  DatabaseDumpJobDtoStatusEnum.running: 'running',
  DatabaseDumpJobDtoStatusEnum.ready: 'ready',
  DatabaseDumpJobDtoStatusEnum.failed: 'failed',
  DatabaseDumpJobDtoStatusEnum.expired: 'expired',
  DatabaseDumpJobDtoStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
