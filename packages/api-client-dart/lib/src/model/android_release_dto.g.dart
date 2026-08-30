// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'android_release_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AndroidReleaseDtoCWProxy {
  AndroidReleaseDto versionCode(num versionCode);

  AndroidReleaseDto versionName(String versionName);

  AndroidReleaseDto fileName(String fileName);

  AndroidReleaseDto fileSize(num fileSize);

  AndroidReleaseDto sha256(String sha256);

  AndroidReleaseDto signerSha256(String signerSha256);

  AndroidReleaseDto mandatory(bool mandatory);

  AndroidReleaseDto publishedAt(String publishedAt);

  AndroidReleaseDto publishedById(String? publishedById);

  AndroidReleaseDto publishedByName(String? publishedByName);

  AndroidReleaseDto notes(String? notes);

  AndroidReleaseDto withdrawnAt(String? withdrawnAt);

  AndroidReleaseDto withdrawnById(String? withdrawnById);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AndroidReleaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AndroidReleaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AndroidReleaseDto call({
    num versionCode,
    String versionName,
    String fileName,
    num fileSize,
    String sha256,
    String signerSha256,
    bool mandatory,
    String publishedAt,
    String? publishedById,
    String? publishedByName,
    String? notes,
    String? withdrawnAt,
    String? withdrawnById,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAndroidReleaseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAndroidReleaseDto.copyWith.fieldName(...)`
class _$AndroidReleaseDtoCWProxyImpl implements _$AndroidReleaseDtoCWProxy {
  const _$AndroidReleaseDtoCWProxyImpl(this._value);

  final AndroidReleaseDto _value;

  @override
  AndroidReleaseDto versionCode(num versionCode) =>
      this(versionCode: versionCode);

  @override
  AndroidReleaseDto versionName(String versionName) =>
      this(versionName: versionName);

  @override
  AndroidReleaseDto fileName(String fileName) => this(fileName: fileName);

  @override
  AndroidReleaseDto fileSize(num fileSize) => this(fileSize: fileSize);

  @override
  AndroidReleaseDto sha256(String sha256) => this(sha256: sha256);

  @override
  AndroidReleaseDto signerSha256(String signerSha256) =>
      this(signerSha256: signerSha256);

  @override
  AndroidReleaseDto mandatory(bool mandatory) => this(mandatory: mandatory);

  @override
  AndroidReleaseDto publishedAt(String publishedAt) =>
      this(publishedAt: publishedAt);

  @override
  AndroidReleaseDto publishedById(String? publishedById) =>
      this(publishedById: publishedById);

  @override
  AndroidReleaseDto publishedByName(String? publishedByName) =>
      this(publishedByName: publishedByName);

  @override
  AndroidReleaseDto notes(String? notes) => this(notes: notes);

  @override
  AndroidReleaseDto withdrawnAt(String? withdrawnAt) =>
      this(withdrawnAt: withdrawnAt);

  @override
  AndroidReleaseDto withdrawnById(String? withdrawnById) =>
      this(withdrawnById: withdrawnById);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AndroidReleaseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AndroidReleaseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AndroidReleaseDto call({
    Object? versionCode = const $CopyWithPlaceholder(),
    Object? versionName = const $CopyWithPlaceholder(),
    Object? fileName = const $CopyWithPlaceholder(),
    Object? fileSize = const $CopyWithPlaceholder(),
    Object? sha256 = const $CopyWithPlaceholder(),
    Object? signerSha256 = const $CopyWithPlaceholder(),
    Object? mandatory = const $CopyWithPlaceholder(),
    Object? publishedAt = const $CopyWithPlaceholder(),
    Object? publishedById = const $CopyWithPlaceholder(),
    Object? publishedByName = const $CopyWithPlaceholder(),
    Object? notes = const $CopyWithPlaceholder(),
    Object? withdrawnAt = const $CopyWithPlaceholder(),
    Object? withdrawnById = const $CopyWithPlaceholder(),
  }) {
    return AndroidReleaseDto(
      versionCode: versionCode == const $CopyWithPlaceholder()
          ? _value.versionCode
          // ignore: cast_nullable_to_non_nullable
          : versionCode as num,
      versionName: versionName == const $CopyWithPlaceholder()
          ? _value.versionName
          // ignore: cast_nullable_to_non_nullable
          : versionName as String,
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
      mandatory: mandatory == const $CopyWithPlaceholder()
          ? _value.mandatory
          // ignore: cast_nullable_to_non_nullable
          : mandatory as bool,
      publishedAt: publishedAt == const $CopyWithPlaceholder()
          ? _value.publishedAt
          // ignore: cast_nullable_to_non_nullable
          : publishedAt as String,
      publishedById: publishedById == const $CopyWithPlaceholder()
          ? _value.publishedById
          // ignore: cast_nullable_to_non_nullable
          : publishedById as String?,
      publishedByName: publishedByName == const $CopyWithPlaceholder()
          ? _value.publishedByName
          // ignore: cast_nullable_to_non_nullable
          : publishedByName as String?,
      notes: notes == const $CopyWithPlaceholder()
          ? _value.notes
          // ignore: cast_nullable_to_non_nullable
          : notes as String?,
      withdrawnAt: withdrawnAt == const $CopyWithPlaceholder()
          ? _value.withdrawnAt
          // ignore: cast_nullable_to_non_nullable
          : withdrawnAt as String?,
      withdrawnById: withdrawnById == const $CopyWithPlaceholder()
          ? _value.withdrawnById
          // ignore: cast_nullable_to_non_nullable
          : withdrawnById as String?,
    );
  }
}

extension $AndroidReleaseDtoCopyWith on AndroidReleaseDto {
  /// Returns a callable class that can be used as follows: `instanceOfAndroidReleaseDto.copyWith(...)` or like so:`instanceOfAndroidReleaseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AndroidReleaseDtoCWProxy get copyWith =>
      _$AndroidReleaseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AndroidReleaseDto _$AndroidReleaseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AndroidReleaseDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'versionCode',
          'versionName',
          'fileName',
          'fileSize',
          'sha256',
          'signerSha256',
          'mandatory',
          'publishedAt',
          'publishedById',
          'publishedByName',
          'notes',
          'withdrawnAt',
          'withdrawnById',
        ],
      );
      final val = AndroidReleaseDto(
        versionCode: $checkedConvert('versionCode', (v) => v as num),
        versionName: $checkedConvert('versionName', (v) => v as String),
        fileName: $checkedConvert('fileName', (v) => v as String),
        fileSize: $checkedConvert('fileSize', (v) => v as num),
        sha256: $checkedConvert('sha256', (v) => v as String),
        signerSha256: $checkedConvert('signerSha256', (v) => v as String),
        mandatory: $checkedConvert('mandatory', (v) => v as bool),
        publishedAt: $checkedConvert('publishedAt', (v) => v as String),
        publishedById: $checkedConvert('publishedById', (v) => v as String?),
        publishedByName: $checkedConvert(
          'publishedByName',
          (v) => v as String?,
        ),
        notes: $checkedConvert('notes', (v) => v as String?),
        withdrawnAt: $checkedConvert('withdrawnAt', (v) => v as String?),
        withdrawnById: $checkedConvert('withdrawnById', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$AndroidReleaseDtoToJson(AndroidReleaseDto instance) =>
    <String, dynamic>{
      'versionCode': instance.versionCode,
      'versionName': instance.versionName,
      'fileName': instance.fileName,
      'fileSize': instance.fileSize,
      'sha256': instance.sha256,
      'signerSha256': instance.signerSha256,
      'mandatory': instance.mandatory,
      'publishedAt': instance.publishedAt,
      'publishedById': instance.publishedById,
      'publishedByName': instance.publishedByName,
      'notes': instance.notes,
      'withdrawnAt': instance.withdrawnAt,
      'withdrawnById': instance.withdrawnById,
    };
