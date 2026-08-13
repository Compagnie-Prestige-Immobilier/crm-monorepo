//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/device_platform.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'register_device_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RegisterDeviceDto {
  /// Returns a new [RegisterDeviceDto] instance.
  RegisterDeviceDto({
    required this.token,

    this.platform,

    this.appVersion,

    this.pendingOps,
  });

  /// Jeton d’enregistrement FCM. Réattribué si un autre compte le détenait.
  @JsonKey(name: r'token', required: true, includeIfNull: false)
  final String token;

  @JsonKey(
    name: r'platform',
    required: false,
    includeIfNull: false,
    unknownEnumValue: DevicePlatform.unknownDefaultOpenApi,
  )
  final DevicePlatform? platform;

  @JsonKey(name: r'appVersion', required: false, includeIfNull: false)
  final String? appVersion;

  /// Écritures encore dans la file locale. Alimente le rappel « saisies non synchronisées » ; le serveur ne peut pas le deviner.
  // minimum: 0
  @JsonKey(name: r'pendingOps', required: false, includeIfNull: false)
  final num? pendingOps;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RegisterDeviceDto &&
            runtimeType == other.runtimeType &&
            equals(
              [token, platform, appVersion, pendingOps],
              [other.token, other.platform, other.appVersion, other.pendingOps],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([token, platform, appVersion, pendingOps]);

  factory RegisterDeviceDto.fromJson(Map<String, dynamic> json) =>
      _$RegisterDeviceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RegisterDeviceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
