//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/device_call_detection_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'device_call_detection_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DeviceCallDetectionListDto {
  /// Returns a new [DeviceCallDetectionListDto] instance.
  DeviceCallDetectionListDto({required this.items});

  /// Du plus récent au plus ancien.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<DeviceCallDetectionDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DeviceCallDetectionListDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory DeviceCallDetectionListDto.fromJson(Map<String, dynamic> json) =>
      _$DeviceCallDetectionListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DeviceCallDetectionListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
