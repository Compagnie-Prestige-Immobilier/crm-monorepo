//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/stock_representants_part_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'stock_representants_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StockRepresentantsDto {
  /// Returns a new [StockRepresentantsDto] instance.
  StockRepresentantsDto({
    required this.total,

    required this.jamaisAppeles,

    required this.injoignables,

    required this.parDepartement,

    required this.parIef,
  });

  /// Représentants non supprimés, toutes fiches.
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  /// Représentants sans aucun appel.
  @JsonKey(name: r'jamaisAppeles', required: true, includeIfNull: false)
  final num jamaisAppeles;

  /// Représentants dont le statut est non joint, hors « Injoignable définitif ».
  @JsonKey(name: r'injoignables', required: true, includeIfNull: false)
  final num injoignables;

  @JsonKey(name: r'parDepartement', required: true, includeIfNull: false)
  final List<StockRepresentantsPartDto> parDepartement;

  @JsonKey(name: r'parIef', required: true, includeIfNull: false)
  final List<StockRepresentantsPartDto> parIef;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is StockRepresentantsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [total, jamaisAppeles, injoignables, parDepartement, parIef],
              [
                other.total,
                other.jamaisAppeles,
                other.injoignables,
                other.parDepartement,
                other.parIef,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        total,
        jamaisAppeles,
        injoignables,
        parDepartement,
        parIef,
      ]);

  factory StockRepresentantsDto.fromJson(Map<String, dynamic> json) =>
      _$StockRepresentantsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$StockRepresentantsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
