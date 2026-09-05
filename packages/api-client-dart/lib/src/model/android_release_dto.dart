//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'android_release_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AndroidReleaseDto {
  /// Returns a new [AndroidReleaseDto] instance.
  AndroidReleaseDto({
    required this.versionCode,

    required this.versionName,

    required this.fileName,

    required this.fileSize,

    required this.sha256,

    required this.signerSha256,

    required this.mandatory,

    required this.publishedAt,

    required this.publishedById,

    required this.publishedByName,

    required this.notes,

    required this.withdrawnAt,

    required this.withdrawnById,
  });

  @JsonKey(name: r'versionCode', required: true, includeIfNull: false)
  final num versionCode;

  @JsonKey(name: r'versionName', required: true, includeIfNull: false)
  final String versionName;

  @JsonKey(name: r'fileName', required: true, includeIfNull: false)
  final String fileName;

  @JsonKey(name: r'fileSize', required: true, includeIfNull: false)
  final num fileSize;

  @JsonKey(name: r'sha256', required: true, includeIfNull: false)
  final String sha256;

  @JsonKey(name: r'signerSha256', required: true, includeIfNull: false)
  final String signerSha256;

  @JsonKey(name: r'mandatory', required: true, includeIfNull: false)
  final bool mandatory;

  @JsonKey(name: r'publishedAt', required: true, includeIfNull: false)
  final String publishedAt;

  @JsonKey(name: r'publishedById', required: true, includeIfNull: true)
  final String? publishedById;

  @JsonKey(name: r'publishedByName', required: true, includeIfNull: true)
  final String? publishedByName;

  @JsonKey(name: r'notes', required: true, includeIfNull: true)
  final String? notes;

  @JsonKey(name: r'withdrawnAt', required: true, includeIfNull: true)
  final String? withdrawnAt;

  @JsonKey(name: r'withdrawnById', required: true, includeIfNull: true)
  final String? withdrawnById;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AndroidReleaseDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                versionCode,
                versionName,
                fileName,
                fileSize,
                sha256,
                signerSha256,
                mandatory,
                publishedAt,
                publishedById,
                publishedByName,
                notes,
                withdrawnAt,
                withdrawnById,
              ],
              [
                other.versionCode,
                other.versionName,
                other.fileName,
                other.fileSize,
                other.sha256,
                other.signerSha256,
                other.mandatory,
                other.publishedAt,
                other.publishedById,
                other.publishedByName,
                other.notes,
                other.withdrawnAt,
                other.withdrawnById,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        versionCode,
        versionName,
        fileName,
        fileSize,
        sha256,
        signerSha256,
        mandatory,
        publishedAt,
        publishedById,
        publishedByName,
        notes,
        withdrawnAt,
        withdrawnById,
      ]);

  factory AndroidReleaseDto.fromJson(Map<String, dynamic> json) =>
      _$AndroidReleaseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AndroidReleaseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
