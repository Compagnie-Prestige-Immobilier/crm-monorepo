//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/callback_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'callback_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CallbackListDto {
  /// Returns a new [CallbackListDto] instance.
  CallbackListDto({

    required  this.items,

    required  this.serverTime,
  });

      /// Du plus ancien au plus récent.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<CallbackDto> items;



      /// Heure du serveur ayant servi à décider du retard.
  @JsonKey(
    
    name: r'serverTime',
    required: true,
    includeIfNull: false,
  )


  final DateTime serverTime;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CallbackListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            serverTime,
        ],
        [
            other.items,
            other.serverTime,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        serverTime,
    ],);

  factory CallbackListDto.fromJson(Map<String, dynamic> json) => _$CallbackListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CallbackListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

