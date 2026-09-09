//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'serie_jour_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SerieJourDto {
  /// Returns a new [SerieJourDto] instance.
  SerieJourDto({required this.jour, required this.inscriptions});

  @JsonKey(name: r'jour', required: true, includeIfNull: false)
  final DateTime jour;

  @JsonKey(name: r'inscriptions', required: true, includeIfNull: false)
  final num inscriptions;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SerieJourDto &&
            runtimeType == other.runtimeType &&
            equals([jour, inscriptions], [other.jour, other.inscriptions]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([jour, inscriptions]);

  factory SerieJourDto.fromJson(Map<String, dynamic> json) =>
      _$SerieJourDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SerieJourDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
