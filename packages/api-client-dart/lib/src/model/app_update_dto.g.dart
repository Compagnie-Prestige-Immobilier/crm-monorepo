// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_update_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AppUpdateDtoCWProxy {
  AppUpdateDto available(bool available);

  AppUpdateDto forceUpdate(bool forceUpdate);

  AppUpdateDto versionName(String versionName);

  AppUpdateDto versionCode(num versionCode);

  AppUpdateDto fileName(String fileName);

  AppUpdateDto fileSize(num fileSize);

  AppUpdateDto sha256(String sha256);

  AppUpdateDto signerSha256(String signerSha256);

  AppUpdateDto downloadUrl(String downloadUrl);

  AppUpdateDto publishedAt(String publishedAt);

  AppUpdateDto minVersionCode(num? minVersionCode);

  AppUpdateDto notes(String? notes);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AppUpdateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AppUpdateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AppUpdateDto call({
    bool available,
    bool forceUpdate,
    String versionName,
    num versionCode,
    String fileName,
    num fileSize,
    String sha256,
    String signerSha256,
    String downloadUrl,
    String publishedAt,
    num? minVersionCode,
    String? notes,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAppUpdateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAppUpdateDto.copyWith.fieldName(...)`
class _$AppUpdateDtoCWProxyImpl implements _$AppUpdateDtoCWProxy {
  const _$AppUpdateDtoCWProxyImpl(this._value);

  final AppUpdateDto _value;

  @override
  AppUpdateDto available(bool available) => this(available: available);

  @override
  AppUpdateDto forceUpdate(bool forceUpdate) => this(forceUpdate: forceUpdate);

  @override
  AppUpdateDto versionName(String versionName) =>
      this(versionName: versionName);

  @override
  AppUpdateDto versionCode(num versionCode) => this(versionCode: versionCode);

  @override
  AppUpdateDto fileName(String fileName) => this(fileName: fileName);

  @override
  AppUpdateDto fileSize(num fileSize) => this(fileSize: fileSize);

  @override
  AppUpdateDto sha256(String sha256) => this(sha256: sha256);

  @override
  AppUpdateDto signerSha256(String signerSha256) =>
      this(signerSha256: signerSha256);

  @override
  AppUpdateDto downloadUrl(String downloadUrl) =>
      this(downloadUrl: downloadUrl);

  @override
  AppUpdateDto publishedAt(String publishedAt) =>
      this(publishedAt: publishedAt);

  @override
  AppUpdateDto minVersionCode(num? minVersionCode) =>
      this(minVersionCode: minVersionCode);

  @override
  AppUpdateDto notes(String? notes) => this(notes: notes);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AppUpdateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AppUpdateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AppUpdateDto call({
    Object? available = const $CopyWithPlaceholder(),
    Object? forceUpdate = const $CopyWithPlaceholder(),
    Object? versionName = const $CopyWithPlaceholder(),
    Object? versionCode = const $CopyWithPlaceholder(),
    Object? fileName = const $CopyWithPlaceholder(),
    Object? fileSize = const $CopyWithPlaceholder(),
    Object? sha256 = const $CopyWithPlaceholder(),
    Object? signerSha256 = const $CopyWithPlaceholder(),
    Object? downloadUrl = const $CopyWithPlaceholder(),
    Object? publishedAt = const $CopyWithPlaceholder(),
    Object? minVersionCode = const $CopyWithPlaceholder(),
    Object? notes = const $CopyWithPlaceholder(),
  }) {
    return AppUpdateDto(
      available: available == const $CopyWithPlaceholder()
          ? _value.available
          // ignore: cast_nullable_to_non_nullable
          : available as bool,
      forceUpdate: forceUpdate == const $CopyWithPlaceholder()
          ? _value.forceUpdate
          // ignore: cast_nullable_to_non_nullable
          : forceUpdate as bool,
      versionName: versionName == const $CopyWithPlaceholder()
          ? _value.versionName
          // ignore: cast_nullable_to_non_nullable
          : versionName as String,
      versionCode: versionCode == const $CopyWithPlaceholder()
          ? _value.versionCode
          // ignore: cast_nullable_to_non_nullable
          : versionCode as num,
      fileName: fileName == const $CopyWithPlaceholder()
          ? _value.fileName
          // ignore: cast_nullable_to_non_nullable
          : fileName as String,
      fileSize: fileSize == const $CopyWithPlaceholder()
          ? _value.fileSize
          // ignore: cast_nullable_to_non_nullable
          : fileSize as num,
      sha256: sha256 == const $CopyWithPlaceholder()
          ? _value.sha256
          // ignore: cast_nullable_to_non_nullable
          : sha256 as String,
      signerSha256: signerSha256 == const $CopyWithPlaceholder()
          ? _value.signerSha256
          // ignore: cast_nullable_to_non_nullable
          : signerSha256 as String,
      downloadUrl: downloadUrl == const $CopyWithPlaceholder()
          ? _value.downloadUrl
          // ignore: cast_nullable_to_non_nullable
          : downloadUrl as String,
      publishedAt: publishedAt == const $CopyWithPlaceholder()
          ? _value.publishedAt
          // ignore: cast_nullable_to_non_nullable
          : publishedAt as String,
      minVersionCode: minVersionCode == const $CopyWithPlaceholder()
          ? _value.minVersionCode
          // ignore: cast_nullable_to_non_nullable
          : minVersionCode as num?,
      notes: notes == const $CopyWithPlaceholder()
          ? _value.notes
          // ignore: cast_nullable_to_non_nullable
          : notes as String?,
    );
  }
}

extension $AppUpdateDtoCopyWith on AppUpdateDto {
  /// Returns a callable class that can be used as follows: `instanceOfAppUpdateDto.copyWith(...)` or like so:`instanceOfAppUpdateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AppUpdateDtoCWProxy get copyWith => _$AppUpdateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AppUpdateDto _$AppUpdateDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AppUpdateDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'available',
          'forceUpdate',
          'versionName',
          'versionCode',
          'fileName',
          'fileSize',
          'sha256',
          'signerSha256',
          'downloadUrl',
          'publishedAt',
          'minVersionCode',
          'notes',
        ],
      );
      final val = AppUpdateDto(
        available: $checkedConvert('available', (v) => v as bool),
        forceUpdate: $checkedConvert('forceUpdate', (v) => v as bool),
        versionName: $checkedConvert('versionName', (v) => v as String),
        versionCode: $checkedConvert('versionCode', (v) => v as num),
        fileName: $checkedConvert('fileName', (v) => v as String),
        fileSize: $checkedConvert('fileSize', (v) => v as num),
        sha256: $checkedConvert('sha256', (v) => v as String),
        signerSha256: $checkedConvert('signerSha256', (v) => v as String),
        downloadUrl: $checkedConvert('downloadUrl', (v) => v as String),
        publishedAt: $checkedConvert('publishedAt', (v) => v as String),
        minVersionCode: $checkedConvert('minVersionCode', (v) => v as num?),
        notes: $checkedConvert('notes', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$AppUpdateDtoToJson(AppUpdateDto instance) =>
    <String, dynamic>{
      'available': instance.available,
      'forceUpdate': instance.forceUpdate,
      'versionName': instance.versionName,
      'versionCode': instance.versionCode,
      'fileName': instance.fileName,
      'fileSize': instance.fileSize,
      'sha256': instance.sha256,
      'signerSha256': instance.signerSha256,
      'downloadUrl': instance.downloadUrl,
      'publishedAt': instance.publishedAt,
      'minVersionCode': instance.minVersionCode,
      'notes': instance.notes,
    };
