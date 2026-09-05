//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demo_workspace_counts_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemoWorkspaceCountsDto {
  /// Returns a new [DemoWorkspaceCountsDto] instance.
  DemoWorkspaceCountsDto({

    required  this.users,

    required  this.representants,

    required  this.prospects,

    required  this.bankCases,
  });

  @JsonKey(
    
    name: r'users',
    required: true,
    includeIfNull: false,
  )


  final num users;



  @JsonKey(
    
    name: r'representants',
    required: true,
    includeIfNull: false,
  )


  final num representants;



  @JsonKey(
    
    name: r'prospects',
    required: true,
    includeIfNull: false,
  )


  final num prospects;



  @JsonKey(
    
    name: r'bankCases',
    required: true,
    includeIfNull: false,
  )


  final num bankCases;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is DemoWorkspaceCountsDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            users,
            representants,
            prospects,
            bankCases,
        ],
        [
            other.users,
            other.representants,
            other.prospects,
            other.bankCases,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        users,
        representants,
        prospects,
        bankCases,
    ],);

  factory DemoWorkspaceCountsDto.fromJson(Map<String, dynamic> json) => _$DemoWorkspaceCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemoWorkspaceCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

