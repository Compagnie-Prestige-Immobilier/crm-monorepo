//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'stock_representants_part_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StockRepresentantsPartDto {
  /// Returns a new [StockRepresentantsPartDto] instance.
  StockRepresentantsPartDto({
    required this.id,

    required this.label,

    required this.count,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'count', required: true, includeIfNull: false)
  final num count;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is StockRepresentantsPartDto &&
            runtimeType == other.runtimeType &&
            equals([id, label, count], [other.id, other.label, other.count]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([id, label, count]);

  factory StockRepresentantsPartDto.fromJson(Map<String, dynamic> json) =>
      _$StockRepresentantsPartDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StockRepresentantsPartDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
