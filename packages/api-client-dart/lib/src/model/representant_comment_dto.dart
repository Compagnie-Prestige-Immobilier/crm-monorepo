//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_comment_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantCommentDto {
  /// Returns a new [RepresentantCommentDto] instance.
  RepresentantCommentDto({
    required this.id,

    required this.representantId,

    required this.authorId,

    required this.authorName,

    required this.body,

    required this.clientCreatedAt,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(name: r'authorId', required: true, includeIfNull: false)
  final String authorId;

  @JsonKey(name: r'authorName', required: true, includeIfNull: false)
  final String authorName;

  @JsonKey(name: r'body', required: true, includeIfNull: false)
  final String body;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepresentantCommentDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                representantId,
                authorId,
                authorName,
                body,
                clientCreatedAt,
                createdAt,
              ],
              [
                other.id,
                other.representantId,
                other.authorId,
                other.authorName,
                other.body,
                other.clientCreatedAt,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        representantId,
        authorId,
        authorName,
        body,
        clientCreatedAt,
        createdAt,
      ]);

  factory RepresentantCommentDto.fromJson(Map<String, dynamic> json) =>
      _$RepresentantCommentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantCommentDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
