//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_representant_comment_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateRepresentantCommentDto {
  /// Returns a new [CreateRepresentantCommentDto] instance.
  CreateRepresentantCommentDto({

    required  this.id,

    required  this.body,

     this.clientCreatedAt,
  });

      /// UUID v7 engendré par le client. Clé d’idempotence : un rejeu ne crée rien.
  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'body',
    required: true,
    includeIfNull: false,
  )


  final String body;



      /// Horodatage de la saisie sur le terrain. Défaut : maintenant.
  @JsonKey(
    
    name: r'clientCreatedAt',
    required: false,
    includeIfNull: false,
  )


  final DateTime? clientCreatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateRepresentantCommentDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            body,
            clientCreatedAt,
        ],
        [
            other.id,
            other.body,
            other.clientCreatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        body,
        clientCreatedAt,
    ],);

  factory CreateRepresentantCommentDto.fromJson(Map<String, dynamic> json) => _$CreateRepresentantCommentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateRepresentantCommentDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

