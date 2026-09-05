//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_visite_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateVisiteDto {
  /// Returns a new [UpdateVisiteDto] instance.
  UpdateVisiteDto({

     this.time,

     this.visitorName,

     this.phone,

     this.entrepriseId,

     this.objetId,

     this.directionId,

     this.destinataireId,

     this.comment,
  });

  @JsonKey(
    
    name: r'time',
    required: false,
    includeIfNull: false,
  )


  final String? time;



  @JsonKey(
    
    name: r'visitorName',
    required: false,
    includeIfNull: false,
  )


  final String? visitorName;



  @JsonKey(
    
    name: r'phone',
    required: false,
    includeIfNull: false,
  )


  final String? phone;



  @JsonKey(
    
    name: r'entrepriseId',
    required: false,
    includeIfNull: false,
  )


  final String? entrepriseId;



  @JsonKey(
    
    name: r'objetId',
    required: false,
    includeIfNull: false,
  )


  final String? objetId;



  @JsonKey(
    
    name: r'directionId',
    required: false,
    includeIfNull: false,
  )


  final String? directionId;



  @JsonKey(
    
    name: r'destinataireId',
    required: false,
    includeIfNull: false,
  )


  final String? destinataireId;



  @JsonKey(
    
    name: r'comment',
    required: false,
    includeIfNull: false,
  )


  final String? comment;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateVisiteDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            time,
            visitorName,
            phone,
            entrepriseId,
            objetId,
            directionId,
            destinataireId,
            comment,
        ],
        [
            other.time,
            other.visitorName,
            other.phone,
            other.entrepriseId,
            other.objetId,
            other.directionId,
            other.destinataireId,
            other.comment,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        time,
        visitorName,
        phone,
        entrepriseId,
        objetId,
        directionId,
        destinataireId,
        comment,
    ],);

  factory UpdateVisiteDto.fromJson(Map<String, dynamic> json) => _$UpdateVisiteDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateVisiteDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

