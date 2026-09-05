//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/notification_template_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'notification_template_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NotificationTemplateListDto {
  /// Returns a new [NotificationTemplateListDto] instance.
  NotificationTemplateListDto({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<NotificationTemplateDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is NotificationTemplateListDto &&
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

  factory NotificationTemplateListDto.fromJson(Map<String, dynamic> json) => _$NotificationTemplateListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NotificationTemplateListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

