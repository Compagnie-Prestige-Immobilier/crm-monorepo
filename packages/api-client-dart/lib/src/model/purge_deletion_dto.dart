//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/purge_domain_key.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'purge_deletion_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PurgeDeletionDto {
  /// Returns a new [PurgeDeletionDto] instance.
  PurgeDeletionDto({

    required  this.key,

    required  this.label,

    required  this.rows,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PurgeDomainKey.unknownDefaultOpenApi,
  )


  final PurgeDomainKey key;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'rows',
    required: true,
    includeIfNull: false,
  )


  final num rows;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is PurgeDeletionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            key,
            label,
            rows,
        ],
        [
            other.key,
            other.label,
            other.rows,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        key,
        label,
        rows,
    ],);

  factory PurgeDeletionDto.fromJson(Map<String, dynamic> json) => _$PurgeDeletionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PurgeDeletionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

