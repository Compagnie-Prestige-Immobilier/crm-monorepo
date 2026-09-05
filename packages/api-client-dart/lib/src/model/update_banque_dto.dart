//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_banque_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateBanqueDto {
  /// Returns a new [UpdateBanqueDto] instance.
  UpdateBanqueDto({

     this.name,

     this.shortName,

     this.isActive = true,

     this.sortOrder = 100,
  });

  @JsonKey(
    
    name: r'name',
    required: false,
    includeIfNull: false,
  )


  final String? name;



  @JsonKey(
    
    name: r'shortName',
    required: false,
    includeIfNull: false,
  )


  final String? shortName;



  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;



  @JsonKey(
    defaultValue: 100,
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )


  final num? sortOrder;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateBanqueDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            name,
            shortName,
            isActive,
            sortOrder,
        ],
        [
            other.name,
            other.shortName,
            other.isActive,
            other.sortOrder,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        name,
        shortName,
        isActive,
        sortOrder,
    ],);

  factory UpdateBanqueDto.fromJson(Map<String, dynamic> json) => _$UpdateBanqueDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateBanqueDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

