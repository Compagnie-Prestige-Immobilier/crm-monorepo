//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_call_attempt_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_call_attempt_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantCallAttemptListDto {
  /// Returns a new [RepresentantCallAttemptListDto] instance.
  RepresentantCallAttemptListDto({

    required  this.items,
  });

      /// Du plus récent au plus ancien.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<RepresentantCallAttemptDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is RepresentantCallAttemptListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
        ],
        [
            other.items,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
    ],);

  factory RepresentantCallAttemptListDto.fromJson(Map<String, dynamic> json) => _$RepresentantCallAttemptListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantCallAttemptListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

