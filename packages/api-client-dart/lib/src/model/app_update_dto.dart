//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'app_update_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AppUpdateDto {
  /// Returns a new [AppUpdateDto] instance.
  AppUpdateDto({
    required this.available,

    required this.forceUpdate,

    required this.versionName,

    required this.versionCode,

    required this.fileName,

    required this.fileSize,

    required this.sha256,

    required this.signerSha256,

    required this.downloadUrl,

    required this.publishedAt,

    required this.minVersionCode,

    required this.notes,
  });

  @JsonKey(name: r'available', required: true, includeIfNull: false)
  final bool available;

  /// Le poste est sous le plancher obligatoire.
  @JsonKey(name: r'forceUpdate', required: true, includeIfNull: false)
  final bool forceUpdate;

  @JsonKey(name: r'versionName', required: true, includeIfNull: false)
  final String versionName;

  @JsonKey(name: r'versionCode', required: true, includeIfNull: false)
  final num versionCode;

  @JsonKey(name: r'fileName', required: true, includeIfNull: false)
  final String fileName;

  @JsonKey(name: r'fileSize', required: true, includeIfNull: false)
  final num fileSize;

  @JsonKey(name: r'sha256', required: true, includeIfNull: false)
  final String sha256;

  /// Empreinte SHA-256 du certificat signataire de l’APK servi.
  @JsonKey(name: r'signerSha256', required: true, includeIfNull: false)
  final String signerSha256;

  @JsonKey(name: r'downloadUrl', required: true, includeIfNull: false)
  final String downloadUrl;

  @JsonKey(name: r'publishedAt', required: true, includeIfNull: false)
  final String publishedAt;

  /// Plus haut versionCode obligatoire encore en ligne, ou null.
  @JsonKey(name: r'minVersionCode', required: true, includeIfNull: true)
  final num? minVersionCode;

  @JsonKey(name: r'notes', required: true, includeIfNull: true)
  final String? notes;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AppUpdateDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                available,
                forceUpdate,
                versionName,
                versionCode,
                fileName,
                fileSize,
                sha256,
                signerSha256,
                downloadUrl,
                publishedAt,
                minVersionCode,
                notes,
              ],
              [
                other.available,
                other.forceUpdate,
                other.versionName,
                other.versionCode,
                other.fileName,
                other.fileSize,
                other.sha256,
                other.signerSha256,
                other.downloadUrl,
                other.publishedAt,
                other.minVersionCode,
                other.notes,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        available,
        forceUpdate,
        versionName,
        versionCode,
        fileName,
        fileSize,
        sha256,
        signerSha256,
        downloadUrl,
        publishedAt,
        minVersionCode,
        notes,
      ]);

  factory AppUpdateDto.fromJson(Map<String, dynamic> json) =>
      _$AppUpdateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AppUpdateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
