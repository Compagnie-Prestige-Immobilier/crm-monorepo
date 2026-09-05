//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/android_release_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'android_release_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AndroidReleaseListDto {
  /// Returns a new [AndroidReleaseListDto] instance.
  AndroidReleaseListDto({

    required  this.items,

    required  this.minVersionCode,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<AndroidReleaseDto> items;



  @JsonKey(
    
    name: r'minVersionCode',
    required: true,
    includeIfNull: true,
  )


  final num? minVersionCode;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is AndroidReleaseListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            minVersionCode,
        ],
        [
            other.items,
            other.minVersionCode,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        minVersionCode,
    ],);

  factory AndroidReleaseListDto.fromJson(Map<String, dynamic> json) => _$AndroidReleaseListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AndroidReleaseListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

