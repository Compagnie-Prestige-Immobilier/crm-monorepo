//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/demo_workspace_counts_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demo_workspace_status_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemoWorkspaceStatusDto {
  /// Returns a new [DemoWorkspaceStatusDto] instance.
  DemoWorkspaceStatusDto({

    required  this.workspace,

    required  this.counts,
  });

  @JsonKey(
    
    name: r'workspace',
    required: true,
    includeIfNull: false,
  unknownEnumValue: DemoWorkspaceStatusDtoWorkspaceEnum.unknownDefaultOpenApi,
  )


  final DemoWorkspaceStatusDtoWorkspaceEnum workspace;



  @JsonKey(
    
    name: r'counts',
    required: true,
    includeIfNull: false,
  )


  final DemoWorkspaceCountsDto counts;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is DemoWorkspaceStatusDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            workspace,
            counts,
        ],
        [
            other.workspace,
            other.counts,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        workspace,
        counts,
    ],);

  factory DemoWorkspaceStatusDto.fromJson(Map<String, dynamic> json) => _$DemoWorkspaceStatusDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemoWorkspaceStatusDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum DemoWorkspaceStatusDtoWorkspaceEnum {
@JsonValue(r'demo')
demo(r'demo'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const DemoWorkspaceStatusDtoWorkspaceEnum(this.value);

final String value;

@override
String toString() => value;
}


