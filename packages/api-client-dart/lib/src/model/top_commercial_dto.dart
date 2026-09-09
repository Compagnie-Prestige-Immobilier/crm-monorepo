//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'top_commercial_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopCommercialDto {
  /// Returns a new [TopCommercialDto] instance.
  TopCommercialDto({
    required this.id,

    required this.label,

    required this.prospects,

    required this.representants,

    required this.methodObtained,

    required this.conversionRate,

    required this.share,

    required this.derniereSaisie,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final num representants;

  @JsonKey(name: r'methodObtained', required: true, includeIfNull: false)
  final num methodObtained;

  @JsonKey(name: r'conversionRate', required: true, includeIfNull: true)
  final num? conversionRate;

  @JsonKey(name: r'share', required: true, includeIfNull: false)
  final num share;

  @JsonKey(name: r'derniereSaisie', required: true, includeIfNull: true)
  final DateTime? derniereSaisie;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is TopCommercialDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                label,
                prospects,
                representants,
                methodObtained,
                conversionRate,
                share,
                derniereSaisie,
              ],
              [
                other.id,
                other.label,
                other.prospects,
                other.representants,
                other.methodObtained,
                other.conversionRate,
                other.share,
                other.derniereSaisie,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        label,
        prospects,
        representants,
        methodObtained,
        conversionRate,
        share,
        derniereSaisie,
      ]);

  factory TopCommercialDto.fromJson(Map<String, dynamic> json) =>
      _$TopCommercialDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TopCommercialDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
