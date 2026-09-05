//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/suggestion_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_suggestion_status_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateSuggestionStatusDto {
  /// Returns a new [UpdateSuggestionStatusDto] instance.
  UpdateSuggestionStatusDto({

    required  this.status,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: SuggestionStatus.unknownDefaultOpenApi,
  )


  final SuggestionStatus status;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateSuggestionStatusDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            status,
        ],
        [
            other.status,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        status,
    ],);

  factory UpdateSuggestionStatusDto.fromJson(Map<String, dynamic> json) => _$UpdateSuggestionStatusDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateSuggestionStatusDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

