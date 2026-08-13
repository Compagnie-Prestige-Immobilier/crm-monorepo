//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/device_platform.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'device_token_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DeviceTokenDto {
  /// Returns a new [DeviceTokenDto] instance.
  DeviceTokenDto({
    required this.id,

    required this.platform,

    required this.appVersion,

    required this.lastSeenAt,

    required this.pushEnabled,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'platform',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DevicePlatform.unknownDefaultOpenApi,
  )
  final DevicePlatform platform;

  @JsonKey(name: r'appVersion', required: true, includeIfNull: true)
  final String? appVersion;

  @JsonKey(name: r'lastSeenAt', required: true, includeIfNull: false)
  final DateTime lastSeenAt;

  /// Faux quand aucun transport n’est configuré : le jeton est stocké, rien n’est remis.
  @JsonKey(name: r'pushEnabled', required: true, includeIfNull: false)
  final bool pushEnabled;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DeviceTokenDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, platform, appVersion, lastSeenAt, pushEnabled],
              [
                other.id,
                other.platform,
                other.appVersion,
                other.lastSeenAt,
                other.pushEnabled,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, platform, appVersion, lastSeenAt, pushEnabled]);

  factory DeviceTokenDto.fromJson(Map<String, dynamic> json) =>
      _$DeviceTokenDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DeviceTokenDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
