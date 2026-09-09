//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/client_request_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'client_request_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClientRequestListDto {
  /// Returns a new [ClientRequestListDto] instance.
  ClientRequestListDto({
    required this.items,

    required this.meta,

    required this.pendingCount,
  });

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<ClientRequestDto> items;

  @JsonKey(name: r'meta', required: true, includeIfNull: false)
  final PageMetaDto meta;

  /// Demandes encore en attente, TOUS filtres confondus. C’est ce nombre que porte la pastille du menu : filtré, il retomberait à zéro dès qu’un admin consulte l’onglet « approuvées ».
  @JsonKey(name: r'pendingCount', required: true, includeIfNull: false)
  final num pendingCount;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ClientRequestListDto &&
            runtimeType == other.runtimeType &&
            equals(
              [items, meta, pendingCount],
              [other.items, other.meta, other.pendingCount],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([items, meta, pendingCount]);

  factory ClientRequestListDto.fromJson(Map<String, dynamic> json) =>
      _$ClientRequestListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ClientRequestListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
