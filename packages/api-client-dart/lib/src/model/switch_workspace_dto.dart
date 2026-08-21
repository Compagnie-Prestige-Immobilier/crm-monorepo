//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'switch_workspace_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SwitchWorkspaceDto {
  /// Returns a new [SwitchWorkspaceDto] instance.
  SwitchWorkspaceDto({required this.workspace});

  @JsonKey(
    name: r'workspace',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SwitchWorkspaceDtoWorkspaceEnum.unknownDefaultOpenApi,
  )
  final SwitchWorkspaceDtoWorkspaceEnum workspace;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SwitchWorkspaceDto &&
            runtimeType == other.runtimeType &&
            equals([workspace], [other.workspace]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([workspace]);

  factory SwitchWorkspaceDto.fromJson(Map<String, dynamic> json) =>
      _$SwitchWorkspaceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SwitchWorkspaceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SwitchWorkspaceDtoWorkspaceEnum {
  @JsonValue(r'public')
  public(r'public'),
  @JsonValue(r'demo')
  demo(r'demo'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SwitchWorkspaceDtoWorkspaceEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
