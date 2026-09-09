//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'analytics_totals_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnalyticsTotalsDto {
  /// Returns a new [AnalyticsTotalsDto] instance.
  AnalyticsTotalsDto({
    required this.prospects,

    required this.representants,

    required this.commerciauxActifs,

    required this.departementsCouverts,

    required this.nouveau,

    required this.contacte,

    required this.converti,

    required this.perdu,

    required this.prospects7Jours,

    required this.prospects30Jours,
  });

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final num representants;

  @JsonKey(name: r'commerciauxActifs', required: true, includeIfNull: false)
  final num commerciauxActifs;

  @JsonKey(name: r'departementsCouverts', required: true, includeIfNull: false)
  final num departementsCouverts;

  @JsonKey(name: r'nouveau', required: true, includeIfNull: false)
  final num nouveau;

  @JsonKey(name: r'contacte', required: true, includeIfNull: false)
  final num contacte;

  @JsonKey(name: r'converti', required: true, includeIfNull: false)
  final num converti;

  @JsonKey(name: r'perdu', required: true, includeIfNull: false)
  final num perdu;

  /// Prospects saisis sur les 7 derniers jours.
  @JsonKey(name: r'prospects7Jours', required: true, includeIfNull: false)
  final num prospects7Jours;

  /// Prospects saisis sur les 30 derniers jours.
  @JsonKey(name: r'prospects30Jours', required: true, includeIfNull: false)
  final num prospects30Jours;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AnalyticsTotalsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                prospects,
                representants,
                commerciauxActifs,
                departementsCouverts,
                nouveau,
                contacte,
                converti,
                perdu,
                prospects7Jours,
                prospects30Jours,
              ],
              [
                other.prospects,
                other.representants,
                other.commerciauxActifs,
                other.departementsCouverts,
                other.nouveau,
                other.contacte,
                other.converti,
                other.perdu,
                other.prospects7Jours,
                other.prospects30Jours,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        prospects,
        representants,
        commerciauxActifs,
        departementsCouverts,
        nouveau,
        contacte,
        converti,
        perdu,
        prospects7Jours,
        prospects30Jours,
      ]);

  factory AnalyticsTotalsDto.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsTotalsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnalyticsTotalsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
