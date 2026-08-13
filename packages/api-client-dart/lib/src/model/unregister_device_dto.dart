//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'unregister_device_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UnregisterDeviceDto {
  /// Returns a new [UnregisterDeviceDto] instance.
  UnregisterDeviceDto({required this.token});

  @JsonKey(name: r'token', required: true, includeIfNull: false)
  final String token;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UnregisterDeviceDto &&
            runtimeType == other.runtimeType &&
            equals([token], [other.token]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([token]);

  factory UnregisterDeviceDto.fromJson(Map<String, dynamic> json) =>
      _$UnregisterDeviceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UnregisterDeviceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
