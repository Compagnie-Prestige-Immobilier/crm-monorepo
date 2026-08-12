//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/directory_entry_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'directory_page_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DirectoryPageDto {
  /// Returns a new [DirectoryPageDto] instance.
  DirectoryPageDto({
    required this.entries,

    required this.nextCursor,

    required this.hasMore,

    required this.serverTime,
  });

  @JsonKey(name: r'entries', required: true, includeIfNull: false)
  final List<DirectoryEntryDto> entries;

  /// Curseur opaque à renvoyer tel quel au prochain appel.
  @JsonKey(name: r'nextCursor', required: true, includeIfNull: false)
  final String nextCursor;

  /// Vrai tant qu’il reste des pages ; le client boucle jusqu’à faux.
  @JsonKey(name: r'hasMore', required: true, includeIfNull: false)
  final bool hasMore;

  @JsonKey(name: r'serverTime', required: true, includeIfNull: false)
  final DateTime serverTime;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DirectoryPageDto &&
            runtimeType == other.runtimeType &&
            equals(
              [entries, nextCursor, hasMore, serverTime],
              [
                other.entries,
                other.nextCursor,
                other.hasMore,
                other.serverTime,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([entries, nextCursor, hasMore, serverTime]);

  factory DirectoryPageDto.fromJson(Map<String, dynamic> json) =>
      _$DirectoryPageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DirectoryPageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
