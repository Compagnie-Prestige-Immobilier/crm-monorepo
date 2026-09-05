//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/grand_public_consent.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_grand_public_consent_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateGrandPublicConsentDto {
  /// Returns a new [UpdateGrandPublicConsentDto] instance.
  UpdateGrandPublicConsentDto({required this.consent});

  @JsonKey(
    name: r'consent',
    required: true,
    includeIfNull: false,
    unknownEnumValue: GrandPublicConsent.unknownDefaultOpenApi,
  )
  final GrandPublicConsent consent;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateGrandPublicConsentDto &&
            runtimeType == other.runtimeType &&
            equals([consent], [other.consent]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([consent]);

  factory UpdateGrandPublicConsentDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateGrandPublicConsentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateGrandPublicConsentDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
