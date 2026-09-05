//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_heure_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatHeureDto {
  /// Returns a new [VisiteStatHeureDto] instance.
  VisiteStatHeureDto({

    required  this.hour,

    required  this.count,
  });

          // minimum: 0
          // maximum: 23
  @JsonKey(
    
    name: r'hour',
    required: true,
    includeIfNull: false,
  )


  final num hour;



  @JsonKey(
    
    name: r'count',
    required: true,
    includeIfNull: false,
  )


  final num count;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteStatHeureDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            hour,
            count,
        ],
        [
            other.hour,
            other.count,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        hour,
        count,
    ],);

  factory VisiteStatHeureDto.fromJson(Map<String, dynamic> json) => _$VisiteStatHeureDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatHeureDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

