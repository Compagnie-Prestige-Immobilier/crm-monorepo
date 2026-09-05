//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'render_template_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RenderTemplateDto {
  /// Returns a new [RenderTemplateDto] instance.
  RenderTemplateDto({required this.variables});

  /// Couples `{ variable: valeur }`.
  @JsonKey(name: r'variables', required: true, includeIfNull: false)
  final Map<String, String> variables;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RenderTemplateDto &&
            runtimeType == other.runtimeType &&
            equals([variables], [other.variables]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([variables]);

  factory RenderTemplateDto.fromJson(Map<String, dynamic> json) =>
      _$RenderTemplateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RenderTemplateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
