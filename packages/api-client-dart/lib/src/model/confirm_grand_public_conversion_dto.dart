//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/payment_mode.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'confirm_grand_public_conversion_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfirmGrandPublicConversionDto {
  /// Returns a new [ConfirmGrandPublicConversionDto] instance.
  ConfirmGrandPublicConversionDto({
    required this.offerId,

    this.paymentMode,

    this.amountXof,

    this.durationMonths,
  });

  @JsonKey(name: r'offerId', required: true, includeIfNull: false)
  final String offerId;

  @JsonKey(
    name: r'paymentMode',
    required: false,
    includeIfNull: false,
    unknownEnumValue: PaymentMode.unknownDefaultOpenApi,
  )
  final PaymentMode? paymentMode;

  // minimum: 0
  // maximum: 2147483647
  @JsonKey(name: r'amountXof', required: false, includeIfNull: false)
  final num? amountXof;

  // minimum: 1
  // maximum: 300
  @JsonKey(name: r'durationMonths', required: false, includeIfNull: false)
  final num? durationMonths;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ConfirmGrandPublicConversionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [offerId, paymentMode, amountXof, durationMonths],
              [
                other.offerId,
                other.paymentMode,
                other.amountXof,
                other.durationMonths,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([offerId, paymentMode, amountXof, durationMonths]);

  factory ConfirmGrandPublicConversionDto.fromJson(Map<String, dynamic> json) =>
      _$ConfirmGrandPublicConversionDtoFromJson(json);

  Map<String, dynamic> toJson() =>
      _$ConfirmGrandPublicConversionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
