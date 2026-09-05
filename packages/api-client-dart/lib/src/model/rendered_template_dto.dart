//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'rendered_template_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RenderedTemplateDto {
  /// Returns a new [RenderedTemplateDto] instance.
  RenderedTemplateDto({
    required this.title,

    required this.body,

    required this.missing,
  });

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  @JsonKey(name: r'body', required: true, includeIfNull: false)
  final String body;

  /// Variables citées et non fournies. Le marqueur `{{nom}}` reste visible dans le texte rendu.
  @JsonKey(name: r'missing', required: true, includeIfNull: false)
  final List<String> missing;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RenderedTemplateDto &&
            runtimeType == other.runtimeType &&
            equals(
              [title, body, missing],
              [other.title, other.body, other.missing],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([title, body, missing]);

  factory RenderedTemplateDto.fromJson(Map<String, dynamic> json) =>
      _$RenderedTemplateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RenderedTemplateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
