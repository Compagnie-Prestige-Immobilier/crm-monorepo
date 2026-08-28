//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_stat_recurrent_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteStatRecurrentDto {
  /// Returns a new [VisiteStatRecurrentDto] instance.
  VisiteStatRecurrentDto({
    required this.nom,

    required this.visites,

    required this.derniereVisite,
  });

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'visites', required: true, includeIfNull: false)
  final num visites;

  @JsonKey(name: r'derniereVisite', required: true, includeIfNull: false)
  final String derniereVisite;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteStatRecurrentDto &&
            runtimeType == other.runtimeType &&
            equals(
              [nom, visites, derniereVisite],
              [other.nom, other.visites, other.derniereVisite],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([nom, visites, derniereVisite]);

  factory VisiteStatRecurrentDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteStatRecurrentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteStatRecurrentDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
