//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/named_count_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'named_count_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NamedCountListDto {
  /// Returns a new [NamedCountListDto] instance.
  NamedCountListDto({required this.items, required this.total});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<NamedCountDto> items;

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is NamedCountListDto &&
            runtimeType == other.runtimeType &&
            equals([items, total], [other.items, other.total]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items, total]);

  factory NamedCountListDto.fromJson(Map<String, dynamic> json) =>
      _$NamedCountListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NamedCountListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
